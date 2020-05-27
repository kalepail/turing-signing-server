import AWS from 'aws-sdk'
import { map } from 'lodash'
import Promise from 'bluebird'
import middy from '@middy/core'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import httpMultipartBodyParser from '@middy/http-multipart-body-parser'
import doNotWaitForEmptyEventLoop from '@middy/do-not-wait-for-empty-event-loop'
import { Keypair } from 'stellar-sdk'

import { headers, parseError } from './js/utils'

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

// Should/could this be a collation endpoint which takes the turrets and forwards on the contract to the other turrets and sends back the responses in an array?

const originalHandler = async (event) => {
  try {
    const contract = await s3.headObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
    }).promise()
    .then(({Metadata: {contract}}) => contract)

    const keypair = Keypair.fromPublicKey(contract)

    if (!keypair.verify(Buffer.from(event.body.turrets, 'base64'), Buffer.from(event.body.signature, 'base64')))
      throw 'Invalid signature'

    await s3.deleteObjectTagging({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
    }).promise()

    const TagSet = map(
      Buffer.from(event.body.turrets, 'base64').toString('utf8').split(','),
      (turret, i) =>
    {
      return {
        Key: `Turret_${i}`,
        Value: Buffer.from(turret, 'utf8').toString('base64')
      }
    })

    await s3.putObjectTagging({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
      Tagging: { TagSet }
    }).promise()

    return {
      headers,
      statusCode: 200
    }
  }

  catch(err) {
    return parseError(err)
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
      fieldNameSize: 9,
      fieldSize: 1000,
      fields: 3,
      fileSize: 0,
      files: 0,
      parts: 3,
      headerPairs: 1
    }
  }
}))
.use({
  onError(handler, next) {
    handler.response = parseError(handler.error)
    next()
  }
})

export default handler