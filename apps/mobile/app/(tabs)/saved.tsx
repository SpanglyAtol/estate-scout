import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  FlatList, ActivityIndicator, Alert, RefreshControl, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  getSavedSearches, createSavedSearch, deleteSavedSearch,
  getAlerts, createAlert, toggleAlert, deleteAlert,
  logout,
  type SavedSearch, type AlertItem,
} from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';

// ── Unauthenticated splash ────────────────────────────────────────────────────

function AuthPrompt() {
  const router = useRouter();
  return (
    <View style={styles.authPrompt}>
      <Text style={styles.authIcon}>🔔</Text>
      <Text style={styles.authTitle}>Saved Searches & Alerts</Text>
      <Text style={styles.authSubtitle}>
        Save searches and get notified the moment a matching item appears across all platforms.
      </Text>
      <Pressable
        style={styles.primaryBtn}
        onPress={() => router.push('/auth' as never)}
      >
        <Text style={styles.primaryBtnText}>Sign Up Free</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryBtn}
        onPress={() => router.push('/auth' as never)}
      >
        <Text style={styles.secondaryBtnText}>Already have an account? Sign In</Text>
      </Pressable>
    </View>
  );
}

// ── Saved Searches section ────────────────────────────────────────────────────

interface SavedSearchesSectionProps {
  onRun: (query: string) => void;
}

function SavedSearchesSection({ onRun }: SavedSearchesSectionProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await getSavedSearches();
      setSearches(data);
    } catch {
      // silent — handled by parent refresh
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createSavedSearch({ name: newName, query_text: newQuery || undefined });
      setNewName(''); setNewQuery(''); setShowForm(false);
      await load();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save search.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    Alert.alert('Delete Search', 'Remove this saved search?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteSavedSearch(id);
            setSearches((s) => s.filter((x) => x.id !== id));
          } catch { /* ignore */ }
        },
      },
    ]);
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🔖 Saved Searches</Text>
        <Pressable onPress={() => setShowForm((s) => !s)}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ New'}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <TextInput
            style={styles.formInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Search name (e.g. Imari plates)"
          />
          <TextInput
            style={styles.formInput}
            value={newQuery}
            onChangeText={setNewQuery}
            placeholder="Search query (optional)"
          />
          <Pressable
            style={[styles.formBtn, saving && styles.formBtnDisabled]}
            onPress={handleCreate}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.formBtnText}>Save</Text>
            }
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 20 }} color="#2563eb" />
      ) : searches.length === 0 ? (
        <Text style={styles.emptyText}>No saved searches yet.</Text>
      ) : (
        searches.map((s) => (
          <View key={s.id} style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle} numberOfLines={1}>{s.name}</Text>
              {s.query_text ? (
                <Text style={styles.rowSub} numberOfLines={1}>&ldquo;{s.query_text}&rdquo;</Text>
              ) : null}
            </View>
            <Pressable
              style={styles.runBtn}
              onPress={() => onRun(s.query_text ?? s.name)}
            >
              <Text style={styles.runBtnText}>Run</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(s.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

// ── Alerts section ────────────────────────────────────────────────────────────

function AlertsSection() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [newMaxPrice, setNewMaxPrice] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createAlert({
        name: newName,
        query_text: newQuery || undefined,
        max_price: newMaxPrice ? Number(newMaxPrice) : undefined,
        notify_email: true,
      });
      setNewName(''); setNewQuery(''); setNewMaxPrice(''); setShowForm(false);
      await load();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not create alert.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: number) {
    try {
      await toggleAlert(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !a.is_active } : a))
      );
    } catch { /* ignore */ }
  }

  async function handleDelete(id: number) {
    Alert.alert('Delete Alert', 'Remove this alert?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteAlert(id);
            setAlerts((a) => a.filter((x) => x.id !== id));
          } catch { /* ignore */ }
        },
      },
    ]);
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🔔 Price Alerts</Text>
        <Pressable onPress={() => setShowForm((s) => !s)}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ New Alert'}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <TextInput
            style={styles.formInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Alert name"
          />
          <TextInput
            style={styles.formInput}
            value={newQuery}
            onChangeText={setNewQuery}
            placeholder="Keywords to watch"
          />
          <TextInput
            style={styles.formInput}
            value={newMaxPrice}
            onChangeText={setNewMaxPrice}
            placeholder="Max price (optional)"
            keyboardType="numeric"
          />
          <Text style={styles.formHint}>You&apos;ll get an email when matching listings appear.</Text>
          <Pressable
            style={[styles.formBtn, saving && styles.formBtnDisabled]}
            onPress={handleCreate}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.formBtnText}>Create Alert</Text>
            }
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 20 }} color="#2563eb" />
      ) : alerts.length === 0 ? (
        <Text style={styles.emptyText}>No alerts yet. Create one to watch for listings.</Text>
      ) : (
        alerts.map((a) => (
          <View key={a.id} style={styles.alertRow}>
            <Switch
              value={a.is_active}
              onValueChange={() => handleToggle(a.id)}
              trackColor={{ false: '#d1d5db', true: '#86efac' }}
              thumbColor={a.is_active ? '#16a34a' : '#9ca3af'}
            />
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle} numberOfLines={1}>{a.name}</Text>
              <View style={styles.alertMeta}>
                {a.query_text ? (
                  <Text style={styles.alertMetaText}>&ldquo;{a.query_text}&rdquo;</Text>
                ) : null}
                {a.max_price != null ? (
                  <Text style={styles.alertMetaText}>· max ${a.max_price}</Text>
                ) : null}
                {a.trigger_count > 0 ? (
                  <Text style={[styles.alertMetaText, styles.alertMatchText]}>
                    · {a.trigger_count} matches
                  </Text>
                ) : null}
              </View>
            </View>
            <Pressable onPress={() => handleDelete(a.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SavedScreen() {
  const router = useRouter();
  const { user, loading, logout: doLogout, refetch } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Re-check auth each time tab is focused (e.g. after signing in)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await doLogout();
        },
      },
    ]);
  }

  function handleRunSearch(query: string) {
    router.push(`/search?q=${encodeURIComponent(query)}` as never);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved & Alerts</Text>
        {user && (
          <Pressable onPress={handleLogout}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : !user ? (
        <AuthPrompt />
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListHeaderComponent={
            <>
              <View style={styles.userBanner}>
                <Text style={styles.userEmail}>{user.email}</Text>
                <View style={styles.tierBadge}>
                  <Text style={styles.tierBadgeText}>{user.tier}</Text>
                </View>
              </View>
              <SavedSearchesSection onRun={handleRunSearch} />
              <AlertsSection />
              <View style={{ height: 40 }} />
            </>
          }
          ListEmptyComponent={null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  header: {
    backgroundColor: '#2563eb',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  signOutText: { fontSize: 13, color: '#bfdbfe', paddingBottom: 2 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Auth prompt
  authPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  authIcon: { fontSize: 64 },
  authTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
  authSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
  primaryBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: { alignItems: 'center', paddingVertical: 8 },
  secondaryBtnText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },

  // User banner
  userBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  userEmail: { flex: 1, fontSize: 13, color: '#374151' },
  tierBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tierBadgeText: { fontSize: 11, color: '#1d4ed8', fontWeight: '700', textTransform: 'capitalize' },

  // Sections
  section: {
    margin: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  addLink: { fontSize: 14, color: '#2563eb', fontWeight: '600' },

  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 20, paddingHorizontal: 16 },

  // Form
  formCard: {
    padding: 12,
    gap: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  formInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  formHint: { fontSize: 11, color: '#9ca3af' },
  formBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  formBtnDisabled: { opacity: 0.6 },
  formBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowContent: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  alertMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  alertMetaText: { fontSize: 11, color: '#6b7280' },
  alertMatchText: { color: '#16a34a', fontWeight: '600' },

  runBtn: {
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  runBtnText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },

  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 12, color: '#dc2626', fontWeight: '700' },
});
