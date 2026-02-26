import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Linking, FlatList, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getListing, type Listing } from '@/lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeUntil(iso: string | null): { label: string; urgent: boolean } | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: 'Ended', urgent: false };
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return { label: `${Math.floor(ms / 60000)}m left`, urgent: true };
  if (hours < 24) return { label: `${hours}h left`, urgent: true };
  return { label: `${Math.floor(hours / 24)}d left`, urgent: false };
}

function ImageGallery({ urls, primaryUrl }: { urls: string[]; primaryUrl: string | null }) {
  const allImages = [
    ...(primaryUrl ? [primaryUrl] : []),
    ...urls.filter((u) => u !== primaryUrl),
  ];
  if (allImages.length === 0) {
    return (
      <View style={styles.imagePlaceholderContainer}>
        <Text style={styles.imagePlaceholderText}>🏺</Text>
      </View>
    );
  }
  if (allImages.length === 1) {
    return (
      <View style={styles.singleImageContainer}>
        <Image source={{ uri: allImages[0] }} style={styles.singleImage} resizeMode="contain" />
      </View>
    );
  }
  return (
    <View>
      <FlatList
        data={allImages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, i) => `${i}-${item}`}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}>
            <Image source={{ uri: item }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </View>
        )}
      />
      <Text style={styles.imageCount}>{allImages.length} photos</Text>
    </View>
  );
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getListing(Number(id))
      .then(setListing)
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Listing not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const countdown = timeUntil(listing.sale_ends_at);
  const totalCost = listing.total_cost_estimate ?? (
    listing.current_price && listing.buyers_premium_pct
      ? listing.current_price * (1 + listing.buyers_premium_pct / 100)
      : null
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <ImageGallery urls={listing.image_urls} primaryUrl={listing.primary_image_url} />

      <View style={styles.content}>
        {/* Platform + countdown */}
        <View style={styles.topRow}>
          <View style={styles.platformBadge}>
            <Text style={styles.platformBadgeText}>{listing.platform.display_name}</Text>
          </View>
          {countdown && (
            <View style={[styles.countdownBadge, countdown.urgent && styles.countdownUrgent]}>
              <Text style={[styles.countdownText, countdown.urgent && styles.countdownTextUrgent]}>
                ⏱ {countdown.label}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>{listing.title}</Text>

        {/* Pricing card */}
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Current bid</Text>
            <Text style={styles.priceValue}>
              {listing.current_price ? '$' + Math.round(listing.current_price).toLocaleString() : 'No bids'}
            </Text>
          </View>
          {listing.buyers_premium_pct != null && (
            <>
              <View style={styles.priceDivider} />
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Buyer&apos;s premium</Text>
                <Text style={styles.premiumValue}>+{listing.buyers_premium_pct}%</Text>
              </View>
              <View style={styles.priceDivider} />
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { fontWeight: '700' }]}>Est. total cost</Text>
                <Text style={[styles.priceValue, styles.totalValue]}>
                  {totalCost ? '$' + Math.round(totalCost).toLocaleString() : '—'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Primary CTA */}
        <Pressable
          style={styles.bidBtn}
          onPress={() => Linking.openURL(listing.external_url)}
        >
          <Text style={styles.bidBtnText}>Bid on {listing.platform.display_name} ↗</Text>
        </Pressable>

        {/* AI Price Check shortcut */}
        <Pressable
          style={styles.valuationBtn}
          onPress={() =>
            router.push(`/(tabs)/valuation?q=${encodeURIComponent(listing.title)}` as never)
          }
        >
          <Text style={styles.valuationBtnText}>🤖 AI Price Check for this item</Text>
        </Pressable>

        {/* Meta info */}
        <View style={styles.metaCard}>
          {(listing.city || listing.state) && (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>📍</Text>
              <Text style={styles.metaText}>{[listing.city, listing.state].filter(Boolean).join(', ')}</Text>
            </View>
          )}
          {listing.pickup_only && (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>🚛</Text>
              <Text style={styles.metaText}>Pickup only</Text>
            </View>
          )}
          {listing.ships_nationally && (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>📦</Text>
              <Text style={styles.metaText}>Ships nationally</Text>
            </View>
          )}
          {listing.sale_ends_at && (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>🔔</Text>
              <Text style={styles.metaText}>Ends {formatDate(listing.sale_ends_at)}</Text>
            </View>
          )}
          {listing.sale_starts_at && (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>📅</Text>
              <Text style={styles.metaText}>Starts {formatDate(listing.sale_starts_at)}</Text>
            </View>
          )}
          {listing.category && (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>🏷</Text>
              <Text style={styles.metaText}>{listing.category}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {listing.description && (
          <View style={styles.descCard}>
            <Text style={styles.descLabel}>Description</Text>
            <Text style={styles.descText}>{listing.description}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 18, color: '#374151' },
  backLink: { color: '#2563eb', marginTop: 12, fontSize: 15 },

  singleImageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#f3f4f6' },
  singleImage: { width: '100%', height: '100%' },
  imagePlaceholderContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { fontSize: 80 },
  imageCount: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff',
    fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },

  content: { padding: 20, gap: 14 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  platformBadge: { backgroundColor: '#dbeafe', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  platformBadgeText: { color: '#1d4ed8', fontSize: 12, fontWeight: '600' },
  countdownBadge: { backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  countdownUrgent: { backgroundColor: '#fef2f2' },
  countdownText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  countdownTextUrgent: { color: '#dc2626' },

  title: { fontSize: 22, fontWeight: 'bold', color: '#111827', lineHeight: 30 },

  priceCard: { backgroundColor: '#f0f9ff', borderRadius: 16, padding: 16, gap: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceDivider: { height: 1, backgroundColor: '#bae6fd' },
  priceLabel: { fontSize: 14, color: '#374151' },
  priceValue: { fontSize: 28, fontWeight: '900', color: '#2563eb' },
  premiumValue: { fontSize: 16, fontWeight: '700', color: '#374151' },
  totalValue: { fontSize: 24, color: '#0369a1' },

  bidBtn: { backgroundColor: '#2563eb', borderRadius: 16, padding: 18, alignItems: 'center' },
  bidBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  valuationBtn: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac',
    borderRadius: 14, padding: 14, alignItems: 'center',
  },
  valuationBtnText: { color: '#15803d', fontSize: 14, fontWeight: '600' },

  metaCard: {
    backgroundColor: '#f9fafb', borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb', padding: 14, gap: 10,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  metaText: { fontSize: 14, color: '#374151', flex: 1 },

  descCard: { gap: 8 },
  descLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  descText: { fontSize: 14, color: '#374151', lineHeight: 22 },
});
