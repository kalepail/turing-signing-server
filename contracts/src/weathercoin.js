const { request } = require('https')

module.exports = (body) => new Promise((resolve, reject) => {
  try {
    body = JSON.stringify(body)

    const options = {
      hostname: 'tss-weathercoin-demo-l36f3pcbr8zm.runkit.sh',
      // hostname: 'runkit.io',
      port: 443,
      path: '/',
      // path: '/tyvdh/demo-tss-contract/1.0.1',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    }

    const req = request(options, (res) => {
      let data = ''

      if ( // Support for a single redirect to prove we're calling a version number not a branch for RunKit
        res.headers.location
        && (
          res.statusCode === 301
          || res.statusCode === 302
          || res.statusCode === 307
        )
      ) {
        const redirect = new URL(res.headers.location)

        options.hostname = redirect.hostname
        options.path = '/'

        const red = request(options, (res) => {
          let data = ''

          res.on('data', (chunk) => data += chunk)
          res.on('end', () => {
            if (res.statusCode >= 400)
              reject(data)

            resolve(data)
          })
        })

        red.on('error', (err) => reject(err))
        red.write(body)
        red.end()
      }

      else {
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => {
          if (res.statusCode >= 400)
            reject(data)

          resolve(data)
        })
      }
    })

    req.on('error', (err) => reject(err))
    req.write(body)
    req.end()
  } catch (err) {reject(err)}
})
.catch((err) => {throw err})