import { Keypair } from 'stellar-sdk'
import AWS from 'aws-sdk'
import middy from '@middy/core'
import httpMultipartBodyParser from '@middy/http-multipart-body-parser'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import doNotWaitForEmptyEventLoop from '@middy/do-not-wait-for-empty-event-loop'
import Promise from 'bluebird'
import { map } from 'lodash'

import { headers, parseError } from './js/utils'
import Pool from './js/pg'

// Require TURING_UPLOAD_FEE to be paid in a presigned txn to the TURING_VAULT_ADDRESS
// If limits are hit throw error don't just truncate
  // https://github.com/middyjs/middy/tree/master/packages/http-multipart-body-parser
  // https://github.com/mscdex/busboy/issues/76

// Should/could this be a collation endpoint which takes the turrets and forwards on the contract to the other turrets and sends back the responses in an array?

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

const originalHandler = async (event) => {
  try {
    const signer = Keypair.random()

    const Tagging = map(
      Buffer.from(event.body.turrets, 'base64').toString('utf8').split(','),
      (turret, i) => `Turret_${i}=${Buffer.from(turret, 'utf8').toString('base64')}`
    ).join('&')

    await s3.putObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
      Body: event.body.contract.content,
      ContentType: event.body.contract.mimetype,
      ContentLength: event.body.contract.content.length,
      StorageClass: 'STANDARD',
      CacheControl: 'public; max-age=31536000',
      ACL: 'public-read',
      Tagging
    }).promise()

    const pgClient = await Pool.connect()

    await pgClient.query(`
      INSERT INTO contracts (contract, signer)
      SELECT '${event.pathParameters.hash}', '${signer.secret()}'
    `)

    await pgClient.release()

    return {
      headers,
      statusCode: 200,
      body: JSON.stringify({
        vault: process.env.TURING_VAULT_ADDRESS,
        signer: signer.publicKey(),
        fee: process.env.TURING_RUN_FEE
      })
    }
  }

  catch(err) {
    throw err
  }
}

const handler = middy(originalHandler)

handler
.use(doNotWaitForEmptyEventLoop({
  runOnBefore: true,
  runOnAfter: true,
  runOnError: true
}))
.use(httpHeaderNormalizer())
.use(httpMultipartBodyParser({
  busboy: {
    limits: {
      fieldNameSize: 8,
      fieldSize: 1000,
      fields: 1,
      fileSize: 1000000,
      files: 1,
      parts: 2,
      headerPairs: 2
    }
  }
}))
.use({
  async before(handler) {
    if (
      handler.event.body.contract.mimetype !== 'application/javascript'
    ) throw 'Contract must be JavaScript'

    const s3Contract = await s3.headObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: handler.event.pathParameters.hash,
    }).promise().catch(() => null)

    const pgClient = await Pool.connect()

    const signerSecret = await pgClient.query(`
      SELECT contract FROM contracts
      WHERE contract = '${handler.event.pathParameters.hash}'
    `).then((data) => data.rows[0]).catch(() => null)

    await pgClient.release()

    if (
      s3Contract
      || signerSecret
    ) throw 'Contract already exists'

    return
  }
})
.use({
  onError(handler, next) {
    handler.response = parseError(handler.error)
    next()
  }
})

export default handler