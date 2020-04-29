import requireFromString from 'require-from-string'

export default async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    return {
      isError: false,
      message: await requireFromString(event.script)(event.body)
    }
  }

  catch(err) {
    return {
      isError: true,
      message: err.message
    }
  }

  // requireFromString(script)(body)
  // .then((data) => callback(null, data))
  // .catch((err) => {
  //   console.error('butts')
  //   callback(err)
  //   throw err
  // })
}

// Don't seem able to throw and error which shows up in the lambda catch promise block