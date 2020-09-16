// 8bd5e478c3ec474fb90babee8ae76e34888cddb6178801d8330d04541022e3df

// GAYKUOURMBWSYAZJP7HAHTLQ6SVBCD5GDHBVTQLAUQVE3KTNOSYT2VQ7

const { request } = require('https')

module.exports = (body) =>
new Promise((resolve, reject) => {
  try {
    body = JSON.stringify(body)

    const options = {
      hostname: 'demo-tss-contract-is1d4km73fep.runkit.sh',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    }

    const req = request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => data += chunk)
      res.on('end', () => resolve(data))
    })

    req.on('error', (err) => reject(err))
    req.write(body)
    req.end()
  } catch (err) {reject(err)}
})
.catch((err) => {throw err})