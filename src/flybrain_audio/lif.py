"""Leaky integrate-and-fire engine.

Parameters follow Shiu et al., Nature 2024 (the whole-brain Drosophila LIF
model): rest/reset −52 mV, threshold −45 mV, τ_m 20 ms, τ_syn 5 ms,
refractory 2.2 ms, delay 1.8 ms, 0.275 mV per measured synapse. The
physiology is still a model — one voltage per neuron, no ion channels.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .graph import CircuitGraph


@dataclass(frozen=True)
class LifParams:
    v_rest_mv: float = -52.0
    v_reset_mv: float = -52.0
    v_thresh_mv: float = -45.0
    tau_m_ms: float = 20.0
    tau_syn_ms: float = 5.0
    t_ref_ms: float = 2.2
    dt_ms: float = 0.5


@dataclass
class SpikeLog:
    time_ms: np.ndarray
    neuron: np.ndarray

    def times_for(self, index: int) -> np.ndarray:
        return self.time_ms[self.neuron == index]


class LifSimulator:
    def __init__(self, graph: CircuitGraph, params: LifParams | None = None) -> None:
        self.graph = graph
        self.params = params or LifParams()
        n = graph.n_neurons
        self.v = np.full(n, self.params.v_rest_mv, dtype=np.float64)
        self.ref_left = np.zeros(n, dtype=np.float64)
        delay_steps = [
            max(1, int(round(syn.delay_ms / self.params.dt_ms))) for syn in graph.synapses
        ]
        self._delay_steps = np.array(delay_steps, dtype=np.int32)
        self._pre = np.array([s.pre for s in graph.synapses], dtype=np.int32)
        self._post = np.array([s.post for s in graph.synapses], dtype=np.int32)
        self._w = np.array([s.weight_mv for s in graph.synapses], dtype=np.float64)
        # Ring buffer of pending voltage kicks. Length is max_delay+1 so a
        # delay of max_delay never aliases onto the slot we just consumed.
        self._buf = (max(delay_steps) + 1) if delay_steps else 2
        self._queue = np.zeros((self._buf, n), dtype=np.float64)
        self._qhead = 0
        self._t_ms = 0.0
        self._spike_t: list[float] = []
        self._spike_i: list[int] = []

    def reset(self) -> None:
        self.v.fill(self.params.v_rest_mv)
        self.ref_left.fill(0.0)
        self._queue.fill(0.0)
        self._qhead = 0
        self._t_ms = 0.0
        self._spike_t.clear()
        self._spike_i.clear()

    def step(self, i_ext_mv: np.ndarray) -> np.ndarray:
        p = self.params
        n = self.graph.n_neurons
        if i_ext_mv.shape != (n,):
            raise ValueError(f"i_ext_mv must have shape ({n},)")

        # Leak + injected current, then delayed voltage kicks (Shiu-style:
        # one spike adds weight millivolts to the postsynaptic membrane).
        dv = (-(self.v - p.v_rest_mv) + i_ext_mv) * (p.dt_ms / p.tau_m_ms)
        self.v += dv
        self.v += self._queue[self._qhead]
        self._queue[self._qhead] = 0.0

        self.ref_left = np.maximum(0.0, self.ref_left - p.dt_ms)
        refractory = self.ref_left > 0.0
        self.v[refractory] = p.v_reset_mv

        spiked = (~refractory) & (self.v >= p.v_thresh_mv)
        if np.any(spiked):
            idxs = np.flatnonzero(spiked)
            self.v[idxs] = p.v_reset_mv
            self.ref_left[idxs] = p.t_ref_ms
            for i in idxs:
                self._spike_t.append(self._t_ms)
                self._spike_i.append(int(i))
            fired = spiked[self._pre]
            if np.any(fired):
                posts = self._post[fired]
                weights = self._w[fired]
                delays = self._delay_steps[fired]
                for post, weight, delay in zip(posts, weights, delays):
                    slot = (self._qhead + int(delay)) % self._buf
                    self._queue[slot, post] += weight

        self._qhead = (self._qhead + 1) % self._buf
        self._t_ms += p.dt_ms
        return spiked.astype(np.int8)

    def run(self, i_ext: np.ndarray) -> tuple[np.ndarray, SpikeLog]:
        """Drive the network with a (T, N) current trace in millivolts.

        Returns a binary spike raster of shape (T, N) and a spike log.
        """
        if i_ext.ndim != 2 or i_ext.shape[1] != self.graph.n_neurons:
            raise ValueError("i_ext must have shape (T, n_neurons)")
        t_steps = i_ext.shape[0]
        raster = np.zeros((t_steps, self.graph.n_neurons), dtype=np.int8)
        for t in range(t_steps):
            raster[t] = self.step(i_ext[t])
        log = SpikeLog(
            time_ms=np.asarray(self._spike_t, dtype=np.float64),
            neuron=np.asarray(self._spike_i, dtype=np.int32),
        )
        return raster, log
