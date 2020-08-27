import { Transaction, Networks, Asset, BASE_FEE, Operation } from 'stellar-sdk'
import BigNumber from 'bignumber.js'

// Contract
// 45ba2508867c0b483a9c6b69c8078770e8320ab5232a5387f38dc2811755e93b

// Signers
// GANZKLEAC35NI4C5VQSQIUNITHFAOTVQZWIEJRS2EQBHRBMHNP66OQR4
// GCIFRINKY2PXE22526XQ6HKNMZD4NDTBO6MQEGL7NQ7RKJPSEOBR5FFX
// GCS5OSF7RJRDPYKSTQZPFRLD5WJN6ZHANSSCPQNLRQ4NULQO2BMZMH7B
// GBQ4FNTGKEJMCS4HOIWOFUZYBX5OV5EWEPY4J4LGSQMK3SRNPXMOGDYX
// GCVJXKA3WVGA4NQI3UVUQOGIXQN3LHZGANWEEFLUIWUHPKLIJFGEMYVE

// User
// GAVDUDMKRMGDF57IXX745EWKM4UPC3X7LGO6C5NKT4CDQW7MT7L6UXNR
// SCNZP6Z44PMA65VGX7WFO43F6ZIU7HFMG5RF5VPZTQQXJIGMGD55EWPE

// Turrets
// aHR0cHM6Ly90dXJpbmctc2lnbmluZy1zZXJ2ZXItMC5zdGVsbGFyLmJ1enosaHR0cHM6Ly90dXJpbmctc2lnbmluZy1zZXJ2ZXItMS5zdGVsbGFyLmJ1eno=

// Fields
// W3sibmFtZSI6InhkciIsInR5cGUiOiJzdHJpbmciLCJkZXNjcmlwdGlvbiI6IlRyYW5zYWN0aW9uIGVudmVsb3BlIHlvdSdyZSBsb29raW5nIHRvIGdldCBzaWduZWQiLCJydWxlIjoiTXVzdCBiZSBhIHZhbGlkIFN0ZWxsYXIgWERSIHN0cmluZyJ9XQ==

const XLM = Asset.native()

async function contract ({request, turrets}) {
  try {
    const transaction = new Transaction(request.xdr, Networks.TESTNET)
    const op = transaction.operations[0]
    const amount = new BigNumber(op.amount)

    if (
      transaction.operations.length > 1
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
//   xdr: 'AAAAAMSS/PC7r1z0EXgvp+Y9zfZvYPUEFmUj9MufTe0a1qJZAAAAZAACNk4AAAADAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAP5rMYsK+vSYqJzX+deNs42HunlbA9g1BAc90+YUmBDLAAAAAAAAAAA7msoAAAAAAAAAAAA='
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