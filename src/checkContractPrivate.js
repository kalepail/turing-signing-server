import { Server, TransactionBuilder, BASE_FEE, Networks, Asset, Keypair, Operation } from 'stellar-sdk'
import { get, chain, each, groupBy, map } from 'lodash'
import moment from 'moment'
import BigNumber from 'bignumber.js'

import Pool from './js/pg'

// TODO
// We should only run horizon checks occasionally and not as a response to a contract call
  // Gotta watch for horizon rate limits, this should probably be throttled to 1 request per second
  // Not really a huge deal to hit rate limits as it will just look again the next time it runs

const horizon = process.env.STELLAR_NETWORK === 'PUBLIC' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
const server = new Server(horizon)

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const pgClient = await Pool.connect()

    const pendingList = await pgClient.query(`
      select pendingtxns
        from contracts
      WHERE contract = $1
    `,[event.hash]).then((data) => get(data, 'rows[0].pendingtxns'))

    const payList = chain(pendingList)
    .filter((txn) => {
      const [time] = txn.split(':')

      if (moment.utc(parseInt(time), 'X').isBefore())
        return txn
    })
    .take(100)
    .value()

    if (payList.length) {
      console.log(`Flush ${payList.length} txns`)

      const turretKeypair = Keypair.fromSecret(process.env.TURRET_SEK)

      await server.loadAccount(turretKeypair.publicKey())
      .then((account) => {
        let transaction = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: Networks.TESTNET
        }).setTimeout(0)

        const payListGrouped = groupBy(payList, (txn) => {
          const [,
            source,
          ] = txn.split(':')

          return source
        })

        each(payListGrouped, (payListSource, source) => {
          const amounts = map(payListSource, (txn) => {
            const [,,
              amount
            ] = txn.split(':')

            return amount
          })

          const amount = BigNumber.sum(...amounts).toFixed(7)

          transaction.addOperation(Operation.payment({
            asset: Asset.native(),
            amount,
            destination: account.id,
            source,
          }))
        })

        transaction = transaction.build()
        transaction.sign(turretKeypair)

        return server.submitTransaction(transaction)
      })

      await pgClient.query(`
        update contracts
        set pendingtxns = (
          select array_agg(elem)
            from contracts, unnest(pendingtxns) elem
          where contract = $1
          and elem <> all($2)
        )
        where contract = $1
      `,[event.hash, payList])

      console.log(`Flushed`)
    }

    await pgClient.release()

    return {
      isError: false,
      message: 'OK'
    }
  }

  catch(err) {
    err = typeof err === 'string' ? JSON.parse(err) : err

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

    console.error(err)

    return {
      isError: true,
      message: error
    }
  }
}