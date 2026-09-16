"""Connectome-inspired audio experiments."""

from .graph import CircuitGraph, Synapse
from .lif import LifParams, LifSimulator, SpikeLog

__version__ = "0.1.0"

__all__ = [
    "CircuitGraph",
    "Synapse",
    "LifParams",
    "LifSimulator",
    "SpikeLog",
    "__version__",
]
