import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { AppData } from '../types';
import { loadAppData, syncWithAirtable, loadAirtableConfig } from '../storage';
import { ChatMessage, SendResult, sendChatMessage } from '../services/gemini';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_KEY_STORAGE = '@sofi_gemini_key';
const CHAT_HISTORY_KEY = '@sofi_chat_history';

const SUGGESTIONS = [
  'How is my portfolio doing?',
  'Am I on track for retirement?',
  'Create a goal to max out my 401k',
  'How should I allocate my savings?',
  'What should I prioritize next?',
  'Create a retirement plan for age 55',
];

export default function GuidanceScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const contentMaxWidth = 720;
  const contentWidth = Math.min(screenWidth, contentMaxWidth);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Load data + API key + history
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const config = await loadAirtableConfig();
        let data: AppData;
        if (config && config.pat && config.baseId) {
          try { data = await syncWithAirtable(); } catch { data = await loadAppData(); }
        } else {
          data = await loadAppData();
        }
        setAppData(data);

        const storedKey = await AsyncStorage.getItem(GEMINI_KEY_STORAGE);
        const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
        setGeminiKey(storedKey || envKey);

        const storedHistory = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
        if (storedHistory) {
          try { setMessages(JSON.parse(storedHistory)); } catch { /* ignore */ }
        }
      })();
    }, [])
  );

  // Persist history
  useEffect(() => {
    if (messages.length > 0) {
      AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-50)));
    }
  }, [messages]);

  const scrollToEnd = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading || !appData) return;

    if (!geminiKey) {
      setShowKeyInput(true);
      return;
    }

    const userMsg: ChatMessage = { role: 'user', text: msg, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    scrollToEnd();

    try {
      const result: SendResult = await sendChatMessage(msg, messages, appData, geminiKey);
      const modelMsg: ChatMessage = {
        role: 'model',
        text: result.text,
        timestamp: Date.now(),
        action: result.action,
      };
      setMessages(prev => [...prev, modelMsg]);

      // Refresh app data if an action was taken (goal/scenario created)
      if (result.action) {
        const freshData = await loadAppData();
        setAppData(freshData);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong';
      setMessages(prev => [...prev, {
        role: 'model',
        text: `⚠️ ${errMsg}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  };

  const handleSaveKey = async () => {
    const k = keyInput.trim();
    if (!k) return;
    await AsyncStorage.setItem(GEMINI_KEY_STORAGE, k);
    setGeminiKey(k);
    setShowKeyInput(false);
    setKeyInput('');
  };

  const handleClearChat = () => {
    setMessages([]);
    AsyncStorage.removeItem(CHAT_HISTORY_KEY);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubbleRow, isUser ? styles.userRow : styles.modelRow]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <Feather name="cpu" size={16} color={Colors.accent} />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.modelBubble,
          { maxWidth: contentWidth * 0.78 },
        ]}>
          {item.action && (
            <View style={styles.actionBadge}>
              <Feather name="check-circle" size={12} color={Colors.accent} />
              <Text style={styles.actionText}>{item.action}</Text>
            </View>
          )}
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {item.text}
          </Text>
          <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="message-circle" size={48} color={Colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>Investor Guidance</Text>
      <Text style={styles.emptySubtitle}>
        Ask me anything about your portfolio, goals, or retirement planning. I can also create goals and forecasts for you.
      </Text>
      <View style={styles.suggestionsContainer}>
        {SUGGESTIONS.map((s, i) => (
          <TouchableOpacity
            key={i}
            style={styles.suggestionChip}
            onPress={() => handleSend(s)}
          >
            <Text style={styles.suggestionText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // API key setup modal
  if (showKeyInput) {
    return (
      <View style={styles.container}>
        <View style={[styles.keyModal, { width: contentWidth - 40 }]}>
          <Feather name="key" size={32} color={Colors.accent} style={{ marginBottom: Spacing.md }} />
          <Text style={styles.keyTitle}>Gemini API Key</Text>
          <Text style={styles.keySubtitle}>
            Enter your Google Gemini API key to enable the AI advisor.{'\n'}
            Get one free at aistudio.google.com/apikey
          </Text>
          <TextInput
            style={styles.keyInput}
            value={keyInput}
            onChangeText={setKeyInput}
            placeholder="Paste your API key..."
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.keyButtons}>
            <TouchableOpacity style={styles.keyCancelBtn} onPress={() => setShowKeyInput(false)}>
              <Text style={styles.keyCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keySaveBtn} onPress={handleSaveKey}>
              <Text style={styles.keySaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Feather name="cpu" size={18} color={Colors.accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Investor Guidance</Text>
            <Text style={styles.headerSubtitle}>Powered by Gemini</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {!geminiKey && (
            <TouchableOpacity onPress={() => setShowKeyInput(true)} style={styles.headerBtn}>
              <Feather name="key" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
          {messages.length > 0 && (
            <TouchableOpacity onPress={handleClearChat} style={styles.headerBtn}>
              <Feather name="trash-2" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={[
          styles.messagesList,
          messages.length === 0 && styles.messagesListEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
        onContentSizeChange={scrollToEnd}
      />

      {loading && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.typingText}>Thinking...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <View style={[styles.inputWrapper, { maxWidth: contentMaxWidth }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your portfolio..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={1000}
            onSubmitEditing={() => handleSend()}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            <Feather name="send" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
  },
  headerRight: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerBtn: {
    padding: Spacing.sm,
  },
  messagesList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  messagesListEmpty: {
    flex: 1,
  },
  messageBubbleRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  modelRow: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
    marginBottom: 2,
  },
  messageBubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
  },
  userBubble: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: 4,
  },
  modelBubble: {
    backgroundColor: Colors.cardBackgroundLight,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  userMessageText: {
    color: Colors.white,
  },
  timestamp: {
    fontSize: FontSizes.xs - 1,
    color: Colors.textTertiary,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTimestamp: {
    color: 'rgba(255,255,255,0.65)',
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentDim,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.accent,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  typingText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  inputContainer: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    width: '100%',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    maxWidth: 500,
  },
  suggestionChip: {
    backgroundColor: Colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  suggestionText: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  keyModal: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  keyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  keySubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  keyInput: {
    width: '100%',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  keyButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  keyCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
  },
  keyCancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  keySaveBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  keySaveText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.white,
  },
});
