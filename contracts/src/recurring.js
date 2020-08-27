import { Networks, Asset, BASE_FEE, Operation, TransactionBuilder, Server } from 'stellar-sdk'
import moment from 'moment'

// Contract
const contractAddr = 'GCB3F2XO3NOHAMOUC2HGRQ4Y2X636UT5EWDP2FNVT7L25W6UT2I4HKKJ'
// SBF5RII2GAV2VW3ALRRFF7SAAB3G5WNQKBLQ2DJJIWSZOA7X4FFOSNH7
// 4fa24235c95908de7eb5f8ab7251dd38ed73393df9c6af838c9497873be57728

// User
// GDNZSICXPBLIHQFNHKYA7X7ULFCOO7XVWYGUFWNYBKOPPJDU3BABGCKQ
// SAUJUEXSFJKJJIB47F5S6JBAUCRIW7M4555UBOUJYH5LUYQGUWBYV6ZR

// Signers
// GDW4YTG7DSLOPYLW7GU4ODE4B2DYPVBNQBAXFKRWXQ5MXLCWDNWCJAHO
// GCHDBB4RMDTN3I7GZ5WMXRWPGTM7IWKERYH45URA24R37JOAF6L4JIJ5

// Fields
// W3sibmFtZSI6InNvdXJjZSIsInR5cGUiOiJzdHJpbmciLCJkZXNjcmlwdGlvbiI6IlN0ZWxsYXIgYWNjb3VudCB3ZSdyZSBwdWxsaW5nIGEgcmVjdXJyaW5nIHBheW1lbnQgZnJvbSIsInJ1bGUiOiJNdXN0IGJlIGEgdmFsaWQgU3RlbGxhciBhZGRyZXNzIn1d

const server = new Server('https://horizon-testnet.stellar.org')
const XLM = Asset.native()

async function contract({request, signers}) {
  try {
    const transaction = await server
    .loadAccount(request.source)
    .then((account) => {
      const now = moment.utc().startOf('minute')
      const minTime = now.clone().startOf('month')
      const maxTime = minTime.clone().endOf('month')

      const lastRanRaw = account.data_attr[`tss.${contractAddr}.ran`]

      if (lastRanRaw) {
        const lastRanParsed = Buffer.from(lastRanRaw, 'base64').toString('utf8')
        const lastRanDate = moment.utc(lastRanParsed, 'X')

        if (lastRanDate.startOf('month').isSame(minTime, 'month'))
          throw `It hasn't been a month since the last run`
      }

      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        timebounds: {
          minTime: minTime.unix(),
          maxTime: maxTime.unix()
        },
        networkPassphrase: Networks.TESTNET
      })
      .addOperation(Operation.payment({
        destination: contractAddr,
        asset: XLM,
        amount: '1000'
      }))
      .addOperation(Operation.manageData({
        name: `tss.${contractAddr}.ran`,
        value: now.unix().toString()
      }))

      for (const signer of signers) {
        transaction.addOperation(Operation.payment({
          destination: signer.turret,
          amount: signer.fee,
          asset: XLM
        }))
      }

      return transaction
    })

    return transaction.build().toXDR()
  }

  catch(err) {
    throw err
  }
}

export default contract

// contract({
//   request: {
//     source: 'GC6DLX5I5UB6T7WABY7GGFLOH3H2JJTF7D4UZ2K6PMKAVX7AE4BE7PUJ'
//   },
//   signers: [{
//     turret: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
//     fee: '0.1'
//   },{
//     turret: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
//     fee: '0.1'
//   }]
// })
// .then((res) => console.log(res))
// .catch((err) => console.error(err))