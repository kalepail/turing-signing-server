import { TransactionBuilder, Networks, Asset, BASE_FEE, Operation, Server } from 'stellar-sdk'
import axios from 'axios'

const contract = 'GD5LVARMWKWXPBNXO5IUQFULG7YVPBTOSBLMNX46BSESPX3QY5A5ISQ6'
// SAM7NTDRMNJE4Z4F7GYWBHE4PRSSRIPZMB24N4GTODAWJLSZD3CO2YWP
// d822b50f932a0b49fc77aff8e2af1a0aef3e53c12b66f11dcfb56e67f5f4a170

// GAAZFGLAN6RCPWQ25OKK5LJY6V43VZHHOZ3BBAGX7TS74YKRDIJ3YGQ7
// GCMB63BHGL2IPOEHMERCE4CLECE646FPU4BFDOOYMYUTFQI7UUAAHZLI
// GCYSILWU4XRXMJWU3MGZP5RWU3GEVQQX4IISOBQKE4SAFNOT4EMHUYIB
// GD6IWAIQRYTISPXAD54N4QJRNB6NOF6PHGJGVCBS37RTE4T5TT54KNZP
// GAWTT27664WGQETSYOV4KQUVYKH2HV5H6KKXIGLZAQOK42Z2Y5ZFJLP4

// Fields
// W3sibmFtZSI6InRvIiwidHlwZSI6InN0cmluZyIsImRlc2NyaXB0aW9uIjoiV2hlcmUgc2hvdWxkIHdlIHNlbmQgVFlMRVJDT0lOIHRvPyIsInJ1bGUiOiJNdXN0IGJlIGEgdmFsaWQgU3RlbGxhciBhZGRyZXNzIn0seyJuYW1lIjoic291cmNlIiwidHlwZSI6InN0cmluZyIsImRlc2NyaXB0aW9uIjoiV2hhdCdzIHRoZSBzb3VyY2UgYWNjb3VudCBmb3IgdGhpcyB0cmFuc2FjdGlvbj8iLCJydWxlIjoiTXVzdCBiZSBhIHZhbGlkIFN0ZWxsYXIgYWRkcmVzcywgb2Z0ZW4gdGhlIHNhbWUgYXMgdGhlIGB0b2AgYWRkcmVzcyJ9XQ==

const XLM = Asset.native()
const RAINCOIN = new Asset('RAINCOIN', contract)
const SUNCOIN = new Asset('SUNCOIN', contract)

export default async ({request, turrets}) => {
  let asset

  await axios.get('https://api.darksky.net/forecast/dbc14b6d52ee4325b6c33ef4aac5ae34/35.707030,-83.950370', {
    params: {
      exclude: 'minutely,hourly,daily,alerts,flags'
    }
  })
  .then(({data: {currently}}) => {
    if (
      /rain/gi.test(currently.icon)
      || /rain/gi.test(currently.summary)
    ) asset = RAINCOIN

    else
      asset = SUNCOIN
  })

  const server = new Server('https://horizon-testnet.stellar.org')

  const transaction = await server
  .loadAccount(request.source)
  .then((account) => {
    return new TransactionBuilder(
      account,
      {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET
      }
    )
    .addOperation(Operation.changeTrust({
      asset
    }))
    .addOperation(Operation.payment({
      destination: request.to,
      source: contract,
      amount: '1',
      asset,
    }))
    .setTimeout(0)
  })

  for (const turret of turrets) {
    transaction.addOperation(Operation.payment({
      destination: turret.vault,
      amount: turret.fee,
      asset: XLM,
    }))
  }

  return transaction.build().toXDR()
}

// test({request: {
//   to: 'GAWSNOA5AMEXLQ2SJM65RH25CEM7O7OV7ZYBSGSGNFUGBJBCGQRAAHOX'
// }, turrets: [{
//   "vault": "GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G",
//   "signer": "GBC7HRL3LGT3YOMO2ERLESQONZ4QXNDPEBXLJTVIWRJ7V6RNGYU6FUZN",
//   "fee": "0.5"
// },{
//   "vault": "GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G",
//   "signer": "GCZ7YWVVSO2MDK5EXDXQXEQTI5VP4J5OWWUCKQAVHN3Q3Y6YPPUH6WTY",
//   "fee": "0.5"
// }]})
// .then((data) => console.log(data))
// .catch((err) => console.error(err))