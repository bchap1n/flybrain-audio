"""Read spikes out as sequencer hits, sample triggers, and MIDI-like events."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .graph import CircuitGraph
from .lif import SpikeLog


@dataclass(frozen=True)
class Hit:
    time_s: float
    voice: str
    neuron: str


def spikes_to_hits(
    log: SpikeLog,
    graph: CircuitGraph,
    *,
    min_interval_s: float = 0.08,
) -> list[Hit]:
    """Map role spikes onto drum/pad voices with a per-voice refractory.

    kick  ← pulse_pool (the nested pulse-song motor stand-in)
    hat   ← B1 (descending song-related)
    pad   ← sine_pool
    snare ← pC1 (courtship integrator; rarer accent)
    """
    role_voice = {
        "kick": "kick",
        "hat": "hat",
        "pad": "pad",
        "accent": "snare",
    }
    hits: list[Hit] = []
    last: dict[str, float] = {}
    for t_ms, idx in zip(log.time_ms, log.neuron):
        name = graph.names[int(idx)]
        for role, voice in role_voice.items():
            if name not in graph.roles.get(role, ()):
                continue
            t_s = float(t_ms) / 1000.0
            prev = last.get(voice, -1e9)
            if t_s - prev < min_interval_s:
                continue
            last[voice] = t_s
            hits.append(Hit(t_s, voice, name))
    hits.sort(key=lambda h: h.time_s)
    return hits


def hits_to_midi_events(hits: list[Hit]) -> list[tuple[float, int, int]]:
    """Return (time_s, midi_note, velocity) for a later MIDI writer.

    kick=36, snare=38, hat=42, pad=64. Velocity is fixed: the interesting
    timing is in when the circuit fires, not a hand-authored velocity curve.
    """
    notes = {"kick": 36, "snare": 38, "hat": 42, "pad": 64}
    return [(h.time_s, notes[h.voice], 100) for h in hits]


def burstiness(log: SpikeLog, graph: CircuitGraph, role: str, bin_ms: float = 10.0) -> float:
    """Coefficient of variation of binned spike counts for a role."""
    idxs = set(int(i) for i in graph.indices(role))
    if not idxs or log.time_ms.size == 0:
        return 0.0
    times = log.time_ms[np.isin(log.neuron, list(idxs))]
    if times.size < 4:
        return 0.0
    duration = float(times.max() - times.min()) + bin_ms
    n_bins = max(1, int(np.ceil(duration / bin_ms)))
    counts, _ = np.histogram(times, bins=n_bins)
    mean = counts.mean()
    if mean <= 0:
        return 0.0
    return float(counts.std() / mean)
