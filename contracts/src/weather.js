import { TransactionBuilder, Networks, Asset, BASE_FEE, Operation, Server } from 'stellar-sdk'
import axios from 'axios'

const contract = 'GAWPG5WMHAA75S7ALQMP4E4E7OI5AMHT6LX2ZEOIQD5RX6FGEEO3B46K'
// SBJURUWXYBSXIGU46H6CPINEJVBCPKYVP6GJB42L5ZL4QNWP4QQSLQTP
// 238dd24aa9a4c5dbe83ccd0fad506fc3846fe776e0c4c6e1e5bd9a361ad09b29

// GDLZEVCZOAHRSA7NXSLWWH2HUIKHOCQ2XHP7YQPH7HGQSLGASVG4WF3I
// GBACA4O5XPFOJUUBFF6G6D4TLA67XUND4FPSUG7I3VZB2WJJ4NRNJ4AV
// GAYV4RYQZTDWE6REZ2RVS74XR2WJ6OBD3XPS4HUYX344ZRPCSORNESWT
// GADGR2RQS6D6XJRZYYIXF2346VSAKVTTEJZZLX4ZPUJQVPUQKZER7CMO
// GBBRHGVC2I5EUF66CREKEIJGYQ5PZ6MUSG2JANPJH453UV2XNAXGFCPK

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