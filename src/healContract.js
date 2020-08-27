import { Keypair, TransactionBuilder, Networks, BASE_FEE, Operation, Server, StellarTomlResolver } from 'stellar-sdk'
import { map, get, find, compact, intersection, chain, uniqBy } from 'lodash'
import Promise from 'bluebird'
import axios from 'axios'

import { tssRoute, createJsonResponse, parseError } from './js/utils'
import Pool from './js/pg'

// TODO: Ensure a 1:1 swap, if multiple turrets are dead enforce swapping 1 at a time
  // If signer is live but not included in X-Turrets a swap is possible

// // GAVDUDMKRMGDF57IXX745EWKM4UPC3X7LGO6C5NKT4CDQW7MT7L6UXNR // User

// // Signer | Turret
// // GANZKLEAC35NI4C5VQSQIUNITHFAOTVQZWIEJRS2EQBHRBMHNP66OQR4 // 0 // GCQIG3PL446FRQUPURVJ3L3MIAB62YPSNWB7PNU72EUOASYS3FDM6VPY // Included by default when pinging tss-0
// // GCIFRINKY2PXE22526XQ6HKNMZD4NDTBO6MQEGL7NQ7RKJPSEOBR5FFX // 1 // GCC63HKFK2NGRPB6GWGDGCPAU3XG5E545O32G3VGTYX2O73QIKB7NZ5Z
// // GCS5OSF7RJRDPYKSTQZPFRLD5WJN6ZHANSSCPQNLRQ4NULQO2BMZMH7B // ? // 2 // GDFXSY7WAMLUABSPTFDG7KJVUDM2DMJXO6OGEIBQYRLWKHW2DTFBWBPL
// // GBQ4FNTGKEJMCS4HOIWOFUZYBX5OV5EWEPY4J4LGSQMK3SRNPXMOGDYX // ? // 3 // GDWWCJLFOSWHBLGWIYECP4ZJECNTMW2VMWV3C5T733KVFQQRE57CFZKD
// // GCVJXKA3WVGA4NQI3UVUQOGIXQN3LHZGANWEEFLUIWUHPKLIJFGEMYVE // 4 // GCBUD7XJUSMAACYIVF7ZGXFMJGTSUHS446NBZZAXPI365UQDEMXXUHXF

const horizon = process.env.STELLAR_NETWORK === 'TESTNET' ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org'
const server = new Server(horizon)

export default async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const { source, account, remove, add } = JSON.parse(event.body)

    const { requiredThreshold, existingSigners } = await server
    .loadAccount(account)
    .then((account) => {
      const existingSigners = map(account.data_attr, (value, key) => {
        value = Buffer.from(value, 'base64').toString('utf8')

        const signer = find(account.signers, {key: value})

        return key.indexOf('TSS') === 0 && signer ? {
          turret: key.replace('TSS_', ''),
          signer: value,
          weight: signer.weight
        } : null
      })

      return {
        requiredThreshold: account.thresholds.high_threshold,
        existingSigners
      }
    })

    const incomingTurretKeys = await Promise.map(uniqBy([
      {turret: add},
      ...existingSigners
    ], 'turret'), async (signer) => {
      return {
        ...signer,
        ...await server
        .loadAccount(signer.turret)
        .then((account) => axios
          .get(`${tssRoute(account)}/contract/${event.pathParameters.hash}`)
          .then(async ({data}) => ({
            signer: data.signer,
            toml: account.home_domain ? await StellarTomlResolver.resolve(account.home_domain) : null,
          }))
          .catch(() => null)
        )
      }
    })

    const removeSigner = find(incomingTurretKeys, {turret: remove})

    if (!removeSigner || removeSigner.toml)
      throw 'Signer is not able to be removed'

    const addSigner = find(incomingTurretKeys, {turret: add})

    if (!addSigner || !addSigner.toml)
      throw 'Signer is not able to be added'

    const hasThreshold = chain(incomingTurretKeys)
    .filter((signer) => signer.toml && signer.weight)
    .sumBy('weight')
    .value()

    if (hasThreshold < requiredThreshold)
      throw 'Insufficient signer threshold'

    const turrets = intersection(...compact(map(incomingTurretKeys, 'toml.TSS.TURRETS')))

    if (turrets.indexOf(addSigner.turret) === -1)
      throw `New turret isn't trusted by existing signer turrets`

    const transaction = await server
    .loadAccount(source)
    .then((account) => new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
    .addOperation(Operation.setOptions({
      signer: {
        ed25519PublicKey: removeSigner.signer,
        weight: 0
      }
    }))
    .addOperation(Operation.setOptions({
      signer: {
        ed25519PublicKey: addSigner.signer,
        weight: removeSigner.weight
      }
    }))
    .setTimeout(0)
    .build())

    const pgClientSelect = await Pool.connect()

    const signerSecret = await pgClientSelect.query(`
      SELECT signer FROM contracts
      WHERE contract = $1
    `,[event.pathParameters.hash]).then((data) => get(data, 'rows[0].signer'))

    await pgClientSelect.release()

    const signerKeypair = Keypair.fromSecret(signerSecret)
    const signature = signerKeypair.sign(transaction.hash()).toString('base64')

    return createJsonResponse({
      xdr: transaction.toXDR(),
      signer: signerKeypair.publicKey(),
      signature
    })
  }

  catch(err) {
    return parseError(err)
  }
}