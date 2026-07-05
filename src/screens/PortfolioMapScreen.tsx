import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius, Motion, TouchTarget } from '../theme';
import { Account, AppData } from '../types';
import { loadAppData, syncWithAirtable, loadAirtableConfig, isDemoMode } from '../storage';
import {
  formatCurrency,
  formatCurrencyDecimal,
  formatDate,
  accountTypeLabel,
} from '../utils/format';
import { prefersReducedMotion } from '../utils/motion';
import MiniChart from '../components/MiniChart';
import LargeChart from '../components/LargeChart';
import Skeleton from '../components/Skeleton';
import BottomSheet from '../components/BottomSheet';
import AnimatedNumber from '../components/AnimatedNumber';

// ─── Types ───────────────────────────────────────────────────────

interface MapNodeData {
  account: Account;
  history: { date: string; value: number }[];
  change: number; // $ since previous data point
  changePercent: number;
  totalReturn: number; // $ since first data point
  totalReturnPercent: number;
  x: number; // center position in virtual canvas
  y: number;
  r: number; // radius
}

// ─── Layout: deterministic spiral circle packing ─────────────────

function packNodes(
  accounts: Account[],
  radiusFor: (balance: number) => number
): { x: number; y: number; r: number; account: Account }[] {
  const sorted = [...accounts].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  const placed: { x: number; y: number; r: number; account: Account }[] = [];
  const GAP = 10;
  for (const account of sorted) {
    const r = radiusFor(Math.abs(account.balance));
    if (placed.length === 0) {
      placed.push({ x: 0, y: 0, r, account });
      continue;
    }
    let angle = (placed.length * 2.39996) % (Math.PI * 2); // golden angle offset
    let dist = placed[0].r + r + GAP;
    let pos = { x: 0, y: 0 };
    let found = false;
    while (!found) {
      pos = { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * 0.72 };
      found = placed.every(
        (p) => Math.hypot(p.x - pos.x, p.y - pos.y) >= p.r + r + GAP
      );
      if (!found) {
        angle += 0.35;
        dist += 1.6;
      }
    }
    placed.push({ ...pos, r, account });
  }
  return placed;
}

// ─── Compact node card (memoized) ────────────────────────────────

interface MapNodeProps {
  node: MapNodeData;
  selected: boolean;
  compact: boolean;
  onSelect: (id: string) => void;
}

const MapNode = memo(function MapNode({ node, selected, compact, onSelect }: MapNodeProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const positive = node.changePercent >= 0;
  const color = positive ? Colors.positive : Colors.negative;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: selected ? 1.03 : 1,
      duration: prefersReducedMotion() ? 0 : Motion.select,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selected, scale]);

  const handlePress = useCallback(() => onSelect(node.account.id), [onSelect, node.account.id]);

  const sparkData = node.history.map((h) => h.value);
  const showSparkline = !compact && node.r >= 52 && sparkData.length >= 2;
  const shortName = node.account.name.toUpperCase();

  return (
    <Animated.View
      style={[
        styles.node,
        {
          left: node.x - node.r,
          top: node.y - node.r,
          width: node.r * 2,
          height: node.r * 2,
          borderRadius: node.r,
          borderColor: selected ? color : Colors.border,
          borderWidth: selected ? 1.5 : 1,
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable
        style={styles.nodePressable}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${node.account.name}, ${formatCurrency(node.account.balance)}`}
      >
        <Text
          style={[styles.nodeTicker, { fontSize: Math.max(10, Math.min(15, node.r / 4.2)) }]}
          numberOfLines={1}
        >
          {shortName}
        </Text>
        <Text style={[styles.nodeChange, { color, fontSize: Math.max(9, Math.min(13, node.r / 5)) }]}>
          {positive ? '▲' : '▼'} {formatCurrency(node.account.balance)}
        </Text>
        {showSparkline && (
          <MiniChart data={sparkData} width={Math.min(60, node.r)} height={20} color={color} showFill={false} />
        )}
      </Pressable>
    </Animated.View>
  );
});

// ─── Detail panel content ────────────────────────────────────────

const RANGES = [
  { key: '1M', months: 1 },
  { key: '3M', months: 3 },
  { key: '6M', months: 6 },
  { key: '1Y', months: 12 },
  { key: 'All', months: 0 },
] as const;

function DetailContent({ node, chartWidth }: { node: MapNodeData; chartWidth: number }) {
  const [range, setRange] = useState<string>('All');
  const positive = node.change >= 0;
  const color = positive ? Colors.positive : Colors.negative;

  const filteredHistory = useMemo(() => {
    const def = RANGES.find((r) => r.key === range);
    if (!def || def.months === 0) return node.history;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - def.months);
    const cut = cutoff.toISOString().slice(0, 10);
    const filtered = node.history.filter((h) => h.date >= cut);
    return filtered.length >= 2 ? filtered : node.history;
  }, [node.history, range]);

  const rangeStart = filteredHistory[0]?.value ?? node.account.balance;
  const rangeChange = node.account.balance - rangeStart;
  const rangePositive = rangeChange >= 0;
  const rangeColor = rangePositive ? Colors.positive : Colors.negative;

  return (
    <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
      <Text style={styles.detailType}>
        {accountTypeLabel(node.account.type)}
        {node.account.institution ? ` · ${node.account.institution}` : ''}
      </Text>
      <Text style={styles.detailName}>{node.account.name}</Text>
      <AnimatedNumber
        value={node.account.balance}
        format={formatCurrencyDecimal}
        style={styles.detailBalance}
      />
      <View style={styles.detailChangeRow}>
        <Text style={[styles.detailChangeText, { color }]}>
          {positive ? '▲' : '▼'} {formatCurrency(Math.abs(node.change))} ({Math.abs(node.changePercent * 100).toFixed(1)}%)
        </Text>
        <Text style={styles.detailChangeLabel}>since last update</Text>
      </View>

      {filteredHistory.length >= 2 ? (
        <View style={styles.detailChartWrap}>
          <LargeChart
            data={filteredHistory.map((h) => ({ label: h.date, value: h.value }))}
            width={chartWidth}
            height={200}
            color={rangeColor}
          />
        </View>
      ) : (
        <View style={[styles.detailChartWrap, styles.detailChartEmpty]}>
          <Text style={styles.detailEmptyText}>Not enough history yet</Text>
        </View>
      )}

      <View style={styles.rangeRow}>
        {RANGES.map((r) => {
          const active = r.key === range;
          return (
            <TouchableOpacity
              key={r.key}
              style={[styles.rangeButton, active && styles.rangeButtonActive]}
              onPress={() => setRange(r.key)}
            >
              <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{r.key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.statGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>{range} change</Text>
          <Text style={[styles.statValue, { color: rangeColor }]}>
            {rangePositive ? '+' : '-'}{formatCurrency(Math.abs(rangeChange))}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Total return</Text>
          <Text style={[styles.statValue, { color: node.totalReturn >= 0 ? Colors.positive : Colors.negative }]}>
            {node.totalReturn >= 0 ? '+' : '-'}{formatCurrency(Math.abs(node.totalReturn))} ({Math.abs(node.totalReturnPercent * 100).toFixed(1)}%)
          </Text>
        </View>
        {node.account.interestRate !== undefined && (
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Interest rate</Text>
            <Text style={styles.statValue}>{(node.account.interestRate * 100).toFixed(2)}% APY</Text>
          </View>
        )}
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Last updated</Text>
          <Text style={styles.statValue}>{formatDate(node.account.lastUpdated)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Map screen ──────────────────────────────────────────────────

export default function PortfolioMapScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  const [data, setData] = useState<AppData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Transform state lives in refs + Animated values — pan/zoom never re-renders React.
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const tx = useRef(0);
  const ty = useRef(0);
  const sc = useRef(1);
  const gesture = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    pinchDist: 0,
    pinchScale: 1,
    moved: false,
  });
  const rafPending = useRef(false);
  const pendingUpdate = useRef<{ tx: number; ty: number; sc: number } | null>(null);

  const loadData = useCallback(async () => {
    const config = await loadAirtableConfig();
    let appData: AppData;
    if (config && config.pat && config.baseId) {
      try {
        appData = await syncWithAirtable();
      } catch {
        appData = await loadAppData();
      }
    } else {
      appData = await loadAppData();
    }
    setData(appData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ── Derived nodes (memoized; only recomputes when data changes) ──
  const nodes: MapNodeData[] = useMemo(() => {
    if (!data) return [];
    const accounts = data.accounts.filter(a => a.balance !== 0);
    if (accounts.length === 0) return [];
    const balances = accounts.map((a) => Math.abs(a.balance));
    const maxBal = Math.max(...balances, 1);
    const minR = isMobile ? 34 : 42;
    const maxR = isMobile ? 64 : 84;
    const radiusFor = (b: number) => minR + (maxR - minR) * Math.sqrt(b / maxBal);
    const placed = packNodes(accounts, radiusFor);
    const sortedSnaps = [...data.snapshots].sort((a, b) => a.date.localeCompare(b.date));
    return placed.map((p) => {
      const history = sortedSnaps
        .filter((s) => s.accountBalances[p.account.id] !== undefined)
        .map((s) => ({ date: s.date, value: s.accountBalances[p.account.id] }));
      history.push({ date: p.account.lastUpdated, value: p.account.balance });
      const prev = history.length >= 2 ? history[history.length - 2].value : p.account.balance;
      const first = history[0].value;
      const change = p.account.balance - prev;
      const totalReturn = p.account.balance - first;
      return {
        account: p.account,
        history,
        change,
        changePercent: prev !== 0 ? change / Math.abs(prev) : 0,
        totalReturn,
        totalReturnPercent: first !== 0 ? totalReturn / Math.abs(first) : 0,
        x: p.x,
        y: p.y,
        r: p.r,
      };
    });
  }, [data, isMobile]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.account.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  // ── Transform application, rAF-batched ──
  const applyTransform = useCallback(() => {
    rafPending.current = false;
    const u = pendingUpdate.current;
    if (!u) return;
    pendingUpdate.current = null;
    tx.current = u.tx;
    ty.current = u.ty;
    sc.current = u.sc;
    translateX.setValue(u.tx);
    translateY.setValue(u.ty);
    scaleAnim.setValue(u.sc);
  }, [translateX, translateY, scaleAnim]);

  const scheduleTransform = useCallback(
    (nextTx: number, nextTy: number, nextSc: number) => {
      pendingUpdate.current = { tx: nextTx, ty: nextTy, sc: Math.min(3, Math.max(0.3, nextSc)) };
      if (!rafPending.current) {
        rafPending.current = true;
        requestAnimationFrame(applyTransform);
      }
    },
    [applyTransform]
  );

  const mapHeight = Math.max(360, screenHeight - (isMobile ? 230 : 200));

  // Fit-to-view: center the node bounding box in the viewport.
  const fitToView = useCallback(() => {
    if (nodes.length === 0) return;
    const minX = Math.min(...nodes.map((n) => n.x - n.r));
    const maxX = Math.max(...nodes.map((n) => n.x + n.r));
    const minY = Math.min(...nodes.map((n) => n.y - n.r));
    const maxY = Math.max(...nodes.map((n) => n.y + n.r));
    const pad = 30;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const fitScale = Math.min(screenWidth / w, mapHeight / h, 1.4);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    scheduleTransform(-cx * fitScale, -cy * fitScale, fitScale);
  }, [nodes, screenWidth, mapHeight, scheduleTransform]);

  useEffect(() => {
    fitToView();
  }, [fitToView]);

  // ── Pointer / touch handlers ──
  const onTouchStart = useCallback((e: any) => {
    const touches = e.nativeEvent.touches ?? [];
    const g = gesture.current;
    g.active = true;
    g.moved = false;
    if (touches.length >= 2) {
      g.pinchDist = Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY
      );
      g.pinchScale = sc.current;
    } else if (touches.length === 1) {
      g.startX = touches[0].pageX;
      g.startY = touches[0].pageY;
      g.startTx = tx.current;
      g.startTy = ty.current;
    }
  }, []);

  const onTouchMove = useCallback(
    (e: any) => {
      const touches = e.nativeEvent.touches ?? [];
      const g = gesture.current;
      if (!g.active) return;
      if (touches.length >= 2) {
        const dist = Math.hypot(
          touches[0].pageX - touches[1].pageX,
          touches[0].pageY - touches[1].pageY
        );
        if (g.pinchDist > 0) {
          const nextScale = g.pinchScale * (dist / g.pinchDist);
          scheduleTransform(tx.current, ty.current, nextScale);
          g.moved = true;
        }
      } else if (touches.length === 1) {
        const dx = touches[0].pageX - g.startX;
        const dy = touches[0].pageY - g.startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true;
        scheduleTransform(g.startTx + dx, g.startTy + dy, sc.current);
      }
    },
    [scheduleTransform]
  );

  const onTouchEnd = useCallback(() => {
    gesture.current.active = false;
    gesture.current.pinchDist = 0;
  }, []);

  // Mouse drag (web/desktop)
  const onMouseDown = useCallback((e: any) => {
    const g = gesture.current;
    g.active = true;
    g.moved = false;
    g.startX = e.nativeEvent.pageX;
    g.startY = e.nativeEvent.pageY;
    g.startTx = tx.current;
    g.startTy = ty.current;
  }, []);

  const onMouseMove = useCallback(
    (e: any) => {
      const g = gesture.current;
      if (!g.active) return;
      if (e.nativeEvent.buttons === 0) {
        g.active = false;
        return;
      }
      const dx = e.nativeEvent.pageX - g.startX;
      const dy = e.nativeEvent.pageY - g.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true;
      scheduleTransform(g.startTx + dx, g.startTy + dy, sc.current);
    },
    [scheduleTransform]
  );

  const onMouseUp = useCallback(() => {
    gesture.current.active = false;
  }, []);

  const onWheel = useCallback(
    (e: any) => {
      e.preventDefault?.();
      const delta = e.deltaY ?? e.nativeEvent?.deltaY ?? 0;
      const factor = delta > 0 ? 0.92 : 1.08;
      scheduleTransform(tx.current * factor, ty.current * factor, sc.current * factor);
    },
    [scheduleTransform]
  );

  const zoomBy = useCallback(
    (factor: number) => {
      scheduleTransform(tx.current * factor, ty.current * factor, sc.current * factor);
    },
    [scheduleTransform]
  );

  const handleSelect = useCallback((id: string) => {
    if (gesture.current.moved) return; // ignore taps at the end of a drag
    setSelectedId((cur) => (cur === id ? null : id));
  }, []);

  const closeDetail = useCallback(() => setSelectedId(null), []);

  // ── Portfolio summary ──
  const totalBalance = useMemo(
    () => (data ? data.accounts.reduce((s, a) => s + a.balance, 0) : 0),
    [data]
  );
  const totalChange = useMemo(() => nodes.reduce((s, n) => s + n.change, 0), [nodes]);
  const totalPositive = totalChange >= 0;

  const webProps = Platform.OS === 'web' ? ({ onWheel } as any) : ({} as any);
  const webViewportStyle =
    Platform.OS === 'web'
      ? ({ touchAction: 'none', cursor: 'grab', userSelect: 'none' } as any)
      : null;

  // ── Loading skeleton ──
  if (!data) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Skeleton width={120} height={14} />
          <Skeleton width={200} height={34} style={{ marginTop: 8 }} />
          <Skeleton width={150} height={14} style={{ marginTop: 8 }} />
        </View>
        <View style={styles.skeletonMap}>
          <Skeleton width={140} height={140} borderRadius={70} style={styles.skeletonBubble1} />
          <Skeleton width={100} height={100} borderRadius={50} style={styles.skeletonBubble2} />
          <Skeleton width={80} height={80} borderRadius={40} style={styles.skeletonBubble3} />
          <Skeleton width={110} height={110} borderRadius={55} style={styles.skeletonBubble4} />
          <Skeleton width={70} height={70} borderRadius={35} style={styles.skeletonBubble5} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerLabel}>
              Portfolio{isDemoMode() ? ' · Demo' : ''}
            </Text>
            <AnimatedNumber
              value={totalBalance}
              format={formatCurrencyDecimal}
              style={styles.headerAmount}
            />
            <Text style={[styles.headerChange, { color: totalPositive ? Colors.positive : Colors.negative }]}>
              {totalPositive ? '▲' : '▼'} {formatCurrency(Math.abs(totalChange))} since last update
            </Text>
          </View>
          <View style={styles.zoomControls}>
            <TouchableOpacity style={styles.zoomButton} onPress={() => zoomBy(1.25)} accessibilityLabel="Zoom in">
              <Feather name="plus" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={() => zoomBy(0.8)} accessibilityLabel="Zoom out">
              <Feather name="minus" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={fitToView} accessibilityLabel="Fit to view">
              <Feather name="maximize-2" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Map viewport */}
      <View
        style={[styles.viewport, { height: mapHeight }, webViewportStyle]}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        // @ts-ignore web-only mouse events
        onMouseDown={Platform.OS === 'web' ? onMouseDown : undefined}
        // @ts-ignore
        onMouseMove={Platform.OS === 'web' ? onMouseMove : undefined}
        // @ts-ignore
        onMouseUp={Platform.OS === 'web' ? onMouseUp : undefined}
        // @ts-ignore
        onMouseLeave={Platform.OS === 'web' ? onMouseUp : undefined}
        {...webProps}
      >
        <View style={styles.viewportCenter} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.canvas,
              {
                transform: [{ translateX }, { translateY }, { scale: scaleAnim }],
              },
              Platform.OS === 'web' ? ({ willChange: 'transform' } as any) : null,
            ]}
          >
            {nodes.map((node) => (
              <MapNode
                key={node.account.id}
                node={node}
                selected={node.account.id === selectedId}
                compact={isMobile}
                onSelect={handleSelect}
              />
            ))}
          </Animated.View>
        </View>
        {nodes.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="map" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No accounts yet</Text>
            <Text style={styles.emptyHint}>Connect Airtable in Settings to see your portfolio map</Text>
          </View>
        )}
      </View>

      {/* Detail: bottom sheet on mobile, side panel on desktop */}
      {isMobile ? (
        <BottomSheet visible={selectedNode !== null} onClose={closeDetail} maxHeightRatio={0.92}>
          {selectedNode && <DetailContent node={selectedNode} chartWidth={screenWidth - Spacing.lg * 2} />}
        </BottomSheet>
      ) : (
        selectedNode && (
          <DesktopDetailPanel node={selectedNode} onClose={closeDetail} />
        )
      )}
    </View>
  );
}

// Desktop: right-side panel with slide/fade-in and an X close affordance.
function DesktopDetailPanel({ node, onClose }: { node: MapNodeData; onClose: () => void }) {
  const slide = useRef(new Animated.Value(40)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const reduced = prefersReducedMotion();
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: reduced ? 0 : Motion.panel,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: reduced ? 0 : Motion.panel,
        useNativeDriver: true,
      }),
    ]).start();
  }, [node.account.id, slide, fade]);

  return (
    <Animated.View style={[styles.sidePanel, { opacity: fade, transform: [{ translateX: slide }] }]}>
      <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close detail">
        <Feather name="x" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
      <DetailContent node={node} chartWidth={400 - Spacing.lg * 2} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  headerAmount: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerChange: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginTop: 4,
  },
  zoomControls: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  zoomButton: {
    width: TouchTarget,
    height: TouchTarget,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewport: {
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  viewportCenter: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  canvas: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  node: {
    position: 'absolute',
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodePressable: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: BorderRadius.round,
  },
  nodeTicker: {
    color: Colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.3,
    maxWidth: '85%',
    textAlign: 'center',
  },
  nodeChange: {
    fontWeight: '600',
  },
  emptyState: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  emptyHint: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  skeletonMap: {
    flex: 1,
    position: 'relative',
  },
  skeletonBubble1: { position: 'absolute', left: '38%', top: '30%' },
  skeletonBubble2: { position: 'absolute', left: '15%', top: '20%' },
  skeletonBubble3: { position: 'absolute', left: '70%', top: '25%' },
  skeletonBubble4: { position: 'absolute', left: '22%', top: '58%' },
  skeletonBubble5: { position: 'absolute', left: '62%', top: '62%' },
  sidePanel: {
    position: 'absolute',
    right: Spacing.lg,
    top: Spacing.lg,
    bottom: Spacing.lg,
    width: 400,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.sm,
    top: Spacing.sm,
    width: TouchTarget,
    height: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  detailScroll: {
    flex: 1,
  },
  detailContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  detailType: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '800',
    marginTop: 2,
  },
  detailBalance: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: Spacing.sm,
  },
  detailChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  detailChangeText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  detailChangeLabel: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
  },
  detailChartWrap: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  detailChartEmpty: {
    height: 120,
    justifyContent: 'center',
  },
  detailEmptyText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  rangeButton: {
    minWidth: TouchTarget,
    height: 36,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeButtonActive: {
    backgroundColor: Colors.accentDim,
  },
  rangeText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  rangeTextActive: {
    color: Colors.accent,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  statCell: {
    minWidth: 130,
    flexGrow: 1,
    backgroundColor: Colors.cardBackgroundLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  statLabel: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginTop: 4,
  },
});
