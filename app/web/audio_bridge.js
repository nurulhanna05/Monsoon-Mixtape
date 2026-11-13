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

// Set up the instruments once. This doesn't wait for sound to be allowed:
// on phones that would hang until the next tap.
function prepare() {
  setup ??= createInstruments().then((inst) => {
    instruments = inst;
    applyLayers();
  });
  return setup;
}

// Browsers only allow sound after a tap or key press, and Flutter handles
// taps a moment after the browser event, so unlock it straight from the
// page's own events. Phones only count a touch as a tap when the finger
// lifts (pointerup/touchend), so listen for those too, and keep trying
// until the sound is actually running.
function unlock() {
  if (Tone.getContext().state !== "running") Tone.start();
  playSilence();
  prepare();
}

// iPhones mute web audio when the side switch is on silent, unless the page
// says it's playing media (Safari 17+) or has played an <audio> element.
if (navigator.audioSession) navigator.audioSession.type = "playback";
const SILENCE = "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";
let silence = null;
function playSilence() {
  if (silence) return;
  silence = new Audio(SILENCE);
  silence.setAttribute("playsinline", "");
  silence.play().catch(() => {
    silence = null; // not allowed yet; try again on the next tap
  });
}
for (const type of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
  window.addEventListener(type, unlock, { capture: true, passive: true });
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
  },
  setLayer(layer, on) {
    layerOn[layer] = on;
    applyLayers();
  },
};
