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


def catalog_payload() -> dict:
    return {"items": ITEMS, "palettes": PALETTES, "styles": STYLE_OPTIONS, "occasions": OCCASIONS}


def get_item(item_id: str) -> dict | None:
    return next((item for item in ITEMS if item["id"] == item_id), None)
