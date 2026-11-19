#!/usr/bin/env python3
"""
Synthesizes a 60.0-second 48kHz stereo Miami synthwave / cinematic trailer score
synchronized to 120 BPM (30 bars) across 6 acts for VICE HORIZONS.
"""

import os
import wave
import numpy as np

SR = 48000
DURATION = 60.0
N = int(SR * DURATION)
BPM = 120.0
BEAT = 60.0 / BPM  # 0.5 s
BAR = BEAT * 4.0   # 2.0 s

t = np.arange(N, dtype=np.float64) / SR


def midi_to_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


def bandlimited_saw(phase: np.ndarray, harmonics: int = 12) -> np.ndarray:
    out = np.zeros_like(phase)
    for k in range(1, harmonics + 1):
        out += ((-1.0) ** (k + 1)) * np.sin(k * phase) / k
    return out * (2.0 / np.pi)


def one_pole_lp(x: np.ndarray, cutoff_hz: np.ndarray | float) -> np.ndarray:
    """Fast vectorized block-approximated low-pass filter using FFT/overlap or smoothed alpha."""
    if np.isscalar(cutoff_hz):
        # Zero-phase-free FFT lowpass for constant cutoff (super fast & smooth)
        freqs = np.fft.rfftfreq(len(x), 1.0 / SR)
        X = np.fft.rfft(x)
        H = 1.0 / np.sqrt(1.0 + (freqs / max(cutoff_hz, 20.0)) ** 4)
        return np.fft.irfft(X * H, n=len(x))
    # Time-varying filter via smooth crossfade between 6 octave bands
    band_cutoffs = [220.0, 480.0, 1000.0, 2200.0, 4800.0, 10500.0]
    freqs = np.fft.rfftfreq(len(x), 1.0 / SR)
    X = np.fft.rfft(x)
    filtered = []
    for fc in band_cutoffs:
        H = 1.0 / np.sqrt(1.0 + (freqs / fc) ** 4)
        filtered.append(np.fft.irfft(X * H, n=len(x)))
    log_c = np.log2(np.clip(cutoff_hz, band_cutoffs[0], band_cutoffs[-1]))
    log_bands = np.log2(band_cutoffs)
    idx = np.clip(np.searchsorted(log_bands, log_c) - 1, 0, len(band_cutoffs) - 2)
    frac = (log_c - log_bands[idx]) / (log_bands[idx + 1] - log_bands[idx])
    out = np.zeros_like(x)
    for b in range(len(band_cutoffs) - 1):
        mask = idx == b
        if np.any(mask):
            out[mask] = filtered[b][mask] * (1.0 - frac[mask]) + filtered[b + 1][mask] * frac[mask]
    return out


def add_stereo_delay(left: np.ndarray, right: np.ndarray, delay_l=0.375, delay_r=0.25, feedback=0.36, mix=0.28):
    dl = int(delay_l * SR)
    dr = int(delay_r * SR)
    wet_l = np.zeros_like(left)
    wet_r = np.zeros_like(right)
    # 5 ping-pong taps
    cur_l, cur_r = left.copy(), right.copy()
    gain = feedback
    for tap in range(1, 6):
        shift_l = dl * tap
        shift_r = dr * tap
        if shift_l < N:
            wet_l[shift_l:] += cur_r[: N - shift_l] * gain
        if shift_r < N:
            wet_r[shift_r:] += cur_l[: N - shift_r] * gain
        cur_l, cur_r = cur_r, cur_l
        gain *= feedback
    wet_l = one_pole_lp(wet_l, 3400.0)
    wet_r = one_pole_lp(wet_r, 3400.0)
    return left + wet_l * mix, right + wet_r * mix


def simple_reverb(left: np.ndarray, right: np.ndarray, decay=0.45, mix=0.25):
    rng = np.random.default_rng(42)
    ir_len = int(SR * 1.6)
    ir_t = np.arange(ir_len) / SR
    env = np.exp(-ir_t / decay)
    ir_l = rng.standard_normal(ir_len) * env
    ir_r = rng.standard_normal(ir_len) * env
    ir_l = one_pole_lp(ir_l, 4200.0)
    ir_r = one_pole_lp(ir_r, 4200.0)
    ir_l /= np.sqrt(np.sum(ir_l ** 2)) + 1e-9
    ir_r /= np.sqrt(np.sum(ir_r ** 2)) + 1e-9

    nfft = 1 << int(np.ceil(np.log2(N + ir_len)))
    wl = np.fft.irfft(np.fft.rfft(left, nfft) * np.fft.rfft(ir_l, nfft), nfft)[:N]
    wr = np.fft.irfft(np.fft.rfft(right, nfft) * np.fft.rfft(ir_r, nfft), nfft)[:N]
    return left + wl * mix, right + wr * mix


def build_sidechain_env() -> np.ndarray:
    """Pumping 4-on-the-floor sidechain ducking when kick is active."""
    env = np.ones(N, dtype=np.float64)
    for beat_idx in range(int(DURATION / BEAT)):
        bt = beat_idx * BEAT
        # Active during Acts II, III, IV (except breakdown 42-44), V
        active = (10.0 <= bt < 42.0) or (44.0 <= bt < 52.0)
        if not active:
            continue
        depth = 0.42 if bt < 20.0 else 0.62
        s0 = int(bt * SR)
        s1 = min(N, s0 + int(0.32 * SR))
        lt = np.arange(s1 - s0) / SR
        duck = 1.0 - depth * np.exp(-lt / 0.085)
        env[s0:s1] = np.minimum(env[s0:s1], duck)
    return env


def synth_pads() -> tuple[np.ndarray, np.ndarray]:
    """Lush wide detuned analog pads in F minor: Fm9 -> Dbmaj7 -> Abmaj7 -> Ebadd9."""
    # Chord progression every 2 bars (4.0s):
    chords = [
        [53, 60, 63, 67, 72],  # Fm9
        [49, 56, 60, 65, 68],  # Dbmaj7
        [56, 63, 67, 72, 75],  # Abmaj7
        [51, 58, 63, 67, 70],  # Ebadd9
    ]
    pad_l = np.zeros(N, dtype=np.float64)
    pad_r = np.zeros(N, dtype=np.float64)

    for seg in range(15):  # 15 * 4.0s = 60.0s
        t0 = seg * 4.0
        t1 = min(DURATION, t0 + 4.25)
        s0 = int(t0 * SR)
        s1 = int(t1 * SR)
        lt = np.arange(s1 - s0) / SR
        dur = lt[-1] if len(lt) else 4.0
        # Smooth attack & release envelope
        env = np.minimum(lt / 0.45, 1.0) * np.minimum((dur - lt) / 0.45, 1.0)
        env = np.clip(env, 0.0, 1.0)

        chord = chords[seg % len(chords)]
        if seg == 14:
            # Final lush Fm9 resolution
            chord = [53, 60, 63, 67, 72, 77]
            env = np.minimum(lt / 0.35, 1.0) * np.exp(-np.maximum(lt - 1.0, 0.0) / 1.8)

        seg_l = np.zeros(s1 - s0)
        seg_r = np.zeros(s1 - s0)
        for i, note in enumerate(chord):
            hz = midi_to_hz(note)
            # 3 detuned voices per note with subtle vibrato
            vib = 1.0 + 0.0022 * np.sin(2.0 * np.pi * (4.2 + i * 0.23) * lt)
            for det, pan in [(-0.0055, 0.2), (0.0, 0.5), (0.0055, 0.8)]:
                phase = 2.0 * np.pi * hz * (1.0 + det) * np.cumsum(vib) / SR
                w = bandlimited_saw(phase, harmonics=9)
                seg_l += w * (1.0 - pan)
                seg_r += w * pan

        norm = 1.0 / (len(chord) * 2.2)
        pad_l[s0:s1] += seg_l * env * norm
        pad_r[s0:s1] += seg_r * env * norm

    # Filter sweep across the 60s story arc
    cutoff = np.full(N, 750.0)
    cutoff = np.where(t < 10.0, 420.0 + 750.0 * (t / 10.0) ** 1.4, cutoff)
    cutoff = np.where((t >= 10.0) & (t < 20.0), 1100.0 + 1100.0 * ((t - 10.0) / 10.0), cutoff)
    cutoff = np.where((t >= 20.0) & (t < 32.0), 2800.0 + 900.0 * np.sin((t - 20.0) * 0.6), cutoff)
    cutoff = np.where((t >= 32.0) & (t < 42.0), 1800.0 + 800.0 * np.sin((t - 32.0) * 1.1), cutoff)
    cutoff = np.where((t >= 42.0) & (t < 44.0), 650.0 + 3600.0 * ((t - 42.0) / 2.0) ** 2, cutoff)
    cutoff = np.where((t >= 44.0) & (t < 52.0), 4200.0, cutoff)
    cutoff = np.where(t >= 52.0, 2600.0 * np.exp(-(t - 52.0) / 4.2) + 320.0, cutoff)

    pad_l = one_pole_lp(pad_l, cutoff)
    pad_r = one_pole_lp(pad_r, cutoff)
    return pad_l, pad_r


def synth_bass() -> np.ndarray:
    """Rolling 16th-note analog synthwave bassline + deep sub."""
    roots = [41, 37, 44, 39]  # F1, Db1, Ab1, Eb1
    bass = np.zeros(N, dtype=np.float64)
    step_dur = BEAT / 4.0  # 0.125s (16th note)
    total_steps = int(DURATION / step_dur)

    for step in range(total_steps):
        st = step * step_dur
        if st < 6.0 or st >= 56.0:
            continue
        if 42.0 <= st < 43.75:
            continue  # Breakdown tension gap

        seg = int(st // 4.0)
        root = roots[seg % 4]
        # Octave bounce on certain 16ths for classic outrun pulse
        octave_bump = 12 if (step % 4 == 2 and st >= 20.0) else 0
        hz = midi_to_hz(root + octave_bump)

        s0 = int(st * SR)
        s1 = min(N, int((st + step_dur * 0.92) * SR))
        lt = np.arange(s1 - s0) / SR

        # Fade-in bass during end of Act I (6s-10s)
        vol = 1.0
        if st < 10.0:
            vol = (st - 6.0) / 4.0 * 0.55
        elif st >= 52.0:
            vol = max(0.0, 1.0 - (st - 52.0) / 4.0) * 0.6

        env = np.minimum(lt / 0.005, 1.0) * np.exp(-lt / 0.095)
        phase = 2.0 * np.pi * hz * lt
        saw = bandlimited_saw(phase, harmonics=8)
        sub = np.sin(phase)
        bass[s0:s1] += (saw * 0.55 + sub * 0.65) * env * vol

    cutoff = np.where(t < 20.0, 520.0, np.where(t < 52.0, 1150.0, 420.0))
    return one_pole_lp(bass, cutoff)


def synth_arp_and_lead() -> tuple[np.ndarray, np.ndarray]:
    """Sparkling 16th-note neon arpeggio + soaring brassy GTA/Vice City hero lead."""
    arp_patterns = [
        [65, 68, 72, 75, 72, 68, 79, 75],  # Fm9
        [61, 65, 68, 72, 68, 65, 77, 72],  # Dbmaj7
        [68, 72, 75, 79, 75, 72, 84, 79],  # Abmaj7
        [63, 67, 70, 75, 70, 67, 79, 75],  # Ebadd9
    ]
    left = np.zeros(N, dtype=np.float64)
    right = np.zeros(N, dtype=np.float64)

    step_dur = BEAT / 4.0
    for step in range(int(DURATION / step_dur)):
        st = step * step_dur
        if st < 10.0 or st >= 55.5:
            continue
        if 42.0 <= st < 44.0:
            continue
        seg = int(st // 4.0)
        note = arp_patterns[seg % 4][step % 8]
        hz = midi_to_hz(note)
        s0 = int(st * SR)
        s1 = min(N, int((st + step_dur * 0.88) * SR))
        lt = np.arange(s1 - s0) / SR

        env = np.minimum(lt / 0.004, 1.0) * np.exp(-lt / 0.075)
        phase = 2.0 * np.pi * hz * lt
        tone = bandlimited_saw(phase, harmonics=6) * 0.65 + np.sin(phase * 2.0) * 0.25
        # Auto-pan across stereo field
        pan = 0.5 + 0.35 * np.sin(step * 0.7)
        gain = 0.19 if st < 20.0 else (0.24 if st < 52.0 else 0.14 * (1.0 - (st - 52.0) / 3.5))
        left[s0:s1] += tone * env * gain * (1.0 - pan)
        right[s0:s1] += tone * env * gain * pan

    # Soaring hero lead melody in Act III (20-32s) and Act V Climax (44-52s)
    # Format: (start_sec, duration_sec, midi_note)
    melody_notes = [
        # Act III heroic hook (20.0 - 32.0)
        (20.0, 1.4, 77), (21.5, 0.5, 75), (22.0, 1.8, 72),
        (24.0, 1.4, 77), (25.5, 0.5, 79), (26.0, 1.8, 80),
        (28.0, 1.4, 84), (29.5, 0.5, 82), (30.0, 1.9, 79),
        # Act IV darker pulse accents (34.0 - 41.0)
        (34.0, 0.9, 72), (35.0, 0.9, 75), (36.0, 1.8, 73),
        (38.0, 0.9, 75), (39.0, 0.9, 77), (40.0, 1.8, 79),
        # Act V Neon Overdrive Climax (44.0 - 52.0) - octave higher soaring!
        (44.0, 1.35, 84), (45.5, 0.45, 82), (46.0, 1.8, 80),
        (48.0, 1.35, 84), (49.5, 0.45, 87), (50.0, 1.9, 89),
        # Act VI emotional closing echo (52.0 - 57.0)
        (52.0, 4.5, 84),
    ]
    lead_l = np.zeros(N, dtype=np.float64)
    lead_r = np.zeros(N, dtype=np.float64)
    for start, dur, note in melody_notes:
        s0 = int(start * SR)
        s1 = min(N, int((start + dur + 0.25) * SR))
        lt = np.arange(s1 - s0) / SR
        hz = midi_to_hz(note)
        # Expressive vibrato ramping in after 0.2s
        vib_depth = 0.0055 * np.minimum(lt / 0.35, 1.0)
        vib = 1.0 + vib_depth * np.sin(2.0 * np.pi * 5.6 * lt)
        # Pitch slide-in
        slide = 1.0 - 0.025 * np.exp(-lt / 0.035)
        phase1 = 2.0 * np.pi * hz * 0.997 * np.cumsum(vib * slide) / SR
        phase2 = 2.0 * np.pi * hz * 1.003 * np.cumsum(vib * slide) / SR
        env = np.minimum(lt / 0.03, 1.0) * np.where(lt < dur, 1.0, np.exp(-(lt - dur) / 0.12))
        w1 = bandlimited_saw(phase1, harmonics=10)
        w2 = bandlimited_saw(phase2, harmonics=10)
        gain = 0.24 if start >= 44.0 else 0.19
        lead_l[s0:s1] += (w1 * 0.65 + w2 * 0.35) * env * gain
        lead_r[s0:s1] += (w1 * 0.35 + w2 * 0.65) * env * gain

    lead_l = one_pole_lp(lead_l, 3800.0)
    lead_r = one_pole_lp(lead_r, 3800.0)
    lead_l, lead_r = add_stereo_delay(lead_l, lead_r, delay_l=0.375, delay_r=0.25, feedback=0.42, mix=0.38)

    return left + lead_l, right + lead_r


def synth_drums() -> tuple[np.ndarray, np.ndarray]:
    """Punchy modern synthwave kick, gated-reverb 80s snare, crisp hi-hats, and cinematic impacts."""
    rng = np.random.default_rng(7)
    left = np.zeros(N, dtype=np.float64)
    right = np.zeros(N, dtype=np.float64)

    # Pre-build drum one-shots
    # 1) Kick
    k_len = int(0.32 * SR)
    kt = np.arange(k_len) / SR
    k_freq = 44.0 + 130.0 * np.exp(-kt / 0.028)
    k_phase = 2.0 * np.pi * np.cumsum(k_freq) / SR
    kick = np.sin(k_phase) * np.exp(-kt / 0.11) + np.sin(2.0 * np.pi * 1800 * kt) * np.exp(-kt / 0.004) * 0.22
    kick = np.tanh(kick * 1.4) * 0.72

    # 2) Gated 80s snare (punchy body + wide stereo gated reverb burst)
    sn_len = int(0.38 * SR)
    st = np.arange(sn_len) / SR
    sn_body = np.sin(2.0 * np.pi * (175.0 + 95.0 * np.exp(-st / 0.015)) * st) * np.exp(-st / 0.06)
    sn_noise_l = one_pole_lp(rng.standard_normal(sn_len), 7200.0)
    sn_noise_r = one_pole_lp(rng.standard_normal(sn_len), 7200.0)
    gate_env = np.where(st < 0.22, np.exp(-st / 0.18), np.exp(-(st - 0.22) / 0.022) * np.exp(-0.22 / 0.18))
    snare_l = (sn_body * 0.6 + sn_noise_l * gate_env * 0.55) * 0.65
    snare_r = (sn_body * 0.6 + sn_noise_r * gate_env * 0.55) * 0.65

    # 3) Crisp closed hi-hat
    hh_len = int(0.06 * SR)
    ht = np.arange(hh_len) / SR
    hh_raw = rng.standard_normal(hh_len)
    hh_hp = hh_raw - one_pole_lp(hh_raw, 6500.0)
    hihat = hh_hp * np.exp(-ht / 0.018) * 0.28

    # 4) Cinematic sub-boom impact
    im_len = int(2.2 * SR)
    it = np.arange(im_len) / SR
    im_freq = 34.0 + 75.0 * np.exp(-it / 0.08)
    impact_body = np.sin(2.0 * np.pi * np.cumsum(im_freq) / SR) * np.exp(-it / 0.75)
    impact_air = one_pole_lp(rng.standard_normal(im_len), 1400.0) * np.exp(-it / 0.45) * 0.35
    impact = np.tanh((impact_body + impact_air) * 1.2) * 0.75

    def place_stereo(sec: float, sig_l: np.ndarray, sig_r: np.ndarray, gain=1.0):
        s0 = int(sec * SR)
        if s0 >= N:
            return
        s1 = min(N, s0 + len(sig_l))
        left[s0:s1] += sig_l[: s1 - s0] * gain
        right[s0:s1] += sig_r[: s1 - s0] * gain

    # Scene cut cinematic impacts
    for cut_sec, g in [(0.05, 0.55), (10.0, 0.85), (20.0, 1.0), (32.0, 0.95), (44.0, 1.05), (52.0, 0.9)]:
        place_stereo(cut_sec, impact, impact, gain=g)

    # Beat grid
    for beat_idx in range(int(DURATION / BEAT)):
        bt = beat_idx * BEAT
        if bt < 10.0 or bt >= 52.0:
            continue
        if 42.0 <= bt < 44.0:
            # Rapid snare build-up roll into Act V climax
            for sub in range(4):
                rt = bt + sub * (BEAT / 4.0)
                prog = (rt - 42.0) / 2.0
                place_stereo(rt, snare_l, snare_r, gain=0.25 + 0.65 * prog)
            continue

        # Kick on every beat (4 on the floor)
        place_stereo(bt, kick, kick, gain=0.88 if bt < 20.0 else 1.0)

        # Gated snare on beats 2 and 4 (starting full at Act III, light clap/snare in Act II)
        if beat_idx % 2 == 1:
            g = 0.52 if bt < 20.0 else 0.92
            place_stereo(bt, snare_l, snare_r, gain=g)

        # Hi-hats: 8ths in Act II-III, driving 16ths in Act IV-V
        subdivs = 4 if bt >= 32.0 else 2
        for s in range(subdivs):
            ht_sec = bt + s * (BEAT / subdivs)
            accent = 0.85 if s % 2 == 1 else 0.45
            pan = 0.35 if s % 2 == 0 else 0.65
            place_stereo(ht_sec, hihat * (1.0 - pan), hihat * pan, gain=accent)

    return left, right


def synth_sfx() -> tuple[np.ndarray, np.ndarray]:
    """Diegetic Miami cinematic SFX: ocean surf, risers, V12 supercar rev & turbo pop, chopper rotor, subtle siren."""
    rng = np.random.default_rng(123)
    left = np.zeros(N, dtype=np.float64)
    right = np.zeros(N, dtype=np.float64)

    # 1) Ocean surf (Act I 0-11s and Act VI 52-60s)
    surf_noise_l = one_pole_lp(rng.standard_normal(N), 900.0)
    surf_noise_r = one_pole_lp(rng.standard_normal(N), 950.0)
    wave_lfo = 0.55 + 0.45 * np.sin(2.0 * np.pi * 0.19 * t)
    surf_env = np.where(t < 11.5, np.clip(1.0 - np.maximum(t - 8.5, 0.0) / 3.0, 0.0, 1.0), 0.0)
    surf_env += np.where(t >= 52.0, np.clip((t - 52.0) / 2.0, 0.0, 1.0) * np.clip((60.0 - t) / 2.2, 0.0, 1.0), 0.0)
    left += surf_noise_l * wave_lfo * surf_env * 0.24
    right += surf_noise_r * (1.0 - 0.3 * wave_lfo) * surf_env * 0.24

    # 2) Noise risers before big drops (8-10s, 18-20s, 42-44s)
    for r_start, r_end, gain in [(7.5, 10.0, 0.28), (18.0, 20.0, 0.36), (41.8, 44.0, 0.42)]:
        s0, s1 = int(r_start * SR), int(r_end * SR)
        lt = np.linspace(0.0, 1.0, s1 - s0)
        noise = rng.standard_normal(s1 - s0)
        fc = 250.0 + 6200.0 * (lt ** 2.4)
        swept = one_pole_lp(noise, fc) * (lt ** 1.6) * gain
        left[s0:s1] += swept * 0.9
        right[s0:s1] += swept * 1.1

    # 3) V12 Supercar engine rev + launch (17.5s - 21.5s) and highway roar (20s - 31s, 44s - 52s)
    eng_s0, eng_s1 = int(17.5 * SR), int(23.5 * SR)
    et = np.arange(eng_s1 - eng_s0) / SR
    # Rev up -> shift drop at 2.5s (t=20.0) -> pull hard
    rpm_hz = np.where(
        et < 2.45,
        58.0 + 115.0 * (et / 2.45) ** 1.5,
        85.0 + 92.0 * np.clip((et - 2.45) / 3.5, 0.0, 1.0),
    )
    eph = 2.0 * np.pi * np.cumsum(rpm_hz) / SR
    engine = (
        bandlimited_saw(eph, harmonics=7) * 0.5
        + bandlimited_saw(eph * 1.5, harmonics=5) * 0.35
        + np.sin(eph * 0.5) * 0.4
    )
    engine = one_pole_lp(np.tanh(engine * 1.8), 880.0)
    eng_env = np.minimum(et / 0.4, 1.0) * np.clip((6.0 - et) / 1.4, 0.0, 1.0)
    left[eng_s0:eng_s1] += engine * eng_env * 0.22
    right[eng_s0:eng_s1] += engine * eng_env * 0.22

    # 4) Helicopter rotor thump + distant Doppler police siren in Act IV (32.0 - 43.5s)
    h0, h1 = int(32.5 * SR), int(43.5 * SR)
    ht = np.arange(h1 - h0) / SR
    rotor_lfo = np.maximum(0.0, np.sin(2.0 * np.pi * 7.8 * ht)) ** 3
    rotor_thump = one_pole_lp(rng.standard_normal(h1 - h0), 220.0) * rotor_lfo
    chopper_pan = 0.5 + 0.42 * np.sin(2.0 * np.pi * 0.14 * ht)
    chopper_env = np.minimum(ht / 1.5, 1.0) * np.clip((11.0 - ht) / 1.5, 0.0, 1.0)
    left[h0:h1] += rotor_thump * chopper_env * (1.0 - chopper_pan) * 0.55
    right[h0:h1] += rotor_thump * chopper_env * chopper_pan * 0.55

    # Subtle atmospheric distant siren wail (mixed tastefully behind music)
    siren_freq = 640.0 + 230.0 * np.sin(2.0 * np.pi * 0.55 * ht)
    siren = np.sin(2.0 * np.pi * np.cumsum(siren_freq) / SR)
    siren = one_pole_lp(siren, 1400.0) * chopper_env * 0.045
    left[h0:h1] += siren * chopper_pan
    right[h0:h1] += siren * (1.0 - chopper_pan)

    return left, right


def main():
    print("Synthesizing 60.0s VICE HORIZONS stereo score (48kHz)...")
    sc = build_sidechain_env()

    pad_l, pad_r = synth_pads()
    bass = synth_bass()
    arp_l, arp_r = synth_arp_and_lead()
    drum_l, drum_r = synth_drums()
    sfx_l, sfx_r = synth_sfx()

    # Mix with sidechain pumping on pads & bass
    mix_l = pad_l * sc * 0.52 + bass * sc * 0.46 + arp_l * 0.78 + drum_l * 0.82 + sfx_l * 0.75
    mix_r = pad_r * sc * 0.52 + bass * sc * 0.46 + arp_r * 0.78 + drum_r * 0.82 + sfx_r * 0.75

    # Subtle lush master hall glue
    mix_l, mix_r = simple_reverb(mix_l, mix_r, decay=0.55, mix=0.14)

    # Clean fade-in (0.3s) and smooth cinematic fade-out (57.2s - 60.0s)
    fade_in = np.clip(t / 0.35, 0.0, 1.0)
    fade_out = np.clip((60.0 - t) / 2.6, 0.0, 1.0) ** 1.4
    env = fade_in * fade_out
    mix_l *= env
    mix_r *= env

    # Mastering soft-clip limiter & loudness normalization
    peak = max(np.max(np.abs(mix_l)), np.max(np.abs(mix_r)), 1e-6)
    drive = 1.35 / peak
    mix_l = np.tanh(mix_l * drive) * 0.92
    mix_r = np.tanh(mix_r * drive) * 0.92

    stereo = np.stack([mix_l, mix_r], axis=1)
    pcm = np.clip(stereo * 32767.0, -32768, 32767).astype(np.int16)

    os.makedirs("tmp_render", exist_ok=True)
    wav_path = "tmp_render/vice-horizons-audio.wav"
    with wave.open(wav_path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())

    print(f"Wrote {wav_path} ({len(pcm)/SR:.2f}s)")


if __name__ == "__main__":
    main()
