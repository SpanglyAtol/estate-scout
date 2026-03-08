"""
Estate Scout — Listing Attribute Enricher
==========================================
Pure keyword-based structured attribute extraction from listing titles and
descriptions. No AI, no external calls — runs at scrape/hydration time as
part of the data pipeline.

Design goals
------------
- Zero cost: all logic is string matching against curated dictionaries.
- Ordered priority: more specific terms match before generic fallbacks
  (e.g. "Haviland Limoges" → maker="haviland", not maker="limoges_generic").
- Additive: all extracted values land in a flexible `attributes` dict plus
  promoted into top-level indexed fields (`maker`, `brand`, `period`,
  `country_of_origin`, `collaboration_brands`).
- Opinionated about category: includes the canonical category taxonomy
  (watches split from jewelry, coins / trading_cards split from collectibles)
  so hydrate.py can import it directly.

Usage
-----
    from scrapers.enricher import enrich, CATEGORY_KEYWORDS

    enriched = enrich(
        title="Rolex Submariner Date 116610LN, box & papers",
        description="Stainless steel, black dial, 40mm…",
        category="watches",        # already-determined category (or None)
    )
    # enriched = {
    #   "maker": "rolex",
    #   "brand": "rolex",
    #   "collaboration_brands": [],
    #   "period": None,
    #   "country_of_origin": None,
    #   "attributes": {
    #     "model": "Submariner Date",
    #     "movement": "automatic",
    #     "case_material": "stainless_steel",
    #     "dial_color": "black",
    #     "case_size_mm": 40,
    #     "complications": ["date"],
    #     "has_box": True,
    #     "has_papers": True,
    #   }
    # }
"""

from __future__ import annotations

import re
from typing import Any

# ── Category taxonomy ──────────────────────────────────────────────────────────
# Ordered dict: first matching category wins.
# Watches MUST come before jewelry (both previously keyed off " watch").
# Coins / trading_cards MUST come before collectibles.

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "watches": [
        " watch", "wristwatch", "pocket watch", "chronograph", "timepiece",
        "automatic watch", "mechanical watch", "quartz watch",
        "submariner", "daytona", "speedmaster", "datejust", "day-date",
        "seamaster", "constellation omega", "tank watch", "santos watch",
        "royal oak", "nautilus watch", "aquanaut", "pilot watch", "iwc pilot",
        "patek philippe", "vacheron constantin", "audemars piguet",
        "jaeger-lecoultre", "breitling navitimer", "tag heuer",
    ],
    "jewelry": [
        "jewelry", "jewellery", " ring ", " rings ", "necklace", "bracelet",
        "earring", "pendant", "diamond", "sapphire", "ruby", "emerald", "pearl",
        "brooch", " chain", "locket", "cufflink", "gemstone", "opal",
        "amethyst", "turquoise", "engagement ring", "wedding band",
    ],
    "art": [
        "painting", "watercolor", "watercolour", "lithograph", "etching",
        "sculpture", " print", "artwork", "portrait", "canvas", "oil on",
        "gouache", "pastel", "acrylic painting", "framed art", "signed print",
        "bronze sculpture", "marble sculpture",
    ],
    "ceramics": [
        "ceramic", "pottery", "vase", "porcelain", "stoneware", "earthenware",
        "majolica", "wedgwood", "meissen", "imari", "figurine", "platter",
        "teapot", "gravy boat", "transferware", "flow blue", "ironstone",
        "bone china", "limoges", "noritake", "royal doulton", "royal worcester",
        "tea set", "dinner set", "dessert set", "service for",
    ],
    "glass": [
        " glass", "crystal", "stemware", "decanter", "art glass",
        "blown glass", "pressed glass", "carnival glass", "depression glass",
        "steuben", "lalique", "murano",
    ],
    "silver": [
        "sterling silver", "sterling", "silverware", "flatware", "candlestick",
        "coffee service", "epns", "silver plate", "silverplate", "coin silver",
        "800 silver", "silver tea", "silver tray", "silver bowl", "silver pitcher",
        "gorham silver", "tiffany silver", "reed & barton",
    ],
    "coins": [
        " coin ", " coins ", "numismatic", "morgan dollar", "liberty dollar",
        "double eagle", "gold eagle", "silver dollar", "half dollar",
        "proof set", "mint set", "bullion", "pcgs", "ngc graded",
        "uncirculated", "commemorative coin",
    ],
    "trading_cards": [
        "trading card", "baseball card", "football card", "basketball card",
        "sports card", "pokemon card", "magic: the gathering", "mtg card",
        "yugioh card", "psa graded card", "bgs graded", "rookie card",
        "graded card", "card lot",
    ],
    "collectibles": [
        "collectible", "vintage", "antique", "memorabilia", " comic",
        "action figure", "model train", "die-cast", "cast iron bank",
        "tin toy", "advertising sign", "folk art",
    ],
    "furniture": [
        "furniture", "chair", "sofa", "couch", " table", "desk", "dresser",
        "cabinet", "bookcase", "armchair", "ottoman", "sideboard", "credenza",
        "wardrobe", "hutch", "buffet", "chest of drawers", "nightstand",
        "headboard", "recliner", "loveseat", "chaise", "settee",
        "secretary desk", "highboy", "lowboy", "vitrine",
    ],
    "books": [
        " book", "encyclopedia", "manuscript", "magazine", "library",
        "first edition", "hardcover", "paperback", "folio", "atlas",
    ],
    "clothing": [
        "clothing", "apparel", " dress", "jacket", "coat", "handbag",
        " purse", " shoes", "boots", "hat", "scarf", "fur coat",
        "vintage clothing", "designer clothing",
    ],
    "tools": [
        "tool", "drill", " saw", "wrench", "workbench", "grinder",
        "welder", "router bit",
    ],
    "electronics": [
        "camera", "laptop", "computer", "television", "stereo",
        " audio", "speaker", "amplifier", "turntable", "record player",
    ],
    "toys": [
        " toy", "lego", "board game", "puzzle", "train set", "teddy bear",
        "doll", "stuffed animal",
    ],
}


# ── Sub-category taxonomy ──────────────────────────────────────────────────────
# Maps category slug → (sub_category_slug → keyword list).
# Keywords are matched against the full lowercased title+description text.
# Ordering within each category matters: first match wins, so more specific
# sub-categories should appear before broader fallbacks.

_SUB_CATEGORY_KEYWORDS: dict[str, dict[str, list[str]]] = {
    "ceramics": {
        "art_pottery":    ["rookwood", "roseville", "weller", "peters reed",
                           "van briggle", "grueby", "newcomb college", "fulper",
                           "marblehead pottery", "teco", "overbeck", "clewell",
                           "american art pottery"],
        "asian_ceramics": ["imari", "satsuma", "famille rose", "famille verte",
                           "chinese export", "chinese porcelain", "japanese porcelain",
                           "celadon", "canton", "nanking", "moriage"],
        "majolica":       ["majolica", "palissy"],
        "porcelain":      ["meissen", "sèvres", "sevres", "kpm berlin", "limoges",
                           "haviland", "bone china", "royal worcester", "minton",
                           "coalport", "royal crown derby"],
        "stoneware":      ["stoneware", "salt glaze", "salt-glaze", "redware",
                           "slip decorated", "jug", "crock", "churn"],
        "transferware":   ["transferware", "flow blue", "blue and white transfer",
                           "ironstone", "blue willow"],
        "figurines":      ["figurine", "figure group", "bisque", "parian",
                           "lladro", "hummel", "royal doulton figurine"],
        "tableware":      ["tea set", "tea service", "dinner set", "dinner service",
                           "dessert set", "service for", "plates and"],
    },
    "jewelry": {
        "rings":       [" ring ", " rings ", "band ring", "solitaire", "signet ring",
                        "cocktail ring", "wedding band", "engagement ring"],
        "necklaces":   ["necklace", "strand necklace", "chain necklace",
                        "lavaliere", "rivière", "riviere necklace"],
        "bracelets":   ["bracelet", "bangle", "cuff bracelet", "tennis bracelet",
                        "charm bracelet"],
        "brooches":    ["brooch", "broach", " pin", "clip brooch", "fur clip",
                        "dress clip", "chatelaine"],
        "earrings":    ["earring", "ear clip", "ear screw", "ear stud",
                        "drop earring", "chandelier earring"],
        "pendants":    ["pendant", "locket", "lavalier", "drop pendant"],
        "sets":        ["parure", "demi-parure", "suite", "set of jewelry",
                        "matching set", "suite of"],
        "cufflinks":   ["cufflink", "cuff links", "studs and cufflinks",
                        "dress set"],
    },
    "art": {
        "oil_painting":   ["oil on", "oil painting", "oil on canvas",
                           "oil on board", "oil on panel"],
        "watercolor":     ["watercolor", "watercolour", "gouache", "aquarelle"],
        "prints_graphics": ["lithograph", "etching", "engraving", " print",
                            "woodblock", "serigraph", "silkscreen", "aquatint",
                            "mezzotint", "drypoint"],
        "sculpture":      ["sculpture", "bronze sculpture", "marble sculpture",
                           "terracotta sculpture", "carved figure", "carved wood"],
        "folk_art":       ["folk art", "outsider art", "primitive art",
                           "naive art", "self-taught"],
        "photography":    ["photograph", "daguerreotype", "tintype", "albumen",
                           "silver gelatin", "cyanotype"],
        "pastel_drawing": ["pastel", "charcoal drawing", " drawing", " sketch",
                           "pencil drawing", "chalk drawing"],
    },
    "silver": {
        "flatware":      ["flatware", " spoon", " spoons", " fork", " forks",
                          " knife", "place setting", "service for ", "carving set"],
        "hollowware":    ["tea service", "tea set", "coffee service", "teapot",
                          "coffee pot", "sugar bowl", "cream pitcher", "samovar",
                          "cream and sugar"],
        "candlesticks":  ["candlestick", "candelabra", "taper holder",
                          "pair of candlesticks"],
        "trays_salvers": [" tray", "salver", "card tray", "calling card tray",
                          "waiter"],
        "decorative":    ["silver bowl", "silver pitcher", "epergne",
                          "silver basket", "trophy cup", "loving cup"],
    },
    "furniture": {
        "seating":      ["chair", "sofa", "couch", "armchair", "ottoman",
                         "settee", "loveseat", "recliner", "bench", "stool",
                         "wingback", "bergère", "fauteuil", "chaise lounge"],
        "tables":       [" table", "dining table", "coffee table", "side table",
                         "end table", "console table", "pembroke", "drop-leaf",
                         "extension table", "library table"],
        "case_pieces":  ["dresser", "chest of drawers", "chest on chest",
                         "cabinet", "bookcase", "highboy", "lowboy",
                         "credenza", "sideboard", "buffet", "hutch", "wardrobe",
                         "armoire", "vitrine", "secretary bookcase"],
        "desks":        [" desk", "secretary desk", "bureau plat", "kneehole",
                         "writing desk", "davenport desk"],
        "mirrors":      ["mirror", "looking glass", "pier glass", "overmantel"],
        "beds":         ["headboard", "bed frame", "canopy bed", "four-poster",
                         "daybed"],
    },
    "glass": {
        "art_glass":        ["art glass", "steuben", "lalique", "daum nancy",
                             "daum glass", "gallé", "galle glass", "murano",
                             "tiffany favrile", "studio glass", "loetz",
                             "moser glass", "quezal", "aurene"],
        "cut_crystal":      ["cut crystal", "waterford", "baccarat crystal",
                             "brilliant cut glass", "cut glass bowl",
                             "cut glass decanter"],
        "depression_glass": ["depression glass", "elegant glass", "heisey",
                             "cambridge glass", "fostoria", "imperial glass",
                             "tiffin glass", "duncan miller"],
        "pressed_glass":    ["pressed glass", "pattern glass", "milk glass",
                             "vaseline glass", "uranium glass", "slag glass",
                             "carnival glass"],
        "blown_glass":      ["blown glass", "hand-blown", "art blown",
                             "off-hand", "offhand glass"],
    },
    "coins": {
        "us_coins":       ["morgan dollar", "peace dollar", "liberty dollar",
                           "buffalo nickel", "mercury dime", "barber dime",
                           "walking liberty", "franklin half", "kennedy half",
                           "lincoln cent", "wheat cent", "indian head cent",
                           "barber quarter", "seated liberty"],
        "world_coins":    ["world coin", "foreign coin", "british coin",
                           "gold franc", "thaler", "crown coin"],
        "bullion":        ["bullion", "gold bar", "silver bar", "gold eagle coin",
                           "silver eagle coin", "american gold eagle",
                           "american silver eagle", "maple leaf coin",
                           "krugerrand"],
        "currency":       ["currency", "paper money", "banknote", "bank note",
                           "obsolete currency", "confederate currency",
                           "fractional currency"],
        "medals_tokens":  ["medal", " token", "medallion", "military medal",
                           "award medal", "challenge coin"],
    },
    "books": {
        "first_editions":  ["first edition", "first printing", "1st edition",
                            "first issue", "advance copy"],
        "maps_prints":     [" map", "atlas", "antique map", "engraved map",
                            "cartography", "chart of"],
        "ephemera":        ["ephemera", "trade card", "advertising card",
                            "broadside", "handbill", "sheet music"],
        "illustrated":     ["illustrated", "color plate", "colour plate",
                            "chromolithograph", "hand-colored", "hand coloured"],
        "manuscripts":     ["manuscript", " autograph", "signed letter",
                            "autograph letter", "als ", "als,", "document signed"],
    },
    "watches": {
        "wristwatches":  ["wristwatch", "automatic watch", "mechanical watch",
                          "quartz watch", "men's watch", "lady's watch",
                          "dress watch", "sport watch"],
        "pocket_watches": ["pocket watch", "railroad watch", "hunter case",
                           "open face watch", "half hunter"],
        "clocks":        ["mantel clock", "bracket clock", "wall clock",
                          "grandfather clock", "longcase", "carriage clock",
                          "anniversary clock", "cuckoo clock", "ship's clock"],
    },
    "collectibles": {
        "advertising":    ["advertising sign", "tin sign", "advertising tin",
                           "general store", "country store", "porcelain sign"],
        "toys_games":     ["toy", "board game", "cast iron bank", "tin toy",
                           "pressed steel", "tin lithograph", "cap gun"],
        "sports":         ["sports memorabilia", "baseball memorabilia",
                           "signed baseball", "signed jersey", "game used",
                           "sports card", "baseball card"],
        "militaria":      ["military", "wwi", "wwii", "civil war", "sword",
                           "bayonet", "uniform", "insignia", "medal militaria"],
        "americana":      ["americana", "patriotic", "political button",
                           "campaign button", "flag", "folk carving"],
        "holiday":        ["christmas ornament", "holiday ornament", "feather tree",
                           "halloween", "german christmas", "early christmas"],
    },
    "clothing": {
        "coats_furs":   ["fur coat", "mink coat", "fox fur", "shearling",
                         " coat", "mink stole"],
        "dresses":      [" dress", "gown", "evening gown", "ball gown",
                         "tea gown", "beaded dress"],
        "accessories":  ["handbag", " purse", " bag", "clutch", " hat",
                         "scarf", "gloves", "belt"],
        "shoes":        [" shoes", "boots", "pumps", "heels", "footwear"],
        "designer":     ["chanel", "dior", "givenchy", "balenciaga", "gucci",
                         "hermès", "hermes", "ysl", "saint laurent",
                         "valentino", "versace", "couture"],
    },
    "tools": {
        "hand_tools":  ["hand tool", "plane", "spokeshave", "drawknife",
                        "marking gauge", "brace and bit", "hand drill",
                        "chisel", "mallet", "hand saw"],
        "measuring":   ["measuring", "level", "transit", "surveying",
                        "micrometer", "calipers", "vernier"],
        "power_tools": ["power tool", "electric drill", "router", "grinder",
                        "belt sander", "band saw", "table saw"],
    },
    "electronics": {
        "radios":    ["radio", "tube radio", "cathedral radio", "console radio",
                     "transistor radio", "vintage radio"],
        "cameras":   ["camera", "leica", "rolleiflex", "hasselblad",
                     "vintage camera", "film camera", "view camera"],
        "audio":     ["amplifier", "turntable", "record player", "reel to reel",
                     "tube amplifier", "hi-fi", "hifi", "stereo receiver"],
        "scientific": ["oscilloscope", "voltmeter", "signal generator",
                      "scientific instrument", "vacuum tube"],
    },
    "toys": {
        "cast_iron":    ["cast iron", "cast-iron toy", "cast iron horse",
                         "cast iron bank", "cast iron vehicle"],
        "tin_toys":     ["tin toy", "tin lithograph", "tin automobile",
                         "clockwork toy", "wind-up toy", "tin robot"],
        "dolls":        ["doll", "bisque doll", "china doll", "cloth doll",
                         "composition doll", "celluloid doll"],
        "trains":       ["train set", "model train", "lionel", "american flyer",
                         "gauge train", "tin train"],
        "games":        ["board game", "card game", "puzzle", "jigsaw",
                         "game board", "antique game"],
    },
    "furniture_lighting": {
        "lamps":     ["lamp", "table lamp", "floor lamp", "art nouveau lamp",
                      "leaded glass lamp", "slag glass lamp"],
        "chandeliers": ["chandelier", "hanging light", "pendant light",
                        "gas chandelier"],
        "sconces":   ["sconce", "wall sconce", "candle sconce", "wall bracket"],
    },
}


def _extract_sub_category(category: str, text: str) -> str | None:
    """
    Return the most specific sub-category slug for a listing given its main
    category and the lowercased title+description text.
    Returns None if no sub-category keyword matches.
    """
    sub_map = _SUB_CATEGORY_KEYWORDS.get(category)
    if not sub_map:
        return None
    for sub_slug, keywords in sub_map.items():
        for kw in keywords:
            if kw in text:
                return sub_slug
    return None


# ── Watch brands ───────────────────────────────────────────────────────────────
# Ordered from most specific/prestigious to most generic.
# Keys become the normalized maker slug.

_WATCH_BRANDS: dict[str, list[str]] = {
    "patek_philippe":      ["patek philippe", "patek & co"],
    "audemars_piguet":     ["audemars piguet", "audemars-piguet"],
    "vacheron_constantin": ["vacheron constantin"],
    "jaeger_lecoultre":    ["jaeger-lecoultre", "jaeger lecoultre", "jlc"],
    "a_lange_sohne":       ["a. lange & söhne", "a. lange", "lange sohne"],
    "richard_mille":       ["richard mille"],
    "fp_journe":           ["f.p. journe", "fp journe"],
    "breguet":             ["breguet watch"],
    "rolex":               ["rolex"],
    "cartier":             ["cartier"],
    "omega":               ["omega watch", "omega speedmaster", "omega seamaster",
                            "omega constellation", "omega de ville"],
    "iwc":                 ["iwc", "international watch company", "iwc schaffhausen"],
    "breitling":           ["breitling", "navitimer", "chronomat"],
    "tag_heuer":           ["tag heuer", "tag-heuer", "heuer"],
    "tudor":               ["tudor watch", "tudor black bay", "tudor submariner"],
    "longines":            ["longines"],
    "tissot":              ["tissot"],
    "zenith":              ["zenith watch", "zenith el primero"],
    "panerai":             ["panerai", "luminor panerai", "radiomir panerai"],
    "hublot":              ["hublot"],
    "grand_seiko":         ["grand seiko", "gs seiko"],
    "seiko":               ["seiko"],
    "citizen":             ["citizen watch"],
    "bulova":              ["bulova", "accutron"],
    "hamilton":            ["hamilton watch", "hamilton railroad"],
    "elgin":               ["elgin watch", "elgin national"],
    "waltham":             ["waltham watch"],
    "illinois":            ["illinois watch"],
    "gruen":               ["gruen watch", "gruen precision"],
    "benrus":              ["benrus"],
    "wittnauer":           ["wittnauer"],
    "movado":              ["movado"],
    "rado":                ["rado watch"],
    "raymond_weil":        ["raymond weil"],
    "frederique_constant": ["frederique constant"],
    "ball_watch":          ["ball watch company"],
    "doxa":                ["doxa watch"],
    "glycine":             ["glycine watch"],
    "vulcain":             ["vulcain"],
    "universal_geneve":    ["universal geneve", "universal génève"],
    "juvenia":             ["juvenia"],
    "lecoultre":           ["lecoultre"],   # pre-JLC branding
    "longines_heritage":   ["longines heritage"],
}

# ── Watch model names (brand-agnostic patterns) ────────────────────────────────
_WATCH_MODELS: dict[str, list[str]] = {
    "Submariner":         ["submariner"],
    "Submariner Date":    ["submariner date"],
    "Daytona":            ["daytona", "cosmograph daytona"],
    "Day-Date":           ["day-date", "day date presidential"],
    "Datejust":           ["datejust"],
    "GMT-Master":         ["gmt-master", "gmt master", "gmtmaster"],
    "Explorer":           ["explorer ii", " explorer "],
    "Sea-Dweller":        ["sea-dweller", "sea dweller", "deepsea"],
    "Milgauss":           ["milgauss"],
    "Air-King":           ["air-king"],
    "Speedmaster":        ["speedmaster", "moonwatch"],
    "Seamaster":          ["seamaster"],
    "Constellation":      ["constellation omega", "omega constellation"],
    "De Ville":           ["de ville", "deville omega"],
    "Aqua Terra":         ["aqua terra"],
    "Railmaster":         ["railmaster"],
    "Navitimer":          ["navitimer"],
    "Chronomat":          ["chronomat"],
    "Superocean":         ["superocean"],
    "Royal Oak":          ["royal oak"],
    "Royal Oak Offshore": ["royal oak offshore"],
    "Nautilus":           ["nautilus patek", "nautilus 5711", "nautilus 5712"],
    "Aquanaut":           ["aquanaut"],
    "Tank":               ["tank watch", "cartier tank", "tank solo", "tank must",
                           "tank americaine", "tank francaise"],
    "Santos":             ["santos watch", "cartier santos"],
    "Ballon Bleu":        ["ballon bleu"],
    "Pilot":              ["iwc pilot", "spitfire watch", "mark xviii", "mark xv"],
    "Portugieser":        ["portugieser", "portuguese watch"],
    "Big Pilot":          ["big pilot"],
    "Black Bay":          ["black bay", "tudor black bay"],
    "Pelagos":            ["pelagos"],
    "El Primero":         ["el primero"],
}

# ── Watch complications ────────────────────────────────────────────────────────
_WATCH_COMPLICATIONS: list[tuple[str, list[str]]] = [
    ("chronograph",        ["chronograph", "chrono"]),
    ("perpetual_calendar", ["perpetual calendar", "annual calendar"]),
    ("gmt",                ["gmt", "dual time", "world time"]),
    ("moonphase",          ["moonphase", "moon phase"]),
    ("minute_repeater",    ["minute repeater", "repeating"]),
    ("tourbillon",         ["tourbillon"]),
    ("split_seconds",      ["rattrapante", "split seconds"]),
    ("power_reserve",      ["power reserve indicator"]),
    ("date",               ["date display", "with date", "calendar",
                            "date submariner", " date "]),
]

# ── Ceramic/porcelain makers ───────────────────────────────────────────────────
# Ordered: more specific before generic (Haviland before Limoges).

_CERAMIC_MAKERS: dict[str, list[str]] = {
    # German
    "meissen":              ["meissen"],
    "rosenthal":            ["rosenthal"],
    "kpm":                  ["kpm", "königliche porzellan"],
    "hutschenreuther":      ["hutschenreuther"],
    "nymphenburg":          ["nymphenburg"],
    "villeroy_boch":        ["villeroy & boch", "villeroy and boch"],
    # English
    "wedgwood":             ["wedgwood"],
    "royal_doulton":        ["royal doulton"],
    "royal_crown_derby":    ["royal crown derby"],
    "spode":                ["spode"],
    "minton":               ["minton"],
    "coalport":             ["coalport"],
    "royal_worcester":      ["royal worcester"],
    "copeland":             ["copeland spode", "w.t. copeland"],
    "masons_ironstone":     ["mason's ironstone", "masons ironstone"],
    "shelley":              ["shelley china", "shelley potteries"],
    "paragon":              ["paragon china"],
    "aynsley":              ["aynsley"],
    "adderley":             ["adderley"],
    # French — specific makers before generic "Limoges"
    "haviland":             ["haviland"],
    "bernardaud":           ["bernardaud"],
    "raynaud":              ["raynaud limoges"],
    "limoges_jpl":          ["jean pouyat", "j.p.l. limoges", "jpl limoges"],
    "limoges_gda":          ["gda limoges", "gerard dufraisseix", "ch. field haviland"],
    "limoges_tv":           ["t.v. limoges", "t & v limoges", "tressemann & vogt"],
    "limoges_ahrenfeldt":   ["ahrenfeldt", "c. ahrenfeldt"],
    "limoges_pouyat":       ["pouyat limoges"],
    "limoges_generic":      ["limoges"],   # LAST — catch-all for Limoges mark
    # Austrian / Bohemian
    "herend":               ["herend"],
    "augarten":             ["augarten"],
    "royal_dux":            ["royal dux"],
    # Danish
    "royal_copenhagen":     ["royal copenhagen"],
    "bing_grondahl":        ["bing & grøndahl", "bing grondahl"],
    # American
    "lenox":                ["lenox"],
    "buffalo_pottery":      ["buffalo pottery"],
    "rookwood":             ["rookwood pottery"],
    "weller":               ["weller pottery"],
    "roseville":            ["roseville pottery"],
    "red_wing":             ["red wing pottery", "red wing stoneware"],
    "fiesta":               ["fiestaware", "fiesta pottery", "homer laughlin"],
    # Japanese
    "noritake":             ["noritake"],
    "occupied_japan":       ["occupied japan"],
    "nippon":               ["nippon porcelain", "nippon china"],
    "arita":                ["arita porcelain", "japanese arita"],
    "kutani":               ["kutani"],
    "satsuma":              ["satsuma pottery"],
    # Italian
    "richard_ginori":       ["richard ginori", "ginori"],
    # Russian
    "imperial_porcelain":   ["imperial porcelain", "lomonosov"],
    # Chinese export
    "chinese_export":       ["chinese export porcelain", "canton porcelain",
                             "rose medallion", "rose mandarin"],
    "made_in_china":        ["made in china"],  # lowest priority
}

# ── Ceramic style / decoration types ──────────────────────────────────────────
_CERAMIC_STYLES: dict[str, list[str]] = {
    "imari":        ["imari", "kakiemon", "arita"],
    "transferware": ["transferware", "transfer print", "blue and white transferware"],
    "flow_blue":    ["flow blue"],
    "majolica":     ["majolica"],
    "art_nouveau":  ["art nouveau porcelain"],
    "art_deco":     ["art deco china"],
    "creamware":    ["creamware", "queensware"],
    "pearlware":    ["pearlware"],
    "mocha_ware":   ["mocha ware"],
    "spongeware":   ["spongeware", "spatterware"],
    "lusterware":   ["lusterware", "lustre ware"],
    "jasperware":   ["jasperware", "jasper ware"],
    "basalt":       ["basalt", "black basalt"],
}

# ── Silver makers ──────────────────────────────────────────────────────────────
_SILVER_MAKERS: dict[str, list[str]] = {
    "gorham":              ["gorham silver", "gorham sterling"],
    "tiffany_silver":      ["tiffany & co silver", "tiffany silver", "tiffany sterling"],
    "wallace":             ["wallace sterling", "wallace silver"],
    "reed_barton":         ["reed & barton"],
    "international":       ["international silver"],
    "towle":               ["towle silver", "towle sterling"],
    "lunt":                ["lunt silver"],
    "whiting":             ["whiting silver", "whiting mfg"],
    "kirk_stieff":         ["kirk stieff", "s. kirk", "stieff silver"],
    "jensen":              ["georg jensen", "george jensen"],
    "mappin_webb":         ["mappin & webb"],
    "christofle":          ["christofle"],
    "elkington":           ["elkington"],
    "frank_whiting":       ["frank whiting"],
    "alvin":               ["alvin silver", "alvin sterling"],
    "dominick_haff":       ["dominick & haff"],
    "stieff":              ["stieff co"],
    "watson":              ["watson silver", "watson company"],
    "simpson_hall":        ["simpson hall miller"],
}

# Silver purity — ordered: sterling before silverplate
_SILVER_PURITY: dict[str, list[str]] = {
    "sterling":    ["sterling silver", "sterling", "925 silver", ".925", "hallmarked silver"],
    "coin_silver": ["coin silver", "900 silver", ".900 silver"],
    "800_silver":  ["800 silver", ".800 silver", "800/1000"],
    "950_silver":  ["950 silver", ".950"],
    "silverplate": ["silver plate", "silverplate", "silver plated",
                    "epns", "ep copper", "ep nickel", "electroplated",
                    "silver filled", "silver over copper", "sheffield plate",
                    "old sheffield", "close plate"],
}

# ── Jewelry / fashion brands ───────────────────────────────────────────────────
_JEWELRY_BRANDS: dict[str, list[str]] = {
    "tiffany":          ["tiffany & co", "tiffany and co"],
    "cartier":          ["cartier jewelry", "cartier ring", "cartier necklace",
                         "cartier bracelet", "cartier earring", "cartier love",
                         "cartier juste un clou", "cartier trinity"],
    "van_cleef":        ["van cleef & arpels", "van cleef arpels"],
    "bulgari":          ["bulgari", "bvlgari"],
    "harry_winston":    ["harry winston"],
    "graff":            ["graff diamonds"],
    "david_yurman":     ["david yurman"],
    "georg_jensen_jwl": ["georg jensen jewelry", "georg jensen silver jewelry"],
    "mikimoto":         ["mikimoto"],
    "lagos":            ["lagos jewelry"],
    "pandora":          ["pandora jewelry"],
}

# ── Furniture styles / periods ─────────────────────────────────────────────────
_FURNITURE_STYLES: dict[str, list[str]] = {
    "georgian":             ["georgian furniture", "george ii", "george iii"],
    "regency":              ["regency furniture", "regency period"],
    "william_and_mary":     ["william and mary furniture"],
    "queen_anne":           ["queen anne furniture", "queen anne style"],
    "chippendale":          ["chippendale", "thomas chippendale"],
    "hepplewhite":          ["hepplewhite"],
    "sheraton":             ["sheraton style", "sheraton period"],
    "empire":               ["empire style", "american empire"],
    "federal":              ["federal period", "federal style"],
    "victorian":            ["victorian furniture", "victorian era"],
    "eastlake":             ["eastlake furniture"],
    "renaissance_revival":  ["renaissance revival"],
    "rococo_revival":       ["rococo revival"],
    "arts_and_crafts":      ["arts & crafts furniture", "arts and crafts",
                             "craftsman furniture", "craftsman style"],
    "mission":              ["mission oak", "mission style furniture"],
    "stickley":             ["stickley", "l. & j.g. stickley"],
    "art_nouveau":          ["art nouveau furniture"],
    "art_deco":             ["art deco furniture"],
    "mid_century_modern":   ["mid century modern", "mid-century modern", "mcm furniture",
                             "danish modern", "scandinavian modern",
                             "herman miller", "eames", "knoll"],
    "shaker":               ["shaker furniture", "shaker style"],
    "country":              ["country furniture", "painted country"],
    "french_provincial":    ["french provincial", "louis xv style", "louis xvi style",
                             "louis xiv style"],
    "biedermeier":          ["biedermeier"],
}

_FURNITURE_MAKERS: dict[str, list[str]] = {
    "stickley":          ["stickley", "l & jg stickley", "l. & j.g. stickley",
                          "gustav stickley"],
    "heywood_wakefield": ["heywood-wakefield", "heywood wakefield"],
    "herman_miller":     ["herman miller"],
    "knoll":             ["knoll furniture", "knoll international"],
    "eames":             ["eames chair", "eames lounge"],
    "dunbar":            ["dunbar furniture"],
    "widdicomb":         ["widdicomb"],
    "baker":             ["baker furniture"],
    "drexel":            ["drexel furniture"],
    "henredon":          ["henredon"],
    "broyhill":          ["broyhill premier"],
    "lane":              ["lane furniture", "lane cedar"],
    "thomasville":       ["thomasville furniture"],
}

# ── Art mediums ────────────────────────────────────────────────────────────────
_ART_MEDIUMS: dict[str, list[str]] = {
    "oil_on_canvas":   ["oil on canvas", "oil painting on canvas"],
    "oil_on_board":    ["oil on board", "oil on masonite", "oil on panel"],
    "oil_on_paper":    ["oil on paper"],
    "watercolor":      ["watercolor", "watercolour", "water color"],
    "gouache":         ["gouache"],
    "pastel":          ["pastel on paper", "pastel drawing"],
    "acrylic":         ["acrylic on canvas", "acrylic painting"],
    "mixed_media":     ["mixed media"],
    "pencil":          ["pencil drawing", "graphite drawing"],
    "charcoal":        ["charcoal drawing"],
    "ink":             ["ink drawing", "pen and ink"],
    "lithograph":      ["lithograph", "lithography"],
    "etching":         ["etching", "drypoint"],
    "aquatint":        ["aquatint"],
    "engraving":       ["engraving", "wood engraving"],
    "woodcut":         ["woodcut", "woodblock"],
    "silkscreen":      ["silkscreen", "serigraph", "screen print"],
    "mezzotint":       ["mezzotint"],
    "monotype":        ["monotype"],
    "bronze":          ["bronze sculpture", "bronze figure", "cast bronze"],
    "marble":          ["marble sculpture", "carved marble"],
    "alabaster":       ["alabaster sculpture"],
    "terracotta":      ["terracotta sculpture", "terracotta figure"],
    "photograph":      ["photograph", "silver gelatin", "chromogenic print",
                        "c-print", "archival inkjet"],
}

# ── Periods / eras (universal, any category) ──────────────────────────────────
_PERIODS: dict[str, list[str]] = {
    "prehistoric":          ["prehistoric", "paleolithic", "neolithic"],
    "ancient":              ["ancient roman", "ancient greek", "ancient egyptian",
                             "greco-roman", "pre-columbian"],
    "medieval":             ["medieval", "gothic period"],
    "renaissance":          ["renaissance period", "renaissance style"],
    "baroque":              ["baroque"],
    "rococo":               ["rococo", "louis xv period"],
    "neoclassical":         ["neoclassical", "neo-classical"],
    "georgian":             ["georgian period", "george iii"],
    "regency":              ["regency period"],
    "empire":               ["empire period", "directoire"],
    "victorian":            ["victorian", "victoria period", "queen victoria"],
    "edwardian":            ["edwardian"],
    "arts_and_crafts":      ["arts & crafts", "arts and crafts movement"],
    "art_nouveau":          ["art nouveau", "jugendstil", "liberty style"],
    "art_deco":             ["art deco", "art-deco", "deco period"],
    "mid_century_modern":   ["mid century modern", "mid-century modern", "mcm",
                             "midcentury", "1950s design", "1960s design"],
    "brutalist":            ["brutalist", "brutalism"],
    "postmodern":           ["postmodern", "memphis design", "1980s design"],
    "contemporary":         ["contemporary art", "contemporary design"],
    "colonial":             ["american colonial", "colonial period"],
    "federal":              ["federal period", "federal style"],
    "folk_art":             ["folk art", "american folk"],
    "shaker":               ["shaker"],
    "mission":              ["mission style", "mission oak"],
    "chinoiserie":          ["chinoiserie"],
    "japonisme":            ["japonisme", "japonaise"],
}

# ── Country of origin ──────────────────────────────────────────────────────────
_COUNTRIES: dict[str, list[str]] = {
    "france":          ["made in france", "french made", "paris, france",
                        "limoges, france"],
    "england":         ["made in england", "english made", "great britain",
                        "united kingdom", "made in great britain"],
    "germany":         ["made in germany", "west germany", "east germany",
                        "made in w. germany", "made in e. germany",
                        "bavaria", "dresden", "made in bavaria"],
    "austria":         ["made in austria", "austrian made"],
    "japan":           ["made in japan"],
    "occupied_japan":  ["occupied japan"],  # before "japan"
    "china":           ["made in china", "people's republic of china", "prc china"],
    "denmark":         ["made in denmark", "danish made"],
    "sweden":          ["made in sweden", "swedish made"],
    "norway":          ["made in norway"],
    "finland":         ["made in finland", "arabia finland"],
    "italy":           ["made in italy", "italian made"],
    "netherlands":     ["made in holland", "delft holland", "dutch"],
    "belgium":         ["made in belgium"],
    "portugal":        ["made in portugal", "portugal porcelain"],
    "spain":           ["made in spain"],
    "czechoslovakia":  ["czechoslovakia", "czecho-slovakia", "made in czechoslovakia"],
    "czechoslovakia":  ["bohemia", "bohemian", "made in bohemia"],
    "poland":          ["made in poland"],
    "russia":          ["russia", "imperial russia", "ussr"],
    "usa":             ["made in usa", "made in america", "made in u.s.a.",
                        "american made"],
    "scotland":        ["made in scotland", "scottish made"],
    "ireland":         ["made in ireland", "irish made"],
    "switzerland":     ["made in switzerland", "swiss made"],  # for watches
}

# ── Collaboration brand lists ──────────────────────────────────────────────────
# Used to detect "Brand X x Brand Y" or "Brand for Brand" collaborations.

_ALL_COLLAB_BRANDS: list[str] = [
    # Luxury fashion
    "louis vuitton", "lv", "hermès", "hermes", "chanel", "gucci", "prada",
    "dior", "christian dior", "yves saint laurent", "ysl", "givenchy",
    "balenciaga", "burberry", "fendi", "versace", "valentino",
    "dolce & gabbana", "dolce and gabbana", "bottega veneta", "celine",
    "loewe", "alexander mcqueen", "stella mccartney", "vivienne westwood",
    "balmain", "lanvin", "kenzo", "comme des garçons", "comme des garcons",
    "cdg", "issey miyake", "moncler", "stone island", "moschino",
    # Jewelry
    "tiffany & co", "tiffany", "cartier", "van cleef & arpels", "bulgari",
    "bvlgari", "harry winston", "graff",
    # Watch brands (for collab detection, e.g. "Rolex for Tiffany")
    "rolex", "omega", "patek philippe", "audemars piguet",
    # Streetwear / contemporary
    "supreme", "off-white", "off white", "bape", "a bathing ape",
    "palace", "stussy", "fear of god", "essentials",
    "kith", "noah nyc", "aime leon dore", "human made", "wacko maria",
    # Footwear
    "nike", "adidas", "jordan brand", "new balance", "asics", "puma",
    "reebok", "converse", "vans",
    # Pop culture / artist
    "disney", "marvel", "star wars", "andy warhol", "jean-michel basquiat",
    "keith haring", "kaws", "takashi murakami",
]

# ── Metal types (jewelry / silver / watches) ───────────────────────────────────
_JEWELRY_METALS: dict[str, list[str]] = {
    "platinum":    ["platinum", "pt950", "pt900", "plat."],
    "18k_gold":    ["18k", "18kt", "18 karat", "750 gold", ".750", "18 carat gold"],
    "14k_gold":    ["14k", "14kt", "14 karat", "585 gold", ".585", "14 carat gold"],
    "10k_gold":    ["10k", "10kt", "10 karat", "417 gold"],
    "22k_gold":    ["22k", "22kt", "22 karat", "916 gold"],
    "9ct_gold":    ["9ct", "9 carat", "375 gold"],
    "yellow_gold": ["yellow gold"],
    "rose_gold":   ["rose gold", "pink gold", "red gold"],
    "white_gold":  ["white gold"],
    "gold_filled": ["gold filled", "gold-filled", "gf gold", "1/20"],
    "gold_plated": ["gold plated", "gold plate", "gold electroplate"],
    "silver":      ["sterling silver", ".925", "925 silver"],
    "silver_tone": ["silver tone", "silver-tone"],
    "costume":     ["costume jewelry", "costume jewellery"],
}

_GEMSTONES: dict[str, list[str]] = {
    "diamond":    ["diamond", "diamonds", "brilliant cut"],
    "sapphire":   ["sapphire", "ceylon sapphire", "montana sapphire"],
    "ruby":       ["ruby", "burmese ruby"],
    "emerald":    ["emerald", "colombian emerald"],
    "pearl":      ["pearl", "pearls", "cultured pearl", "freshwater pearl",
                   "akoya pearl", "south sea pearl", "tahitian pearl"],
    "opal":       ["opal", "boulder opal", "fire opal"],
    "amethyst":   ["amethyst"],
    "aquamarine": ["aquamarine"],
    "topaz":      ["topaz", "blue topaz", "imperial topaz"],
    "tourmaline": ["tourmaline"],
    "peridot":    ["peridot"],
    "garnet":     ["garnet", "pyrope garnet", "rhodolite"],
    "tanzanite":  ["tanzanite"],
    "alexandrite":["alexandrite"],
    "spinel":     ["spinel"],
    "turquoise":  ["turquoise"],
    "coral":      ["coral", "red coral"],
    "jade":       ["jade", "jadeite", "nephrite"],
    "lapis":      ["lapis lazuli", "lapis"],
    "onyx":       ["onyx", "black onyx"],
    "malachite":  ["malachite"],
    "moonstone":  ["moonstone"],
    "chrysoprase":["chrysoprase"],
    "iolite":     ["iolite"],
    "citrine":    ["citrine"],
}

# ── Helper functions ───────────────────────────────────────────────────────────

def _build_text(title: str, description: str | None) -> str:
    """Combine title + first 600 chars of description, lowercased."""
    text = (title or "").lower()
    if description:
        text += " " + description[:600].lower()
    return text


def _first_match(text: str, lookup: dict[str, list[str]]) -> str | None:
    """Return the first key whose keyword list has a match in text."""
    for slug, keywords in lookup.items():
        for kw in keywords:
            if kw in text:
                return slug
    return None


def _all_matches(text: str, lookup: dict[str, list[str]]) -> list[str]:
    """Return all keys with at least one keyword match."""
    found = []
    for slug, keywords in lookup.items():
        for kw in keywords:
            if kw in text:
                found.append(slug)
                break
    return found


def _extract_number(text: str, patterns: list[str]) -> int | None:
    """Try each pattern in order; return first int capture group match."""
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            try:
                return int(m.group(1))
            except (IndexError, ValueError):
                pass
    return None


# ── Universal extractors ───────────────────────────────────────────────────────

def _extract_period(text: str) -> str | None:
    return _first_match(text, _PERIODS)


def _extract_country(text: str) -> str | None:
    # occupied_japan before japan — ordering in dict handles this
    return _first_match(text, _COUNTRIES)


def _extract_piece_count(text: str) -> int | None:
    return _extract_number(text, [
        r"(\d+)\s*[-–]?\s*piece\s+set",
        r"service\s+for\s+(\d+)",
        r"set\s+of\s+(\d+)",
        r"(\d+)\s*pcs?\b",
        r"(\d+)\s*pieces?",
        r"(\d+)\s*place\s+settings?",
    ])


def _extract_is_signed(text: str) -> bool:
    signed_phrases = [
        "signed", "artist signed", "hand signed", "signed in paint",
        "bears signature", "signed lower right", "signed lower left",
        "artist's signature", "bears artist",
    ]
    return any(p in text for p in signed_phrases)


def _extract_collaboration(text: str) -> list[str]:
    """
    Detect collaboration patterns:
      - "Brand A x Brand B"
      - "Brand A for Brand B"  (e.g. "Rolex for Tiffany")
      - "Brand A × Brand B"
    Returns list of normalized brand strings found, empty if no collab detected.
    """
    # Normalise multiplication signs
    normalised = text.replace("×", " x ").replace("X ", " x ")

    # Build a pattern that finds things around " x " or " for "
    # We just look for whether TWO known brands appear near those conjunctions
    found: list[str] = []
    for brand in _ALL_COLLAB_BRANDS:
        if brand in normalised:
            found.append(brand)

    if len(found) < 2:
        return []

    # Now confirm there's actually a conjunction between at least two of them
    # Simple heuristic: check if " x " or " for " appears between any two brand positions
    for conj in [" x ", " for ", " × "]:
        if conj in normalised:
            conj_pos = [m.start() for m in re.finditer(re.escape(conj), normalised)]
            for cp in conj_pos:
                before = normalised[:cp]
                after = normalised[cp + len(conj):]
                brands_before = [b for b in found if b in before[-80:]]
                brands_after = [b for b in found if b in after[:80]]
                if brands_before and brands_after:
                    return list(dict.fromkeys(brands_before + brands_after))  # dedup, preserve order

    return []


# ── Category-specific extractors ───────────────────────────────────────────────

def _enrich_watches(text: str) -> dict[str, Any]:
    attrs: dict[str, Any] = {}

    brand = _first_match(text, _WATCH_BRANDS)
    if brand:
        attrs["brand_slug"] = brand

    model = _first_match(text, _WATCH_MODELS)
    if model:
        attrs["model"] = model

    # Movement type
    if any(k in text for k in ["automatic", "self-winding", "selfwinding", "auto wind"]):
        attrs["movement"] = "automatic"
    elif any(k in text for k in ["manual wind", "hand wind", "hand-wind"]):
        attrs["movement"] = "manual"
    elif "quartz" in text:
        attrs["movement"] = "quartz"

    # Case material
    if any(k in text for k in ["yellow gold case", "gold case", "solid gold"]):
        if "rose gold" in text:
            attrs["case_material"] = "rose_gold"
        elif "white gold" in text:
            attrs["case_material"] = "white_gold"
        else:
            attrs["case_material"] = "yellow_gold"
    elif "two-tone" in text or "two tone" in text:
        attrs["case_material"] = "two_tone"
    elif any(k in text for k in ["stainless steel", "stainless", "ss case"]):
        attrs["case_material"] = "stainless_steel"
    elif "titanium" in text:
        attrs["case_material"] = "titanium"
    elif "platinum" in text:
        attrs["case_material"] = "platinum"

    # Case size (mm)
    size = _extract_number(text, [r"(\d{2})\s*mm", r"(\d{2})mm\b"])
    if size and 20 <= size <= 65:
        attrs["case_size_mm"] = size

    # Dial color
    for color in ["black", "white", "blue", "silver", "champagne", "gold",
                  "grey", "gray", "green", "brown", "cream"]:
        if f"{color} dial" in text or f"dial {color}" in text:
            attrs["dial_color"] = color
            break

    # Complications
    complications = []
    for comp_slug, keywords in _WATCH_COMPLICATIONS:
        for kw in keywords:
            if kw in text:
                complications.append(comp_slug)
                break
    if complications:
        attrs["complications"] = complications

    # Bracelet / strap
    if "oyster bracelet" in text:
        attrs["bracelet"] = "oyster"
    elif "jubilee bracelet" in text:
        attrs["bracelet"] = "jubilee"
    elif "nato strap" in text or "nato band" in text:
        attrs["bracelet"] = "nato"
    elif any(k in text for k in ["leather strap", "leather band"]):
        attrs["bracelet"] = "leather"
    elif any(k in text for k in ["rubber strap", "rubber band", "oysterflex"]):
        attrs["bracelet"] = "rubber"

    # Box / papers
    if any(k in text for k in ["with box", "original box", "box and papers",
                                "full set", "complete set watch"]):
        attrs["has_box"] = True
    if any(k in text for k in ["with papers", "papers and", "card papers",
                                "warranty card"]):
        attrs["has_papers"] = True

    # Vintage indicator (pre-1990 references or the word vintage)
    if "vintage" in text:
        attrs["is_vintage"] = True
    else:
        # Year patterns like "1965", "1972"
        year_m = re.search(r"\b(19[2-8]\d)\b", text)
        if year_m:
            attrs["year_approx"] = int(year_m.group(1))
            attrs["is_vintage"] = True

    return attrs


def _enrich_jewelry(text: str) -> dict[str, Any]:
    attrs: dict[str, Any] = {}

    # Piece type
    for piece, keywords in [
        ("ring",      ["engagement ring", "wedding band", " ring ", "solitaire ring"]),
        ("necklace",  ["necklace", "pendant necklace", "lariat", "choker"]),
        ("bracelet",  ["bracelet", "bangle", "cuff bracelet", "tennis bracelet"]),
        ("earring",   ["earring", "earrings", "studs", "drops", "hoops"]),
        ("brooch",    ["brooch", "pin brooch", "fur pin"]),
        ("pendant",   ["pendant", "locket pendant"]),
        ("cufflinks", ["cufflink", "cufflinks", "cuff links"]),
        ("chain",     [" chain ", "link chain"]),
        ("locket",    ["locket"]),
    ]:
        for kw in keywords:
            if kw in text:
                attrs["piece_type"] = piece
                break
        if "piece_type" in attrs:
            break

    # Metal
    metal = _first_match(text, _JEWELRY_METALS)
    if metal:
        attrs["metal"] = metal

    # Primary stone
    stone = _first_match(text, _GEMSTONES)
    if stone:
        attrs["primary_stone"] = stone

    # Secondary stones (all matches minus first)
    all_stones = _all_matches(text, _GEMSTONES)
    secondary = [s for s in all_stones if s != stone]
    if secondary:
        attrs["secondary_stones"] = secondary[:3]

    # Carat weight
    carat_m = re.search(r"(\d+\.?\d*)\s*(?:ct|carat|ctw|carats)\b", text)
    if carat_m:
        attrs["carat_weight"] = float(carat_m.group(1))

    # Signed / maker's mark
    if _extract_is_signed(text):
        attrs["is_signed"] = True

    # Designer brand
    brand = _first_match(text, _JEWELRY_BRANDS)
    if brand:
        attrs["designer_brand"] = brand

    # Pair
    if "pair of" in text and any(k in text for k in ["earring", "cufflink", "brooch"]):
        attrs["is_pair"] = True

    return attrs


def _enrich_ceramics(text: str) -> dict[str, Any]:
    attrs: dict[str, Any] = {}

    # Sub-type
    for sub_type, keywords in [
        ("figurine",    ["figurine", "figure", "statuette"]),
        ("vase",        ["vase", "vases", "flower holder"]),
        ("ewer",        ["ewer", "pitcher and basin"]),
        ("pitcher",     ["pitcher", "ewer"]),
        ("bowl",        ["bowl", "serving bowl"]),
        ("plate",       ["plate", "dinner plate", "salad plate", "charger plate",
                         "cake plate"]),
        ("platter",     ["platter", "serving platter"]),
        ("tureen",      ["tureen", "soup tureen"]),
        ("teapot",      ["teapot", "tea pot"]),
        ("tea_set",     ["tea set", "tea service", "teaset"]),
        ("dinner_set",  ["dinner set", "dinner service", "place settings",
                         "service for", "piece set"]),
        ("cup_saucer",  ["cup and saucer", "cups and saucers"]),
        ("cachepot",    ["cachepot", "cache pot", "jardiniére"]),
        ("urn",         ["urn", "covered urn"]),
        ("tankard",     ["tankard", "stein", "beer stein"]),
        ("charger",     ["charger", "large charger plate"]),
    ]:
        for kw in keywords:
            if kw in text:
                attrs["sub_type"] = sub_type
                break
        if "sub_type" in attrs:
            break

    # Style / decoration
    style = _first_match(text, _CERAMIC_STYLES)
    if style:
        attrs["style"] = style

    # Piece count
    count = _extract_piece_count(text)
    if count:
        attrs["piece_count"] = count

    # Signed / marked
    if any(k in text for k in ["signed", "marked", "maker's mark", "backstamp",
                                "stamped", "incised mark"]):
        attrs["is_marked"] = True

    # Pattern name extraction — look for "pattern" preceded by a capitalised phrase
    pattern_m = re.search(
        r'"([^"]{3,40})"\s*pattern|(\w[\w\s]{2,30})\s+pattern\b',
        text, re.IGNORECASE
    )
    if pattern_m:
        pat_name = (pattern_m.group(1) or pattern_m.group(2) or "").strip()
        if pat_name and len(pat_name) > 2:
            attrs["pattern_name"] = pat_name[:60]

    return attrs


def _enrich_silver(text: str) -> dict[str, Any]:
    attrs: dict[str, Any] = {}

    purity = _first_match(text, _SILVER_PURITY)
    if purity:
        attrs["purity"] = purity

    sub_type_map = [
        ("flatware",       ["flatware", "silverware", "cutlery", "spoon", "fork",
                            "knife", "place setting"]),
        ("tea_service",    ["tea service", "coffee service", "tea set", "coffee set",
                            "teapot", "coffee pot"]),
        ("candelabra",     ["candelabra", "candlestick", "candelabrum"]),
        ("tray",           ["tray", "salver", "waiter"]),
        ("bowl",           ["silver bowl", "serving bowl", "punch bowl"]),
        ("pitcher",        ["pitcher", "ewer", "water pitcher"]),
        ("trophy",         ["trophy", "cup trophy"]),
        ("cigarette_case", ["cigarette case"]),
        ("card_case",      ["card case", "calling card case"]),
        ("frame",          ["picture frame", "photo frame"]),
    ]
    for sub_type, keywords in sub_type_map:
        for kw in keywords:
            if kw in text:
                attrs["sub_type"] = sub_type
                break
        if "sub_type" in attrs:
            break

    piece_count = _extract_piece_count(text)
    if piece_count:
        attrs["piece_count"] = piece_count

    # Pattern name
    pattern_m = re.search(
        r'"([^"]{3,40})"\s*pattern|(\w[\w\s]{2,30})\s+pattern\b',
        text, re.IGNORECASE
    )
    if pattern_m:
        pat = (pattern_m.group(1) or pattern_m.group(2) or "").strip()
        if pat and len(pat) > 2:
            attrs["pattern_name"] = pat[:60]

    # Weight
    weight_m = re.search(r"(\d+\.?\d*)\s*(?:troy\s*)?(?:oz|ounces?)\s*(?:troy)?", text)
    if weight_m:
        attrs["weight_oz"] = float(weight_m.group(1))

    return attrs


def _enrich_art(text: str) -> dict[str, Any]:
    attrs: dict[str, Any] = {}

    medium = _first_match(text, _ART_MEDIUMS)
    if medium:
        attrs["medium"] = medium

    if _extract_is_signed(text):
        attrs["is_signed"] = True

    if any(k in text for k in ["framed", "in frame", "with frame", "custom frame",
                                "original frame"]):
        attrs["is_framed"] = True

    # Dimensions
    dim_m = re.search(
        r"(\d+\.?\d*)\s*[\"x×by]\s*(\d+\.?\d*)\s*(?:inches?|in\.?|cm|\")?",
        text, re.IGNORECASE
    )
    if dim_m:
        attrs["width_in"] = float(dim_m.group(1))
        attrs["height_in"] = float(dim_m.group(2))

    # Edition info for prints
    edition_m = re.search(r"(\d+)\s*/\s*(\d+)", text)
    if edition_m:
        attrs["edition_number"] = int(edition_m.group(1))
        attrs["edition_size"] = int(edition_m.group(2))

    # Subject
    for subject, keywords in [
        ("portrait",     ["portrait", "portraiture"]),
        ("landscape",    ["landscape", "seascape", "cityscape"]),
        ("still_life",   ["still life", "still-life"]),
        ("abstract",     ["abstract", "non-objective"]),
        ("figurative",   ["figurative", "figure study", "nude"]),
        ("animal",       ["animal", "equestrian", "horse painting", "dog painting"]),
        ("religious",    ["religious", "madonna", "crucifixion", "saint"]),
    ]:
        for kw in keywords:
            if kw in text:
                attrs["subject"] = subject
                break
        if "subject" in attrs:
            break

    return attrs


def _enrich_furniture(text: str) -> dict[str, Any]:
    attrs: dict[str, Any] = {}

    style = _first_match(text, _FURNITURE_STYLES)
    if style:
        attrs["style"] = style

    maker = _first_match(text, _FURNITURE_MAKERS)
    if maker:
        attrs["furniture_maker"] = maker

    # Material
    for mat, keywords in [
        ("mahogany",  ["mahogany"]),
        ("walnut",    ["walnut"]),
        ("oak",       ["oak", "quarter-sawn oak", "quartersawn"]),
        ("cherry",    ["cherry wood", "cherry furniture"]),
        ("maple",     ["maple"]),
        ("rosewood",  ["rosewood"]),
        ("ebonized",  ["ebonized", "ebonised"]),
        ("bamboo",    ["bamboo furniture"]),
        ("wicker",    ["wicker", "rattan"]),
        ("painted",   ["painted furniture", "painted finish"]),
        ("gilt",      ["gilt wood", "giltwood", "gold leaf"]),
        ("lacquer",   ["lacquered", "japanned", "chinoiserie lacquer"]),
    ]:
        for kw in keywords:
            if kw in text:
                attrs["material"] = mat
                break
        if "material" in attrs:
            break

    # Piece type
    for pt, keywords in [
        ("chair",       ["armchair", "side chair", "rocking chair", "wingback"]),
        ("sofa",        ["sofa", "settee", "loveseat", "chesterfield"]),
        ("table",       ["dining table", "coffee table", "side table",
                         "end table", "console table"]),
        ("desk",        ["desk", "secretary desk", "davenport desk"]),
        ("dresser",     ["dresser", "chest of drawers", "highboy", "lowboy",
                         "bureau"]),
        ("cabinet",     ["cabinet", "vitrine", "display cabinet", "china cabinet"]),
        ("bookcase",    ["bookcase", "bookshelf", "etagere"]),
        ("wardrobe",    ["wardrobe", "armoire", "linen press"]),
        ("bed",         ["bed frame", "headboard", "bedstead"]),
        ("mirror",      ["mirror", "pier mirror", "cheval mirror"]),
        ("clock",       ["clock", "longcase clock", "bracket clock",
                         "mantel clock"]),
    ]:
        for kw in keywords:
            if kw in text:
                attrs["piece_type"] = pt
                break
        if "piece_type" in attrs:
            break

    if "pair of" in text or "pair ," in text:
        attrs["is_pair"] = True

    return attrs


def _enrich_coins(text: str) -> dict[str, Any]:
    attrs: dict[str, Any] = {}

    # Grade
    grade_m = re.search(r"\b(ms|pr|pf|au|vf|ef|xf|f|vg|g|ag|fa|p)\s*[-‐]?\s*(\d{2})\b",
                        text, re.IGNORECASE)
    if grade_m:
        attrs["grade"] = f"{grade_m.group(1).upper()}-{grade_m.group(2)}"

    # Grading service
    if "pcgs" in text:
        attrs["grading_service"] = "pcgs"
    elif "ngc" in text:
        attrs["grading_service"] = "ngc"
    elif "anacs" in text:
        attrs["grading_service"] = "anacs"

    # Denomination
    for denom, keywords in [
        ("double_eagle",   ["double eagle", "$20 gold", "twenty dollar gold"]),
        ("eagle",          ["eagle coin", "$10 gold", "ten dollar gold"]),
        ("half_eagle",     ["half eagle", "$5 gold", "five dollar gold"]),
        ("quarter_eagle",  ["quarter eagle", "$2.50 gold"]),
        ("dollar",         ["morgan dollar", "peace dollar", "silver dollar",
                            "trade dollar", "seated dollar"]),
        ("half_dollar",    ["half dollar", "walking liberty", "franklin half",
                            "barber half"]),
        ("quarter",        ["barber quarter", "standing liberty quarter",
                            "washington quarter"]),
        ("dime",           ["barber dime", "mercury dime", "roosevelt dime"]),
        ("cent",           ["lincoln cent", "indian cent", "flying eagle cent",
                            "large cent", "wheat cent"]),
    ]:
        for kw in keywords:
            if kw in text:
                attrs["denomination"] = denom
                break
        if "denomination" in attrs:
            break

    # Metal
    if any(k in text for k in ["gold coin", "gold eagle", "gold dollar", "$20 gold"]):
        attrs["metal"] = "gold"
    elif any(k in text for k in ["silver coin", "silver dollar", "morgan", "peace dollar"]):
        attrs["metal"] = "silver"
    elif "copper" in text:
        attrs["metal"] = "copper"
    elif "nickel" in text:
        attrs["metal"] = "nickel"

    # Year
    year_m = re.search(r"\b(1[789]\d{2}|20[012]\d)\b", text)
    if year_m:
        attrs["year"] = int(year_m.group(1))

    return attrs


# ── Main enrichment entry point ────────────────────────────────────────────────

def enrich(
    title: str,
    description: str | None,
    category: str | None,
) -> dict[str, Any]:
    """
    Extract structured attributes from a listing's text fields.

    Returns a dict with these top-level keys:
      maker               - primary maker/manufacturer slug (indexed)
      brand               - primary brand slug (may differ from maker for designer goods)
      collaboration_brands - list of brand slugs for collab items, else []
      period              - era/style period slug
      country_of_origin   - country slug
      attributes          - dict of category-specific structured fields

    All values are None / [] if not detected — never raises.
    """
    text = _build_text(title, description)
    result: dict[str, Any] = {
        "maker": None,
        "brand": None,
        "collaboration_brands": [],
        "period": None,
        "country_of_origin": None,
        "sub_category": None,
        "attributes": {},
    }

    # Universal
    result["period"] = _extract_period(text)
    result["country_of_origin"] = _extract_country(text)
    result["collaboration_brands"] = _extract_collaboration(text)
    if category:
        result["sub_category"] = _extract_sub_category(category, text)

    attrs: dict[str, Any] = {}

    if category == "watches":
        attrs = _enrich_watches(text)
        # Promote watch brand to top-level maker/brand
        brand_slug = attrs.pop("brand_slug", None)
        if brand_slug:
            result["maker"] = brand_slug
            result["brand"] = brand_slug

    elif category == "jewelry":
        attrs = _enrich_jewelry(text)
        designer = attrs.pop("designer_brand", None)
        if designer:
            result["brand"] = designer
            result["maker"] = designer
        # Check watch brands — handles mislabeled watches
        watch_brand = _first_match(text, _WATCH_BRANDS)
        if watch_brand and not result["brand"]:
            result["brand"] = watch_brand
            result["maker"] = watch_brand

    elif category == "ceramics":
        attrs = _enrich_ceramics(text)
        maker = _first_match(text, _CERAMIC_MAKERS)
        if maker:
            result["maker"] = maker
            result["brand"] = maker

    elif category == "silver":
        attrs = _enrich_silver(text)
        maker = _first_match(text, _SILVER_MAKERS)
        if maker:
            result["maker"] = maker
            result["brand"] = maker

    elif category == "art":
        attrs = _enrich_art(text)

    elif category == "furniture":
        attrs = _enrich_furniture(text)
        fmaker = attrs.pop("furniture_maker", None)
        if fmaker:
            result["maker"] = fmaker
            result["brand"] = fmaker
        style_slug = attrs.get("style")
        if style_slug and not result["period"]:
            # Furniture style often doubles as period
            result["period"] = style_slug

    elif category == "coins":
        attrs = _enrich_coins(text)

    # Universal attributes regardless of category
    piece_count = _extract_piece_count(text)
    if piece_count and "piece_count" not in attrs:
        attrs["piece_count"] = piece_count

    is_signed = _extract_is_signed(text)
    if is_signed and "is_signed" not in attrs:
        attrs["is_signed"] = True

    # Collaboration brands elevate into maker/brand if not already set
    if result["collaboration_brands"] and not result["brand"]:
        result["brand"] = result["collaboration_brands"][0]
        result["maker"] = result["collaboration_brands"][0]

    result["attributes"] = {k: v for k, v in attrs.items() if v is not None}
    return result


def auto_categorize(title: str, description: str | None) -> str | None:
    """
    Keyword-match a listing's text to a standard category slug.
    Uses the CATEGORY_KEYWORDS dict defined in this module.
    Identical signature to hydrate._auto_categorize — replaces it.
    """
    text = _build_text(title, description)
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return category
    return None
