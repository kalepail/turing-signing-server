import { TransactionBuilder, Networks, Asset, BASE_FEE, Operation, Server } from 'stellar-sdk'

const contract = 'GDXSAZSRHXCHVFHRETQSB5W7FEBUN3QAEEMNGCNUQWKDCEZBGLRHOQUO'
// SATQWPXPT32UGFQUJDJ2KSVAVXEW5EHABONQRRX57K6NVFLC4DY7ZX7M
// c0e2486d83c45022a4053bcc21f2cf664522052bbd4f332450f62c7ada5e922f

const vault = 'GDBZX2QZ5MB4YO6J6OMMLRB52MIYRZFPWG4EINNDDLWLWUWQPZZ2ALZ4'
// SAX45625LCFGLCAXDQTVUJIGYMJ7YN3EC2HMD7JZCFVRWMEDGUS47YDX
const XLM = Asset.native()
const TYLERCOIN = new Asset('TYLERCOIN', contract)

// Signers
// GCD7ZF4LC6NNCD7WLEIGWJ25Z2FPFC5BV66INDRIN23XD6S7AU3MZGTN
// GA3LUSXJH54LVWJTBHNHKS4DEUUC4HFPS7FXAZDKZ2YI42IUGIC3IV4I
// GA6FLCY7RSJDBGYNDLBSPJRWSSVA3D5HUHUKBK4Y6VQW4IKTL7QT3XG7
// GCVXBTCZCZGAM65ILDL3EYMQ5GYBQTUEDR3GFHMGV6ZBM4FYCQCMTEFI
// GA5JPVFOCUTOEZQB6WBBNLCV5ARDGODYCXUR2FW6OZNR54RKJVERU2EM

// Ensure fees are acceptable (public contract could have raised them)
// Only catch errors which Stellar won't already catch
  // i.e. not_trusted, underfunded, etc.

// Fields
// W3sibmFtZSI6InRvIiwidHlwZSI6InN0cmluZyIsImRlc2NyaXB0aW9uIjoiV2hlcmUgc2hvdWxkIHdlIHNlbmQgVFlMRVJDT0lOIHRvPyIsInJ1bGUiOiJNdXN0IGJlIGEgdmFsaWQgU3RlbGxhciBhZGRyZXNzIn0seyJuYW1lIjoic291cmNlIiwidHlwZSI6InN0cmluZyIsImRlc2NyaXB0aW9uIjoiV2hhdCdzIHRoZSBzb3VyY2UgYWNjb3VudCBmb3IgdGhpcyB0cmFuc2FjdGlvbj8iLCJydWxlIjoiTXVzdCBiZSBhIHZhbGlkIFN0ZWxsYXIgYWRkcmVzcywgb2Z0ZW4gdGhlIHNhbWUgYXMgdGhlIGB0b2AgYWRkcmVzcyJ9LHsibmFtZSI6ImFtb3VudCIsInR5cGUiOiJzdHJpbmciLCJkZXNjcmlwdGlvbiI6IlRZTEVSQ09JTiBpcyBwdXJjaGFzZWQgMToxIGZvciBYTE0uIEhvdyBtdWNoIGRvIHlvdSB3YW50IHRvIHBheSAmIHJlY2VpdmU/IiwicnVsZSI6Ik11c3QgYmUgYSB2YWxpZCBudW1lcmljYWwgYW1vdW50IGFib3ZlIGFueSBUU1Mgc2lnbmluZyBmZWUgZm9yIHRoaXMgY29udHJhY3QifV0=

export default async ({request, signers}) => {
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

  for (const signer of signers) {
    transaction.addOperation(Operation.payment({
      destination: signer.turret,
      asset: XLM,
      amount: signer.fee,
      source: contract
    }))
  }

  return transaction.build().toXDR()
}