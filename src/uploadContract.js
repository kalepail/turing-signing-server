import { Transaction, Keypair, Networks, Asset, Server } from 'stellar-sdk'
import AWS from 'aws-sdk'
import middy from '@middy/core'
import httpMultipartBodyParser from '@tinyanvil/http-multipart-body-parser'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import doNotWaitForEmptyEventLoop from '@middy/do-not-wait-for-empty-event-loop'
import Promise from 'bluebird'
import { map, find } from 'lodash'
import shajs from 'sha.js'
import BigNumber from 'bignumber.js'

import { parseError, createJsonResponse } from './js/utils'
import Pool from './js/pg'

// TODO
// Add a collation endpoint which takes the turrets and forwards on the contract to the other turrets and sends back the responses in an array

// DONE
// Require TURING_UPLOAD_FEE to be paid in a presigned txn to the TURING_VAULT_ADDRESS
// If fileSize limit is hit throw error
  // https://github.com/middyjs/middy/tree/master/packages/http-multipart-body-parser
  // https://github.com/mscdex/busboy/issues/76

AWS.config.setPromisesDependency(Promise)

const horizon = process.env.STELLAR_NETWORK === 'TESTNET' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'
const server = new Server(horizon)
const s3 = new AWS.S3()

const originalHandler = async (event) => {
  try {
    const signer = Keypair.random()
    const codeHash = shajs('sha256').update(event.body.contract.content).digest('hex')

    const Tagging = map(
      Buffer.from(event.body.turrets, 'base64').toString('utf8').split(','),
      (turret, i) => `Turret_${i}=${Buffer.from(turret, 'utf8').toString('base64')}`
    ).join('&')

    let Metadata

    if (event.body.fields)
      Metadata = {Fields: event.body.fields}

    await s3.putObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: codeHash,
      Body: event.body.contract.content,
      ContentType: event.body.contract.mimetype,
      ContentLength: event.body.contract.content.length,
      StorageClass: 'STANDARD',
      CacheControl: 'public; max-age=31536000',
      ACL: 'public-read',
      Metadata,
      Tagging
    }).promise()

    const pgClient = await Pool.connect()

    await pgClient.query(`
      INSERT INTO contracts (contract, signer)
      VALUES ($1, $2)
    `, [codeHash, signer.secret()])

    await pgClient.release()

    return createJsonResponse({
      hash: codeHash,
      vault: process.env.TURING_VAULT_ADDRESS,
      signer: signer.publicKey(),
      fee: process.env.TURING_RUN_FEE
    })
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
      fieldNameSize: 10,
      fieldSize: 1000,
      fields: 4,
      fileSize: 32e6, // 32 MB
      files: 1,
      parts: 5,
      headerPairs: 2
    }
  }
}))
.use({
  async before(handler) {
    if (
      handler.event.body.contract.mimetype !== 'application/javascript'
    ) throw 'Contract must be JavaScript'

    if (handler.event.body.contract.truncated)
      throw 'Contract file is too big'

    // Check if contract has already been uploaded
    const codeHash = shajs('sha256').update(handler.event.body.contract.content).digest('hex')

    const s3Contract = await s3.headObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: codeHash,
    }).promise().catch(() => null)

    const pgClient = await Pool.connect()

    const signerSecret = await pgClient.query(`
      SELECT contract FROM contracts
      WHERE contract = $1
    `, [codeHash]).then((data) => data.rows[0]).catch(() => null)

    await pgClient.release()

    if (
      s3Contract
      || signerSecret
    ) throw 'Contract already exists'
    ////

    // Check for and submit valid upload payment
    if (!process.env.TURING_UPLOAD_FEE) return
    const transaction = new Transaction(handler.event.body.payment, Networks[process.env.STELLAR_NETWORK])
    const hash = transaction.hash().toString('hex')

    await server
    .transactions()
    .transaction(hash)
    .call()
    .catch((err) => err)
    .then((err) => {
      if (
        err.response
        && err.response.status === 404
      ) return

      else if (err.response)
        throw err

      throw 'Transaction has already been submitted'
    })

    if (!find(transaction._operations, {
      type: 'payment',
      destination: process.env.TURING_VAULT_ADDRESS,
      amount: new BigNumber(process.env.TURING_UPLOAD_FEE).toFixed(7),
      asset: Asset.native()
    })) throw 'Missing or invalid fee payment'

    await server.submitTransaction(transaction)
    ////

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