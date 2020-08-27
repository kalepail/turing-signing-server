import { Transaction, Networks, Asset, BASE_FEE, Operation } from 'stellar-sdk'
import BigNumber from 'bignumber.js'

// Contract
// 07a6c7169d052aa2baa7bd9bdf0567d8c7bba9a1865a28ef228d9d50b0c7533d

// Signers
// GDZT5OYC3CDNR5UUUE4UYOD77F4K36HTQJ7UOOM3TT4KSK7KJGSKMG35
// GDFFDGYFWBCJCE4FBLPRWC7FN3M2KLFAME5PZPR2RZHYXV6NBDJSM2J2
// GDB3MBIOMZELTCJS2SOOJUQ2SK2FGU7KIQV46PRDFHWYKL5FU26LZRWB
// GBLTRN6KYZLZ7TFCWWHY5OQWVQYYND72NIVQTUONFHRN45MYE7A2HEYA
// GC57UORYZRVQSMJE5BRFCJUHWYWKXLOXOY76GOCXCVAAYC2KFC5ZIBPP

// User
// GD6U5IYKGWDVXDDFQ4NM7QTLH2S35RILOZ6EEVG5IGLLDJJSKN3KYZO7
// SAUWQELGTL5BMAS3KEVSWYFXZB6QH4IHT4SNCMPXE35GFBKRWKYYDCPQ

// Fields
// W3sibmFtZSI6InhkciIsInR5cGUiOiJzdHJpbmciLCJkZXNjcmlwdGlvbiI6IlRyYW5zYWN0aW9uIGVudmVsb3BlIHlvdSdyZSBsb29raW5nIHRvIGdldCBzaWduZWQiLCJydWxlIjoiTXVzdCBiZSBhIHZhbGlkIFN0ZWxsYXIgWERSIHN0cmluZyJ9XQ==

const XLM = Asset.native()

async function contract ({request, signers}) {
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

    for (const signer of signers) {
      const fee = new BigNumber(transaction._tx._attributes.fee)
      const op = Operation.payment({
        destination: signer.turret,
        amount: signer.fee,
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
// }, signers: [{
//   turret: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
//   fee: '0.5'
// },{
//   turret: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
//   fee: '0.5'
// }]})
// .then((data) => console.log(data))
// .catch((err) => console.error(err))