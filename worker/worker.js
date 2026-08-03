// Simple CORS proxy for Yahoo Finance API
// Handles: /?url=https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL
export default {
  async fetch(request) {
    const url = new URL(request.url)
    const target = url.searchParams.get('url')

    if (!target) {
      return new Response('Usage: /?url=<encoded-url>', { status: 400 })
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    try {
      const resp = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StockTracker/1.0)',
          'Accept': 'application/json',
        },
      })

      const body = await resp.text()

      return new Response(body, {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=30, s-maxage=60',
        },
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Proxy error', detail: e.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }
  },
}
