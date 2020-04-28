import 'regenerator-runtime/runtime.js'

import { TransactionBuilder, Networks, Asset, Server, BASE_FEE, Operation } from 'stellar-sdk'

const horizon = 'https://horizon-testnet.stellar.org'
const server = new Server(horizon)
const contract = 'GCNANNNLGDICM5NJOT7QD7MLW34M4WLJPTNOAXWEAR4CE4LO23FZ5WDR'
const vault = 'GBHKNCNOMBHHLHBLUTGUSKJPTHDQGJQLAICXFE4SMFAKOO5WO54BJJOR'
const XLM = Asset.native()
const TYLERCOIN = new Asset('TYLERCOIN', contract)

// 'https://aefrqlrkb3.execute-api.us-east-1.amazonaws.com/dev,https://ajhwq8wzwa.execute-api.us-east-1.amazonaws.com/dev,https://a9rw0d7djl.execute-api.us-east-1.amazonaws.com/dev,https://qt8bahr41a.execute-api.us-east-1.amazonaws.com/dev,https://tx4qxpecmi.execute-api.us-east-1.amazonaws.com/dev'

// Ensure fees are acceptable (public contract could have raised them)

export default async ({request, turrets}) => {
  try {
    const transaction = await server
    .loadAccount(request.source)
    .then((account) =>
      new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET
      })
      .addOperation(Operation.payment({
        destination: vault,
        asset: XLM,
        amount: request.amount
      }))
      .addOperation(Operation.payment({
        destination: request.to,
        asset: TYLERCOIN,
        amount: request.amount,
        source: contract
      }))
      .setTimeout(0)
    )

    for (const turret of turrets) {
      transaction.addOperation(Operation.payment({
        destination: turret.vault,
        asset: XLM,
        amount: turret.fee,
        source: contract
      }))
    }

    return transaction.build().toXDR()
  }

  catch(err) {
    throw err
  }

  // const signerKeypair = Keypair.fromSecret(SIGNER)
  // const vaultKeypair = Keypair.fromSecret(VAULT)

  // const transaction = new Transaction(request, Networks.TESTNET)
  // const schema = await inspectTransactionSigners(transaction, { horizon })

  // const xlmIn = transaction.operations[0]
  // const coinOut = transaction.operations[1]

  // // only catch errors which Stellar won't already catch
  //   // i.e. not_trusted, underfunded, etc.

  // // console.log(
  // //   transaction.operations
  // // )

  // console.log(
  //   schema.getAllPotentialSigners().indexOf(signerKeypair.publicKey()) !== -1
  //   , transaction.operations.length === 2
  //   , xlmIn.type === 'payment'
  //   , coinOut.type === 'payment'
  //   , xlmIn.amount === coinOut.amount
  //   , xlmIn.asset.isNative()
  //   , coinOut.asset.equals(TYLERCOIN)
  //   , xlmIn.destination === coinOut.asset.getIssuer()
  //   , coinOut.source === coinOut.asset.getIssuer()
  //   , transaction.source === coinOut.destination
  //   , Utils.verifyTxSignedBy(transaction, transaction.source)
  // )

  // if (
  //   // Should be signable by service
  //   schema.getAllPotentialSigners().indexOf(signerKeypair.publicKey()) !== -1

  //   // Only two operations
  //   && transaction.operations.length === 2

  //   // Two payment types
  //   && xlmIn.type === 'payment'
  //   && coinOut.type === 'payment'

  //   // Amounts are equal
  //   && xlmIn.amount === coinOut.amount

  //   // Asset XLM for asset TYLERCOIN
  //   && xlmIn.asset.isNative()
  //   && coinOut.asset.equals(TYLERCOIN)

  //   // Destination for XLM payment is issuer of TYLERCOIN
  //   && xlmIn.destination === coinOut.asset.getIssuer()

  //   // Issuer of TYLERCOIN is also sender of TYLERCOIN
  //   && coinOut.source === coinOut.asset.getIssuer()

  //   // Txn source is XLM payment source
  //   && transaction.source === coinOut.destination

  //   // Has signature for XLM payment source?
  //   && Utils.verifyTxSignedBy(transaction, transaction.source)
  // ) {
  //   const preFee = await server
  //   .loadAccount(vaultKeypair.publicKey())
  //   .then(({balances}) => new BigNumber(get(find(balances, {asset_type: 'native'}), 'balance')))

  //   const feeTxn = new Transaction(fee, Networks.TESTNET)
  //         feeTxn.sign(vaultKeypair)

  //   await server.submitTransaction(feeTxn)

  //   const postFee = await server
  //   .loadAccount(vaultKeypair.publicKey())
  //   .then(({balances}) => new BigNumber(get(find(balances, {asset_type: 'native'}), 'balance')))

  //   if (
  //     postFee
  //     .minus(preFee)
  //     .times(10000000)
  //     .lt(FEE)
  //   ) throw 'Insufficent fee'

  //   const signature = signerKeypair.sign(transaction.hash())

  //   return signature.toString('base64')
  // }

  // else
  //   throw 'Transaction rejected'
}