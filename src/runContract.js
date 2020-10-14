import {
  Keypair,
  Networks,
  Transaction,
  Server,
} from 'stellar-sdk'
import {
  get,
  find,
  map,
} from 'lodash'
import moment from 'moment'
import BigNumber from 'bignumber.js'
import { decode } from 'jsonwebtoken'
import { bearer } from '@borderless/parse-authorization'

import lambda from './js/lambda'
import {
  parseError,
  createJsonResponse
} from './js/utils'
import Pool from './js/pg'

// GLOBAL TODO: pg Pools should be released even if there are errors

const horizon = process.env.STELLAR_NETWORK === 'PUBLIC' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
const server = new Server(horizon)

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  let pgClient

  try {
    const AuthHeader = decode(bearer(event.headers['Authorization'] || event.headers['authorization']))

    if (!AuthHeader)
      throw 'Missing SEP-10 Authorization Bearer token'

    const { sub: feeChannel } = AuthHeader

    await server.loadAccount(feeChannel)
    .then(async ({signers, thresholds, balances}) => {
      const signer = find(signers, {key: process.env.TURRET_ADDRESS})
      const nativeBalance = find(balances, {asset_type: 'native'})

      if (
        !signer
        || signer.weight > thresholds.med_threshold
      ) throw `Invalid feeChannel`

      pgClient = await Pool.connect()

      const pendingList = await pgClient.query(`
        select pendingtxns
          from contracts
        WHERE contract = $1
      `,[event.pathParameters.hash]).then((data) => get(data, 'rows[0].pendingtxns'))

      const amounts = map(pendingList, (txn) => {
        const [,,
          amount
        ] = txn.split(':')

        return amount
      })

      const amount = BigNumber.sum(...amounts).toFixed(7)

      if (
        !new BigNumber(nativeBalance.balance)
        .minus(nativeBalance.buying_liabilities)
        .minus(nativeBalance.selling_liabilities)
        .minus(amount) // include a subtraction of any outstanding fees
        .gte(100) // TODO: this number should probably be a TSS variable. Minimum value allowed in a feeChannel account
      ) throw `Insufficient feeChannel balance`
    })

    // Ensure this runs and completes async in a non-blocking manner. Should probably be run in a cron job
    lambda.invokeAsync({
      FunctionName: `${process.env.SERVICE_NAME}-dev-checkContractPrivate`,
      InvokeArgs: JSON.stringify({
        hash: event.pathParameters.hash
      })
    }).send()

    const prepayKey = `${moment.utc().add(1, 'minute').format('X')}:${feeChannel}:0.0005` // TODO: The amount here should be dynamic in some way

    await pgClient.query(`
      update contracts set
        pendingtxns = array_append(pendingtxns, '${prepayKey}')
      where contract = '${event.pathParameters.hash}'
    `)

    const xdr = await lambda.invoke({
      FunctionName: `${process.env.SERVICE_NAME}-dev-runContractPrivate`,
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Payload: JSON.stringify({
        hash: event.pathParameters.hash,
        body: JSON.parse(event.body)
      })
    }).promise()
    .then(({Payload}) => {
      const payload = JSON.parse(Payload)

      if (payload.isError)
        throw payload.message

      return payload.message
    })

    const transaction = new Transaction(xdr, Networks[process.env.STELLAR_NETWORK])

    const signerSecret = await pgClient.query(`
      SELECT signer FROM contracts
      WHERE contract = $1
    `,[event.pathParameters.hash]).then((data) => get(data, 'rows[0].signer'))

    const signerKeypair = Keypair.fromSecret(signerSecret)
    const signature = signerKeypair.sign(transaction.hash()).toString('base64')

    await pgClient.release()

    return createJsonResponse({
      xdr,
      signer: signerKeypair.publicKey(),
      signature
    })
  }

  catch(err) {
    if (pgClient)
      await pgClient.release()

    return parseError(err)
  }
}