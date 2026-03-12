/**
 * Scraped Data Loader — Multi-Platform Merge
 * -------------------------------------------
 * Loads listing data from platform-specific JSON files produced by the
 * split scraper workflows, merges them, deduplicates, and reassigns
 * sequential IDs so the rest of the app sees a single unified dataset.
 *
 * Load order (each file is optional — missing files are silently skipped):
 *   scraped-listings-fast.json   → BidSpotter + HiBid (updated every 2 h)
 *   scraped-listings-estate.json → EstateSales.NET + MaxSold + Proxibid (every 8 h)
 *   scraped-listings-ebay.json   → eBay sold comps + 1stDibs (daily)
 *   scraped-listings.json        → Legacy full-national run (daily fallback)
 *
 * Falls back to the 24-item mock dataset only when ALL files are absent.
 *
 * IMPORTANT: each require() call MUST use a literal string — webpack can only
 * statically analyse and bundle JSON when the path is a compile-time constant.
 * A variable path like require(filePath) silently fails to bundle.
 *
 * MUST NOT be imported from client components.
 */

import { LISTINGS as MOCK_LISTINGS, type MockListing } from "@/app/api/v1/_mock-data";

// City-string patterns that are placeholder text, not real place names.
const GARBAGE_CITY_RE =
  /see description|check description|call for|tbd|t\.b\.d|varies|multiple locations|various locations|see listing|see details|nationwide|pick up only|no location|not specified|please read|see auction|location tba/i;

// Off-topic titles that slipped through the scraper-level filter.
// BidSpotter/HiBid list ALL auction types — these patterns catch commercial/industrial junk.
const GARBAGE_TITLE_RE =
  /\b(van clearance|site closure|site clearance|liquidation sale|clearance auction|vehicle auction|car auction|truck auction|fleet auction|auto auction|plant hire|pallet lot|truckload|cnc machin|machining|fabricat|welding|manufacturing|facility closure|plant closure|surplus to (?:the )?ongoing operation|warehouse auction|surplus assets|MRO surplus|gov.t (?:surplus|fleet)|dealer auction ring|training auction|ecom authority|ironring|invest in land|beverage.*canning|garment printing|apparel manufactur|knife mf|restaurant.*equipment|medical equipment auction|office furniture liquidat|forklift|industrial equipment|heavy equipment|construction equipment)\b/i;

// Keywords that signal an antique/collectible/estate-relevant listing.
// BidSpotter/HiBid general auction items must have at least one of these signals
// unless they come from estate-specific scrapers (es, ms, pb, et, la, dc).
const ANTIQUE_SIGNAL_RE =
  /\b(antique|vintage|collectible|estate|heirloom|art\b|jewelry|jewellery|silver|porcelain|ceramic|pottery|furniture|victorian|edwardian|art deco|mid.century|retro|memorabilia|coin|stamp|watch|clock|glass|crystal|bronze|painting|sculpture|print|rug|carpet|textile|folk art|americana|primitive|oriental|chinese|japanese|french|english|danish|scandinavian|sterling|hallmark|auction house|fine art|signed|numbered|limited edition|provenance|circa\b|\bc\.\s*\d{4}|18th century|19th century|20th century|pre.war|signed by|by the artist|oil on canvas|watercolor|gouache|lithograph|etching|engraving|daguerreotype|tintype|photograph|ephemera|postcard|book|manuscript|map|globe|barometer|sextant|compass|telescope|microscope|inkwell|inkstand|writing|desk|secretary|armoire|buffet|hutch|sideboard|highboy|lowboy|bureau|commode|vanity|wardrobe|chiffonier|étagère|whatnot|vitrine|credenza|settee|chaise|fainting couch|loveseat|parlor|parlour|wing chair|bergere|fauteuil|tabouret|ottoman|footstool|hassock|candelabra|chandelier|girandole|sconce|lantern|lamp|fixture|cachepot|jardiniere|vase|urn|tureen|compote|epergne|plateau|salver|tray|creamer|sugar|butter|sauce|gravy|cruet|decanter|stopper|carafe|pitcher|ewer|tankard|stein|flagon|beaker|goblet|chalice|coupe|rummer|ratafia|cordial|dram|shot|snifter|tumbler|highball|lowball|cocktail|champagne|flute|coupe|saucer|teacup|demitasse|saucer|plate|platter|charger|bowl|basin|foot bath|spittoon|cuspidor|chamber pot|warming pan|bed warmer|footwarmer|hot water bottle|chafing dish|double boiler|bain marie|skillet|spider|trivet|crane|trammel|andiron|fire dog|fender|fire screen|bellows|tongs|poker|shovel|coal scuttle|hod|kettle|cauldron|crock|jug|jar|canister|tin|box|casket|coffer|chest|trunk|portmanteau|valise|hatbox|bandbox|parasol|fan|glove|button|buckle|clasp|brooch|pin|ring|necklace|bracelet|earring|pendant|locket|cameo|miniature|silhouette|portrait|genre|still life|landscape|seascape|cityscape|trompe l'oeil|grisaille|en grisaille)\b/i;

// Platforms that are already estate/antique specific — no positive signal needed
const ESTATE_PLATFORMS = new Set(["estatesales_net", "maxsold", "proxibid", "ebth", "liveauctioneers", "1stdibs", "invaluable"]);

function isMeaningful(listing: MockListing): boolean {
  if (!listing.external_url?.startsWith("http")) return false;
  if (!listing.title?.trim()) return false;
  if (GARBAGE_TITLE_RE.test(listing.title)) return false;

  // Reject placeholder / example domain URLs that sneak through the scraper
  const urlHost = (() => {
    try { return new URL(listing.external_url).hostname; } catch { return ""; }
  })();
  if (
    urlHost === "example.com" ||
    urlHost === "example-auction.com" ||
    urlHost === "example-estate.com" ||
    urlHost.endsWith(".example.com") ||
    urlHost.includes("example-") ||
    urlHost === "localhost" ||
    urlHost === ""
  ) return false;

  // For general auction platforms (BidSpotter, HiBid, AuctionZip, Discovery),
  // require a positive antique/collectible signal in the title, description,
  // or category. Estate-specific platforms pass through without this check.
  const platformName = listing.platform?.name ?? "";
  const isEstatePlatform = ESTATE_PLATFORMS.has(platformName);
  if (!isEstatePlatform) {
    const hasCategory = Boolean(listing.category?.trim());
    const hasTitleSignal = ANTIQUE_SIGNAL_RE.test(listing.title ?? "");
    const hasDescSignal = ANTIQUE_SIGNAL_RE.test((listing.description ?? "").slice(0, 300));
    if (!hasCategory && !hasTitleSignal && !hasDescSignal) return false;
  }

  // Drop auctions that ended > 60 days ago and were never marked completed
  if (listing.sale_ends_at && !listing.is_completed) {
    const ended = new Date(listing.sale_ends_at).getTime();
    if (!isNaN(ended) && ended < Date.now() - 60 * 24 * 60 * 60 * 1000) return false;
  }
  return true;
}

function cleanListing(listing: MockListing): MockListing {
  if (listing.city && GARBAGE_CITY_RE.test(listing.city)) {
    return { ...listing, city: null, latitude: null, longitude: null };
  }
  return listing;
}

function tryLoad(loader: () => unknown): MockListing[] {
  try {
    const data = loader();
    if (Array.isArray(data) && data.length > 0) return data as MockListing[];
  } catch {
    // File not yet generated by scraper CI — skip silently
  }
  return [];
}

function loadAllListings(): MockListing[] {
  // Each require() uses a LITERAL string so webpack can statically bundle the files.
  // Do NOT refactor these into a loop with a variable path — that breaks bundling.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fast    = tryLoad(() => require("@/data/scraped-listings-fast.json"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const estate  = tryLoad(() => require("@/data/scraped-listings-estate.json"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ebay    = tryLoad(() => require("@/data/scraped-listings-ebay.json"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const legacy  = tryLoad(() => require("@/data/scraped-listings.json"));
  const raw: MockListing[] = [...fast, ...estate, ...ebay, ...legacy];

  if (raw.length === 0) return MOCK_LISTINGS;

  const seen = new Set<string>();
  const merged: MockListing[] = [];
  let nextId = 1;

  for (const listing of raw) {
    const key = `${listing.platform?.name ?? "unknown"}:${listing.external_id ?? listing.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const cleaned = cleanListing(listing);
    if (!isMeaningful(cleaned)) continue;

    merged.push({ ...cleaned, id: nextId++ });
  }

  // Still nothing after filtering? Fall back to mock so the page isn't blank.
  return merged.length > 0 ? merged : MOCK_LISTINGS;
}

const _data: MockListing[] = loadAllListings();

export function getListings(): MockListing[] {
  return _data;
}
