"""Download a few free-licensed photos of each city for the slideshow.

    python scripts/fetch_photos.py            # every city still missing photos
    python scripts/fetch_photos.py Kuching    # redo one city

Takes up to three photos from the city's English Wikipedia article (chosen
by its editors, so usually the main sights) and one weather shot (rain,
sunset, mist or storm) from Wikimedia Commons. Keeps landscape JPEGs under
free licences, saves 800px copies to public/photos/<city>/ and the credits
to public/photos/photos.json (the app shows the credit on each slide, as the
licences require). Needs internet; the app itself works offline after.
"""
import html
import json
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from backend import regions  # noqa: E402

OUT = ROOT / "public" / "photos"
WIKIPEDIA = "https://en.wikipedia.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
# Wikimedia asks every tool to say who it is.
HEADERS = {"User-Agent": "MonsoonMixtape/1.0 (https://github.com/nurulhanna05/Monsoon-Mixtape)"}
# Use certifi's up-to-date certificates when installed (Windows Python's own
# list can be stale and reject Wikimedia's certificate).
try:
    import certifi

    TLS = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    TLS = ssl.create_default_context()

FROM_ARTICLE = 3
# Wikipedia article names that differ from the town name (or are ambiguous).
ARTICLES = {"Melaka": "Malacca City", "George Town": "George Town, Penang", "Labuan": "Labuan",
            "Kemaman": "Kemaman District", "Sri Aman": "Sri Aman", "Gua Musang": "Gua Musang"}
# Hand-picked Commons files for towns the searches don't cover well.
PICKS = {
    "Gua Musang": ["Gua Musang 1.jpg", "Gua Musang 4.jpg", "Bridge in Gua Musang.jpg", "Old Gua Musang 4.jpg"],
    "Kemaman": ["Chukai (Kemaman) Pantai Geliga.jpg", "Kemaman Centre Point.jpg", "Kemaman Municipal Council.jpg"],
    "Sri Aman": ["Aerial view of Sri Aman, Sarawak, Malaysia.jpg", "Aerial view of Sri Aman, Sarawak, Malaysia (2).jpg",
                 "Aerial view of Sri Aman, Sarawak, Malaysia (3).jpg"],
    "Lumut": ["Cmglee Malaysia Pangkor Island and Lumut.jpg", "Lumut jetty ferry.jpg", "Lumut 4 - panoramio.jpg",
              "Lumut (6066649794).jpg"],
}
# The weather shot: the city must be in the photo's title, and the state or
# Malaysia mentioned (so George Town isn't the one in Tasmania).
WEATHER = 'intitle:"{name}" ({state} OR Malaysia) (rain OR sunset OR mist OR fog OR storm OR clouds OR haze)'
# Small towns with few photos either way: any good view of the place.
ANY = 'intitle:"{name}" ({state} OR Malaysia) (view OR town OR river OR beach OR mosque OR temple OR hill OR park)'
FREE = re.compile(r"^(cc0|cc[ -]by|public domain|pd)", re.I)
SKIP = re.compile(
    r"\b(map|locator|logo|flag|coat of arms|seal|emblem|diagram|chart|plan|stamp|banknote|coin|poster|"
    r"screenshot|signage|sign|airliner|aircraft|airbus|boeing|airport|terminal|station|platform|"
    r"locomotive|train|bus|car|cars|taxi|parking|car park|"
    r"moth|insect|specimen|holotype|portrait|army|military|soldier|library|"
    r"tasmania|cayman|guyana|australia)\b",  # last row: other places with the same names
    re.I,
)


def api(url, **params):
    params.update(format="json", formatversion="2")
    req = urllib.request.Request(f"{url}?{urllib.parse.urlencode(params)}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30, context=TLS) as resp:
        return json.load(resp)


def plain(text):
    """Commons metadata is HTML; keep the words."""
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


def usable(page):
    """A photo dict if this file is a free, landscape JPEG worth showing, else None."""
    info = (page.get("imageinfo") or [None])[0]
    if not info or info.get("mime") != "image/jpeg":
        return None
    meta = info.get("extmetadata", {})
    licence = plain(meta.get("LicenseShortName", {}).get("value"))
    title = page["title"].split(":", 1)[1].rsplit(".", 1)[0]
    ratio = info["width"] / max(1, info["height"])
    if info["width"] < 1000 or not 1.2 <= ratio <= 2.2 or not FREE.match(licence) or SKIP.search(title):
        return None
    artist = plain(meta.get("Artist", {}).get("value")) or "Unknown"
    return {
        "title": re.sub(r"_+", " ", title),
        "credit": f"{artist[:60]}, {licence}",
        "source": info["descriptionurl"],
        "url": info["thumburl"],
    }


IMAGE_INFO = {"prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 960}


def article_photos(town):
    """Photos from the city's Wikipedia article, in the order they appear."""
    title = ARTICLES.get(town["name"], town["name"])
    try:
        files = api(WIKIPEDIA, action="parse", page=title, prop="images", redirects=1)["parse"]["images"]
    except KeyError:  # no article by that name: search for it
        found = api(WIKIPEDIA, action="query", list="search", srsearch=f"{town['name']} {town['state']} Malaysia",
                    srlimit=5)["query"]["search"]
        title = next((r["title"] for r in found if town["name"].lower() in r["title"].lower()), None)
        if not title:
            return []
        files = api(WIKIPEDIA, action="parse", page=title, prop="images", redirects=1)["parse"]["images"]
    files = [f"File:{f}" for f in files if f.lower().endswith((".jpg", ".jpeg"))][:50]
    if not files:
        return []
    pages = api(WIKIPEDIA, action="query", titles="|".join(files), **IMAGE_INFO)["query"]["pages"]
    by_title = {p["title"].replace("_", " "): p for p in pages}
    photos = [usable(by_title[f.replace("_", " ")]) for f in files if f.replace("_", " ") in by_title]
    return [p for p in photos if p]


def commons_photos(town, query):
    data = api(COMMONS, action="query", generator="search", gsrsearch=f"{query.format(**town)} filetype:bitmap",
               gsrnamespace=6, gsrlimit=20, **IMAGE_INFO)
    pages = sorted(data.get("query", {}).get("pages", []), key=lambda p: p.get("index", 0))
    photos = [usable(p) for p in pages if town["name"].lower() in p["title"].lower()]
    return [p for p in photos if p]


def shrink(path):
    """800px wide at JPEG quality 80 keeps the repo small (needs Pillow; skipped without it)."""
    try:
        from PIL import Image
    except ImportError:
        return
    with Image.open(path) as img:
        img = img.convert("RGB")
        if img.width > 800:
            img = img.resize((800, round(img.height * 800 / img.width)), Image.LANCZOS)
        img.save(path, "JPEG", quality=80, optimize=True, progressive=True)


def picked_photos(town):
    files = [f"File:{f}" for f in PICKS[town["name"]]]
    pages = api(COMMONS, action="query", titles="|".join(files), **IMAGE_INFO)["query"]["pages"]
    by_title = {p["title"]: p for p in pages}
    # Hand-picked, so only the licence check matters (some are portrait-ish).
    photos = []
    for f in files:
        info = (by_title.get(f, {}).get("imageinfo") or [None])[0]
        if not info:
            continue
        meta = info.get("extmetadata", {})
        licence = plain(meta.get("LicenseShortName", {}).get("value"))
        if FREE.match(licence):
            artist = plain(meta.get("Artist", {}).get("value")) or "Unknown"
            photos.append({"title": f[5:].rsplit(".", 1)[0], "credit": f"{artist[:60]}, {licence}",
                           "source": info["descriptionurl"], "url": info["thumburl"]})
    return photos


def fetch_city(town):
    folder = OUT / re.sub(r"[^a-z0-9]+", "-", town["name"].lower()).strip("-")
    if town["name"] in PICKS:
        return save(folder, picked_photos(town))
    chosen = article_photos(town)[:FROM_ARTICLE]
    time.sleep(0.5)  # be gentle with the API
    for query in (WEATHER, WEATHER, ANY):  # weather first; small towns fill up with more of either
        if len(chosen) >= 4:
            break
        seen = {c["source"] for c in chosen}
        extra = next((p for p in commons_photos(town, query) if p["source"] not in seen), None)
        if extra:
            chosen.append(extra)
        time.sleep(0.5)
    if len(chosen) < 4:  # still short: more from the article
        seen = {c["source"] for c in chosen}
        chosen += [p for p in article_photos(town) if p["source"] not in seen][: 4 - len(chosen)]
    return save(folder, chosen)


def save(folder, chosen):
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("*.jpg"):
        old.unlink()
    photos = []
    for n, photo in enumerate(chosen, 1):
        path = folder / f"{n}.jpg"
        req = urllib.request.Request(photo.pop("url"), headers=HEADERS)
        with urllib.request.urlopen(req, timeout=60, context=TLS) as resp:
            path.write_bytes(resp.read())
        shrink(path)
        photos.append({"file": f"{folder.name}/{path.name}", **photo})
        time.sleep(0.5)
    return photos


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index_path = OUT / "photos.json"
    index = json.loads(index_path.read_text("utf-8")) if index_path.exists() else {}
    names = sys.argv[1:]
    for town in regions.TOWNS:
        if (names and town["name"] not in names) or (not names and index.get(town["name"])):
            continue
        try:
            index[town["name"]] = fetch_city(town)
        except (OSError, KeyError) as err:
            print(f"{town['name']}: FAILED ({err})")
            continue
        index_path.write_text(json.dumps(index, indent=1, ensure_ascii=False), "utf-8")
        print(f"{town['name']}: {len(index[town['name']])} photos")


if __name__ == "__main__":
    main()
