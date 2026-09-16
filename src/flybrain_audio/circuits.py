"""Toy auditory motifs inspired by Drosophila courtship hearing.

This is NOT a measured connectome extract. The neuron names and the delayed
inhibitory loop follow the published courtship-hearing pathway:

    Johnston's organ (JO-B) → AMMC (aLN(al), aPN1) → WED (vPN1) → pC1
    JO-C / sine-preferring cells run a more tonic path beside it.

See Baker et al., Curr Biol 2022; Vaughan et al., Curr Biol 2014;
Zhou et al., eLife 2015. Weights and delays are a caricature chosen so a
~35 ms inter-pulse interval (the D. melanogaster pulse-song IPI) is audible
as a different output from a 15 ms roll or a continuous sine.

Swap this graph for a real FlyWire / MaleCNS subgraph when you extract one.
The simulator does not care which you give it.
"""

from __future__ import annotations

from .graph import CircuitGraph, Synapse

# Canonical D. melanogaster pulse-song inter-pulse interval.
PULSE_IPI_MS = 35.0


def toy_auditory_circuit() -> CircuitGraph:
    names = (
        "JO_B_0",
        "JO_B_1",
        "JO_B_2",
        "JO_C_0",
        "JO_C_1",
        "aLN_al",
        "aPN1",
        "vPN1",
        "pC1",
        "pulse_pool",
        "sine_pool",
        "B1",
    )
    index = {name: i for i, name in enumerate(names)}

    def edge(pre: str, post: str, weight_mv: float, delay_ms: float = 1.8) -> Synapse:
        return Synapse(index[pre], index[post], weight_mv, delay_ms)

    synapses = (
        # JO-B (pulse-sensitive Johnston's organ) onto AMMC.
        edge("JO_B_0", "aPN1", 4.0),
        edge("JO_B_1", "aPN1", 4.0),
        edge("JO_B_2", "aPN1", 3.5),
        edge("JO_B_0", "aLN_al", 3.5),
        edge("JO_B_1", "aLN_al", 3.5),
        edge("JO_B_2", "aLN_al", 3.0),
        # Delayed GABA from aLN(al) — the IPI-tuning motif.
        # Inhibition arrives ~18–22 ms after a pulse, so the next pulse is
        # favoured near the species IPI and suppressed if it comes too soon.
        edge("aLN_al", "aPN1", -8.0, delay_ms=20.0),
        edge("aLN_al", "vPN1", -3.0, delay_ms=22.0),
        # Projection to WED and the courtship integrator.
        # Weights are voltage kicks (Shiu: 0.275 mV per measured synapse).
        # 8 mV here stands in for ~30 parallel contacts, one reliable hop.
        edge("aPN1", "vPN1", 8.0, delay_ms=2.0),
        edge("vPN1", "pC1", 8.0, delay_ms=2.0),
        edge("pC1", "pulse_pool", 8.0, delay_ms=1.8),
        edge("pC1", "B1", 8.0, delay_ms=1.8),
        edge("B1", "pulse_pool", 4.0, delay_ms=1.8),
        # JO-C / sine path: more tonic, less IPI-tuned.
        edge("JO_C_0", "sine_pool", 8.0, delay_ms=1.8),
        edge("JO_C_1", "sine_pool", 8.0, delay_ms=1.8),
        edge("JO_C_0", "aLN_al", 1.5, delay_ms=1.8),
        # Weak cross-talk, as in the heterarchical auditory connectome.
        edge("sine_pool", "pC1", 2.0, delay_ms=3.0),
        edge("pulse_pool", "sine_pool", -3.0, delay_ms=4.0),
        edge("aPN1", "sine_pool", -1.5, delay_ms=2.0),
    )
    roles = {
        "jo_pulse": ("JO_B_0", "JO_B_1", "JO_B_2"),
        "jo_sine": ("JO_C_0", "JO_C_1"),
        "pulse_out": ("pulse_pool", "B1", "pC1"),
        "sine_out": ("sine_pool",),
        "kick": ("pulse_pool",),
        "hat": ("B1",),
        "pad": ("sine_pool",),
        "accent": ("pC1",),
    }
    return CircuitGraph(
        names=names,
        synapses=synapses,
        roles=roles,
        provenance=(
            "toy auditory motif inspired by JO-B → aLN(al)/aPN1 → vPN1 → pC1 "
            "(Baker 2022, Vaughan 2014, Zhou 2015). Not measured synapses."
        ),
    )
