"""Pre-fetch every city on the map so the demo works without internet.

    python scripts/precache.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend import power, regions  # noqa: E402
from backend.main import DEFAULT_END, DEFAULT_START  # noqa: E402

for town in regions.TOWNS:
    try:
        data = power.get_months(town["lat"], town["lon"], DEFAULT_START, DEFAULT_END)
    except OSError as err:
        print(f"{town['name']}: FAILED ({err})")
        continue
    source = "cache" if data["from_cache"] else "NASA POWER"
    print(f"{town['name']}: {len(data['months'])} months from {source}, grid {data['grid']}")
