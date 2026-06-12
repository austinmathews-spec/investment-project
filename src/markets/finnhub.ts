// Finnhub + CoinGecko market data client.
// Docs: https://finnhub.io/docs/api — free tier allows 60 calls/min.

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  prevClose: number;
  isCrypto?: boolean;
}

export interface MarketNewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number; // unix seconds
  image?: string;
  category: string;
}

export const DEFAULT_WATCHLIST: { symbol: string; name: string }[] = [
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
  { symbol: 'DIA', name: 'Dow Jones ETF' },
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'AMZN', name: 'Amazon' },
];

async function finnhubGet<T>(key: string, path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${FINNHUB_BASE}${path}${sep}token=${encodeURIComponent(key)}`);
  if (res.status === 401 || res.status === 403) {
    throw new Error('Invalid Finnhub API key');
  }
  if (res.status === 429) {
    throw new Error('Finnhub rate limit reached — try again in a minute');
  }
  if (!res.ok) {
    throw new Error(`Finnhub request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

interface FinnhubQuoteResponse {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  pc: number; // previous close
}

export async function fetchQuote(
  key: string,
  symbol: string,
  name: string
): Promise<MarketQuote> {
  const q = await finnhubGet<FinnhubQuoteResponse>(key, `/quote?symbol=${encodeURIComponent(symbol)}`);
  return {
    symbol,
    name,
    price: q.c ?? 0,
    change: q.d ?? 0,
    changePercent: q.dp ?? 0,
    prevClose: q.pc ?? 0,
  };
}

export async function fetchQuotes(
  key: string,
  watchlist: { symbol: string; name: string }[]
): Promise<MarketQuote[]> {
  return Promise.all(watchlist.map((w) => fetchQuote(key, w.symbol, w.name)));
}

interface FinnhubNewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  image: string;
  category: string;
}

export async function fetchMarketNews(
  key: string,
  category: 'general' | 'crypto' = 'general'
): Promise<MarketNewsItem[]> {
  const items = await finnhubGet<FinnhubNewsItem[]>(key, `/news?category=${category}`);
  return items
    .filter((n) => n.headline)
    .slice(0, 40)
    .map((n) => ({
      id: n.id,
      headline: n.headline,
      summary: n.summary ?? '',
      source: n.source ?? '',
      url: n.url,
      datetime: n.datetime,
      image: n.image || undefined,
      category: n.category ?? category,
    }));
}

// ─── Price history ───────────────────────────────────────────────
// Stocks come from the Yahoo chart API via the /api/chart Vercel proxy
// (Yahoo sends no CORS headers; Finnhub candles are premium-only).
// BTC history comes straight from CoinGecko.

export type HistoryRange = '1D' | '1W' | '1M' | '3M' | '1Y';

export const HISTORY_RANGES: HistoryRange[] = ['1D', '1W', '1M', '3M', '1Y'];

export interface HistoryPoint {
  label: string;
  value: number;
}

const CHART_PROXY_BASE = process.env.EXPO_PUBLIC_CHART_PROXY || '/api/chart';

const RANGE_PARAMS: Record<HistoryRange, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '1W': { range: '5d', interval: '30m' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' },
};

const COINGECKO_DAYS: Record<HistoryRange, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
};

function historyLabel(ms: number, range: HistoryRange): string {
  const d = new Date(ms);
  if (range === '1D') {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (range === '1W') {
    return d.toLocaleDateString([], { weekday: 'short', hour: 'numeric' });
  }
  if (range === '1Y') {
    return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface YahooChartResponse {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

export async function fetchStockHistory(
  symbol: string,
  range: HistoryRange
): Promise<HistoryPoint[]> {
  const { range: r, interval } = RANGE_PARAMS[range];
  const res = await fetch(
    `${CHART_PROXY_BASE}?symbol=${encodeURIComponent(symbol)}&range=${r}&interval=${interval}`
  );
  if (!res.ok) throw new Error(`Chart request failed (${res.status})`);
  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const points: HistoryPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close === null || close === undefined) continue;
    points.push({ label: historyLabel(timestamps[i] * 1000, range), value: close });
  }
  if (points.length < 2) throw new Error('No chart data available');
  return points;
}

interface CoinGeckoChartResponse {
  prices?: [number, number][];
}

export async function fetchBtcHistory(range: HistoryRange): Promise<HistoryPoint[]> {
  const days = COINGECKO_DAYS[range];
  const res = await fetch(
    `${COINGECKO_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`
  );
  if (!res.ok) throw new Error(`CoinGecko chart request failed (${res.status})`);
  const data = (await res.json()) as CoinGeckoChartResponse;
  const prices = data.prices ?? [];
  // CoinGecko returns hourly (or 5-min) granularity — thin to ~120 points.
  const step = Math.max(1, Math.floor(prices.length / 120));
  const points: HistoryPoint[] = [];
  for (let i = 0; i < prices.length; i += step) {
    points.push({ label: historyLabel(prices[i][0], range), value: prices[i][1] });
  }
  if (points.length < 2) throw new Error('No chart data available');
  return points;
}

export function fetchHistory(quote: MarketQuote, range: HistoryRange): Promise<HistoryPoint[]> {
  return quote.isCrypto ? fetchBtcHistory(range) : fetchStockHistory(quote.symbol, range);
}

interface CoinGeckoPriceResponse {
  bitcoin?: { usd: number; usd_24h_change: number };
}

// CoinGecko needs no API key; used for BTC since Finnhub free tier
// does not include crypto exchange quotes.
export async function fetchBtcQuote(): Promise<MarketQuote> {
  const res = await fetch(
    `${COINGECKO_BASE}/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`
  );
  if (!res.ok) throw new Error(`CoinGecko request failed (${res.status})`);
  const data = (await res.json()) as CoinGeckoPriceResponse;
  const price = data.bitcoin?.usd ?? 0;
  const changePercent = data.bitcoin?.usd_24h_change ?? 0;
  const prevClose = price / (1 + changePercent / 100);
  return {
    symbol: 'BTC',
    name: 'Bitcoin',
    price,
    change: price - prevClose,
    changePercent,
    prevClose,
    isCrypto: true,
  };
}
