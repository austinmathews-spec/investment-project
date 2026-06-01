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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, FontSizes, BorderRadius } from '../theme';
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
      style={styles.container}
      contentContainerStyle={[styles.content, { alignItems: 'center' }]}
    >
      <View style={styles.contentInner}>
      {isDemoMode() && (
        <View style={styles.demoBanner}>
          <Feather name="play-circle" size={20} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.demoBannerTitle}>Demo Mode</Text>
            <Text style={styles.demoBannerText}>
              You're viewing sample data. Log out and use your password for live Airtable data.
            </Text>
          </View>
        </View>
      )}
      <Text style={styles.title}>Airtable Connection</Text>
      <Text style={styles.subtitle}>
        Connect to your Airtable base to sync accounts, snapshots, and expenses.
      </Text>

      <Card>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? Colors.positive : Colors.textTertiary },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'Connected' : 'Not Connected'}
          </Text>
        </View>
        {lastSync && (
          <Text style={styles.lastSync}>Last synced: {lastSync}</Text>
        )}
        {syncError && (
          <Text style={styles.errorText}>{syncError}</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.label}>Personal Access Token</Text>
        <TextInput
          style={styles.input}
          value={pat}
          onChangeText={setPat}
          placeholder="pat..."
          placeholderTextColor={Colors.textTertiary}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.label, { marginTop: Spacing.md }]}>Base ID</Text>
        <TextInput
          style={styles.input}
          value={baseId}
          onChangeText={setBaseId}
          placeholder="appXXXXXXXXXXX"
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.hint}>
          Create a PAT at airtable.com/create/tokens with data.records:read,
          data.records:write, and schema.bases:read scopes.
        </Text>
      </Card>

      {isSyncing ? (
        <View style={styles.syncingRow}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.syncingText}>Syncing with Airtable...</Text>
        </View>
      ) : isConnected ? (
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={handleDisconnect}
          >
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
          <Text style={styles.connectButtonText}>Connect & Sync</Text>
        </TouchableOpacity>
      )}

      <Card>
        <Text style={styles.infoTitle}>What syncs from Airtable</Text>
        <Text style={styles.infoItem}>
          • Saving & Investment → Your account balances
        </Text>

        <Text style={styles.infoItem}>
          • Debt → Liabilities (student loans, etc.)
        </Text>
        <Text style={styles.infoItem}>
          • Calculation Hub → Net worth history & trends
        </Text>
        <Text style={styles.infoItem}>
          • Recurring Expenses → Monthly expense tracking
        </Text>
        <Text style={[styles.infoItem, { marginTop: Spacing.sm }]}>
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
    backgroundColor: Colors.background,
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
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
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
    color: Colors.textPrimary,
  },
  lastSync: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: FontSizes.sm,
    color: Colors.negative,
    marginTop: Spacing.xs,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hint: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  connectButton: {
    backgroundColor: Colors.accent,
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
    backgroundColor: Colors.accent,
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
    borderColor: Colors.negative,
  },
  disconnectButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.negative,
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
    color: Colors.accent,
  },
  infoTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  infoItem: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentDim,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  demoBannerTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.accent,
  },
  demoBannerText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
