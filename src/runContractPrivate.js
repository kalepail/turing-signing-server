import requireFromString from 'require-from-string'
import AWS from 'aws-sdk'
import Promise from 'bluebird'

AWS.config.setPromisesDependency(Promise)

const s3 = new AWS.S3()

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const s3Contract = await s3.getObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.hash,
    }).promise()

    // const fs = require('fs')
    // const path = require('path')
    // const isDev = process.env.NODE_ENV === 'development'
    // const s3Contract = { Body: fs.readFileSync(path.resolve(`${isDev ? '' : 'src/'}contracts/dist/is-it-raining.js`))}

    return {
      isError: false,
      message: await requireFromString(s3Contract.Body.toString('utf8'))(event.body)
    }
  }

  catch(err) {
    const error =
    typeof err === 'string'
    ? err
    : err.response
      && err.response.data
    ? err.response.data
    : err.response
    ? err.response
    : err.message
    ? err.message
    : undefined

    return {
      isError: true,
      message: error
    }
  }
}