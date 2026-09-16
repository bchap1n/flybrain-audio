import numpy as np

from flybrain_audio.circuits import toy_auditory_circuit
from flybrain_audio.decode import spikes_to_hits
from flybrain_audio.pipeline import run_circuit


def test_toy_circuit_is_well_formed() -> None:
    g = toy_auditory_circuit()
    assert g.n_neurons == 12
    assert len(g.synapses) >= 10
    assert g.indices("jo_pulse").size == 3
    shuffled = g.shuffled(np.random.default_rng(0))
    assert shuffled.n_neurons == g.n_neurons
    assert len(shuffled.synapses) == len(g.synapses)
    # At least one target should move under this seed.
    orig_posts = [s.post for s in g.synapses]
    new_posts = [s.post for s in shuffled.synapses]
    assert orig_posts != new_posts


def test_pulse35_produces_hits() -> None:
    result = run_circuit(stimulus_name="pulse35", duration_ms=1500.0, seed=1)
    assert result.log.time_ms.size > 0
    hits = spikes_to_hits(result.log, result.graph)
    assert len(hits) >= 4
    voices = {h.voice for h in hits}
    assert "kick" in voices or "hat" in voices or "snare" in voices


def test_shuffle_changes_hit_pattern() -> None:
    live = run_circuit(stimulus_name="pulse35", duration_ms=1500.0, seed=2, shuffle=False)
    shuffled = run_circuit(stimulus_name="pulse35", duration_ms=1500.0, seed=2, shuffle=True)
    live_times = tuple(round(h.time_s, 3) for h in live.hits)
    shuf_times = tuple(round(h.time_s, 3) for h in shuffled.hits)
    assert live_times != shuf_times or len(live.hits) != len(shuffled.hits)
