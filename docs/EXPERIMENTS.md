# Experiments

These are ordered by how soon they can make a sound you can argue about, not by how impressive they look on a README.

Every experiment should answer three questions:

1. **What is measured?** (which neurons, which dataset, which synapses)
2. **What is modeled?** (LIF, encoder, decoder, learning rule)
3. **What is the control?** (degree-preserving shuffle is the default; silencing a cell type is better)

If (3) is missing, it is a sketch, not an experiment.

---

## 0. Baseline: toy motif vs shuffle (this repo)

**Status:** implemented.

Drive the 12-neuron IPI motif with `pulse35`, `pulse15`, `sine`, and `clicks`. Render the sampler. Render the shuffled graph with the same encoder and decoder.

Listen for:

- Pulse-35 producing a steadier kick/hat grid than pulse-15 (the delayed GABA loop should choke a 15 ms roll).
- Sine song pulling more `pad` and less `kick`.
- Shuffle destroying that split.

If shuffle and motif sound the same, the encoder/decoder is doing all the musical work and the graph is decoration. That is a useful negative result. Write it down.

---

## 1. Johnston filter (audio FX, not a drum machine)

**Status:** toy version implemented — Python `flybrain-audio filter` and the browser demo (`flybrain-audio serve`). Dual-brain coupling lives in `web/`. MiniCPM5 is an optional in-tab patchbay, not part of the audio callback.

**Why it is novel.** Almost every viral fly demo *reads* motor neurons. Almost none *listen* with the hearing pathway. Baker et al. 2022 mapped JO → AMMC → WED/VLP as a heterarchy: pulse-preferring and sine-preferring cells talk to each other. That is a filter topology, not a classifier.

**Setup.**

- Extract JO, AMMC, WED, AVLP auditory types from FlyWire v783 (Baker table S3 has root IDs) or the MaleCNS equivalents.
- Encoder: particle-velocity stand-in. Start with a 1-D velocity microphone signal (or mid-side of a stereo track, high-passed). Inject current into JO-B vs JO-C by band.
- Decoder: population rate of aPN1 / vPN1 / sine-preferring WED cells → three control-rate envelopes (10–50 Hz), not audio-rate spikes.
- Plugin shape: audio in, three CV/sidechain outs (gate, pulse-amount, sine-amount). Later, convolve the envelopes with the dry signal.

**Control.** Shuffle; also silence aLN(al) (required for song response in Vaughan et al. 2014) and listen to the envelopes collapse or not.

**Success.** A dense mix is ducked on pulse-like transients and warmed on sustained 100–250 Hz energy, and the shuffle does not do that as cleanly. Failure is also publishable.

---

## 2. IPI sequencer (groove from a species interval)

**Why it is novel.** *D. melanogaster* pulse song has a stereotyped ~35 ms IPI. That is not a tempo; at 120 BPM a sixteenth note is 125 ms. 35 ms is a *roll*, a flam, a ratchets-per-beat problem. Using a circuit evolved for that interval as a **microtiming** engine is closer to biology than mapping pC1 to MIDI note 36.

**Setup.**

- Same auditory extract as (1).
- Detect burst onsets in aPN1/vPN1.
- Do **not** quantize them onto a DAW grid as the output. Use the DAW clock as a *stimulus* (a metronome click train into JO) and let the circuit's burst times become swing / delay taps / ratchets.
- Map: host tempo → click train at 2 or 4 clicks per beat → circuit → fractional delays of 35 ms, 70 ms, 105 ms on a drum bus.

**Control.** Feed a 15 ms click train (wrong species). The live fly prefers its own IPI; the model should too, or you have not captured the computation.

**VST parameters.** `ipi_ms`, `clicks_per_beat`, `wet`, `shuffle` (for live A/B).

---

## 3. Pulse / sine sampler (nested motor circuits as banks)

**Why it is novel.** Song *production* is a different graph from song *perception*. Shiozaki et al. 2024: two nested VNC feedforward paths, the larger one pulse, a subset sine, extensive recurrence, shared muscles. That is almost a sampler architecture — two kits, one bus, activating the subset should change the kit rather than add an independent track.

MaleCNS and MANC include the VNC, so this experiment wants the male CNS, not FlyWire-only.

**Setup.**

- Extract pIP10, pMP2, dPR1, TN1A and the eight essential song cell types from MANC / MaleCNS (body IDs in the Shiozaki supplement).
- Do not drive them with audio. Drive the descending command neurons with a 16-step pattern you type, like a 303 sequencer.
- Read motor-neuron pools as sample triggers. Pulse-associated MNs → kit A (clicks, kicks). Sine-associated MNs → kit B (tones, pads).
- Ablate the sine subset and confirm kit B goes quiet while kit A does not (nested, not parallel).

**Control.** Degree-preserving shuffle of the VNC subgraph; also a random partition of motor neurons into two kits.

**Why a sampler not a synth.** You want to hear *when* the circuit fires, not invent a timbre and credit the fly. Keep the voices boring (this repo's kick/hat/pad is the right attitude).

---

## 4. Connectome VST / CLAP

See [VST.md](VST.md). The experiment is: can a measured subgraph run in the audio thread at 48 kHz with < 5 ms latency, with the shuffle toggle as an automatable parameter?

This is the thing that does not exist yet. FLYTAPE is a website. Fly Lab is a MIDI bridge into Ableton with authored gestures. A plugin you drop on a track, that listens, that you can automate, that a stranger can open without installing a Python stack — that is the product-shaped hole.

Minimum viable plugin:

- Audio in (mono velocity / sidechain)
- MIDI out (note 36/38/42/64) and audio out (internal sampler)
- Parameters: `gain_jo_b`, `gain_jo_c`, `ipi_bias`, `shuffle`, `wet`
- Graph frozen at plugin load; no learning in v1

---

## 5. Mushroom body as a granulator / wavetable

**Why it is novel.** Kenyon cells (~2,000–4,000) are a sparse, high-dimensional expansion of olfactory (and some other) input, read out by MBONs and taught by dopamine (PAM/PPL1). That is a classic reservoir / kernel expansion. Mapping KC spikes onto grain IDs or wavetable positions gives you a sparse sample index that was not trained on music.

**Setup.**

- Encoder: MFCC or a 24-band cochlear filterbank → olfactory projection neurons (a lie; say so) **or**, more honestly, use the actual auditory path into any KCs that the connectome says they reach.
- Decoder: each MBON is a mix bus; KC→MBON weights (measured) become mix levels.
- Learning (optional, later): reward-modulated STDP on KC→MBON only, human "more like this" as dopamine, same as Fly Lab's 70-weight readout but on the real expansion.

**Control.** Random projection of the same dimension vs the real KC graph. The interesting claim is *structure*, not "a neural net made sound."

---

## 6. Whole-brain reservoir sequencer (the FLYTAPE cousin)

Run a larger extract (or FastFly / philshiu-style whole brain) as a reservoir. Audio features into sensory neurons; a linear readout from descending neurons trained with a tiny ridge regression to a drum pattern. Then freeze the readout and listen to generalization (new song in, groove out).

This is the least "fly-specific" experiment and the easiest to overclaim. Do it only with the shuffle and with a linear readout of matched size on Gaussian noise. If the noise readout wins, stop.

Related: [alextitonis/fly.ai](https://github.com/alextitonis/fly.ai) already frames MaleCNS as a frozen reservoir.

---

## 7. Closed-loop DAW: the fly as a performer in Ableton / Reaper

Once (4) exists, put the plugin on a return, feed it the mix, record its MIDI on a drum rack. Add a "lesion" knob that zeros aLN(al) or pC1 mid-take. That is the live-show version of a connectome perturbation experiment.

Fly Lab already occupies "Ableton + motor circuit." Do not clone it. The difference is **audio in through JO**, not fruit-location → descending neurons → authored interval.

---

## Suggested order of attack

```text
0  toy motif (done)
1  extract Baker auditory IDs from FlyWire   →  Johnston filter offline
2  IPI sequencer offline
3  wrap 1+2 as CLAP with shuffle toggle
5  MB granulator if 3 is boring
4  MaleCNS song-production sampler if 3 is exciting
```

Experiment 3 (VST) is numbered by concept; in calendar time it comes after a real subgraph sounds better than the toy.
