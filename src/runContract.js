import {
  Keypair,
  Networks,
  Transaction,
  Server,
  Asset,
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
import { readFileSync } from 'fs'
import toml from 'toml'

import lambda from './js/lambda'
import {
  parseError,
  createJsonResponse
} from './js/utils'
import Pool from './js/pg'

// GLOBAL TODO: pg Pools should be released even if there are errors
// GLOBAL TODO: there are a few places where Network.TESTNET and testnet horizon is hardcoded

// Is there any issue with a user submitting the same signed transaction hash to multiple turrets?
  // I don't think so as the transaction hash isn't used to submit any payments but rather to permit the creation of a pooled transaction

const horizon = process.env.STELLAR_NETWORK === 'PUBLIC' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
const server = new Server(horizon)

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  let pgClient

  try {
    // Sponsor Checks:
      // Account exists
      // Account has an acceptable balance
      // Account has added trusted Turret signers at acceptable weights
      // Account is in good historical standing
    const tomlBuffer = readFileSync('./stellar.toml')
    const tomlString = tomlBuffer.toString()
    const {TSS: {TURRETS: tomlTurrets}} = toml.parse(tomlString)

    // Fee Checks:
      // source for op and source for txn are the same
      // only two operations, one of type payment and one of type manageData
      // memo is hash for contract
      // fee is 0
      // sequence # is 0
      // timebounds min and max are 0
    let feeTxn = bearer(event.headers['Authorization'] || event.headers['authorization'])
        feeTxn = new Transaction(feeTxn, Networks[process.env.STELLAR_NETWORK])

    if(!(
      feeTxn.memo.value.toString('hex') === event.pathParameters.hash

      && parseInt(feeTxn.fee) === 0
      && parseInt(feeTxn.sequence) === 0
      && parseInt(feeTxn.timeBounds.minTime) === 0
      && parseInt(feeTxn.timeBounds.maxTime) === 0

      && feeTxn.operations.length === 2

      && feeTxn.operations[0].type === 'payment'
      && feeTxn.operations[0].destination === process.env.TURRET_ADDRESS
      && feeTxn.operations[0].asset.isNative()

      && feeTxn.operations[1].type === 'manageData'
      && feeTxn.operations[1].name === 'state'
      // TODO: hash of this txn shouldn't exist in the database already
    )) throw `Fee payment bearer token header is invalid`

    console.log(feeTxn.hash().toString('hex'))

    // const {
    //   sub: sponsorAccount,
    //   aud: contractHashes
    // } = JWT.decode(jwt)

    // Ensure contract hash has been signed on for use of this sponsor account
    // if (contractHashes.split(',').indexOf(event.pathParameters.hash) === -1)
    //   throw `contractHash not permitted for sponsorAccount`

    // const verifyKey = JWK.asKey({
    //   kty: 'OKP',
    //   crv: 'Ed25519',
    //   x: Keypair.fromPublicKey(sponsorAccount).rawPublicKey().toString('base64')
    // })

    // Verify jwt was signed for by the sponsor account
    // JWT.verify(jwt, verifyKey)

    // await server.loadAccount(sponsorAccount)
    // .then(async ({signers, thresholds, balances}) => {
    //   const signer = find(signers, {key: process.env.TURRET_ADDRESS})
    //   const nativeBalance = find(balances, {asset_type: 'native'})

    //   if (
    //     !signer
    //     || thresholds.med_threshold > signer.weight
    //   ) throw `Turret isn't a medium threshold signer for this Sponsor`

      pgClient = await Pool.connect()

    //   const pendingList = await pgClient.query(`
    //     select pendingtxns
    //       from contracts
    //     WHERE contract = $1
    //   `,[event.pathParameters.hash]).then((data) => get(data, 'rows[0].pendingtxns'))

    //   const amounts = map(pendingList, (txn) => {
    //     const [,,
    //       amount
    //     ] = txn.split(':')

    //     return amount
    //   })

    //   const amount = amounts.length ? BigNumber.sum(...amounts).toFixed(7) : 0

    //   if (
    //     !new BigNumber(nativeBalance.balance)
    //     .minus(nativeBalance.buying_liabilities)
    //     .minus(nativeBalance.selling_liabilities)
    //     .minus(amount) // include a subtraction of any outstanding fees
    //     .gte(100) // TODO: this number should probably be a Turret variable. Minimum value allowed in a sponsor account
    //   ) throw `Insufficient sponsorAccount balance`
    // })

    // TODO: !! Ensure only one of these is ever running at a time otherwise we'll get double fee spends
    // Ensure this runs and completes async in a non-blocking manner. Should probably be run in a cron job
    // lambda.invokeAsync({
    //   FunctionName: `${process.env.SERVICE_NAME}-dev-checkContractPrivate`,
    //   InvokeArgs: JSON.stringify({
    //     hash: event.pathParameters.hash
    //   })
    // }).send()

    // const prepayKey = `${moment.utc().add(1, 'minute').format('X')}:${sponsorAccount}:0.0005` // TODO: The amount here should be dynamic in some way

    // await pgClient.query(`
    //   update contracts set
    //     pendingtxns = array_append(pendingtxns, '${prepayKey}')
    //   where contract = '${event.pathParameters.hash}'
    // `)

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