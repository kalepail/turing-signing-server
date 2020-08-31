import { TransactionBuilder, Networks, Asset, BASE_FEE, Operation, Server } from 'stellar-sdk'
import { find, filter, map } from 'lodash'
import moment from 'moment'
import BigNumber from 'bignumber.js'
import seedrandom from 'seedrandom'

const contract = 'GCMII67Q32ZSIXM3FO5T6IEIWZ56IKTSV73YVYXFI3VCXRHNDRJ7DRMR'
// SDUE7BCFKNE4HRXXJCCWO7LFTCBKLMUNKI2UZHZX5BCR26LI2DTB6FSD
// c6b47b596a86164bbf0b5619272539d852815570e6154f45242bc41fd6386599

// GCVVCL5ILBEHL7GJLPA2NH3RHHBSO4WQPCH5ORK23W5RQSD57VDHKSII
// GAD5UDXCM43B2I3Y6KGRRYCVITO4HXPWIFCMHBSS4OEFU3QCPTTUIVO4
// GCZBQSOS5KWXZRQH53VS523RKKXW36D5LGWFERQX6IUF7THIULY46VFJ
// GC2GAHMWG6QRUHOTZT7NNRLLIRYBDF6P4COVIUCKXA4CGCJXV6ZTEOZJ
// GAWOZ4PWVVZLDDRAOX55K62IYLIWUIE5G5DIZK3TIPAXNWX55MERZM6E

// Players
// GANIEGAFGKCW6X4SMVUL7AC2Y7FQKURVPL7CRFJY4JNKHM4D2BFNT56L
// SDBSIQZMEZS2CZMMS62WRHQ53U4RRKA73IYHNROKNFZHYO4476NEBSAI

// GC2UJJ2JZ6UIR3ZZUWXPSFH2YI342CTCRMGYA6C4KRG2CXZQL3AEZ65E
// SDS5CKFO2ESYACMWEBZ2LQ4EML55N3AA6URLKJOWYRHCHFDKHH4VHX7U

// GDBGX4HQ2FOWQ25QE3QSJTQPGJQ3AXBSQR6GWSSOUWSNDC6QWPHCPZIR
// SDXWJQFF7JKA2DJXOPTQO5GZVO5SBL2ZXRP7AKZ3OKHE6JJ7EZYYJMAB

const XLM = Asset.native()

export default async ({signers}) => {
  try {
    const server = new Server('https://horizon-testnet.stellar.org')

    const operations = await server
    .operations()
    .forAccount(contract)
    .order('desc')
    .includeFailed(false)
    .limit(200)
    .call()
    .then(({records}) => records)

    const payout = find(operations, {
      from: contract,
      type: 'payment'
    })

    if (
      payout
      && moment(payout.created_at).add(1, 'hour').isBefore()
    ) {
      const players = filter(operations, (record) =>
        record.to === contract
        && record.from !== contract
        && record.type === 'payment'
        && moment(record.created_at).isAfter(payout.created_at)
      )

      const pool = BigNumber.sum(...map(players, 'amount')).toString()

      const entropy = moment.utc().startOf('minute').format('DDDDYYYYHHmm') // JSON.stringify(operations)
      const rng = seedrandom(entropy)
      const addresses = map(players, 'from')
      const winner = addresses[Math.floor(rng() * addresses.length)]

      const transaction = await server
      .loadAccount(winner)
      .then((account) => {
        return new TransactionBuilder(
          account,
          {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET
          }
        )
        .addOperation(Operation.payment({
          destination: winner,
          asset: XLM,
          amount: pool,
          source: contract
        }))
        .setTimeout(0)
      })

      for (const signer of signers) {
        transaction.addOperation(Operation.payment({
          destination: signer.turret,
          amount: signer.fee,
          asset: XLM
        }))
      }

      return transaction.build().toXDR()
    }

    else
      throw 'Payout too soon'
  }

  catch(err) {
    throw err
  }
}