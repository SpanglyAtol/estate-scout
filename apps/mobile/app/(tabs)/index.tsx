import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getListings, type Listing } from '@/lib/api';

function formatPrice(price: number | null): string {
  if (price === null) return 'No bids';
  return '$' + Math.round(price).toLocaleString();
}

function hoursUntil(iso: string | null): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 48) return Math.floor(hours / 24) + 'd left';
  return hours + 'h left';
}

export default function HomeScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadListings(1);
  }, []);

  async function loadListings(p: number) {
    try {
      const data = await getListings(p, 24);
      if (p === 1) {
        setListings(data);
      } else {
        setListings((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === 24);
      setPage(p);
    } catch {
      // silently fail — backend may not be running yet
    } finally {
      setLoading(false);
    }
  }

  function renderItem({ item }: { item: Listing }) {
    const countdown = hoursUntil(item.sale_ends_at);
    const isEndingSoon =
      item.sale_ends_at &&
      new Date(item.sale_ends_at).getTime() - Date.now() < 24 * 3_600_000;

    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/listing/${item.id}` as never)}
      >
        <View style={styles.imageContainer}>
          {item.primary_image_url ? (
            <Image source={{ uri: item.primary_image_url }} style={styles.image} />
          ) : (
            <Text style={styles.imagePlaceholder}>🏺</Text>
          )}
          {isEndingSoon && countdown && (
            <View style={styles.endingSoonBadge}>
              <Text style={styles.endingSoonText}>{countdown}</Text>
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.price}>{formatPrice(item.current_price)}</Text>
          {item.buyers_premium_pct ? (
            <Text style={styles.premium}>+{item.buyers_premium_pct}% BP</Text>
          ) : null}
          <Text style={styles.platform}>{item.platform.display_name}</Text>
          {item.city ? (
            <Text style={styles.location}>📍 {item.city}, {item.state}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Estate Scout</Text>
        <Text style={styles.headerSubtitle}>Find it before anyone else</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          onEndReached={() => { if (hasMore && !loading) loadListings(page + 1); }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>No listings yet</Text>
              <Text style={styles.emptySubtext}>Run a scraper to populate data</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#2563eb',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#bfdbfe', marginTop: 4 },
  list: { padding: 12 },
  row: { gap: 10 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: { position: 'relative', aspectRatio: 1, backgroundColor: '#f3f4f6' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { fontSize: 48, textAlign: 'center', lineHeight: 130, color: '#d1d5db' },
  endingSoonBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#ef4444',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  endingSoonText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  info: { padding: 10 },
  title: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 4, lineHeight: 18 },
  price: { fontSize: 18, fontWeight: '800', color: '#2563eb' },
  premium: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  platform: {
    fontSize: 11, color: '#fff', backgroundColor: '#3b82f6',
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, marginTop: 6, overflow: 'hidden',
  },
  location: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptySubtext: { fontSize: 14, color: '#9ca3af', marginTop: 8 },
});
