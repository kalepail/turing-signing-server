import { Keypair } from 'stellar-sdk'

import { createJsonResponse, parseError } from './js/utils'
import Pool from './js/pg'
import AWS from 'aws-sdk'

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const pgClient = await Pool.connect()

    const signerSecret = await pgClient.query(`
     SELECT signer FROM contracts
     WHERE contract = $1
   `, [event.pathParameters.hash]).then((data) => {
      const contractSigner = data.rows[0]

      if (contractSigner)
        return contractSigner.signer

      throw {
        status: 404,
        message: 'Contract not found'
      }
    })

    await pgClient.release()

    const {fields, contract} = await s3.headObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
    }).promise()
    .then(({Metadata: {fields}}) => ({
      fields: fields ? JSON.parse(Buffer.from(fields, 'base64').toString('utf8')) : undefined
    }))

    const signerKeypair = Keypair.fromSecret(signerSecret)

    return createJsonResponse({
        contract,
        fields,
        signer: signerKeypair.publicKey(),
        turret: process.env.TURRET_ADDRESS,
        fee: process.env.TURRET_RUN_FEE
    })
  }

  catch(err) {
    return parseError(err)
  }
}