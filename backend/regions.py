"""Offline place lookup: which Malaysian state a point is in, the nearest
town for a friendly name, and the lead instrument for that state.

State boundaries: geoBoundaries (gbOpen MYS ADM1), derived from
OpenStreetMap, ODbL 1.0.
"""
import json
import math
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "public" / "data"
STATES_FILE = DATA_DIR / "malaysia_states.geojson"
TOWNS_FILE = DATA_DIR / "towns.json"  # shared with the frontend's city markers

LEAD_INSTRUMENT = {
    "Sarawak": "sape",
    "Terengganu": "gamelan",
    "Kelantan": "rebab",
}
DEFAULT_LEAD = "gamelan"

TOWNS = json.loads(TOWNS_FILE.read_text(encoding="utf-8"))

_states = None


def load_states():
    global _states
    if _states is None:
        data = json.loads(STATES_FILE.read_text(encoding="utf-8"))
        _states = []
        for feature in data["features"]:
            geom = feature["geometry"]
            polygons = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
            _states.append((feature["properties"]["name"], polygons))
    return _states


def in_ring(lon, lat, ring):
    """Ray casting: is (lon, lat) inside this ring of [lon, lat] points?"""
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def state_at(lat, lon):
    for name, polygons in load_states():
        for outer, *holes in polygons:
            if in_ring(lon, lat, outer) and not any(in_ring(lon, lat, h) for h in holes):
                return name
    return None


def distance_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def lookup(lat, lon):
    state = state_at(lat, lon)
    nearest = min(TOWNS, key=lambda t: distance_km(lat, lon, t["lat"], t["lon"]))
    town = nearest["name"]
    dist = distance_km(lat, lon, nearest["lat"], nearest["lon"])
    if not state and dist <= 15:
        # Simplified outlines can miss coastal towns; trust the town's state.
        state = nearest["state"]

    if state and dist <= 15:
        name = town if town == state else f"{town}, {state}"
    elif state and dist <= 50:
        name = f"near {town}, {state}"
    elif state:
        name = state
    elif dist <= 60:
        name = f"off the coast near {town}"
    else:
        name = f"{abs(lat):.2f}°{'N' if lat >= 0 else 'S'}, {abs(lon):.2f}°{'E' if lon >= 0 else 'W'}"

    return {
        "name": name,
        "state": state,
        "nearest_town": town,
        "lead_instrument": LEAD_INSTRUMENT.get(state, DEFAULT_LEAD),
    }
