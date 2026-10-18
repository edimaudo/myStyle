"""Generate local, item-specific SVG style illustrations from the catalogue metadata.

The illustrations are intentionally not photographic retail imagery. They ensure each
style card shows the garment/accessory silhouette and colour stated in its own record.
Run from the project root: python scripts/generate_catalog_art.py
"""
from __future__ import annotations

import hashlib
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from mystyle.catalog import ITEMS  # noqa: E402

COLOR_HEX = {
    "black": "#25272c", "white": "#fbfaf6", "cream": "#eee4d1", "ivory": "#f5f0e2",
    "soft white": "#f5f3ec", "oatmeal": "#c6b59b", "grey": "#898e95", "gray": "#898e95",
    "charcoal": "#44474e", "navy": "#27384f", "ink blue": "#263c57", "slate": "#7f8996",
    "burgundy": "#743846", "berry": "#a53d60", "rust": "#b76340", "olive": "#69724b",
    "sage": "#9eae99", "camel": "#b38b63", "taupe": "#9a8a7b", "sand": "#d2b995",
    "ecru": "#e7dcc6", "forest green": "#345745", "light blue": "#9fb9cc", "indigo": "#3e5479",
    "washed black": "#343438", "sky blue": "#91bad3", "bright red": "#c93643", "cobalt": "#255cc5",
    "blush": "#e5bfc3", "lavender": "#c5b6db", "plum": "#663c63", "emerald": "#246b54",
    "teal": "#287f83", "brown": "#76533d", "chocolate": "#56382f", "tan": "#ba9268",
    "pink": "#d992a3", "floral": "#c58b8e", "silver": "#a6aaae", "gold": "#c4a05e",
}
OUTLINE = "#37342f"


def color(value: str, fallback: str = "#b3b8b5") -> str:
    return COLOR_HEX.get(str(value).casefold(), fallback)


def svg_for(item: dict) -> str:
    item_id = item["id"]
    seed = int(hashlib.sha256(item_id.encode()).hexdigest()[:8], 16)
    variation = seed % 9
    primary = color((item.get("colors") or ["grey"])[0])
    colours = item.get("colors") or ["grey"]
    secondary = color(colours[1], "#eee4d1") if len(colours) > 1 else primary
    tertiary = color(colours[2], secondary) if len(colours) > 2 else secondary
    pattern = item.get("pattern", "solid")
    item_type = item.get("item_type", "clothing")
    subcategory = (item.get("subcategory") or item.get("category") or "").casefold()
    name = item.get("name", "").casefold()
    category = (item.get("category") or "").casefold()
    clip_id = f"clip-{item_id}"

    shapes = []
    if item_type == "accessory" and any(term in subcategory for term in ("bags", "small leather", "wallet")):
        # Bag / small leather goods silhouette.
        body = f"M205 {245-variation*4} Q205 225 232 225 L408 225 Q435 225 435 250 L420 405 Q418 420 400 420 L240 420 Q222 420 220 402 Z"
        handle = f"M260 235 C260 135 380 135 380 235"
        shapes += [f'<path d="{handle}" fill="none" stroke="{OUTLINE}" stroke-width="20" stroke-linecap="round"/>',
                   f'<path d="{handle}" fill="none" stroke="{primary}" stroke-width="11" stroke-linecap="round"/>',
                   f'<path id="shape" d="{body}" fill="{primary}" stroke="{OUTLINE}" stroke-width="5" stroke-linejoin="round"/>']
        if "crossbody" in name or "sling" in name or "shoulder" in name:
            shapes.append(f'<path d="M238 230 Q280 115 396 224" fill="none" stroke="{secondary}" stroke-width="13" stroke-linecap="round"/>')
        shapes.append(f'<path d="M240 300 L400 300" stroke="{secondary}" stroke-width="5" opacity=".8"/>')
    elif item_type == "accessory" and "shoes" in subcategory:
        if "boot" in name:
            body = "M265 130 L355 130 L355 300 L410 355 Q445 383 421 411 L200 411 Q184 402 200 379 L250 337 L250 165 Z"
        elif "sandal" in name:
            body = "M270 120 Q315 110 345 155 L415 330 Q430 385 386 410 L235 410 Q201 404 218 366 L260 190 Z"
        else:
            body = f"M165 315 Q220 {275-variation*6} 260 210 L310 280 Q345 317 412 330 Q455 338 454 377 Q454 405 420 410 L190 410 Q155 407 164 375 Z"
        shapes.append(f'<path id="shape" d="{body}" fill="{primary}" stroke="{OUTLINE}" stroke-width="6" stroke-linejoin="round"/>')
        shapes.append(f'<path d="M190 380 Q295 397 435 380" fill="none" stroke="{secondary}" stroke-width="8" stroke-linecap="round"/>')
        if "sneaker" in name or "running" in name or "low-top" in name:
            shapes.append(f'<path d="M290 292 L335 326 M270 308 L318 342 M252 326 L300 359" fill="none" stroke="{secondary}" stroke-width="6" stroke-linecap="round"/>')
    elif item_type == "accessory" and ("scarves" in subcategory or "scarf" in name):
        shapes += [f'<path d="M240 125 Q250 112 269 124 L395 205 Q410 218 399 238 L332 336 Q320 350 303 337 L185 258 Q170 248 181 230 Z" fill="{primary}" stroke="{OUTLINE}" stroke-width="5"/>',
                   f'<path d="M315 175 L218 302 L260 330 L363 205 Z" fill="{secondary}" opacity=".95"/>',
                   f'<path d="M325 184 L230 306 M344 197 L249 319 M365 211 L271 329" stroke="{tertiary}" stroke-width="5"/>']
    elif item_type == "accessory" and ("hats" in subcategory or "hat" in name):
        if "beanie" in name:
            shapes.append(f'<path d="M210 300 Q210 150 320 145 Q430 150 430 300 Z" fill="{primary}" stroke="{OUTLINE}" stroke-width="6"/>')
            shapes.append(f'<path d="M210 275 Q320 300 430 275 L430 315 Q320 338 210 315 Z" fill="{secondary}" stroke="{OUTLINE}" stroke-width="4"/>')
        else:
            shapes.append(f'<path d="M210 298 Q222 165 320 164 Q415 164 428 298 Z" fill="{primary}" stroke="{OUTLINE}" stroke-width="6"/>')
            shapes.append(f'<path d="M165 300 Q320 330 475 300 Q468 352 320 355 Q190 350 165 300 Z" fill="{secondary}" stroke="{OUTLINE}" stroke-width="6"/>')
            shapes.append(f'<path d="M320 172 L320 296" stroke="{secondary}" stroke-width="4" opacity=".8"/>')
    elif item_type == "accessory" and "belts" in subcategory:
        shapes.append(f'<rect x="130" y="265" width="380" height="60" rx="12" fill="{primary}" stroke="{OUTLINE}" stroke-width="6"/>')
        shapes.append(f'<rect x="285" y="245" width="90" height="100" rx="10" fill="none" stroke="{secondary}" stroke-width="14"/>')
        shapes.append(f'<circle cx="220" cy="295" r="5" fill="{secondary}"/><circle cx="245" cy="295" r="5" fill="{secondary}"/><circle cx="270" cy="295" r="5" fill="{secondary}"/>')
    elif item_type == "accessory" and "jewel" in subcategory:
        if "earring" in name:
            shapes += [f'<circle cx="250" cy="285" r="63" fill="none" stroke="{primary}" stroke-width="22"/>',
                       f'<circle cx="390" cy="285" r="63" fill="none" stroke="{secondary}" stroke-width="22"/>']
        elif "bracelet" in name:
            shapes.append(f'<ellipse cx="320" cy="285" rx="142" ry="88" fill="none" stroke="{primary}" stroke-width="22"/>')
            for i in range(11):
                x = 184 + i*27
                shapes.append(f'<circle cx="{x}" cy="{260 + (i%2)*20}" r="7" fill="{secondary}"/>')
        else:
            shapes.append(f'<path d="M210 190 Q320 440 430 190" fill="none" stroke="{primary}" stroke-width="13" stroke-linecap="round"/>')
            shapes.append(f'<path d="M308 326 L320 348 L332 326 L320 300 Z" fill="{secondary}" stroke="{OUTLINE}" stroke-width="3"/>')
    elif item_type == "accessory" and "watches" in subcategory:
        shapes += [f'<path d="M285 110 L355 110 L370 212 L270 212 Z M270 360 L370 360 L355 460 L285 460 Z" fill="{primary}" stroke="{OUTLINE}" stroke-width="5"/>',
                   f'<rect x="250" y="190" width="140" height="190" rx="35" fill="{secondary}" stroke="{OUTLINE}" stroke-width="6"/>',
                   f'<circle cx="320" cy="285" r="54" fill="#f4f1eb" stroke="{OUTLINE}" stroke-width="5"/>',
                   f'<path d="M320 245 L320 286 L351 303" fill="none" stroke="{OUTLINE}" stroke-width="5" stroke-linecap="round"/>']
    elif item_type == "accessory" and "eyewear" in subcategory:
        shapes += [f'<rect x="142" y="220" width="145" height="100" rx="26" fill="{primary}" stroke="{OUTLINE}" stroke-width="8"/>',
                   f'<rect x="353" y="220" width="145" height="100" rx="26" fill="{primary}" stroke="{OUTLINE}" stroke-width="8"/>',
                   f'<path d="M286 247 Q320 225 354 247 M142 250 L100 235 M498 250 L540 235" fill="none" stroke="{OUTLINE}" stroke-width="8" stroke-linecap="round"/>',
                   f'<path d="M160 238 L245 238 M370 238 L455 238" stroke="{secondary}" stroke-width="8" opacity=".65"/>']
    else:
        # Apparel silhouettes: tops, knitwear, jackets, bottoms, skirts, dresses and jumpsuits.
        if category in {"bottoms", "denim"} or any(word in name for word in ("trousers", "jeans", "joggers", "leggings", "shorts", "chinos")):
            if "shorts" in name:
                body = "M205 150 L435 150 L420 325 L330 325 L318 250 L305 325 L220 325 Z"
            else:
                body = f"M218 135 L422 135 L408 430 L330 430 L312 {260+variation*4} L292 430 L218 430 Z"
            shapes.append(f'<path id="shape" d="{body}" fill="{primary}" stroke="{OUTLINE}" stroke-width="6" stroke-linejoin="round"/>')
            shapes.append(f'<path d="M320 145 L320 {250+variation*4}" stroke="{secondary}" stroke-width="5" opacity=".9"/>')
            shapes.append(f'<path d="M232 172 L232 395 M408 172 L408 395" stroke="{secondary}" stroke-width="3" opacity=".7"/>')
            shapes.append(f'<path d="M225 152 L415 152" stroke="{secondary}" stroke-width="9"/>')
        elif "skirt" in category or "skirt" in name:
            body = f"M240 145 L400 145 L445 {410+variation*3} Q320 445 195 {410+variation*3} Z"
            shapes.append(f'<path id="shape" d="{body}" fill="{primary}" stroke="{OUTLINE}" stroke-width="6" stroke-linejoin="round"/>')
            shapes.append(f'<path d="M275 155 L250 400 M320 155 L320 415 M365 155 L390 400" stroke="{secondary}" stroke-width="4" opacity=".75"/>')
            shapes.append(f'<path d="M242 152 L398 152" stroke="{secondary}" stroke-width="10"/>')
        elif "dress" in category or "dress" in name or "jumpsuit" in name:
            if "jumpsuit" in name:
                body = "M260 145 L380 145 L390 280 L365 440 L325 440 L320 290 L310 440 L270 440 L250 280 Z"
            else:
                body = f"M268 145 L372 145 L388 240 L450 {420+variation*5} Q320 455 190 {420+variation*5} L252 240 Z"
            shapes.append(f'<path id="shape" d="{body}" fill="{primary}" stroke="{OUTLINE}" stroke-width="6" stroke-linejoin="round"/>')
            shapes.append(f'<path d="M273 150 L320 200 L367 150" fill="none" stroke="{secondary}" stroke-width="8"/>')
            shapes.append(f'<path d="M265 286 Q320 300 375 286" stroke="{secondary}" stroke-width="5" opacity=".8"/>')
        elif any(word in category or word in name for word in ("jacket", "outerwear", "coat", "blazer", "overshirt", "shell", "vest")):
            sleeve_width = 82 + variation * 8
            body = f"M260 125 L380 125 L{420+variation*4} 170 L{480+variation*2} 315 L{410+variation*2} 345 L390 260 L390 435 L250 435 L250 260 L230 345 L160 315 L220 170 Z"
            shapes.append(f'<path id="shape" d="{body}" fill="{primary}" stroke="{OUTLINE}" stroke-width="6" stroke-linejoin="round"/>')
            shapes.append(f'<path d="M260 130 L320 235 L380 130 L355 435 L285 435 Z" fill="{secondary}" opacity=".9"/>')
            shapes.append(f'<path d="M320 235 L320 430" stroke="{OUTLINE}" stroke-width="5"/>')
            for y in (275, 320, 365):
                shapes.append(f'<circle cx="341" cy="{y}" r="5" fill="{OUTLINE}"/>')
        else:
            sleeve = 82 + variation * 5
            body = f"M260 130 L300 115 Q320 145 340 115 L380 130 L{440+sleeve//2} 225 L{390+variation*3} 260 L382 220 L382 410 L258 410 L258 220 L{250-variation*3} 260 L{200-sleeve//2} 225 Z"
            shapes.append(f'<path id="shape" d="{body}" fill="{primary}" stroke="{OUTLINE}" stroke-width="6" stroke-linejoin="round"/>')
            if "shirt" in name or "polo" in name:
                shapes.append(f'<path d="M296 125 L320 155 L344 125 L335 190 L305 190 Z" fill="{secondary}" stroke="{OUTLINE}" stroke-width="3"/>')
            if "hoodie" in name or "hood" in name:
                shapes.append(f'<path d="M278 135 Q320 185 362 135 L350 210 L290 210 Z" fill="{secondary}" stroke="{OUTLINE}" stroke-width="4"/>')
            shapes.append(f'<path d="M260 405 L380 405" stroke="{secondary}" stroke-width="8"/>')

    # Draw textile patterns separately so they can be clipped to the actual garment path.
    body_path = body if item_type == "clothing" else None
    pattern_shapes = []
    unique_detail_shapes = []
    if item_type == "clothing":
        # Item-specific seam/pocket details distinguish otherwise similar cuts while
        # staying within the silhouette and without inventing an unlisted fabric colour.
        detail_kind = (seed >> 5) % 5
        detail_x = 275 + ((seed >> 10) % 66)
        detail_y = 235 + ((seed >> 16) % 125)
        detail_w = 18 + ((seed >> 21) % 25)
        detail_h = 14 + ((seed >> 26) % 16)
        if detail_kind == 0:
            unique_detail_shapes.append(f'<path d="M{detail_x} {detail_y} l{detail_w} 0 l0 {detail_h} l{-detail_w} 0 Z" fill="none" stroke="{OUTLINE}" stroke-width="3"/>')
        elif detail_kind == 1:
            unique_detail_shapes.append(f'<path d="M{detail_x} {detail_y} l{detail_w} 0 M{detail_x} {detail_y+7} l{detail_w} 0 M{detail_x} {detail_y+14} l{detail_w} 0" fill="none" stroke="{OUTLINE}" stroke-width="2.5" stroke-linecap="round"/>')
        elif detail_kind == 2:
            unique_detail_shapes.append(f'<path d="M{detail_x} {detail_y} q{detail_w/2} {detail_h} {detail_w} 0" fill="none" stroke="{OUTLINE}" stroke-width="3" stroke-linecap="round"/>')
        elif detail_kind == 3:
            unique_detail_shapes.append(f'<path d="M{detail_x} {detail_y} l{detail_w} {detail_h} M{detail_x+detail_w} {detail_y} l{-detail_w} {detail_h}" fill="none" stroke="{OUTLINE}" stroke-width="2.5"/>')
        else:
            unique_detail_shapes.append(f'<path d="M{detail_x} {detail_y} l0 {detail_h} M{detail_x+8} {detail_y} l0 {detail_h}" fill="none" stroke="{OUTLINE}" stroke-width="2.5"/>')
    if item_type == "clothing" and pattern != "solid":
        if pattern == "colour-block":
            pattern_shapes.append(f'<path d="M323 130 L410 135 L455 260 L390 275 L390 432 L325 432 Z" fill="{secondary}" opacity=".96"/>')
            if len(colours) > 2:
                pattern_shapes.append(f'<path d="M260 135 L320 135 L320 240 L260 300 Z" fill="{tertiary}" opacity=".95"/>')
        elif pattern == "striped":
            for y in range(185, 405, 34):
                pattern_shapes.append(f'<path d="M245 {y} L395 {y} L395 {y+11} L245 {y+11} Z" fill="{secondary}" opacity=".9"/>')
        elif pattern == "plaid":
            for x in (268, 302, 336, 370):
                pattern_shapes.append(f'<path d="M{x} 142 L{x+10} 142 L{x+10} 410 L{x} 410 Z" fill="{secondary}" opacity=".8"/>')
            for y in (210, 270, 330, 390):
                pattern_shapes.append(f'<path d="M250 {y} L390 {y} L390 {y+12} L250 {y+12} Z" fill="{tertiary}" opacity=".76"/>')
        elif pattern == "printed":
            for x, y in ((270, 205), (350, 235), (300, 295), (365, 345), (275, 365), (335, 390)):
                pattern_shapes.append(f'<circle cx="{x}" cy="{y}" r="11" fill="{secondary}" opacity=".85"/><circle cx="{x+5}" cy="{y+3}" r="4" fill="{tertiary}"/>')

    # Clip bounds prevent pattern layers from bleeding into the backdrop.
    # Since individual silhouettes vary by item, use a unique soft graphic backdrop,
    # but maintain the same foreground colour and pattern truthfully for each item.
    backdrop = f'''<rect x="22" y="22" width="596" height="516" rx="34" fill="#f4f1eb"/>
      <circle cx="{460 + (variation-2)*12}" cy="155" r="116" fill="{secondary}" opacity=".16"/>
      <path d="M95 448 Q320 475 545 448" fill="none" stroke="#ded8cf" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="320" cy="450" rx="145" ry="18" fill="#d9d3ca" opacity=".42"/>'''
    content = "".join(shapes)
    clip_path = f'<clipPath id="{clip_id}"><path d="{body_path}"/></clipPath>' if body_path else f'<clipPath id="{clip_id}"><rect x="150" y="90" width="340" height="360" rx="18"/></clipPath>'
    if (pattern_shapes or unique_detail_shapes) and body_path:
        if pattern_shapes:
            content += f'<g clip-path="url(#{clip_id})">{"".join(pattern_shapes)}</g>'
        if unique_detail_shapes:
            content += f'<g clip-path="url(#{clip_id})">{"".join(unique_detail_shapes)}</g>'
        if any(term in name for term in ("shirt", "blouse", "polo")):
            content += f'<path d="M296 125 L320 155 L344 125 L335 188 L305 188 Z" fill="{secondary}" stroke="{OUTLINE}" stroke-width="3" stroke-linejoin="round"/>'
            content += f'<path d="M320 158 L320 290" fill="none" stroke="{OUTLINE}" stroke-width="3"/>'
            for button_y in (205, 228, 251, 274):
                content += f'<circle cx="320" cy="{button_y}" r="3.5" fill="{OUTLINE}"/>'
        elif any(term in name for term in ("jacket", "coat", "blazer", "overshirt", "vest", "shell")):
            content += f'<path d="M320 230 L320 430" fill="none" stroke="{OUTLINE}" stroke-width="4"/>'
        elif any(term in name for term in ("trousers", "jeans", "joggers", "leggings", "shorts", "chinos")):
            content += f'<path d="M225 152 L415 152 M320 153 L320 240" fill="none" stroke="{OUTLINE}" stroke-width="3"/>'
        # Restore the garment edge above textile details for a clean silhouette.
        content += f'<path d="{body_path}" fill="none" stroke="{OUTLINE}" stroke-width="6" stroke-linejoin="round"/>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="560" viewBox="0 0 640 560" role="img" aria-label="Illustration of {item_id}">
      <defs>{clip_path}</defs>
      {backdrop}{content}
      <path d="M50 506 L590 506" stroke="#e7e1d9" stroke-width="1"/>
    </svg>'''


def main() -> None:
    output = ROOT / "public" / "assets" / "catalog"
    output.mkdir(parents=True, exist_ok=True)
    expected = set()
    for item in ITEMS:
        asset = output / f"{item['id']}.svg"
        asset.write_text(svg_for(item), encoding="utf-8")
        expected.add(asset.name)
    for stale in output.glob("*.svg"):
        if stale.name not in expected:
            stale.unlink()
    print(f"Generated {len(expected)} catalogue illustrations in {output}")


if __name__ == "__main__":
    main()
