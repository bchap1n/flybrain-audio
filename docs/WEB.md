# Browser Johnston filter

The demo in `web/` is experiment 1 running in the tab: two toy auditory circuits, live audio, coupling, shuffle/lesion, optional MiniCPM5 as a talking patchbay.

```text
mic / tab / file / oscillator
        │
        ▼
 AudioWorklet  ── fly A LIF ── pulse/sine envelopes ── duck + low shelf
        │              │
        │         coupling current (cross / antagonist / series)
        │              ▼
        └──────── fly B LIF ── envelopes ── same FX on the other channel
```

## What needs WebGPU, and what does not

| Piece | Where it runs | Why |
| --- | --- | --- |
| 12 + 12 LIF neurons @ 2 kHz | AudioWorklet (CPU) | A few hundred FLOPs per block. WebGPU would add latency. |
| Envelope FX | Same worklet | One-pole filters. |
| MiniCPM5-1B / 2B | Main thread, wllama WASM, WebGPU if present | ~0.7–1.6 GB GGUF. Opt-in. Sets JSON params only. |
| Future FlyWire extract (hundreds–thousands of cells) | Then consider WebGPU compute | Same worklet API, different kernel. |

The Hugging Face MiniCPM5-2B WebGPU demos (e.g. [townbox/MiniCPM5-2B-WebGPU-Pi](https://huggingface.co/spaces/townbox/MiniCPM5-2B-WebGPU-Pi)) are the same idea we want for the *patchbay*: a small Llama-architecture model in the tab. MiniCPM5 is a standard `LlamaForCausalLM`, so wllama can load the official GGUF. It is not required for the filter to make sound.

## Drum loops (default source)

The demo ships seven 16-step grids under `web/tr.js`: four TR-707-style (house floor, offbeat claps, broken kick, tom run) and three TR-606-style (four, electro, busy hats). Voices are synthesized in the tab. They are not Roland ROM samples and not dumped factory presets.

Each pattern is rendered to a looping `AudioBuffer` at its own BPM. Pick one from the menu or say “play 707” / “electro”.

Mic, file, and **Capture tab** remain for live audio. A page still cannot fetch `youtube.com` itself.

## Two brains

Not two whole MaleCNS graphs. Two copies of the hearing motif, which is what "two flies listening" actually means at this scale.

| Mode | Interaction |
| --- | --- |
| stereo | L → A, R → B, no coupling |
| cross | Each fly's pulse rate is injected into the other's `coupleTarget` (default aLN) |
| antagonist | Pulse of one suppresses sine of the other (heterarchy caricature) |
| series | B's encoder sees A's wet output — a fly listening to another fly's song |

## Controls the model is allowed to touch

See `web/patches.js`. Lesion `aLN(al)` is the Vaughan 2014 control. Shuffle is the wiring control. If MiniCPM is not loaded, `parseCommand` still understands those phrases.
