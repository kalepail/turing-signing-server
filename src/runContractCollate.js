import AWS from 'aws-sdk'
import { Transaction, Networks } from 'stellar-sdk'
import { chain, map, each, compact, sampleSize } from 'lodash'
import axios from 'axios'
import Promise from 'bluebird'

import { isDev, headers, parseError } from './js/utils'

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

// TODO
// Axios should have timeouts
// If a turret causes a failure we should report which turret failed so we can exclude it in subsequent calls

// DONE
// If response isn't a valid signed XDR ready for submission error out
// If a request was successful the same request should fail as we don't want the same response to be valid, rate limit avoidance loop attack vector
// Contract Creators should be able to decide who pays fees and not be forced to make users pay them
// TSS need to ensure contracts have fee logic built in
// If work fails to get done we should kill the whole process

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const signatureCount = parseInt(event.queryStringParameters.signatures, 10)
    const contractTurrets = isDev
    ? [
      'https://localhost:4000/dev',
      'https://localhost:4001/dev',
      'https://localhost:4002/dev',
      'https://localhost:4003/dev',
      'https://localhost:4004/dev',
    ]
    : await s3.getObjectTagging({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
    }).promise()
    .then(({TagSet}) => map(TagSet, (tag) => Buffer.from(tag.Value, 'base64').toString('utf8')))

    const selectedTurrets = await Promise.map(contractTurrets, async (turret) =>
      axios.get(`${turret}/contract/${event.pathParameters.hash}`)
      .then(() => turret)
      .catch(() => null) // Don't error out if a turingSigningServer request fails
    )
    .then((data) => compact(data)) // Remove failed requests
    .then((turrets) => sampleSize(turrets, signatureCount)) // Only make and pay for the requests we need

    const contractTurretResponses = await Promise.map(selectedTurrets, async (turret) =>
      axios.post(`${turret}/contract/${event.pathParameters.hash}/run`, JSON.parse(event.body), {
        headers: {
          'X-Turrets': Buffer.from(JSON.stringify(selectedTurrets)).toString('base64')
        }
      })
      .then(({data}) => data)
    )

    if (contractTurretResponses.length === 0)
      throw 'Every turret failed'

    if (contractTurretResponses.length < signatureCount)
      throw 'Insufficient signatures'

    const xdrs = chain(contractTurretResponses)
    .map('xdr')
    .uniq()
    .value()

    if (xdrs.length > 1)
      throw 'Mismatched XDRs'

    const transaction = new Transaction(xdrs[0], Networks[process.env.STELLAR_NETWORK])

    each(contractTurretResponses, (response) =>
      transaction.addSignature(response.signer, response.signature)
    )

    return {
      headers: {
        ...headers,
        'Content-Type': 'text/plain'
      },
      statusCode: 200,
      body: transaction.toXDR()
    }
  }

  catch(err) {
    return parseError(err)
  }
}