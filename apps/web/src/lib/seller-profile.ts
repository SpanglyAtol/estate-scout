/**
 * Seller Profile — stores a user's external selling presence.
 *
 * Each platform the user sells on can be linked here.  When linked, Estate
 * Scout can cross-reference our scraped listings to surface their own items
 * in their profile, and generate direct deep-links back to their store pages.
 *
 * Stored in localStorage (client-only) until a backend auth layer is wired.
 */

const STORAGE_KEY = "estate_scout_seller_profile";

export interface SellerProfile {
  ebay_username: string;       // eBay seller username
  etsy_shop_name: string;      // Etsy shop name (slug)
  first_dibs_dealer: string;   // 1stDibs dealer slug
  liveauctioneers_seller: string; // LiveAuctioneers seller/house slug
  personal_website: string;    // Full URL
  instagram_handle: string;    // Without @
  facebook_profile: string;    // Full URL or username
  bio: string;                 // Short seller bio shown on profile
}

const EMPTY: SellerProfile = {
  ebay_username: "",
  etsy_shop_name: "",
  first_dibs_dealer: "",
  liveauctioneers_seller: "",
  personal_website: "",
  instagram_handle: "",
  facebook_profile: "",
  bio: "",
};

export function getSellerProfile(): SellerProfile {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function saveSellerProfile(data: Partial<SellerProfile>): SellerProfile {
  const current = getSellerProfile();
  const updated = { ...current, ...data };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

// ── Deep-link builders ────────────────────────────────────────────────────────

export function getSellerLinks(profile: SellerProfile): Array<{
  label: string;
  url: string;
  icon: string;
  hint: string;
}> {
  const links = [];

  if (profile.ebay_username) {
    links.push({
      label: "eBay Store",
      url: `https://www.ebay.com/usr/${encodeURIComponent(profile.ebay_username)}`,
      icon: "🛍",
      hint: `ebay.com/usr/${profile.ebay_username}`,
    });
  }
  if (profile.etsy_shop_name) {
    links.push({
      label: "Etsy Shop",
      url: `https://www.etsy.com/shop/${encodeURIComponent(profile.etsy_shop_name)}`,
      icon: "🧶",
      hint: `etsy.com/shop/${profile.etsy_shop_name}`,
    });
  }
  if (profile.first_dibs_dealer) {
    links.push({
      label: "1stDibs",
      url: `https://www.1stdibs.com/dealers/${encodeURIComponent(profile.first_dibs_dealer)}/`,
      icon: "💎",
      hint: `1stdibs.com/dealers/${profile.first_dibs_dealer}`,
    });
  }
  if (profile.liveauctioneers_seller) {
    links.push({
      label: "LiveAuctioneers",
      url: `https://www.liveauctioneers.com/auctioneer/${encodeURIComponent(profile.liveauctioneers_seller)}/`,
      icon: "🏛",
      hint: `liveauctioneers.com/auctioneer/${profile.liveauctioneers_seller}`,
    });
  }
  if (profile.personal_website) {
    links.push({
      label: "Website",
      url: profile.personal_website.startsWith("http")
        ? profile.personal_website
        : `https://${profile.personal_website}`,
      icon: "🌐",
      hint: profile.personal_website.replace(/^https?:\/\//, ""),
    });
  }
  if (profile.instagram_handle) {
    links.push({
      label: "Instagram",
      url: `https://instagram.com/${encodeURIComponent(profile.instagram_handle.replace(/^@/, ""))}`,
      icon: "📸",
      hint: `@${profile.instagram_handle.replace(/^@/, "")}`,
    });
  }
  if (profile.facebook_profile) {
    links.push({
      label: "Facebook",
      url: profile.facebook_profile.startsWith("http")
        ? profile.facebook_profile
        : `https://facebook.com/${profile.facebook_profile}`,
      icon: "👥",
      hint: profile.facebook_profile.replace(/^https?:\/\/(www\.)?facebook\.com\//, ""),
    });
  }

  return links;
}

/** Return an internal search URL that shows this seller's items on Estate Scout. */
export function getMyListingsSearchUrl(profile: SellerProfile): string | null {
  // If the user has an eBay username we can search for their items in our scraped eBay data
  if (profile.ebay_username) {
    return `/search?platform_ids=3&q=${encodeURIComponent(profile.ebay_username)}`;
  }
  return null;
}
