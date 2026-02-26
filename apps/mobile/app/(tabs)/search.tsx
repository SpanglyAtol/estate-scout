import React, { useState } from 'react';
import {
  View, Text, TextInput, FlatList, Image,
  Pressable, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { searchListings, type Listing } from '@/lib/api';

const CATEGORIES = ['ceramics','furniture','jewelry','art','silver','glass','collectibles'];

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [pickupOnly, setPickupOnly] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!query.trim() && !category) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchListings({
        q: query.trim() || undefined,
        category: category || undefined,
        pickup_only: pickupOnly || undefined,
        page_size: 48,
      });
      setListings(data);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search antiques, ceramics..."
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <Pressable style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      {/* Category pills */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' }}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setCategory(category === cat ? '' : cat)}
              style={[styles.pill, category === cat && styles.pillActive]}
            >
              <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Pickup only toggle */}
        <Pressable
          onPress={() => setPickupOnly((p) => !p)}
          style={styles.pickupRow}
        >
          <View style={[styles.checkbox, pickupOnly && styles.checkboxActive]}>
            {pickupOnly && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>}
          </View>
          <Text style={styles.pickupLabel}>Pickup only</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/listing/${item.id}` as never)}
            >
              <View style={{ aspectRatio: 1, backgroundColor: '#f3f4f6' }}>
                {item.primary_image_url ? (
                  <Image source={{ uri: item.primary_image_url }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text style={{ fontSize: 40, textAlign: 'center', lineHeight: 120 }}>🏺</Text>
                )}
              </View>
              <View style={{ padding: 8 }}>
                <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: '600', color: '#111' }}>{item.title}</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#2563eb', marginTop: 2 }}>
                  {item.current_price ? '$' + Math.round(item.current_price) : 'No bids'}
                </Text>
                {item.buyers_premium_pct ? (
                  <Text style={{ fontSize: 10, color: '#6b7280' }}>+{item.buyers_premium_pct}% BP</Text>
                ) : null}
                <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{item.platform.display_name}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searched ? 'No results — try different keywords or filters.' : 'Search across all platforms at once.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  searchBar: {
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingTop: 56,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, backgroundColor: '#f9fafb',
  },
  searchBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff',
  },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { fontSize: 12, color: '#374151', textTransform: 'capitalize' },
  pillTextActive: { color: '#fff' },
  pickupRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pickupLabel: { fontSize: 13, color: '#374151' },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4,
  },
  empty: { textAlign: 'center', marginTop: 60, color: '#9ca3af', fontSize: 15, paddingHorizontal: 32 },
});
