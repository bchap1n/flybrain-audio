/**
 * Optional in-browser MiniCPM patchbay.
 *
 * MiniCPM5-2B Q4 is ~1.56 GB. The filter does not need it — this is a
 * talking control surface. wllama (llama.cpp WASM, WebGPU when available)
 * loads GGUF from Hugging Face. If the download fails, parseCommand still works.
 */
import { TOOLS } from "./patches.js";

const MODELS = {
  "minicpm5-1b": {
    label: "MiniCPM5-1B Q4 (~657 MB)",
    url: "https://huggingface.co/openbmb/MiniCPM5-1B-GGUF/resolve/main/MiniCPM5-1B-Q4_K_M.gguf",
  },
  "minicpm5-2b": {
    label: "MiniCPM5-2B Q4 (~1.56 GB)",
    url: "https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/resolve/main/MiniCPM5-2B-Q4_K_M.gguf",
  },
};

const SYSTEM = `You are the patchbay for a dual fruit-fly Johnston filter.
Two 12-neuron toy auditory circuits (JO → aLN(al)/aPN1 → vPN1 → pC1) process live audio.
You do not write music. You set filter parameters via tools.
Modes: stereo (independent L/R), cross (each fly's pulse rate injects into the other), antagonist (pulse of one suppresses sine of the other), series (B hears A's wet output).
Lesioning aLN(al) is the scientific control from Vaughan 2014. Shuffle rewires synapse targets.
Keep replies to one or two sentences after the tool call. Prefer set_params.`;

export function modelCatalog() {
  return MODELS;
}

export async function loadMiniCPM({ modelId = "minicpm5-2b", onProgress } = {}) {
  const spec = MODELS[modelId];
  if (!spec) throw new Error(`unknown model ${modelId}`);
  const { Wllama } = await import("https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.5/+esm");
  const version = "2.3.5";
  const wasm = {
    "single-thread/wllama.wasm": `https://cdn.jsdelivr.net/npm/@wllama/wllama@${version}/esm/single-thread/wllama.wasm`,
    "multi-thread/wllama.wasm": `https://cdn.jsdelivr.net/npm/@wllama/wllama@${version}/esm/multi-thread/wllama.wasm`,
  };
  const wllama = new Wllama(wasm);
  await wllama.loadModelFromUrl(spec.url, {
    n_ctx: 2048,
    n_threads: 4,
    progressCallback: (p) => {
      if (onProgress && p && p.loaded && p.total) onProgress(p.loaded / p.total);
    },
  });
  return {
    id: modelId,
    label: spec.label,
    async chat(userText, patchSnapshot) {
      const toolHint =
        "If you change the filter, reply with a JSON object only, of the form " +
        '{"tool":"set_params","arguments":{...}} or {"tool":"set_source","arguments":{"source":"tab"}}. ' +
        "Otherwise reply with a short sentence.";
      const prompt = [
        {
          role: "system",
          content: SYSTEM + "\nCurrent patch: " + JSON.stringify(patchSnapshot) + "\n" + toolHint,
        },
        { role: "user", content: userText },
      ];
      const result = await wllama.createChatCompletion(prompt, {
        nPredict: 256,
        sampling: { temp: 0.7, top_p: 0.95 },
      });
      const text = typeof result === "string" ? result : result?.content || result?.text || JSON.stringify(result);
      return parseToolish(text);
    },
  };
}

export function parseToolish(text) {
  const raw = String(text || "").trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(body.slice(start, end + 1));
      if (obj.tool && obj.arguments) return { kind: "tool", name: obj.tool, args: obj.arguments, text: raw };
      if (obj.name && obj.arguments) return { kind: "tool", name: obj.name, args: obj.arguments, text: raw };
      const keys = Object.keys(obj);
      const known = TOOLS[0].parameters.properties;
      if (keys.some((k) => k in known)) return { kind: "tool", name: "set_params", args: obj, text: raw };
    } catch {
      /* fall through */
    }
  }
  return { kind: "text", text: raw };
}
