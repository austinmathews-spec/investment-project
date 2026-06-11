import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  RefreshControl,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, TouchTarget } from '../theme';
import AnimatedNumber from '../components/AnimatedNumber';
import ScreenSkeleton from '../components/ScreenSkeleton';
import { loadFinnhubKey } from '../storage';
import {
  DEFAULT_WATCHLIST,
  MarketQuote,
  MarketNewsItem,
  fetchQuotes,
  fetchBtcQuote,
  fetchMarketNews,
  fetchQuote,
} from '../markets/finnhub';

const WATCHLIST_KEY = '@sofi_markets_watchlist';
const QUOTE_POLL_MS = 15000;
const NEWS_POLL_MS = 5 * 60 * 1000;

type NewsCategory = 'general' | 'crypto';

function timeAgo(unixSeconds: number): string {
  const diff = Math.max(0, Date.now() / 1000 - unixSeconds);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function loadWatchlist(): Promise<{ symbol: string; name: string }[]> {
  const raw = await AsyncStorage.getItem(WATCHLIST_KEY);
  if (raw) return JSON.parse(raw);
  return DEFAULT_WATCHLIST;
}

async function saveWatchlist(list: { symbol: string; name: string }[]): Promise<void> {
  await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
}

const QuoteRow = React.memo(function QuoteRow({
  quote,
  onRemove,
}: {
  quote: MarketQuote;
  onRemove?: (symbol: string) => void;
}) {
  const positive = quote.change >= 0;
  const color = positive ? Colors.positive : Colors.negative;
  return (
    <View style={styles.quoteRow}>
      <View style={styles.quoteLeft}>
        <Text style={styles.quoteSymbol}>{quote.symbol}</Text>
        <Text style={styles.quoteName} numberOfLines={1}>
          {quote.name}
        </Text>
      </View>
      <View style={styles.quoteRight}>
        <AnimatedNumber value={quote.price} format={formatPrice} style={styles.quotePrice} />
        <Text style={[styles.quoteChange, { color }]}>
          {positive ? '▲' : '▼'} {formatPrice(Math.abs(quote.change))} ({Math.abs(quote.changePercent).toFixed(2)}%)
        </Text>
      </View>
      {onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(quote.symbol)}
          accessibilityLabel={`Remove ${quote.symbol} from watchlist`}
        >
          <Feather name="x" size={14} color={Colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
});

const NewsCard = React.memo(function NewsCard({ item }: { item: MarketNewsItem }) {
  const open = useCallback(() => {
    if (Platform.OS === 'web') {
      window.open(item.url, '_blank', 'noopener');
    } else {
      Linking.openURL(item.url);
    }
  }, [item.url]);

  return (
    <TouchableOpacity style={styles.newsCard} onPress={open} accessibilityRole="link">
      <View style={styles.newsMeta}>
        <Text style={styles.newsSource}>{item.source}</Text>
        <Text style={styles.newsTime}>{timeAgo(item.datetime)}</Text>
      </View>
      <Text style={styles.newsHeadline}>{item.headline}</Text>
      {!!item.summary && (
        <Text style={styles.newsSummary} numberOfLines={2}>
          {item.summary}
        </Text>
      )}
    </TouchableOpacity>
  );
});

export default function MarketsScreen() {
  const navigation = useNavigation<any>();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyChecked, setKeyChecked] = useState(false);
  const [watchlist, setWatchlist] = useState<{ symbol: string; name: string }[]>(DEFAULT_WATCHLIST);
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [btc, setBtc] = useState<MarketQuote | null>(null);
  const [news, setNews] = useState<MarketNewsItem[]>([]);
  const [category, setCategory] = useState<NewsCategory>('general');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addSymbol, setAddSymbol] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const newsTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshQuotes = useCallback(
    async (key: string, list: { symbol: string; name: string }[]) => {
      try {
        const [stockQuotes, btcQuote] = await Promise.all([
          fetchQuotes(key, list),
          fetchBtcQuote().catch(() => null),
        ]);
        setQuotes(stockQuotes);
        if (btcQuote) setBtc(btcQuote);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quotes');
      }
    },
    []
  );

  const refreshNews = useCallback(async (key: string, cat: NewsCategory) => {
    try {
      const items = await fetchMarketNews(key, cat);
      setNews(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [key, list] = await Promise.all([loadFinnhubKey(), loadWatchlist()]);
        if (cancelled) return;
        setApiKey(key);
        setWatchlist(list);
        setKeyChecked(true);
        if (key) {
          setLoading(true);
          await Promise.all([refreshQuotes(key, list), refreshNews(key, category)]);
          if (cancelled) return;
          setLoading(false);
          quoteTimer.current = setInterval(() => refreshQuotes(key, list), QUOTE_POLL_MS);
          newsTimer.current = setInterval(() => refreshNews(key, category), NEWS_POLL_MS);
        } else {
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
        if (quoteTimer.current) clearInterval(quoteTimer.current);
        if (newsTimer.current) clearInterval(newsTimer.current);
      };
    }, [category, refreshQuotes, refreshNews])
  );

  const handleRefresh = useCallback(async () => {
    if (!apiKey) return;
    setRefreshing(true);
    await Promise.all([refreshQuotes(apiKey, watchlist), refreshNews(apiKey, category)]);
    setRefreshing(false);
  }, [apiKey, watchlist, category, refreshQuotes, refreshNews]);

  const handleAdd = useCallback(async () => {
    const symbol = addSymbol.trim().toUpperCase();
    if (!symbol || !apiKey) return;
    if (watchlist.some((w) => w.symbol === symbol)) {
      setAddSymbol('');
      return;
    }
    try {
      const quote = await fetchQuote(apiKey, symbol, symbol);
      if (!quote.price) {
        setError(`No quote found for "${symbol}"`);
        return;
      }
      const next = [...watchlist, { symbol, name: symbol }];
      setWatchlist(next);
      setQuotes((q) => [...q, quote]);
      setAddSymbol('');
      setError(null);
      await saveWatchlist(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to add ${symbol}`);
    }
  }, [addSymbol, apiKey, watchlist]);

  const handleRemove = useCallback(
    async (symbol: string) => {
      const next = watchlist.filter((w) => w.symbol !== symbol);
      setWatchlist(next);
      setQuotes((q) => q.filter((x) => x.symbol !== symbol));
      await saveWatchlist(next);
    },
    [watchlist]
  );

  if (!keyChecked || (loading && apiKey)) {
    return <ScreenSkeleton />;
  }

  if (!apiKey) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyInner}>
          <Feather name="activity" size={40} color={Colors.accent} />
          <Text style={styles.emptyTitle}>Connect market data</Text>
          <Text style={styles.emptyText}>
            Live quotes and market news are powered by Finnhub. Get a free API key at
            finnhub.io and add it in Settings.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.emptyButtonText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} />}
    >
      <View style={styles.inner}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Watchlist</Text>
          <View style={styles.sectionHeaderRight}>
            {lastUpdated && (
              <Text style={styles.updatedText}>
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            )}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditMode((e) => !e)}
              accessibilityLabel={editMode ? 'Done editing watchlist' : 'Edit watchlist'}
            >
              <Text style={styles.editButtonText}>{editMode ? 'Done' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.quoteList}>
          {btc && <QuoteRow quote={btc} />}
          {quotes.map((q) => (
            <QuoteRow key={q.symbol} quote={q} onRemove={editMode ? handleRemove : undefined} />
          ))}
        </View>

        {editMode && (
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={addSymbol}
              onChangeText={setAddSymbol}
              placeholder="Add ticker (e.g. GOOGL)"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={handleAdd}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
              <Feather name="plus" size={18} color={Colors.white} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          <Text style={styles.sectionTitle}>News</Text>
          <View style={styles.chipRow}>
            {(['general', 'crypto'] as NewsCategory[]).map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                  {c === 'general' ? 'Markets' : 'Crypto'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {news.length === 0 ? (
          <Text style={styles.emptyNewsText}>No headlines right now.</Text>
        ) : (
          news.map((item) => <NewsCard key={item.id} item={item} />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  inner: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  errorText: {
    fontSize: FontSizes.sm,
    color: Colors.negative,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  updatedText: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  editButton: {
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  quoteList: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: TouchTarget,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  quoteLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  quoteSymbol: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  quoteName: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  quoteRight: {
    alignItems: 'flex-end',
  },
  quotePrice: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  quoteChange: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
    backgroundColor: Colors.cardBackgroundLight,
  },
  addRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: TouchTarget,
  },
  addButton: {
    width: TouchTarget,
    minHeight: TouchTarget,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.accent,
  },
  newsCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  newsMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  newsSource: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  newsTime: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  newsHeadline: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  newsSummary: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    lineHeight: 19,
  },
  emptyNewsText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    paddingVertical: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  emptyInner: {
    alignItems: 'center',
    maxWidth: 360,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
  emptyButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
