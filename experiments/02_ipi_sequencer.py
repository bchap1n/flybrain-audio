"""Experiment 2 sketch: count hits as a function of stimulus IPI.

A real IPI-tuned pathway should prefer ~35 ms over 15 ms and 80 ms. This uses
the toy motif, so treat a positive result as 'the caricature works', not as
biology. Replace `toy_auditory_circuit()` with a FlyWire extract next.
"""

from __future__ import annotations

from flybrain_audio.circuits import toy_auditory_circuit
from flybrain_audio.lif import LifParams, LifSimulator
from flybrain_audio.stimuli import audio_to_jo_current, pulse_song


def count_role_spikes(ipi_ms: float, duration_ms: float = 2000.0) -> dict[str, float]:
    graph = toy_auditory_circuit()
    params = LifParams()
    audio = pulse_song(duration_ms, ipi_ms=ipi_ms)
    n_pulses = max(1, int((duration_ms - 100.0) / ipi_ms))
    i_ext = audio_to_jo_current(audio, graph, params)
    _, log = LifSimulator(graph, params).run(i_ext)
    out: dict[str, float] = {"n_pulses": float(n_pulses)}
    for role in ("pulse_out", "sine_out"):
        idxs = set(int(i) for i in graph.indices(role))
        n = int(sum(1 for n_id in log.neuron if int(n_id) in idxs))
        out[role] = n
        out[f"{role}_per_pulse"] = n / n_pulses
    return out


def main() -> None:
    print(f"{'IPI ms':>8}  {'pulses':>8}  {'pulse_out':>10}  {'per pulse':>10}")
    for ipi in (15.0, 35.0, 50.0, 80.0):
        c = count_role_spikes(ipi)
        print(
            f"{ipi:8.1f}  {c['n_pulses']:8.0f}  {c['pulse_out']:10.0f}  {c['pulse_out_per_pulse']:10.2f}"
        )


if __name__ == "__main__":
    main()
