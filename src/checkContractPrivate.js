import { Server } from 'stellar-sdk'
import Promise from 'bluebird'
import { uniqBy, get, chain, compact } from 'lodash'
import moment from 'moment'

import Pool from './js/pg'

// If a txn has been submitted to the network remove it from the pendingtxns array
  // Since this will include looping over a rate limited horizon endpoint we should only run this occasionally and not as a response to a contract call

const horizon = process.env.STELLAR_NETWORK === 'TESTNET' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'
const server = new Server(horizon)

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const pgClient = await Pool.connect()

    const contractPendingTxns = await pgClient.query(`
      select pendingtxns
        from contracts
      WHERE contract = '${event.hash}'
    `).then((data) => get(data, 'rows[0].pendingtxns'))

    const uniqTxns = uniqBy(contractPendingTxns, (txn) => {
      const [time, hash] = txn.split(':')
      return hash
    })

    const liveTxns = await new Promise.map(uniqTxns, (txn) => { // Gotta watch for rate limits, this should probably be throttled to 1 request per second
      const [time, hash] = txn.split(':')

      return server
      .transactions()
      .transaction(hash)
      .call()
      .then(() => hash)
      .catch(() => null)
    }, {concurrency: 1})
    .then((data) => compact(data))
    .then((liveTxns) => chain(contractPendingTxns)
      .map((txn) => {
        const [time, hash] = txn.split(':')
        return liveTxns.indexOf(hash) > -1 ? txn : null
      })
      .compact()
      .value()
    )

    const expiredTxns = chain(contractPendingTxns)
    .map((txn) => {
      const [time, hash] = txn.split(':')

      if (moment(parseInt(time, 10), 'X').isBefore())
        return txn
    })
    .compact()
    .value()

    const flushList = Object.assign([], liveTxns, expiredTxns)

    if (flushList.length) {
      console.log(`Flush ${flushList.length} txns`)

      await pgClient.query(`
        update contracts set
          pendingtxns = (
            select array_agg(elem)
              from contracts, unnest(pendingtxns) elem
            where elem <> all(array['${flushList.join('\',\'')}'])
          )
        WHERE contract = '${event.hash}'
      `)
    }

    await pgClient.release()

    return {
      isError: false,
      message: 'OK'
    }
  }

  catch(err) {
    console.error(err)

    return {
      isError: true,
      message: err.message
    }
  }
}

// Immediately flush if a txn exists on the blockchain (incurs the cost of looking that data up)
// Dedupe if it's been 10 minutes since last dedupe
// Flush unique if it's been 1 hour since last unique flush (may flush very recent submissions)