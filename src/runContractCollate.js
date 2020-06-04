import AWS from 'aws-sdk'
import { Transaction, Networks } from 'stellar-sdk'
import { chain, map, each, compact, sampleSize } from 'lodash'
import axios from 'axios'
import Promise from 'bluebird'

import { isDev, headers, parseError } from './js/utils'

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

// Support multisig on XLM payment accounts
// If response isn't a valid signed XDR ready for submission error out
// If a request was successful the same request should be successful again
  // Main concern here is fees, need to check did it increase balance by the fee not just does it in the request
// Right now user pays for turing signing server fees, that might should be on the issuer (this) side
// Axios should have timeouts
// How do turing servers ensure contracts have fee logic built in?

// Since we're now only paying for work done if work fails to get done we should kill the whole process
  // Any maybe report which TSS failed in the error

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const signatureCount = parseInt(event.queryStringParameters.signatures || 20, 10)
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

    // Not forwarding turretsContractData as I think it opens an attack vector for bad fees to be encoded without any way to check
      // Only exception would be if a user were paying turing fees not the contract

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