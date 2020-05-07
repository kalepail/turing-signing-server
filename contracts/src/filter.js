import { Transaction, Networks, Asset, BASE_FEE, Operation } from 'stellar-sdk'
import BigNumber from 'bignumber.js'

const contractAddress = 'GAVIZKH2TGVSDFOX6UAUX7OTJPGDTXPPDAW5ZEWMYBW7Q7DM34REMMNS'
// SAJ4UYLV6QA26H64JSH2UVRIKFGGJUFYEXVNJJX5ETUQ7VMG6ABDVEUP

// Signers
// GA2QCC6UTA4C24LBDFBFXNWM53XNVGILKKJDGVUIUQ2FLWHNVM5U3SUB
// GBZ7AWKPFHH5KVHE7J4CYKCJN7P42LFQIX7VQRBUP67O75VZ4NSBFMOL

const XLM = Asset.native()

async function contract ({request, turrets}) {
  try {
    const transaction = new Transaction(request.xdr, Networks.TESTNET)
    const op = transaction.operations[0]
    const amount = new BigNumber(op.amount)

    if (
      transaction.source !== contractAddress
      || transaction.operations.length > 1
      || op.type !== 'payment'
      || !op.asset.equals(XLM)
      || amount.gt(100)
    ) throw 'Request rejected'

    for (const turret of turrets) {
      const fee = new BigNumber(transaction._tx._attributes.fee)
      const op = Operation.payment({
        destination: turret.vault,
        amount: turret.fee,
        asset: XLM
      })

      transaction._tx._attributes.fee = fee.plus(BASE_FEE).toNumber()
      transaction._tx._attributes.operations.push(op)
    }

    return transaction.toXDR()
  }

  catch(err) {
    throw err
  }
}

export default contract

// contract({request: {
//   xdr: 'AAAAAKVc21B6yxVAhA1XjWoAKIOElwwJsmxN67WWhrrxlvLdAAAAZAAB99EAAAACAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAPyRkBLHhV04W6gaPOZ0soqoja+/ZBufjnkUdx3ws30/AAAAAAAAAAA7msoAAAAAAAAAAAA='
// }, turrets: [{
//   vault: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
//   signer: 'GBC7HRL3LGT3YOMO2ERLESQONZ4QXNDPEBXLJTVIWRJ7V6RNGYU6FUZN',
//   fee: '0.5'
// },{
//   vault: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
//   signer: 'GCZ7YWVVSO2MDK5EXDXQXEQTI5VP4J5OWWUCKQAVHN3Q3Y6YPPUH6WTY',
//   fee: '0.5'
// }]})
// .then((data) => console.log(data))
// .catch((err) => console.error(err))