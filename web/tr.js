/**
 * Bundled TR-606 / TR-707 style loops.
 *
 * Voices are synthesized here. They are not Roland ROM samples.
 * Patterns are 16-step genre grids (house, electro), not dumped factory presets.
 */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function alloc(sr, seconds) {
  return new Float32Array(Math.max(1, Math.floor(sr * seconds)));
}

function noiseBurst(sr, seconds, seed, hp) {
  const out = alloc(sr, seconds);
  const rand = rng(seed);
  let lp = 0;
  const a = Math.exp((-2 * Math.PI * hp) / sr);
  for (let i = 0; i < out.length; i++) {
    const n = rand() * 2 - 1;
    lp = a * lp + (1 - a) * n;
    const hpN = n - lp;
    const t = i / sr;
    out[i] = hpN * Math.exp(-t / (seconds * 0.35));
  }
  return out;
}

function kick({ sr, startF, endF, drop, decay, click, seed }) {
  const out = alloc(sr, decay * 3.2);
  let phase = 0;
  const rand = rng(seed);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const f = endF + (startF - endF) * Math.exp(-t * drop);
    phase += (2 * Math.PI * f) / sr;
    const env = Math.exp(-t / decay);
    const clk = Math.exp(-t * 90) * (rand() * 2 - 1) * click;
    out[i] = Math.sin(phase) * env + clk;
  }
  return out;
}

function snare({ sr, tone, decay, noise, seed }) {
  const out = alloc(sr, decay * 3);
  const rand = rng(seed);
  let lp = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const n = rand() * 2 - 1;
    lp = 0.6 * lp + 0.4 * n;
    const env = Math.exp(-t / decay);
    out[i] = 0.45 * Math.sin(2 * Math.PI * tone * t) * env + noise * (n - 0.5 * lp) * env;
  }
  return out;
}

function hat({ sr, decay, seed, bright }) {
  return noiseBurst(sr, decay * 4, seed, bright);
}

function clap(sr, seed) {
  const out = alloc(sr, 0.28);
  const bursts = [0, 0.012, 0.026, 0.045];
  const raw = noiseBurst(sr, 0.08, seed, 1200);
  for (const b of bursts) {
    const at = Math.floor(b * sr);
    const g = b === 0 ? 1 : 0.55;
    for (let i = 0; i < raw.length && at + i < out.length; i++) out[at + i] += g * raw[i];
  }
  return out;
}

function rim(sr, seed) {
  const out = alloc(sr, 0.06);
  const rand = rng(seed);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    out[i] =
      Math.exp(-t * 70) * Math.sin(2 * Math.PI * 1800 * t) * 0.5 +
      Math.exp(-t * 90) * (rand() * 2 - 1) * 0.35;
  }
  return out;
}

function tom(sr, freq, seed) {
  return kick({ sr, startF: freq * 1.6, endF: freq, drop: 12, decay: 0.18, click: 0.08, seed });
}

const voiceCache = new Map();

function kit(sr, machine) {
  const key = machine + ":" + sr;
  if (voiceCache.has(key)) return voiceCache.get(key);
  const voices =
    machine === "TR-606"
      ? {
          bd: kick({ sr, startF: 110, endF: 42, drop: 14, decay: 0.22, click: 0.12, seed: 6061 }),
          sd: snare({ sr, tone: 210, decay: 0.12, noise: 0.7, seed: 6062 }),
          ch: hat({ sr, decay: 0.04, seed: 6063, bright: 4000 }),
          oh: hat({ sr, decay: 0.18, seed: 6064, bright: 2500 }),
          lt: tom(sr, 90, 6065),
          ht: tom(sr, 150, 6066),
        }
      : {
          bd: kick({ sr, startF: 80, endF: 48, drop: 22, decay: 0.16, click: 0.28, seed: 7071 }),
          sd: snare({ sr, tone: 190, decay: 0.09, noise: 0.85, seed: 7072 }),
          cp: clap(sr, 7073),
          ch: hat({ sr, decay: 0.035, seed: 7074, bright: 6000 }),
          oh: hat({ sr, decay: 0.14, seed: 7075, bright: 3500 }),
          rs: rim(sr, 7076),
          lt: tom(sr, 100, 7077),
        };
  voiceCache.set(key, voices);
  return voices;
}

function parseStep(ch) {
  if (ch === "X") return 1;
  if (ch === "x") return 0.72;
  if (ch === "o") return 0.4;
  return 0;
}

function mixAt(L, R, voice, at, gain) {
  for (let i = 0; i < voice.length && at + i < L.length; i++) {
    const s = voice[i] * gain;
    L[at + i] += s;
    R[at + i] += s;
  }
}

export const PATTERNS = [
  {
    id: "707-floor",
    machine: "TR-707",
    title: "Four on the floor",
    bpm: 124,
    steps: 16,
    tracks: {
      bd: "x---x---x---x---",
      cp: "----x-------x---",
      ch: "--x---x---x---x-",
      oh: "--------x-------",
    },
  },
  {
    id: "707-claps",
    machine: "TR-707",
    title: "Offbeat claps",
    bpm: 122,
    steps: 16,
    tracks: {
      bd: "x---x---x---x---",
      cp: "----x--o----x---",
      ch: "x-x-x-x-x-x-x-x-",
      rs: "------------x---",
    },
  },
  {
    id: "707-break",
    machine: "TR-707",
    title: "Broken kick",
    bpm: 118,
    steps: 16,
    tracks: {
      bd: "x------x--x-----",
      sd: "----x-------x---",
      cp: "----x--------x--",
      ch: "x-x-x-x-x-x-x-x-",
      oh: "------x-------x-",
    },
  },
  {
    id: "707-toms",
    machine: "TR-707",
    title: "Tom run",
    bpm: 120,
    steps: 16,
    tracks: {
      bd: "x-------x-------",
      sd: "----x-------x---",
      lt: "--------x-x-----",
      ch: "--x---x---x---x-",
      oh: "--------------x-",
    },
  },
  {
    id: "606-four",
    machine: "TR-606",
    title: "606 four",
    bpm: 128,
    steps: 16,
    tracks: {
      bd: "x---x---x---x---",
      sd: "----x-------x---",
      ch: "x-x-x-x-x-x-x-x-",
      oh: "------x-------x-",
    },
  },
  {
    id: "606-electro",
    machine: "TR-606",
    title: "Electro",
    bpm: 126,
    steps: 16,
    tracks: {
      bd: "x-----x---x-----",
      sd: "----x-------x---",
      ch: "x-x-x-x-x-x-x-x-",
      oh: "--x-------x-----",
      ht: "----------x-----",
    },
  },
  {
    id: "606-busy",
    machine: "TR-606",
    title: "Busy hats",
    bpm: 132,
    steps: 16,
    tracks: {
      bd: "x------xx-------",
      sd: "----x-------x---",
      ch: "xxxxxxxxxxxxxxxx",
      oh: "----x-------x---",
      lt: "--------x-------",
    },
  },
];

export function patternById(id) {
  return PATTERNS.find((p) => p.id === id) || PATTERNS[0];
}

export function renderPattern(ctx, pattern, bars = 2) {
  const sr = ctx.sampleRate;
  const voices = kit(sr, pattern.machine);
  const stepSec = 60 / pattern.bpm / 4;
  const nSteps = pattern.steps * bars;
  const frames = Math.ceil(nSteps * stepSec * sr);
  const buffer = ctx.createBuffer(2, frames, sr);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  for (let bar = 0; bar < bars; bar++) {
    for (const [name, spec] of Object.entries(pattern.tracks)) {
      const voice = voices[name];
      if (!voice) continue;
      for (let s = 0; s < pattern.steps; s++) {
        const g = parseStep(spec[s] || "-");
        if (!g) continue;
        const at = Math.floor((bar * pattern.steps + s) * stepSec * sr);
        mixAt(L, R, voice, at, g);
      }
    }
  }
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(L[i]));
  if (peak > 0.9) {
    const nrm = 0.9 / peak;
    for (let i = 0; i < frames; i++) {
      L[i] *= nrm;
      R[i] *= nrm;
    }
  }
  return buffer;
}

export function playPattern(ctx, pattern) {
  const buffer = renderPattern(ctx, pattern, 2);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start();
  return src;
}
