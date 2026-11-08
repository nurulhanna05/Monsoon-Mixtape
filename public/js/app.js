import { createStage } from "./animations.js";
import { createInstruments, LAYERS } from "./instruments.js";
import { createMap } from "./map.js";
import { BASE_BPM, buildBeats, scheduleSong } from "./song.js";

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
};

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
  $("progress").value = beat.index + 1;
  if (lines.has(beat.index)) showCaption(lines.get(beat.index));
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
    });
  return audioSetup;
}

function applyLayers() {
  if (!instruments) return;
  for (const layer of LAYERS) {
    const channel = instruments.channels[layer];
    channel.mute = layerState.muted[layer];
    channel.solo = layerState.solo === layer;
  }
  instruments.humidityOn = layerState.humidity;
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
    $("progress").max = beats.length;
    $("progress").value = 0;
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
const stage = await createStage($("stage"));

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

// Layer mute/solo buttons.
for (const button of document.querySelectorAll("[data-layer]")) {
  button.addEventListener("click", () => {
    const layer = button.dataset.layer;
    const on = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(on));
    if (layer === "humidity") layerState.humidity = on;
    else layerState.muted[layer] = !on;
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

transport.bpm.value = BASE_BPM;
