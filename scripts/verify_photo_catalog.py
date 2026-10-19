"""Check that all manually curated Pexels image references still return images.

Run in a network-enabled environment before deploying: python scripts/verify_photo_catalog.py
This script streams/checks references only; it does not persist or redistribute the photo files.
"""
from __future__ import annotations

import asyncio
from collections import Counter
import hashlib

import httpx

from mystyle.catalog import ITEMS

CONCURRENCY = 6
TIMEOUT_SECONDS = 25.0

async def check(client: httpx.AsyncClient, item: dict, semaphore: asyncio.Semaphore) -> tuple[str, str, str]:
    async with semaphore:
        try:
            response = await client.get(item["image_url"])
            content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
            if response.status_code != 200:
                return item["id"], "ERROR", f"HTTP {response.status_code}"
            if not content_type.startswith("image/"):
                return item["id"], "ERROR", f"unexpected content type {content_type or '(missing)'}"
            if not response.content:
                return item["id"], "ERROR", "empty response"
            digest = hashlib.sha256(response.content).hexdigest()
            return item["id"], "OK", digest
        except (httpx.HTTPError, TimeoutError) as exc:
            return item["id"], "ERROR", str(exc)

async def main() -> int:
    headers = {"User-Agent": "myStyle-photo-reference-check/1.0"}
    timeout = httpx.Timeout(TIMEOUT_SECONDS, connect=12.0)
    semaphore = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
        results = await asyncio.gather(*(check(client, item, semaphore) for item in ITEMS))
    failures = [(item_id, info) for item_id, status, info in results if status != "OK"]
    hashes = Counter(info for _, status, info in results if status == "OK")
    duplicates = [digest for digest, count in hashes.items() if count > 1]
    print(f"Checked {len(results)} photo references: {len(results)-len(failures)} successful, {len(failures)} failed.")
    if duplicates:
        print(f"Warning: {len(duplicates)} identical image response hash(es) detected.")
    for item_id, info in failures:
        print(f"FAIL {item_id}: {info}")
    if failures:
        return 1
    if duplicates:
        print("Review duplicate photos and remove reused image IDs before expanding the catalogue.")
        return 2
    print("All catalogue URLs returned distinct image responses.")
    return 0

if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
