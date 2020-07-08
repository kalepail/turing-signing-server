const standardHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public; max-age=14400'
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