import { TransactionBuilder, Networks, Asset, BASE_FEE, Operation, Server } from 'stellar-sdk'

const contract = 'GCNANNNLGDICM5NJOT7QD7MLW34M4WLJPTNOAXWEAR4CE4LO23FZ5WDR'
// 5e14318ef516fa1b7aa517008f01e160035dde100fac999d3d18d00df43bb3ce

const vault = 'GBHKNCNOMBHHLHBLUTGUSKJPTHDQGJQLAICXFE4SMFAKOO5WO54BJJOR'
const XLM = Asset.native()
const TYLERCOIN = new Asset('TYLERCOIN', contract)

// Ensure fees are acceptable (public contract could have raised them)
// Only catch errors which Stellar won't already catch
  // i.e. not_trusted, underfunded, etc.

// Fields
// W3sibmFtZSI6InRvIiwidHlwZSI6InN0cmluZyIsImRlc2NyaXB0aW9uIjoiV2hlcmUgc2hvdWxkIHdlIHNlbmQgVFlMRVJDT0lOIHRvPyIsInJ1bGUiOiJNdXN0IGJlIGEgdmFsaWQgU3RlbGxhciBhZGRyZXNzIn0seyJuYW1lIjoic291cmNlIiwidHlwZSI6InN0cmluZyIsImRlc2NyaXB0aW9uIjoiV2hhdCdzIHRoZSBzb3VyY2UgYWNjb3VudCBmb3IgdGhpcyB0cmFuc2FjdGlvbj8iLCJydWxlIjoiTXVzdCBiZSBhIHZhbGlkIFN0ZWxsYXIgYWRkcmVzcywgb2Z0ZW4gdGhlIHNhbWUgYXMgdGhlIGB0b2AgYWRkcmVzcyJ9LHsibmFtZSI6ImFtb3VudCIsInR5cGUiOiJzdHJpbmciLCJkZXNjcmlwdGlvbiI6IlRZTEVSQ09JTiBpcyBwdXJjaGFzZWQgMToxIGZvciBYTE0uIEhvdyBtdWNoIGRvIHlvdSB3YW50IHRvIHBheSAmIHJlY2VpdmU/IiwicnVsZSI6Ik11c3QgYmUgYSB2YWxpZCBudW1lcmljYWwgYW1vdW50IGFib3ZlIGFueSBUU1Mgc2lnbmluZyBmZWUgZm9yIHRoaXMgY29udHJhY3QifV0=

export default async ({request, turrets}) => {
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
    .addOperation(Operation.payment({
      destination: vault,
      asset: XLM,
      amount: request.amount
    }))
    .addOperation(Operation.changeTrust({
      asset: TYLERCOIN
    }))
    .addOperation(Operation.payment({
      destination: request.to,
      asset: TYLERCOIN,
      amount: request.amount,
      source: contract
    }))
    .setTimeout(0)
  })

  for (const turret of turrets) {
    transaction.addOperation(Operation.payment({
      destination: turret.vault,
      asset: XLM,
      amount: turret.fee,
      source: contract
    }))
  }

  return transaction.build().toXDR()
}