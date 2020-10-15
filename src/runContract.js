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
import { bearer } from '@borderless/parse-authorization'
import { JWK, JWT } from 'jose'

import lambda from './js/lambda'
import {
  parseError,
  createJsonResponse
} from './js/utils'
import Pool from './js/pg'

// GLOBAL TODO: pg Pools should be released even if there are errors
// GLOBAL TODO: there are a few places where Network.TESTNET and testnet horizon is hardcoded

const horizon = process.env.STELLAR_NETWORK === 'PUBLIC' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
const server = new Server(horizon)

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  let pgClient

  try {
    const jwt = bearer(event.headers['Authorization'] || event.headers['authorization'])
    const {
      sub: sponsorAccount,
      aud: contractHashes
    } = JWT.decode(jwt)

    // Ensure contract hash has been signed on for use of this sponsor account
    if (contractHashes.split(',').indexOf(event.pathParameters.hash) === -1)
      throw `contractHash not permitted for sponsorAccount`

    const verifyKey = JWK.asKey({
      kty: 'OKP',
      crv: 'Ed25519',
      x: Keypair.fromPublicKey(sponsorAccount).rawPublicKey().toString('base64')
    })

    // Verify jwt was signed for by the sponsor account
    JWT.verify(jwt, verifyKey)

    await server.loadAccount(sponsorAccount)
    .then(async ({signers, thresholds, balances}) => {
      const signer = find(signers, {key: process.env.TURRET_ADDRESS})
      const nativeBalance = find(balances, {asset_type: 'native'})

      if (
        !signer
        || signer.weight > thresholds.med_threshold
      ) throw `Turret isn't a medium threshold signer for this Sponsor`

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

      const amount = amounts.length ? BigNumber.sum(...amounts).toFixed(7) : 0

      if (
        !new BigNumber(nativeBalance.balance)
        .minus(nativeBalance.buying_liabilities)
        .minus(nativeBalance.selling_liabilities)
        .minus(amount) // include a subtraction of any outstanding fees
        .gte(100) // TODO: this number should probably be a Turret variable. Minimum value allowed in a sponsor account
      ) throw `Insufficient sponsorAccount balance`
    })

    // TODO: !! Ensure only one of these is ever running at a time otherwise we'll get double fee spends
    // Ensure this runs and completes async in a non-blocking manner. Should probably be run in a cron job
    lambda.invokeAsync({
      FunctionName: `${process.env.SERVICE_NAME}-dev-checkContractPrivate`,
      InvokeArgs: JSON.stringify({
        hash: event.pathParameters.hash
      })
    }).send()

    const prepayKey = `${moment.utc().add(1, 'minute').format('X')}:${sponsorAccount}:0.0005` // TODO: The amount here should be dynamic in some way

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