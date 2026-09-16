"""Tiny synthesized drum/pad voices. No third-party samples."""

from __future__ import annotations

import numpy as np


def kick(sample_rate: int = 44100, duration_s: float = 0.28) -> np.ndarray:
    n = int(duration_s * sample_rate)
    t = np.arange(n) / sample_rate
    freq = 140.0 * np.exp(-t * 18.0) + 40.0
    phase = np.cumsum(2 * np.pi * freq / sample_rate)
    body = np.sin(phase) * np.exp(-t * 10.0)
    click = np.exp(-t * 80.0) * np.sin(2 * np.pi * 1800 * t)
    return 0.9 * body + 0.15 * click


def snare(sample_rate: int = 44100, duration_s: float = 0.22) -> np.ndarray:
    n = int(duration_s * sample_rate)
    t = np.arange(n) / sample_rate
    rng = np.random.default_rng(7)
    noise = rng.uniform(-1.0, 1.0, n) * np.exp(-t * 18.0)
    tone = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 14.0)
    return 0.55 * noise + 0.35 * tone


def hat(sample_rate: int = 44100, duration_s: float = 0.08) -> np.ndarray:
    n = int(duration_s * sample_rate)
    t = np.arange(n) / sample_rate
    rng = np.random.default_rng(3)
    noise = rng.uniform(-1.0, 1.0, n)
    # Crude highpass.
    noise = noise - np.convolve(noise, np.ones(12) / 12.0, mode="same")
    return 0.35 * noise * np.exp(-t * 55.0)


def pad(sample_rate: int = 44100, duration_s: float = 0.45, freq: float = 196.0) -> np.ndarray:
    n = int(duration_s * sample_rate)
    t = np.arange(n) / sample_rate
    env = np.exp(-t * 4.0) * (1.0 - np.exp(-t * 40.0))
    voice = (
        0.6 * np.sin(2 * np.pi * freq * t)
        + 0.25 * np.sin(2 * np.pi * freq * 1.5 * t)
        + 0.15 * np.sin(2 * np.pi * freq * 2.0 * t)
    )
    return 0.4 * env * voice


VOICES = {
    "kick": kick,
    "snare": snare,
    "hat": hat,
    "pad": pad,
}


def render_hits(
    hits: list[tuple[float, str]],
    duration_s: float,
    sample_rate: int = 44100,
) -> np.ndarray:
    n = int(round(duration_s * sample_rate))
    out = np.zeros(n, dtype=np.float64)
    cache = {name: fn(sample_rate=sample_rate) for name, fn in VOICES.items()}
    for time_s, voice in hits:
        wave = cache[voice]
        i0 = int(round(time_s * sample_rate))
        if i0 >= n or i0 < 0:
            continue
        i1 = min(n, i0 + len(wave))
        out[i0:i1] += wave[: i1 - i0]
    peak = np.max(np.abs(out))
    if peak > 0.95:
        out *= 0.95 / peak
    return out
