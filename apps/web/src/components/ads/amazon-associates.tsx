/**
 * Amazon Associates contextual product suggestions.
 * Shown on listing detail pages to surface relevant supplies/accessories.
 * Only renders when NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG is configured.
 */

interface AmazonLink {
  label: string;
  keywords: string;
}

// Maps listing categories to relevant Amazon product suggestions
const CATEGORY_LINKS: Record<string, AmazonLink[]> = {
  ceramics: [
    { label: "Ceramic cleaning supplies", keywords: "antique ceramic cleaning kit" },
    { label: "Display shelves for ceramics", keywords: "ceramic display shelf plate rack" },
    { label: "Packing foam for fragile items", keywords: "fragile item packing foam wrap" },
  ],
  furniture: [
    { label: "Furniture touch-up kit", keywords: "furniture scratch repair kit" },
    { label: "Furniture polish & wax", keywords: "antique furniture polish wax" },
    { label: "Moving blankets", keywords: "moving blankets furniture protection" },
  ],
  jewelry: [
    { label: "Jewelry cleaning kit", keywords: "jewelry ultrasonic cleaner kit" },
    { label: "Jewelry display stand", keywords: "jewelry display stand organizer" },
    { label: "Jewelry appraisal loupe", keywords: "jeweler loupe magnifier 10x" },
  ],
  art: [
    { label: "UV-protective art frames", keywords: "UV protective picture frame" },
    { label: "Art storage boxes", keywords: "archival art storage box" },
    { label: "White gloves for handling", keywords: "white cotton gloves artwork handling" },
  ],
  silver: [
    { label: "Silver polish cloth", keywords: "silver polish cleaning cloth" },
    { label: "Anti-tarnish strips", keywords: "anti tarnish silver storage strips" },
    { label: "Silver storage bags", keywords: "silver flatware anti tarnish bags" },
  ],
  glass: [
    { label: "Glass cleaner spray", keywords: "streak free glass cleaner antique" },
    { label: "Padded display cases", keywords: "glass display case collectibles" },
    { label: "Foam packing material", keywords: "foam wrap packing fragile glass" },
  ],
  collectibles: [
    { label: "Acrylic display cases", keywords: "acrylic display case collectibles" },
    { label: "Acid-free storage boxes", keywords: "acid free archival storage boxes" },
    { label: "Price guide books", keywords: "antique collectibles price guide book" },
  ],
};

const DEFAULT_LINKS: AmazonLink[] = [
  { label: "Antique cleaning supplies", keywords: "antique cleaning restoration supplies" },
  { label: "Display cases", keywords: "antique display case collector" },
  { label: "Archival storage", keywords: "archival acid free storage collectibles" },
];

function buildAmazonUrl(keywords: string, tag: string): string {
  const params = new URLSearchParams({
    k: keywords,
    tag,
    linkCode: "ure",
  });
  return `https://www.amazon.com/s?${params.toString()}`;
}

interface AmazonAssociatesProps {
  category: string | null;
}

export function AmazonAssociates({ category }: AmazonAssociatesProps) {
  const tag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATES_TAG;
  if (!tag) return null;

  const links: AmazonLink[] =
    (category ? CATEGORY_LINKS[category.toLowerCase()] ?? DEFAULT_LINKS : DEFAULT_LINKS);

  return (
    <div className="antique-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🛍️</span>
        <h3 className="font-semibold text-antique-text text-sm">
          Clean &amp; display your find
        </h3>
        <span className="ml-auto text-xs text-antique-text-mute">via Amazon</span>
      </div>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.keywords}>
            <a
              href={buildAmazonUrl(link.keywords, tag)}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="flex items-center gap-2 text-sm text-antique-accent hover:text-antique-accent-h hover:underline"
            >
              <span className="text-antique-text-mute">→</span>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
