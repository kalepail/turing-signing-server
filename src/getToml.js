import { readFileSync } from 'fs'

import { createXdrResponse, parseError } from './js/utils'

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const tomlBuffer = readFileSync('./stellar.toml')
    const tomlString = tomlBuffer.toString()

    return createXdrResponse(tomlString)
  } catch (err) {
    return parseError(err)
  }
}