import { Server } from 'stellar-sdk'
import Promise from 'bluebird'
import { uniqBy, get, chain, compact } from 'lodash'
import moment from 'moment'

import Pool from './js/pg'

// TODO
// We should only run horizon checks occasionally and not as a response to a contract call
  // Gotta watch for horizon rate limits, this should probably be throttled to 1 request per second
  // Not really a huge deal to hit rate limits as it will just look again the next time it runs

// DONE
// Immediately flush if a txn exists on the blockchain (incurs the cost of looking that data up)

const horizon = process.env.STELLAR_NETWORK === 'PUBLIC' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
const server = new Server(horizon)

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const pgClient = await Pool.connect()

    const contractPendingTxns = await pgClient.query(`
      select pendingtxns
        from contracts
      WHERE contract = $1
    `,[event.hash]).then((data) => get(data, 'rows[0].pendingtxns'))

    const uniqTxns = uniqBy(contractPendingTxns, (txn) => {
      const [time, hash] = txn.split(':')
      return hash
    })

    const liveTxns = await new Promise.map(uniqTxns, (txn) => {
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
        update contracts
        set pendingtxns = (
          select array_agg(elem)
            from contracts, unnest(pendingtxns) elem
          where contract = $1
          and elem <> all($2)
        )
        where contract = $1
      `,[event.hash, flushList])
    }

    await pgClient.release()

    return {
      isError: false,
      message: 'OK'
    }
  }

  catch(err) {
    console.error(err)

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