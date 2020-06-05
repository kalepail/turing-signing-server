import { Networks, Asset, BASE_FEE, Operation, TransactionBuilder, Server } from 'stellar-sdk'
import moment from 'moment'

// Contract
const contractAddr = 'GAGTH375JDCHRYF47BGKZWGGKPSHJKUE7DT4DAILZ4M4YTNWLPEQSRKR'
// SCUEBCV5L5SP2ZMVBY4OQVGRXHOTKLD5XTGK5PTJCNF3HWDBIN7NMSNU
// 6c673e55c6ac6d8e9afb3df60a4ead3cf027b3dd8c1e8faeea6a53ff7f367b85

// User
// GBTPNBHRPAADMGUSAJGM72Y6V6STWD5DJTUBX6GKZF3PZWEFVO47BSNS
// SBXIIDTLXQZAMXPKYM7U6PMG6QQZMANEDGCWQI6DQRC4AOMY3Y7DRDIO

// Signers
// GDPQZ7SF25Y6UKIDT25QPQWFMDDLWS7KZJXENTAQMOYZME43BR3EQC3A
// GD4ODYG2QDDDL6SZUIHE6QVYA262WTDTM3ZPJJTHN443B4VCEWYXZNJD

// Fields
// W3sibmFtZSI6InNvdXJjZSIsInR5cGUiOiJzdHJpbmciLCJkZXNjcmlwdGlvbiI6IlN0ZWxsYXIgYWNjb3VudCB3ZSdyZSBwdWxsaW5nIGEgcmVjdXJyaW5nIHBheW1lbnQgZnJvbSIsInJ1bGUiOiJNdXN0IGJlIGEgdmFsaWQgU3RlbGxhciBhZGRyZXNzIn1d

const server = new Server('https://horizon-testnet.stellar.org')
const XLM = Asset.native()

async function contract({request, turrets}) {
  try {
    const transaction = await server
    .loadAccount(request.source)
    .then((account) => {
      const now = moment.utc().startOf('minute')
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

contract({
  request: {
    source: 'GC6DLX5I5UB6T7WABY7GGFLOH3H2JJTF7D4UZ2K6PMKAVX7AE4BE7PUJ'
  },
  turrets: [{
    vault: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
    fee: '0.1'
  },{
    vault: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
    fee: '0.1'
  }]
})
.then((res) => console.log(res))
.catch((err) => console.error(err))