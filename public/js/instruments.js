// Builds the instruments. Each one first tries to load real recordings from
// /samples/<name>/manifest.json; if there are none, it uses a Tone.js synth.
//
// Each layer goes through its own Tone.Channel so it can be muted or soloed.

export const LAYERS = ["melody", "drums", "flute", "gongs"];
export const LEADS = ["gamelan", "sape", "rebab"];

// Single-voice synths throw if a note starts at or before the previous one,
// which can happen when the browser stalls and Tone catches up. This returns
// a clock that nudges such notes a few milliseconds later instead.
function monotonic() {
  let last = -1;
  // Never in the past either: Tone moves late notes to "now", which could
  // put two of them at the same instant (after a seek or a busy moment).
  return (time) => (last = Math.max(time, last + 0.005, Tone.immediate() + 0.005));
}

// Load /samples/<name>/ as a Tone.Sampler, or return null to use the synth.
async function loadSampler(name, destination) {
  try {
    const resp = await fetch(`samples/${name}/manifest.json`);
    if (!resp.ok) return null;
    const manifest = await resp.json();
    const urls = manifest.notes || {};
    if (!Object.keys(urls).length) return null;

    const sampler = await new Promise((resolve, reject) => {
      const s = new Tone.Sampler({
        urls,
        baseUrl: `samples/${name}/`,
        release: manifest.release ?? 1,
        volume: manifest.volume ?? -6,
        onload: () => resolve(s),
        onerror: reject,
      });
    });
    sampler.connect(destination);
    console.info(`[instruments] ${name}: using recordings`);
    return { sampler, note: Object.keys(urls)[0] };
  } catch (err) {
    console.warn(`[instruments] ${name}: recordings failed to load, using synth`, err);
    return null;
  }
}

// --- Lead instruments (one per region). Each has play(freq, dur, time, vel).

function gamelanSynth(out) {
  // Saron-like metallophone: a short FM burst gives the metallic strike,
  // then it rings as a sine.
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2.76,
    modulationIndex: 2.5,
    envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.6 },
    modulationEnvelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.1 },
    volume: -12,
  }).connect(out);
  return (freq, dur, time, vel) => synth.triggerAttackRelease(freq, dur, time, vel);
}

function sapeSynth(out) {
  // Sape (Sarawak lute): bright pluck that fades quickly.
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1,
    modulationIndex: 6,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.4 },
    modulationEnvelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    volume: -12,
  }).connect(out);
  return (freq, dur, time, vel) => synth.triggerAttackRelease(freq, dur, time, vel);
}

function rebabSynth(out) {
  // Rebab (bowed spike fiddle): soft sawtooth with vibrato, slower attack.
  const filter = new Tone.Filter(1600, "lowpass").connect(out);
  const vibrato = new Tone.Vibrato(5.5, 0.1).connect(filter);
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.08, decay: 0.2, sustain: 0.7, release: 0.25 },
    volume: -22,
  }).connect(vibrato);
  return (freq, dur, time, vel) => synth.triggerAttackRelease(freq, dur, time, vel);
}

const LEAD_STYLE = {
  // elaborate: add a quieter octave-up note between beats (like a bonang)
  // legato: hold notes slightly longer so a bowed line connects
  gamelan: { build: gamelanSynth, elaborate: true, legato: false },
  sape: { build: sapeSynth, elaborate: true, legato: false },
  rebab: { build: rebabSynth, elaborate: false, legato: true },
};

export async function createInstruments() {
  const limiter = new Tone.Limiter(-1).toDestination();
  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.2 }).connect(limiter);
  await reverb.generate();

  const channels = {};
  for (const name of LAYERS) channels[name] = new Tone.Channel().connect(reverb);

  // The seruling goes through a vibrato and a low-pass filter that closes
  // when the air is hazy (applies to recordings and synth alike).
  const serulingFilter = new Tone.Filter(5000, "lowpass").connect(channels.flute);
  const vibrato = new Tone.Vibrato(5, 0.12).connect(serulingFilter);

  // Try every set of recordings at once.
  const names = [...LEADS, "kompang", "gendang", "seruling", "gong"];
  const destinations = { kompang: channels.drums, gendang: channels.drums, seruling: vibrato, gong: channels.gongs };
  const loaded = await Promise.all(names.map((n) => loadSampler(n, destinations[n] || channels.melody)));
  const samples = Object.fromEntries(names.map((n, i) => [n, loaded[i]]));

  // --- Leads
  const leads = {};
  for (const name of LEADS) {
    const style = LEAD_STYLE[name];
    const s = samples[name];
    leads[name] = {
      ...style,
      sampled: Boolean(s),
      play: s
        ? (freq, dur, time, vel) => s.sampler.triggerAttackRelease(freq, dur, time, vel)
        : style.build(channels.melody),
    };
  }

  // --- Drums: kompang (frame drum slap) and gendang (deep barrel drum).
  let kompang;
  if (samples.kompang) {
    const { sampler, note } = samples.kompang;
    kompang = { hit: (time, vel) => sampler.triggerAttackRelease(note, "8n", time, vel) };
  } else {
    const slapFilter = new Tone.Filter(2500, "highpass").connect(channels.drums);
    const slap = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
      volume: -26,
    }).connect(slapFilter);
    const body = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
      volume: -18,
    }).connect(channels.drums);
    const clock = monotonic();
    kompang = {
      hit(time, vel) {
        time = clock(time);
        body.triggerAttackRelease("A3", "32n", time, vel);
        slap.triggerAttackRelease("32n", time, vel);
      },
    };
  }

  let gendang;
  if (samples.gendang) {
    const { sampler, note } = samples.gendang;
    gendang = { hit: (time, vel) => sampler.triggerAttackRelease(note, "4n", time, vel) };
  } else {
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 },
      volume: -12,
    }).connect(channels.drums);
    const clock = monotonic();
    gendang = { hit: (time, vel) => synth.triggerAttackRelease("D2", "16n", clock(time), vel) };
  }

  // --- Seruling (bamboo flute)
  let seruling;
  if (samples.seruling) {
    const { sampler } = samples.seruling;
    seruling = { play: (freq, dur, time, vel) => sampler.triggerAttackRelease(freq, dur, time, vel) };
  } else {
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.2, decay: 0.3, sustain: 0.6, release: 0.5 },
      volume: -20,
    }).connect(vibrato);
    const clock = monotonic();
    seruling = { play: (freq, dur, time, vel) => synth.triggerAttackRelease(freq, dur, clock(time), vel) };
  }

  // --- Gongs. Kenong marks each quarter-year, kempul each year (always
  // synths); the big gong ageng is saved for unusual months.
  const kenongSynth = new Tone.FMSynth({
    harmonicity: 2,
    modulationIndex: 1,
    envelope: { attack: 0.005, decay: 1.2, sustain: 0, release: 0.5 },
    modulationEnvelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 },
    volume: -20,
  }).connect(channels.gongs);
  const kempulSynth = new Tone.FMSynth({
    harmonicity: 1.5,
    modulationIndex: 1.2,
    envelope: { attack: 0.01, decay: 2.2, sustain: 0, release: 1 },
    modulationEnvelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.2 },
    volume: -16,
  }).connect(channels.gongs);
  const kenongClock = monotonic();
  const kempulClock = monotonic();

  let gong;
  if (samples.gong) {
    const { sampler, note } = samples.gong;
    gong = { hit: (time, vel) => sampler.triggerAttackRelease(note, 4, time, vel) };
  } else {
    // Two slightly detuned low sines "beat" against each other (the ombak,
    // or wave, of a real gong), plus a short shimmer on top.
    const low = [65, 66.3].map((freq) => ({
      freq,
      synth: new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 5, sustain: 0, release: 2 },
        volume: -6,
      }).connect(channels.gongs),
    }));
    const shimmer = new Tone.FMSynth({
      harmonicity: 1.48,
      modulationIndex: 2,
      envelope: { attack: 0.01, decay: 2.5, sustain: 0, release: 1 },
      modulationEnvelope: { attack: 0.01, decay: 0.8, sustain: 0, release: 0.3 },
      volume: -16,
    }).connect(channels.gongs);
    const clock = monotonic();
    gong = {
      hit(time, vel) {
        time = clock(time);
        for (const { synth, freq } of low) synth.triggerAttackRelease(freq, 4, time, vel);
        shimmer.triggerAttackRelease(130.8, 2, time, vel * 0.6);
      },
    };
  }

  return {
    leads,
    kompang,
    gendang,
    seruling,
    serulingFilter,
    kenong: { hit: (freq, time) => kenongSynth.triggerAttackRelease(freq, 1, kenongClock(time), 0.6) },
    kempul: { hit: (freq, time) => kempulSynth.triggerAttackRelease(freq, 2, kempulClock(time), 0.7) },
    gong,
    reverb,
    channels,
    sampled: names.filter((n) => samples[n]),
    echoLevel: 1, // 0–1 scale on the humidity echo (0 = echo off)
  };
}
