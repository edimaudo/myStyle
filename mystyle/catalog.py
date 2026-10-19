"""Photo-backed myStyle styling catalogue and profile choices."""
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
    ["classic", "Classic and polished"], ["minimal", "Minimal and modern"], ["casual", "Elevated casual"],
    ["bohemian", "Bohemian and relaxed"], ["romantic", "Romantic and soft"], ["streetwear", "Streetwear"],
    ["edgy", "Edgy and alternative"], ["preppy", "Preppy"], ["creative", "Creative and expressive"],
    ["sporty", "Sporty and comfortable"], ["workwear", "Workwear"], ["trendy", "Trend-led"],
]
OCCASIONS = [["everyday", "Everyday"], ["work", "Work"], ["weekend", "Weekend"], ["event", "Events and evenings"], ["travel", "Travel"], ["outdoors", "Outdoors"]]
from .real_catalog import ITEMS, WOMEN_ONLY, MEN_ONLY, UNISEX_ITEMS  # noqa: E402

def catalog_payload() -> dict:
    return {"items": ITEMS, "palettes": PALETTES, "styles": STYLE_OPTIONS, "occasions": OCCASIONS}

def get_item(item_id: str) -> dict | None:
    return next((item for item in ITEMS if item["id"] == item_id), None)
