import AWS from 'aws-sdk'
import Promise from 'bluebird'
import { Keypair, Networks, Transaction } from 'stellar-sdk'

import lambda from './js/lambda'
import { headers, parseError } from './js/utils'
import Pool from './js/pg'

// Check for fees before signing xdr

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

export default async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
    }

    const s3Contract = await s3.getObject(params).promise()
    const signerSecret = await Pool.query(`
      SELECT signer FROM contracts
      WHERE contract = '${event.pathParameters.hash}'
    `).then((data) => {
      const contractSigner = data.rows[0]

      if (contractSigner)
        return contractSigner.signer

      throw {
        status: 404,
        message: 'Contract not found'
      }
    })

    const signerKeypair = Keypair.fromSecret(signerSecret)

    const xdr = await lambda.invoke({
      FunctionName: `${process.env.SERVICE_NAME}-dev-runContractPrivate`,
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Payload: JSON.stringify({
        script: s3Contract.Body.toString('utf8'),
        body: JSON.parse(event.body)
      })
    })
    .promise()
    .then(({Payload}) => Payload)

    const transaction = new Transaction(xdr, Networks[process.env.STELLAR_NETWORK])
    const signature = signerKeypair.sign(transaction.hash()).toString('base64')

    return {
      headers,
      statusCode: 200,
      body: JSON.stringify({
        xdr,
        signature
      })
    }
  }

  catch(err) {
    return parseError(err)
  }
}