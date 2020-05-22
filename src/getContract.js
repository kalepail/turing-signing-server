import { Keypair } from 'stellar-sdk'

import { headers, parseError } from './js/utils'
import Pool from './js/pg'
import AWS from 'aws-sdk'

// Should/could we add another collation get endpoint which gets a contract's turrets and returns an array response of all turret data?

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const pgClient = await Pool.connect()

    const signerSecret = await pgClient.query(`
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

    await pgClient.release()

    const fields = await s3.headObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
    }).promise()
    .then(({Metadata: {fields}}) => fields ? JSON.parse(Buffer.from(fields, 'base64').toString('utf8')) : undefined)

    const signerKeypair = Keypair.fromSecret(signerSecret)

    return {
      headers,
      statusCode: 200,
      body: JSON.stringify({
        vault: process.env.TURING_VAULT_ADDRESS,
        signer: signerKeypair.publicKey(),
        fee: process.env.TURING_RUN_FEE,
        fields
      })
    }
  }

  catch(err) {
    return parseError(err)
  }
}