# Monsoon Mixtape

**Tap any place in Malaysia and hear 20 years of its climate as a one-minute
song on Malaysian instruments.**

Built for the [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/)
(Kuala Lumpur, 14–15 November 2026), challenge *The Earth Information Jukebox*.

Every month from 2006 to 2025 becomes one beat. Temperature becomes a gamelan
melody, rain becomes drumming, humidity becomes echo, haze muffles a bamboo
flute, and unusual months ring a gong. On-screen narration explains what
you're hearing as the song plays, an animated band plays along, and a
timeline shows the data under the music.

Everything is free and open: no API keys, no AI models, no paid services.
The app works offline apart from fetching new places from NASA POWER, and
37 cities come pre-saved.

---

## Quick start

You need **Python 3.10+** and a modern browser (Chrome, Edge or Firefox).

```bash
git clone https://github.com/nurulhanna05/Monsoon-Mixtape.git
cd Monsoon-Mixtape
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Open **http://127.0.0.1:8000**, then click a city dot or tap anywhere on the
map. Turn your sound on.

If `uvicorn` isn't found, use `python -m uvicorn backend.main:app --reload`.

### Optional scripts (need internet)

| Command | What it does |
|---|---|
| `python scripts/precache.py` | Re-downloads NASA data for all 37 cities into `backend/cache/` |
| `python scripts/fetch_vendor.py` | Re-downloads Tone.js and Leaflet into `public/vendor/` |

Both are already done and committed, so you don't need them for a demo.

---

## Casual version (Flutter), `alternative` branch

On this branch the front page (**http://127.0.0.1:8000**) opens a simpler,
friendlier version built with Flutter in NASA colours. The classic page is
still at **/index.html** (linked at the bottom of the app).

- **Pick a place**: search box, six favourite cities, "Surprise me", or tap
  the map.
- **Listen**: a big red Play button, the month in large type, and a speech
  bubble with the narration. Quick facts at the top (how much warmer it got,
  hottest and wettest year).
- **The band**: one tile per sound showing the data in everyday words
  ("Hot", "Very rainy", "Hazy!"). Tiles bounce when they play; tap one to
  turn that sound off or on.
- **Timeline**: red dots are the gong moments; tap or drag to jump. The
  arrow buttons skip to the previous or next gong moment.
- **Day and night mode**: the sun/moon button in the header switches. It
  starts out following the device's setting and remembers your choice.

The music comes from the same Tone.js code as the classic page
(`app/web/audio_bridge.js` connects the two). The built app is committed in
`public/app/`, so running the server is enough; you only need Flutter to
change it:

```bash
cd app
flutter build web --release --base-href /app/ --no-web-resources-cdn -o C:/path/to/repo/public/app
```

(Use the full path for `-o`, and run it from PowerShell or cmd: Git Bash
mangles `/app/`.)

---

## What's on the page

- **Map and city list.** Tap anywhere in Malaysia or pick one of 37 cities.
  The list follows whatever you tap.
- **The band.** One player per instrument, moving in time with the music and
  the data (see the table below). Players brighten while they play and sit
  dimmed while they rest or are muted.
- **Narration and month card.** Each narration line shows for about
  4 seconds, then fades. The card shows the month you're hearing.
- **Player controls.** Play/Pause, Replay, Tempo (0.5×–2×) and Volume, with a
  small level meter.
- **Timeline.** It opens in a **simple view**: one *Big moments* strip with a
  gong for each story the narration tells. Tap a gong (or anywhere) to jump
  there. Hovering shows that month in plain words.
  - **Show the data** opens one lane per layer (temperature, rain, haze,
    humidity, unusual months), drawn from the data: taller = hotter, wetter,
    hazier or more humid; brighter bars are unusual months.
  - **Mixer** adds mute (M), solo (S) and a volume slider to each lane.
    Closing the mixer puts every sound back to normal.
  - The page remembers which view you used last.

---

## How the data becomes music

| NASA POWER data | Sound | On screen |
|---|---|---|
| **Temperature** (`T2M`) | Lead melody pitch: hotter = higher, on a slendro-style 5-note scale. The melody moves one step at a time so it sounds like a tune. | Lead player strikes harder when hotter; gamelan bars light up per note, sape strings shake, rebab bow moves |
| **Rainfall** (`PRECTOTCORR`) | Kompang and gendang drums: rainier months = more hits per beat | Drummers strike bigger and faster when it's rainier |
| **Humidity** (`RH2M`) | Reverb: muggier months echo more | Humidity lane on the timeline |
| **Haze** (`AOD_55`, aerosol optical depth) | Seruling (bamboo flute) through a low-pass filter; hazy months sound muffled | Flute player sways; greys out behind a haze cloud when hazy |
| **Unusual months** | Big gong (gong ageng) | Gong player takes a big swing; the gong rocks and ripples |
| **Season** | Northeast monsoon (Nov–Mar): busy drums and extra ornaments. Southwest monsoon (May–Sep): sparse drums, more flute. | Season shown on the "now playing" card |

**Structure.** Each year is one 12-beat gamelan cycle: a kenong (small gong)
chimes every 3 months and a kempul (hanging gong) closes each year, so you can
hear the years go by. One month = one beat at 240 BPM, so 20 years ≈ 60 seconds.
The tempo slider runs from 0.5× to 2×.

**Regional lead instrument.** Chosen by the state you tap:

| State | Lead instrument |
|---|---|
| Sarawak | Sape (lute) |
| Kelantan | Rebab (bowed fiddle) |
| Terengganu and everywhere else | Gamelan (bronze metallophone) |

**Layers.** The timeline's mixer lets you mute, solo or turn down each layer
(melody, drums, flute, gongs, echo) to hear exactly what each one shows.

### Finding unusual months

Each month is compared with the **same calendar month in every other year**
(for example, December 2014 against all twenty Decembers), using a z-score:

- **Hot / cool:** temperature z-score above +2 / below −2
- **Wet:** rainfall z-score above +2
- **Dry:** under 35% of normal rainfall *and* z-score below −1 (rain can't fall
  far below zero, so z-scores alone rarely catch dry months)
- **Humid, windy, hazy:** z-score above +2

Consecutive months sharing a type (e.g. three hot months in a row) become one
event, and each event gets one gong hit.

### Narration

Narration is **rule-based**: plain Python templates filled with numbers from
the data, with no AI model. Each event type has 3–4 wordings so it doesn't
repeat. The most extreme events are narrated first, spaced at least 10 months
apart so each line can be read. Every song starts with an intro line and ends
with a summary of the trend (fitted temperature change and rainfall change
between the first and second decade).

The narration only describes what the data shows. It never names real-world
events such as specific floods or haze episodes.

---

## Accessibility

- **Keyboard:** every control is a standard button, list or slider. Focus the
  map and use the arrow keys to move, `+`/`−` to zoom and **Enter** to play the
  place under the crosshair. The **City** list offers all 37 cities, grouped by
  state.
- **Timeline by keyboard:** the timeline is a slider. Arrow keys move one
  month, Page Up/Down one year, Home/End to the ends, **N**/**P** to the next
  or previous big moment, and **Enter** jumps there. Each month is read out in
  full, e.g. "September 2015, Southwest monsoon (drier). 28.1 °C, 5.6 mm/day
  rain, 80% humidity, haze 1.80. Hazy." followed by its story, if it has one.
  This lets screen-reader users explore the 20 years at their own pace.
- **Screen readers:** labelled controls (each volume slider announces its
  value), a status message when a song loads, live captions for the
  narration, and a **text summary** of every song (ranges, unusual periods
  and trend) with the full narration as a list. The band is decorative; the
  same information is in the captions, timeline and summary.
- **Not overwhelming:** the timeline opens in a simple view; the data lanes
  and mixer are one button away for those who want them.
- **Skip link** to the player controls.
- **Motion:** an **Animations on/off** toggle, off by default when the system
  asks for reduced motion. With animations off, nothing moves, but players
  still dim when muted and the flute player still greys out in haze.
- Light and dark mode follow the system setting. Text and the timeline's lane
  colours were checked for contrast in both (text at least 4.5:1, lane
  colours at least 3:1), and the small timeline buttons are at least 24 px.

---

## Adding real instrument recordings

The app plays Tone.js synths by default. To use real recordings, drop audio
files into `public/samples/<instrument>/` and list them in that folder's
`manifest.json`. See [`public/samples/README.md`](public/samples/README.md).
Any instrument without recordings automatically falls back to its synth.

---

## Project structure

```
backend/
  main.py          FastAPI app: GET /song, serves the web page
  power.py         NASA POWER fetch, cache, cleaning (-999 → interpolated)
  analysis.py      unusual-month detection and trends
  narration.py     rule-based narration templates
  regions.py       offline state/town lookup → lead instrument
  cache/           saved NASA responses (37 cities pre-cached)
public/
  index.html       the page
  js/              app.js (UI), map.js (Leaflet), song.js (data → music),
                   instruments.js (synths/samplers), band.js (animated band,
                   inline SVG), timeline.js (multitrack timeline)
  samples/         your recordings go here
  data/            state outlines and the city list
  vendor/          Tone.js and Leaflet, saved for offline use
scripts/           precache.py, fetch_vendor.py
```

### API

`GET /song?lat=3.139&lon=101.687&start=2006&end=2025`

This returns cleaned monthly data, the region (name, state and lead
instrument), anomaly events, the trend, and timed narration lines. Points are
snapped to a 0.5° grid for caching. Interactive docs are at `/docs`.

---

## Data sources and credits

- **Climate data:** NASA Langley Research Center (LaRC) POWER Project, funded
  through the NASA Earth Science/Applied Science Program.
  [power.larc.nasa.gov](https://power.larc.nasa.gov/). Monthly point API,
  parameters `T2M`, `PRECTOTCORR`, `RH2M`, `WS2M`, `AOD_55`, 2006–2025.
- **Map tiles:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- **State boundaries:** [geoBoundaries](https://www.geoboundaries.org/)
  (gbOpen MYS ADM1), derived from OpenStreetMap, licensed under the
  [ODbL 1.0](https://opendatacommons.org/licenses/odbl/).
- **Libraries:** [Tone.js](https://tonejs.github.io/) (MIT),
  [Leaflet](https://leafletjs.com/) (BSD-2-Clause),
  [FastAPI](https://fastapi.tiangolo.com/) (MIT).
- **Band illustrations:** drawn for this project.
- **Instrument recordings:** none bundled yet. Credit any you add here.
