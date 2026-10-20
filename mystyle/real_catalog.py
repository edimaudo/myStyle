"""Manually curated real fashion-photo references. No generated garment illustrations.
All catalogue clothing photos and supported accessory types can be sent for try-on after user consent.

Every row uses a unique Pexels photo ID. Photos show actual people wearing clothes or
accessories; labels stick to the look described for that photo rather than inventing a product.
"""
from __future__ import annotations
from urllib.parse import quote_plus

# id, name, audience, item type, category, displayed colours, styles, seasons, climates,
# target budget USD, Pexels photo ID, Pexels search/source query, try-on support, accessory kind
_ROWS = [
    # Men's clothing / complete looks
    ("look-men-casual-black-tee", "Black T-shirt and tan shorts look", "men", "clothing", "Casual", ["black", "tan"], ["casual", "minimal"], ["spring", "summer"], ["warm", "mild"], 45, 11576957, "men black t-shirt tan shorts studio outfit", True, ""),
    ("look-men-white-overshirt-denim", "White overshirt with blue denim", "men", "clothing", "Layering", ["white", "denim blue"], ["casual", "classic"], ["spring", "summer", "fall"], ["mild", "variable"], 85, 34966923, "men white overshirt blue jeans outfit", False, ""),
    ("look-men-beige-jacket", "Beige jacket and dark trousers", "men", "clothing", "Outerwear", ["beige", "black"], ["classic", "casual"], ["spring", "fall"], ["mild", "variable"], 110, 15531075, "man beige jacket black trousers outfit", False, ""),
    ("look-men-blue-shirt-trousers", "Casual shirt and trousers", "men", "clothing", "Casual", ["blue", "neutral"], ["classic", "casual"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 75, 36904559, "men casual shirt trousers blue studio", True, ""),
    ("look-men-white-shirt-casual-pants", "White shirt with casual trousers", "men", "clothing", "Tops", ["white", "neutral"], ["classic", "minimal"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 65, 37599031, "men white shirt casual trousers outfit", True, ""),
    ("look-men-studio-neutral", "Neutral studio outfit", "men", "clothing", "Casual", ["neutral", "black"], ["minimal", "classic"], ["spring", "fall"], ["mild", "variable"], 80, 29998736, "male model neutral casual outfit studio", True, ""),
    ("look-men-dark-layers", "Dark layered casual outfit", "men", "clothing", "Layering", ["black", "charcoal"], ["edgy", "streetwear"], ["fall", "winter"], ["cold", "variable"], 95, 39069698, "men dark casual layered outfit fashion", False, ""),
    ("look-men-black-jacket-cap", "Black jacket, white T-shirt and cap", "men", "clothing", "Outerwear", ["black", "white"], ["streetwear", "casual"], ["spring", "fall"], ["mild", "variable"], 105, 36359325, "man black jacket white shirt cap outfit", False, ""),
    ("look-men-plaid-layer", "Plaid overshirt with casual layers", "men", "clothing", "Layering", ["burgundy", "green", "black"], ["casual", "edgy"], ["fall", "winter", "spring"], ["cold", "variable"], 75, 35759422, "man plaid overshirt casual outfit", False, ""),
    ("look-men-denim-jacket", "Denim jacket streetwear", "men", "clothing", "Outerwear", ["denim blue", "black"], ["streetwear", "casual"], ["spring", "fall"], ["mild", "variable"], 90, 17083473, "man denim jacket streetwear outfit", False, ""),
    ("look-men-denim-layer-arcade", "Denim jacket and simple layers", "men", "clothing", "Outerwear", ["denim blue", "white"], ["casual", "classic"], ["spring", "fall"], ["mild", "variable"], 88, 11595232, "man denim jacket casual layers arcade", False, ""),
    ("look-men-urban-denim", "Urban denim jacket look", "men", "clothing", "Outerwear", ["denim blue", "dark"], ["casual", "streetwear"], ["spring", "fall"], ["mild", "variable"], 90, 19966445, "man denim jacket street fashion", False, ""),
    ("look-men-denim-on-denim", "Denim-on-denim outfit", "men", "clothing", "Denim", ["denim blue"], ["casual", "edgy"], ["spring", "fall"], ["mild", "variable"], 115, 2676142, "man full denim outfit street fashion", True, ""),
    ("look-men-white-winter-jacket", "White winter jacket outfit", "men", "clothing", "Outerwear", ["white", "blue"], ["sporty", "casual"], ["fall", "winter"], ["cold"], 150, 16277371, "man white winter jacket street outfit", False, ""),
    ("look-men-black-track-jacket", "Black jacket and track pants", "men", "clothing", "Sport", ["black", "white"], ["sporty", "streetwear"], ["spring", "fall", "winter"], ["cold", "variable", "mild"], 100, 3207453, "man black jacket track pants full body", True, ""),
    ("look-men-autumn-jacket", "Autumn jacket and casual layers", "men", "clothing", "Outerwear", ["brown", "black"], ["classic", "casual"], ["fall", "winter"], ["cold", "variable"], 115, 5602404, "man autumn jacket outfit", False, ""),
    ("look-men-navy-jacket", "Navy jacket city look", "men", "clothing", "Outerwear", ["navy", "neutral"], ["classic", "workwear"], ["spring", "fall"], ["mild", "variable"], 115, 25930852, "man navy jacket city portrait fashion", False, ""),
    ("look-men-checked-jacket", "Checked jacket streetwear", "men", "clothing", "Outerwear", ["brown", "navy"], ["streetwear", "creative"], ["fall", "winter"], ["cold", "variable"], 120, 21701014, "man checked jacket streetwear", False, ""),
    ("look-men-striped-knit", "Striped sweater studio look", "men", "clothing", "Knitwear", ["cream", "black"], ["classic", "preppy"], ["fall", "winter", "spring"], ["cold", "variable", "mild"], 70, 31589335, "male model striped sweater studio", True, ""),
    ("look-men-shirt-scarf", "Shirt with scarf layering", "men", "clothing", "Layering", ["neutral", "brown"], ["classic", "creative"], ["fall", "winter"], ["cold", "variable"], 95, 15615687, "man shirt scarf fashion studio", False, ""),
    ("look-men-minimal-studio", "Minimal studio outfit", "men", "clothing", "Casual", ["white", "black"], ["minimal", "classic"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 70, 16485646, "male fashion model minimalist outfit white background", True, ""),
    ("look-men-white-oxford", "White shirt and brown trousers", "men", "clothing", "Tops", ["white", "brown"], ["classic", "workwear"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 80, 15581106, "man white shirt brown trousers outfit", True, ""),
    ("look-men-striped-shirt", "Striped shirt with black trousers", "men", "clothing", "Tops", ["black", "white"], ["classic", "minimal"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 75, 3917720, "man striped shirt black pants outfit", True, ""),
    ("look-men-crossbody-knit", "White knit with crossbody bag", "men", "clothing", "Layering", ["white", "black"], ["casual", "streetwear"], ["spring", "fall"], ["mild", "variable"], 95, 15353312, "man white sweater crossbody bag outfit", False, ""),
    ("look-men-black-tee-sidewalk", "Black T-shirt and sneakers", "men", "clothing", "Casual", ["black", "white"], ["minimal", "casual"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 55, 15626400, "young man black t-shirt sneakers sidewalk", True, ""),
    ("look-men-white-sportswear", "White sportswear set", "men", "clothing", "Sport", ["white"], ["sporty", "minimal"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 100, 6311505, "man white sportswear suit studio", True, ""),
    ("look-men-blue-winter-jacket", "Blue winter jacket and sunglasses", "men", "clothing", "Outerwear", ["blue", "black"], ["sporty", "streetwear"], ["fall", "winter"], ["cold"], 145, 16453878, "young man blue winter jacket sunglasses", False, ""),
    # Women's clothing / complete looks
    ("look-women-city-tie", "Casual city outfit with tie detail", "women", "clothing", "Casual", ["white", "black"], ["creative", "classic"], ["spring", "fall"], ["mild", "variable"], 85, 39734870, "woman casual outfit tie urban style", False, ""),
    ("look-women-street-denim-cap", "Relaxed jeans, white shirt and cap", "women", "clothing", "Casual", ["white", "denim blue"], ["casual", "streetwear"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 80, 18676953, "woman jeans white shirt cap streetwear", False, ""),
    ("look-women-streetwear", "Relaxed streetwear on the sidewalk", "women", "clothing", "Casual", ["neutral", "denim blue"], ["streetwear", "casual"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 85, 18632573, "young woman streetwear sidewalk outfit", False, ""),
    ("look-women-white-knit-green-pants", "White sweater with green trousers", "women", "clothing", "Knitwear", ["white", "green"], ["classic", "minimal"], ["spring", "fall"], ["mild", "variable"], 95, 33572366, "woman white sweater green pants outfit", True, ""),
    ("look-women-black-coat", "Black coat city look", "women", "clothing", "Outerwear", ["black"], ["classic", "minimal"], ["fall", "winter"], ["cold", "variable"], 145, 15862502, "woman black coat street fashion", False, ""),
    ("look-women-neutral-studio", "Polished neutral studio outfit", "women", "clothing", "Casual", ["cream", "beige"], ["classic", "minimal"], ["spring", "fall"], ["mild", "variable"], 100, 19456439, "woman chic neutral outfit studio fashion", True, ""),
    ("look-women-teal-city-layers", "Teal and blue city layers", "women", "clothing", "Layering", ["teal", "blue", "black"], ["classic", "streetwear"], ["spring", "fall"], ["mild", "variable"], 110, 13652044, "woman modern fashionable clothing city", False, ""),
    ("look-women-shirt-skirt", "Shirt and skirt street look", "women", "clothing", "Skirts", ["white", "neutral"], ["classic", "preppy"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 90, 19385012, "woman shirt skirt sidewalk outfit", False, ""),
    ("look-women-pink-hat-sport", "Sporty outfit with pink hat", "women", "clothing", "Sport", ["pink", "neutral"], ["sporty", "casual"], ["spring", "summer"], ["warm", "mild"], 85, 3819775, "woman pink hat sporty outfit", False, ""),
    ("look-women-denim-sunglasses", "Denim and sunglasses street look", "women", "clothing", "Denim", ["denim blue", "white"], ["casual", "streetwear"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 85, 19243415, "woman denim outfit sunglasses fashion", False, ""),
    ("look-women-black-evening", "Black top with evening styling", "women", "clothing", "Evening", ["black"], ["edgy", "classic"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 110, 20425084, "woman black top heels outfit fashion", False, ""),
    ("look-women-flared-trousers", "Tank top with flared trousers", "women", "clothing", "Bottoms", ["black", "neutral"], ["minimal", "casual"], ["spring", "summer"], ["warm", "mild"], 85, 18276951, "woman flare pants tank top outfit", False, ""),
    ("look-women-striped-jacket", "Striped jacket and leather trousers", "women", "clothing", "Outerwear", ["black", "white"], ["edgy", "creative"], ["fall", "winter"], ["cold", "variable"], 125, 37138523, "woman striped jacket leather pants fashion", False, ""),
    ("look-women-green-studio", "Green top and tailored trousers", "women", "clothing", "Casual", ["green", "neutral"], ["minimal", "creative"], ["spring", "summer"], ["warm", "mild"], 80, 5690229, "woman green top tailored trousers full body studio", True, ""),
    ("look-women-black-blazer", "Black blazer and trousers", "women", "clothing", "Workwear", ["black", "white"], ["classic", "workwear"], ["spring", "fall", "winter"], ["cold", "variable", "mild"], 130, 11503416, "woman black blazer trousers studio", True, ""),
    ("look-women-white-jacket", "White jacket with beige trousers", "women", "clothing", "Outerwear", ["white", "beige"], ["classic", "minimal"], ["spring", "fall"], ["mild", "variable"], 130, 20016578, "woman white jacket beige trousers outfit", False, ""),
    ("look-women-white-shirt", "White shirt and beige trousers", "women", "clothing", "Tops", ["white", "beige"], ["classic", "workwear"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 80, 7945662, "woman white shirt beige trousers studio", True, ""),
    ("look-women-black-red-trousers", "Black top with red trousers", "women", "clothing", "Bottoms", ["black", "red"], ["edgy", "creative"], ["spring", "fall"], ["mild", "variable"], 100, 15488938, "woman black top red leather trousers studio", True, ""),
    ("look-women-elegant-look", "Elegant occasion outfit", "women", "clothing", "Occasion", ["neutral", "black"], ["romantic", "classic"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 140, 12324554, "woman elegant fashion outfit", False, ""),
    ("look-women-studio-fashion", "Modern studio outfit", "women", "clothing", "Casual", ["neutral", "dark"], ["classic", "minimal"], ["spring", "fall"], ["mild", "variable"], 110, 36976479, "woman modern fashion studio outfit", False, ""),
    ("look-women-full-length-neutral", "Full-length neutral outfit", "women", "clothing", "Casual", ["neutral", "cream"], ["classic", "minimal"], ["spring", "fall"], ["mild", "variable"], 120, 18568811, "woman full body neutral outfit studio", True, ""),
    ("look-women-jacket-boots", "Jacket and boots look", "women", "clothing", "Outerwear", ["black", "brown"], ["edgy", "classic"], ["fall", "winter"], ["cold", "variable"], 145, 15963592, "woman jacket boots full length outfit", True, ""),
    ("look-women-layered-coat", "Coat layered over denim", "women", "clothing", "Outerwear", ["neutral", "denim blue"], ["casual", "classic"], ["fall", "winter"], ["cold", "variable"], 155, 20276782, "woman coat denim jacket street look", False, ""),
    ("look-women-coat-jeans", "Coat and denim street outfit", "women", "clothing", "Outerwear", ["neutral", "denim blue"], ["classic", "casual"], ["fall", "winter"], ["cold", "variable"], 145, 18583834, "woman coat jeans street outfit", False, ""),
    ("look-women-monochrome-coat", "Monochrome coat and jeans", "women", "clothing", "Outerwear", ["black", "white"], ["classic", "minimal"], ["fall", "winter"], ["cold", "variable"], 145, 5792068, "woman coat jeans black white fashion", False, ""),
    ("look-women-black-minimal", "Minimal black top look", "women", "clothing", "Tops", ["black"], ["minimal", "edgy"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 75, 19317155, "woman black top minimalist fashion portrait", False, ""),
    ("look-women-light-jacket", "Light jacket and white trousers", "women", "clothing", "Outerwear", ["white", "neutral"], ["classic", "minimal"], ["spring", "fall"], ["mild", "variable"], 125, 16482203, "woman jacket white pants outfit", True, ""),
    # Gender-neutral / androgynous fashion looks
    ("look-unisex-black-minimal", "Black minimalist outfit", "unisex", "clothing", "Casual", ["black"], ["minimal", "streetwear"], ["spring", "fall"], ["mild", "variable"], 95, 8346048, "unisex black minimalist fashion look", False, ""),
    ("look-unisex-androgynous-white", "White blouse and denim styling", "unisex", "clothing", "Creative", ["white", "denim blue"], ["creative", "edgy"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 90, 4971258, "androgynous model white blouse denim fashion", False, ""),
    ("look-unisex-red-blazer", "Red blazer statement look", "unisex", "clothing", "Jackets", ["red", "black"], ["creative", "edgy"], ["spring", "fall"], ["mild", "variable"], 130, 4971989, "androgynous model red blazer fashion", False, ""),
    ("look-unisex-nature-fashion", "Textured outdoor fashion look", "unisex", "clothing", "Casual", ["earth", "neutral"], ["bohemian", "creative"], ["spring", "fall"], ["mild", "variable"], 100, 33011290, "androgynous fashion model outdoors", False, ""),
    ("look-unisex-denim-glasses", "Denim outfit with eyewear styling", "unisex", "clothing", "Casual", ["denim blue", "neutral"], ["casual", "minimal"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 90, 34708140, "person denim outfit holding glasses", False, ""),
    ("look-unisex-camo-coat", "Monochrome camo coat look", "unisex", "clothing", "Outerwear", ["black", "grey"], ["edgy", "creative"], ["fall", "winter"], ["cold", "variable"], 150, 30874942, "monochrome fashion camo coat outfit", False, ""),
    ("look-unisex-orange-jumpsuit", "Orange jumpsuit statement look", "unisex", "clothing", "One-piece", ["orange"], ["creative", "trendy"], ["spring", "summer"], ["warm", "mild"], 130, 29991821, "individual orange jumpsuit fashion shoot", False, ""),
    ("look-unisex-androgynous-skirt", "Androgynous denim and blouse look", "unisex", "clothing", "Creative", ["white", "denim blue", "black"], ["creative", "edgy"], ["spring", "fall"], ["mild", "variable"], 115, 4971158, "androgynous model white blouse denim skirt", False, ""),
    ("look-unisex-androgynous-studio", "Androgynous denim and white blouse look", "unisex", "clothing", "Creative", ["white", "denim blue"], ["creative", "edgy"], ["spring", "fall"], ["mild", "variable"], 110, 4971351, "androgynous denim white blouse fashion studio", False, ""),
    # Accessories are shown as styling references. For accessory try-on, a clean photo of the user's
    # actual accessory in My wardrobe is used; the worn-image references below are not product shots.
    ("accessory-men-crossbody", "Crossbody bag street styling", "men", "accessory", "Bags", ["black", "brown"], ["casual", "streetwear"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 65, 10106033, "man crossbody bag streetwear look", False, "bag"),
    ("accessory-men-messenger", "Messenger bag city styling", "men", "accessory", "Bags", ["black", "grey"], ["classic", "casual"], ["spring", "fall"], ["mild", "variable"], 80, 932572, "man messenger bag city outfit", False, "bag"),
    ("accessory-men-briefcase", "Briefcase with citywear", "men", "accessory", "Bags", ["brown", "black"], ["classic", "workwear"], ["spring", "fall"], ["mild", "variable"], 100, 5647227, "man briefcase city style", False, "bag"),
    ("accessory-men-scarf", "Scarf and sunglasses styling", "men", "accessory", "Scarves", ["neutral", "black"], ["classic", "creative"], ["fall", "winter"], ["cold", "variable"], 45, 33649361, "man patterned scarf sunglasses fashion", False, "scarf"),
    ("accessory-men-layered-scarf", "Scarf and sunglasses street look", "men", "accessory", "Scarves", ["neutral", "brown"], ["classic", "casual"], ["fall", "winter"], ["cold", "variable"], 45, 18173664, "man scarf sunglasses street style", False, "scarf"),
    ("accessory-women-headscarf", "Headscarf and crossbody styling", "women", "accessory", "Scarves", ["neutral", "brown"], ["creative", "classic"], ["spring", "fall"], ["mild", "variable"], 40, 4355207, "woman headscarf crossbody bag outfit", False, "scarf"),
    ("accessory-women-sunhat", "Sun hat and summer bag styling", "women", "accessory", "Hats", ["tan", "neutral"], ["bohemian", "casual"], ["spring", "summer"], ["warm", "mild"], 50, 37232764, "woman sun hat summer bag fashion", False, "hat"),
    ("accessory-women-boots", "Boots in a street-style outfit", "women", "accessory", "Shoes", ["black", "brown"], ["edgy", "classic"], ["fall", "winter"], ["cold", "variable"], 95, 17459717, "woman boots sunglasses outfit", False, "shoes"),
    ("accessory-unisex-crossbody", "Crossbody bag everyday styling", "unisex", "accessory", "Bags", ["black", "neutral"], ["casual", "minimal"], ["spring", "summer", "fall"], ["warm", "mild", "variable"], 60, 31188620, "young adult crossbody bag outfit", False, "bag"),
    ("accessory-unisex-hat-scarf", "Hat, scarf and sunglasses styling", "unisex", "accessory", "Accessories", ["neutral", "black"], ["creative", "streetwear"], ["fall", "winter"], ["cold", "variable"], 70, 20862159, "person hat sunglasses scarf bag outfit", False, "hat"),
    ("accessory-unisex-bag-scarf", "Bag and scarf urban styling", "unisex", "accessory", "Bags", ["brown", "neutral"], ["casual", "classic"], ["fall", "spring"], ["mild", "variable"], 75, 7129173, "person bag scarf urban outfit", False, "bag"),
    ("accessory-men-crossbody-watch", "Crossbody bag and watch styling", "men", "accessory", "Accessories", ["brown", "black"], ["classic", "casual"], ["spring", "fall"], ["mild", "variable"], 85, 4809680, "man crossbody bag watch casual outfit", False, "bag"),
]

_PALETTE_BY_COLOR = {
    "black": ["monochrome", "cool"], "white": ["monochrome", "cool"], "cream": ["neutral", "earth"],
    "tan": ["earth"], "brown": ["earth"], "beige": ["earth", "neutral"], "neutral": ["neutral", "earth"],
    "denim blue": ["cool", "monochrome"], "blue": ["cool"], "navy": ["cool", "monochrome"],
    "charcoal": ["cool", "monochrome"], "grey": ["cool", "monochrome"], "gray": ["cool", "monochrome"],
    "green": ["earth"], "olive": ["earth"], "teal": ["cool", "jewel"], "burgundy": ["jewel", "earth"],
    "red": ["bright", "jewel"], "orange": ["bright", "earth"], "pink": ["pastel", "bright"],
    "purple": ["jewel"], "brown": ["earth"], "dark": ["cool", "monochrome"],
}


def _build_item(row: tuple) -> dict:
    (item_id, name, gender, item_type, category, colors, styles, seasons, climates,
     usd, photo_id, source_query, try_on_supported, try_on_kind) = row
    gender_label = {"women": "Women's", "men": "Men's", "unisex": "Gender-neutral"}[gender]
    item_palettes = []
    for colour in colors:
        item_palettes.extend(_PALETTE_BY_COLOR.get(colour.casefold(), ["neutral"]))
    item_palettes = list(dict.fromkeys(item_palettes))
    image_url = f"https://images.pexels.com/photos/{photo_id}/pexels-photo-{photo_id}.jpeg?auto=compress&cs=tinysrgb&w=1200"
    source_url = "https://www.pexels.com/search/" + quote_plus(source_query) + "/"
    price_cad = round(usd * 1.36)
    query = f"{gender_label} {name} {' '.join(colors[:2])}".strip()
    item = {
        "id": item_id, "name": name, "category": category,
        "subcategory": category, "description": f"Real outfit photography showing {name.casefold()}. Explore similar pieces at retailers; the photo is styling inspiration, not a live product listing.",
        "style_tags": styles, "colors": colors, "palettes": item_palettes,
        "seasons": seasons, "climates": climates, "occasions": ["everyday", "weekend"] + (["work"] if category in {"Workwear", "Tops", "Outerwear"} else []),
        "target_usd": usd, "target_cad": price_cad, "fit_tags": ["balanced", "relaxed"],
        "image_url": image_url, "image_source_url": source_url,
        "image_credit": "Photo via Pexels", "image_disclaimer": "Real fashion photo used for styling inspiration; not necessarily the exact product sold by retailers.",
        "image_kind": "photo", "photographer_source": "Pexels",
        "shop_query": query, "gender_tags": [gender], "item_type": item_type,
        "pattern": "solid", "try_on_supported": bool(item_type == "clothing" or try_on_kind in {"bag", "hat", "scarf", "shoes"}),
    }
    if try_on_kind:
        item["try_on_kind"] = try_on_kind
    if item_type == "accessory":
        item["accessory_kind"] = try_on_kind or ""
    return item

ITEMS = [_build_item(row) for row in _ROWS]
if len({item["image_url"] for item in ITEMS}) != len(ITEMS):
    raise RuntimeError("Real-photo catalogue must not reuse an image under multiple titles.")
if len({item["id"] for item in ITEMS}) != len(ITEMS):
    raise RuntimeError("Real-photo catalogue contains duplicate item IDs.")
if len({item["name"] for item in ITEMS}) != len(ITEMS):
    raise RuntimeError("Real-photo catalogue contains duplicate titles.")
WOMEN_ONLY = {item["id"] for item in ITEMS if item["gender_tags"] == ["women"]}
MEN_ONLY = {item["id"] for item in ITEMS if item["gender_tags"] == ["men"]}
UNISEX_ITEMS = {item["id"] for item in ITEMS if item["gender_tags"] == ["unisex"]}
