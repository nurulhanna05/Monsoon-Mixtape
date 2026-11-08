"""Fetch monthly climate data from NASA POWER, cache it, and clean it.

API docs: https://power.larc.nasa.gov/api/temporal/monthly/openapi.json
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

POWER_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
CACHE_DIR = Path(__file__).parent / "cache"
FILL_VALUE = -999

# POWER parameter name -> short name used in our JSON
PARAMS = {
    "T2M": "temp",          # °C, temperature at 2 m
    "PRECTOTCORR": "rain",  # mm/day, corrected precipitation
    "RH2M": "humidity",     # %, relative humidity at 2 m
    "WS2M": "wind",         # m/s, wind speed at 2 m
    "AOD_55": "aod",        # dimensionless, aerosol optical depth (haze)
}

# Snap taps to a 0.5° grid (roughly POWER's native resolution) so nearby
# taps share one cache file.
GRID = 0.5


def snap(value):
    return round(round(value / GRID) * GRID, 2)


def cache_path(lat, lon, start, end):
    return CACHE_DIR / f"power_{lat:.2f}_{lon:.2f}_{start}_{end}.json"


def fetch_raw(lat, lon, start, end):
    """Return the raw POWER JSON, using the local cache when possible."""
    path = cache_path(lat, lon, start, end)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8")), True

    query = urllib.parse.urlencode({
        "parameters": ",".join(PARAMS),
        "community": "ag",
        "latitude": lat,
        "longitude": lon,
        "start": start,
        "end": end,
        "format": "JSON",
    })
    with urllib.request.urlopen(f"{POWER_URL}?{query}", timeout=60) as resp:
        raw = json.loads(resp.read().decode("utf-8"))

    CACHE_DIR.mkdir(exist_ok=True)
    path.write_text(json.dumps(raw), encoding="utf-8")
    return raw, False


def interpolate(values):
    """Fill None gaps linearly; copy the nearest value at the edges."""
    known = [i for i, v in enumerate(values) if v is not None]
    if not known:
        return values
    out = list(values)
    for i, v in enumerate(out):
        if v is not None:
            continue
        before = max((k for k in known if k < i), default=None)
        after = min((k for k in known if k > i), default=None)
        if before is None:
            out[i] = values[after]
        elif after is None:
            out[i] = values[before]
        else:
            frac = (i - before) / (after - before)
            out[i] = round(values[before] + frac * (values[after] - values[before]), 2)
    return out


def season_of(month):
    if month in (11, 12, 1, 2, 3):
        return "northeast_monsoon"
    if month in (5, 6, 7, 8, 9):
        return "southwest_monsoon"
    return "inter_monsoon"


def clean(raw):
    """Turn POWER's {param: {"YYYYMM": value}} into a list of month records."""
    series = raw["properties"]["parameter"]
    # Keys like "200513" are annual averages; keep only real months 01-12.
    keys = sorted(k for k in series["T2M"] if 1 <= int(k[4:]) <= 12)

    columns, filled = {}, {}
    for power_name, short in PARAMS.items():
        source = series.get(power_name, {})
        values = [source.get(k) for k in keys]
        values = [None if v is None or v <= FILL_VALUE else v for v in values]
        filled[short] = sum(v is None for v in values)
        columns[short] = interpolate(values)

    months = []
    for i, key in enumerate(keys):
        year, month = int(key[:4]), int(key[4:])
        record = {"date": f"{year}-{month:02d}", "year": year, "month": month,
                  "season": season_of(month)}
        for short in PARAMS.values():
            record[short] = columns[short][i]
        months.append(record)
    return months, filled


def get_months(lat, lon, start, end):
    """Main entry point: snapped coordinates, cleaned months, and metadata."""
    glat, glon = snap(lat), snap(lon)
    raw, from_cache = fetch_raw(glat, glon, start, end)
    months, filled = clean(raw)
    units = {PARAMS[k]: v["units"] for k, v in raw.get("parameters", {}).items() if k in PARAMS}
    return {
        "grid": {"lat": glat, "lon": glon},
        "from_cache": from_cache,
        "units": units,
        "filled_values": filled,
        "months": months,
    }
