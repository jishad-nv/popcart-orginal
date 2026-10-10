// Category mapper for the Popcarty catalogue (home, kitchen and lifestyle products).
// Scores a product name against keyword lists; the highest score wins.
export interface CategoryDef {
  id: string;
  name: string;
  iconName: string;
  description: string;
}

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    "id": "kitchen",
    "name": "Kitchen & Dining",
    "iconName": "UtensilsCrossed",
    "description": "Cookware, utensils, bottles, lunch boxes and everyday dining essentials."
  },
  {
    "id": "cleaning",
    "name": "Cleaning & Bathroom",
    "iconName": "Sparkles",
    "description": "Brushes, mops, laundry and bathroom essentials for a spotless home."
  },
  {
    "id": "storage",
    "name": "Storage & Organizers",
    "iconName": "Archive",
    "description": "Racks, boxes, hooks and organizers to keep every space tidy."
  },
  {
    "id": "decor",
    "name": "Home Decor & Lighting",
    "iconName": "Lamp",
    "description": "Lamps, wall decor, lights and pieces that style your home."
  },
  {
    "id": "tools",
    "name": "Tools & Hardware",
    "iconName": "Wrench",
    "description": "Hand tools, fittings and handy DIY gear for repairs and fixes."
  },
  {
    "id": "health",
    "name": "Health & Personal Care",
    "iconName": "HeartPulse",
    "description": "Massagers, supports and personal care for everyday wellness."
  },
  {
    "id": "beauty",
    "name": "Beauty & Grooming",
    "iconName": "Smile",
    "description": "Makeup, skincare and grooming products."
  },
  {
    "id": "kids",
    "name": "Toys & Kids",
    "iconName": "Puzzle",
    "description": "Toys, games and baby care for little ones."
  },
  {
    "id": "office",
    "name": "Office & Stationery",
    "iconName": "Pencil",
    "description": "Pens, notebooks, desk organizers and school supplies."
  },
  {
    "id": "mobile",
    "name": "Mobile & Electronics",
    "iconName": "Smartphone",
    "description": "Chargers, cables, mobile accessories and small electronics."
  },
  {
    "id": "fashion",
    "name": "Fashion & Accessories",
    "iconName": "Shirt",
    "description": "Jewellery, bracelets, wallets and style accessories."
  },
  {
    "id": "garden",
    "name": "Garden & Outdoors",
    "iconName": "Flower2",
    "description": "Planters, watering tools and garden essentials."
  },
  {
    "id": "auto",
    "name": "Car & Bike",
    "iconName": "Car",
    "description": "Car and bike accessories and care products."
  },
  {
    "id": "gifts",
    "name": "Gifts, Festive & Food",
    "iconName": "Gift",
    "description": "Rakhi, chocolates, festive items and gift ideas."
  },
  {
    "id": "sports",
    "name": "Sports & Travel",
    "iconName": "Dumbbell",
    "description": "Fitness gear, sports items and travel essentials."
  }
];

const KEYWORDS: Record<string, Record<string, string>> = {
  "gifts": {
    "5": "rakhi|rakshabandhan|raksha bandhan|chocolate|dryfruit|dry fruit|hamper|diwali|puja|pooja|idol|diya|lifafa|greeting card|christmas|laddu|namkeen|return gift|birthday gift|gift set|gift combo|trophy",
    "2": "gift|festival|wedding|roli|agarbatti|incense|kumkum|sweet"
  },
  "auto": {
    "5": "car|bike|motorcycle|scooter|dashboard|steering|helmet|tyre|tire|windshield|bicycle|cycle",
    "2": "vehicle|automotive|seat cover|number plate"
  },
  "kids": {
    "5": "toy|toys|kids|kid|baby|doll|teddy|plush|puzzle|slime|building blocks|rattle|pacifier|diaper|stroller|fidget|playset|play set|children|child",
    "2": "cartoon|school bag|balloon|dinosaur|robot|educational"
  },
  "mobile": {
    "5": "mobile|smartphone|phone|charger|charging|usb|type-c|earphone|earphones|earbud|earbuds|headphone|headphones|headset|speaker|bluetooth|power bank|powerbank|tripod|selfie|adapter|adaptor|keyboard|mouse|webcam|microphone|neckband|memory card|pen drive|otg|hdmi|aux|cable|wifi|smart watch|smartwatch|extension board|led strip|torch|flashlight|headlamp|walkie",
    "2": "rechargeable|battery|batteries|led light|remote|electric"
  },
  "office": {
    "5": "pen|pens|pencil|pencils|notebook|diary|stationery|stationary|stapler|marker|markers|highlighter|calculator|eraser|erasers|sharpener|ruler|crayon|crayons|sketch|whiteboard|clipboard|paper clip|binder clip|binder clips|file folder|sticky notes|notepad|planner|compass box|geometry|art and craft|water colour|watercolor|paint brush|pencil case|desk organizer|desk organiser",
    "2": "school|office|student|paper|folder|punch"
  },
  "beauty": {
    "5": "makeup|make-up|lipstick|lip gloss|lip balm|eyebrow|eyeliner|kajal|mascara|foundation|concealer|blush|nail polish|nail art|nail|serum|face cream|body cream|hand cream|lotion|sunscreen|moisturizer|moisturizing|shampoo|conditioner|face wash|facial|beard|razor|shaver|trimmer|hair dryer|hair cutting|straightener|curler|perfume|deodorant|body spray|eyelash|makeup brush|beauty blender|mehendi|mehndi|bindi|tweezer|epilator|hair removal|hair brush|comb|loofah|face roller|ice roller|face mask|sheet mask|skin|cosmetic|pedicure|manicure|salon|hair oil|hair color|hair colour|hair serum",
    "2": "beauty|grooming|mirror|powder|face|scrub|body|soap"
  },
  "health": {
    "5": "massager|massage|posture|corrector|knee|ankle|wrist support|back support|pain relief|thermometer|oximeter|bp monitor|glucose|insole|insoles|heel|sanitizer|first aid|medicine|pill|vitamin|supplement|steamer|nebulizer|heating pad|hot water bag|cervical|compression|toothbrush|toothbrushes|toothpaste|tooth|dental|floss|flosser|tongue cleaner|mouth|nasal|neti|eye mask|sleeping mask|acupressure|back scratcher|foot|callus|corn|bandage|ear cleaner|ear wax",
    "2": "health|relief|care|therapy|wellness|support|mask|sleep"
  },
  "garden": {
    "5": "plant|plants|garden|gardening|planter|flower pot|seed|seeds|watering|sprinkler|fertilizer|fertiliser|soil|grow bag|lawn|artificial grass|bonsai|hose pipe|matka stand|plucking|pruner|secateur",
    "2": "sprayer|outdoor|terrace|pot"
  },
  "fashion": {
    "5": "bracelet|bracelets|necklace|ring|rings|earring|earrings|jewellery|jewelry|pendant|bangle|bangles|anklet|wallet|purse|belt|scarf|stole|cap|hat|socks|sock|gloves|glove|handkerchief|sunglass|sunglasses|handbag|backpack|tote bag|clutch|keychain|keychains|key chain|key ring|brooch|cufflink|tie|tshirt|t-shirt|shirt|kurta|saree|dupatta|umbrella|slipper|slippers|sandal|sandals|shoe|shoes|headband|tank top|arm sleeves|sleeves|innerwear|bra|vest|watch",
    "2": "fashion|stylish|trendy|accessory|accessories"
  },
  "sports": {
    "5": "sport|sports|gym|yoga|fitness|exercise|workout|cricket|football|badminton|shuttlecock|skipping|dumbbell|dumbbells|resistance band|table tennis|tennis|basketball|volleyball|swimming|trekking|camping|luggage|passport|neck pillow|travel pillow|toiletry|packing|trolley bag|hand grip|gripper|abs|push up",
    "2": "travel|outdoor|ball|pump"
  },
  "tools": {
    "5": "tool|tools|drill|screwdriver|screw|screws|plier|pliers|hammer|spanner|wrench|measuring tape|tape measure|hardware|hinge|padlock|latch|bolt|nut|saw|chisel|sandpaper|soldering|glue gun|sealant|pvc|pipe|faucet|valve|clamp|vice|spirit level|anchor|cable tie|zip tie|tarpaulin|door stopper|door closer|door handle|door lock|doorbell|grinder|cutting disc|welding|nozzle|connector|tap|tap extender|shower head|teflon|insulation tape|duct tape|masking tape|tape",
    "2": "cutter|blade|rope|wire|lock|diy|repair|fitting|fittings"
  },
  "cleaning": {
    "5": "mop|broom|duster|dust pan|dustpan|wiper|squeegee|sponge|scrubber|scourer|laundry|detergent|stain remover|bleach|toilet|bathroom|shower|washing|bucket|dustbin|garbage|trash|towel|towels|napkin|napkins|tissue|soap dispenser|soap case|soap box|spray bottle|lint|cobweb|drain|sink|phenyl|disinfectant|floor|carpet cleaner|vacuum cleaner|toilet brush|cleaning|cleaner|cleaners|clean|brush|brushes|mosquito|insect|cockroach|pest|repellent|swatter|freshener|odonil|naphthalene|bath|doormat|door mat|bath mat|bathtub|geyser|basin|tap cleaner|window cleaning|glass cleaning",
    "2": "wash|soap|mat|hand wash|dispenser|dry"
  },
  "kitchen": {
    "5": "kitchen|cooking|cook|pan|pans|pot|pots|tawa|kadai|kadhai|wok|utensil|utensils|spoon|spoons|ladle|spatula|knife|knives|peeler|grater|chopper|slicer|bowl|bowls|plate|plates|tray|trays|cup|cups|mug|mugs|glass|glasses|bottle|bottles|flask|lunch box|lunch|tiffin|container|containers|jar|jars|masala|spice|rolling pin|chakla|belan|cutlery|fork|forks|tong|tongs|strainer|colander|sieve|chalni|whisk|blender|mixer|ice cube|ice tray|mould|mold|cake|baking|serving|dinner|casserole|thermos|tumbler|coaster|cookware|steamer|pressure cooker|kettle|toaster|fridge|refrigerator|egg|tea|coffee|chai|jug|pitcher|sipper|straw|dish|bartan|sandwich|pizza|dosa|idli|roti|chapati|paratha|noodle|pasta|salad|fruit|vegetable|barbecue|bbq|oven|microwave|gas lighter|gas stove|lighter|apron|cling film|aluminium foil|zip lock|vacuum sealer|sealer|bag clip|cutting board|chopping board|juicer|squeezer|opener|funnel|measuring cup|measuring spoon|hourglass|sand timer|water bottle|shaker|lunch bowl|meal|food|dining|hot pot|dish rack|dish drainer|cup holder|oil dispenser|oil sprayer",
    "2": "steel|stainless|plastic|silicone|ceramic|glassware|steel"
  },
  "decor": {
    "5": "decor|decoration|decorative|lamp|lamps|wallpaper|wall sticker|wall stickers|wall decal|frame|frames|showpiece|candle|candles|artificial flower|artificial flowers|vase|clock|curtain|curtains|cushion|wall hanging|fairy light|fairy lights|string light|string lights|rangoli|statue|figurine|miniature|poster|mural|tapestry|photo frame|album|night light|chandelier|lantern|diffuser|aroma|bedsheet|pillow|blanket|rug|table cloth|tablecloth|table runner|sofa|mattress|furniture|stool|crystal ball|led night|seashell|seashells",
    "2": "led|light|lights|wall|decorate|home decor|sticker|stickers|hanging"
  },
  "storage": {
    "5": "organizer|organizers|organiser|organisers|storage|rack|racks|shelf|shelves|hanger|hangers|hook|hooks|basket|baskets|drawer|drawers|holder|holders|caddy|cabinet|crate|stacker|divider|box|boxes|case|pouch|bag|bags|bin|cover|covers|piggy bank|coin box|key holder|stand|trolley",
    "2": "foldable|portable|multipurpose|multi-purpose|space saving|zipper"
  }
};

const STRONG: Record<string, string> = {
  "beauty": "nail clipper|nail cutter|nail file|manicure|pedicure|makeup|lipstick|hair dryer|face mask|face roller|gua sha|jade roller",
  "cleaning": "spray bottle|stain remover|soap dish|soap holder|soap case|toothbrush holder|toilet|garbage bag|dustbin bag|trash bag|cloth clip|cloth pin|cloth peg|clothes pin|clothes peg|clothesline|cloth hanger|wash basin|bathroom|shower|sink strainer|drain|scrubber|mop|broom|duster|sponge|detergent|laundry|keyboard cleaner kit",
  "fashion": "hair clip|hair band|hair accessor|scrunchie|waist bag|sling bag|shoulder bag|crossbody|wallet|keychain|key chain|keyring|bracelet|necklace|earring|jewellery|jewelry|sunglass|sunglasses|handbag|backpack|purse",
  "kitchen": "ice cream|scoop|water dispenser|water filter|water bottle|lunch box|tiffin|cutting board|chopping board|kitchen|spice|masala|rolling pin|cookware|frying pan|non stick|pressure cooker|peeler|knife set|cake|baking|dosa|idli|roti",
  "health": "tongue cleaner|tongue scraper|toothbrush|massager|massage gun|posture corrector|pain relief|hot water bag|heel pad|insole",
  "mobile": "mobile holder|phone holder|phone stand|mobile stand|mobile cover|phone cover|charger|usb cable|data cable|earphone|earbuds|headphone|power bank|bluetooth speaker|ethernet|lan cable|selfie stick|tripod|ring light",
  "storage": "cable clip|cable organizer|cable organiser|cable management|furniture pad|furniture pads|storage box|storage organizer|storage organiser|storage rack|shoe rack|wall hook|adhesive hook|hanging organizer|jewellery box",
  "decor": "incense holder|incense burner|smoke fountain|backflow|night light|led light|fairy light|string light|wall sticker|wallpaper|photo frame|artificial flower|curtain|showpiece|candle",
  "office": "tally counter|stationery|notebook|pencil|eraser|sharpener|geometry box|marker|stapler|binder clip|push pin|thumb tack|ball pen|ink pen|gel pen|diary|planner",
  "kids": "toy|toys|fidget|baby|kids|children|doll|puzzle|teddy|soft toy|slime|flashcard|educational",
  "gifts": "rakhi|rakshabandhan|raksha bandhan|chocolate|dry fruit|dryfruit|hamper|diwali|puja|pooja|idol|diya|lifafa|laddu",
  "tools": "screwdriver|drill|plier|hammer|spanner|wrench|measuring tape|sewing|saw|puncture repair|tool kit|toolkit|hand tool|door stopper|door closer|door lock",
  "garden": "garden|gardening|planter|flower pot|watering can|plant|seed|fertilizer",
  "auto": "car cover|bike cover|car perfume|car freshener|car seat|car floor|motorcycle|bike|helmet|windshield|steering",
  "sports": "skipping rope|jump rope|badminton|shuttlecock|table tennis|cricket|football|yoga|dumbbell|swimming|resistance band|gym"
};

const SOURCE_PRIOR: Record<string, string> = {
  "Home & Kitchen": "kitchen",
  "Kitchen Tool": "kitchen",
  "Home Improvement": "tools",
  "Other Products": "storage",
  "Health Care": "health",
  "Health & Beauty": "beauty",
  "Face & Body Care": "beauty",
  "Office": "office",
  "Mobile Accessories": "mobile",
  "Electronics": "mobile",
  "Toys": "kids",
  "Kids": "kids",
  "Baby Care": "kids",
  "Home Decor": "decor",
  "Automotive": "auto",
  "Fashion": "fashion",
  "Accessories": "fashion",
  "Bracelets": "fashion",
  "Garden": "garden",
  "Travel": "sports",
  "Sports": "sports",
  "Chocolates": "gifts",
  "Foods": "gifts",
  "Imported Goods": "storage",
  "Hardware": "tools",
  "Hardware Fittings": "tools",
  "Power & Hand Tools": "tools"
};

const termRx = (term: string) =>
  new RegExp('(?:^|[^a-z0-9])' + term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:e?s)?(?![a-z0-9])');

type Weighted = { weight: number; rx: RegExp };
const CATEGORY_ORDER = Object.keys(KEYWORDS);
const WEIGHTED: Record<string, Weighted[]> = {};
const STRONG_RX: Record<string, RegExp[]> = {};
for (const id of CATEGORY_ORDER) {
  WEIGHTED[id] = [];
  for (const [w, terms] of Object.entries(KEYWORDS[id])) {
    for (const t of terms.split('|')) if (t.trim()) WEIGHTED[id].push({ weight: Number(w), rx: termRx(t) });
  }
  STRONG_RX[id] = (STRONG[id] || '').split('|').filter((t) => t.trim()).map(termRx);
}

export const CATEGORY_IDS = CATEGORY_DEFS.map((c) => c.id);

export const getCategoryName = (id: string): string =>
  CATEGORY_DEFS.find((c) => c.id === id)?.name || 'Kitchen & Dining';

/** Remove the supplier SKU number some titles start with, e.g. "0065 Manual Juicer" -> "Manual Juicer". */
export const cleanProductName = (name: string): string =>
  String(name || '').replace(/^\s*#?\d+[a-z]?\s+/i, '').replace(/\s+/g, ' ').trim();

/** Returns the best category id for a product. sourceCategory is the supplier's own coarse type, if known. */
export const classifyProduct = (name: string, sourceCategory = ''): string => {
  const text = cleanProductName(name).toLowerCase();
  const head = text.slice(0, 45);
  const prior = SOURCE_PRIOR[sourceCategory];
  let bestId = '';
  let bestScore = 0;
  for (const id of CATEGORY_ORDER) {
    let score = 0;
    for (const { weight, rx } of WEIGHTED[id]) {
      if (rx.test(text)) {
        score += weight;
        if (rx.test(head)) score += 1;
      }
    }
    for (const rx of STRONG_RX[id]) {
      if (rx.test(text)) {
        score += 8;
        if (rx.test(head)) score += 2;
        break;
      }
    }
    if (id === prior) score += 3;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId || prior || 'storage';
};
