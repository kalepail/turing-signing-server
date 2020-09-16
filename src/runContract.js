import Promise from 'bluebird'
import { Keypair, Networks, Transaction, Asset, Server } from 'stellar-sdk'
import axios from 'axios'
import { uniq, get, find, chain } from 'lodash'
import moment from 'moment'
import crypto from 'crypto'
import BigNumber from 'bignumber.js'

import lambda from './js/lambda'
import {
  tssRoute,
  parseError,
  createJsonResponse
} from './js/utils'
import Pool from './js/pg'

// TODO
// Pools should be released even if there are errors, maybe in the finally block?

// DONE
// Check for fees before signing xdr

const horizon = process.env.STELLAR_NETWORK === 'PUBLIC' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
const server = new Server(horizon)

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    await lambda.invoke({ // Call after the s3 lookup to ensure we've actually got a contract to work with
      FunctionName: `${process.env.SERVICE_NAME}-dev-checkContractPrivate`,
      InvocationType: 'Event',
      LogType: 'None',
      Payload: JSON.stringify({
        hash: event.pathParameters.hash
      })
    }).promise()

    // Transactions signed but not submitted
      // Can just keep spamming the same transaction
    // Limits should be set per txn and per contract

    // Unsubmitted contract limits
    // Same txn output limits

    // Dupe is pretty easy to bypass just by sending a different request, amount, to, source, etc.
    // Not currently using sqs

    const pgClientSelect = await Pool.connect()

    const pendingTxnLength = await pgClientSelect.query(`
      SELECT cardinality(pendingtxns) FROM contracts
      WHERE contract = $1
    `, [event.pathParameters.hash]).then((data) => {
      const contractExists = data.rows[0]

      if (contractExists)
        return get(data, 'rows[0].cardinality')

      throw {
        status: 404,
        message: 'Contract not found'
      }
    }) // Include an extra catch statement in the first request to check for contract existence

    if (pendingTxnLength >= process.env.TURRET_PENDING_MAX) // Contract locked due to too many unsubmitted txns
      throw 'TURRET_PENDING_MAX'

    const signerSecret = await pgClientSelect.query(`
      SELECT signer FROM contracts
      WHERE contract = $1
    `,[event.pathParameters.hash]).then((data) => get(data, 'rows[0].signer'))

    const preHashTxn = `${moment().add(process.env.TURRET_PENDING_AGE, 'seconds').format('X')}:pre+${crypto.randomBytes(30).toString('hex')}`

    await pgClientSelect.query(`
      update contracts set
        pendingtxns = array_append(pendingtxns, '${preHashTxn}')
      where contract = '${event.pathParameters.hash}'
    `)

    await pgClientSelect.release()

    // Is including the turrets array as a param an attack vector? Could you pay yourself a fee?
      // Each turret will check to ensure they are paid requiring all turret fees to exist
      // Only attack I see is if there are extra turrets which are not valid signers for the contract

    // Only accept the forwarded body from the collation endpoint to avoid malicious turret fees

    // If a returned XDR has already been submitted throw an error, otherwise we open up a looping vulnerability

    // TODO: Add an alternative validation method similar to the upload contract payment requirement

    const contractBody = {
      request: JSON.parse(event.body),
      signers: []
    }

    if (event.headers['X-Payment']) {
      const transaction = new Transaction(event.headers['X-Payment'], Networks[process.env.STELLAR_NETWORK])
      const hash = transaction.hash().toString('hex')

      if (!find(transaction._operations, {
        type: 'payment',
        destination: process.env.TURRET_ADDRESS,
        amount: new BigNumber(process.env.TURRET_RUN_FEE).toFixed(7),
        asset: Asset.native()
      })) throw 'Missing or invalid fee payment'

      await server
      .transactions()
      .transaction(hash)
      .call()
      .catch((err) => {
        if (
          err.response
          && err.response.status === 404
        ) return

        else if (err.response)
          throw err

        throw 'Transaction has already been submitted'
      })

      await server.submitTransaction(transaction)
    }

    else if (event.headers['X-Turrets']) {
      contractBody.signers = await Promise.map(uniq([
        process.env.TURRET_ADDRESS,
        ...event.headers['X-Turrets'].split(',')
      ]),
        async (turret) => server
        .loadAccount(turret)
        .then((account) => axios
          .get(`${tssRoute(account)}/contract/${event.pathParameters.hash}`)
          .then(async ({data}) => data)
          .catch(() => null)
        )
      ).then((signers) => chain(signers)
        .compact()
        .orderBy(['turret', 'signer', 'fee'], 'desc')
        .value()
      )
    }

    else throw 'Cannot run without either an X-Turrets or X-Payment header'

    const xdr = await lambda.invoke({
      FunctionName: `${process.env.SERVICE_NAME}-dev-runContractPrivate`,
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Payload: JSON.stringify({
        hash: event.pathParameters.hash,
        body: contractBody
      })
    }).promise()
    .then(({Payload}) => {
      const payload = JSON.parse(Payload)

      if (payload.isError)
        throw {message: payload.message}

      return payload.message
    })

    const transaction = new Transaction(xdr, Networks[process.env.STELLAR_NETWORK])

    if (
      !event.headers['X-Payment']
      && event.headers['X-Turrets']
    ) {
      const hash = transaction.hash().toString('hex')

      if (!find(transaction._operations, {
        type: 'payment',
        destination: process.env.TURRET_ADDRESS,
        amount: new BigNumber(process.env.TURRET_RUN_FEE).toFixed(7),
        asset: Asset.native()
      })) throw 'Missing or invalid fee payment'

      await server
      .transactions()
      .transaction(hash)
      .call()
      .catch((err) => {
        if (
          err.response
          && err.response.status === 404
        ) return

        else if (err.response)
          throw err

        throw 'Transaction has already been submitted'
      })
    }

    const pgClientUpdate = await Pool.connect()

    await pgClientUpdate.query(`
      update contracts set
        pendingtxns = array_append(pendingtxns, '${moment().add(process.env.TURRET_PENDING_AGE, 'seconds').format('X')}:${transaction.hash().toString('hex')}')
      where contract = '${event.pathParameters.hash}'
    `)

    await pgClientUpdate.query(`
      update contracts
      set pendingtxns = (
        select array_agg(elem)
          from contracts, unnest(pendingtxns) elem
        where contract = $1
        and elem <> all($2)
      )
      where contract = $1
    `,[event.pathParameters.hash, [preHashTxn]])

    await pgClientUpdate.release()

    const signerKeypair = Keypair.fromSecret(signerSecret)
    const signature = signerKeypair.sign(transaction.hash()).toString('base64')

    return createJsonResponse({
      xdr,
      signer: signerKeypair.publicKey(),
      signature
    })
  }

  catch(err) {
    return parseError(err)
  }
}