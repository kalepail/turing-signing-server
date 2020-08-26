import { Keypair } from 'stellar-sdk'
import AWS from 'aws-sdk'
import { compact } from 'lodash'
import Promise from 'bluebird'

import { createJsonResponse, parseError } from './js/utils'
import Pool from './js/pg'

// TODO
// Add another collation get endpoint which gets a contract's turrets and returns an array response of all turret data

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const pgClient = await Pool.connect()

    const pgContracts = await pgClient.query(`
      SELECT contract, signer FROM contracts
   `).then((data) => data.rows || [])

    await pgClient.release()

    const contracts = await new Promise.map(pgContracts, ({contract, signer}) =>
      s3.headObject({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: contract
      })
      .promise()
      .then(({Metadata: {fields, authkey}}) => ({
        contract: contract,
        authkey,
        signer: Keypair.fromSecret(signer).publicKey(),
        fields: fields ? JSON.parse(Buffer.from(fields, 'base64').toString('utf8')) : undefined,
      }))
      .catch(() => null)
    ).then((contracts) => compact(contracts)) // Don't throw on missing contracts

    return createJsonResponse({
      vault: process.env.TURING_VAULT_ADDRESS,
      runFee: process.env.TURING_RUN_FEE,
      uploadFee: process.env.TURING_UPLOAD_FEE,
      network: process.env.STELLAR_NETWORK,
      contracts
    })
  } catch (err) {
    return parseError(err)
  }
}