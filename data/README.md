# Connectome data (not in git)

v0.1 ships a 12-neuron **toy motif** so the repo runs offline. Measured graphs are large and CC BY 4.0; download them yourself.

## FlyWire (adult female brain)

- Explorer: https://codex.flywire.ai/
- Downloads: https://codex.flywire.ai/api/download
- Zenodo snapshot (v783): https://zenodo.org/records/10676866
- Cite Dorkenwald et al. 2024 and Schlegel et al. 2024

For the auditory experiment, start from Baker et al. 2022 Table S3 (FlyWire root IDs for JO, AMMC, WED/VLP auditory types) and pull only those rows from the connectivity table. A few hundred neurons is the right scale for a plugin.

## MaleCNS (adult male brain + VNC)

- Project: https://male-cns.janelia.org/
- Downloads: https://male-cns.janelia.org/download/
- Public bucket (community scripts use this):

```
https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/
  body-annotations-male-cns-v1.0-minconf-0.5.feather
  body-neurotransmitters-male-cns-v1.0.feather
  connectome-weights-male-cns-v1.0-minconf-0.5.feather
```

Needed for song-*production* (VNC nested circuits). Cite Berg et al. 2026.

## MANC (male VNC only)

neuPrint `manc:v1.2.3`. Song-production body IDs are in the Shiozaki et al. 2024 supplement.

## How this repo will load them later

Planned on-disk format (not implemented):

```
data/raw/          # gitignored downloads
data/graphs/*.npz  # CSR: names, pre, post, weight_mv, delay_ms, roles.json
```

`CircuitGraph` already matches that shape. An extract script should write provenance (dataset, version, body ID list, licence) into `CircuitGraph.provenance` and refuse to load a graph with no citation string.

## Licence reminder

Code in this repository is MIT. The connectome files are not. If you redistribute a subgraph, include the dataset's CC BY 4.0 notice and the papers above.
