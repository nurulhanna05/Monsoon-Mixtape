// Builds the instruments. For now everything is a Tone.js synth; Phase 5
// swaps in Samplers from /samples/<instrument>/ when recordings are present.
//
// Each layer goes through its own Tone.Channel so it can be muted or soloed.

export const LAYERS = ["melody", "drums", "flute", "gongs"];

// Single-voice synths throw if a note starts at or before the previous one,
// which can happen when the browser stalls and Tone catches up. This returns
// a clock that nudges such notes a few milliseconds later instead.
function monotonic() {
  let last = -1;
  return (time) => (last = Math.max(time, last + 0.005));
}

export async function createInstruments() {
  const limiter = new Tone.Limiter(-1).toDestination();
  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.2 }).connect(limiter);
  await reverb.generate();

  const channels = {};
  for (const name of LAYERS) channels[name] = new Tone.Channel().connect(reverb);

  // --- Melody: saron-like metallophone, plus a quieter bonang elaboration.
  // A short burst of FM gives the metallic strike, then it rings as a sine.
  const lead = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2.76,
    modulationIndex: 2.5,
    envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.6 },
    modulationEnvelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.1 },
    volume: -12,
  }).connect(channels.melody);

  const bonang = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 4,
    modulationIndex: 1.5,
    envelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.3 },
    modulationEnvelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.05 },
    volume: -22,
  }).connect(channels.melody);

  // --- Drums: kompang (frame drum slap) and gendang (deep barrel drum).
  const slapFilter = new Tone.Filter(2500, "highpass").connect(channels.drums);
  const kompangSlap = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    volume: -26,
  }).connect(slapFilter);
  const kompangBody = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
    volume: -18,
  }).connect(channels.drums);
  const kompangClock = monotonic();
  const kompang = {
    hit(time, velocity) {
      time = kompangClock(time);
      kompangBody.triggerAttackRelease("A3", "32n", time, velocity);
      kompangSlap.triggerAttackRelease("32n", time, velocity);
    },
  };

  const gendangSynth = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 },
    volume: -12,
  }).connect(channels.drums);
  const gendangClock = monotonic();
  const gendang = {
    hit(time, velocity) {
      time = gendangClock(time);
      gendangSynth.triggerAttackRelease("D2", "16n", time, velocity);
    },
  };

  // --- Seruling (bamboo flute): soft tone with vibrato, through a low-pass
  // filter that closes when the air is hazy.
  const serulingFilter = new Tone.Filter(5000, "lowpass").connect(channels.flute);
  const vibrato = new Tone.Vibrato(5, 0.12).connect(serulingFilter);
  const serulingSynth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.2, decay: 0.3, sustain: 0.6, release: 0.5 },
    volume: -20,
  }).connect(vibrato);

  // --- Gongs. Kenong marks each quarter-year, kempul each year; the big
  // gong ageng is saved for unusual months.
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

  // Gong ageng: two slightly detuned low sines "beat" against each other
  // (the ombak, or wave, of a real gong), plus a short shimmer on top.
  const gongLow = [65, 66.3].map((freq) => {
    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 5, sustain: 0, release: 2 },
      volume: -6,
    }).connect(channels.gongs);
    return { synth, freq };
  });
  const gongShimmer = new Tone.FMSynth({
    harmonicity: 1.48,
    modulationIndex: 2,
    envelope: { attack: 0.01, decay: 2.5, sustain: 0, release: 1 },
    modulationEnvelope: { attack: 0.01, decay: 0.8, sustain: 0, release: 0.3 },
    volume: -16,
  }).connect(channels.gongs);

  const serulingClock = monotonic();
  const kenongClock = monotonic();
  const kempulClock = monotonic();
  const gongClock = monotonic();

  return {
    lead,
    bonang,
    kompang,
    gendang,
    seruling: {
      play: (freq, duration, time, velocity) =>
        serulingSynth.triggerAttackRelease(freq, duration, serulingClock(time), velocity),
    },
    serulingFilter,
    kenong: { hit: (freq, time) => kenongSynth.triggerAttackRelease(freq, 1, kenongClock(time), 0.6) },
    kempul: { hit: (freq, time) => kempulSynth.triggerAttackRelease(freq, 2, kempulClock(time), 0.7) },
    gong: {
      hit(time, velocity) {
        time = gongClock(time);
        for (const { synth, freq } of gongLow) synth.triggerAttackRelease(freq, 4, time, velocity);
        gongShimmer.triggerAttackRelease(130.8, 2, time, velocity * 0.6);
      },
    },
    reverb,
    channels,
    humidityOn: true, // when off, reverb no longer follows humidity
  };
}
