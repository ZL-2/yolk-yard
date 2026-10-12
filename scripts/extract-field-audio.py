"""Reproducible separation of the two user-supplied QuickSounds recordings.

Run with the upload directory as argv[1]. SciPy/NumPy are asset-build tools only;
the game ships small decoded-once MP3 clips, not a signal-processing runtime.
"""
from pathlib import Path
import subprocess
import sys
import numpy as np
from scipy.ndimage import median_filter
from scipy.signal import butter, sosfilt, stft, istft

uploads = Path(sys.argv[1])
output = Path(__file__).resolve().parents[1] / 'public' / 'audio'
output.mkdir(exist_ok=True)
source = uploads / 'Footsteps - Fortnite - QuickSounds.com.mp3'
rate = 24000
pcm = np.frombuffer(subprocess.check_output([
    'ffmpeg', '-v', 'error', '-i', str(source), '-f', 'f32le',
    '-ac', '1', '-ar', str(rate), 'pipe:1']), dtype='<f4')

def encode(wave, name, peak, fade):
    wave = wave.copy()
    wave *= peak / max(.0001, np.max(np.abs(wave)))
    n = min(len(wave)//2, int(fade*rate))
    wave[:n] *= np.linspace(0, 1, n)
    wave[-n:] *= np.linspace(1, 0, n)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le',
        '-ar', str(rate), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libmp3lame',
        '-b:a', '64k', '-map_metadata', '-1', str(output/name)],
        input=wave.astype('<f4').tobytes(), check=True)

# One isolated impact (2.12 seconds); the next step is outside this crop.
step = pcm[int(2.075*rate):int(2.31*rate)]
step = sosfilt(butter(4, [65, 1600], fs=rate, btype='bandpass', output='sos'), step)
encode(step, 'field-footstep.mp3', .78, .008)

# Separate sustained/chirping high-band ambience from broadband foot impacts.
# Time/frequency median masks attenuate percussion; no extraction runs in-game.
ambience = pcm[int(.85*rate):int(8.35*rate)]
freq, time, spectrum = stft(ambience, rate, nperseg=1024, noverlap=896)
magnitude = np.abs(spectrum)
harmonic = median_filter(magnitude, size=(1, 11))
percussive = median_filter(magnitude, size=(17, 1))
mask = harmonic**3 / (harmonic**3 + percussive**3 + 1e-12)
mask[freq < 1900] = 0
mask[freq > 9000] = 0
_, birds = istft(spectrum*mask, rate, nperseg=1024, noverlap=896)
encode(birds[:len(ambience)], 'field-birds.mp3', .30, .18)

# Preserve the supplied elimination sound; strip tags and encode for browsers.
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i',
    str(uploads/'Fortnite Death - QuickSounds.com.mp3'), '-ac', '1',
    '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '96k',
    '-af', 'afade=t=out:st=1.12:d=0.10', '-map_metadata', '-1',
    str(output/'field-elimination.mp3')], check=True)
