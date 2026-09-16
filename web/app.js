import { DEFAULT_PATCH, applyPatch, parseCommand } from "./patches.js";
import { loadMiniCPM, modelCatalog } from "./llm.js";

const $ = (id) => document.getElementById(id);

const state = {
  ctx: null,
  worklet: null,
  sourceNode: null,
  sourceKind: "pulse",
  media: null,
  osc: null,
  patch: { ...DEFAULT_PATCH },
  llm: null,
  telemetry: { a: { pulse: 0, sine: 0 }, b: { pulse: 0, sine: 0 } },
};

function log(role, text) {
  const box = $("log");
  const row = document.createElement("div");
  row.className = `msg ${role}`;
  row.textContent = text;
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function setStatus(text) {
  $("status").textContent = text;
}

async function ensureAudio() {
  if (state.ctx) return;
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule("./worklet.js");
  const node = new AudioWorkletNode(ctx, "johnston-filter", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    channelCount: 2,
  });
  node.port.onmessage = (ev) => {
    if (ev.data?.type === "telemetry") {
      state.telemetry = ev.data;
      paintMeters();
    }
  };
  node.connect(ctx.destination);
  state.ctx = ctx;
  state.worklet = node;
  pushPatch();
}

function pushPatch() {
  if (!state.worklet) return;
  state.worklet.port.postMessage({ type: "params", params: state.patch });
  syncSliders();
}

function syncSliders() {
  const p = state.patch;
  $("wet").value = p.wet;
  $("pulseDepth").value = p.pulseDepth;
  $("sineWarmth").value = p.sineWarmth;
  $("coupleAB").value = p.coupleAB;
  $("coupleBA").value = p.coupleBA;
  $("mode").value = p.mode;
  $("lesionA").value = p.lesionA;
  $("shuffleA").checked = p.shuffleA;
  $("shuffleB").checked = p.shuffleB;
  $("wetVal").textContent = p.wet.toFixed(2);
  $("pulseVal").textContent = p.pulseDepth.toFixed(2);
  $("sineVal").textContent = p.sineWarmth.toFixed(2);
  $("cabVal").textContent = p.coupleAB.toFixed(2);
  $("cbaVal").textContent = p.coupleBA.toFixed(2);
}

function stopSource() {
  try {
    state.sourceNode?.disconnect();
  } catch {
    /* already disconnected */
  }
  state.sourceNode = null;
  state.osc?.stop?.();
  state.osc = null;
  state.media?.getTracks?.().forEach((t) => t.stop());
  state.media = null;
}

function connectSource(node) {
  stopSource();
  state.sourceNode = node;
  node.connect(state.worklet);
}

function pulseGenerator(ctx, ipiMs = 35) {
  const frames = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(2, frames, ctx.sampleRate);
  const period = Math.floor((ipiMs / 1000) * ctx.sampleRate);
  const width = Math.floor(0.008 * ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let t = 0; t < frames; t += period) {
      for (let i = 0; i < width && t + i < frames; i++) {
        const env = Math.sin((Math.PI * i) / width);
        data[t + i] = env * Math.sin((2 * Math.PI * 280 * (t + i)) / ctx.sampleRate);
      }
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start();
  return src;
}

function sineGenerator(ctx) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 160;
  gain.gain.value = 0.25;
  osc.connect(gain);
  osc.start();
  state.osc = osc;
  return gain;
}

async function setSource(kind) {
  await ensureAudio();
  if (state.ctx.state === "suspended") await state.ctx.resume();
  state.sourceKind = kind;
  if (kind === "pulse") {
    connectSource(pulseGenerator(state.ctx, 35));
    setStatus("source: synthetic pulse song, 35 ms IPI");
  } else if (kind === "sine") {
    connectSource(sineGenerator(state.ctx));
    setStatus("source: 160 Hz sine-song stand-in");
  } else if (kind === "mic") {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.media = stream;
    connectSource(state.ctx.createMediaStreamSource(stream));
    setStatus("source: microphone");
  } else if (kind === "tab") {
    // Legitimate way to filter a YouTube tab: the user shares that tab's audio.
    // A pasted youtube.com URL cannot be fetched here (CORS + ToS).
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    state.media = stream;
    const v = $("preview");
    v.srcObject = stream;
    v.muted = true;
    v.classList.add("on");
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      setStatus("tab captured but no audio track — share the tab with audio enabled");
    } else {
      connectSource(state.ctx.createMediaStreamSource(stream));
      setStatus("source: tab audio (YouTube/Spotify/etc. if you shared that tab)");
    }
  } else if (kind === "file") {
    $("file").click();
  }
}

function paintMeters() {
  const { a, b } = state.telemetry;
  $("meterAPulse").style.transform = `scaleX(${Math.min(1, a.pulse * 10)})`;
  $("meterASine").style.transform = `scaleX(${Math.min(1, a.sine * 10)})`;
  $("meterBPulse").style.transform = `scaleX(${Math.min(1, b.pulse * 10)})`;
  $("meterBSine").style.transform = `scaleX(${Math.min(1, b.sine * 10)})`;
  const canvas = $("brain");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#0c0d10";
  ctx.fillRect(0, 0, w, h);
  const names = 12;
  for (let i = 0; i < names; i++) {
    const x = 24 + (i % 6) * 36;
    const yA = 28 + Math.floor(i / 6) * 36;
    const yB = 118 + Math.floor(i / 6) * 36;
    ctx.fillStyle = `hsl(18, 80%, ${20 + Math.min(50, a.pulse * 400)}%)`;
    if (i >= 3 && i <= 4) ctx.fillStyle = `hsl(195, 70%, ${20 + Math.min(50, a.sine * 400)}%)`;
    ctx.beginPath();
    ctx.arc(x, yA, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `hsl(18, 80%, ${20 + Math.min(50, b.pulse * 400)}%)`;
    if (i >= 3 && i <= 4) ctx.fillStyle = `hsl(195, 70%, ${20 + Math.min(50, b.sine * 400)}%)`;
    ctx.beginPath();
    ctx.arc(x, yB, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#8a8680";
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillText("fly A  listener", 8, 14);
  ctx.fillText("fly B  listener", 8, 104);
  if (state.patch.mode !== "stereo") {
    ctx.strokeStyle = "rgba(232, 92, 48, 0.5)";
    ctx.beginPath();
    ctx.moveTo(w / 2, 64);
    ctx.lineTo(w / 2, 118);
    ctx.stroke();
  }
}

function bindUi() {
  for (const id of ["wet", "pulseDepth", "sineWarmth", "coupleAB", "coupleBA"]) {
    $(id).addEventListener("input", () => {
      state.patch = applyPatch(state.patch, { [id]: Number($(id).value) });
      pushPatch();
    });
  }
  $("mode").addEventListener("change", () => {
    state.patch = applyPatch(state.patch, { mode: $("mode").value });
    pushPatch();
  });
  $("lesionA").addEventListener("change", () => {
    state.patch = applyPatch(state.patch, { lesionA: $("lesionA").value });
    pushPatch();
  });
  $("shuffleA").addEventListener("change", () => {
    state.patch = applyPatch(state.patch, { shuffleA: $("shuffleA").checked });
    pushPatch();
  });
  $("shuffleB").addEventListener("change", () => {
    state.patch = applyPatch(state.patch, { shuffleB: $("shuffleB").checked });
    pushPatch();
  });
  $("src-pulse").onclick = () => setSource("pulse");
  $("src-sine").onclick = () => setSource("sine");
  $("src-mic").onclick = () => setSource("mic");
  $("src-tab").onclick = () => setSource("tab");
  $("src-file").onclick = () => setSource("file");
  $("file").addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    await ensureAudio();
    const buf = await file.arrayBuffer();
    const audio = await state.ctx.decodeAudioData(buf);
    const src = state.ctx.createBufferSource();
    src.buffer = audio;
    src.loop = true;
    src.start();
    connectSource(src);
    setStatus(`source: ${file.name}`);
  });
  $("chat-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = $("chat-input").value.trim();
    if (!text) return;
    $("chat-input").value = "";
    handleChat(text);
  });
  $("load-1b").onclick = () => bootLlm("minicpm5-1b");
  $("load-2b").onclick = () => bootLlm("minicpm5-2b");
}

async function handleChat(text) {
  log("user", text);
  const parsed = parseCommand(text);
  if (!parsed.empty) {
    if (Object.keys(parsed.params).length) {
      state.patch = applyPatch(state.patch, parsed.params);
      pushPatch();
      log("sys", "patch: " + JSON.stringify(parsed.params));
    }
    if (parsed.source) {
      try {
        await setSource(parsed.source);
      } catch (err) {
        log("sys", String(err.message || err));
      }
    }
    return;
  }
  if (!state.llm) {
    if (parsed.empty) log("sys", "no MiniCPM loaded. try: 'cross couple', 'shuffle A', 'capture tab', 'wet 0.4'");
    return;
  }
  try {
    setStatus("MiniCPM thinking…");
    const result = await state.llm.chat(text, state.patch);
    if (result.kind === "tool") {
      if (result.name === "set_params") {
        state.patch = applyPatch(state.patch, result.args);
        pushPatch();
      } else if (result.name === "set_source" && result.args?.source) {
        await setSource(result.args.source);
      }
      log("assistant", result.text);
    } else {
      log("assistant", result.text);
    }
    setStatus(state.llm.label + " ready");
  } catch (err) {
    log("sys", "MiniCPM error: " + (err.message || err));
  }
}

async function bootLlm(modelId) {
  const spec = modelCatalog()[modelId];
  log("sys", `loading ${spec.label} into this tab via wllama (WebGPU/WASM). first load is a large download.`);
  try {
    state.llm = await loadMiniCPM({
      modelId,
      onProgress: (f) => setStatus(`loading MiniCPM ${(f * 100).toFixed(0)}%`),
    });
    setStatus(state.llm.label + " ready — talk to the patchbay");
    log("assistant", "MiniCPM is in the tab. Ask me to couple the flies, lesion aLN, or capture a tab.");
  } catch (err) {
    log("sys", "could not load MiniCPM: " + (err.message || err) + " — command parser still works.");
    setStatus("MiniCPM unavailable; local commands still work");
  }
}

bindUi();
syncSliders();
paintMeters();
setStatus("idle — pick a source. the filter runs in this tab; nothing is uploaded.");
