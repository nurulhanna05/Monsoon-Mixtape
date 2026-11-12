import { createBand } from "./band.js";
import { createInstruments, LAYERS } from "./instruments.js";
import { createMap } from "./map.js";
import { BASE_BPM, buildBeats, scheduleSong } from "./song.js";
import { createTimeline } from "./timeline.js";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const SEASON_LABELS = {
  northeast_monsoon: "Northeast monsoon",
  southwest_monsoon: "Southwest monsoon (drier)",
  inter_monsoon: "Inter-monsoon",
};
const LEAD_LABELS = {
  gamelan: "gamelan (bronze metallophone)",
  sape: "sape (Sarawak lute)",
  rebab: "rebab (bowed spike fiddle)",
};
const FLAG_LABELS = {
  wet: "Very wet", dry: "Very dry", hot: "Unusually hot", cool: "Unusually cool",
  humid: "Very humid", windy: "Windy", hazy: "Hazy",
};

const $ = (id) => document.getElementById(id);
const transport = Tone.getTransport();
let instruments = null;
let beats = [];
let lines = new Map(); // month index -> narration line
let requestId = 0; // ignore slow responses for places the user has moved on from

// Layer switches live here so they survive loading new songs.
const layerState = {
  muted: Object.fromEntries(LAYERS.map((l) => [l, false])),
  solo: null,
  humidity: true,
  volume: { melody: 100, drums: 100, flute: 100, gongs: 100, humidity: 100 }, // percent
};

// Sliders are in percent; squaring makes 50% sound about half as loud.
function percentToDb(percent) {
  return percent === 0 ? -Infinity : Tone.gainToDb((percent / 100) ** 2);
}

// ---------- Small UI helpers ----------

function setStatus(text) {
  $("status").textContent = text;
}

function setPlaying(playing) {
  $("play").textContent = playing ? "Pause" : "Play";
  $("play").setAttribute("aria-pressed", String(playing));
}

function formatDate(isoMonth) {
  const [y, m] = isoMonth.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function showCaption(line) {
  $("caption").textContent = line.text;
  $("caption").dataset.kind = line.kind;
  for (const li of $("transcript").children) {
    li.classList.toggle("current", li.dataset.index === String(line.month_index));
  }
}

function showBeat(beat) {
  const m = beat.month;
  $("now-date").textContent = `${MONTH_NAMES[m.month - 1]} ${m.year}`;
  $("now-season").textContent = SEASON_LABELS[m.season];
  $("now-temp").textContent = `${m.temp.toFixed(1)} °C`;
  $("now-rain").textContent = `${m.rain.toFixed(1)} mm/day`;
  $("now-humidity").textContent = `${Math.round(m.humidity)} %`;
  $("now-haze").textContent = m.aod.toFixed(2);
  $("now-flags").replaceChildren(...m.flags.map((f) => {
    const chip = document.createElement("span");
    chip.className = `chip chip-${f}`;
    chip.textContent = FLAG_LABELS[f];
    return chip;
  }));
  if (lines.has(beat.index)) showCaption(lines.get(beat.index));
}

// Plain description of a month, read out by the timeline slider and shown
// in its tooltip, e.g. "September 2015, Southwest monsoon (drier). 27.9 °C,
// 5.1 mm/day rain, 85% humidity, haze 1.20. Hazy. <its story, if any>"
function describeBeat(beat) {
  const m = beat.month;
  const parts = [
    `${MONTH_NAMES[m.month - 1]} ${m.year}, ${SEASON_LABELS[m.season]}.`,
    `${m.temp.toFixed(1)} °C, ${m.rain.toFixed(1)} mm/day rain, ` +
      `${Math.round(m.humidity)}% humidity, haze ${m.aod.toFixed(2)}.`,
  ];
  if (m.flags.length) parts.push(`${m.flags.map((f) => FLAG_LABELS[f]).join(", ")}.`);
  const line = lines.get(beat.index);
  if (line && isStory(line)) parts.push(line.text);
  return parts.join(" ");
}

const isStory = (line) => line.kind !== "intro" && line.kind !== "summary";

// Jump to a month. Keeps playing (or paused) as it was; after the song has
// finished, it starts playing from there.
function seekTo(index) {
  if (!beats.length) return;
  const ticks = index * transport.PPQ;
  if (transport.state === "stopped") {
    transport.start(undefined, `${ticks}i`);
    setPlaying(true);
  } else {
    transport.ticks = ticks;
  }
  showBeat(beats[index]);
  // Show the narration line that was last reached at this point.
  const reached = [...lines.keys()].filter((k) => k <= index);
  if (reached.length) showCaption(lines.get(Math.max(...reached)));
}

function showNarration(song) {
  lines = new Map(song.narration.map((l) => [l.month_index, l]));
  $("transcript").replaceChildren(...song.narration.map((l) => {
    const li = document.createElement("li");
    li.dataset.index = l.month_index;
    const when = l.kind === "intro" || l.kind === "summary" ? "" : `${formatDate(l.date)}: `;
    li.textContent = when + l.text;
    return li;
  }));
  showCaption(song.narration[0]);
}

function showSummary(song, lead) {
  const months = song.months;
  const range = (key, digits) => {
    const values = months.map((m) => m[key]);
    return `${Math.min(...values).toFixed(digits)} to ${Math.max(...values).toFixed(digits)}`;
  };
  const counts = {};
  for (const a of song.anomalies) for (const k of a.kinds) counts[k] = (counts[k] || 0) + 1;
  const countText = Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ");
  const summaryLine = song.narration[song.narration.length - 1].text;

  const paragraphs = [
    `${song.narration[0].text} The lead instrument is the ${LEAD_LABELS[lead]}.`,
    `Temperature ranged from ${range("temp", 1)} °C and sets the melody: hotter months play higher notes.`,
    `Rainfall ranged from ${range("rain", 1)} mm per day and sets the drums: rainier months are busier.`,
    `Humidity ranged from ${range("humidity", 0)}% and sets the echo: muggier months echo more.`,
    `Haze (aerosol optical depth) ranged from ${range("aod", 2)}; hazy months muffle the flute.`,
    `A gong marks each of ${song.anomalies.length} unusual periods` + (countText ? ` (${countText}).` : "."),
    summaryLine,
  ];
  $("summary-text").replaceChildren(...paragraphs.map((text) => {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  }));
}

// ---------- Audio ----------

let audioSetup = null;

// Browsers only allow audio after a user gesture, so call this from clicks.
function ensureAudio() {
  audioSetup ??= Tone.start()
    .then(createInstruments)
    .then((inst) => {
      instruments = inst;
      applyLayers();
      startMeter();
    });
  return audioSetup;
}

function applyLayers() {
  // Dim timeline lanes and band players that can't be heard.
  const silent = LAYERS.filter((l) => layerState.muted[l] || layerState.volume[l] === 0 ||
    (layerState.solo && layerState.solo !== l));
  stage.setDimmed(silent);
  timeline.setDimmed([...silent, ...(layerState.humidity && layerState.volume.humidity ? [] : ["humidity"])]);
  if (!instruments) return;
  for (const layer of LAYERS) {
    const channel = instruments.channels[layer];
    channel.mute = layerState.muted[layer];
    channel.solo = layerState.solo === layer;
    channel.volume.value = percentToDb(layerState.volume[layer]);
  }
  instruments.echoLevel = layerState.humidity ? layerState.volume.humidity / 100 : 0;
}

// Live level meter on the master output, redrawn every frame.
function startMeter() {
  const meter = new Tone.Meter({ smoothing: 0.8 });
  Tone.getDestination().connect(meter);
  const fill = $("meter-fill");
  const draw = () => {
    const db = meter.getValue(); // about -60 (quiet) to 0 (loudest)
    const level = Math.min(1, Math.max(0, (db + 60) / 60));
    fill.style.transform = `scaleX(${level})`;
    fill.classList.toggle("hot", db > -3);
    requestAnimationFrame(draw);
  };
  draw();
}

function onEnd() {
  transport.stop();
  setPlaying(false);
  setStatus("Finished. Press Play to hear it again, or pick another place.");
}

// Load a place's song and start playing it.
async function playPlace(lat, lon) {
  const id = ++requestId;
  transport.stop();
  setPlaying(false);
  beats = [];
  map.setMarker(lat, lon);
  // Keep the dropdown in step with the map; blank when it isn't a city dot.
  const town = towns.find((t) => t.lat === lat && t.lon === lon);
  $("city").value = town ? town.name : "";
  setStatus(`Loading climate data for ${lat.toFixed(2)}°, ${lon.toFixed(2)}°…`);

  try {
    // Start audio during the click itself, before waiting on the network.
    const audioReady = ensureAudio();
    const resp = await fetch(`/song?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
    const song = await resp.json();
    if (!resp.ok) throw new Error(song.detail || resp.statusText);
    await audioReady;
    if (id !== requestId) return;

    const lead = song.region.lead_instrument;
    beats = buildBeats(song);
    stage.reset(lead);
    scheduleSong(beats, instruments, lead, { onBeat: showBeat, onHit: stage.hit, onEnd });
    timeline.load(beats, song.narration.filter(isStory).map((l) => l.month_index));
    map.setMarker(lat, lon, song.region.name);
    showNarration(song);
    showSummary(song, lead);

    const source = song.from_cache ? "saved data" : "fresh from NASA POWER";
    setStatus(`Playing ${song.region.name}, ${song.start}–${song.end}, on ${lead} (${source}). ` +
      `${song.anomalies.length} unusual periods, each marked by a gong.`);
    transport.start();
    setPlaying(true);
  } catch (err) {
    if (id === requestId) setStatus(`Couldn't load this place: ${err.message}`);
  }
}

// ---------- Setup ----------

const towns = await fetch("data/towns.json").then((r) => r.json());
const map = await createMap("map", towns, playPlace);
const stage = createBand($("stage"));
const timeline = createTimeline(document.querySelector(".lanes"), { onSeek: seekTo, describe: describeBeat });

// Animations: on by default unless the system asks for reduced motion.
function setAnimations(on) {
  stage.setEnabled(on);
  $("anim-toggle").setAttribute("aria-pressed", String(on));
  $("anim-toggle").textContent = on ? "Animations: on" : "Animations: off";
}
setAnimations(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
$("anim-toggle").addEventListener("click", () => {
  setAnimations($("anim-toggle").getAttribute("aria-pressed") !== "true");
});

// City picker grouped by state.
const byState = new Map();
for (const town of towns) {
  if (!byState.has(town.state)) byState.set(town.state, []);
  byState.get(town.state).push(town);
}
for (const state of [...byState.keys()].sort()) {
  const group = document.createElement("optgroup");
  group.label = state;
  for (const town of byState.get(state)) group.append(new Option(town.name, town.name));
  $("city").append(group);
}

$("city").addEventListener("change", () => {
  const town = towns.find((t) => t.name === $("city").value);
  if (!town) return;
  map.flyTo(town.lat, town.lon);
  playPlace(town.lat, town.lon);
});

$("play").addEventListener("click", async () => {
  if (!beats.length) {
    const town = towns.find((t) => t.name === $("city").value) || towns[0];
    return playPlace(town.lat, town.lon);
  }
  await ensureAudio();
  if (transport.state === "started") {
    transport.pause();
    setPlaying(false);
  } else {
    transport.start();
    setPlaying(true);
  }
});

$("replay").addEventListener("click", async () => {
  if (!beats.length) return;
  await ensureAudio();
  transport.stop();
  transport.position = 0;
  transport.start();
  setPlaying(true);
});

$("tempo").addEventListener("input", () => {
  const factor = Number($("tempo").value);
  transport.bpm.value = BASE_BPM * factor;
  $("tempo-value").textContent = `${factor.toFixed(2)}×`;
});

function setMasterVolume() {
  const percent = Number($("master").value);
  Tone.getDestination().volume.value = percentToDb(percent);
  $("master").setAttribute("aria-valuetext", `${percent}%`);
  $("master-value").textContent = `${percent}%`;
}
$("master").addEventListener("input", setMasterVolume);
setMasterVolume();

// Lane header mute/solo buttons and volume sliders.
for (const button of document.querySelectorAll("[data-mute]")) {
  button.addEventListener("click", () => {
    const layer = button.dataset.mute;
    const muted = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(muted));
    if (layer === "humidity") layerState.humidity = !muted;
    else layerState.muted[layer] = muted;
    applyLayers();
  });
}
for (const button of document.querySelectorAll("[data-solo]")) {
  button.addEventListener("click", () => {
    const layer = button.dataset.solo;
    layerState.solo = layerState.solo === layer ? null : layer;
    for (const b of document.querySelectorAll("[data-solo]")) {
      b.setAttribute("aria-pressed", String(b.dataset.solo === layerState.solo));
    }
    applyLayers();
  });
}
for (const slider of document.querySelectorAll("[data-volume]")) {
  slider.addEventListener("input", () => {
    layerState.volume[slider.dataset.volume] = Number(slider.value);
    slider.setAttribute("aria-valuetext", `${slider.value}%`);
    applyLayers();
  });
}

// Puts every sound back to normal (used when the mixer is closed).
function resetMixer() {
  layerState.muted = Object.fromEntries(LAYERS.map((l) => [l, false]));
  layerState.solo = null;
  layerState.humidity = true;
  for (const l of Object.keys(layerState.volume)) layerState.volume[l] = 100;
  for (const b of document.querySelectorAll("[data-mute], [data-solo]")) b.setAttribute("aria-pressed", "false");
  for (const slider of document.querySelectorAll("[data-volume]")) {
    slider.value = 100;
    slider.setAttribute("aria-valuetext", "100%");
  }
  applyLayers();
}

// Timeline views: simple (story strip only) → data lanes → data + mixer.
// Remembered per browser, so curious users don't have to reopen it.
const VIEW_KEY = "monsoon-mixtape-view";
function setView(showData, mixer) {
  mixer = showData && mixer;
  const tracks = document.querySelector(".tracks");
  tracks.classList.toggle("simple", !showData);
  tracks.classList.toggle("mixer", mixer);
  $("show-data").setAttribute("aria-expanded", String(showData));
  $("show-data").textContent = showData ? "Hide the data" : "Show the data";
  $("show-mixer").hidden = !showData;
  $("show-mixer").setAttribute("aria-pressed", String(mixer));
  $("mixer-note").hidden = !mixer;
  if (!mixer) resetMixer();
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify({ showData, mixer }));
  } catch {
    // Storage blocked (e.g. private window): the view just isn't remembered.
  }
}
$("show-data").addEventListener("click", () => {
  setView($("show-data").getAttribute("aria-expanded") !== "true", false);
});
$("show-mixer").addEventListener("click", () => {
  setView(true, $("show-mixer").getAttribute("aria-pressed") !== "true");
});
let savedView = {};
try {
  savedView = JSON.parse(localStorage.getItem(VIEW_KEY)) || {};
} catch {
  // Nothing saved, or storage blocked: start in the simple view.
}
setView(Boolean(savedView.showData), Boolean(savedView.mixer));

transport.bpm.value = BASE_BPM;
