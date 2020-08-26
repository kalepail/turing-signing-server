import { TransactionBuilder, Networks, Asset, BASE_FEE, Operation, Server } from 'stellar-sdk'
import { find } from 'lodash'

// Contract

// Signers
// GBBXLRF27BGW4O2NBEM6RTOGBZFWVH2AKWRGN6OCHJW6APNOLEIUSADK
  // SCBOPZ42BEIKN5IE4I4QFCWSYGJ5IDPKSIZSEU5CMGPY2IYSTPJHDXAC
// GDXE5A5OBPCDJDRC4F4ROUTLXIPTRGOVHGSHPC55BKMPJ5UBEJU2NCDE
  // SAXL7TOPEUMDZKPI5LZFJWE7XJ5CKRU6KTPS37CE74RI3MZSBQAMWW5B

// User
// GBMPT2QOWW6YSA3NXCQVSG6LV3TJAWBWBL2R2KVI7TOEW2SM4NZK5ID7
  // SANV57TC4CGCX7KTGUQUIVGLQJH2R6XBNDGGR3M47H3K6JVMPLXFF22X

// Turrets

// Fields

const XLM = Asset.native()

async function contract({request, turrets}) {
  try {
    const server = new Server('https://horizon-testnet.stellar.org')

    const transaction = await server
    .loadAccount(request.source)
    .then((account) => {
      const removeSigner = find(account.signers, {key: request.remove})

      if (!removeSigner)
        throw `${request.remove} is not a signer for ${request.source}`

      return new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET
      })
      .addOperation(Operation.setOptions({
        signer: {
          ed25519PublicKey: request.remove,
          weight: 0
        }
      }))
      .addOperation(Operation.setOptions({
        signer: {
          ed25519PublicKey: request.add,
          weight: removeSigner.weight
        }
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

  catch(err) {
    throw err
  }
}

export default contract

contract({request: {
  source: 'GBMPT2QOWW6YSA3NXCQVSG6LV3TJAWBWBL2R2KVI7TOEW2SM4NZK5ID7',
  remove: 'GDXE5A5OBPCDJDRC4F4ROUTLXIPTRGOVHGSHPC55BKMPJ5UBEJU2NCDE',
  add: 'GBBXLRF27BGW4O2NBEM6RTOGBZFWVH2AKWRGN6OCHJW6APNOLEIUSADK',
}, turrets: [{
  vault: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
  fee: '0.5'
},{
  vault: 'GD6JDEASY6CV2OC3VANDZZTUWKFKRDNPX5SBXH4OPEKHOHPQWN6T657G',
  fee: '0.5'
}]})
.then((data) => console.log(data))
.catch((err) => console.error(err))