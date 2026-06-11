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
