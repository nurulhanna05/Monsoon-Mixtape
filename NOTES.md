# Monsoon Mixtape: progress notes

Last worked on: 8 Nov 2026. Hackathon: NASA Space Apps, Kuala Lumpur, 14–15 Nov 2026.

## How to run it
1. Open a terminal (PowerShell) and go to the project:
   `cd C:\dev\gamelan-bumi`
2. First time only: `pip install -r requirements.txt`
3. Start the server: `uvicorn backend.main:app --reload`
   (if `uvicorn` isn't recognised: `python -m uvicorn backend.main:app --reload`)
4. Open **http://127.0.0.1:8000** in Chrome or Edge.
5. Click a city dot or tap the map. Turn the volume up.
6. Stop the server with `Ctrl + C` in the terminal.

If you change backend Python files and nothing seems different, stop and
restart the server (auto-reload sometimes misses changes on Windows).

## What's done
- **Phase 1 (data):** NASA POWER monthly data (temperature, rain, humidity,
  wind, haze/aerosol AOD_55), 2006–2025. Saved to `backend/cache/` so it works
  offline. Missing values (-999) are filled by interpolation.
- **Phase 2 (sound):** Tone.js plays one month per beat, ~60 seconds per song.
- **Phase 3 (map):** Leaflet map, state outlines (work offline), place names,
  lead instrument chosen per state (sape = Sarawak, rebab = Kelantan,
  gamelan = elsewhere; the instruments themselves come in Phase 5).
- **City dots:** 37 cities on the map and in the City dropdown; all
  pre-saved, so the demo works without Wi-Fi.
- **Sound redesign:** steady beat; each year = one gamelan cycle (kenong every
  3 months, kempul at year end); smooth slendro melody (hotter = higher); rain =
  drums; humidity = echo; haze = muffled flute; seasons change the texture.
  Layer buttons let you mute/solo each sound.
- **Phase 4 (anomalies + narration):** unusual months (wet, dry, hot, cool,
  humid, windy, hazy) get a big gong hit; captions appear as the song plays;
  intro + trend summary; "Full narration" text at the bottom.

## What's left
- **Phase 5:** sape / rebab / gamelan lead sounds by region; load your own
  recordings from `public/samples/<instrument>/` (synths as fallback);
  animated SVG instruments (drums bounce, gamelan bars light up, gong ripples,
  flute greys out in haze); animations on/off toggle.
- **Phase 6:** accessibility pass (keyboard use of the map, screen-reader
  labels, text summary) and the README with setup, mapping explanation and
  credits.
- Not yet checked: whether you like the new sound. Have a listen first.

## Ideas for later
- "Compare two places" mode.
- Decided against: a different location for each variable (confusing story).

## Credits to include in the README
- NASA POWER (power.larc.nasa.gov): the climate data. Cite NASA Langley
  Research Center POWER Project.
- OpenStreetMap contributors: map tiles.
- geoBoundaries (derived from OpenStreetMap, ODbL): state outlines.
- Tone.js (MIT) and Leaflet (BSD-2): saved locally in `public/vendor/`.

## Where things are
- `backend/`: Python server (`main.py` = the /song endpoint, `power.py` = NASA
  data, `analysis.py` = unusual months, `narration.py` = captions,
  `regions.py` = state/town lookup)
- `public/`: the web page (`index.html`, `js/`, `css/`, `data/`)
- `scripts/precache.py`: re-saves data for all 37 cities (needs internet)
- `scripts/fetch_vendor.py`: re-downloads Tone.js and Leaflet (needs internet)
- `TODO.md`: short checklist
