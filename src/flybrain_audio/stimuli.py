"""Synthetic sounds and the currents they inject into toy JO neurons."""

from __future__ import annotations

import numpy as np

from .circuits import PULSE_IPI_MS
from .graph import CircuitGraph
from .lif import LifParams


def pulse_song(
    duration_ms: float,
    ipi_ms: float = PULSE_IPI_MS,
    pulse_width_ms: float = 8.0,
    dt_ms: float = 0.5,
    sample_rate: int = 44100,
) -> np.ndarray:
    """Carrier pulses at `ipi_ms`, roughly D. melanogaster pulse song."""
    n = int(round(duration_ms * sample_rate / 1000.0))
    t = np.arange(n) / sample_rate
    audio = np.zeros(n, dtype=np.float64)
    pulse_len = max(1, int(round(pulse_width_ms * sample_rate / 1000.0)))
    period = ipi_ms / 1000.0
    starts = np.arange(0.05, duration_ms / 1000.0 - 0.05, period)
    carrier = 280.0
    for start in starts:
        i0 = int(round(start * sample_rate))
        i1 = min(n, i0 + pulse_len)
        env = np.hanning(i1 - i0)
        audio[i0:i1] += env * np.sin(2 * np.pi * carrier * t[i0:i1])
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio /= peak
    return audio


def sine_song(
    duration_ms: float,
    freq_hz: float = 160.0,
    sample_rate: int = 44100,
) -> np.ndarray:
    n = int(round(duration_ms * sample_rate / 1000.0))
    t = np.arange(n) / sample_rate
    env = np.hanning(n)
    # Flatten the middle so it is more like a held sine song bout.
    env = np.clip(env * 3.0, 0.0, 1.0)
    return 0.6 * env * np.sin(2 * np.pi * freq_hz * t)


def click_train(
    duration_ms: float,
    ipi_ms: float,
    sample_rate: int = 44100,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    rng = rng or np.random.default_rng(0)
    n = int(round(duration_ms * sample_rate / 1000.0))
    audio = np.zeros(n, dtype=np.float64)
    period = ipi_ms / 1000.0
    starts = np.arange(0.05, duration_ms / 1000.0 - 0.02, period)
    for start in starts:
        i0 = int(round(start * sample_rate))
        if i0 < n:
            audio[i0] = rng.choice([-1.0, 1.0])
    return audio


def audio_to_jo_current(
    audio: np.ndarray,
    graph: CircuitGraph,
    params: LifParams,
    sample_rate: int = 44100,
    pulse_gain_mv: float = 28.0,
    sine_gain_mv: float = 14.0,
    hold_ms: float = 8.0,
) -> np.ndarray:
    """Map audio into JO-B (onsets/pulses) and JO-C (low-frequency energy).

    This is an encoder, not transduction. Real Johnston's organ neurons are
    particle-velocity sensors with coarse frequency tuning. Here we use a
    cheap onset detector for the pulse channel and a 100–250 Hz band energy
    for the sine channel.

    Current is held for `hold_ms` so a few-millisecond acoustic pulse can
    actually reach spike threshold under the Shiu et al. membrane time
    constant (20 ms). A 4 ms pulse at 18 mV does not.
    """
    n_steps = int(round(len(audio) / sample_rate * 1000.0 / params.dt_ms))
    i_ext = np.zeros((n_steps, graph.n_neurons), dtype=np.float64)

    win = max(1, int(sample_rate * 0.003))
    kernel = np.ones(win) / win
    env = np.convolve(np.abs(audio), kernel, mode="same")
    onset = np.maximum(0.0, np.diff(env, prepend=env[0]))
    env_n = env / (env.max() + 1e-9)
    onset_n = onset / (onset.max() + 1e-9)
    pulse = np.maximum(env_n, onset_n)

    dt = 1.0 / sample_rate
    low = _lowpass(audio, 80.0, dt)
    high = _lowpass(audio, 280.0, dt)
    band = np.abs(high - low)
    band = np.convolve(band, kernel, mode="same")
    band /= band.max() + 1e-9

    samples_per_step = sample_rate * params.dt_ms / 1000.0
    pulse_idx = graph.indices("jo_pulse")
    sine_idx = graph.indices("jo_sine")
    pulse_drive = np.zeros(n_steps, dtype=np.float64)
    sine_drive = np.zeros(n_steps, dtype=np.float64)
    for t in range(n_steps):
        i0 = int(round(t * samples_per_step))
        i1 = int(round((t + 1) * samples_per_step))
        i1 = min(len(audio), max(i0 + 1, i1))
        pulse_drive[t] = float(np.max(pulse[i0:i1]))
        sine_drive[t] = float(np.mean(band[i0:i1]))

    # Causal hold: each peak bleeds forward so integration can cross threshold.
    hold_steps = max(1, int(round(hold_ms / params.dt_ms)))
    decay = np.exp(-np.arange(hold_steps) / max(hold_steps / 3.0, 1.0))
    held = np.zeros_like(pulse_drive)
    for t, value in enumerate(pulse_drive):
        if value <= 0:
            continue
        sl = slice(t, min(n_steps, t + hold_steps))
        held[sl] = np.maximum(held[sl], value * decay[: sl.stop - sl.start])
    pulse_drive = held

    if pulse_idx.size:
        i_ext[:, pulse_idx] = pulse_gain_mv * pulse_drive[:, None]
    if sine_idx.size:
        i_ext[:, sine_idx] = sine_gain_mv * sine_drive[:, None]
    return i_ext


def _lowpass(x: np.ndarray, cutoff_hz: float, dt: float) -> np.ndarray:
    a = np.exp(-2.0 * np.pi * cutoff_hz * dt)
    y = np.empty_like(x, dtype=np.float64)
    acc = 0.0
    for i, sample in enumerate(x):
        acc = a * acc + (1.0 - a) * sample
        y[i] = acc
    return y
