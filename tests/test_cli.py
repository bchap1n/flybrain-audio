from pathlib import Path

from flybrain_audio.cli import main


def test_demo_writes_wavs(tmp_path: Path) -> None:
    code = main(
        [
            "demo",
            "--stimulus",
            "pulse35",
            "--duration-ms",
            "800",
            "--out",
            str(tmp_path),
            "--compare",
        ]
    )
    assert code == 0
    assert (tmp_path / "pulse35_motif.wav").exists()
    assert (tmp_path / "pulse35_shuffled.wav").exists()
    assert (tmp_path / "pulse35_motif.json").exists()
