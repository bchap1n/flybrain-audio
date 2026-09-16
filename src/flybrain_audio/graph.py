"""Directed signed graphs used as spiking circuits.

A real connectome is a measured list of (pre, post, synapse count, sign).
This module stores that shape without assuming the edges came from a fly.
Toy motifs and shuffled controls share the same type so experiments can
swap wiring without changing the simulator.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Synapse:
    pre: int
    post: int
    weight_mv: float
    delay_ms: float = 1.8


@dataclass
class CircuitGraph:
    names: tuple[str, ...]
    synapses: tuple[Synapse, ...]
    roles: dict[str, tuple[str, ...]]
    provenance: str

    def __post_init__(self) -> None:
        n = len(self.names)
        if n == 0:
            raise ValueError("circuit must contain at least one neuron")
        if len(set(self.names)) != n:
            raise ValueError("neuron names must be unique")
        index = {name: i for i, name in enumerate(self.names)}
        for syn in self.synapses:
            if not (0 <= syn.pre < n and 0 <= syn.post < n):
                raise ValueError(f"synapse index out of range: {syn}")
            if syn.delay_ms < 0:
                raise ValueError("synaptic delay cannot be negative")
        for role, members in self.roles.items():
            for name in members:
                if name not in index:
                    raise ValueError(f"role {role!r} refers to unknown neuron {name!r}")

    @property
    def n_neurons(self) -> int:
        return len(self.names)

    def index_of(self, name: str) -> int:
        try:
            return self.names.index(name)
        except ValueError as exc:
            raise KeyError(name) from exc

    def indices(self, role: str) -> np.ndarray:
        members = self.roles.get(role, ())
        return np.array([self.index_of(name) for name in members], dtype=np.int32)

    def shuffled(self, rng: np.random.Generator) -> CircuitGraph:
        """Degree-preserving rewire: keep weights and delays, permute targets.

        This is the cheap scientific control. If a musical behaviour survives
        shuffling, it is not coming from the measured (or designed) wiring.
        """
        posts = np.array([s.post for s in self.synapses], dtype=np.int32)
        rng.shuffle(posts)
        synapses = tuple(
            Synapse(pre=s.pre, post=int(post), weight_mv=s.weight_mv, delay_ms=s.delay_ms)
            for s, post in zip(self.synapses, posts)
        )
        return CircuitGraph(
            names=self.names,
            synapses=synapses,
            roles=self.roles,
            provenance=f"{self.provenance} | shuffled targets",
        )
