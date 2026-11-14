"""Generates every audio file the app ships with. Nothing is downloaded at runtime.

    .tts/venv/bin/python audio-tools/generate_audio.py            # everything
    .tts/venv/bin/python audio-tools/generate_audio.py sounds     # soundscapes only
    .tts/venv/bin/python audio-tools/generate_audio.py meditations [id ...]
    .tts/venv/bin/python audio-tools/generate_audio.py sounds [id ...]
    .tts/venv/bin/python audio-tools/generate_audio.py cues       # breathing pacer tones
    .tts/venv/bin/python audio-tools/generate_audio.py voice      # redesign the narrator's reference clip

Soundscapes are synthesized from filtered noise and tones, and made to loop seamlessly.
Meditations are spoken by the Qwen3-TTS open-source voice model (Apache 2.0), timed to an exact
length, softened, and mixed over one of several background beds with a bell at the start and end. Output is AAC (.m4a),
encoded with macOS's built-in afconvert.

Setup (once): see audio-tools/README.md.
"""

from __future__ import annotations

import hashlib
import zlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
CATALOG = json.loads((ROOT / "content" / "catalog.json").read_text())
SCRIPTS = ROOT / "content" / "meditations.txt"
OUT_SOUNDS = ROOT / "assets" / "audio" / "sounds"
OUT_MEDITATIONS = ROOT / "assets" / "audio" / "meditations"
AUDIO_MAP = ROOT / "src" / "content" / "audio-files.ts"
TTS_DIR = ROOT / ".tts"
TTS_CACHE = TTS_DIR / "cache"

SR = 44100
# The narrator: a gentle, soothing female voice. Qwen3-TTS VoiceDesign created her once from the description
# below, and the clip is kept in NARRATOR_REF. The Qwen3-TTS Base model clones that clip for every sentence, so
# she sounds the same in every session. Sentences in one line get a short silence between them.
VOICE_DESIGN_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
VOICE_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
VOICE_LANG = "English"
VOICE_DESCRIPTION = (
    "A gentle, soothing woman in her thirties with a native American English accent, guiding a meditation. "
    "She speaks softly and slowly, with long relaxed pauses, a warm low-to-medium pitch and a calm, breathy, "
    "reassuring tone. Never excited, never rushed."
)
NARRATOR_REF = ROOT / "audio-tools" / "narrator-reference.wav"
NARRATOR_REF_TEXT = (
    "Welcome. Settle in, and let your body grow heavy and still. "
    "Breathe in slowly through your nose, and gently let the breath go. "
    "There is nowhere you need to be. Just rest here, softly, in this moment."
)
NARRATOR_SEED = 0
# The cloned voice draws out some words, such as "Welcome." Each sentence is sped up by this much, without
# changing its pitch.
VOICE_TEMPO = 1.08
SENTENCE_GAP = 0.6


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def white(rng: np.random.Generator, n: int) -> np.ndarray:
    return rng.standard_normal(n)


def pink(rng: np.random.Generator, n: int) -> np.ndarray:
    # Paul Kellet's economy filter: white noise in, roughly 1/f noise out.
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, white(rng, n))


def brown(rng: np.random.Generator, n: int) -> np.ndarray:
    # Leaky integrator so the signal can't drift.
    out = signal.lfilter([1.0], [1.0, -0.997], white(rng, n))
    return highpass(out, 20)


def sos(kind: str, freq, order: int = 2):
    return signal.butter(order, freq, btype=kind, fs=SR, output="sos")


def lowpass(x, f, order=2):
    return signal.sosfilt(sos("lowpass", f, order), x)


def highpass(x, f, order=2):
    return signal.sosfilt(sos("highpass", f, order), x)


def bandpass(x, lo, hi, order=2):
    return signal.sosfilt(sos("bandpass", [lo, hi], order), x)


def smooth_noise(rng, n: int, rate_hz: float) -> np.ndarray:
    """Slowly varying random curve in roughly 0..1, for gusts and swells."""
    points = max(4, int(n / SR * rate_hz) + 4)
    knots = rng.random(points)
    x = np.linspace(0, points - 3, n)
    return np.interp(x, np.arange(points), knots)


def envelope(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    env = np.minimum(1.0, t / max(attack, 1e-4)) * np.exp(-np.maximum(0, t - attack) / max(decay, 1e-4))
    return env


def place(dst: np.ndarray, src: np.ndarray, start: int) -> None:
    end = min(len(dst), start + len(src))
    if start < len(dst):
        dst[start:end] += src[: end - start]


def place_wrap(dst: np.ndarray, src: np.ndarray, start: int) -> None:
    """Adds src into dst, wrapping anything past the end back to the start (for seamless loops)."""
    n = len(dst)
    idx = (start + np.arange(len(src))) % n
    np.add.at(dst, idx, src)


def circular_reverb(x: np.ndarray, rng, seconds: float = 2.5, wet: float = 0.35) -> np.ndarray:
    """A simple room reverb (decaying noise impulse) applied as a circular convolution, so the
    reverb tail at the end of a loop rings into its start instead of being cut off."""
    n = len(x)
    length = int(SR * seconds)
    ir = rng.standard_normal(length) * np.exp(-np.arange(length) / (SR * seconds / 6))
    ir = lowpass(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-12
    kernel = np.zeros(n)
    kernel[:length] = ir
    tail = np.real(np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(kernel), n))
    return (1 - wet) * x + wet * tail


def stereo(rng, mono_fn, n: int, width: float = 0.5) -> np.ndarray:
    """Builds a stereo pair from a shared signal plus independent signals per side."""
    common = mono_fn(rng, n)
    left = (1 - width) * common + width * mono_fn(rng, n)
    right = (1 - width) * common + width * mono_fn(rng, n)
    return np.stack([left, right], axis=1)


def normalize(x: np.ndarray, rms_db: float = -20.0, peak_db: float = -1.5) -> np.ndarray:
    """Sets the average level, then softly limits peaks so spiky sounds (rain) aren't quieter."""
    limit = 10 ** (peak_db / 20)
    for _ in range(3):
        rms = np.sqrt(np.mean(x ** 2)) + 1e-12
        x = x * (10 ** (rms_db / 20) / rms)
        x = limit * np.tanh(x / limit)
    return x


def make_loop(x: np.ndarray, loop_samples: int) -> np.ndarray:
    """Turns a signal longer than the loop into a seamless loop.

    The extra audio after the loop point is crossfaded into the start, so the last sample
    flows directly into the first one when the file repeats.
    """
    fade = len(x) - loop_samples
    assert fade > 0
    out = x[:loop_samples].copy()
    t = np.linspace(0, np.pi / 2, fade)
    fade_in, fade_out = np.sin(t), np.cos(t)
    if x.ndim == 2:
        fade_in, fade_out = fade_in[:, None], fade_out[:, None]
    out[:fade] = x[:fade] * fade_in + x[loop_samples:] * fade_out
    return out


def encode(wav: np.ndarray, out_path: Path, bitrate: int) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        sf.write(tmp.name, wav.astype(np.float32), SR, subtype="PCM_16")
        subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", "-b", str(bitrate), tmp.name, str(out_path)],
            check=True,
        )
    print(f"  wrote {out_path.relative_to(ROOT)} ({out_path.stat().st_size / 1e6:.1f} MB)")


# ---------------------------------------------------------------------------
# Soundscapes
# ---------------------------------------------------------------------------

LOOP_SECONDS = 120
CROSSFADE_SECONDS = 6


def droplets(rng, n, per_second, lo, hi, decay_ms, gain=1.0):
    impulses = np.zeros(n)
    count = int(n / SR * per_second)
    idx = rng.integers(0, n, count)
    impulses[idx] = rng.random(count) ** 3 * gain
    rung = bandpass(impulses, lo, hi, order=2)
    kernel = np.exp(-np.arange(int(SR * decay_ms / 1000)) / (SR * decay_ms / 4000))
    return signal.fftconvolve(rung, kernel)[:n]


def sound_rain(rng, n):
    """Light rain: a soft, low hiss with a few rounded drops, and no sharp high end."""
    def mono(r, k):
        hiss = lowpass(bandpass(pink(r, k), 250, 2500), 2000)
        drops = droplets(r, k, 40, 700, 2200, 22, gain=2.0)
        swell = 0.85 + 0.15 * smooth_noise(r, k, 0.08)
        return (hiss + 0.3 * drops) * swell
    return stereo(rng, mono, n, 0.7)


def sound_ocean(rng, n):
    """Low, rolling surf. Kept below about 1.5 kHz so there is no hiss; the wash of each wave
    is a gentle mid-range swell rather than bright noise."""
    swell = np.zeros(n)
    t = 0.0
    while t < n / SR:
        period = rng.uniform(8, 12)
        length = int(SR * period * 1.4)
        wave = envelope(length, period * 0.35, period * 0.35) * rng.uniform(0.6, 1.0)
        place(swell, wave, int(t * SR))
        t += period
    swell = 0.25 + swell / swell.max()
    wash = np.maximum(0, np.gradient(signal.savgol_filter(swell, 2001, 2))) * SR
    wash = lowpass(wash / (wash.max() + 1e-9), 3)

    def side(r):
        body = lowpass(brown(r, n) / 20 + 0.5 * pink(r, n), 700, order=4)
        surf = bandpass(pink(r, n), 250, 1400, order=2)
        return body * swell + 0.45 * surf * (0.3 * swell + wash)

    left, right = side(rng), side(rng)
    pan = 0.5 + 0.15 * np.sin(2 * np.pi * np.arange(n) / SR / 23)
    return np.stack([left * (1 - pan) + right * pan * 0.5, right * pan + left * (1 - pan) * 0.5], axis=1)


NOTE = {name: 440.0 * 2 ** ((midi - 69) / 12) for name, midi in {
    "C3": 48, "F3": 53, "G3": 55, "A3": 57, "C4": 60, "D4": 62, "E4": 64, "F4": 65,
    "G4": 67, "A4": 69, "B4": 71, "C5": 72,
}.items()}

# Brahms' Lullaby (Wiegenlied, 1868, public domain), simplified, in C major. (note, beats)
LULLABY_MELODY = [
    ("E4", 1), ("E4", 1), ("G4", 4), ("E4", 1), ("E4", 1), ("G4", 4),
    ("E4", 1), ("G4", 1), ("C5", 2), ("B4", 1), ("A4", 2), ("A4", 1), ("G4", 3),
    ("D4", 1), ("E4", 1), ("F4", 2), ("D4", 1), ("D4", 1), ("E4", 1), ("F4", 3),
    ("D4", 1), ("F4", 1), ("B4", 1), ("A4", 1), ("G4", 2), ("B4", 1), ("C5", 3),
    ("C4", 1), ("C4", 1), ("C5", 4), ("A4", 1), ("F4", 1), ("G4", 4),
    ("E4", 1), ("C4", 1), ("F4", 1), ("G4", 1), ("A4", 2), ("G4", 4),
    ("C4", 1), ("C4", 1), ("C5", 4), ("A4", 1), ("F4", 1), ("G4", 4),
    ("E4", 1), ("C4", 1), ("F4", 1), ("E4", 1), ("D4", 1), ("C4", 6),
]
# One bass note per phrase, roughly following the harmony.
LULLABY_BASS = ["C3", "C3", "C3", "G3", "G3", "C3", "F3", "C3", "F3", "G3", "C3"]


def music_box(freq: float, seconds: float = 3.5) -> np.ndarray:
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = (
        np.sin(2 * np.pi * freq * t) * np.exp(-t / 1.1)
        + 0.35 * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t / 0.5)
        + 0.12 * np.sin(2 * np.pi * freq * 3.98 * t) * np.exp(-t / 0.2)
    )
    return tone * np.minimum(1, t / 0.003)


def soft_bass(freq: float, seconds: float) -> np.ndarray:
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(2 * np.pi * 2 * freq * t)
    return tone * envelope(n, 0.4, seconds / 2.5)


LULLABY_BPM = 75


def sound_lullaby(rng, n):
    """Brahms' Lullaby on a music box over a warm bass, laid out as an exact circle.

    The loop is two full passes at a slow 75 BPM (about 2 minutes 20 seconds), so its length
    comes from the music rather than from `n`."""
    beats = sum(b for _, b in LULLABY_MELODY)
    repeats = 2
    beat = 60 / LULLABY_BPM
    n = int(round(beats * repeats * beat * SR))
    melody = np.zeros(n)
    bass = np.zeros(n)
    cursor = 0.0
    for rep in range(repeats):
        phrase = 0
        beat_in_phrase = 0.0
        place_wrap(bass, soft_bass(NOTE[LULLABY_BASS[0]], beat * 8), int(cursor * SR))
        for index, (name, length) in enumerate(LULLABY_MELODY):
            gain = 0.75 + 0.25 * rng.random()
            # Tiny timing variation so it doesn't sound mechanical.
            jitter = rng.uniform(-0.012, 0.012)
            place_wrap(melody, music_box(NOTE[name]) * gain, int((cursor + jitter) * SR) % n)
            cursor += length * beat
            beat_in_phrase += length
            if beat_in_phrase >= 9 and index < len(LULLABY_MELODY) - 1:
                phrase += 1
                beat_in_phrase = 0.0
                root = LULLABY_BASS[min(phrase, len(LULLABY_BASS) - 1)]
                place_wrap(bass, soft_bass(NOTE[root], beat * 8), int(cursor * SR) % n)
    mix = melody / np.max(np.abs(melody)) + 0.35 * bass / np.max(np.abs(bass))
    left = circular_reverb(mix, rng, 2.8, 0.4)
    right = circular_reverb(mix, rng, 2.8, 0.4)
    return np.stack([left, right], axis=1)


def sound_fire(rng, n):
    def mono(r, k):
        roar = lowpass(brown(r, k), 350) * (0.8 + 0.2 * smooth_noise(r, k, 0.3))
        roar = roar / (np.sqrt(np.mean(roar ** 2)) + 1e-9)
        crackle = np.zeros(k)
        for start in r.integers(0, k, int(k / SR * 9)):
            burst = r.integers(1, 6)
            for j in range(burst):
                length = int(SR * r.uniform(0.003, 0.012))
                click = white(r, length) * np.exp(-np.arange(length) / (length / 4))
                place(crackle, click * r.uniform(0.3, 1.0), int(start + j * SR * r.uniform(0.005, 0.04)))
        pops = np.zeros(k)
        for start in r.integers(0, k, int(k / SR * 0.6)):
            length = int(SR * 0.05)
            pop = white(r, length) * np.exp(-np.arange(length) / (length / 6))
            place(pops, pop * 3, int(start))
        return 0.9 * roar + 0.35 * bandpass(crackle, 900, 5000) + 0.5 * bandpass(pops, 250, 3000)
    return stereo(rng, mono, n, 0.5)


def sound_fan(rng, n):
    def mono(r, k):
        air = lowpass(0.5 * pink(r, k) + brown(r, k) / 25, 1800)
        return air
    out = stereo(rng, mono, n, 0.3)
    t = np.arange(n) / SR
    hum = 0.02 * np.sin(2 * np.pi * 59.7 * t) + 0.01 * np.sin(2 * np.pi * 119.4 * t)
    blade = 1 + 0.03 * np.sin(2 * np.pi * 11.5 * t)
    out = out / (np.sqrt(np.mean(out ** 2)) + 1e-9) * 0.1
    return out * blade[:, None] + hum[:, None]


def sound_brown_noise(rng, n):
    return stereo(rng, lambda r, k: lowpass(brown(r, k), 900), n, 0.6)


def drone(n: int, seconds_per_cycle: float, rng=None) -> np.ndarray:
    """Warm drifting chord in A major. LFO rates are whole cycles per loop, so it loops cleanly."""
    t = np.arange(n) / SR
    length = n / SR
    # Round each pitch to a whole number of cycles per file, so the end joins the start cleanly.
    notes = [round(f * length) / length for f in (110.0, 164.81, 220.0, 277.18, 329.63, 440.0)]
    left = np.zeros(n)
    right = np.zeros(n)
    for i, f in enumerate(notes):
        cycles = 1 + (i * 3) % 5
        lfo = 0.55 + 0.45 * np.sin(2 * np.pi * cycles * t / seconds_per_cycle + i)
        amp = 1.0 / (1 + i * 0.6)
        for detune, side in ((-36 / length, left), (36 / length, right)):
            tone = np.sin(2 * np.pi * (f + detune) * t) + 0.25 * np.sin(2 * np.pi * 2 * (f + detune) * t)
            side += tone * lfo * amp
    # Filter the signal as a circle (run through it twice, keep the second pass) so the filter's
    # start-up doesn't create a click where the file loops.
    def circular_lowpass(x):
        return lowpass(np.concatenate([x, x]), 1500)[n:]

    return np.stack([circular_lowpass(left), circular_lowpass(right)], axis=1)


PENTATONIC = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0]  # D major pentatonic


def chime(freq: float, seconds: float = 5.0) -> np.ndarray:
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.zeros(n)
    for ratio, amp, decay in ((1.0, 1.0, 2.2), (2.76, 0.35, 1.0), (5.4, 0.12, 0.45)):
        tone += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / decay)
    return tone * np.minimum(1, t / 0.004)


def sound_bells(rng, n):
    """Slow, sparse wind chimes and the occasional low singing bowl, with a long soft reverb."""
    left = np.zeros(n)
    right = np.zeros(n)
    t = 0.0
    while t < n / SR:
        freq = PENTATONIC[rng.integers(len(PENTATONIC))]
        strike = chime(freq) * rng.uniform(0.35, 0.8)
        pan = rng.uniform(0.2, 0.8)
        place_wrap(left, strike * (1 - pan), int(t * SR))
        place_wrap(right, strike * pan, int(t * SR))
        t += rng.uniform(1.4, 4.5)
    for start in np.arange(0, n / SR, 20.0):
        bowl = bell(14.0, rng.choice([146.83, 196.0])) * 0.55
        offset = int((start + rng.uniform(0, 6)) * SR)
        place_wrap(left, bowl, offset)
        place_wrap(right, bowl, offset)
    left = circular_reverb(left, rng, 3.5, 0.45)
    right = circular_reverb(right, rng, 3.5, 0.45)
    return np.stack([left, right], axis=1)


def circular_filter(x: np.ndarray, fn) -> np.ndarray:
    """Runs a filter over the signal twice and keeps the second pass, so a looping file has no
    click where the end joins the start."""
    n = len(x)
    return fn(np.concatenate([x, x]))[n:]


def loop_curve(n: int, cycles: list[tuple[int, float]], phase: float = 0.0) -> np.ndarray:
    """A slow 0..1 curve made of sine waves with whole cycles per file, so it loops cleanly."""
    t = np.arange(n) / n
    curve = sum(weight * np.sin(2 * np.pi * count * t + phase * count) for count, weight in cycles)
    total = sum(weight for _, weight in cycles)
    return 0.5 + 0.5 * curve / total


CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]  # C major pentatonic, like a tuned chime set


def wind_chime(freq: float, seconds: float = 7.0) -> np.ndarray:
    """One metal tube: the inharmonic partials of a free bar, a light strike and a long ring."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.zeros(n)
    for ratio, amp, decay in ((1.0, 1.0, 3.2), (2.76, 0.4, 1.5), (5.40, 0.15, 0.7), (8.93, 0.05, 0.3)):
        shimmer = 1 + 0.03 * np.sin(2 * np.pi * 4.5 * t * ratio)
        tone += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / decay) * shimmer
    return tone * np.minimum(1, t / 0.002)


def sound_chimes(rng, n):
    """Wind chimes on a gentle breeze. The breeze rises and falls, and the chimes ring in small
    clusters when it gusts. Built as an exact circle, so it loops without a crossfade."""
    gust = loop_curve(n, [(3, 1.0), (7, 0.5), (11, 0.25)], phase=rng.uniform(0, 6))
    breeze = stereo(rng, lambda r, k: pink(r, k), n, 0.6)
    for side in range(2):
        breeze[:, side] = circular_filter(breeze[:, side], lambda x: bandpass(x, 150, 1100))
    breeze = breeze / (np.sqrt(np.mean(breeze ** 2)) + 1e-9) * 0.03 * (0.4 + 0.6 * gust)[:, None]

    left = np.zeros(n)
    right = np.zeros(n)
    t = rng.uniform(0, 2)
    while t < n / SR:
        strength = gust[int(t * SR) % n]
        for _ in range(int(rng.integers(1, 2 + int(4 * strength)))):
            note = wind_chime(CHIME_NOTES[rng.integers(len(CHIME_NOTES))]) * rng.uniform(0.25, 0.6 + 0.4 * strength)
            pan = rng.uniform(0.25, 0.75)
            place_wrap(left, note * (1 - pan), int(t * SR) % n)
            place_wrap(right, note * pan, int(t * SR) % n)
            t += rng.uniform(0.12, 0.5)
        t += rng.uniform(1.5, 6.0) * (1.3 - strength)
    left = circular_reverb(left, rng, 2.5, 0.35)
    right = circular_reverb(right, rng, 2.5, 0.35)
    chimes = np.stack([left, right], axis=1)
    chimes = chimes / (np.max(np.abs(chimes)) + 1e-9)
    return chimes + breeze


HEART_BPM = 60


def heart_thump(freq: float, decay: float) -> np.ndarray:
    """One heart sound: a low, quickly falling thud."""
    n = int(SR * 0.4)
    t = np.arange(n) / SR
    pitch = freq * (1 + 0.6 * np.exp(-t / 0.02))
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    tone = np.sin(phase) + 0.45 * np.sin(2 * phase) + 0.15 * np.sin(3 * phase)
    return tone * np.minimum(1, t / 0.004) * np.exp(-t / decay)


def sound_heartbeat(rng, n):
    """A slow, steady heartbeat at 60 BPM, as heard from inside: a deep "lub", a softer "dub",
    and a warm whoosh that swells with each beat. The loop holds a whole number of beats."""
    beat = 60 / HEART_BPM
    beats = int(round(n / SR / beat))
    n = int(round(beats * beat * SR))
    pulse = np.zeros(n)
    for i in range(beats):
        start = i * beat + rng.uniform(-0.008, 0.008)
        gain = rng.uniform(0.9, 1.0)
        place_wrap(pulse, heart_thump(58, 0.07) * gain, int(start * SR) % n)
        place_wrap(pulse, heart_thump(72, 0.05) * 0.6 * gain, int((start + 0.3) * SR) % n)
    pulse = circular_filter(pulse, lambda x: lowpass(x, 400))
    pulse = pulse / (np.max(np.abs(pulse)) + 1e-9)

    t = np.arange(n) / SR
    swell = 0.55 + 0.45 * np.cos(2 * np.pi * (t - 0.1) / beat) ** 2
    whoosh = circular_filter(brown(rng, n), lambda x: lowpass(x, 300))
    whoosh = whoosh / (np.sqrt(np.mean(whoosh ** 2)) + 1e-9) * 0.08 * swell
    mono = pulse + whoosh
    return np.stack([mono, mono], axis=1)


def note_freq(name: str) -> float:
    """Converts a note name such as "C4" or "F#3" to its frequency in Hz."""
    steps = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    semitone = steps[name[0]] + (1 if "#" in name else 0)
    octave = int(name[-1])
    return 440.0 * 2 ** ((12 * (octave + 1) + semitone - 69) / 12)


def guitar_pluck(freq: float, seconds: float = 4.0, pluck_point: float = 0.2) -> np.ndarray:
    """A nylon-string pluck: harmonics shaped by where the string is plucked, with the higher
    harmonics fading faster, plus a slight string stiffness."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.zeros(n)
    for k in range(1, 24):
        f = k * freq * np.sqrt(1 + 0.00008 * k * k)
        if f > 7000:
            break
        amp = abs(np.sin(np.pi * k * pluck_point)) / k ** 1.4
        decay = 2.8 / (1 + 0.35 * (k - 1))
        tone += amp * np.sin(2 * np.pi * f * t) * np.exp(-t / decay)
    return tone * np.minimum(1, t / 0.003) / (np.max(np.abs(tone)) + 1e-9)


# Fingerpicked chords in 3/4: bass, then the three upper notes up and back down.
GUITAR_CHORDS = {
    "C": ["C3", "G3", "C4", "E4"],
    "Am": ["A2", "E3", "A3", "C4"],
    "F": ["F2", "C3", "F3", "A3"],
    "G": ["G2", "D3", "G3", "B3"],
    "Em": ["E2", "B2", "E3", "G3"],
}
# One bar each: the chord, then two melody notes on beats 1 and 3. An original tune.
GUITAR_TUNE = [
    ("C", "E5", "G4"), ("Am", "C5", "E5"), ("F", "A4", "C5"), ("G", "B4", "D5"),
    ("C", "C5", "E5"), ("Em", "B4", "G4"), ("F", "A4", "F4"), ("G", "G4", "B4"),
    ("Am", "A4", "C5"), ("Em", "G4", "B4"), ("F", "F4", "A4"), ("C", "E4", "G4"),
    ("F", "A4", "C5"), ("G", "B4", "D5"), ("C", "C5", "G4"), ("C", "E4", "C4"),
]
GUITAR_BPM = 66


def sound_guitar(rng, n):
    """A soft fingerpicked guitar lullaby in 3/4, played three times through, laid out as an exact
    circle. The loop length comes from the music rather than from `n`."""
    eighth = 60 / GUITAR_BPM / 2
    repeats = 3
    n = int(round(len(GUITAR_TUNE) * 6 * eighth * repeats * SR))
    left = np.zeros(n)
    right = np.zeros(n)
    pattern = [0, 1, 2, 3, 2, 1]
    bar_start = 0.0
    for _ in range(repeats):
        for chord, first, second in GUITAR_TUNE:
            notes = GUITAR_CHORDS[chord]
            for step, string in enumerate(pattern):
                at = bar_start + step * eighth + rng.uniform(-0.01, 0.01)
                gain = (0.55 if string == 0 else 0.32) * rng.uniform(0.85, 1.0)
                pluck = guitar_pluck(note_freq(notes[string]), pluck_point=0.22) * gain
                pan = 0.4 + 0.06 * string
                place_wrap(left, pluck * (1 - pan), int(at * SR) % n)
                place_wrap(right, pluck * pan, int(at * SR) % n)
            for beat_eighth, name in ((0, first), (4, second)):
                at = bar_start + beat_eighth * eighth + 0.02 + rng.uniform(-0.01, 0.01)
                pluck = guitar_pluck(note_freq(name), 5.0, pluck_point=0.15) * 0.6 * rng.uniform(0.9, 1.0)
                place_wrap(left, pluck * 0.45, int(at * SR) % n)
                place_wrap(right, pluck * 0.55, int(at * SR) % n)
            bar_start += 6 * eighth
    left = circular_filter(left, lambda x: lowpass(x, 5000))
    right = circular_filter(right, lambda x: lowpass(x, 5000))
    left = circular_reverb(left, rng, 2.2, 0.3)
    right = circular_reverb(right, rng, 2.2, 0.3)
    return np.stack([left, right], axis=1)


def sound_car(rng, n):
    """A car ride: the deep rumble of tires on a highway, a soft engine hum, and now and then the
    gentle "ba-dum" of the wheels crossing a seam in the road. Kept dark and steady for naps."""
    t = np.arange(n) / SR

    def road(r, k):
        rumble = lowpass(brown(r, k), 180)
        rumble = rumble / (np.sqrt(np.mean(rumble ** 2)) + 1e-9)
        tires = bandpass(pink(r, k), 250, 1000)
        tires = tires / (np.sqrt(np.mean(tires ** 2)) + 1e-9)
        drift = 0.85 + 0.15 * smooth_noise(r, k, 0.05)
        return (rumble + 0.25 * tires) * drift

    out = stereo(rng, road, n, 0.4)
    out = out / (np.sqrt(np.mean(out ** 2)) + 1e-9)

    # Engine: a low hum whose pitch wanders a little, as the speed changes.
    wander = 1 + 0.02 * (smooth_noise(rng, n, 0.03) - 0.5)
    phase = 2 * np.pi * np.cumsum(55.0 * wander) / SR
    engine = np.sin(phase) + 0.5 * np.sin(2 * phase) + 0.2 * np.sin(3 * phase)
    out += 0.12 * engine[:, None]

    # Road seams: front wheels, then back wheels a moment later.
    bumps = np.zeros(n)
    length = int(SR * 0.18)
    bt = np.arange(length) / SR
    thump = np.sin(2 * np.pi * 70 * bt) * np.exp(-bt / 0.04) * np.minimum(1, bt / 0.004)
    at = rng.uniform(2, 6)
    while at < n / SR - 1:
        gain = rng.uniform(0.5, 1.0)
        place(bumps, thump * gain, int(at * SR))
        place(bumps, thump * gain * 0.8, int((at + rng.uniform(0.11, 0.14)) * SR))
        at += rng.uniform(5, 14)
    out += 0.6 * bumps[:, None]
    return np.stack([lowpass(out[:, 0], 1500), lowpass(out[:, 1], 1500)], axis=1)


SHUSH_PERIOD = 3.6  # seconds per "shhhh" and the breath in before the next one
SHUSH_SECONDS = 3.0


def shush_breath(rng, seconds: float) -> np.ndarray:
    """One long "shhhh". Real /sh/ is breath noise with a broad peak, here near 2.5 kHz for a soft,
    rounded-lip sound, and very little below 1 kHz. The peak drifts down a little as the breath runs out, and the loudness rises
    and falls slowly with a slight flutter, so it sounds like a person and not a rattle."""
    nper, hop = 2048, 512
    n = int(SR * seconds)
    frames = n // hop + 2
    f = np.fft.rfftfreq(nper, 1 / SR)
    t = np.arange(frames) * hop / SR
    peak = 2500 - 400 * np.clip(t / seconds, 0, 1)
    logf = np.log2(np.maximum(f, 20))[:, None]
    shape = np.exp(-0.5 * ((logf - np.log2(peak)[None, :]) / 0.55) ** 2)
    shape *= np.clip((f[:, None] - 650) / 1100, 0, 1)
    spectrum = shape * np.exp(2j * np.pi * rng.random(shape.shape))
    _, x = signal.istft(spectrum, SR, nperseg=nper, noverlap=nper - hop)
    x = np.real(x[:n])
    tt = np.arange(len(x)) / SR
    rise = 0.5 - 0.5 * np.cos(np.pi * np.clip(tt / 0.6, 0, 1))
    fall = 0.5 - 0.5 * np.cos(np.pi * np.clip((seconds - tt) / 1.2, 0, 1))
    flutter = 1 + 0.05 * np.sin(2 * np.pi * rng.uniform(4, 6) * tt + rng.uniform(0, 6))
    return x * rise * fall * flutter


def sound_shush(rng, n):
    """A soft, steady "shhhh... shhhh..." like a parent settling a child, over a faint low
    whoosh, with a little room echo. The loop holds a whole number of shushes."""
    count = int(round(n / SR / SHUSH_PERIOD))
    n = int(round(count * SHUSH_PERIOD * SR))
    voice = np.zeros(n)
    for i in range(count):
        breath = shush_breath(rng, SHUSH_SECONDS * rng.uniform(0.95, 1.0)) * rng.uniform(0.85, 1.0)
        place_wrap(voice, breath, int((i * SHUSH_PERIOD + rng.uniform(-0.05, 0.05)) * SR) % n)
    voice = voice / (np.sqrt(np.mean(voice ** 2)) + 1e-9)
    voice = circular_reverb(voice, rng, 0.5, 0.15)
    voice = voice / (np.sqrt(np.mean(voice ** 2)) + 1e-9)
    bed = circular_filter(pink(rng, n), lambda x: lowpass(x, 400))
    bed = bed / (np.sqrt(np.mean(bed ** 2)) + 1e-9)
    mono = voice + 0.12 * bed
    return np.stack([mono, mono], axis=1)


def whole_cycles(freq: float, n: int) -> float:
    """Rounds a frequency to a whole number of cycles per file, so the end joins the start cleanly."""
    length = n / SR
    return round(freq * length) / length


def binaural(rng, n, carrier: float, beat: float) -> np.ndarray:
    """A binaural beat: one tone in the left ear and a slightly higher one in the right. Heard on
    headphones, the difference is a slow pulse at the beat frequency. A soft pink-noise bed and a
    slow swell keep it from sounding like a test tone."""
    t = np.arange(n) / SR
    low = whole_cycles(carrier, n)
    high = whole_cycles(carrier + beat, n)
    swell = 0.8 + 0.2 * loop_curve(n, [(3, 1.0), (7, 0.5)])
    left = np.sin(2 * np.pi * low * t) + 0.15 * np.sin(2 * np.pi * 2 * low * t)
    right = np.sin(2 * np.pi * high * t) + 0.15 * np.sin(2 * np.pi * 2 * high * t)
    bed = circular_filter(pink(rng, n), lambda x: lowpass(x, 600))
    bed = 0.18 * bed / (np.sqrt(np.mean(bed ** 2)) + 1e-9) * np.sqrt(0.5)
    return np.stack([left * swell + bed, right * swell + bed], axis=1)


def sound_delta(rng, n):
    return binaural(rng, n, 100.0, 2.0)


def sound_theta(rng, n):
    return binaural(rng, n, 180.0, 6.0)


def sound_alpha(rng, n):
    return binaural(rng, n, 220.0, 10.0)


def sound_om(rng, n):
    """A low, breathing drone on one note, like a long chanted om."""
    t = np.arange(n) / SR
    base = whole_cycles(136.1, n)
    breath = 0.35 + 0.65 * loop_curve(n, [(12, 1.0), (5, 0.3)])
    sides = []
    for detune in (-0.15, 0.15):
        f = whole_cycles(base + detune, n)
        tone = np.zeros(n)
        for harmonic, amp in ((1, 1.0), (2, 0.55), (3, 0.3), (4, 0.18), (5, 0.08)):
            tone += amp * np.sin(2 * np.pi * f * harmonic * t)
        sides.append(circular_filter(tone * breath, lambda x: lowpass(x, 1200)))
    return np.stack(sides, axis=1)


BOWL_NOTES = [130.81, 146.83, 174.61, 196.0, 220.0]  # C, D, F, G, A


def sound_bowls(rng, n):
    """Singing bowls struck one at a time, each left to ring out, with a long soft reverb."""
    left = np.zeros(n)
    right = np.zeros(n)
    t = 0.0
    while t < n / SR:
        strike = bell(16.0, BOWL_NOTES[rng.integers(len(BOWL_NOTES))]) * rng.uniform(0.55, 0.9)
        pan = rng.uniform(0.3, 0.7)
        place_wrap(left, strike * (1 - pan), int(t * SR))
        place_wrap(right, strike * pan, int(t * SR))
        t += rng.uniform(7.0, 11.0)
    left = circular_reverb(left, rng, 4.0, 0.4)
    right = circular_reverb(right, rng, 4.0, 0.4)
    return np.stack([left, right], axis=1)


def sound_white_noise(rng, n):
    """Even white noise with the harshest top end rounded off, so it hisses less."""
    return stereo(rng, lambda r, k: lowpass(white(r, k), 9000, 1), n, 0.8)


def sound_green_noise(rng, n):
    """Green noise: the middle of the spectrum, around 500 Hz, with the deep rumble and the hiss
    rolled away. It sounds like distant, steady water."""
    return stereo(rng, lambda r, k: bandpass(pink(r, k), 180, 1800, 1), n, 0.7)


def bird_note(rng, seconds: float, f0: float, f1: float, bend: float = 0.0, warble: float = 0.0,
              warble_rate: float = 40.0) -> np.ndarray:
    """One bird note: a pure whistle that glides from f0 to f1 on a curve, bowing up or down by
    `bend` Hz in the middle. A little random pitch wobble keeps it from sounding like a machine,
    and `warble` adds the fast flutter many songbirds have. Quick to start, slower to fade."""
    k = int(SR * seconds)
    u = np.linspace(0, 1, k)
    curve = rng.uniform(0.5, 2.0)
    freq = f0 * (f1 / f0) ** (u ** curve) + bend * np.sin(np.pi * u)
    wobble = smooth_noise(rng, k, 18.0) - 0.5
    freq = freq * (1 + 0.03 * wobble)
    if warble:
        freq = freq + warble * np.sin(2 * np.pi * warble_rate * u * seconds + rng.uniform(0, 6.3))
    phase = 2 * np.pi * np.cumsum(freq) / SR
    tone = np.sin(phase) + 0.05 * np.sin(2 * phase)
    attack = rng.uniform(0.08, 0.25)
    shape = np.where(u < attack, np.sin(np.pi / 2 * u / attack) ** 2, np.clip(np.cos(np.pi / 2 * (u - attack) / (1 - attack)), 0, 1) ** 1.2)
    return tone * shape * (0.85 + 0.15 * np.sin(2 * np.pi * rng.uniform(20, 35) * u * seconds))


def bird_song(rng, notes) -> np.ndarray:
    """Strings notes together: (seconds, f0, f1, bend, warble, gap after)."""
    parts = []
    for seconds, f0, f1, bend, warble, gap in notes:
        parts.append(bird_note(rng, seconds, f0, f1, bend, warble))
        parts.append(np.zeros(int(SR * gap)))
    return np.concatenate(parts)


def song_whistler(rng, pitch):
    """A clear phrase of three to seven whistled notes that wanders up and down, like a robin,
    sometimes with a quick chip note between them."""
    notes = []
    f = pitch * rng.uniform(0.9, 1.1)
    for _ in range(int(rng.integers(3, 8))):
        f = float(np.clip(f * rng.uniform(0.82, 1.2), pitch * 0.75, pitch * 1.4))
        if rng.random() < 0.25:
            notes.append((rng.uniform(0.025, 0.045), f * 1.6, f * 0.9, 0, 0, rng.uniform(0.03, 0.07)))
            continue
        shape = rng.choice(["up", "down", "arch", "flat"])
        f0, f1, bend = {"up": (f * 0.85, f * 1.1, 0), "down": (f * 1.15, f * 0.85, 0),
                        "arch": (f, f * 0.95, f * 0.12), "flat": (f, f * 1.02, 0)}[shape]
        notes.append((rng.uniform(0.07, 0.24), f0, f1, bend, rng.choice([0, 0, 0, 80, 150]), rng.uniform(0.03, 0.11)))
    return bird_song(rng, notes)


def song_trill(rng, pitch):
    """A soft trill: one quick falling chirp repeated a dozen or more times, slowing at the end."""
    notes = []
    count = int(rng.integers(10, 18))
    for i in range(count):
        notes.append((0.035, pitch * 1.2, pitch * 0.9, 0, 0, 0.03 + 0.03 * i / count))
    return bird_song(rng, notes)


def song_two_tone(rng, pitch):
    """A slow, sweet two-note call: a high held note, then a lower one."""
    return bird_song(rng, [
        (0.45, pitch * 1.25, pitch * 1.22, 0, 0, 0.12),
        (0.5, pitch * 1.0, pitch * 0.98, 0, 0, 0.0),
    ])


def song_dove(rng, pitch):
    """A distant dove: low, hollow coos in a soft rhythm."""
    notes = [(0.35, pitch * 0.95, pitch, pitch * 0.05, 0, 0.18),
             (0.7, pitch * 1.05, pitch * 0.9, pitch * 0.08, 0, 0.25),
             (0.4, pitch, pitch * 0.92, 0, 0, 0.2),
             (0.4, pitch, pitch * 0.9, 0, 0, 0.0)]
    song = bird_song(rng, notes)
    return lowpass(song, 1500)


# Each bird keeps its own voice, distance and place in the field, and repeats a few versions of its
# song with pauses, the way real birds do: (song, pitch Hz, gain, pan, pause range in seconds).
BIRDS = [
    (song_whistler, 2600, 0.9, 0.3, (4.0, 8.0)),
    (song_whistler, 3300, 0.45, 0.8, (6.0, 11.0)),
    (song_two_tone, 3800, 0.5, 0.6, (9.0, 15.0)),
    (song_trill, 4600, 0.3, 0.15, (10.0, 18.0)),
    (song_dove, 560, 0.55, 0.7, (12.0, 20.0)),
]


def sound_birdsong(rng, n):
    """Early morning birdsong: a few birds near and far, each with its own repeated song, over a
    faint, soft breeze. The far birds are quieter and duller."""
    left = np.zeros(n)
    right = np.zeros(n)
    for make, pitch, gain, pan, (lo, hi) in BIRDS:
        repertoire = [make(rng, pitch) for _ in range(3)]
        far = gain < 0.5
        t = rng.uniform(0, hi)
        while t < n / SR:
            song = repertoire[rng.integers(len(repertoire))] * gain * rng.uniform(0.8, 1.0)
            if far:
                song = lowpass(song, 3500 if pitch < 4000 else 6000)
            place_wrap(left, song * np.sqrt(1 - pan), int(t * SR))
            place_wrap(right, song * np.sqrt(pan), int(t * SR))
            t += len(song) / SR + rng.uniform(lo, hi)
    left = circular_reverb(left, rng, 1.6, 0.25)
    right = circular_reverb(right, rng, 1.6, 0.25)
    level = np.sqrt(np.mean(left ** 2) + np.mean(right ** 2))
    breeze = loop_curve(n, [(3, 1.0), (7, 0.5)])
    for side in (left, right):
        air = circular_filter(pink(rng, n), lambda x: bandpass(x, 150, 1200, 1))
        side += 0.35 * level * air / (np.std(air) + 1e-9) * (0.5 + 0.5 * breeze)
    return np.stack([left, right], axis=1)


def sound_leaves(rng, n):
    """Wind moving through a tree. Gusts come and go; in each gust thousands of dry leaf clicks
    brush past each other over a soft airy rustle, and between gusts it settles to near stillness."""
    gust = 0.03 + 0.97 * smooth_noise(rng, n, 0.15) ** 2.5
    gust = gust * (0.7 + 0.3 * smooth_noise(rng, n, 2.0))

    def mono(r, k):
        g = gust[:k]
        air = bandpass(white(r, k), 1500, 7000) * g ** 1.2
        # Leaf contacts: short noise bursts of a few lengths, much denser while a gust blows.
        grains = np.zeros(k)
        for ms in (1.5, 3.0, 6.0):
            hits = (r.random(k) < 1200 * g ** 2 / SR) * r.uniform(0.1, 1.0, k)
            size = int(SR * ms / 1000)
            kernel = r.standard_normal(size) * np.exp(-np.arange(size) / (size / 3))
            grains += signal.fftconvolve(hits, kernel)[:k]
        grains = bandpass(grains, 2000, 9000)
        return 0.35 * air / (np.std(air) + 1e-9) + grains / (np.std(grains) + 1e-9)

    out = stereo(rng, mono, n, 0.8)
    low = lowpass(brown(rng, n), 300)
    low = 0.15 * low / (np.std(low) + 1e-9) * gust
    return out + low[:, None]


PAD_CHORDS = [  # slow, open chords in D major: Dmaj9, Bm7, Gmaj7, Asus2
    [73.42, 146.83, 220.0, 277.18, 329.63],
    [61.74, 123.47, 185.0, 220.0, 293.66],
    [49.0, 98.0, 146.83, 185.0, 246.94],
    [55.0, 110.0, 164.81, 246.94, 329.63],
]


def pad_note(freq: float, seconds: float, n_total: int) -> np.ndarray:
    """One soft pad voice: a few gentle harmonics from two detuned oscillators, slow in and out."""
    k = int(SR * seconds)
    t = np.arange(k) / SR
    tone = np.zeros(k)
    for detune in (-0.25, 0.25):
        for h, amp in ((1, 1.0), (2, 0.35), (3, 0.12), (4, 0.05)):
            tone += amp * np.sin(2 * np.pi * (freq + detune) * h * t)
    attack, release = 3.0, 4.0
    shape = np.minimum(1, t / attack) * np.clip((seconds - t) / release, 0, 1)
    return tone * shape


def sound_chords(rng, n):
    """Calm chords: four open chords, each swelling in over a few seconds and fading into the
    next, under a wide, soft hall. No melody and no beat."""
    length = n / SR
    chord_seconds = length / 12
    left = np.zeros(n)
    right = np.zeros(n)
    for i in range(12):
        chord = PAD_CHORDS[i % len(PAD_CHORDS)]
        start = int(i * chord_seconds * SR)
        for j, freq in enumerate(chord):
            voice = pad_note(freq * rng.uniform(0.999, 1.001), chord_seconds + 4.0, n) * (1.0 if j else 0.8)
            pan = 0.5 + 0.25 * (j - 2) / 2
            place_wrap(left, voice * np.sqrt(1 - pan), start)
            place_wrap(right, voice * np.sqrt(pan), start)
    left = circular_filter(left, lambda x: lowpass(x, 2500))
    right = circular_filter(right, lambda x: lowpass(x, 2500))
    return np.stack([circular_reverb(left, rng, 4.0, 0.4), circular_reverb(right, rng, 4.0, 0.4)], axis=1)


def hum_bed(n: int, gain: float) -> np.ndarray:
    """A faint low D under the instruments, so their rests never feel empty."""
    t = np.arange(n) / SR
    return gain * (np.sin(2 * np.pi * whole_cycles(73.42, n) * t) + 0.5 * np.sin(2 * np.pi * whole_cycles(110.0, n) * t))


def instrument_loop(rng, n, play_phrase, reverb_seconds: float, hum: float) -> np.ndarray:
    """Places phrases around the loop with rests between them, wraps the last one into the start,
    then adds a soft hall and the low hum. Left and right get slightly different halls."""
    dry = np.zeros(n)
    at = rng.uniform(0.5, 2.0)
    while at < n / SR - 6:
        at = play_phrase(dry, at)
        at += rng.uniform(4.0, 7.0)
    dry = dry / (np.sqrt(np.mean(dry ** 2)) + 1e-9)
    bed = hum_bed(n, hum)
    return np.stack([circular_reverb(dry, rng, reverb_seconds, 0.35) + bed,
                     circular_reverb(dry, rng, reverb_seconds, 0.35) + bed], axis=1)


def sound_flute(rng, n):
    """A pan flute playing slow, simple phrases in D major pentatonic, mostly step by step."""
    state = {"index": 3}

    def phrase(dry, at):
        for _ in range(int(rng.integers(3, 6))):
            state["index"] = int(np.clip(state["index"] + rng.choice([-2, -1, -1, 1, 1, 2]), 0, len(FLUTE_NOTES) - 1))
            length = rng.uniform(1.6, 3.0)
            place_wrap(dry, pan_flute(rng, FLUTE_NOTES[state["index"]], length) * rng.uniform(0.7, 1.0), int(at * SR))
            at += length + rng.uniform(0.05, 0.3)
        return at

    return instrument_loop(rng, n, phrase, 2.8, 0.1)


def sound_piano(rng, n):
    """Soft felt piano: short connected phrases about a second per note, ending on a quiet
    two-note chord, then a rest."""
    state = {"index": 4}

    def phrase(dry, at):
        for note in range(int(rng.integers(4, 8))):
            state["index"] = int(np.clip(state["index"] + rng.choice([-2, -1, -1, 1, 1, 2]), 0, len(PIANO_NOTES) - 1))
            gain = rng.uniform(0.45, 0.75) * (0.8 if note else 1.0)
            place_wrap(dry, piano_note(PIANO_NOTES[state["index"]]) * gain, int(at * SR))
            at += rng.uniform(0.9, 1.5)
        place_wrap(dry, piano_note(PIANO_NOTES[max(state["index"] - 2, 0)]) * 0.4, int(at * SR))
        place_wrap(dry, piano_note(PIANO_NOTES[state["index"]]) * 0.35, int(at * SR))
        return at + 1.0

    return instrument_loop(rng, n, phrase, 2.5, 0.12)


def breath_cue(freq: float, seconds: float, gain: float) -> np.ndarray:
    """A short, soft tone for the breathing pacer, faded in and out so it never clicks."""
    n = int(SR * seconds)
    tone = chime(freq, seconds)[:n]
    fade = np.minimum(1, np.arange(n)[::-1] / (SR * 0.3))
    return tone * fade * gain


CUES = {
    "in": lambda: breath_cue(392.0, 1.6, 0.5),
    "hold": lambda: breath_cue(587.33, 0.8, 0.25),
    "out": lambda: breath_cue(293.66, 1.8, 0.5),
}
OUT_CUES = ROOT / "assets" / "audio" / "cues"


def generate_cues() -> None:
    print("Breathing cues")
    for cid, make in CUES.items():
        mono = make()
        mono = mono / (np.max(np.abs(mono)) + 1e-9) * 10 ** (-6 / 20)
        encode(np.stack([mono, mono], axis=1), OUT_CUES / f"{cid}.m4a", 96000)


SOUNDS = {
    "rain": sound_rain,
    "chimes": sound_chimes,
    "ocean": sound_ocean,
    "lullaby": sound_lullaby,
    "heartbeat": sound_heartbeat,
    "fire": sound_fire,
    "guitar": sound_guitar,
    "fan": sound_fan,
    "brown-noise": sound_brown_noise,
    "bells": sound_bells,
    "car": sound_car,
    "shush": sound_shush,
    "delta": sound_delta,
    "theta": sound_theta,
    "alpha": sound_alpha,
    "om": sound_om,
    "bowls": sound_bowls,
    "white-noise": sound_white_noise,
    "green-noise": sound_green_noise,
    "birdsong": sound_birdsong,
    "leaves": sound_leaves,
    "chords": sound_chords,
    "flute": sound_flute,
    "piano": sound_piano,
}

# Sounds built as exact circles (no crossfade needed): their notes and reverb wrap around.
CIRCULAR_SOUNDS = {"lullaby", "bells", "chimes", "heartbeat", "guitar", "shush", "delta", "theta", "alpha", "om", "bowls", "birdsong", "chords", "flute", "piano"}

# Per-sound loudness, so the set feels consistent when switching between them.
SOUND_LEVEL_DB = {"rain": -29, "lullaby": -23, "bells": -24, "chimes": -25, "heartbeat": -22, "guitar": -23, "fan": -21, "car": -26, "shush": -29,
                  "delta": -24, "theta": -25, "alpha": -25, "om": -23, "bowls": -24, 
                  "white-noise": -30, "green-noise": -27, "birdsong": -27, "leaves": -29, "chords": -25, "flute": -25, "piano": -24}


def generate_sounds(only: list[str]) -> None:
    print("Soundscapes")
    loop = SR * LOOP_SECONDS
    for index, item in enumerate(CATALOG["soundscapes"]):
        sid = item["id"]
        if only and sid not in only:
            continue
        rng = np.random.default_rng(1000 + index)
        if sid in CIRCULAR_SOUNDS:
            audio = SOUNDS[sid](rng, loop)
        else:
            audio = make_loop(SOUNDS[sid](rng, loop + SR * CROSSFADE_SECONDS), loop)
        audio = normalize(audio, SOUND_LEVEL_DB.get(sid, -20))
        encode(audio, OUT_SOUNDS / f"{sid}.m4a", 128000)


# ---------------------------------------------------------------------------
# Meditations
# ---------------------------------------------------------------------------

LEAD_IN = 5.0   # bell, then the voice begins
TAIL = 12.0     # closing bell and fade out
FLEX_MIN = 0.6  # shortest pause between lines
LONG_PAUSE = 8.0  # timed pauses this long are silent practice time, and can shrink to make a script fit
LONG_PAUSE_MIN_SCALE = 0.4  # ...down to 40%. Shorter timed pauses, such as a count of four, never change.


def parse_scripts() -> dict[str, tuple[str, list[tuple[str, object]]]]:
    """Reads content/meditations.txt into {id: (background bed, [(kind, value), ...])}."""
    scripts: dict[str, tuple[str, list[tuple[str, object]]]] = {}
    items: list[tuple[str, object]] = []
    for raw in SCRIPTS.read_text().splitlines():
        line = raw.strip()
        if not line or (line.startswith("#") and not line.startswith("##")):
            continue
        if line.startswith("## "):
            parts = line[3:].split()
            mid, bed = parts[0], (parts[1] if len(parts) > 1 else "warm")
            if bed not in BEDS:
                raise SystemExit(f"{mid}: unknown background bed {bed!r}. Use one of: {', '.join(BEDS)}")
            items = []
            scripts[mid] = (bed, items)
        elif line == "~":
            items.append(("flex", 3.0))
        elif re.fullmatch(r"\[\d+(\.\d+)?\]", line):
            items.append(("fixed", float(line[1:-1])))
        else:
            items.append(("say", line))
            items.append(("flex", 1.0))
    return scripts


_voice = None
_voice_id = None


def load_qwen(name: str):
    import torch
    from qwen_tts import Qwen3TTSModel

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    return Qwen3TTSModel.from_pretrained(name, device_map=device, dtype=torch.bfloat16, attn_implementation="sdpa")


def design_voice() -> None:
    """Creates the narrator's reference clip from VOICE_DESCRIPTION. Run this only to change her voice: every
    cached sentence depends on the clip, so the cache is cleared too."""
    import torch

    print("Voice")
    torch.manual_seed(NARRATOR_SEED)
    wavs, rate = load_qwen(VOICE_DESIGN_MODEL).generate_voice_design(
        text=NARRATOR_REF_TEXT, instruct=VOICE_DESCRIPTION, language=VOICE_LANG
    )
    sf.write(NARRATOR_REF, wavs[0], rate)
    for cached in TTS_CACHE.glob("*.npy"):
        cached.unlink()
    print(f"  wrote {NARRATOR_REF.relative_to(ROOT)}")


def speak(text: str) -> np.ndarray:
    """Speaks one line, sentence by sentence, with a short pause between sentences."""
    sentences = [part for part in re.split(r"(?<=[.!?])\s+", text.strip()) if part]
    gap = np.zeros(int(SR * SENTENCE_GAP))
    pieces: list[np.ndarray] = []
    for index, sentence in enumerate(sentences):
        if index:
            pieces.append(gap)
        pieces.append(speak_sentence(sentence))
    return np.concatenate(pieces)


def speak_sentence(text: str) -> np.ndarray:
    """Speaks one sentence in the narrator's voice at VOICE_TEMPO."""
    return tighten(say_sentence(text), VOICE_TEMPO)


def tighten(audio: np.ndarray, tempo: float) -> np.ndarray:
    """Speeds up speech without changing its pitch (WSOLA, which suits a single voice)."""
    if tempo == 1.0:
        return audio
    from audiotsm import wsola
    from audiotsm.io.array import ArrayReader, ArrayWriter

    # WSOLA loses a little audio at each end, so pad with silence first and trim it off again after.
    pad = np.zeros(int(0.2 * SR))
    writer = ArrayWriter(channels=1)
    padded = np.concatenate([pad, audio, pad])[np.newaxis, :].astype(np.float32)
    wsola(channels=1, speed=tempo).run(ArrayReader(padded), writer)
    out = writer.data[0].astype(np.float64)
    loud = np.flatnonzero(np.abs(out) > 0.01)
    return out[max(0, loud[0] - int(0.03 * SR)) : loud[-1] + int(0.08 * SR)] if len(loud) else out


def say_sentence(text: str) -> np.ndarray:
    """Speaks one sentence in the narrator's voice, resampled to 44.1 kHz. Results are cached by voice and text."""
    global _voice, _voice_id
    if _voice_id is None:
        _voice_id = hashlib.sha1(NARRATOR_REF.read_bytes()).hexdigest()
    key = hashlib.sha1(f"{VOICE_MODEL}|{_voice_id}|{text}".encode()).hexdigest()
    cached = TTS_CACHE / f"{key}.npy"
    if cached.exists():
        return np.load(cached)
    import torch

    if _voice is None:
        model = load_qwen(VOICE_MODEL)
        ref, ref_rate = sf.read(NARRATOR_REF)
        _voice = (model, model.create_voice_clone_prompt(ref_audio=(ref, ref_rate), ref_text=NARRATOR_REF_TEXT))
    model, prompt = _voice
    # The model samples, so it can now and then trail off into noise or cut a sentence short. A take far
    # outside a normal speaking pace is tried again with a new seed.
    words = len(text.split())
    for seed in range(5):
        torch.manual_seed(seed)
        wavs, rate = model.generate_voice_clone(text=text, language=VOICE_LANG, voice_clone_prompt=prompt)
        audio = signal.resample_poly(np.asarray(wavs[0], dtype=np.float64), SR, rate)
        # Trim the model's leading and trailing silence so pauses are under our control.
        loud = np.flatnonzero(np.abs(audio) > 0.01)
        if len(loud):
            audio = audio[max(0, loud[0] - int(0.03 * SR)) : loud[-1] + int(0.08 * SR)]
        if 0.2 * words <= len(audio) / SR <= 0.8 * words + 1.5:
            break
        print(f"    retrying ({len(audio) / SR:.1f}s for {words} words): {text}")
    TTS_CACHE.mkdir(parents=True, exist_ok=True)
    np.save(cached, audio)
    return audio


def bell(seconds: float = 9.0, base: float = 196.0) -> np.ndarray:
    """A soft singing-bowl strike: inharmonic partials with a slow beat and long decay."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.zeros(n)
    for ratio, amp, decay in ((1.0, 1.0, 3.2), (2.71, 0.5, 2.2), (5.2, 0.25, 1.4), (8.4, 0.1, 0.8)):
        f = base * ratio
        beat = 0.8 + 0.2 * np.cos(2 * np.pi * 0.9 * ratio * t)
        tone += amp * np.sin(2 * np.pi * f * t) * np.exp(-t / decay) * beat
    attack = np.minimum(1, t / 0.008)
    return tone * attack / np.max(np.abs(tone))


def reverb(x: np.ndarray, rng, seconds: float, wet: float) -> np.ndarray:
    """A soft room or hall: the signal convolved with a decaying noise burst. Not looped."""
    length = int(SR * seconds)
    ir = rng.standard_normal(length) * np.exp(-np.arange(length) / (SR * seconds / 5))
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    return (1 - wet) * x + wet * signal.fftconvolve(x, ir)[: len(x)]


def bed_warm(rng, n):
    """A warm, slowly drifting chord in A major."""
    return drone(n, n / SR).mean(axis=1)


def bed_ocean(rng, n):
    """Distant, slow waves on a far-off shore."""
    return lowpass(sound_ocean(rng, n).mean(axis=1), 1000)


def piano_note(freq: float, seconds: float = 7.0) -> np.ndarray:
    """A soft felt piano note: two slightly detuned strings, upper partials fading first."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    tone = np.zeros(n)
    for k in range(1, 9):
        f = k * freq * np.sqrt(1 + 0.0004 * k * k)
        decay = 3.2 / (1 + 0.6 * (k - 1))
        for detune in (-0.3, 0.3):
            tone += np.sin(2 * np.pi * (f + detune) * t) * np.exp(-t / decay) / k ** 1.6
    return tone * np.minimum(1, t / 0.006) / (np.max(np.abs(tone)) + 1e-9)


PIANO_NOTES = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99, 440.0]  # D major pentatonic


def bed_piano(rng, n):
    """Soft piano in short, connected phrases: a few notes about a second apart that move
    mostly step by step, then a rest. A faint low hum and a little hall sit underneath."""
    out = np.zeros(n)
    at = rng.uniform(1, 3)
    index = 4
    while at < n / SR:
        for note in range(int(rng.integers(4, 8))):
            index = int(np.clip(index + rng.choice([-2, -1, -1, 1, 1, 2]), 0, len(PIANO_NOTES) - 1))
            gain = rng.uniform(0.45, 0.75) * (0.8 if note else 1.0)
            place(out, piano_note(PIANO_NOTES[index]) * gain, int(at * SR))
            at += rng.uniform(0.9, 1.5)
        # End the phrase on a soft two-note chord, then rest.
        place(out, piano_note(PIANO_NOTES[max(index - 2, 0)]) * 0.4, int(at * SR))
        at += rng.uniform(4.0, 7.0)
    t = np.arange(n) / SR
    hum = np.sin(2 * np.pi * 73.42 * t) + 0.5 * np.sin(2 * np.pi * 110.0 * t)
    out = out / (np.sqrt(np.mean(out ** 2)) + 1e-9) + 0.15 * hum
    return reverb(out, rng, 2.5, 0.35)


def bed_guitar(rng, n):
    """Soft fingerpicked guitar: slow chords picked from the bass up and left to ring, with a
    gentle hall. No melody, so it stays out of the way of the voice."""
    out = np.zeros(n)
    progression = ["C", "Am", "F", "G", "C", "Em", "F", "G"]
    at = rng.uniform(1, 2)
    bar = 0
    while at < n / SR:
        notes = GUITAR_CHORDS[progression[bar % len(progression)]]
        for step, string in enumerate([0, 1, 2, 3, 2]):
            pluck = guitar_pluck(note_freq(notes[string]), 5.0, pluck_point=0.22)
            gain = (0.6 if string == 0 else 0.35) * rng.uniform(0.85, 1.0)
            place(out, pluck * gain, int((at + step * 0.55 + rng.uniform(-0.02, 0.02)) * SR))
        at += 5.5 + rng.uniform(-0.2, 0.2)
        bar += 1
    return reverb(lowpass(out, 4500), rng, 2.2, 0.3)


FLUTE_NOTES = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25]  # D major pentatonic


def pan_flute(rng, freq: float, seconds: float) -> np.ndarray:
    """One pan flute note: a pure, hollow tone with a breathy edge, a soft puff at the start,
    a slow swell and a gentle, delayed vibrato."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    vibrato = 1 + 0.004 * np.sin(2 * np.pi * 5.0 * t) * np.clip((t - 0.4) / 0.6, 0, 1)
    phase = 2 * np.pi * np.cumsum(freq * vibrato) / SR
    tone = np.sin(phase) + 0.1 * np.sin(2 * phase) + 0.05 * np.sin(3 * phase)
    breath = bandpass(white(rng, n), freq * 0.9, freq * 3.5) * 0.25
    puff = bandpass(white(rng, n), 800, 4000) * np.exp(-t / 0.04) * 0.4
    shape = np.minimum(1, t / 0.15) * np.clip((seconds - t) / 0.5, 0, 1)
    return (tone + breath) * shape + puff * np.minimum(1, t / 0.005)


def bed_flute(rng, n):
    """A pan flute playing slow, simple phrases, mostly step by step, with rests between them
    and a soft hall. A faint low hum keeps the pauses from feeling empty."""
    out = np.zeros(n)
    at = rng.uniform(1, 3)
    index = 3
    while at < n / SR:
        for _ in range(int(rng.integers(3, 6))):
            index = int(np.clip(index + rng.choice([-2, -1, -1, 1, 1, 2]), 0, len(FLUTE_NOTES) - 1))
            length = rng.uniform(1.6, 3.0)
            place(out, pan_flute(rng, FLUTE_NOTES[index], length) * rng.uniform(0.7, 1.0), int(at * SR))
            at += length + rng.uniform(0.05, 0.3)
        at += rng.uniform(4.0, 8.0)
    t = np.arange(n) / SR
    hum = np.sin(2 * np.pi * 73.42 * t) + 0.5 * np.sin(2 * np.pi * 110.0 * t)
    out = out / (np.sqrt(np.mean(out ** 2)) + 1e-9) + 0.12 * hum
    return reverb(out, rng, 2.8, 0.35)


# Background beds a meditation can use. Each script names one in content/meditations.txt, so a
# listener hears a different bed from one session to the next.
BEDS = {"warm": bed_warm, "guitar": bed_guitar, "ocean": bed_ocean, "piano": bed_piano, "flute": bed_flute}
BED_LEVEL_DB = -27  # loud enough to hear in the pauses
BED_TRIM_DB = {"warm": -3, "piano": -3}  # per-bed adjustments, by ear
BED_DUCK = 0.4  # the bed dips by this much (about 4 dB) while the narrator speaks


def soften_voice(voice: np.ndarray, rng) -> np.ndarray:
    """Takes the edge off the voice for a quiet, close sound: less high-end hiss and sibilance,
    and a touch of soft room around it."""
    voice = voice - 0.35 * highpass(voice, 5000)
    return reverb(voice, rng, 0.9, 0.12)


def build_meditation(mid: str, minutes: int, bed: str, items: list[tuple[str, object]]) -> np.ndarray:
    total = int(SR * minutes * 60)
    clips = [(kind, speak(value) if kind == "say" else value) for kind, value in items]
    # Drop the flexible pause after the very last line; the tail covers it.
    while clips and clips[-1][0] == "flex":
        clips.pop()

    speech = sum(len(c) for k, c in clips if k == "say") / SR
    fixed = sum(c for k, c in clips if k == "fixed")
    long_fixed = sum(c for k, c in clips if k == "fixed" and c >= LONG_PAUSE)
    weights = sum(c for k, c in clips if k == "flex")
    budget = minutes * 60 - LEAD_IN - TAIL - speech
    # Pauses give way before lines do. First the flexible pauses shrink, down to FLEX_MIN for the
    # shortest one. If that is not enough, the long timed pauses shrink too.
    min_weight = min((c for k, c in clips if k == "flex"), default=1.0)
    flex_floor = weights * FLEX_MIN / min_weight
    long_scale = 1.0
    if long_fixed and budget - fixed < flex_floor:
        long_scale = max(LONG_PAUSE_MIN_SCALE, 1 - (flex_floor - (budget - fixed)) / long_fixed)
    available = budget - fixed + long_fixed * (1 - long_scale)
    unit = available / weights if weights else 0
    min_flex = min_weight * unit
    print(
        f"  {mid} ({bed}): speech {speech:.0f}s of {minutes * 60}s, shortest pause {min_flex:.1f}s,"
        f" long pauses at {long_scale:.0%}"
    )
    if min_flex < FLEX_MIN - 1e-6:
        raise SystemExit(f"{mid}: script is too long for {minutes} minutes, even with the shortest pauses.")

    voice = np.zeros(total)
    cursor = LEAD_IN
    for kind, clip in clips:
        if kind == "say":
            place(voice, clip, int(cursor * SR))
            cursor += len(clip) / SR
        elif kind == "fixed":
            cursor += clip * long_scale if clip >= LONG_PAUSE else clip
        else:
            cursor += clip * unit
    rng = np.random.default_rng(zlib.crc32(mid.encode()))
    voice = soften_voice(voice, rng)
    voice = voice / (np.max(np.abs(voice)) + 1e-9) * 10 ** (-4 / 20)

    pad = BEDS[bed](rng, total)
    pad = pad / (np.sqrt(np.mean(pad ** 2)) + 1e-9) * 10 ** ((BED_LEVEL_DB + BED_TRIM_DB.get(bed, 0)) / 20)
    # Duck the bed gently while the narrator is speaking, and let it come back up in the pauses.
    speaking = (lowpass(np.abs(voice), 4) > 0.01).astype(float)
    pad *= 1 - BED_DUCK * np.clip(lowpass(speaking, 1.0), 0, 1)
    fade = np.ones(total)
    fade_in, fade_out = int(SR * 6), int(SR * 9)
    fade[:fade_in] = np.linspace(0, 1, fade_in)
    fade[-fade_out:] = np.linspace(1, 0, fade_out)
    pad *= fade

    bells = np.zeros(total)
    strike = bell() * 10 ** (-12 / 20)
    place(bells, strike, int(SR * 0.3))
    place(bells, strike, total - int(SR * (TAIL - 0.5)))

    mix = voice + pad + bells
    mix[-int(SR * 0.5):] *= np.linspace(1, 0, int(SR * 0.5))
    return np.clip(mix, -0.99, 0.99)


def generate_meditations(only: list[str]) -> None:
    print("Meditations")
    scripts = parse_scripts()
    for category in CATALOG["categories"]:
        for item in category["meditations"]:
            mid = item["id"]
            if only and mid not in only:
                continue
            if mid not in scripts:
                raise SystemExit(f"No script for {mid} in {SCRIPTS.name}")
            bed, items = scripts[mid]
            audio = build_meditation(mid, item["minutes"], bed, items)
            encode(audio, OUT_MEDITATIONS / f"{mid}.m4a", 64000)


# ---------------------------------------------------------------------------
# App map: React Native bundles audio only through static require() calls.
# ---------------------------------------------------------------------------

def write_audio_map() -> None:
    lines = [
        "// Generated by audio-tools/generate_audio.py. Do not edit by hand.",
        "// Metro only bundles files referenced by a static require(), so every file is listed here.",
        "",
        "export const MEDITATION_AUDIO: Record<string, number> = {",
    ]
    for category in CATALOG["categories"]:
        for item in category["meditations"]:
            lines.append(f"  '{item['id']}': require('../../assets/audio/meditations/{item['id']}.m4a'),")
    lines += ["};", "", "export const SOUNDSCAPE_AUDIO: Record<string, number> = {"]
    for item in CATALOG["soundscapes"]:
        lines.append(f"  '{item['id']}': require('../../assets/audio/sounds/{item['id']}.m4a'),")
    lines += ["};", "", "export const CUE_AUDIO: Record<string, number> = {"]
    for cid in CUES:
        lines.append(f"  '{cid}': require('../../assets/audio/cues/{cid}.m4a'),")
    lines += ["};", ""]
    AUDIO_MAP.parent.mkdir(parents=True, exist_ok=True)
    AUDIO_MAP.write_text("\n".join(lines))
    print(f"  wrote {AUDIO_MAP.relative_to(ROOT)}")


if __name__ == "__main__":
    # all | sounds [id ...] | meditations [id ...] | cues | voice | map
    args = sys.argv[1:]
    target = args[0] if args else "all"
    rest = args[1:]
    if target == "cues":
        generate_cues()
        write_audio_map()
        sys.exit()
    if target == "voice":
        design_voice()
        sys.exit()
    if target in ("all", "sounds"):
        generate_sounds(rest if target == "sounds" else [])
    if target == "all":
        generate_cues()
    if target in ("all", "meditations"):
        generate_meditations(rest if target == "meditations" else [])
    write_audio_map()
