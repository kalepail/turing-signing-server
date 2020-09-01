import { Networks, Asset, BASE_FEE, Operation, TransactionBuilder, Server } from 'stellar-sdk'
import moment from 'moment'

// Contract
const contractAddr = 'GCB3F2XO3NOHAMOUC2HGRQ4Y2X636UT5EWDP2FNVT7L25W6UT2I4HKKJ'
// SBF5RII2GAV2VW3ALRRFF7SAAB3G5WNQKBLQ2DJJIWSZOA7X4FFOSNH7
// fe5c7fb0eebcaf18eaff9285a81d6e018401f03fd2cc24c920fef16dee921567

// User
// GAYIXPKGBNX72DOHXLC4IEN2RW4JC34KVVKJ3KB265PGUI47UXDDAUXW
// SA5DJ4O725QS7FTXC4LWG5OAT2YXLPWG4BVWMRL6KS7777UHQFQLHGKD

// Signers
// GAQMMV7AS6L7FQDBFPQU6PEDEISGRFZXTWERTH3BNN4IQTRWTOH4BYHZ
// GADSLTPT5LQYFHDGH5BL3D6ELV3MWRO2TJ36CV34CV4SMYPLZUN4ULLD

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