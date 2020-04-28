import { Keypair } from 'stellar-sdk'
import AWS from 'aws-sdk'
import multer from 'multer'
import express from 'express'
import serverless from 'serverless-http'
import { json } from 'body-parser'
import Promise from 'bluebird'

import { parseError } from './js/utils'
import Pool from './js/pg'

// Require TURING_UPLOAD_FEE to be paid in a presigned txn to the TURING_VAULT_ADDRESS
// Rewrite this endpoint without express or serverless-http

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()
const app = express()
const upload = multer({
  limits: {
    fieldNameSize: 8,
    fieldSize: 0,
    fields: 1,
    fileSize: 1000000,
    files: 1,
    parts: 1,
    headerPairs: 2
  },
  async fileFilter(request, file, cb) {
    if (
      file.mimetype !== 'application/javascript'
    ) return cb(new Error('Contract must be JavaScript'))

    const s3Contract = await s3.headObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: request.params.hash,
    }).promise().catch(() => null)

    const signerSecret = await Pool.query(`
      SELECT contract FROM contracts
      WHERE contract = '${request.params.hash}'
    `).then((data) => data.rows[0]).catch(() => null)

    if (
      s3Contract
      || signerSecret
    ) return cb(new Error('Contract already exists'))

    cb(null, true)
  }
})

app.use(json())

app.post('/contract/:hash', upload.single('contract'), async (request, response, next) => {
  try {
    const signer = Keypair.random()

    await s3.upload({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: request.params.hash,
      Body: request.file.buffer,
      ContentType: request.file.mimetype,
      ContentLength: request.file.size,
      StorageClass: 'STANDARD',
      CacheControl: 'public',
      ACL: 'public-read',
    }).promise()

    await Pool.query(`
      INSERT INTO contracts (contract, signer)
      SELECT '${request.params.hash}', '${signer.secret()}'
    `)

    response.json({
      vault: process.env.TURING_VAULT_ADDRESS,
      signer: signer.publicKey(),
      fee: process.env.TURING_RUN_FEE
    })
  }

  catch(err) {
    next(err)
  }
})

app.use((err, request, response, next) => {
  const {
    statusCode,
    headers,
    body
  } = parseError(err)

  response
  .set({
    ...headers,
    'Content-Type': 'application/json'
  })
  .status(statusCode)
  .send(body)
})

export default serverless(app)