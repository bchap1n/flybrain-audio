"""Johnston filter: circuit spike-rate envelopes as a sidechain gate.

Offline cousin of the browser AudioWorklet. Pulse-pool rate ducks the dry
signal; sine-pool rate opens a gentle lowpass. Same toy motif as the sampler.
"""

from __future__ import annotations

import numpy as np

from .circuits import toy_auditory_circuit
from .graph import CircuitGraph
from .lif import LifParams, LifSimulator
from .stimuli import audio_to_jo_current


def _ema(x: np.ndarray, tau_steps: float) -> np.ndarray:
    a = np.exp(-1.0 / max(tau_steps, 1.0))
    y = np.empty_like(x, dtype=np.float64)
    acc = 0.0
    for i, v in enumerate(x):
        acc = a * acc + (1.0 - a) * v
        y[i] = acc
    return y


def _onepole(x: np.ndarray, cutoff_hz: float, sample_rate: int) -> np.ndarray:
    a = np.exp(-2.0 * np.pi * cutoff_hz / sample_rate)
    y = np.empty_like(x, dtype=np.float64)
    acc = 0.0
    for i, v in enumerate(x):
        acc = a * acc + (1.0 - a) * v
        y[i] = acc
    return y


def johnston_filter(
    audio: np.ndarray,
    *,
    sample_rate: int = 44100,
    pulse_depth: float = 0.7,
    sine_warmth: float = 0.45,
    wet: float = 0.85,
    shuffle: bool = False,
    seed: int = 0,
    graph: CircuitGraph | None = None,
    params: LifParams | None = None,
) -> tuple[np.ndarray, dict]:
    """Return (wet audio, telemetry) for a mono float signal in [-1, 1]."""
    graph = graph or toy_auditory_circuit()
    if shuffle:
        graph = graph.shuffled(np.random.default_rng(seed))
    params = params or LifParams()
    i_ext = audio_to_jo_current(audio, graph, params, sample_rate=sample_rate)
    sim = LifSimulator(graph, params)
    raster, log = sim.run(i_ext)

    pulse_idx = graph.indices("pulse_out")
    sine_idx = graph.indices("sine_out")
    pulse_rate = raster[:, pulse_idx].mean(axis=1) if pulse_idx.size else np.zeros(raster.shape[0])
    sine_rate = raster[:, sine_idx].mean(axis=1) if sine_idx.size else np.zeros(raster.shape[0])
    pulse_env = _ema(pulse_rate, tau_steps=30.0 / params.dt_ms)
    sine_env = _ema(sine_rate, tau_steps=80.0 / params.dt_ms)
    pmax = float(pulse_env.max()) + 1e-9
    smax = float(sine_env.max()) + 1e-9
    pulse_env = pulse_env / pmax
    sine_env = sine_env / smax

    samples_per_step = sample_rate * params.dt_ms / 1000.0
    n = len(audio)
    gate = np.ones(n, dtype=np.float64)
    warm = np.ones(n, dtype=np.float64)
    for t, (p, s) in enumerate(zip(pulse_env, sine_env)):
        i0 = int(round(t * samples_per_step))
        i1 = min(n, int(round((t + 1) * samples_per_step)))
        if i1 > i0:
            gate[i0:i1] = 1.0 - pulse_depth * p
            warm[i0:i1] = 1.0 + sine_warmth * s
    ducked = audio * gate
    # Sine-path warmth: a low shelf approximated by mixing a 180 Hz one-pole.
    low = _onepole(ducked, 180.0, sample_rate)
    filtered = ducked * (1.0 - 0.35 * sine_env.mean()) + low * warm
    peak = np.max(np.abs(filtered))
    if peak > 0.95:
        filtered *= 0.95 / peak
    out = wet * filtered + (1.0 - wet) * audio
    telemetry = {
        "n_spikes": int(log.time_ms.size),
        "pulse_env_mean": float(pulse_env.mean()),
        "sine_env_mean": float(sine_env.mean()),
        "provenance": graph.provenance,
    }
    return out, telemetry
