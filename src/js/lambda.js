import AWS from 'aws-sdk'

import { isDev } from './utils'

let options = {
  apiVersion: '2015-03-31',
  region: 'us-east-1',
  sslEnabled: true
}

if (isDev) options = {
  ...options,
  endpoint: `http://localhost:300${process.env.i}`
}

export default new AWS.Lambda(options)