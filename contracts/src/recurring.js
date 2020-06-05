import { Networks, Asset, BASE_FEE, Operation, TransactionBuilder, Server } from 'stellar-sdk'
import moment from 'moment'

// Contract
const contractAddr = 'GAGTH375JDCHRYF47BGKZWGGKPSHJKUE7DT4DAILZ4M4YTNWLPEQSRKR'
// SCUEBCV5L5SP2ZMVBY4OQVGRXHOTKLD5XTGK5PTJCNF3HWDBIN7NMSNU
// a937187c4294f405c6b1894589bd84fd706ac750146c7280ea49e9168f665719

// User
// GBYN57IZBBSAFK76AOTCOHGZDV664IXUI2XCOLDDNXBYMYIG7B3EPE6I
// SBP7VBKURSFASA6QGAZ6QK3V5K7TKQ5A2EAWGKWSMJ7RF6IMEFDH4MR5

// Signers
// GBLZ2YQHEEUCE7NZKQNUL3BNXOEAP3ADWLOVR2KHWGIWKRR3JJ3GA7AG
// GAKBUGN72F3I4P2VMBDZFNFUMNIRTYEHSKF7V34TFJCGOQ3OTLUAS7SB

// Fields
// W3sibmFtZSI6InNvdXJjZSIsInR5cGUiOiJzdHJpbmciLCJkZXNjcmlwdGlvbiI6IlN0ZWxsYXIgYWNjb3VudCB3ZSdyZSBwdWxsaW5nIGEgcmVjdXJyaW5nIHBheW1lbnQgZnJvbSIsInJ1bGUiOiJNdXN0IGJlIGEgdmFsaWQgU3RlbGxhciBhZGRyZXNzIn1d

const server = new Server('https://horizon-testnet.stellar.org')
const XLM = Asset.native()

async function contract({request, turrets}) {
  try {
    const transaction = await server
    .loadAccount(request.source)
    .then((account) => {
      const now = moment.utc()
      const minTime = now.clone().startOf('month')
      const maxTime = minTime.clone().add(7, 'days')

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

      for (const turret of turrets) {
        transaction.addOperation(Operation.payment({
          destination: turret.vault,
          amount: turret.fee,
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
//     source: 'GBYN57IZBBSAFK76AOTCOHGZDV664IXUI2XCOLDDNXBYMYIG7B3EPE6I'
//   },
//   turrets: [{
//     vault: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
//     fee: '0.1'
//   },{
//     vault: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
//     fee: '0.1'
//   }]
// })
// .then((res) => console.log(res))
// .catch((err) => console.error(err))