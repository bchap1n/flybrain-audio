# Path to a VST / CLAP plugin

Goal: a plugin a producer can drop on a track. Audio in (the mix, a mic, a sidechain), MIDI and/or audio out, a shuffle switch, no Python in the session.

## Why a plugin is the actual contribution

FLYTAPE is a website that generates from spikes. Fly Lab is a custom Ableton bridge with authored musical gestures. Neither is an instrument in the sense of Serum, Drum Rack, or a sidechain gate.

A connectome plugin is novel because:

- The **graph is a frozen biological prior**, not a trained WaveNet.
- You can **lesion cell types from a combo box** (aLN(al), aPN1, pC1) the way a neuroscientist would.
- The **shuffle parameter** is a scientific control sitting next to `wet/dry`.
- Latency and determinism are forced on you by the audio thread, which is a better engineering constraint than a Jupyter notebook.

It is also easy to ship a random LIF and call it a fly. The plugin has to load a **named subgraph with provenance** (dataset, version, body IDs, licence).

## Architecture

```text
DAW audio thread (48 kHz)
  block 64–256 samples
    downsample / feature  →  JO currents at 2 kHz neural rate
    LIF subgraph (CSR, delay line)
    spike hits            →  MIDI events (sample-accurate)
                          →  internal sampler mix
    upsample envelopes    →  wet audio
```

Neural rate 1–2 kHz is enough for 35 ms IPI. Do not run one LIF step per sample unless the subgraph is tiny.

Keep the graph read-only in the audio thread. Load weights on the main thread. No allocations in `process()`.

## Implementation options

| Stack | Pros | Cons |
| --- | --- | --- |
| **nih-plug (Rust) + clap-wrapper** | CLAP + VST3, modern, SIMD-friendly, MIT | Rust audio + Python data prep split |
| **JUCE (C++)** | Industry default, huge host coverage | GPL-ish licensing if you don't pay; heavier |
| **iPlug2** | Lightweight C++, VST3/CLAP/AUv2 | Smaller community |
| **Max for Live** | Fastest path if you live in Ableton | Not a general plugin; Fly Lab already sits here |
| **Pedalboard / DawDreamer** | Stay in Python | Not a distributable plugin; fine for prototypes |

Recommended: stay in this Python repo until a **real subgraph** beats the shuffle in a listening test, then port the LIF kernel and CSR graph to **nih-plug**. Do not start in JUCE with the toy 12-neuron motif; you will spend a month on CMake.

## Parameters (v1)

| Param | What it does |
| --- | --- |
| `jo_b_gain` | Current into pulse-sensitive JO |
| `jo_c_gain` | Current into sine-sensitive JO |
| `ipi_bias` | Scales the delayed-inhibitory weight (toy) or aLN(al) gain (real) |
| `shuffle` | Rewire targets with a fixed seed; automatable A/B |
| `wet` | Mix of internal sampler vs dry |
| `midi_out` | Enable note-on from kick/hat/pad/snare roles |
| `lesion` | Enum: none / aLN_al / aPN1 / pC1 |

## Determinism

Same session, same seed, same audio → same MIDI. That means:

- integer time in samples, convert to ms with a fixed `dt`
- no `rand` in the audio thread unless seeded per block from host time
- dump a sidecar JSON of graph hash + param snapshot with every recorded take

## What not to do

- Do not train in the plugin. Training belongs offline; the plugin loads a graph.
- Do not claim the fly is "jamming." The copy should say: measured wiring, modeled dynamics, your encoder.
- Do not ship MaleCNS/FlyWire weights without the CC BY 4.0 notice in the about box.
