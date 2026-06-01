import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, FontSizes, BorderRadius, useTheme } from '../theme';
import Card from '../components/Card';
import {
  loadAirtableConfig,
  saveAirtableConfig,
  clearAirtableConfig,
  syncWithAirtable,
  resetAppData,
  isDemoMode,
} from '../storage';
import { AirtableConfig } from '../types';
import { Feather } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { colors, mode, toggle } = useTheme();
  const [pat, setPat] = useState('');
  const [baseId, setBaseId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadConfig();
    }, [])
  );

  async function loadConfig() {
    const config = await loadAirtableConfig();
    if (config) {
      setPat(config.pat);
      setBaseId(config.baseId);
      setIsConnected(true);
    }
  }

  async function handleConnect() {
    if (!pat.trim() || !baseId.trim()) {
      const msg = 'Please enter both your PAT and Base ID.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Missing Fields', msg);
      }
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const config: AirtableConfig = { pat: pat.trim(), baseId: baseId.trim() };
      await saveAirtableConfig(config);
      await syncWithAirtable();
      setIsConnected(true);
      setLastSync(new Date().toLocaleString());
      setSyncError(null);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to connect to Airtable';
      setSyncError(errorMsg);
      setIsConnected(false);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setSyncError(null);
    try {
      await syncWithAirtable();
      setLastSync(new Date().toLocaleString());
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Sync failed';
      setSyncError(errorMsg);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDisconnect() {
    const doDisconnect = async () => {
      await clearAirtableConfig();
      await resetAppData();
      setPat('');
      setBaseId('');
      setIsConnected(false);
      setLastSync(null);
      setSyncError(null);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Disconnect from Airtable and clear cached data?')) {
        await doDisconnect();
      }
    } else {
      Alert.alert(
        'Disconnect',
        'Disconnect from Airtable and clear cached data?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', style: 'destructive', onPress: doDisconnect },
        ]
      );
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { alignItems: 'center' }]}
    >
      <View style={styles.contentInner}>
      {isDemoMode() && (
        <View style={[styles.demoBanner, { backgroundColor: colors.accentDim }]}>
          <Feather name="play-circle" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.demoBannerTitle, { color: colors.accent }]}>Demo Mode</Text>
            <Text style={[styles.demoBannerText, { color: colors.textSecondary }]}>
              You're viewing sample data. Log out and use your password for live Airtable data.
            </Text>
          </View>
        </View>
      )}

      {/* Dark Mode Toggle */}
      <View style={[styles.themeCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.themeRow}>
          <View style={styles.themeLeft}>
            <Feather name={mode === 'dark' ? 'moon' : 'sun'} size={20} color={colors.accent} />
            <View>
              <Text style={[styles.themeTitle, { color: colors.textPrimary }]}>Dark Mode</Text>
              <Text style={[styles.themeSubtitle, { color: colors.textTertiary }]}>{mode === 'dark' ? 'On' : 'Off'}</Text>
            </View>
          </View>
          <Switch
            value={mode === 'dark'}
            onValueChange={toggle}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>Airtable Connection</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Connect to your Airtable base to sync accounts, snapshots, and expenses.
      </Text>

      <Card>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? colors.positive : colors.textTertiary },
            ]}
          />
          <Text style={[styles.statusText, { color: colors.textPrimary }]}>
            {isConnected ? 'Connected' : 'Not Connected'}
          </Text>
        </View>
        {lastSync && (
          <Text style={[styles.lastSync, { color: colors.textSecondary }]}>Last synced: {lastSync}</Text>
        )}
        {syncError && (
          <Text style={[styles.errorText, { color: colors.negative }]}>{syncError}</Text>
        )}
      </Card>

      <Card>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Personal Access Token</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary }]}
          value={pat}
          onChangeText={setPat}
          placeholder="pat..."
          placeholderTextColor={colors.textTertiary}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.label, { marginTop: Spacing.md, color: colors.textSecondary }]}>Base ID</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary }]}
          value={baseId}
          onChangeText={setBaseId}
          placeholder="appXXXXXXXXXXX"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Create a PAT at airtable.com/create/tokens with data.records:read,
          data.records:write, and schema.bases:read scopes.
        </Text>
      </Card>

      {isSyncing ? (
        <View style={styles.syncingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.syncingText, { color: colors.accent }]}>Syncing with Airtable...</Text>
        </View>
      ) : isConnected ? (
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={[styles.syncButton, { backgroundColor: colors.accent }]} onPress={handleSync}>
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.disconnectButton, { borderColor: colors.negative }]}
            onPress={handleDisconnect}
          >
            <Text style={[styles.disconnectButtonText, { color: colors.negative }]}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[styles.connectButton, { backgroundColor: colors.accent }]} onPress={handleConnect}>
          <Text style={styles.connectButtonText}>Connect & Sync</Text>
        </TouchableOpacity>
      )}

      <Card>
        <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>What syncs from Airtable</Text>
        <Text style={[styles.infoItem, { color: colors.textSecondary }]}>
          • Saving & Investment → Your account balances
        </Text>
        <Text style={[styles.infoItem, { color: colors.textSecondary }]}>
          • Debt → Liabilities (student loans, etc.)
        </Text>
        <Text style={[styles.infoItem, { color: colors.textSecondary }]}>
          • Calculation Hub → Net worth history & trends
        </Text>
        <Text style={[styles.infoItem, { color: colors.textSecondary }]}>
          • Recurring Expenses → Monthly expense tracking
        </Text>
        <Text style={[styles.infoItem, { marginTop: Spacing.sm, color: colors.textSecondary }]}>
          Goals, retirement scenarios, and forecasts are stored locally.
        </Text>
      </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  contentInner: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  themeCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  themeTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  themeSubtitle: {
    fontSize: FontSizes.xs,
    marginTop: 1,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.md,
    marginBottom: Spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  lastSync: {
    fontSize: FontSizes.sm,
  },
  errorText: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  input: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    borderWidth: 1,
  },
  hint: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.sm,
  },
  connectButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  connectButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonGroup: {
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  syncButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  syncButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disconnectButton: {
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  disconnectButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  syncingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  syncingText: {
    fontSize: FontSizes.md,
  },
  infoTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  infoItem: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  demoBannerTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  demoBannerText: {
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
});
