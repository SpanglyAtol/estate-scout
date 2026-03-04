/**
 * Demo data for the Estate Scout mock API.
 * Used when running without the FastAPI backend / PostgreSQL.
 */

export interface MockPlatform {
  id: number;
  name: string;
  display_name: string;
  base_url: string;
  logo_url: string | null;
}

export interface MockItem {
  title: string;
  lot_number: string | null;
  description: string | null;
  current_price: number | null;
  estimate_low: number | null;
  estimate_high: number | null;
  primary_image_url: string | null;
  image_urls: string[];
  category: string | null;
  condition: string | null;
  external_url: string | null;
}

export interface MockListing {
  id: number;
  platform: MockPlatform;
  external_id: string;
  external_url: string;
  title: string;
  description: string | null;
  category: string | null;
  condition: string | null;
  listing_type?: 'auction' | 'estate_sale' | 'buy_now';
  item_type?: 'individual_item' | 'lot' | 'estate_sale' | 'auction_catalog';
  current_price: number | null;
  buy_now_price?: number | null;
  estimate_low?: number | null;
  estimate_high?: number | null;
  final_price: number | null;
  is_completed: boolean;
  buyers_premium_pct: number | null;
  total_cost_estimate: number | null;
  pickup_only: boolean;
  ships_nationally: boolean;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sale_ends_at: string | null;
  sale_starts_at: string | null;
  primary_image_url: string | null;
  image_urls: string[];
  scraped_at: string;
  is_sponsored?: boolean;
  items?: MockItem[];
}

export const PLATFORMS: MockPlatform[] = [
  { id: 1, name: "liveauctioneers", display_name: "LiveAuctioneers", base_url: "https://www.liveauctioneers.com", logo_url: null },
  { id: 2, name: "estatesales_net", display_name: "EstateSales.NET", base_url: "https://www.estatesales.net", logo_url: null },
  { id: 3, name: "hibid", display_name: "HiBid", base_url: "https://hibid.com", logo_url: null },
  { id: 4, name: "maxsold", display_name: "MaxSold", base_url: "https://maxsold.com", logo_url: null },
];

// Times relative to now
const now = new Date();
function hoursFromNow(h: number) { return new Date(now.getTime() + h * 3600_000).toISOString(); }
function daysFromNow(d: number) { return hoursFromNow(d * 24); }
function daysAgo(d: number) { return hoursFromNow(-d * 24); }

// Stable Picsum images keyed by category
const IMG = (seed: string) => `https://picsum.photos/seed/${seed}/400/400`;

export const LISTINGS: MockListing[] = [
  {
    id: 1,
    platform: PLATFORMS[0],
    external_id: "la_10001",
    external_url: "https://www.liveauctioneers.com/item/10001",
    title: "Meissen Porcelain Figurine — 18th Century Shepherd",
    description: "Exceptional Meissen hard-paste porcelain figurine of a shepherd with sheep, circa 1750–1760. Blue crossed-swords mark to base. Minor chip to one sheep's ear. Height 7.5 inches. Comes with original felt-lined box.",
    category: "Ceramics",
    condition: "Very Good",
    current_price: 1450,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 25,
    total_cost_estimate: 1812.5,
    pickup_only: false,
    ships_nationally: true,
    city: "Seattle",
    state: "WA",
    zip_code: "98101",
    latitude: 47.6062, longitude: -122.3321,
    sale_ends_at: hoursFromNow(18),
    sale_starts_at: daysAgo(3),
    primary_image_url: IMG("meissen-shepherd"),
    image_urls: [IMG("meissen-shepherd"), IMG("meissen-shepherd-2"), IMG("meissen-mark")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 2,
    platform: PLATFORMS[1],
    external_id: "es_20002",
    external_url: "https://www.estatesales.net/WA/Bellevue/98004/20002",
    title: "Bellevue Estate Sale — Mid-Century Modern & Asian Antiques",
    description: "Full home liquidation in the Bellevue Crossroads neighborhood. Contents include Mid-Century Modern furniture, Japanese ceramics, signed artwork, sterling silver flatware, vintage jewelry, and household goods. Photos posted the week before the sale.",
    listing_type: "estate_sale" as const,
    category: "furniture",
    condition: null,
    current_price: null,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: null,
    total_cost_estimate: null,
    pickup_only: true,
    ships_nationally: false,
    city: "Bellevue",
    state: "WA",
    zip_code: "98004",
    latitude: 47.6101, longitude: -122.2015,
    sale_ends_at: daysFromNow(4),
    sale_starts_at: daysFromNow(2),
    primary_image_url: IMG("bellevue-estate-mcm"),
    image_urls: [IMG("bellevue-estate-mcm"), IMG("bellevue-living-room"), IMG("bellevue-ceramics"), IMG("bellevue-jewelry")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 3,
    platform: PLATFORMS[2],
    external_id: "hb_30003",
    external_url: "https://hibid.com/lot/30003/victorian-settee",
    title: "Victorian Walnut Settee with Needlepoint Upholstery",
    description: "Elegant Victorian-era carved walnut settee, circa 1880. Camel-back frame with carved cabriole legs on casters. Original needlepoint upholstery in good condition with minor fading. Length 54 inches.",
    category: "Furniture",
    condition: "Good",
    current_price: 625,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 18,
    total_cost_estimate: 737.5,
    pickup_only: true,
    ships_nationally: false,
    city: "Tacoma",
    state: "WA",
    zip_code: "98402",
    latitude: 47.2529, longitude: -122.4443,
    sale_ends_at: daysFromNow(2),
    sale_starts_at: daysAgo(5),
    primary_image_url: IMG("victorian-settee"),
    image_urls: [IMG("victorian-settee"), IMG("victorian-settee-detail")],
    scraped_at: daysAgo(2),
    is_sponsored: false,
  },
  {
    id: 4,
    platform: PLATFORMS[0],
    external_id: "la_10004",
    external_url: "https://www.liveauctioneers.com/item/10004",
    title: "14K Gold & Diamond Art Deco Brooch, c.1925",
    description: "Stunning Art Deco platinum-topped 14K gold brooch set with an old European-cut diamond (approx. 0.75ct) surrounded by rose-cut diamonds and calibré-cut sapphires. Original fitted case. Tested and marked.",
    category: "Jewelry",
    condition: "Excellent",
    current_price: 2100,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 25,
    total_cost_estimate: 2625,
    pickup_only: false,
    ships_nationally: true,
    city: "Seattle",
    state: "WA",
    zip_code: "98101",
    latitude: 47.6062, longitude: -122.3321,
    sale_ends_at: hoursFromNow(6),
    sale_starts_at: daysAgo(7),
    primary_image_url: IMG("art-deco-brooch"),
    image_urls: [IMG("art-deco-brooch"), IMG("art-deco-brooch-2")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 5,
    platform: PLATFORMS[3],
    external_id: "ms_40005",
    external_url: "https://maxsold.com/auctions/40005",
    title: "Georg Jensen Sterling Silver Bowl — Blossom Pattern",
    description: "Authentic Georg Jensen 'Blossom' pattern sterling silver bowl, model no. 57. Marked with crown/GJ/925S Denmark marks. Weight 310 grams. Diameter 8 inches. Some minor surface scratches consistent with use.",
    category: "Silver",
    condition: "Good",
    current_price: null,
    estimate_low: 600,
    estimate_high: 950,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 15,
    total_cost_estimate: null,
    pickup_only: true,
    ships_nationally: false,
    city: "Kirkland",
    state: "WA",
    zip_code: "98033",
    latitude: 47.6769, longitude: -122.2060,
    sale_ends_at: daysFromNow(3),
    sale_starts_at: daysAgo(4),
    primary_image_url: IMG("silver-bowl-jensen"),
    image_urls: [IMG("silver-bowl-jensen"), IMG("silver-bowl-marks")],
    scraped_at: daysAgo(2),
    is_sponsored: false,
  },
  {
    id: 6,
    platform: PLATFORMS[1],
    external_id: "es_20006",
    external_url: "https://www.estatesales.net/WA/Redmond/98052/5678",
    title: "Tiffany Studios Favrile Vase — Gold Iridescent",
    description: "Exceptional Tiffany Studios Favrile art glass vase in gold iridescent finish, signed 'L.C.T. Favrile' on base with original paper label. Height 8.5 inches. No damage.",
    category: "Glass",
    condition: "Mint",
    current_price: null,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: null,
    total_cost_estimate: null,
    pickup_only: false,
    ships_nationally: true,
    city: "Redmond",
    state: "WA",
    zip_code: "98052",
    latitude: 47.6740, longitude: -122.1215,
    sale_ends_at: daysFromNow(5),
    sale_starts_at: daysFromNow(1),
    primary_image_url: IMG("tiffany-favrile-vase"),
    image_urls: [IMG("tiffany-favrile-vase")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 7,
    platform: PLATFORMS[2],
    external_id: "hb_30007",
    external_url: "https://hibid.com/lot/30007/oil-portrait",
    title: "Signed Oil on Canvas Portrait — Continental School c.1890",
    description: "Fine portrait of a young woman in period dress, oil on canvas, signed lower right (illegible). Original gilt frame. Canvas 24x18 inches, framed 32x26 inches. Some minor craquelure, no restoration.",
    category: "Art",
    condition: "Good",
    current_price: 450,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 20,
    total_cost_estimate: 540,
    pickup_only: true,
    ships_nationally: false,
    city: "Everett",
    state: "WA",
    zip_code: "98201",
    latitude: 47.9790, longitude: -122.2021,
    sale_ends_at: hoursFromNow(28),
    sale_starts_at: daysAgo(6),
    primary_image_url: IMG("portrait-painting"),
    image_urls: [IMG("portrait-painting"), IMG("portrait-frame")],
    scraped_at: daysAgo(3),
    is_sponsored: false,
  },
  {
    id: 8,
    platform: PLATFORMS[0],
    external_id: "la_10008",
    external_url: "https://www.liveauctioneers.com/item/10008",
    title: "Rolex Oyster Perpetual Datejust 36mm — 1985",
    description: "Vintage 1985 Rolex Datejust ref. 16014, stainless steel with white dial, original jubilee bracelet. Serial number in 8.2M range. Runs well. Some wear to bracelet links. No box or papers.",
    category: "Watches",
    condition: "Good",
    current_price: 3200,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 25,
    total_cost_estimate: 4000,
    pickup_only: false,
    ships_nationally: true,
    city: "Seattle",
    state: "WA",
    zip_code: "98101",
    latitude: 47.6062, longitude: -122.3321,
    sale_ends_at: hoursFromNow(4),
    sale_starts_at: daysAgo(10),
    primary_image_url: IMG("rolex-datejust"),
    image_urls: [IMG("rolex-datejust"), IMG("rolex-movement"), IMG("rolex-bracelet")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 9,
    platform: PLATFORMS[3],
    external_id: "ms_40009",
    external_url: "https://maxsold.com/auctions/40009",
    title: "18-Piece Haviland Limoges Luncheon Set — Pink Roses",
    description: "Complete 18-piece Haviland & Co. Limoges porcelain luncheon set in 'Schleiger 135' pattern (pink roses on white with gold trim). All pieces in excellent condition, no chips or cracks. Estate fresh.",
    category: "Ceramics",
    condition: "Excellent",
    current_price: 195,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 15,
    total_cost_estimate: 224.25,
    pickup_only: true,
    ships_nationally: false,
    city: "Bothell",
    state: "WA",
    zip_code: "98011",
    latitude: 47.7623, longitude: -122.2054,
    sale_ends_at: daysFromNow(4),
    sale_starts_at: daysAgo(2),
    primary_image_url: IMG("limoges-luncheon"),
    image_urls: [IMG("limoges-luncheon"), IMG("limoges-plate"), IMG("limoges-cup")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 10,
    platform: PLATFORMS[1],
    external_id: "es_20010",
    external_url: "https://www.estatesales.net/WA/Seattle/98115/9012",
    title: "Arts & Crafts Hammered Copper Vase — Roycroft",
    description: "Genuine Roycroft hammered copper vase with original patina, orb-and-cross mark to base. Height 10 inches, diameter 4 inches. No dents. Light verdigris. Circa 1910.",
    category: "Metalwork",
    condition: "Very Good",
    current_price: 320,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 15,
    total_cost_estimate: 368,
    pickup_only: false,
    ships_nationally: true,
    city: "Seattle",
    state: "WA",
    zip_code: "98115",
    latitude: 47.6900, longitude: -122.3190,
    sale_ends_at: daysFromNow(6),
    sale_starts_at: daysAgo(1),
    primary_image_url: IMG("roycroft-copper"),
    image_urls: [IMG("roycroft-copper"), IMG("roycroft-mark")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 11,
    platform: PLATFORMS[2],
    external_id: "hb_30011",
    external_url: "https://hibid.com/lot/30011/secretary-desk",
    title: "Antique Mahogany Secretary Desk with Bookcase — c.1850",
    description: "Imposing American Empire secretary desk with bookcase in mahogany with original brass hardware. Lower case has fitted writing surface with pigeonholes and drawers. Upper case has glazed doors. Height 84 inches.",
    category: "Furniture",
    condition: "Good",
    current_price: 975,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 18,
    total_cost_estimate: 1150.5,
    pickup_only: true,
    ships_nationally: false,
    city: "Spokane",
    state: "WA",
    zip_code: "99201",
    latitude: 47.6588, longitude: -117.4260,
    sale_ends_at: daysFromNow(3),
    sale_starts_at: daysAgo(4),
    primary_image_url: IMG("secretary-desk"),
    image_urls: [IMG("secretary-desk"), IMG("secretary-interior")],
    scraped_at: daysAgo(2),
    is_sponsored: false,
  },
  {
    id: 12,
    platform: PLATFORMS[0],
    external_id: "la_10012",
    external_url: "https://www.liveauctioneers.com/item/10012",
    title: "Chinese Export Famille Rose Punch Bowl — Qianlong Period",
    description: "Large Chinese export porcelain punch bowl with fine famille rose decoration depicting court figures in garden setting. Qianlong reign mark (1735-1796). Diameter 14 inches. Hairline crack to rim visible under UV.",
    category: "Ceramics",
    condition: "Good",
    current_price: 880,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 25,
    total_cost_estimate: 1100,
    pickup_only: false,
    ships_nationally: true,
    city: "Bellevue",
    state: "WA",
    zip_code: "98004",
    latitude: 47.6101, longitude: -122.2015,
    sale_ends_at: hoursFromNow(52),
    sale_starts_at: daysAgo(5),
    primary_image_url: IMG("famille-rose-bowl"),
    image_urls: [IMG("famille-rose-bowl"), IMG("famille-rose-mark")],
    scraped_at: daysAgo(2),
    is_sponsored: false,
  },
  {
    id: 13,
    platform: PLATFORMS[1],
    external_id: "es_20013",
    external_url: "https://www.estatesales.net/WA/Mercer-Island/98040/3456",
    title: "Mercer Island Estate Sale — Fine Art, Silver & Asian Antiques",
    description: "Three-day estate liquidation in a lakefront Mercer Island home. Contents include original oil paintings, Tiffany sterling flatware, Chinese export porcelain, carved jade pieces, vintage jewelry, and Mid-Century furnishings. Preview Friday by appointment.",
    listing_type: "estate_sale" as const,
    category: "art",
    condition: null,
    current_price: null,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: null,
    total_cost_estimate: null,
    pickup_only: true,
    ships_nationally: false,
    city: "Mercer Island",
    state: "WA",
    zip_code: "98040",
    latitude: 47.5707, longitude: -122.2221,
    sale_ends_at: daysFromNow(7),
    sale_starts_at: daysFromNow(5),
    primary_image_url: IMG("mercer-island-fine-art"),
    image_urls: [IMG("mercer-island-fine-art"), IMG("tiffany-flatware"), IMG("famille-rose-bowl"), IMG("tiffany-candlesticks")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 14,
    platform: PLATFORMS[3],
    external_id: "ms_40014",
    external_url: "https://maxsold.com/auctions/40014",
    title: "Leica M3 Camera with 50mm Summicron Lens — c.1957",
    description: "Classic Leica M3 double-stroke rangefinder camera (serial 895xxx, circa 1957) with matching 50mm f/2 Summicron collapsible lens. Shutter speeds accurate. Viewfinder clear with some dust. Leather case included. Fixed price — no bidding.",
    listing_type: "buy_now" as const,
    category: "Collectibles",
    condition: "Good",
    current_price: null,
    buy_now_price: 1500,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: null,
    total_cost_estimate: null,
    pickup_only: true,
    ships_nationally: false,
    city: "Shoreline",
    state: "WA",
    zip_code: "98133",
    latitude: 47.7543, longitude: -122.3412,
    sale_ends_at: daysFromNow(2),
    sale_starts_at: daysAgo(6),
    primary_image_url: IMG("leica-m3-camera"),
    image_urls: [IMG("leica-m3-camera"), IMG("leica-lens")],
    scraped_at: daysAgo(2),
    is_sponsored: false,
  },
  {
    id: 15,
    platform: PLATFORMS[2],
    external_id: "hb_30015",
    external_url: "https://hibid.com/lot/30015/mccoy-pottery",
    title: "Collection of 12 McCoy Pottery Pieces — Cookie Jars & Planters",
    description: "Twelve McCoy USA pieces including four cookie jars (bear, barrel, pineapple, log cabin), six planters and two vases. All marked. Minor crazing typical of period. No chips or cracks.",
    category: "Ceramics",
    condition: "Good",
    current_price: 165,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 18,
    total_cost_estimate: 194.7,
    pickup_only: true,
    ships_nationally: false,
    city: "Auburn",
    state: "WA",
    zip_code: "98001",
    latitude: 47.3073, longitude: -122.2284,
    sale_ends_at: daysFromNow(1),
    sale_starts_at: daysAgo(7),
    primary_image_url: IMG("mccoy-pottery"),
    image_urls: [IMG("mccoy-pottery"), IMG("mccoy-cookie-jar")],
    scraped_at: daysAgo(3),
    is_sponsored: false,
  },
  {
    id: 16,
    platform: PLATFORMS[0],
    external_id: "la_10016",
    external_url: "https://www.liveauctioneers.com/item/10016",
    title: "Louis Comfort Tiffany Bronze Candlestick Pair",
    description: "Pair of authentic Tiffany Studios New York bronze candlesticks in the 'Spanish' pattern, no. 1239. Original warm brown patina. Height 18 inches. Tiffany Studios NY marks to bases.",
    category: "Metalwork",
    condition: "Excellent",
    current_price: 1850,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 25,
    total_cost_estimate: 2312.5,
    pickup_only: false,
    ships_nationally: true,
    city: "Seattle",
    state: "WA",
    zip_code: "98101",
    latitude: 47.6062, longitude: -122.3321,
    sale_ends_at: hoursFromNow(12),
    sale_starts_at: daysAgo(5),
    primary_image_url: IMG("tiffany-candlesticks"),
    image_urls: [IMG("tiffany-candlesticks"), IMG("tiffany-bronze-mark")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 17,
    platform: PLATFORMS[1],
    external_id: "es_20017",
    external_url: "https://www.estatesales.net/WA/Renton/98055/7890",
    title: "Pair of Signed Rembrandt Etching Reproductions — Gilt Frames",
    description: "Pair of fine quality 19th-century reproduction etchings after Rembrandt in original carved and gilt frames. Both signed in the plate. Frame dimensions 18x15 inches. Glass intact, no breaks.",
    category: "Art",
    condition: "Good",
    current_price: 125,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 15,
    total_cost_estimate: 143.75,
    pickup_only: false,
    ships_nationally: true,
    city: "Renton",
    state: "WA",
    zip_code: "98055",
    latitude: 47.4829, longitude: -122.2171,
    sale_ends_at: daysFromNow(4),
    sale_starts_at: daysAgo(2),
    primary_image_url: IMG("rembrandt-etchings"),
    image_urls: [IMG("rembrandt-etchings")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 18,
    platform: PLATFORMS[2],
    external_id: "hb_30018",
    external_url: "https://hibid.com/lot/30018/royal-doulton",
    title: "Royal Doulton 'The Jester' Figurine HN 2016 — 1949",
    description: "Royal Doulton ceramic figurine 'The Jester' model HN 2016, designed by Charles Noke. Issued 1949, retired 1997. Height 10 inches. Perfect condition. Printed and painted marks to base.",
    category: "Ceramics",
    condition: "Mint",
    current_price: 185,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 18,
    total_cost_estimate: 218.3,
    pickup_only: false,
    ships_nationally: true,
    city: "Lynnwood",
    state: "WA",
    zip_code: "98036",
    latitude: 47.8209, longitude: -122.3151,
    sale_ends_at: hoursFromNow(42),
    sale_starts_at: daysAgo(3),
    primary_image_url: IMG("royal-doulton-jester"),
    image_urls: [IMG("royal-doulton-jester"), IMG("royal-doulton-mark")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 19,
    platform: PLATFORMS[3],
    external_id: "ms_40019",
    external_url: "https://maxsold.com/auctions/40019",
    title: "Mid-Century Eames Era Lounge Chair & Ottoman",
    description: "Herman Miller Eames Lounge Chair (model 670) and Ottoman (model 671) in black leather with rosewood veneer shell. Dated 1974. Original leather with normal wear. All swivel and tilt mechanisms work correctly.",
    category: "Furniture",
    condition: "Good",
    current_price: 2400,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 15,
    total_cost_estimate: 2760,
    pickup_only: true,
    ships_nationally: false,
    city: "Seattle",
    state: "WA",
    zip_code: "98112",
    latitude: 47.6331, longitude: -122.3031,
    sale_ends_at: daysFromNow(5),
    sale_starts_at: daysAgo(3),
    primary_image_url: IMG("eames-lounge"),
    image_urls: [IMG("eames-lounge"), IMG("eames-ottoman")],
    scraped_at: daysAgo(2),
    is_sponsored: false,
  },
  {
    id: 20,
    platform: PLATFORMS[0],
    external_id: "la_10020",
    external_url: "https://www.liveauctioneers.com/item/10020",
    title: "Vintage Hermès Kelly 32 Bag — Black Togo Leather",
    description: "Classic Hermès Kelly 32 in black Togo leather with palladium hardware. Stamp R in square (1988). All original hardware, lock with two keys and clochette. Some wear to corners and handle. Interior clean.",
    category: "Accessories",
    condition: "Good",
    current_price: 5500,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 25,
    total_cost_estimate: 6875,
    pickup_only: false,
    ships_nationally: true,
    city: "Bellevue",
    state: "WA",
    zip_code: "98004",
    latitude: 47.6101, longitude: -122.2015,
    sale_ends_at: hoursFromNow(22),
    sale_starts_at: daysAgo(8),
    primary_image_url: IMG("hermes-kelly"),
    image_urls: [IMG("hermes-kelly"), IMG("hermes-hardware"), IMG("hermes-interior")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 21,
    platform: PLATFORMS[1],
    external_id: "es_20021",
    external_url: "https://www.estatesales.net/WA/Issaquah/98027/2345",
    title: "Rookwood Standard Glaze Pottery Vase — 1898 Signed",
    description: "Fine Rookwood Standard Glaze vase with dogwood branch decoration, artist signed 'S.T.' (Sallie Toohey). Impressed Rookwood logo with date cipher for 1898, shape no. 604C. Height 8 inches. No damage.",
    category: "Ceramics",
    condition: "Excellent",
    current_price: 420,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 15,
    total_cost_estimate: 483,
    pickup_only: false,
    ships_nationally: true,
    city: "Issaquah",
    state: "WA",
    zip_code: "98027",
    latitude: 47.5301, longitude: -122.0326,
    sale_ends_at: daysFromNow(4),
    sale_starts_at: daysAgo(2),
    primary_image_url: IMG("rookwood-vase"),
    image_urls: [IMG("rookwood-vase"), IMG("rookwood-mark")],
    scraped_at: daysAgo(1),
    is_sponsored: false,
  },
  {
    id: 22,
    platform: PLATFORMS[2],
    external_id: "hb_30022",
    external_url: "https://hibid.com/lot/30022/steuben-glass",
    title: "Steuben Aurene Gold Art Glass Bowl — c.1910",
    description: "Frederick Carder Steuben gold Aurene bowl with brilliant gold iridescent surface. Signed 'Aurene 2586' on base. Diameter 10 inches. No chips or cracks. Some minor surface scratches.",
    category: "Glass",
    condition: "Very Good",
    current_price: 560,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 18,
    total_cost_estimate: 660.8,
    pickup_only: false,
    ships_nationally: true,
    city: "Tacoma",
    state: "WA",
    zip_code: "98402",
    latitude: 47.2529, longitude: -122.4443,
    sale_ends_at: daysFromNow(3),
    sale_starts_at: daysAgo(4),
    primary_image_url: IMG("steuben-aurene"),
    image_urls: [IMG("steuben-aurene"), IMG("steuben-signed")],
    scraped_at: daysAgo(2),
    is_sponsored: false,
  },
  {
    id: 23,
    platform: PLATFORMS[0],
    external_id: "la_10023",
    external_url: "https://www.liveauctioneers.com/item/10023",
    title: "Pair of Sevres Style Cobalt & Gilt Urns — 19th Century",
    description: "Impressive pair of Sèvres-style soft-paste porcelain urns with cobalt blue ground and reserved panels depicting courting couples in gilt frames. Marked to bases. Height 22 inches. Minor restoration to one handle.",
    category: "Ceramics",
    condition: "Good",
    current_price: 1250,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 25,
    total_cost_estimate: 1562.5,
    pickup_only: false,
    ships_nationally: true,
    city: "Seattle",
    state: "WA",
    zip_code: "98101",
    latitude: 47.6062, longitude: -122.3321,
    sale_ends_at: hoursFromNow(30),
    sale_starts_at: daysAgo(6),
    primary_image_url: IMG("sevres-urns"),
    image_urls: [IMG("sevres-urns"), IMG("sevres-panel-detail")],
    scraped_at: daysAgo(2),
    is_sponsored: false,
  },
  {
    id: 24,
    platform: PLATFORMS[3],
    external_id: "ms_40024",
    external_url: "https://maxsold.com/auctions/40024",
    title: "Vintage Polaroid SX-70 Land Camera & Original Case",
    description: "Vintage Polaroid SX-70 Alpha 1 Model folding SLR camera in brushed chrome and tan leather. Includes original carrying case with strap. Shutter and mirror operational. Light seals replaced. Sold as-is.",
    category: "Collectibles",
    condition: "Good",
    current_price: 145,
    final_price: null,
    is_completed: false,
    buyers_premium_pct: 15,
    total_cost_estimate: 166.75,
    pickup_only: true,
    ships_nationally: false,
    city: "Kenmore",
    state: "WA",
    zip_code: "98028",
    latitude: 47.7562, longitude: -122.2437,
    sale_ends_at: daysFromNow(2),
    sale_starts_at: daysAgo(5),
    primary_image_url: IMG("polaroid-sx70"),
    image_urls: [IMG("polaroid-sx70"), IMG("polaroid-case")],
    scraped_at: daysAgo(3),
    is_sponsored: false,
  },
];

// In-memory state (persists across requests in Next.js dev mode via globalThis)
declare global {
  // eslint-disable-next-line no-var
  var _demoSavedSearches: Map<string, { id: number; name: string; query_text: string | null; filters: Record<string, unknown>; notify_email: boolean; created_at: string }[]>;
  // eslint-disable-next-line no-var
  var _demoAlerts: Map<string, { id: number; name: string; query_text: string | null; max_price: number | null; is_active: boolean; notify_email: boolean; trigger_count: number; created_at: string }[]>;
  // eslint-disable-next-line no-var
  var _demoUsers: Map<string, { email: string; display_name: string | null; tier: string }>;
  // eslint-disable-next-line no-var
  var _demoIdCounter: number;
}

if (!globalThis._demoSavedSearches) globalThis._demoSavedSearches = new Map();
if (!globalThis._demoAlerts) globalThis._demoAlerts = new Map();
if (!globalThis._demoUsers) globalThis._demoUsers = new Map();
if (!globalThis._demoIdCounter) globalThis._demoIdCounter = 1000;

export const demoState = {
  savedSearches: globalThis._demoSavedSearches,
  alerts: globalThis._demoAlerts,
  users: globalThis._demoUsers,
  nextId: () => ++globalThis._demoIdCounter,
};

// Demo auth: returns a fake 3-part JWT so client-side getTokenPayload() / isTokenExpired() work.
// Header and payload are real base64 (compatible with browser atob()), signature is a constant stub.
export function makeDemoToken(email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 3600; // expires in 30 days
  const payload = Buffer.from(JSON.stringify({ sub: email, exp })).toString("base64");
  return `${header}.${payload}.demosig`;
}

export function getDemoEmailFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function getOrCreateUser(email: string, displayName?: string | null) {
  if (!demoState.users.has(email)) {
    demoState.users.set(email, { email, display_name: displayName ?? null, tier: "free" });
  }
  return demoState.users.get(email)!;
}

// ── Estate Sales (browse-by-location events) ──────────────────────────────────

export interface MockEstateSale {
  id: number;
  title: string;
  company: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  starts_at: string;
  ends_at: string;
  hours: string;
  categories: string[];
  platform: string;
  platform_display: string;
  platform_url: string;
  preview_image_url: string;
  item_count_est: number;
  is_featured: boolean;
}

const SAL_IMG = (seed: string) => `https://picsum.photos/seed/${seed}/600/400`;

// Dates relative to "now" so they always look upcoming in the demo
function saleDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

export const mockEstateSales: MockEstateSale[] = [
  {
    id: 1,
    title: "Mid-Century Modern & Antiques Estate",
    company: "Pacific NW Estate Sales",
    neighborhood: "Bellevue – Crossroads",
    city: "Bellevue", state: "WA", zip_code: "98007",
    starts_at: saleDate(2), ends_at: saleDate(4),
    hours: "Fri–Sat 9am–4pm, Sun 10am–2pm",
    categories: ["Furniture", "Art", "Ceramics", "Jewelry"],
    platform: "estatesales.net", platform_display: "EstateSales.NET",
    platform_url: "https://www.estatesales.net/WA/Bellevue",
    preview_image_url: SAL_IMG("bellevue-estate-mcm"),
    item_count_est: 420, is_featured: true,
  },
  {
    id: 2,
    title: "Collector's Trove — Coins, Comics & Vintage Electronics",
    company: "Emerald City Auctions",
    neighborhood: "Capitol Hill",
    city: "Seattle", state: "WA", zip_code: "98122",
    starts_at: saleDate(3), ends_at: saleDate(5),
    hours: "Sat–Sun 8am–5pm",
    categories: ["Collectibles", "Electronics", "Books", "Coins"],
    platform: "estatesales.net", platform_display: "EstateSales.NET",
    platform_url: "https://www.estatesales.net/WA/Seattle",
    preview_image_url: SAL_IMG("seattle-collector-estate"),
    item_count_est: 680, is_featured: false,
  },
  {
    id: 3,
    title: "Farmhouse Downsizing — Tools, Furniture & Primitives",
    company: "MaxSold — Tacoma",
    neighborhood: "North End",
    city: "Tacoma", state: "WA", zip_code: "98406",
    starts_at: saleDate(1), ends_at: saleDate(3),
    hours: "Online bidding open now · Pickup Sat 9am–1pm",
    categories: ["Tools", "Furniture", "Garden", "Primitives"],
    platform: "maxsold", platform_display: "MaxSold",
    platform_url: "https://maxsold.com/auctions",
    preview_image_url: SAL_IMG("tacoma-farmhouse-tools"),
    item_count_est: 310, is_featured: false,
  },
  {
    id: 4,
    title: "Fine Art & Asian Antiques — Mercer Island Estate",
    company: "Cascade Estate Services",
    neighborhood: "Mercer Island",
    city: "Mercer Island", state: "WA", zip_code: "98040",
    starts_at: saleDate(5), ends_at: saleDate(7),
    hours: "Thu–Fri 10am–5pm, Sat 9am–3pm",
    categories: ["Art", "Asian Antiques", "Silver", "Porcelain"],
    platform: "estatesales.net", platform_display: "EstateSales.NET",
    platform_url: "https://www.estatesales.net/WA/Mercer-Island",
    preview_image_url: SAL_IMG("mercer-island-fine-art"),
    item_count_est: 250, is_featured: true,
  },
  {
    id: 5,
    title: "Vintage Clothing, Jewelry & Accessories Haul",
    company: "The Vintage Vault NW",
    neighborhood: "Fremont",
    city: "Seattle", state: "WA", zip_code: "98103",
    starts_at: saleDate(2), ends_at: saleDate(3),
    hours: "Sat 9am–4pm, Sun 10am–3pm",
    categories: ["Clothing", "Jewelry", "Accessories", "Vintage"],
    platform: "facebook", platform_display: "Facebook Marketplace",
    platform_url: "https://www.facebook.com/marketplace/search/?q=estate+sale+seattle",
    preview_image_url: SAL_IMG("seattle-vintage-clothing"),
    item_count_est: 500, is_featured: false,
  },
  {
    id: 6,
    title: "HiBid Online Auction — Kirkland Craftsman Estate",
    company: "Northwest Auction House",
    neighborhood: "Kirkland – Juanita",
    city: "Kirkland", state: "WA", zip_code: "98034",
    starts_at: saleDate(0), ends_at: saleDate(4),
    hours: "Online bidding open · Pickup Mon 10am–4pm",
    categories: ["Furniture", "Tools", "Kitchenware", "Garden"],
    platform: "hibid", platform_display: "HiBid",
    platform_url: "https://hibid.com/auctions",
    preview_image_url: SAL_IMG("kirkland-craftsman-estate"),
    item_count_est: 390, is_featured: false,
  },
  {
    id: 7,
    title: "Retired Professor's Library — Books, Maps & Ephemera",
    company: "Rainier Estate Sales",
    neighborhood: "University District",
    city: "Seattle", state: "WA", zip_code: "98105",
    starts_at: saleDate(6), ends_at: saleDate(8),
    hours: "Fri–Sat 9am–5pm",
    categories: ["Books", "Maps", "Paper Ephemera", "Art"],
    platform: "estatesales.org", platform_display: "EstateSales.org",
    platform_url: "https://estatesales.org/estate-sales-near-me",
    preview_image_url: SAL_IMG("seattle-library-books"),
    item_count_est: 1200, is_featured: false,
  },
  {
    id: 8,
    title: "Lakefront Home Liquidation — Boats, Gear & More",
    company: "Puget Sound Estates",
    neighborhood: "Redmond – Lake Sammamish",
    city: "Redmond", state: "WA", zip_code: "98052",
    starts_at: saleDate(4), ends_at: saleDate(6),
    hours: "Fri 11am–5pm, Sat 8am–4pm",
    categories: ["Marine", "Sporting Goods", "Furniture", "Tools"],
    platform: "estatesales.net", platform_display: "EstateSales.NET",
    platform_url: "https://www.estatesales.net/WA/Redmond",
    preview_image_url: SAL_IMG("redmond-lakefront-estate"),
    item_count_est: 280, is_featured: false,
  },
  {
    id: 9,
    title: "Issaquah Highlands — Complete Home Contents",
    company: "Eastside Estate Liquidators",
    neighborhood: "Issaquah Highlands",
    city: "Issaquah", state: "WA", zip_code: "98029",
    starts_at: saleDate(1), ends_at: saleDate(2),
    hours: "Sat–Sun 8am–4pm",
    categories: ["Furniture", "Appliances", "Clothing", "Décor"],
    platform: "craigslist", platform_display: "Craigslist",
    platform_url: "https://seattle.craigslist.org/search/sss?query=estate+sale",
    preview_image_url: SAL_IMG("issaquah-home-contents"),
    item_count_est: 600, is_featured: false,
  },
  {
    id: 10,
    title: "Renton Antique Collector — 50 Years of Finds",
    company: "South End Estate Sales",
    neighborhood: "Renton Highlands",
    city: "Renton", state: "WA", zip_code: "98058",
    starts_at: saleDate(3), ends_at: saleDate(5),
    hours: "Fri–Sun 9am–4pm",
    categories: ["Antiques", "Pottery", "Glass", "Textiles"],
    platform: "estatesales.net", platform_display: "EstateSales.NET",
    platform_url: "https://www.estatesales.net/WA/Renton",
    preview_image_url: SAL_IMG("renton-antique-collector"),
    item_count_est: 750, is_featured: false,
  },
  {
    id: 11,
    title: "Woodinville Wine Country Estate — Furniture & Décor",
    company: "Cascade Estate Services",
    neighborhood: "Woodinville",
    city: "Woodinville", state: "WA", zip_code: "98077",
    starts_at: saleDate(7), ends_at: saleDate(9),
    hours: "Sat–Sun 9am–4pm",
    categories: ["Furniture", "Wine", "Art", "Outdoor"],
    platform: "nextdoor", platform_display: "Nextdoor",
    platform_url: "https://nextdoor.com/find-nearby/",
    preview_image_url: SAL_IMG("woodinville-wine-estate"),
    item_count_est: 340, is_featured: false,
  },
  {
    id: 12,
    title: "Federal Way Moving Sale — Everything Must Go",
    company: "Budget Estate Solutions",
    neighborhood: "Federal Way – Twin Lakes",
    city: "Federal Way", state: "WA", zip_code: "98023",
    starts_at: saleDate(2), ends_at: saleDate(2),
    hours: "Sat only 7am–3pm",
    categories: ["Furniture", "Clothing", "Electronics", "Sports"],
    platform: "facebook", platform_display: "Facebook Marketplace",
    platform_url: "https://www.facebook.com/marketplace/search/?q=estate+sale+federal+way",
    preview_image_url: SAL_IMG("federal-way-moving-sale"),
    item_count_est: 200, is_featured: false,
  },
];

export function getEstateSales(city?: string): MockEstateSale[] {
  if (!city) return mockEstateSales;
  const q = city.toLowerCase().trim();
  return mockEstateSales.filter(
    (s) =>
      s.city.toLowerCase().includes(q) ||
      s.neighborhood.toLowerCase().includes(q) ||
      s.zip_code.includes(q) ||
      s.state.toLowerCase().includes(q)
  );
}
