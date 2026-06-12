// Vercel serverless proxy for historical price data (Yahoo Finance chart API).
// Yahoo does not send CORS headers, so the browser cannot call it directly.

const ALLOWED_RANGES = new Set(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max']);
const ALLOWED_INTERVALS = new Set(['1m', '5m', '15m', '30m', '1h', '1d', '1wk', '1mo']);

export default async function handler(req, res) {
  const { symbol = '', range = '1mo', interval = '1d' } = req.query;

  if (!/^[A-Za-z0-9.^=-]{1,12}$/.test(symbol)) {
    res.status(400).json({ error: 'Invalid symbol' });
    return;
  }
  if (!ALLOWED_RANGES.has(range) || !ALLOWED_INTERVALS.has(interval)) {
    res.status(400).json({ error: 'Invalid range or interval' });
    return;
  }

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}&includePrePost=false`;

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; investment-dashboard)' },
    });
    const data = await upstream.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Upstream chart request failed' });
  }
}
