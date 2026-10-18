"""Curated myStyle style-inspiration catalogue.

These records are styling concepts with illustrative imagery and budget targets,
not claims of live retailer inventory, exact product availability, or live prices.
"""
from __future__ import annotations

PALETTES = [
    {"id": "earth", "label": "Warm earth tones", "description": "Cream, camel, olive, rust and warm browns"},
    {"id": "cool", "label": "Cool neutrals", "description": "Navy, charcoal, slate, crisp white and cool grey"},
    {"id": "jewel", "label": "Jewel tones", "description": "Emerald, sapphire, plum, berry and deep teal"},
    {"id": "pastel", "label": "Soft pastels", "description": "Blush, lavender, pale blue and soft mint"},
    {"id": "bright", "label": "Bright and saturated", "description": "Cobalt, vivid red, fuchsia and confident colour"},
    {"id": "monochrome", "label": "Monochrome", "description": "Black, white, grey and tonal layers"},
    {"id": "selfie", "label": "Let my skin analysis guide the palette", "description": "Use detected facial colour cues as optional inspiration"},
    {"id": "custom", "label": "My own colour scheme", "description": "Enter the colours you want to build around"},
]

STYLE_OPTIONS = [
    ["classic", "Classic and polished"], ["minimal", "Minimal and modern"],
    ["casual", "Elevated casual"], ["bohemian", "Bohemian and relaxed"],
    ["romantic", "Romantic and soft"], ["streetwear", "Streetwear"],
    ["edgy", "Edgy and alternative"], ["preppy", "Preppy"],
    ["creative", "Creative and expressive"], ["sporty", "Sporty and comfortable"],
    ["workwear", "Workwear"], ["trendy", "Trend-led"],
]

OCCASIONS = [
    ["everyday", "Everyday"], ["work", "Work"], ["weekend", "Weekend"],
    ["event", "Events and evenings"], ["travel", "Travel"], ["outdoors", "Outdoors"],
]

# id, name, category, description, style tags, colours, palette tags, seasons,
# climate types, occasions, target USD, target CAD, Unsplash/Pexels image, shopping query.
_ROWS = [
    ("soft-trench", "Relaxed trench coat", "Outerwear", "A light, structured layer for transitional weather.", ["classic", "minimal", "workwear"], ["Camel", "Stone", "Navy"], ["earth", "cool", "neutral"], ["spring", "fall"], ["mild", "variable"], ["work", "everyday", "travel"], 95, 129, "https://images.unsplash.com/photo-1548624149-f5c4e5b4a3b9?auto=format&fit=crop&w=900&q=85", "women men relaxed trench coat neutral"),
    ("relaxed-blazer", "Relaxed tailored blazer", "Jackets", "Adds structure over a tee, knit or button-down without feeling formal.", ["classic", "minimal", "workwear", "preppy"], ["Charcoal", "Navy", "Taupe"], ["cool", "monochrome", "earth", "neutral"], ["spring", "fall", "winter"], ["mild", "variable", "cold"], ["work", "event", "everyday"], 85, 115, "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=85", "relaxed tailored blazer charcoal navy"),
    ("cream-knit", "Soft crewneck knit", "Knitwear", "A dependable mid-layer for cool mornings and easy weekend looks.", ["classic", "minimal", "casual", "preppy"], ["Cream", "Oatmeal", "Grey"], ["earth", "cool", "neutral", "pastel"], ["fall", "winter", "spring"], ["cold", "variable", "mild"], ["everyday", "weekend", "travel"], 55, 75, "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=85", "crewneck knit sweater cream oatmeal"),
    ("plaid-overshirt", "Plaid overshirt", "Layering", "An easy extra layer with texture that works over a tee or fine knit.", ["casual", "edgy", "streetwear", "creative"], ["Burgundy", "Forest green", "Black"], ["earth", "jewel", "monochrome"], ["fall", "winter", "spring"], ["cold", "variable", "mild"], ["everyday", "weekend", "outdoors"], 48, 65, "https://images.pexels.com/photos/9929701/pexels-photo-9929701.jpeg?auto=compress&cs=tinysrgb&w=900", "plaid overshirt shacket burgundy green"),
    ("utility-jacket", "Utility jacket", "Outerwear", "A practical layer with clean lines and useful pockets.", ["casual", "minimal", "edgy", "streetwear", "outdoors"], ["Black", "Olive", "Charcoal"], ["earth", "cool", "monochrome"], ["spring", "fall"], ["mild", "variable"], ["everyday", "weekend", "outdoors", "travel"], 72, 98, "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=85", "black olive utility jacket women men"),
    ("white-tee", "Premium white T-shirt", "Tops", "A clean foundation for denim, tailoring, skirts and layered outfits.", ["classic", "minimal", "casual", "streetwear"], ["White", "Cream", "Black"], ["cool", "monochrome", "neutral"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], ["everyday", "weekend", "travel"], 22, 30, "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85", "premium heavyweight white cotton t shirt"),
    ("statement-shirt", "Print or colour statement shirt", "Tops", "A versatile button-down that gives a neutral outfit more personality.", ["creative", "trendy", "bohemian", "classic"], ["Ink blue", "Rust", "Berry"], ["earth", "jewel", "bright"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], ["work", "event", "everyday"], 42, 57, "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85", "women men statement button down shirt print"),
    ("wide-leg-denim", "Relaxed wide-leg denim", "Denim", "An easy silhouette that pairs with fitted knits, tees and structured jackets.", ["casual", "classic", "streetwear", "bohemian"], ["Indigo", "Washed black", "Light blue"], ["cool", "monochrome", "neutral"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], ["everyday", "weekend", "travel"], 58, 79, "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=85", "relaxed wide leg denim jeans"),
    ("tailored-trousers", "Straight-leg tailored trousers", "Bottoms", "A polished base that moves between office, dinner and smart-casual outfits.", ["classic", "minimal", "workwear", "preppy"], ["Black", "Navy", "Taupe"], ["cool", "monochrome", "earth", "neutral"], ["spring", "fall", "winter"], ["mild", "variable", "cold"], ["work", "event", "everyday"], 62, 84, "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=900&q=85", "straight leg tailored trousers black navy taupe"),
    ("linen-pants", "Relaxed linen-blend trousers", "Bottoms", "Breathable-looking, loose tailoring for warm days and travel.", ["minimal", "casual", "bohemian", "classic"], ["Ecru", "Olive", "Sand"], ["earth", "neutral"], ["spring", "summer"], ["warm", "mild"], ["everyday", "weekend", "travel"], 48, 65, "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=85", "linen blend relaxed trousers ecru olive"),
    ("midi-dress", "Everyday midi dress", "Dresses", "A one-piece outfit anchor that can be layered up or worn on its own.", ["romantic", "classic", "bohemian", "trendy"], ["Navy", "Berry", "Floral"], ["jewel", "cool", "earth", "pastel"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], ["event", "everyday", "weekend"], 68, 92, "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=85", "everyday midi dress navy floral berry"),
    ("soft-cardigan", "Textured cardigan", "Knitwear", "An adaptable layer for temperature swings and relaxed tailoring.", ["classic", "romantic", "preppy", "casual"], ["Blush", "Cream", "Sage"], ["pastel", "earth", "neutral"], ["spring", "fall", "winter"], ["cold", "variable", "mild"], ["everyday", "work", "weekend"], 52, 70, "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=85", "textured cardigan cream sage blush"),
    ("wool-coat", "Long wool-blend coat", "Outerwear", "A cold-weather outer layer for commuting, work and polished weekend looks.", ["classic", "minimal", "workwear"], ["Camel", "Charcoal", "Black"], ["earth", "cool", "monochrome", "neutral"], ["winter", "fall"], ["cold"], ["work", "everyday", "travel"], 145, 195, "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=900&q=85", "long wool blend coat camel charcoal"),
    ("rain-shell", "Lightweight rain shell", "Outerwear", "A practical weather layer for wet spring days and variable forecasts.", ["sporty", "casual", "minimal", "outdoors"], ["Navy", "Olive", "Bright red"], ["cool", "earth", "bright"], ["spring", "fall"], ["variable", "mild", "cold"], ["outdoors", "travel", "everyday"], 78, 105, "https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=900&q=85", "lightweight rain shell jacket navy olive"),
    ("sneakers", "Minimal everyday sneakers", "Shoes", "A low-profile option to ground denim, casual trousers or dresses.", ["casual", "minimal", "sporty", "streetwear"], ["White", "Grey", "Black"], ["cool", "monochrome", "neutral"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], ["everyday", "weekend", "travel"], 62, 84, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85", "minimal everyday sneakers white grey"),
    ("ankle-boots", "Everyday ankle boots", "Shoes", "A season-spanning shoe that balances trousers, denim and dresses.", ["classic", "edgy", "workwear"], ["Black", "Chocolate", "Tan"], ["earth", "monochrome", "neutral"], ["fall", "winter", "spring"], ["cold", "variable", "mild"], ["work", "everyday", "event"], 88, 119, "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=900&q=85", "women everyday ankle boots black tan"),
    ("loafers", "Classic loafers", "Shoes", "A structured shoe for an easy polished finish without a heel.", ["classic", "preppy", "minimal", "workwear"], ["Black", "Burgundy", "Brown"], ["monochrome", "jewel", "earth"], ["spring", "summer", "fall"], ["mild", "variable", "warm"], ["work", "event", "everyday"], 75, 102, "https://images.unsplash.com/photo-1531310197839-ccf54634509e?auto=format&fit=crop&w=900&q=85", "classic leather loafers black burgundy"),
    ("crossbody-bag", "Everyday crossbody bag", "Accessories", "A practical accessory that adds polish without overpowering the outfit.", ["classic", "minimal", "casual", "trendy"], ["Black", "Tan", "Burgundy"], ["monochrome", "earth", "jewel"], ["spring", "summer", "fall", "winter"], ["all"], ["everyday", "travel", "event"], 58, 79, "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=85", "everyday crossbody bag black tan burgundy"),
    ("soft-blouse", "Soft draped blouse", "Tops", "An easy elevated top for work, dinner or a polished everyday outfit.", ["romantic", "classic", "workwear", "minimal"], ["Ivory", "Blush", "Sage"], ["pastel", "earth", "neutral"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], ["work", "event", "everyday"], 46, 62, "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85", "draped blouse ivory blush sage women"),
    ("statement-knit", "Colour-block knit", "Knitwear", "A focal point for a simple outfit when you want colour without a busy print.", ["creative", "trendy", "streetwear", "casual"], ["Cobalt", "Cream", "Berry"], ["bright", "jewel", "cool"], ["fall", "winter", "spring"], ["cold", "variable", "mild"], ["everyday", "weekend", "event"], 64, 87, "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=900&q=85", "colour block knit sweater cobalt cream berry"),
    ("pleated-skirt", "Pleated midi skirt", "Bottoms", "A movement-friendly piece that pairs with knits, tees or a fitted shirt.", ["romantic", "preppy", "classic", "trendy"], ["Navy", "Black", "Sage"], ["cool", "monochrome", "earth"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], ["work", "event", "weekend"], 54, 73, "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=900&q=85", "pleated midi skirt navy black sage"),
    ("weekend-hoodie", "Elevated everyday hoodie", "Layering", "A casual comfort piece that works under a shell or with structured trousers.", ["sporty", "streetwear", "casual", "minimal"], ["Grey", "Navy", "Olive"], ["cool", "earth", "neutral"], ["fall", "winter", "spring"], ["cold", "variable", "mild"], ["everyday", "weekend", "travel", "outdoors"], 48, 65, "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=85", "elevated heavyweight hoodie grey navy olive"),
    ("linen-shirt", "Linen button-down", "Tops", "A breathable-looking warm-weather staple worn open, tucked or relaxed.", ["classic", "minimal", "bohemian", "casual"], ["White", "Sky blue", "Sand"], ["cool", "earth", "pastel", "neutral"], ["spring", "summer"], ["warm", "mild"], ["everyday", "weekend", "travel", "work"], 44, 60, "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=900&q=85", "linen button down shirt white sky blue sand"),
    ("silk-scarf", "Printed silk-blend scarf", "Accessories", "A lightweight accessory that brings a considered colour accent to coats and knitwear.", ["classic", "creative", "romantic", "bohemian"], ["Rust", "Olive", "Burgundy", "Navy"], ["earth", "jewel", "cool"], ["spring", "summer", "fall", "winter"], ["all"], ["everyday", "work", "travel", "event"], 32, 44, "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&q=85", "printed silk scarf rust olive burgundy"),
    ("structured-cap", "Structured everyday cap", "Accessories", "A simple headwear option for casual days and travel.", ["casual", "sporty", "streetwear", "minimal"], ["Navy", "Olive", "Black", "Cream"], ["cool", "earth", "monochrome"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], ["everyday", "weekend", "travel", "outdoors"], 26, 35, "https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=85", "unisex structured baseball cap navy olive"),
    ("mens-oxford-shirt", "Classic Oxford shirt", "Tops", "A versatile button-down with a clean collar and easy structure for work or weekends.", ["classic", "preppy", "workwear", "minimal"], ["White", "Sky blue", "Navy"], ["cool", "monochrome", "neutral"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], ["work", "everyday", "event"], 48, 65, "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85", "men's classic oxford shirt white sky blue"),
]

FIT_TAGS = {
    "relaxed": {"plaid-overshirt", "utility-jacket", "wide-leg-denim", "linen-pants", "soft-cardigan", "cream-knit", "weekend-hoodie", "linen-shirt", "sneakers", "relaxed-blazer"},
    "structured": {"soft-trench", "relaxed-blazer", "tailored-trousers", "wool-coat", "loafers", "ankle-boots", "soft-blouse", "pleated-skirt"},
    "close": {"white-tee", "soft-blouse", "midi-dress", "statement-shirt", "linen-shirt", "sneakers"},
}

ITEMS = [
    {
        "id": row[0], "name": row[1], "category": row[2], "description": row[3],
        "style_tags": row[4], "colors": row[5], "palettes": row[6], "seasons": row[7],
        "climates": row[8], "occasions": row[9], "target_usd": row[10], "target_cad": row[11],
        "fit_tags": sorted({fit for fit, ids in FIT_TAGS.items() if row[0] in ids} | {"balanced"}),
        "image_url": row[12],
        "image_source_url": "https://www.pexels.com/" if "pexels.com" in row[12] else "https://unsplash.com/",
        "image_credit": "Editorial inspiration image", "shop_query": row[13],
        "image_disclaimer": "Inspiration image; not a live retailer product photo.",
    }
    for row in _ROWS
]

# Gender tags describe the intended styling of each editorial concept, not a user's
# identity. Every item is explicitly classified; items are never silently treated as
# unisex merely because their catalogue record lacked a gender tag. This matters because
# several source images are clearly womenswear editorial images even when the garment type
# (for example, a coat or trousers) can be worn by anyone.
WOMEN_ONLY = {
    "soft-trench", "wide-leg-denim", "tailored-trousers", "linen-pants",
    "midi-dress", "soft-cardigan", "wool-coat", "ankle-boots", "crossbody-bag",
    "soft-blouse", "pleated-skirt",
}
MEN_ONLY = {"mens-oxford-shirt", "plaid-overshirt", "utility-jacket", "statement-shirt", "weekend-hoodie", "linen-shirt"}
UNISEX_ITEMS = {
    "relaxed-blazer", "cream-knit", "white-tee", "statement-knit", "rain-shell",
    "sneakers", "loafers", "silk-scarf", "structured-cap",
}
ACCESSORY_TRY_ON_KINDS = {
    "crossbody-bag": "bag", "silk-scarf": "scarf", "structured-cap": "hat",
    "sneakers": "shoes", "ankle-boots": "shoes", "loafers": "shoes",
}
for item in ITEMS:
    original_category = item["category"]
    if original_category == "Shoes":
        item["subcategory"] = "Shoes"
        item["category"] = "Accessories"
    if item["category"] == "Accessories":
        item["item_type"] = "accessory"
        item["try_on_kind"] = ACCESSORY_TRY_ON_KINDS.get(item["id"], "bag")
    else:
        item["item_type"] = "clothing"
    if item["id"] in WOMEN_ONLY:
        item["gender_tags"] = ["women"]
    elif item["id"] in MEN_ONLY:
        item["gender_tags"] = ["men"]
    elif item["id"] in UNISEX_ITEMS:
        item["gender_tags"] = ["unisex"]
    else:
        raise ValueError(f"Catalogue item {item['id']!r} has no explicit gender classification")



# Expand the concept repository into a real, searchable set of visual style references.
# Each gender group contains 110 clothing concepts plus 25 accessory concepts. Images
# are locally generated illustrations tied to each record's actual silhouette and colours,
# rather than reused editorial photographs that can contradict the title.
_CLOTHING_ARCHETYPES = [
    ("crewneck T-shirt", "Tops", "A versatile foundation for simple, layered outfits.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 24, ["casual", "minimal"]),
    ("cotton poplin shirt", "Tops", "A crisp shirt that works tucked, layered or worn loose.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 42, ["classic", "workwear"]),
    ("draped blouse", "Tops", "A soft top for polished everyday or evening dressing.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 46, ["classic", "romantic"]),
    ("ribbed tank top", "Tops", "A close, lightweight layer for warm days and underpinnings.", ["spring", "summer"], ["warm", "mild"], 20, ["minimal", "casual"]),
    ("knit polo", "Knitwear", "A neat knit that bridges casual and polished looks.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 44, ["classic", "preppy"]),
    ("mock-neck top", "Tops", "A clean neckline that layers easily beneath jackets.", ["fall", "winter", "spring"], ["cold", "variable", "mild"], 36, ["minimal", "classic"]),
    ("fine-knit crewneck sweater", "Knitwear", "A light knit for office layers and everyday wear.", ["fall", "winter", "spring"], ["cold", "variable", "mild"], 58, ["classic", "minimal"]),
    ("textured cardigan", "Knitwear", "An easy extra layer for shifting temperatures.", ["fall", "winter", "spring"], ["cold", "variable", "mild"], 54, ["classic", "casual"]),
    ("pullover hoodie", "Layering", "A comfortable layer for relaxed daily outfits.", ["fall", "winter", "spring"], ["cold", "variable", "mild"], 52, ["casual", "streetwear"]),
    ("zip-front sweatshirt", "Layering", "A sport-influenced layer with practical versatility.", ["fall", "winter", "spring"], ["cold", "variable", "mild"], 48, ["sporty", "casual"]),
    ("tailored blazer", "Jackets", "Adds structure to denim, knitwear and smart-casual outfits.", ["spring", "fall", "winter"], ["cold", "variable", "mild"], 92, ["classic", "workwear"]),
    ("denim jacket", "Jackets", "A casual outer layer with useful structure and texture.", ["spring", "fall"], ["mild", "variable"], 72, ["casual", "classic"]),
    ("utility jacket", "Outerwear", "A practical outer layer with clean lines and useful pockets.", ["spring", "fall"], ["mild", "variable"], 88, ["casual", "edgy"]),
    ("trench coat", "Outerwear", "A transitional layer for commuting and smart casual outfits.", ["spring", "fall"], ["mild", "variable"], 128, ["classic", "workwear"]),
    ("wool-blend coat", "Outerwear", "A warm, structured layer for colder weather.", ["fall", "winter"], ["cold"], 155, ["classic", "minimal"]),
    ("quilted jacket", "Outerwear", "A lightweight insulated layer for variable weather.", ["fall", "winter", "spring"], ["cold", "variable"], 98, ["casual", "outdoors"]),
    ("lightweight rain shell", "Outerwear", "A practical layer for wet or changeable days.", ["spring", "fall"], ["mild", "variable", "cold"], 84, ["sporty", "outdoors"]),
    ("straight-leg jeans", "Denim", "An everyday denim silhouette that balances most tops.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 64, ["casual", "classic"]),
    ("wide-leg jeans", "Denim", "A relaxed denim shape with a clean, modern line.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 68, ["casual", "streetwear"]),
    ("tailored trousers", "Bottoms", "A polished base for work and smart-casual dressing.", ["spring", "fall", "winter"], ["mild", "variable", "cold"], 72, ["classic", "workwear"]),
    ("relaxed chinos", "Bottoms", "A versatile casual trouser with a softer structure.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 56, ["classic", "casual"]),
    ("linen-blend trousers", "Bottoms", "A breathable-looking trouser for warmer days.", ["spring", "summer"], ["warm", "mild"], 54, ["minimal", "casual"]),
    ("cargo trousers", "Bottoms", "A practical shape with utility-inspired details.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 62, ["streetwear", "edgy"]),
    ("tailored shorts", "Bottoms", "A warm-weather bottom with a considered finish.", ["spring", "summer"], ["warm", "mild"], 38, ["classic", "minimal"]),
    ("everyday leggings", "Activewear", "A flexible base for travel, movement and relaxed days.", ["spring", "summer", "fall", "winter"], ["all"], 42, ["sporty", "casual"]),
    ("performance joggers", "Activewear", "A comfortable silhouette for movement and casual wear.", ["spring", "summer", "fall", "winter"], ["all"], 48, ["sporty", "streetwear"]),
    ("pleated midi skirt", "Skirts", "A fluid silhouette that pairs with simple knits and shirts.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 56, ["classic", "romantic"]),
    ("A-line skirt", "Skirts", "A clean skirt shape for everyday or occasion dressing.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 52, ["classic", "preppy"]),
    ("wrap midi dress", "Dresses", "A one-piece option for events and elevated everyday outfits.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 76, ["romantic", "classic"]),
    ("knit midi dress", "Dresses", "A simple one-piece layer for cooler days and evenings.", ["fall", "winter", "spring"], ["cold", "variable", "mild"], 82, ["minimal", "classic"]),
    ("relaxed jumpsuit", "Dresses", "A one-piece outfit with a practical, modern silhouette.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 86, ["minimal", "creative"]),
    ("fleece quarter-zip", "Layering", "A warm, practical mid-layer for casual and outdoor outfits.", ["fall", "winter", "spring"], ["cold", "variable"], 58, ["sporty", "outdoors"]),
    ("overshirt", "Layering", "An easy layer between a shirt and a light jacket.", ["spring", "fall", "winter"], ["cold", "variable", "mild"], 62, ["casual", "streetwear"]),
    ("long-sleeve base layer", "Activewear", "A close-fitting layer for cooler days and under jackets.", ["fall", "winter", "spring"], ["cold", "variable"], 34, ["sporty", "minimal"]),
    ("puffer vest", "Outerwear", "Adds warmth without the bulk of a full coat.", ["fall", "winter", "spring"], ["cold", "variable"], 78, ["sporty", "outdoors"]),
    ("linen camp-collar shirt", "Tops", "A relaxed warm-weather shirt with an easy collar.", ["spring", "summer"], ["warm", "mild"], 46, ["casual", "bohemian"]),
    ("merino turtleneck", "Knitwear", "A fine knit that layers neatly under tailoring and coats.", ["fall", "winter"], ["cold", "variable"], 68, ["classic", "minimal"]),
    ("technical running top", "Activewear", "A lightweight layer for active routines and travel.", ["spring", "summer", "fall"], ["warm", "mild", "variable"], 40, ["sporty", "minimal"]),
    ("corduroy trousers", "Bottoms", "A textured trouser for transitional and cold-weather outfits.", ["fall", "winter"], ["cold", "variable"], 66, ["classic", "edgy"]),
    ("denim shorts", "Bottoms", "A relaxed short for warmer days and weekends.", ["spring", "summer"], ["warm", "mild"], 40, ["casual", "streetwear"]),
]
_ACCESSORY_ARCHETYPES = [
    ("structured tote bag", "Bags", 62, ["classic", "workwear"], "bag"),
    ("everyday crossbody bag", "Bags", 56, ["classic", "casual"], "bag"),
    ("compact shoulder bag", "Bags", 54, ["classic", "trendy"], "bag"),
    ("weekend backpack", "Bags", 58, ["casual", "outdoors"], "bag"),
    ("minimal belt", "Belts", 28, ["classic", "minimal"], "belt"),
    ("woven belt", "Belts", 32, ["casual", "bohemian"], "belt"),
    ("printed scarf", "Scarves", 28, ["classic", "creative"], "scarf"),
    ("soft knit scarf", "Scarves", 34, ["classic", "casual"], "scarf"),
    ("structured cap", "Hats", 26, ["casual", "sporty"], "hat"),
    ("ribbed beanie", "Hats", 24, ["casual", "streetwear"], "hat"),
    ("low-top sneakers", "Shoes", 72, ["casual", "minimal"], "shoes"),
    ("running shoes", "Shoes", 88, ["sporty", "outdoors"], "shoes"),
    ("classic loafers", "Shoes", 82, ["classic", "workwear"], "shoes"),
    ("ankle boots", "Shoes", 94, ["classic", "edgy"], "shoes"),
    ("simple pendant necklace", "Jewellery", 30, ["classic", "minimal"], "jewelry"),
    ("small hoop earrings", "Jewellery", 28, ["classic", "romantic"], "jewelry"),
    ("leather-strap watch", "Watches", 70, ["classic", "workwear"], "watch"),
    ("rectangular sunglasses", "Eyewear", 38, ["classic", "edgy"], "sunglasses"),
    ("beaded bracelet", "Jewellery", 22, ["creative", "bohemian"], "jewelry"),
    ("compact card holder", "Small leather goods", 24, ["classic", "minimal"], "wallet"),
]
_EXTENDED_COLORS = [
    ("Navy", ["cool", "monochrome"]), ("White", ["cool", "monochrome"]),
    ("Black", ["monochrome", "cool"]), ("Cream", ["earth", "neutral"]),
    ("Olive", ["earth"]), ("Burgundy", ["jewel", "earth"]),
    ("Rust", ["earth", "bright"]), ("Forest green", ["earth", "jewel"]),
    ("Charcoal", ["cool", "monochrome"]), ("Lavender", ["pastel"]),
    ("Camel", ["earth"]), ("Cobalt", ["bright", "jewel"]),
    ("Blush", ["pastel"]), ("Ecru", ["earth", "neutral"]),
    ("Sky blue", ["pastel", "cool"]), ("Chocolate", ["earth"]),
]
_MODIFIERS = ["classic", "relaxed", "tailored", "textured", "lightweight", "structured", "modern", "soft", "utility", "minimal", "ribbed", "oversized"]
_PATTERN_TYPES = ["solid", "solid", "solid", "striped", "solid", "colour-block", "solid", "printed", "solid", "plaid", "solid", "solid"]
_STYLE_SET = ["classic", "minimal", "casual", "streetwear", "creative", "sporty", "workwear", "preppy", "edgy", "romantic", "bohemian", "trendy"]
_OCCASION_SET = ["everyday", "work", "weekend", "event", "travel", "outdoors"]


def _generated_colours(index: int) -> tuple[str, list[str], str]:
    primary, palettes = _EXTENDED_COLORS[index % len(_EXTENDED_COLORS)]
    pattern = _PATTERN_TYPES[index % len(_PATTERN_TYPES)]
    if pattern in {"striped", "colour-block", "printed", "plaid"}:
        second, second_palettes = _EXTENDED_COLORS[(index * 5 + 3) % len(_EXTENDED_COLORS)]
        if second == primary:
            second, second_palettes = _EXTENDED_COLORS[(index + 1) % len(_EXTENDED_COLORS)]
        if pattern == "striped":
            colours = [primary, second]
        elif pattern == "colour-block":
            colours = [primary, second]
        elif pattern == "plaid":
            colours = [primary, second]
        else:
            third, third_palettes = _EXTENDED_COLORS[(index * 7 + 5) % len(_EXTENDED_COLORS)]
            colours = list(dict.fromkeys([primary, second, third]))
            second_palettes = second_palettes + third_palettes
        palettes = list(dict.fromkeys(palettes + second_palettes))
        return primary, colours, pattern
    return primary, [primary], "solid"


def _generate_catalogue_item(gender: str, item_type: str, index: int) -> dict[str, Any]:
    gender_label = {"women": "Women's", "men": "Men's", "unisex": "Gender-neutral"}[gender]
    if item_type == "clothing":
        archetype = _CLOTHING_ARCHETYPES[index % len(_CLOTHING_ARCHETYPES)]
        base_name, category, description, seasons, climates, base_price, preferred_styles = archetype
        primary, colours, pattern = _generated_colours(index * 3 + (0 if gender == "women" else 5 if gender == "men" else 9))
        modifier = _MODIFIERS[(index // len(_CLOTHING_ARCHETYPES) + index // 9) % len(_MODIFIERS)]
        pattern_label = {"striped": "striped", "colour-block": "colour-block", "printed": "printed", "plaid": "plaid"}.get(pattern)
        if pattern_label:
            modifier = _MODIFIERS[(index // len(_CLOTHING_ARCHETYPES) + index // 9) % len(_MODIFIERS)]
            if len(colours) == 1:
                name = f"{gender_label} {primary} {pattern_label} {modifier} {base_name}"
            elif len(colours) == 2:
                name = f"{gender_label} {primary} and {colours[1]} {pattern_label} {modifier} {base_name}"
            else:
                name = f"{gender_label} {', '.join(colours)} {pattern_label} {modifier} {base_name}"
        else:
            name = f"{gender_label} {primary} {modifier} {base_name}"
        kind = "clothing"
        subcategory = category
        try_on_kind = None
    else:
        base_name, subcategory, base_price, preferred_styles, try_on_kind = _ACCESSORY_ARCHETYPES[index % len(_ACCESSORY_ARCHETYPES)]
        primary, colours, pattern = _generated_colours(index * 5 + (1 if gender == "women" else 6 if gender == "men" else 10))
        pattern_label = {"striped": "striped", "colour-block": "colour-block", "printed": "printed", "plaid": "plaid"}.get(pattern)
        if pattern_label and len(colours) > 1:
            name = f"{gender_label} {', '.join(colours)} {pattern_label} {base_name}"
        else:
            name = f"{gender_label} {primary} {_MODIFIERS[(index // len(_ACCESSORY_ARCHETYPES)) % len(_MODIFIERS)]} {base_name}"
        category = "Accessories"
        kind = "accessory"
        description = f"A {base_name} concept in {', '.join(colours)} for coordinated everyday styling."
        seasons = ["spring", "summer", "fall", "winter"] if subcategory in {"Bags", "Belts", "Jewellery", "Watches", "Eyewear", "Small leather goods"} else (["fall", "winter", "spring"] if subcategory in {"Scarves", "Hats"} else ["spring", "summer", "fall"])
        climates = ["all"] if subcategory not in {"Scarves", "Hats"} else ["cold", "variable", "mild"]
    palette_ids = []
    for colour in colours:
        palette_ids.extend(_EXTENDED_COLORS[next(i for i, row in enumerate(_EXTENDED_COLORS) if row[0] == colour)][1])
    palette_ids = list(dict.fromkeys(palette_ids)) or ["neutral"]
    style_tags = list(dict.fromkeys([preferred_styles[index % len(preferred_styles)], _STYLE_SET[(index + (2 if gender == "men" else 4 if gender == "unisex" else 0)) % len(_STYLE_SET)]]))
    occasion = _OCCASION_SET[index % len(_OCCASION_SET)]
    season_list = list(seasons)
    item_id = f"expanded-{gender}-{item_type}-{index + 1:03d}"
    # Stable, distinct IDs become the names of the matching local illustration assets.
    item = {
        "id": item_id, "name": name, "category": category, "subcategory": subcategory,
        "description": description, "style_tags": style_tags, "colors": colours,
        "palettes": palette_ids, "seasons": season_list, "climates": climates,
        "occasions": [occasion], "target_usd": int(base_price + (index % 4) * 3),
        "target_cad": int(round((base_price + (index % 4) * 3) * 1.36)),
        "fit_tags": list(dict.fromkeys([_MODIFIERS[(index + 2) % len(_MODIFIERS)], "balanced"])),
        "image_url": f"/assets/catalog/{item_id}.svg", "image_source_url": None,
        "image_credit": "Generated myStyle style illustration", "shop_query": f"{gender_label} {name}",
        "image_disclaimer": "Generated illustration of the named style and colours; not a retail product photograph.",
        "gender_tags": [gender], "item_type": kind, "pattern": pattern,
        "image_kind": "illustration",
    }
    if kind == "accessory" and try_on_kind in {"bag", "hat", "scarf", "shoes"}:
        item["try_on_kind"] = try_on_kind
    if item_type == "clothing":
        item["subcategory"] = category
    return item


# Count each group separately so the built-in repository never depends on fallback labels.
_TARGET_CLOTHING = 110
_TARGET_ACCESSORIES = 25
for _gender, _gender_set in (("women", WOMEN_ONLY), ("men", MEN_ONLY), ("unisex", UNISEX_ITEMS)):
    _existing = [item for item in ITEMS if item.get("gender_tags") == [_gender]]
    _existing_clothing = sum(item.get("item_type") == "clothing" for item in _existing)
    _existing_accessories = sum(item.get("item_type") == "accessory" for item in _existing)
    for _idx in range(max(0, _TARGET_CLOTHING - _existing_clothing)):
        _item = _generate_catalogue_item(_gender, "clothing", _idx)
        ITEMS.append(_item)
        _gender_set.add(_item["id"])
    for _idx in range(max(0, _TARGET_ACCESSORIES - _existing_accessories)):
        _item = _generate_catalogue_item(_gender, "accessory", _idx)
        ITEMS.append(_item)
        _gender_set.add(_item["id"])

# Replace mismatched external stock photos with individually generated, colour-accurate
# vector illustrations. They are bundled locally and do not make tracking calls to stock sites.
_TITLE_OVERRIDES = {
    "soft-trench": "Camel relaxed trench coat", "relaxed-blazer": "Charcoal relaxed tailored blazer",
    "cream-knit": "Cream soft crewneck knit", "plaid-overshirt": "Burgundy, forest green and black plaid overshirt",
    "utility-jacket": "Black utility jacket", "white-tee": "White premium T-shirt",
    "statement-shirt": "Ink blue, rust and berry colour-block shirt", "wide-leg-denim": "Indigo relaxed wide-leg denim",
    "tailored-trousers": "Black straight-leg tailored trousers", "linen-pants": "Ecru relaxed linen-blend trousers",
    "midi-dress": "Navy everyday midi dress", "soft-cardigan": "Blush textured cardigan",
    "wool-coat": "Camel long wool-blend coat", "rain-shell": "Navy lightweight rain shell",
    "sneakers": "White minimal everyday sneakers", "ankle-boots": "Black everyday ankle boots",
    "loafers": "Black classic loafers", "crossbody-bag": "Black everyday crossbody bag",
    "soft-blouse": "Ivory soft draped blouse", "statement-knit": "Cobalt, cream and berry colour-block knit",
    "pleated-skirt": "Navy pleated midi skirt", "weekend-hoodie": "Grey elevated everyday hoodie",
    "linen-shirt": "White linen button-down shirt", "silk-scarf": "Rust, olive and burgundy printed scarf",
    "structured-cap": "Navy structured everyday cap", "mens-oxford-shirt": "White men's classic Oxford shirt",
}
_PATTERN_OVERRIDES = {
    "plaid-overshirt": "plaid", "statement-shirt": "colour-block", "statement-knit": "colour-block",
    "silk-scarf": "printed",
}
_SUBCATEGORY_OVERRIDES = {"crossbody-bag": "Bags", "silk-scarf": "Scarves", "structured-cap": "Hats", "sneakers": "Shoes", "ankle-boots": "Shoes", "loafers": "Shoes"}
for _item in ITEMS:
    if _item["id"] in _TITLE_OVERRIDES:
        _item["name"] = _TITLE_OVERRIDES[_item["id"]]
    if _item["id"] in _PATTERN_OVERRIDES:
        _item["pattern"] = _PATTERN_OVERRIDES[_item["id"]]
    if _item["id"] in _SUBCATEGORY_OVERRIDES:
        _item["subcategory"] = _SUBCATEGORY_OVERRIDES[_item["id"]]
    _item["image_url"] = f"/assets/catalog/{_item['id']}.svg"
    _item["image_source_url"] = None
    _item["image_credit"] = "Generated myStyle style illustration"
    _item["image_disclaimer"] = "Generated illustration of the named style and colour direction; not a retail product photograph."
    _item["image_kind"] = "illustration"
    _item.setdefault("pattern", "solid")

def catalog_payload() -> dict:
    return {"items": ITEMS, "palettes": PALETTES, "styles": STYLE_OPTIONS, "occasions": OCCASIONS}


def get_item(item_id: str) -> dict | None:
    return next((item for item in ITEMS if item["id"] == item_id), None)
