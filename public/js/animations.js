// SVG instrument animations, driven by the same Tone.js events as the sound.
// Instruments only show while they're playing; motion can be switched off.

const INSTRUMENTS = {
  gamelan: { label: "Gamelan", shows: "temperature", lead: true },
  sape: { label: "Sape", shows: "temperature", lead: true },
  rebab: { label: "Rebab", shows: "temperature", lead: true },
  kompang: { label: "Kompang", shows: "rain" },
  gendang: { label: "Gendang", shows: "rain" },
  seruling: { label: "Seruling", shows: "haze" },
  gong: { label: "Gong", shows: "unusual months" },
};

// How long an instrument stays visible after its last stroke (ms).
const LINGER = { lead: 900, kompang: 600, gendang: 700, gong: 900, bigGong: 2200 };

export async function createStage(container) {
  const figures = {};
  for (const [name, info] of Object.entries(INSTRUMENTS)) {
    const svg = await fetch(`svg/${name}.svg`).then((r) => r.text());
    const fig = document.createElement("figure");
    fig.className = `inst inst-${name}`;
    fig.innerHTML = `<div class="art">${svg}</div>
      <figcaption>${info.label}<small>${info.shows}</small></figcaption>`;
    container.append(fig);
    figures[name] = fig;
  }

  let enabled = true;
  let leadName = "gamelan";
  let bowDirection = 1;
  const timers = {};

  function activate(name, ms) {
    const fig = figures[name];
    fig.classList.add("active");
    clearTimeout(timers[name]);
    timers[name] = setTimeout(() => fig.classList.remove("active"), ms);
  }

  function animate(el, keyframes, options) {
    if (enabled && el) el.animate(keyframes, options);
  }

  function hitLead({ step, duration, soft }) {
    const fig = figures[leadName];
    activate(leadName, Math.max(LINGER.lead, duration * 1000 + 200));
    if (leadName === "gamelan") {
      // Light up the bar for this note (bars go low to high, left to right).
      const bars = fig.querySelectorAll(".bar");
      const bar = bars[Math.round((step / 8) * (bars.length - 1))];
      animate(bar, [
        { fill: soft ? "#f2d36b" : "#ffe9a3", transform: "translateY(-3px)" },
        { fill: "#c9a227", transform: "translateY(0)" },
      ], { duration: soft ? 250 : 450, easing: "ease-out" });
    } else if (leadName === "sape") {
      for (const string of fig.querySelectorAll(".string")) {
        animate(string, [
          { transform: "translateY(0)" }, { transform: "translateY(1.5px)" },
          { transform: "translateY(-1.5px)" }, { transform: "translateY(0)" },
        ], { duration: soft ? 180 : 320 });
      }
    } else if (leadName === "rebab") {
      bowDirection *= -1;
      animate(fig.querySelector(".bow"), [
        { transform: `translateX(${-12 * bowDirection}px)` },
        { transform: `translateX(${12 * bowDirection}px)` },
      ], { duration: duration * 1000, easing: "ease-in-out", fill: "forwards" });
    }
  }

  function hitDrum(name, { speed }) {
    activate(name, LINGER[name]);
    // Rainier = busier drumming = quicker, snappier bounces.
    animate(figures[name].querySelector(".drum"), [
      { transform: "translateY(0) scale(1)" },
      { transform: "translateY(-5px) scale(1.05)" },
      { transform: "translateY(0) scale(1)" },
    ], { duration: 260 - speed * 120, easing: "ease-out" });
  }

  function hitSeruling({ duration, hazy }) {
    const fig = figures.seruling;
    fig.classList.toggle("hazy", hazy);
    fig.classList.add("glow");
    clearTimeout(timers.serulingGlow);
    timers.serulingGlow = setTimeout(() => fig.classList.remove("glow"), duration * 1000);
    activate("seruling", duration * 1000 + 300);
  }

  function hitGong({ big }) {
    const fig = figures.gong;
    activate("gong", big ? LINGER.bigGong : LINGER.gong);
    const disc = fig.querySelector(".disc");
    if (!big) {
      animate(disc, [{ transform: "rotate(0)" }, { transform: "rotate(2deg)" }, { transform: "rotate(0)" }],
        { duration: 400 });
      return;
    }
    animate(disc, [
      { transform: "rotate(0)" }, { transform: "rotate(-5deg)" }, { transform: "rotate(4deg)" },
      { transform: "rotate(-2deg)" }, { transform: "rotate(0)" },
    ], { duration: 1000, easing: "ease-out" });
    fig.querySelectorAll(".ripple").forEach((ripple, i) => {
      animate(ripple, [
        { transform: "scale(1)", opacity: 0.9 },
        { transform: "scale(1.7)", opacity: 0 },
      ], { duration: 1400, delay: i * 300, easing: "ease-out" });
    });
  }

  return {
    // Show the right lead for the region and clear the stage.
    reset(lead) {
      leadName = INSTRUMENTS[lead]?.lead ? lead : "gamelan";
      for (const [name, fig] of Object.entries(figures)) {
        clearTimeout(timers[name]);
        fig.classList.remove("active", "glow", "hazy");
        fig.hidden = Boolean(INSTRUMENTS[name].lead) && name !== leadName;
      }
    },
    hit(name, info) {
      if (name === "lead") hitLead(info);
      else if (name === "kompang" || name === "gendang") hitDrum(name, info);
      else if (name === "seruling") hitSeruling(info);
      else if (name === "gong") hitGong(info);
    },
    setEnabled(on) {
      enabled = on;
      container.classList.toggle("no-motion", !on);
    },
  };
}
