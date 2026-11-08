"""Download the frontend libraries once so the app works offline.

    python scripts/fetch_vendor.py
"""
import urllib.request
from pathlib import Path

VENDOR = Path(__file__).parent.parent / "public" / "vendor"

FILES = {
    "tone.js": "https://cdn.jsdelivr.net/npm/tone@15.0.4/build/Tone.js",
    "leaflet/leaflet.js": "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
    "leaflet/leaflet.css": "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
    "leaflet/images/marker-icon.png": "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
    "leaflet/images/marker-icon-2x.png": "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    "leaflet/images/marker-shadow.png": "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
}

for name, url in FILES.items():
    target = VENDOR / name
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as resp:
        target.write_bytes(resp.read())
    print(f"{name}: {target.stat().st_size:,} bytes")
