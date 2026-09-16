from flybrain_audio.filter import johnston_filter
from flybrain_audio.stimuli import pulse_song, sine_song
from flybrain_audio.wavutil import read_wav, write_wav


def test_filter_changes_pulse_song(tmp_path) -> None:
    stim = pulse_song(1200.0)
    wet, tel = johnston_filter(stim, sample_rate=44100, wet=1.0)
    assert wet.shape == stim.shape
    assert tel["n_spikes"] > 0
    assert abs(float(wet.mean()) ) < 0.2


def test_filter_shuffle_differs() -> None:
    stim = sine_song(800.0)
    a, _ = johnston_filter(stim, shuffle=False, seed=3, wet=1.0)
    b, _ = johnston_filter(stim, shuffle=True, seed=3, wet=1.0)
    assert a.shape == b.shape
    assert float(((a - b) ** 2).mean()) > 0.0


def test_wav_roundtrip(tmp_path) -> None:
    path = tmp_path / "t.wav"
    stim = pulse_song(400.0)
    write_wav(path, stim, 44100)
    back, rate = read_wav(path)
    assert rate == 44100
    assert back.shape[0] == stim.shape[0]
