/** Shared patchbay. Used by the UI sliders and by the (optional) in-browser LLM. */

export const DEFAULT_PATCH = {
  joB: 28,
  joC: 14,
  wet: 0.8,
  pulseDepth: 0.7,
  sineWarmth: 0.45,
  mode: "cross",
  coupleAB: 0.35,
  coupleBA: 0.35,
  coupleTarget: "aln",
  shuffleA: false,
  shuffleB: false,
  lesionA: "none",
  lesionB: "none",
};

export const TOOLS = [
  {
    name: "set_params",
    description: "Set Johnston-filter / dual-brain parameters. Only include keys you want to change.",
    parameters: {
      type: "object",
      properties: {
        joB: { type: "number", description: "Current gain into pulse-sensitive JO (0-60)" },
        joC: { type: "number", description: "Current gain into sine-sensitive JO (0-40)" },
        wet: { type: "number", description: "Dry/wet 0-1" },
        pulseDepth: { type: "number", description: "How hard pulse-pool rate ducks the dry signal 0-1" },
        sineWarmth: { type: "number", description: "How much sine-pool rate opens the low shelf 0-1" },
        mode: { type: "string", enum: ["stereo", "cross", "antagonist", "series"] },
        coupleAB: { type: "number", description: "A pulse-rate injected into B, 0-1" },
        coupleBA: { type: "number", description: "B pulse-rate injected into A, 0-1" },
        coupleTarget: { type: "string", enum: ["aln", "jo_pulse", "jo_sine", "pc1"] },
        shuffleA: { type: "boolean" },
        shuffleB: { type: "boolean" },
        lesionA: { type: "string", enum: ["none", "aln", "apn1", "pc1"] },
        lesionB: { type: "string", enum: ["none", "aln", "apn1", "pc1"] },
      },
    },
  },
  {
    name: "set_source",
    description: "Ask the UI to switch the audio source. The user still has to grant mic/tab permission.",
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          enum: [
            "tr",
            "tr:707-floor",
            "tr:707-claps",
            "tr:707-break",
            "tr:707-toms",
            "tr:606-four",
            "tr:606-electro",
            "tr:606-busy",
            "pulse",
            "sine",
            "mic",
            "tab",
            "file",
          ],
        },
      },
      required: ["source"],
    },
  },
];

export function applyPatch(patch, update) {
  const next = { ...patch, ...update };
  next.joB = clamp(next.joB, 0, 60);
  next.joC = clamp(next.joC, 0, 40);
  next.wet = clamp(next.wet, 0, 1);
  next.pulseDepth = clamp(next.pulseDepth, 0, 1);
  next.sineWarmth = clamp(next.sineWarmth, 0, 1);
  next.coupleAB = clamp(next.coupleAB, 0, 1);
  next.coupleBA = clamp(next.coupleBA, 0, 1);
  const modes = ["stereo", "cross", "antagonist", "series"];
  if (!modes.includes(next.mode)) next.mode = "cross";
  const targets = ["aln", "jo_pulse", "jo_sine", "pc1"];
  if (!targets.includes(next.coupleTarget)) next.coupleTarget = "aln";
  return next;
}

function clamp(v, lo, hi) {
  v = Number(v);
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

/** Tiny command parser so the demo works before MiniCPM finishes downloading. */
export function parseCommand(text) {
  const t = text.toLowerCase().trim();
  const params = {};
  let source = null;
  if (/shuffle a/.test(t)) params.shuffleA = !/unshuffle/.test(t);
  if (/shuffle b/.test(t)) params.shuffleB = !/unshuffle/.test(t);
  if (/shuffle (both|them|the brains)/.test(t)) {
    params.shuffleA = true;
    params.shuffleB = true;
  }
  if (/unshuffle/.test(t)) {
    params.shuffleA = false;
    params.shuffleB = false;
  }
  if (/lesion a? ?(aln|apn1|pc1)/.test(t)) {
    const m = t.match(/lesion (?:a |b )?(aln|apn1|pc1)/);
    if (m) params.lesionA = m[1];
  }
  if (/heal|no lesion|unlesion/.test(t)) {
    params.lesionA = "none";
    params.lesionB = "none";
  }
  if (/more pulse|more duck/.test(t)) params.pulseDepth = 0.9;
  if (/less pulse|less duck/.test(t)) params.pulseDepth = 0.25;
  if (/more sine|warmer/.test(t)) params.sineWarmth = 0.8;
  if (/drier|more dry/.test(t)) params.wet = 0.25;
  if (/wetter|more wet/.test(t)) params.wet = 0.95;
  if (/\bcross\b/.test(t)) params.mode = "cross";
  if (/\bstereo\b/.test(t)) params.mode = "stereo";
  if (/antagonist|fight|oppose/.test(t)) params.mode = "antagonist";
  if (/series|listen to each other|a then b/.test(t)) params.mode = "series";
  if (/uncouple|decouple|no coupling/.test(t)) {
    params.coupleAB = 0;
    params.coupleBA = 0;
    params.mode = "stereo";
  }
  if (/couple|lock|interact/.test(t) && params.mode === undefined) {
    params.mode = "cross";
    params.coupleAB = 0.5;
    params.coupleBA = 0.5;
  }
  if (/microphone|mic/.test(t)) source = "mic";
  if (/tab|youtube|capture/.test(t)) source = "tab";
  if (/pulse song|pulse generator/.test(t)) source = "pulse";
  if (/sine song|sine generator/.test(t)) source = "sine";
  if (/\b707\b|house|four on the floor|play loop/.test(t)) source = "tr:707-floor";
  if (/clap/.test(t)) source = "tr:707-claps";
  if (/break/.test(t)) source = "tr:707-break";
  if (/\btom/.test(t)) source = "tr:707-toms";
  if (/\b606\b/.test(t) && !/electro|busy|hat/.test(t)) source = "tr:606-four";
  if (/electro/.test(t)) source = "tr:606-electro";
  if (/busy hat|busy 606/.test(t)) source = "tr:606-busy";
  const wet = t.match(/wet\s+(\d+(?:\.\d+)?)/);
  if (wet) params.wet = Number(wet[1]) > 1 ? Number(wet[1]) / 100 : Number(wet[1]);
  return { params, source, empty: Object.keys(params).length === 0 && !source };
}
