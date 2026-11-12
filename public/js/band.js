// The band: one flat SVG player per instrument (all Rimau, the tiger astronaut), animated by the same Tone.js
// events as the sound (via Tone.Draw), so what you see matches what you hear.
//
// Movement follows the data: drummers strike bigger and faster in rainier
// months, the gamelan player gets livelier as it gets hotter, the flute player
// sways and greys out in haze, and an unusual month makes the gong player
// take a big swing. Players that are muted or resting sit still
// and dim. With animations off, nothing moves, but dimming and haze still show.

// Every player is Rimau, the tiger astronaut: a white space suit with a
// coloured chest panel and cuffs (so players are easy to tell apart), and a
// tiger face inside a glass helmet.
const SUIT = "#eef2f6";
const SUIT_EDGE = "#9aa7b4";
const FUR = "#e8892b";
const STRIPE = "#3a1d0a";

function tigerHead(cx, cy) {
  return `
    <circle cx="${cx - 9}" cy="${cy - 8}" r="4.2" fill="${FUR}"/>
    <circle cx="${cx + 9}" cy="${cy - 8}" r="4.2" fill="${FUR}"/>
    <circle cx="${cx - 9}" cy="${cy - 8}" r="2" fill="${STRIPE}"/>
    <circle cx="${cx + 9}" cy="${cy - 8}" r="2" fill="${STRIPE}"/>
    <circle cx="${cx}" cy="${cy}" r="11" fill="${FUR}"/>
    <ellipse cx="${cx}" cy="${cy + 5}" rx="6.5" ry="4.5" fill="#fff7ec"/>
    <path d="M${cx - 3} ${cy - 11} l1 4 M${cx} ${cy - 11} l0 5 M${cx + 3} ${cy - 11} l-1 4
             M${cx - 11} ${cy - 1} l4 1 M${cx - 11} ${cy + 3} l4 0
             M${cx + 11} ${cy - 1} l-4 1 M${cx + 11} ${cy + 3} l-4 0"
      stroke="${STRIPE}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="${cx - 4}" cy="${cy - 2}" r="1.5" fill="#1b1b1b"/>
    <circle cx="${cx + 4}" cy="${cy - 2}" r="1.5" fill="#1b1b1b"/>
    <path d="M${cx - 2} ${cy + 2.5} L${cx + 2} ${cy + 2.5} L${cx} ${cy + 4.5} Z" fill="#5a2d0c"/>`;
}

// A seated player: suit and helmeted head (arms are drawn per instrument).
function person({ cx = 60, accent }) {
  return `
    <path d="M${cx - 20} 108 Q${cx - 22} 64 ${cx} 62 Q${cx + 22} 64 ${cx + 20} 108 Z"
      fill="${SUIT}" stroke="${SUIT_EDGE}" stroke-width="1.2"/>
    <rect x="${cx - 7}" y="76" width="14" height="10" rx="2" fill="${accent}"/>
    <circle cx="${cx - 3}" cy="81" r="1.5" fill="#ffd54a"/>
    <circle cx="${cx + 3}" cy="81" r="1.5" fill="#7fe3a0"/>
    <rect x="${cx - 12}" y="59" width="24" height="6" rx="3" fill="#b8c2cc"/>
    ${tigerHead(cx, 46)}
    <circle cx="${cx}" cy="45" r="17" fill="#bfe3ff" fill-opacity="0.22" stroke="#d8e6f3" stroke-width="2"/>
    <path d="M${cx - 11} 37 a13 13 0 0 1 7 -5" fill="none" stroke="#ffffff" stroke-width="2"
      stroke-linecap="round" opacity="0.7"/>`;
}

// A suited arm from the shoulder to a gloved hand, as a group that rotates
// at the shoulder.
function arm(cls, [sx, sy], [hx, hy], accent, extra = "") {
  return `<g class="${cls}" style="transform-origin:${sx}px ${sy}px">
    <path d="M${sx} ${sy} L${hx} ${hy}" stroke="${SUIT_EDGE}" stroke-width="9" stroke-linecap="round"/>
    <path d="M${sx} ${sy} L${hx} ${hy}" stroke="${SUIT}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="${hx}" cy="${hy}" r="4.2" fill="#dfe5ec" stroke="${accent}" stroke-width="1.8"/>${extra}</g>`;
}

const PLAYERS = {
  gamelan: {
    label: "Gamelan", shows: "temperature", layer: "melody", lead: true,
    svg: () => {
      const bars = Array.from({ length: 7 }, (_, i) =>
        `<rect class="bar" x="${21 + i * 11.5}" y="${80 + i * 0.8}" width="9.5" height="${13 - i * 0.8}" rx="2"/>`).join("");
      return `${person({ accent: "#9c2f2f" })}
        <path d="M14 92 L106 92 L98 110 L22 110 Z" fill="#8b4f2a"/>
        <g fill="#c9a227" stroke="#8a6d12" stroke-width="1">${bars}</g>
        ${arm("arm-rest", [48, 68], [36, 84], "#9c2f2f")}
        ${arm("arm-strike", [72, 68], [84, 82], "#9c2f2f",
          `<path d="M84 82 L95 76" stroke="#5a3a1a" stroke-width="3" stroke-linecap="round"/>
           <circle cx="96" cy="75" r="3.5" fill="#5a3a1a"/>`)}`;
    },
  },
  sape: {
    label: "Sape", shows: "temperature", layer: "melody", lead: true,
    svg: () => `${person({ accent: "#2b5f8a" })}
      <g class="lute">
        <path d="M24 104 L36 84 L100 40 L104 44 L46 96 Z" fill="#b5702f" stroke="#6b3d15" stroke-width="1.5"/>
        <path d="M30 92 q4 -6 10 -2" fill="none" stroke="#f3e2c0" stroke-width="2"/>
        <g class="strings" stroke="#f6f0e0" stroke-width="0.8">
          <path class="string" d="M34 94 L100 43"/><path class="string" d="M37 96 L102 45"/>
        </g>
      </g>
      ${arm("arm-neck", [72, 68], [88, 54], "#2b5f8a")}
      ${arm("arm-pluck", [48, 68], [42, 90], "#2b5f8a")}`,
  },
  rebab: {
    label: "Rebab", shows: "temperature", layer: "melody", lead: true,
    svg: () => `${person({ cx: 66, accent: "#3d6b4f" })}
      <g class="fiddle">
        <path d="M38 112 L38 100" stroke="#5a3a1a" stroke-width="3"/>
        <path d="M30 82 Q38 74 46 82 L44 98 Q38 104 32 98 Z" fill="#8b4f2a" stroke="#5a3a1a" stroke-width="1.5"/>
        <path d="M38 80 L38 30" stroke="#5a3a1a" stroke-width="4" stroke-linecap="round"/>
        <path d="M38 34 L38 96" stroke="#f6f0e0" stroke-width="0.8"/>
      </g>
      ${arm("arm-neck", [56, 68], [40, 56], "#3d6b4f")}
      <g class="bow-arm">
        ${arm("arm-bow", [78, 68], [80, 88], "#3d6b4f",
          `<path d="M80 88 L24 88" stroke="#6b3d15" stroke-width="2" stroke-linecap="round"/>`)}
      </g>`,
  },
  kompang: {
    label: "Kompang", shows: "rain", layer: "drums",
    svg: () => `${person({ cx: 66, accent: "#c08a2b" })}
      ${arm("arm-hold", [56, 68], [40, 86], "#c08a2b")}
      <g class="drum" style="transform-origin:36px 82px">
        <circle cx="36" cy="82" r="18" fill="#7a4a24"/>
        <circle cx="36" cy="82" r="14.5" fill="#efdcb5"/>
      </g>
      ${arm("arm-strike", [78, 68], [52, 80], "#c08a2b")}`,
  },
  gendang: {
    label: "Gendang", shows: "rain", layer: "drums",
    svg: () => `${person({ accent: "#6b3f7d" })}
      <g class="drum" style="transform-origin:60px 92px">
        <rect x="22" y="82" width="76" height="20" rx="9" fill="#8b4f2a"/>
        <ellipse cx="22" cy="92" rx="5" ry="10" fill="#efdcb5"/>
        <ellipse cx="98" cy="92" rx="4" ry="8" fill="#efdcb5"/>
        <path d="M30 83 L40 101 L50 83 L60 101 L70 83 L80 101 L90 83" fill="none" stroke="#e8c37a" stroke-width="1.2"/>
      </g>
      ${arm("arm-left", [48, 68], [24, 86], "#6b3f7d")}
      ${arm("arm-right", [72, 68], [96, 86], "#6b3f7d")}`,
  },
  seruling: {
    label: "Seruling", shows: "haze", layer: "flute",
    svg: () => `<g class="sway" style="transform-origin:60px 108px">
        ${person({ accent: "#2b7a78" })}
        <path d="M70 60 L110 50" stroke="#d6b36a" stroke-width="4.5" stroke-linecap="round"/>
        <g fill="#6b4a1a"><circle cx="88" cy="55.5" r="1"/><circle cx="92" cy="54.5" r="1"/><circle cx="102" cy="52" r="1"/></g>
        ${arm("arm-a", [48, 68], [80, 57.5], "#2b7a78")}
        ${arm("arm-b", [72, 68], [97, 53.3], "#2b7a78")}
      </g>
      <g class="haze" fill="#9a9a9a">
        <circle cx="30" cy="40" r="16"/><circle cx="52" cy="30" r="14"/><circle cx="90" cy="28" r="15"/>
        <circle cx="104" cy="56" r="12"/><circle cx="20" cy="72" r="12"/>
      </g>`,
  },
  gong: {
    label: "Gong", shows: "unusual months", layer: "gongs",
    svg: () => `
      <path d="M8 112 L8 30 M66 112 L66 30 M4 30 L70 30" stroke="#5a3a1a" stroke-width="4" stroke-linecap="round"/>
      <path d="M37 30 L37 44" stroke="#5a3a1a" stroke-width="1.5"/>
      <g class="ripples" fill="none" stroke="#e0b240" stroke-width="2">
        <circle class="ripple" cx="37" cy="70" r="24" opacity="0"/>
        <circle class="ripple" cx="37" cy="70" r="24" opacity="0"/>
      </g>
      <g class="disc" style="transform-origin:37px 44px">
        <circle cx="37" cy="70" r="24" fill="#c9a227" stroke="#8a6d12" stroke-width="2"/>
        <circle cx="37" cy="70" r="8" fill="#e0b240" stroke="#8a6d12" stroke-width="1.5"/>
      </g>
      ${person({ cx: 92, accent: "#7a1f2b" })}
      ${arm("arm-strike", [80, 68], [64, 74], "#7a1f2b",
        `<path d="M64 74 L56 72" stroke="#5a3a1a" stroke-width="3" stroke-linecap="round"/>
         <circle cx="54" cy="72" r="5" fill="#e8d9b8" stroke="#5a3a1a" stroke-width="1"/>`)}`,
  },
};

// How long a player stays "playing" (bright) after their last stroke (ms).
const LINGER = { lead: 900, kompang: 600, gendang: 700, gong: 900, bigGong: 2200 };

export function createBand(container) {
  const figures = {};
  for (const [name, p] of Object.entries(PLAYERS)) {
    const fig = document.createElement("figure");
    fig.className = `player player-${name}`;
    fig.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true">${p.svg()}</svg>
      <figcaption>${p.label}<small>${p.shows}</small></figcaption>`;
    container.append(fig);
    figures[name] = fig;
  }

  let enabled = true;
  let leadName = "gamelan";
  let bowDirection = 1;
  let bowStroke = null; // the bow holds its end position until the next stroke
  let gendangSide = 0;
  const timers = {};
  const part = (name, selector) => figures[name].querySelector(selector);

  function activate(name, ms) {
    const fig = figures[name];
    fig.classList.add("active");
    clearTimeout(timers[name]);
    timers[name] = setTimeout(() => fig.classList.remove("active"), ms);
  }

  function animate(el, keyframes, options) {
    return enabled && el ? el.animate(keyframes, options) : null;
  }

  // Lift the arm, then bring it down onto the instrument.
  function strike(el, lift, duration) {
    animate(el, [
      { transform: "rotate(0deg)" },
      { transform: `rotate(${lift}deg)`, offset: 0.35 },
      { transform: "rotate(0deg)" },
    ], { duration, easing: "ease-in" });
  }

  function hitLead({ step, duration, soft }) {
    activate(leadName, Math.max(LINGER.lead, duration * 1000 + 200));
    const energy = step / 8; // hotter months play higher notes = livelier
    if (leadName === "gamelan") {
      strike(part("gamelan", ".arm-strike"), -(12 + energy * 22) * (soft ? 0.5 : 1), soft ? 200 : 320);
      // Light up the bar for this note (bars go low to high, left to right).
      const bars = figures.gamelan.querySelectorAll(".bar");
      const bar = bars[Math.round(energy * (bars.length - 1))];
      animate(bar, [{ fill: "#fff1b8" }, { fill: "#c9a227" }], { duration: soft ? 250 : 500, easing: "ease-out" });
    } else if (leadName === "sape") {
      strike(part("sape", ".arm-pluck"), 10 + energy * 12, soft ? 160 : 260);
      for (const string of figures.sape.querySelectorAll(".string")) {
        animate(string, [
          { transform: "translateY(0)" }, { transform: "translateY(1.2px)" },
          { transform: "translateY(-1.2px)" }, { transform: "translateY(0)" },
        ], { duration: soft ? 180 : 320 });
      }
    } else if (leadName === "rebab") {
      bowDirection *= -1;
      const reach = 8 + energy * 8;
      bowStroke?.cancel();
      bowStroke = animate(part("rebab", ".bow-arm"), [
        { transform: `translateX(${-reach * bowDirection}px)` },
        { transform: `translateX(${reach * bowDirection}px)` },
      ], { duration: duration * 1000, easing: "ease-in-out", fill: "forwards" });
    }
  }

  function hitDrum(name, { speed }) {
    activate(name, LINGER[name]);
    // Rainier = busier drumming = bigger, quicker strikes.
    const lift = 18 + speed * 26;
    const duration = 280 - speed * 130;
    if (name === "kompang") {
      strike(part("kompang", ".arm-strike"), lift, duration);
    } else {
      gendangSide = 1 - gendangSide; // alternate hands
      strike(part("gendang", gendangSide ? ".arm-left" : ".arm-right"), gendangSide ? lift : -lift, duration);
    }
    animate(part(name, ".drum"), [
      { transform: "scale(1)" }, { transform: `scale(${1.03 + speed * 0.04})`, offset: 0.4 }, { transform: "scale(1)" },
    ], { duration, easing: "ease-out" });
  }

  function hitSeruling({ duration, hazy }) {
    figures.seruling.classList.toggle("hazy", hazy);
    activate("seruling", duration * 1000 + 300);
    animate(part("seruling", ".sway"), [
      { transform: "rotate(0deg)" }, { transform: "rotate(-3deg)" },
      { transform: "rotate(3deg)" }, { transform: "rotate(0deg)" },
    ], { duration: duration * 1000, easing: "ease-in-out" });
  }

  function hitGong({ big }) {
    activate("gong", big ? LINGER.bigGong : LINGER.gong);
    const disc = part("gong", ".disc");
    if (!big) {
      strike(part("gong", ".arm-strike"), 12, 300);
      animate(disc, [{ transform: "rotate(0)" }, { transform: "rotate(2deg)" }, { transform: "rotate(0)" }],
        { duration: 400 });
      return;
    }
    // Unusual month: a big swing, and the gong rocks and rings.
    strike(part("gong", ".arm-strike"), 40, 520);
    animate(disc, [
      { transform: "rotate(0)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(5deg)" },
      { transform: "rotate(-2deg)" }, { transform: "rotate(0)" },
    ], { duration: 1200, delay: 180, easing: "ease-out" });
    figures.gong.querySelectorAll(".ripple").forEach((ripple, i) => {
      animate(ripple, [
        { transform: "scale(1)", opacity: 0.9 },
        { transform: "scale(1.7)", opacity: 0 },
      ], { duration: 1400, delay: 180 + i * 300, easing: "ease-out" });
    });
  }

  return {
    // Seat the right lead for the region and settle everyone.
    reset(lead) {
      leadName = PLAYERS[lead]?.lead ? lead : "gamelan";
      for (const [name, fig] of Object.entries(figures)) {
        clearTimeout(timers[name]);
        fig.classList.remove("active", "hazy");
        fig.hidden = Boolean(PLAYERS[name].lead) && name !== leadName;
      }
    },
    hit(name, info) {
      if (name === "lead") hitLead(info);
      else if (name === "kompang" || name === "gendang") hitDrum(name, info);
      else if (name === "seruling") hitSeruling(info);
      else if (name === "gong") hitGong(info);
    },
    // Players on muted (or not-soloed) layers sit dimmed.
    setDimmed(layers) {
      for (const [name, fig] of Object.entries(figures)) {
        fig.classList.toggle("muted", layers.includes(PLAYERS[name].layer));
      }
    },
    setEnabled(on) {
      enabled = on;
      container.classList.toggle("no-motion", !on);
    },
  };
}
