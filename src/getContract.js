import { Keypair } from 'stellar-sdk'

import { headers, parseError } from './js/utils'
import Pool from './js/pg'

export default async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false

  try {
    const signerSecret = await Pool.query(`
     SELECT signer FROM contracts
     WHERE contract = '${event.pathParameters.hash}'
   `).then((data) => {
      const contractSigner = data.rows[0]

      if (contractSigner)
        return contractSigner.signer

      throw {
        status: 404,
        message: 'Contract not found'
      }
    })

    const signerKeypair = Keypair.fromSecret(signerSecret)

    return {
      headers,
      statusCode: 200,
      body: JSON.stringify({
        vault: process.env.TURING_VAULT_ADDRESS,
        signer: signerKeypair.publicKey(),
        fee: process.env.TURING_RUN_FEE
      })
    }
  }

  catch(err) {
    return parseError(err)
  }
}