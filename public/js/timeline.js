// Multitrack timeline: one lane per layer, drawn from the data (not the
// audio), with a playhead that follows the Transport.
//
// Two canvases: the data lanes are drawn once per song (and on resize or a
// theme change); the top canvas redraws only the playhead each frame, so it
// stays smooth while music plays. The top canvas is also a keyboard slider.

const LANES = ["melody", "drums", "flute", "humidity", "gongs"];

// Which flags make a month stand out in each lane.
const LANE_FLAGS = {
  melody: ["hot", "cool"],
  drums: ["wet", "dry"],
  flute: ["hazy"],
  humidity: ["humid"],
};

// 0..1 heights; a floor keeps the smallest month visible.
function minMax(values, floor = 0.12) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((v) => (max === min ? 0.5 : floor + (1 - floor) * (v - min) / (max - min)));
}
function fromZero(values) {
  const max = Math.max(...values) || 1;
  return values.map((v) => Math.max(0.04, v / max));
}

export function createTimeline(wrapper, { onSeek, describe }) {
  const dataCanvas = wrapper.querySelector(".timeline-data");
  const headCanvas = wrapper.querySelector(".timeline-head");
  const transport = Tone.getTransport();

  let beats = [];
  let heights = {};
  let dimmed = new Set();
  let cursor = 0; // month shown by the slider (keyboard position)
  let lastX = null;
  let dragging = false;

  const css = (name) => getComputedStyle(wrapper).getPropertyValue(name).trim();

  function size() {
    const ratio = window.devicePixelRatio || 1;
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    for (const c of [dataCanvas, headCanvas]) {
      c.width = Math.round(w * ratio);
      c.height = Math.round(h * ratio);
      c.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    return { w, h, rulerH: parseFloat(css("--ruler-h")), laneH: parseFloat(css("--lane-h")) };
  }

  function drawData() {
    const { w, h, rulerH, laneH } = size();
    const ctx = dataCanvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const border = css("--border");
    const muted = css("--muted");

    // Lane separators.
    ctx.fillStyle = border;
    for (let i = 0; i <= LANES.length; i++) ctx.fillRect(0, rulerH + i * laneH, w, 1);

    if (!beats.length) {
      ctx.fillStyle = muted;
      ctx.font = "14px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("Play a place to see its 20 years here.", 8, rulerH + laneH / 2);
      lastX = null;
      return;
    }

    const n = beats.length;
    const monthW = w / n;
    const gap = monthW > 3 ? 1 : 0;

    // Year gridlines and labels; skip labels when years get narrow.
    const yearW = monthW * 12;
    const every = [1, 2, 5, 10].find((s) => yearW * s >= 40) || 10;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    beats.forEach((b, i) => {
      if (b.month.month !== 1) return;
      const x = Math.round(i * monthW);
      ctx.fillStyle = border;
      ctx.fillRect(x, rulerH, 1, h - rulerH);
      if (b.month.year % every === 0 || every === 1) {
        ctx.fillStyle = muted;
        ctx.fillText(String(b.month.year), x + 3, rulerH / 2);
      }
    });

    LANES.forEach((lane, li) => {
      const top = rulerH + li * laneH;
      ctx.globalAlpha = dimmed.has(lane) ? 0.25 : 1;
      ctx.fillStyle = css(`--lane-${lane}`);

      if (lane === "gongs") {
        const mid = top + laneH / 2;
        beats.forEach((b, i) => {
          const x = (i + 0.5) * monthW;
          if (b.kempul) ctx.fillRect(Math.round(x), mid - 4, 1, 8); // year-end kempul
          if (!b.gong) return;
          const r = Math.min(laneH / 2 - 6, 5 + b.gong.severity); // bigger = more unusual
          ctx.beginPath();
          ctx.arc(x, mid, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath(); // the gong's raised boss
          ctx.arc(x, mid, r * 0.35, 0, Math.PI * 2);
          ctx.strokeStyle = css("--card");
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      } else {
        const flags = LANE_FLAGS[lane];
        heights[lane].forEach((v, i) => {
          const barH = v * (laneH - 12);
          const standout = beats[i].month.flags.some((f) => flags.includes(f));
          ctx.globalAlpha = (dimmed.has(lane) ? 0.25 : 1) * (standout ? 1 : 0.55);
          ctx.fillRect(i * monthW, top + laneH - 6 - barH, Math.max(1, monthW - gap), barH);
        });
      }
    });
    ctx.globalAlpha = 1;
    lastX = null; // force the playhead to redraw on the fresh canvas
  }

  // Months played so far, at the moment you hear them (transport.ticks runs
  // slightly ahead, because Tone schedules audio in advance).
  function playPosition() {
    return transport.getTicksAtTime(Tone.immediate()) / transport.PPQ;
  }

  function drawHead() {
    requestAnimationFrame(drawHead);
    if (!beats.length) return;
    const w = wrapper.clientWidth;
    const n = beats.length;
    const pos = Math.min(n, Math.max(0, playPosition()));
    const focused = document.activeElement === headCanvas;
    if (!focused && !dragging) setCursor(Math.floor(pos));

    const x = (pos / n) * w;
    const key = `${x.toFixed(1)}|${focused}|${cursor}`;
    if (key === lastX) return; // nothing moved
    lastX = key;

    const h = wrapper.clientHeight;
    const rulerH = parseFloat(css("--ruler-h"));
    const ctx = headCanvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    if (focused) {
      // Keyboard cursor: the month Enter will jump to.
      const cw = Math.max(3, w / n);
      ctx.fillStyle = css("--text");
      ctx.globalAlpha = 0.15;
      ctx.fillRect(cursor * (w / n) - (cw - w / n) / 2, rulerH, cw, h - rulerH);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = css("--accent");
    ctx.fillRect(Math.round(x) - 1, rulerH, 2, h - rulerH);
    ctx.beginPath(); // handle in the ruler
    ctx.moveTo(x - 6, rulerH - 8);
    ctx.lineTo(x + 6, rulerH - 8);
    ctx.lineTo(x, rulerH);
    ctx.fill();
  }

  function setCursor(index) {
    if (!beats.length) return;
    index = Math.max(0, Math.min(beats.length - 1, index));
    if (index === cursor) return;
    cursor = index;
    headCanvas.setAttribute("aria-valuenow", String(index + 1));
    headCanvas.setAttribute("aria-valuetext", describe(beats[index]));
  }

  function indexAt(event) {
    const rect = headCanvas.getBoundingClientRect();
    return Math.floor(((event.clientX - rect.left) / rect.width) * beats.length);
  }

  function seek(index) {
    setCursor(index);
    onSeek(cursor);
  }

  // Click, tap or drag to jump. pan-y in the CSS keeps vertical page scroll.
  headCanvas.addEventListener("pointerdown", (e) => {
    if (!beats.length) return;
    dragging = true;
    headCanvas.setPointerCapture(e.pointerId);
    seek(indexAt(e));
  });
  headCanvas.addEventListener("pointermove", (e) => {
    if (dragging && indexAt(e) !== cursor) seek(indexAt(e));
  });
  const stopDrag = () => { dragging = false; };
  headCanvas.addEventListener("pointerup", stopDrag);
  headCanvas.addEventListener("pointercancel", stopDrag);

  // Keyboard: move the cursor, Enter jumps there.
  headCanvas.addEventListener("keydown", (e) => {
    if (!beats.length) return;
    const moves = {
      ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1,
      PageDown: -12, PageUp: 12, Home: -Infinity, End: Infinity,
    };
    if (e.key in moves) {
      const step = moves[e.key];
      setCursor(Number.isFinite(step) ? cursor + step : step < 0 ? 0 : beats.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      onSeek(cursor);
    } else {
      return;
    }
    e.preventDefault();
  });

  new ResizeObserver(drawData).observe(wrapper);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawData);
  drawData();
  drawHead();

  return {
    load(newBeats) {
      beats = newBeats;
      const months = beats.map((b) => b.month);
      heights = {
        melody: minMax(months.map((m) => m.temp)),
        drums: fromZero(months.map((m) => m.rain)),
        flute: fromZero(months.map((m) => m.aod)),
        humidity: minMax(months.map((m) => m.humidity)),
      };
      headCanvas.setAttribute("aria-valuemax", String(beats.length));
      headCanvas.removeAttribute("aria-disabled");
      cursor = -1;
      setCursor(0);
      drawData();
    },
    setDimmed(lanes) {
      dimmed = new Set(lanes);
      drawData();
    },
  };
}
