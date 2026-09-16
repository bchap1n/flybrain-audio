"""Experiment 1: Johnston filter vs shuffled wiring.

Renders dry stimulus, motif-filtered audio, and shuffled-filtered audio.
"""

from __future__ import annotations

from pathlib import Path

from flybrain_audio.filter import johnston_filter
from flybrain_audio.pipeline import make_stimulus
from flybrain_audio.wavutil import write_wav


def main() -> None:
    out = Path("out/exp01")
    out.mkdir(parents=True, exist_ok=True)
    import numpy as np

    rng = np.random.default_rng(0)
    for stim in ("pulse35", "pulse15", "sine"):
        dry = make_stimulus(stim, 3000.0, 44100, rng)
        write_wav(out / f"{stim}_stimulus.wav", dry, 44100)
        for shuffle, tag in ((False, "motif"), (True, "shuffled")):
            wet, tel = johnston_filter(dry, shuffle=shuffle, seed=0, wet=1.0)
            write_wav(out / f"{stim}_{tag}.wav", wet, 44100)
            print(f"{stim:8} {tag:9} spikes={tel['n_spikes']:4} pulse={tel['pulse_env_mean']:.3f}")


if __name__ == "__main__":
    main()
