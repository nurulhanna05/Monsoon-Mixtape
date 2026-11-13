// Turns the /song JSON into a Tone.js schedule.
//
// One month = one beat. At 240 BPM, 240 months ≈ 60 seconds. Each year is
// one 12-beat gamelan cycle: a kenong marks every 3 months and a kempul
// closes the year. The big gong is saved for unusual months.

export const BASE_BPM = 240;

// Slendro-like scale: 5 roughly equal steps per octave, so overlapping
// notes blend instead of clashing.
const SLENDRO_BASE = 196; // Hz
const slendro = (step) => SLENDRO_BASE * 2 ** (step / 5);
const MELODY_STEPS = 9; // melody uses steps 0-8 (almost two octaves)

// Kompang hit positions within a beat (in sixteenths) per density level.
const KOMPANG_PATTERNS = [[], [0], [0, 2], [0, 2, 3], [0, 1, 2, 3]];

// Seasons change the texture, not the tempo.
const TEXTURE = {
  northeast_monsoon: { maxKompang: 4, gendangEvery: 1, bonang: true, serulingEvery: 6 },
  inter_monsoon: { maxKompang: 3, gendangEvery: 2, bonang: false, serulingEvery: 4 },
  southwest_monsoon: { maxKompang: 2, gendangEvery: 3, bonang: false, serulingEvery: 2 },
};

// 0..1 scaling across the whole song.
function scaler(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (v) => (max === min ? 0.5 : (v - min) / (max - min));
}

// Percentile rank, so a few extreme rain months don't flatten the rest.
function ranker(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return (v) => sorted.indexOf(v) / Math.max(1, sorted.length - 1);
}

// Precompute what each month sounds like.
export function buildBeats(song) {
  const months = song.months;
  // The melody follows a 3-month average temperature, so it moves with the
  // seasons instead of zig-zagging on every small wobble.
  const smoothTemp = months.map((_, i) => {
    const near = months.slice(Math.max(0, i - 1), i + 2);
    return near.reduce((sum, m) => sum + m.temp, 0) / near.length;
  });
  const tempN = scaler(smoothTemp);
  const rainN = ranker(months.map((m) => m.rain));
  const humN = scaler(months.map((m) => m.humidity));
  const aodN = scaler(months.map((m) => m.aod));
  const gongAt = new Map(song.anomalies.map((a) => [a.start_index, a]));

  let step = null;
  return months.map((m, i) => {
    const texture = TEXTURE[m.season];
    const rain = rainN(m.rain);
    const hazy = m.flags.includes("hazy");

    // Hotter = higher, but move at most one scale step per month so the
    // melody walks instead of jumping.
    const target = Math.round(tempN(smoothTemp[i]) * (MELODY_STEPS - 1));
    const previous = step;
    step = step === null ? target : step + Math.sign(target - step);
    // Ornament: a neighbouring scale note, alternating above and below, so
    // held notes get a little movement instead of an octave leap.
    const neighbour = Math.min(MELODY_STEPS - 1, Math.max(0, step + (i % 2 ? -1 : 1)));

    const density = Math.min(texture.maxKompang, Math.round(rain * 4));
    return {
      index: i,
      month: m,
      step,
      freq: slendro(step),
      repeat: step === previous, // same note as last month: played softer
      ornamentFreq: slendro(neighbour === step ? step - 1 : neighbour),
      bonang: texture.bonang,
      kompangHits: KOMPANG_PATTERNS[density],
      gendang: i % texture.gendangEvery === 0,
      gendangExtra: rain > 0.75,
      drumVelocity: m.season === "northeast_monsoon" ? 0.9 : 0.6,
      reverbWet: 0.08 + humN(m.humidity) * 0.35,
      hazy,
      // Clear air ≈ 6 kHz; hazy months are strongly muffled.
      serulingCutoff: hazy ? 350 : 6000 - aodN(m.aod) * 4500,
      serulingBeats: i % texture.serulingEvery === 0 ? texture.serulingEvery : 0,
      kenong: m.month % 3 === 0 && m.month !== 12,
      kempul: m.month === 12,
      gong: gongAt.get(i) || null,
    };
  });
}

// Schedule every beat on the Transport, played with the given lead
// instrument. Callbacks run in sync with the audio (via Tone.Draw):
//   onBeat(beat)       once per month, for the UI and captions
//   onHit(name, info)  every instrument stroke, for the animations
export function scheduleSong(beats, inst, leadName, { onBeat, onHit, onEnd }) {
  const transport = Tone.getTransport();
  const draw = Tone.getDraw();
  const ticks = (b) => `${Math.round(b * transport.PPQ)}i`;
  const lead = inst.leads[leadName] || inst.leads.gamelan;
  const show = (t, name, info = {}) => draw.schedule(() => onHit(name, info), t);

  transport.cancel();
  transport.position = 0;

  for (const beat of beats) {
    transport.schedule((time) => {
      const beatSec = Tone.Time("4n").toSeconds();
      const at = (fraction) => time + fraction * beatSec;

      const ramp = Math.min(0.2, beatSec * 0.8); // finish before the next beat
      inst.reverb.wet.rampTo(beat.reverbWet * inst.echoLevel, ramp, time);
      inst.serulingFilter.frequency.rampTo(beat.serulingCutoff, ramp, time);

      const noteLength = beat.repeat && !lead.legato ? beatSec * 2.2 : beatSec * (lead.legato ? 1.1 : 1.5);
      lead.play(beat.freq, noteLength, time, beat.repeat ? 0.45 : 0.7);
      show(time, "lead", { step: beat.step, duration: noteLength });
      // Busy (wet) season, or a note held over from last month: add the
      // neighbour-note ornament half a beat later.
      if ((beat.bonang || beat.repeat) && lead.elaborate) {
        lead.play(beat.ornamentFreq, beatSec, at(0.5), 0.25);
        show(at(0.5), "lead", { step: beat.step, duration: beatSec, soft: true });
      }

      const speed = beat.kompangHits.length / 4; // 0-1, rainier = busier
      for (const s of beat.kompangHits) {
        inst.kompang.hit(at(s / 4), beat.drumVelocity);
        show(at(s / 4), "kompang", { speed });
      }
      if (beat.gendang) {
        inst.gendang.hit(time, beat.drumVelocity);
        show(time, "gendang", { speed });
      }
      if (beat.gendangExtra) {
        inst.gendang.hit(at(0.5), beat.drumVelocity * 0.7);
        show(at(0.5), "gendang", { speed });
      }

      if (beat.serulingBeats) {
        // Flute plays the melody note an octave up, held across its phrase.
        const duration = beatSec * beat.serulingBeats * 0.9;
        inst.seruling.play(beat.freq * 2, duration, time, 0.6);
        show(time, "seruling", { duration, hazy: beat.hazy });
      }

      if (beat.kenong) {
        inst.kenong.hit(beat.freq, time);
        show(time, "gong", { big: false });
      }
      if (beat.kempul) {
        inst.kempul.hit(beat.freq / 2, time);
        show(time, "gong", { big: false });
      }
      if (beat.gong) {
        inst.gong.hit(time, Math.min(1, 0.6 + beat.gong.severity / 10));
        show(time, "gong", { big: true });
      }

      draw.schedule(() => onBeat(beat), time);
    }, ticks(beat.index));
  }

  transport.schedule((time) => {
    draw.schedule(() => onEnd(), time);
  }, ticks(beats.length + 4)); // let the last notes ring
}
