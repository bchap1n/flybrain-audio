import numpy as np

from flybrain_audio.graph import CircuitGraph, Synapse
from flybrain_audio.lif import LifParams, LifSimulator


def _one_neuron() -> CircuitGraph:
    return CircuitGraph(
        names=("n0",),
        synapses=(),
        roles={"all": ("n0",)},
        provenance="test",
    )


def test_constant_current_elicits_spikes() -> None:
    graph = _one_neuron()
    params = LifParams(dt_ms=0.5)
    sim = LifSimulator(graph, params)
    steps = 200
    i_ext = np.zeros((steps, 1))
    i_ext[:, 0] = 20.0  # well above rheobase for these params
    raster, log = sim.run(i_ext)
    assert log.time_ms.size >= 3
    assert raster.sum() == log.time_ms.size


def test_subthreshold_current_is_silent() -> None:
    graph = _one_neuron()
    sim = LifSimulator(graph)
    i_ext = np.zeros((200, 1))
    i_ext[:, 0] = 1.0
    _, log = sim.run(i_ext)
    assert log.time_ms.size == 0


def test_excitatory_synapse_drives_postsynaptic_cell() -> None:
    graph = CircuitGraph(
        names=("pre", "post"),
        synapses=(Synapse(0, 1, weight_mv=8.0, delay_ms=1.5),),
        roles={"pre": ("pre",), "post": ("post",)},
        provenance="test",
    )
    params = LifParams(dt_ms=0.5)
    sim = LifSimulator(graph, params)
    steps = 80
    i_ext = np.zeros((steps, 2))
    i_ext[10:30, 0] = 20.0  # 10 ms suprathreshold current into pre
    raster, log = sim.run(i_ext)
    pre_spikes = log.times_for(0)
    post_spikes = log.times_for(1)
    assert pre_spikes.size >= 1
    assert post_spikes.size >= 1
    assert post_spikes.min() > pre_spikes.min()
