const standardHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public; max-age=14400'
}

export const isDev = process.env.NODE_ENV === 'development'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = isDev ? 0 : 1

export function tssRoute(account) {
  let instance = 0

  switch(account.id) {
    case 'GCQIG3PL446FRQUPURVJ3L3MIAB62YPSNWB7PNU72EUOASYS3FDM6VPY':
    instance = 0
    break;

    case 'GCC63HKFK2NGRPB6GWGDGCPAU3XG5E545O32G3VGTYX2O73QIKB7NZ5Z':
    instance = 1
    break;

    case 'GDFXSY7WAMLUABSPTFDG7KJVUDM2DMJXO6OGEIBQYRLWKHW2DTFBWBPL':
    instance = 2
    break;

    case 'GDWWCJLFOSWHBLGWIYECP4ZJECNTMW2VMWV3C5T733KVFQQRE57CFZKD':
    instance = 3
    break;

    case 'GCBUD7XJUSMAACYIVF7ZGXFMJGTSUHS446NBZZAXPI365UQDEMXXUHXF':
    instance = 4
    break;
  }

  return isDev ? `https://localhost:400${instance}/dev` : account.home_domain
}

export function createJsonResponse(data) {
  return {
      headers: {
          ...standardHeaders,
          'Content-Type': 'application/json'
      },
      statusCode: 200,
      body: JSON.stringify(data)
  }
}

export function createXdrResponse(xdr) {
  return {
      headers: {
          ...standardHeaders,
          'Content-Type': 'text/plain'
      },
      statusCode: 200,
      body: xdr
  }
}

export function parseError(err) {
  const error =
  typeof err === 'string'
  ? { message: err }
  : err.response && err.response.data
  ? err.response.data
  : err.response
  ? err.response
  : err.message
  ? { message: err.message }
  : err

  console.error(err)
  console.error(error)

  return {
    statusCode: error.status || err.status || error.statusCode || err.statusCode || 400,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(error)
  }
}