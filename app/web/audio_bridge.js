// Bridge between the Flutter app and the shared sound engine in /js/.
// Flutter draws the screens; the music is made by the same Tone.js code as
// the classic page, so both versions sound identical.
//
// Exposes window.mixtapeAudio for Dart (see lib/audio.dart).

import { createInstruments, LAYERS } from "../js/instruments.js";
import { BASE_BPM, buildBeats, scheduleSong } from "../js/song.js";

const transport = Tone.getTransport();
transport.bpm.value = BASE_BPM;

let instruments = null;
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
  if (!instruments) return;
  for (const layer of LAYERS) instruments.channels[layer].mute = !layerOn[layer];
  instruments.echoLevel = layerOn.humidity ? 1 : 0;
}

// Sliders are in percent; squaring makes 50% sound about half as loud.
function percentToDb(percent) {
  return percent === 0 ? -Infinity : Tone.gainToDb((percent / 100) ** 2);
}

function hit(name, info) {
  // Group the instruments into the four tiles the app shows.
  const tile = { lead: "melody", kompang: "drums", gendang: "drums", seruling: "flute", gong: "gongs" }[name];
  if (tile) handlers.onHit(tile, Boolean(info.big));
}

window.mixtapeAudio = {
  prepare,

  setHandlers(onBeat, onHit, onEnd) {
    handlers = { onBeat, onHit, onEnd };
  },

  // Schedules a /song response (as a JSON string) and returns the month count.
  async load(json) {
    await prepare();
    const song = JSON.parse(json);
    const beats = buildBeats(song);
    transport.stop();
    scheduleSong(beats, instruments, song.region.lead_instrument, {
      onBeat: (beat) => handlers.onBeat(beat.index),
      onHit: hit,
      onEnd: () => {
        transport.stop();
        handlers.onEnd();
      },
    });
    return beats.length;
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
