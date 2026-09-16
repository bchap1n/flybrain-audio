"""Experiment 1 sketch: treat the circuit as a temporal filter, not a drummer.

Renders the stimulus, the motif output, and the shuffled output for pulse and
sine so you can listen to whether the delayed-inhibition loop is doing anything
a producer would call a gate.
"""

from __future__ import annotations

from pathlib import Path

from flybrain_audio.pipeline import run_circuit
from flybrain_audio.wavutil import write_wav


def main() -> None:
    out = Path("out/exp01")
    out.mkdir(parents=True, exist_ok=True)
    for stim in ("pulse35", "pulse15", "sine"):
        for shuffle, tag in ((False, "motif"), (True, "shuffled")):
            result = run_circuit(
                stimulus_name=stim,
                duration_ms=3000.0,
                seed=0,
                shuffle=shuffle,
            )
            write_wav(out / f"{stim}_{tag}.wav", result.audio, result.sample_rate)
            write_wav(out / f"{stim}_stimulus.wav", result.stimulus, result.sample_rate)
            print(f"{stim:8} {tag:9} hits={len(result.hits):3} spikes={result.log.time_ms.size}")


if __name__ == "__main__":
    main()
