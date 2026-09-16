"""Command line: render a fly-circuit sequencer/sampler take."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import __version__
from .pipeline import STIMULI, run_circuit
from .wavutil import write_wav


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="flybrain-audio",
        description=(
            "Run a toy Drosophila auditory circuit as a sequencer/sampler. "
            "Wiring is a motif, not a measured extract — see README."
        ),
    )
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    sub = p.add_subparsers(dest="cmd", required=True)

    demo = sub.add_parser("demo", help="render stimulus, circuit audio, and a shuffled control")
    demo.add_argument("--stimulus", choices=STIMULI, default="pulse35")
    demo.add_argument("--duration-ms", type=float, default=4000.0)
    demo.add_argument("--out", type=Path, default=Path("out"))
    demo.add_argument("--seed", type=int, default=0)
    demo.add_argument("--shuffle", action="store_true", help="only run the shuffled control")
    demo.add_argument(
        "--compare",
        action="store_true",
        help="also render the shuffled wiring (default for pulse35)",
    )
    return p


def _write_take(result, out: Path, tag: str) -> dict:
    wav_path = out / f"{tag}.wav"
    stim_path = out / f"{tag}_stimulus.wav"
    write_wav(wav_path, result.audio, result.sample_rate)
    write_wav(stim_path, result.stimulus, result.sample_rate)
    summary = {
        "tag": tag,
        "stimulus": result.stimulus_name,
        "provenance": result.graph.provenance,
        "n_neurons": result.graph.n_neurons,
        "n_synapses": len(result.graph.synapses),
        "n_spikes": int(result.log.time_ms.size),
        "n_hits": len(result.hits),
        "voices": {v: sum(1 for h in result.hits if h.voice == v) for v in ("kick", "snare", "hat", "pad")},
        "wav": str(wav_path),
        "stimulus_wav": str(stim_path),
    }
    (out / f"{tag}.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.cmd == "demo":
        args.out.mkdir(parents=True, exist_ok=True)
        compare = args.compare or (args.stimulus == "pulse35" and not args.shuffle)
        results = []
        if not args.shuffle:
            live = run_circuit(
                stimulus_name=args.stimulus,
                duration_ms=args.duration_ms,
                seed=args.seed,
                shuffle=False,
            )
            results.append(_write_take(live, args.out, f"{args.stimulus}_motif"))
        if args.shuffle or compare:
            shuffled = run_circuit(
                stimulus_name=args.stimulus,
                duration_ms=args.duration_ms,
                seed=args.seed,
                shuffle=True,
            )
            results.append(_write_take(shuffled, args.out, f"{args.stimulus}_shuffled"))
        print(json.dumps(results, indent=2))
        print(f"wrote {args.out.resolve()}")
        return 0
    raise SystemExit(f"unknown command {args.cmd}")


if __name__ == "__main__":
    raise SystemExit(main())
