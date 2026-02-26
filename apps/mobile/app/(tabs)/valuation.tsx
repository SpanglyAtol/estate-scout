import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getValuation } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

let counter = 0;

const EXAMPLES = [
  'Haviland Limoges plate, pink roses',
  'Imari bowl 8 inch blue and red',
  'Royal Doulton figurine excellent condition',
];

export default function ValuationScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const autoSentRef = useRef(false);

  // Auto-send when navigated here with ?q= param (e.g. from listing detail)
  useEffect(() => {
    if (q && !autoSentRef.current && messages.length === 0) {
      autoSentRef.current = true;
      sendMessage(q);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function sendMessage(text?: string) {
    const txt = (text ?? input).trim();
    if (!txt || loading) return;
    setInput('');

    const userMsg: Message = { id: String(++counter), role: 'user', content: txt };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    try {
      const result = await getValuation(txt);
      const assistantMsg: Message = {
        id: String(++counter),
        role: 'assistant',
        content: result.narrative ?? 'No results found.',
      };
      setMessages((m) => [...m, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not connect to backend.';
      setMessages((m) => [
        ...m,
        { id: String(++counter), role: 'assistant', content: msg },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Price Check</Text>
        <Text style={styles.headerSub}>Describe an item to see comparable sales</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={{ padding: 16, gap: 10 }}
      >
        {messages.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏺</Text>
            <Text style={styles.emptyTitle}>What do you want to value?</Text>
            <View style={{ width: '100%', gap: 8, marginTop: 12 }}>
              {EXAMPLES.map((ex) => (
                <Pressable key={ex} style={styles.exampleBtn} onPress={() => sendMessage(ex)}>
                  <Text style={styles.exampleText}>{ex}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.bubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text style={[styles.bubbleText, msg.role === 'user' ? styles.userText : styles.assistantText]}>
              {msg.content}
            </Text>
          </View>
        ))}
        {loading && (
          <View style={[styles.assistantBubble, styles.bubble]}>
            <ActivityIndicator size="small" color="#6b7280" />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Describe the item..."
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
          editable={!loading}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#2563eb', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 13, color: '#bfdbfe', marginTop: 2 },
  messages: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 8 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
  exampleBtn: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  exampleText: { fontSize: 13, color: '#374151' },
  bubble: { maxWidth: '85%', borderRadius: 18, padding: 12, paddingHorizontal: 16 },
  userBubble: { backgroundColor: '#2563eb', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: {
    backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#e5e7eb', minWidth: 48, alignItems: 'center',
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#fff' },
  assistantText: { color: '#111827' },
  inputRow: {
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, backgroundColor: '#f9fafb',
  },
  sendBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#93c5fd' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
