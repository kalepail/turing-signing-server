import { TransactionBuilder, Networks, Asset, BASE_FEE, Operation, Server } from 'stellar-sdk'
import { find, filter, map } from 'lodash'
import moment from 'moment'
import BigNumber from 'bignumber.js'
import seedrandom from 'seedrandom'

const contract = 'GAW46B4HJW76I3Q2BCDK37IQ454QK6YUCVW2HSKA23Y3EGMRQZBMPUDM'
// SBBXI4IWFP3NY6NZ2GKSU54UHC35JL6GOFZ4FX5IE5V7QSYZZA2TTMND
// 0eea6bd54931101c0fda245f7bebe3c84aaeece4d52b7634e2ce9b2f98540f1f

// GDAEDDFQFLM5VI5E6OWCQRL4MI24TQZVUSSWWUQBGRJJYBR62RHNA5JL
// GAO5IC7FCFWEKEHJ7I2UFP7GZZTSUZWTSD4NMFFQOXBKNJPKDOTLXBCY
// GAE7MLC6BALOHMNIDTOGS2Y5BMFSTTP6JDADAXT3LMVBSTAA4OSFV7OG
// GCTNLBHNN26GPWFILJOPUB7WW3WTTX5EYG6OD5GUEOVX3U5GXL4RYDQX
// GBOLKJB6IZYLHDQ3ST75UOLLKJ7ROH6VSUMQU2ZKAVIYAK3DVDXOYZPR

// Players
// GANIEGAFGKCW6X4SMVUL7AC2Y7FQKURVPL7CRFJY4JNKHM4D2BFNT56L
// SDBSIQZMEZS2CZMMS62WRHQ53U4RRKA73IYHNROKNFZHYO4476NEBSAI

// GC2UJJ2JZ6UIR3ZZUWXPSFH2YI342CTCRMGYA6C4KRG2CXZQL3AEZ65E
// SDS5CKFO2ESYACMWEBZ2LQ4EML55N3AA6URLKJOWYRHCHFDKHH4VHX7U

// GDBGX4HQ2FOWQ25QE3QSJTQPGJQ3AXBSQR6GWSSOUWSNDC6QWPHCPZIR
// SDXWJQFF7JKA2DJXOPTQO5GZVO5SBL2ZXRP7AKZ3OKHE6JJ7EZYYJMAB

// Turrets
// aHR0cHM6Ly90dXJpbmctc2lnbmluZy1zZXJ2ZXItMC5zdGVsbGFyLmJ1enosaHR0cHM6Ly90dXJpbmctc2lnbmluZy1zZXJ2ZXItMS5zdGVsbGFyLmJ1enosaHR0cHM6Ly90dXJpbmctc2lnbmluZy1zZXJ2ZXItMi5zdGVsbGFyLmJ1enosaHR0cHM6Ly90dXJpbmctc2lnbmluZy1zZXJ2ZXItMy5zdGVsbGFyLmJ1enosaHR0cHM6Ly90dXJpbmctc2lnbmluZy1zZXJ2ZXItNC5zdGVsbGFyLmJ1eno=

const XLM = Asset.native()

export default async ({turrets}) => {
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

      for (const turret of turrets) {
        transaction.addOperation(Operation.payment({
          destination: turret.vault,
          amount: turret.fee,
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