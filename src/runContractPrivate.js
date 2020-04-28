import requireFromString from 'require-from-string'

export default ({ script, body }, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false

  requireFromString(script)(body)
  .then((data) => callback(null, data))
  .catch((err) => callback(err))
}