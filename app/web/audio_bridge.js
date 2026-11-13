// Bridge between the Flutter app and the shared sound engine in /js/.
// Flutter draws the screens; the music is made by the same Tone.js code as
// the classic page, so both versions sound identical.
//
// Exposes window.mixtapeAudio for Dart (see lib/audio.dart).

import { createBand } from "../js/band.js";
import { createInstruments, LAYERS } from "../js/instruments.js";
import { BASE_BPM, buildBeats, scheduleSong } from "../js/song.js";

const transport = Tone.getTransport();
transport.bpm.value = BASE_BPM;

let instruments = null;
let band = null; // the animated players on the stage (band.js), once mounted
let lead = "gamelan";
let setup = null;
let handlers = { onBeat() {}, onHit() {}, onEnd() {} };
const layerOn = { melody: true, drums: true, flute: true, gongs: true, humidity: true };

// Browsers only allow sound after a tap or key press. Flutter handles taps
// a moment after the browser event, so also unlock audio on the very first
// press anywhere on the page.
function prepare() {
  setup ??= Tone.start()
    .then(createInstruments)
    .then((inst) => {
      instruments = inst;
      applyLayers();
    });
  return setup;
}
for (const type of ["pointerdown", "keydown"]) {
  window.addEventListener(type, () => prepare(), { once: true, capture: true });
}

function applyLayers() {
  band?.setDimmed(LAYERS.filter((l) => !layerOn[l]));
  if (!instruments) return;
  for (const layer of LAYERS) instruments.channels[layer].mute = !layerOn[layer];
  instruments.echoLevel = layerOn.humidity ? 1 : 0;
}

// Sliders are in percent; squaring makes 50% sound about half as loud.
function percentToDb(percent) {
  return percent === 0 ? -Infinity : Tone.gainToDb((percent / 100) ** 2);
}

// Every note in the song for the rhythm-game highway, sorted by time. `at`
// and `len` are in beats (months). Same rules as the playground branch.
function buildChart(beats) {
  const notes = [];
  for (const b of beats) {
    const i = b.index;
    // Melody: one arrow per month, coloured by how hot it is.
    notes.push({ lane: "melody", at: i, heat: b.step / 8, kind: "gem" });
    // Drums: small arrows for kompang taps, full-size ones for gendang hits.
    for (const s of b.kompangHits) notes.push({ lane: "drums", at: i + s / 4, kind: "tap" });
    if (b.gendang) notes.push({ lane: "drums", at: i, kind: "drum" });
    if (b.gendangExtra) notes.push({ lane: "drums", at: i + 0.5, kind: "drum" });
    // Flute: a hold note for each phrase; grey in hazy months.
    if (b.serulingBeats) {
      notes.push({ lane: "flute", at: i, len: b.serulingBeats * 0.9, kind: "hold", hazy: b.hazy });
    }
    // Gongs: kenong and kempul keep time; the big gong marks unusual months.
    if (b.kenong) notes.push({ lane: "gongs", at: i, kind: "tick" });
    if (b.kempul) notes.push({ lane: "gongs", at: i, kind: "kempul" });
    if (b.gong) notes.push({ lane: "gongs", at: i, kind: "gong", severity: b.gong.severity });
  }
  return notes.sort((a, b) => a.at - b.at);
}

// ---------- Spoken narration ----------
// Lines recorded with Qwen3-TTS (scripts/record_narration.py) play from
// /narration/; anything else uses the browser's own voice. While the
// narrator talks, the music dips a little.

const NARRATION_URL = new URL("../narration/", import.meta.url);
let recordings = {}; // narration text -> file
fetch(new URL("manifest.json", NARRATION_URL))
  .then((r) => (r.ok ? r.json() : {}))
  .then((m) => (recordings = m))
  .catch(() => {}); // no recordings: the browser voice reads everything

let voiceVolume = 0.8;
let speaking = null; // { stop() } for the line being spoken
let waiting = null; // the newest line that arrived mid-sentence

function duck(on) {
  if (!instruments) return;
  for (const layer of LAYERS) instruments.channels[layer].volume.rampTo(on ? -9 : 0, 0.4);
}

function say(text) {
  duck(true);
  const done = () => {
    speaking = null;
    if (waiting) {
      const next = waiting;
      waiting = null;
      say(next);
    } else {
      duck(false);
    }
  };
  const file = recordings[text];
  if (file) {
    const clip = new Audio(new URL(file, NARRATION_URL).href);
    clip.volume = voiceVolume;
    clip.onended = clip.onerror = done;
    speaking = { stop: () => { clip.onended = clip.onerror = null; clip.pause(); } };
    clip.play().catch(done);
  } else if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.95;
    utterance.volume = voiceVolume;
    utterance.onend = utterance.onerror = done;
    speaking = { stop: () => { utterance.onend = utterance.onerror = null; speechSynthesis.cancel(); } };
    speechSynthesis.speak(utterance);
  } else {
    done();
  }
}

function hit(name, info) {
  // Group the instruments into the four tiles the app shows.
  const tile = { lead: "melody", kompang: "drums", gendang: "drums", seruling: "flute", gong: "gongs" }[name];
  if (tile) handlers.onHit(tile, Boolean(info.big));
  band?.hit(name, info);
}

window.mixtapeAudio = {
  prepare,

  // Put the band.js players into an element Flutter made for them. Called
  // again if the stage is rebuilt (e.g. the window is resized).
  mountBand(element) {
    element.className = "band-stage";
    band = createBand(element);
    band.reset(lead);
    band.setEnabled(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    applyLayers();
  },

  setHandlers(onBeat, onHit, onEnd) {
    handlers = { onBeat, onHit, onEnd };
  },

  // Schedules a /song response (as a JSON string) and returns its note
  // chart as a JSON string.
  async load(json) {
    await prepare();
    const song = JSON.parse(json);
    const beats = buildBeats(song);
    lead = song.region.lead_instrument;
    band?.reset(lead);
    transport.stop();
    scheduleSong(beats, instruments, song.region.lead_instrument, {
      onBeat: (beat) => handlers.onBeat(beat.index),
      onHit: hit,
      onEnd: () => {
        transport.stop();
        handlers.onEnd();
      },
    });
    return JSON.stringify(buildChart(beats));
  },

  // Months played so far, at the moment you hear them (for the highway).
  position() {
    return transport.getTicksAtTime(Tone.immediate()) / transport.PPQ;
  },

  async play() {
    await prepare();
    transport.start();
  },
  pause() {
    transport.pause();
  },
  stop() {
    transport.stop();
  },
  isPlaying() {
    return transport.state === "started";
  },

  // Jump to a month; keeps playing or paused as it was, and starts playing
  // if the song had finished.
  seek(index) {
    const ticks = index * transport.PPQ;
    if (transport.state === "stopped") transport.start(undefined, `${ticks}i`);
    else transport.ticks = ticks;
  },

  setTempo(factor) {
    transport.bpm.value = BASE_BPM * factor;
  },
  setVolume(percent) {
    Tone.getDestination().volume.value = percentToDb(percent);
    voiceVolume = (percent / 100) ** 2;
  },

  // Speak a narration line; if one is still being spoken, this one waits
  // (only the newest waits, so the voice never falls far behind).
  speak(text) {
    if (speaking) waiting = text;
    else say(text);
  },
  // Stop talking (pause, jump, new place, narrator turned off).
  hush() {
    waiting = null;
    speaking?.stop();
    speaking = null;
    duck(false);
  },
  setLayer(layer, on) {
    layerOn[layer] = on;
    applyLayers();
  },
};
