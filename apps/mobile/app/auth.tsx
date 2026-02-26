/**
 * Mobile auth screen — Sign In / Sign Up.
 *
 * Accessed via router.push('/auth') from anywhere in the app.
 * After successful auth, goes back one screen (or to the tab root if no back history).
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, displayName.trim() || undefined);
      }
      // Success — go back or to home
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🏺</Text>
          <Text style={styles.appName}>Estate Scout</Text>
          <Text style={styles.tagline}>Save searches, set price alerts</Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
            onPress={() => { setMode('signin'); setError(null); }}
          >
            <Text style={[styles.modeBtnText, mode === 'signin' && styles.modeBtnTextActive]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
            onPress={() => { setMode('signup'); setError(null); }}
          >
            <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>
              Sign Up
            </Text>
          </Pressable>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'signup' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Display name (optional)</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                autoCapitalize="words"
                autoComplete="name"
                editable={!loading}
              />
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Your password'}
                secureTextEntry={!showPassword}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                editable={!loading}
              />
              <Pressable
                style={styles.showBtn}
                onPress={() => setShowPassword((s) => !s)}
              >
                <Text style={styles.showBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.submitBtnText}>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
            }
          </Pressable>

          {/* Switch mode link */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}>
              <Text style={styles.switchLink}>
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 32 },
  logo: { fontSize: 56, marginBottom: 8 },
  appName: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  tagline: { fontSize: 14, color: '#6b7280', marginTop: 4 },

  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
  },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  modeBtnTextActive: { color: '#111827' },

  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  passwordRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  passwordInput: { flex: 1 },
  showBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
  },
  showBtnText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },

  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 12,
  },
  errorText: { fontSize: 13, color: '#dc2626', lineHeight: 18 },

  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  switchText: { fontSize: 14, color: '#6b7280' },
  switchLink: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
});
