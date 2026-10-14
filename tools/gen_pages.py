"""Kokoro narration for scene-based pages (engine reads manifest['pages'][page][scene] = [files]).
Usage: python3 tools/gen_pages.py <page> spoken.json   (spoken.json: list per scene of spoken paragraphs)"""
import json, os, sys, hashlib, subprocess
import soundfile as sf
from kokoro_onnx import Kokoro
page, src = sys.argv[1], sys.argv[2]
k = Kokoro('/home/claude/kokoro/kokoro-v1.0.int8.onnx', '/home/claude/kokoro/voices-v1.0.bin')
scenes = json.load(open(src)); os.makedirs(f'audio/{page}', exist_ok=True); out = []
for sc in scenes:
    files = []
    for t in sc:
        name = f'{page}/p-{hashlib.sha1(t.encode()).hexdigest()[:10]}.mp3'
        if not os.path.exists('audio/' + name):
            s, sr = k.create(t, voice='af_heart', speed=0.95, lang='en-us'); sf.write('/tmp/clip.wav', s, sr)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', '/tmp/clip.wav', '-ac', '1', '-b:a', '48k', 'audio/' + name], check=True)
        files.append(name); print(name, '|', t[:60], flush=True)
    out.append(files)
m = json.load(open('audio/manifest.json')); m.setdefault('pages', {})[page] = out
json.dump(m, open('audio/manifest.json', 'w'), ensure_ascii=False)
