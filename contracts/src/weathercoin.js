import { TransactionBuilder, Networks, Asset, BASE_FEE, Operation, Server } from 'stellar-sdk'
import axios from 'axios'

const contract = 'GD5LVARMWKWXPBNXO5IUQFULG7YVPBTOSBLMNX46BSESPX3QY5A5ISQ6'
// SAM7NTDRMNJE4Z4F7GYWBHE4PRSSRIPZMB24N4GTODAWJLSZD3CO2YWP
// 2061ef545847a645c4317756060548a15aa75d9dc0b47952c35101fa7a1d2bcd

// Signers
// GDHLESGPKWABPQ6HICAT6QLAL5ODBDC3X7T354G5TTIJHNOOYRXTOO5T
// GACDFOSDH6OASXBFVTBJ5T6E6MRMALTGIS4CZRB6GTGPDBR6RSZE3R3O
// GBV4UM7WLCIKPLVCGGYIJ3OL4CZ4DWHTSJJ5EBYBRGSMY7FQMNX5VEZF
// GC37Y2ZH6DGJZPWJMYI7SZFUYKLRY3ALCDDHKMAPKV5EALTM7C4ML4VD
// GBURRMB65NWDV2HMBGCIC5TCKHOW6NQPV4GRJWY5RZPI2V7US6P3RFSY

// Fields
// W3sibmFtZSI6InRvIiwidHlwZSI6InN0cmluZyIsImRlc2NyaXB0aW9uIjoiV2hlcmUgc2hvdWxkIHdlIHNlbmQgVFlMRVJDT0lOIHRvPyIsInJ1bGUiOiJNdXN0IGJlIGEgdmFsaWQgU3RlbGxhciBhZGRyZXNzIn0seyJuYW1lIjoic291cmNlIiwidHlwZSI6InN0cmluZyIsImRlc2NyaXB0aW9uIjoiV2hhdCdzIHRoZSBzb3VyY2UgYWNjb3VudCBmb3IgdGhpcyB0cmFuc2FjdGlvbj8iLCJydWxlIjoiTXVzdCBiZSBhIHZhbGlkIFN0ZWxsYXIgYWRkcmVzcywgb2Z0ZW4gdGhlIHNhbWUgYXMgdGhlIGB0b2AgYWRkcmVzcyJ9XQ==

const XLM = Asset.native()
const RAINCOIN = new Asset('RAINCOIN', contract)
const SUNCOIN = new Asset('SUNCOIN', contract)

export default async ({request, signers}) => {
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

  for (const signer of signers) {
    transaction.addOperation(Operation.payment({
      destination: signer.turret,
      amount: signer.fee,
      asset: XLM,
    }))
  }

  return transaction.build().toXDR()
}

// test({request: {
//   to: 'GAWSNOA5AMEXLQ2SJM65RH25CEM7O7OV7ZYBSGSGNFUGBJBCGQRAAHOX'
// }, signers: [{
//   "turret": "GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G",
//   "fee": "0.5"
// },{
//   "turret": "GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G",
//   "fee": "0.5"
// }]})
// .then((data) => console.log(data))
// .catch((err) => console.error(err))