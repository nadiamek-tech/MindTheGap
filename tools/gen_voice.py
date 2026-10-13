"""Pre-generate Kokoro narration for the story dialogue.
Usage: python3 gen_voice.py lines.json <site>/audio
lines.json: ["t|text", "s|text", ...] (t = teacher, s = class), collected from window.__allLines() on the page."""
import json, os, re, sys, subprocess, hashlib
import soundfile as sf
from kokoro_onnx import Kokoro
VOICES={'t':'af_heart','s':'am_michael'}
SUB=str.maketrans('₀₁₂₃₄₅₆₇₈₉','0123456789')
def norm(t):
    t=t.replace('…?','Hmm?').replace('1 ✓','One. Check!').replace('✓','')
    t=re.sub(r'x([₀-₉])',lambda m:' x '+m.group(1).translate(SUB)+' ',t)
    for a,b in [('x̄','x bar'),('“x-bar”',''),('xᵢ','x i'),('Σ','sigma'),('s²','s squared'),('σ²','sigma squared'),('μ','mu'),('√','The square root'),
                ('−',' minus '),('≈','about'),('×',' times '),('÷',' divided by '),('%',' percent'),('P(x)','P of x'),('…',', '),('“','"'),('”','"'),('’',"'"),('n minus 1','n minus one'),(' SD ',' S D ')]:
        t=t.replace(a,b)
    return re.sub(r'\s{2,}',' ',t).strip()
k=Kokoro('/home/claude/kokoro/kokoro-v1.0.int8.onnx','/home/claude/kokoro/voices-v1.0.bin')
lines=json.load(open(sys.argv[1])); OUT=sys.argv[2]; os.makedirs(OUT+'/w2',exist_ok=True); clips={}
for L in lines:
    who,text=L.split('|',1); n=norm(text); h=hashlib.sha1((who+n).encode()).hexdigest()[:10]
    name=f'w2/{who}-{h}.mp3'; path=f'{OUT}/{name}'
    if not os.path.exists(path):
        s,sr=k.create(n,voice=VOICES[who],speed=0.95 if who=='t' else 1.05,lang='en-us')
        sf.write('/tmp/clip.wav',s,sr)
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i','/tmp/clip.wav','-ac','1','-b:a','48k',path],check=True)
    clips[L]=name; print(name,'|',n,flush=True)
json.dump({'engine':'Kokoro v1.0','voices':VOICES,'clips':clips},open(f'{OUT}/manifest.json','w'),ensure_ascii=False)
