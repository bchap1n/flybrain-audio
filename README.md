# flybrain-audio

A lab for turning the fruit-fly connectome into **audio tools**: a sequencer, a sampler, and eventually a VST/CLAP plugin.

The first commit is a working **toy auditory circuit** — a 12-neuron motif inspired by how *Drosophila* hears courtship song — running as a drum/pad sampler. Swap the motif for a measured FlyWire or MaleCNS subgraph when you extract one. The simulator does not care which graph you give it.

```text
audio in  →  Johnston-style encoder  →  spiking circuit  →  spike hits  →  sampler / MIDI
                 (onsets, 100–250 Hz)     (LIF, Shiu 2024)     (roles)        (WAV)
```

## Why this is interesting

Most of the September 2026 fly-brain wave mapped **vision → buttons**. That is fun, and it is not what a fly's brain is for, musically.

A fruit fly *already processes sound*. Males vibrate a wing to sing two modes of courtship song — **pulse song** (clicks with a species-typical ~35 ms inter-pulse interval) and **sine song** (a ~160 Hz tone). Females (and rival males) hear that song through **Johnston's organ** in the antenna, a particle-velocity sensor that projects to the AMMC, then the wedge (WED), then higher courtship neurons such as pC1. Baker, Murthy and colleagues mapped this pathway in the FlyWire connectome and showed it is densely interconnected rather than a clean hierarchy (Baker et al., 2022). On the motor side, nested ventral-nerve-cord circuits generate the two song modes from a shared muscle set (Shiozaki et al., 2024; Lillvis / Murthy song-production work).

That is a rare situation in music technology:

1. **The wiring is measured, not invented.** Electron microscopy of one animal, proofread, with predicted transmitters. You can lesion a cell type and hear what happens.
2. **The computation is temporal.** IPI, pulse vs sine, nested motor rhythms — these are groove, timbre, and arrangement problems, not image-classification problems.
3. **The graph is small enough to run in an audio callback.** A few hundred to a few thousand auditory/song neurons, not 86 billion. A VST is actually plausible.
4. **There is a scientific control.** Shuffle the edges, keep the degrees, listen again. If the groove survives, it was the encoder/decoder, not the brain.

What is *not* claimed: this toy circuit is not a fly, LIF is not biology, and a shuffled-vs-real difference on 12 neurons is a demo, not a paper.

## What already exists (and the gap)

September 2026, after MaleCNS v1.0 (Berg et al., *Cell*): people put the connectome in Doom, Minecraft, Super Mario 64, Beat Saber, CARLA, chess, Tetris, a desktop pet, a fashion generator, a painting loop, even a paper-trading bot. Patrick Mineault's write-up, [Deconstructing viral fly sims](https://www.neuroai.science/p/are-flies-playing-beat-saber), is the best reality check — most demos are a frozen graph plus a hand-written readout.

Two projects already touch music:

| Project | What it does | What it is not |
| --- | --- | --- |
| [FLYTAPE](https://github.com/0xtrou/glm-5.3-flash-fruitfly) | Whole FlyWire brain as two techno DJs. Spikes *are* the notes. Reward-modulated STDP. | Not a DAW plugin. Does not *listen* to your audio. Not the auditory pathway. |
| [Fly Lab](https://github.com/Apolotary/fly-lab) | MaleCNS motor subset → Ableton via a 70-weight trainable readout of authored gestures. | Wiring stays frozen. Does not model hearing. Gestures are written by a human. |

The open slice this repo is aimed at:

- **Hear with the hearing circuit**, not drive MIDI from random motor neurons.
- **An instrument**, not a web toy: sequencer, sampler, then VST/CLAP with audio in and MIDI/audio out.
- **Always ship the shuffle control** so a pretty rhythm can be distinguished from a wiring effect.

A curated map of the rest of the scene: [cobanov/awesome-fly](https://github.com/cobanov/awesome-fly).

## Run the demo

Python 3.10+.

```bash
python -m pip install -e ".[dev]"
python -m flybrain_audio demo --stimulus pulse35 --out out
```

That writes:

- `out/pulse35_motif.wav` — sampler driven by the designed IPI motif
- `out/pulse35_shuffled.wav` — same encoder/decoder, rewired targets
- `out/pulse35_*_stimulus.wav` — the synthetic pulse song that went in
- matching `.json` spike/hit counts

Other stimuli: `pulse15` (too-fast IPI), `sine` (sine-song stand-in), `clicks`.

```bash
python -m pytest
```

## What is real vs invented in v0.1

| Piece | Status |
| --- | --- |
| LIF constants | From Shiu et al. 2024 |
| 12-neuron graph | **Toy motif** named after JO-B, aLN(al), aPN1, vPN1, pC1, B1 |
| Delayed inhibition ~20 ms | Caricature of IPI tuning, not a measured delay |
| Audio → current | Onset detector + 100–250 Hz band energy. Not Johnston's organ |
| Kick/hat/pad/snare | Synthesized in-repo. Spikes trigger them |
| FlyWire / MaleCNS weights | Not loaded yet. See [data/README.md](data/README.md) |

## Experiments

The long list — sequencer, sampler, VST, mushroom-body granulator, song-production motor as clock — lives in [docs/EXPERIMENTS.md](docs/EXPERIMENTS.md). The VST/CLAP path is in [docs/VST.md](docs/VST.md).

Short version of the first three:

1. **Johnston filter** — your track is current into JO-like cells; the circuit is a nonlinear temporal filter; the spike-rate envelope becomes a gate or sidechain. Compare real vs shuffled wiring.
2. **IPI sequencer** — the pathway is evolved around ~35 ms. Treat detected IPI as microtiming / swing, not as a tempo knob. Pulse-song IPI is a roll, not a kick drum.
3. **Pulse/sine sampler** — nested song-production circuits (pulse network ⊃ sine subset) as two sample banks sharing a bus. Activating the sine subset should thin the pulse bank, if the anatomy is doing any work.

## Data

Do not commit the connectome. Download scripts and citation notes: [data/README.md](data/README.md).

- Female whole brain: [FlyWire](https://flywire.ai/) / [Codex](https://codex.flywire.ai/) (Dorkenwald et al., *Nature* 2024)
- Male brain + nerve cord: [MaleCNS](https://male-cns.janelia.org/) (Berg et al., *Cell* 2026)

## Licence

Code is MIT. Connectome datasets remain CC BY 4.0 with their own citations. If you ship audio made from measured weights, credit FlyWire / FlyEM Janelia / Cambridge / MRC LMB / Google Research as required by those datasets.
