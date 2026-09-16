"""Stimulus → circuit → spikes → hits → audio."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .circuits import toy_auditory_circuit
from .decode import Hit, spikes_to_hits
from .graph import CircuitGraph
from .lif import LifParams, LifSimulator, SpikeLog
from .stimuli import audio_to_jo_current, click_train, pulse_song, sine_song
from .synth import render_hits


STIMULI = ("pulse35", "pulse15", "sine", "clicks")


@dataclass
class RunResult:
    stimulus_name: str
    graph: CircuitGraph
    stimulus: np.ndarray
    raster: np.ndarray
    log: SpikeLog
    hits: list[Hit]
    audio: np.ndarray
    sample_rate: int


def make_stimulus(
    name: str,
    duration_ms: float,
    sample_rate: int,
    rng: np.random.Generator,
) -> np.ndarray:
    if name == "pulse35":
        return pulse_song(duration_ms, ipi_ms=35.0, sample_rate=sample_rate)
    if name == "pulse15":
        return pulse_song(duration_ms, ipi_ms=15.0, sample_rate=sample_rate)
    if name == "sine":
        return sine_song(duration_ms, sample_rate=sample_rate)
    if name == "clicks":
        return click_train(duration_ms, ipi_ms=80.0, sample_rate=sample_rate, rng=rng)
    raise ValueError(f"unknown stimulus {name!r}; choose from {STIMULI}")


def run_circuit(
    *,
    stimulus_name: str = "pulse35",
    duration_ms: float = 4000.0,
    sample_rate: int = 44100,
    shuffle: bool = False,
    seed: int = 0,
    graph: CircuitGraph | None = None,
    params: LifParams | None = None,
) -> RunResult:
    rng = np.random.default_rng(seed)
    graph = graph or toy_auditory_circuit()
    if shuffle:
        graph = graph.shuffled(rng)
    params = params or LifParams()
    stimulus = make_stimulus(stimulus_name, duration_ms, sample_rate, rng)
    i_ext = audio_to_jo_current(stimulus, graph, params, sample_rate=sample_rate)
    sim = LifSimulator(graph, params)
    raster, log = sim.run(i_ext)
    hits = spikes_to_hits(log, graph)
    audio = render_hits(
        [(h.time_s, h.voice) for h in hits],
        duration_s=duration_ms / 1000.0,
        sample_rate=sample_rate,
    )
    return RunResult(
        stimulus_name=stimulus_name,
        graph=graph,
        stimulus=stimulus,
        raster=raster,
        log=log,
        hits=hits,
        audio=audio,
        sample_rate=sample_rate,
    )
