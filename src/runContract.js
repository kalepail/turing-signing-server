import AWS from 'aws-sdk'
import Promise from 'bluebird'
import { Keypair, Networks, Transaction, Asset, Server } from 'stellar-sdk'
import axios from 'axios'
import { get, map, difference, find } from 'lodash'
import moment from 'moment'
import crypto from 'crypto'
import BigNumber from 'bignumber.js'

import lambda from './js/lambda'
import {
  isDev,
  headers,
  parseError
} from './js/utils'
import Pool from './js/pg'

// TODO
// Pools should be released even if there are errors, maybe in the finally block?

// DONE
// Check for fees before signing xdr

AWS.config.setPromisesDependency(Promise)

const horizon = process.env.STELLAR_NETWORK === 'TESTNET' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'
const server = new Server(horizon)
const s3 = new AWS.S3()

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const contractTurrets = isDev
    ? [
      'https://localhost:4000/dev',
      'https://localhost:4001/dev',
      'https://localhost:4002/dev',
      'https://localhost:4003/dev',
      'https://localhost:4004/dev',
    ]
    : await s3.getObjectTagging({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: event.pathParameters.hash,
    }).promise()
    .then(({TagSet}) => map(TagSet, (tag) => Buffer.from(tag.Value, 'base64').toString('utf8')))

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

    if (pendingTxnLength >= process.env.TURING_PENDING_MAX) // Contract locked due to too many unsubmitted txns
      throw 'TURING_PENDING_MAX'

    const signerSecret = await pgClientSelect.query(`
      SELECT signer FROM contracts
      WHERE contract = $1
    `,[event.pathParameters.hash]).then((data) => get(data, 'rows[0].signer'))

    const preHashTxn = `${moment().add(process.env.TURING_PENDING_AGE, 'seconds').format('X')}:pre+${crypto.randomBytes(30).toString('hex')}`

    await pgClientSelect.query(`
      update contracts set
        pendingtxns = array_append(pendingtxns, '${preHashTxn}')
      where contract = '${event.pathParameters.hash}'
    `)

    await pgClientSelect.release()

    // Is including the turrets array as a param an attack vector? Could you pay yourself a fee?
      // Each turing server will check to ensure they are paid requiring all turing fees to exist
      // Only attack I see is if there are extra turrets which are not valid signers for the contract

    // Only accept the forwarded body from the collation endpoint to avoid malicious turret fees

    // If a returned XDR has already been submitted throw an error, otherwise we open up a looping vulnerability

    const selectedTurrets = event.headers['X-Turrets'] ? JSON.parse(Buffer.from(event.headers['X-Turrets'], 'base64').toString()) : contractTurrets

    if (difference(selectedTurrets, contractTurrets).length) {
      if (isDev)
        console.error('selectedTurrets contains urls not present in contractTurrets')
      else
        throw 'selectedTurrets contains urls not present in contractTurrets'
    }

    const turretsContractData = await Promise.map(selectedTurrets, async (turret) =>
      axios.get(`${turret}/contract/${event.pathParameters.hash}`)
      .then(({data}) => data)
    )

    const xdr = await lambda.invoke({
      FunctionName: `${process.env.SERVICE_NAME}-dev-runContractPrivate`,
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Payload: JSON.stringify({
        hash: event.pathParameters.hash,
        body: {
          request: JSON.parse(event.body),
          turrets: turretsContractData
        }
      })
    }).promise()
    .then(({Payload}) => {
      const payload = JSON.parse(Payload)

      if (payload.isError)
        throw {message: payload.message}

      return payload.message
    })

    const transaction = new Transaction(xdr, Networks[process.env.STELLAR_NETWORK])
    const hash = transaction.hash().toString('hex')

    if (!find(transaction._operations, {
      type: 'payment',
      destination: process.env.TURING_VAULT_ADDRESS,
      amount: new BigNumber(process.env.TURING_RUN_FEE).toFixed(7),
      asset: Asset.native()
    })) throw 'Missing or invalid fee payment'

    await server
    .transactions()
    .transaction(hash)
    .call()
    .catch((err) => err)
    .then((err) => {
      if (
        err.response
        && err.response.status === 404
      ) return

      else if (err.response)
        throw err

      throw 'Transaction has already been submitted'
    })

    const pgClientUpdate = await Pool.connect()

    await pgClientUpdate.query(`
      update contracts set
        pendingtxns = array_append(pendingtxns, '${moment().add(process.env.TURING_PENDING_AGE, 'seconds').format('X')}:${transaction.hash().toString('hex')}')
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

    return {
      headers,
      statusCode: 200,
      body: JSON.stringify({
        xdr,
        signer: signerKeypair.publicKey(),
        signature
      })
    }
  }

  catch(err) {
    return parseError(err)
  }
}