"""Voice recording kit: guide tracks + timeline + prompter data for sampling your own voice as an a cappella instrument.
Every item is: reference tone (beats 1-2), two count clicks (beats 3-4), sing from the next downbeat, a soft stop tick.
The same timeline later drives slice_voice.py, so the takes can be cut automatically."""
import json, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR, BPM = 48000, 120
BEAT = 60 / BPM
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
note = lambda m: f'{NAMES[m % 12]}{m // 12 - 1}'
LOW = [40, 43, 46, 49, 52, 55, 58, 61, 64, 67]          # E2 … G4, one sample every minor third

SECTIONS = [
    dict(id='01', name='长音·乌', sound='乌（u）', kind='sustain', notes=LOW, beats=8,
         how='嘴型像"乌"，直音不加颤音，音量平稳，唱满到停止声'),
    dict(id='02', name='长音·啊', sound='啊（a）', kind='sustain', notes=LOW, beats=8,
         how='嘴张开的"啊"，直音不加颤音，音量平稳，唱满到停止声'),
    dict(id='03', name='哼鸣·嗯', sound='嗯（m）', kind='sustain', notes=LOW, beats=8,
         how='闭嘴哼，鼻腔共鸣，直音不加颤音'),
    dict(id='04', name='低音短音·dm', sound='dm', kind='short', notes=LOW[:7], hits=3,
         how='像"德"刚出口就闭嘴变成"嗯"，短促，不超过半拍，每个提示拍唱一次'),
    dict(id='05', name='短音·吧', sound='吧（ba）', kind='short', notes=LOW[2:], hits=3,
         how='短促的"吧"，干脆收住，每个提示拍唱一次'),
    dict(id='06', name='选录·假声乌', sound='假声 乌（u）', kind='sustain', notes=[64, 67, 70, 73], beats=8,
         how='用假声（轻、虚一点的高音）唱"乌"，唱不上去就跳过'),
    dict(id='07', name='选录·Beatbox', kind='perc', beats_per=4, hits_list=[
        ('kick', '底鼓 · 噗', '双唇憋气后弹开的"噗"，不出声带音，低沉'),
        ('snare', '军鼓 · 噗嘶', '"噗"紧接齿间漏气"嘶"，像 pf'),
        ('ksnare', '舌根军鼓 · 克', '舌根顶住上颚弹开的"克"，不出声带音'),
        ('hihat', '踩镲 · 次', '牙齿咬合吐气的"次"，很短'),
        ('openhat', '开镲 · 次——', '同"次"，但拖长半拍'),
    ]),
]

def tone(midi, dur):
    """Organ-ish reference: harmonics make even E2 audible on headphones."""
    f = 440 * 2 ** ((midi - 69) / 12); t = np.arange(int(dur * SR)) / SR
    x = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.3 for k in range(1, 9) if f * k < 8000)
    env = np.minimum(1, t / 0.03) * np.minimum(1, (dur - t) / 0.15)
    return 0.22 * x * env / np.max(np.abs(x))

def click(freq=1600, dur=0.03, amp=0.35):
    t = np.arange(int(dur * SR)) / SR
    return amp * np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.006)

def put(buf, x, at):
    i = int(round(at * SR)); buf[i:i + len(x)] += x[:max(0, len(buf) - i)]

def build(sec):
    ev, items, t = [], [], 1.0
    # sync: four clicks, then clap on the fifth (silent) beat
    for k in range(4): ev.append((t + k * BEAT, click(1000 if k else 1400)))
    clap = t + 4 * BEAT; t = clap + 3 * BEAT
    if sec['kind'] == 'perc':
        for key, label, how in sec['hits_list']:
            ev.append((t + 2 * BEAT, click(1800))); ev.append((t + 3 * BEAT, click(1800)))
            sing = t + 4 * BEAT; hits = [sing + k * BEAT for k in range(sec['beats_per'])]
            end = hits[-1] + BEAT
            items.append(dict(id=f"{sec['id']}-{key}", key=key, label=label, how=how, ref=t, sing=sing, end=end, hits=hits))
            t = end + 2 * BEAT
    else:
        for m in sec['notes']:
            ev.append((t, tone(m, 2 * BEAT * 0.95)))
            ev.append((t + 2 * BEAT, click(1800))); ev.append((t + 3 * BEAT, click(1800)))
            sing = t + 4 * BEAT
            if sec['kind'] == 'sustain':
                end = sing + sec['beats'] * BEAT; hits = [sing]
            else:
                hits = [sing + 2 * k * BEAT for k in range(sec['hits'])]; end = hits[-1] + 2 * BEAT
            ev.append((end, click(700, 0.04, 0.18)))
            items.append(dict(id=f"{sec['id']}-{m}", midi=m, note=note(m), label=f"{sec['sound']} · {note(m)}", how=sec['how'], ref=t, sing=sing, end=end, hits=hits))
            t = end + 2 * BEAT
    length = t + 1.0
    buf = np.zeros(int(length * SR))
    for at, x in ev: put(buf, x, at)
    fname = f"{sec['id']}_{sec['name']}.wav"
    with wave.open(os.path.join(HERE, 'guide', fname), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(buf, -1, 1) * 32767).astype('<i2').tobytes())
    rnd = lambda v: round(v, 4)
    return dict(id=sec['id'], name=sec['name'], kind=sec['kind'], file=f'guide/{fname}', record=f'recordings/{fname}', bpm=BPM,
                clap=rnd(clap), length=rnd(length), optional=sec['name'].startswith('选录'),
                items=[{**i, 'ref': rnd(i['ref']), 'sing': rnd(i['sing']), 'end': rnd(i['end']), 'hits': [rnd(h) for h in i['hits']]} for i in items])

os.makedirs(os.path.join(HERE, 'guide'), exist_ok=True); os.makedirs(os.path.join(HERE, 'recordings'), exist_ok=True)
TL = dict(version=1, sampleRate=SR, sections=[build(s) for s in SECTIONS])
json.dump(TL, open(os.path.join(HERE, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(os.path.join(HERE, 'timeline.js'), 'w', encoding='utf-8').write('window.TL = ' + json.dumps(TL, ensure_ascii=False) + ';\n')
for s in TL['sections']: print(s['id'], s['name'], len(s['items']), 'items', f"{s['length']:.0f}s")
print('total', f"{sum(s['length'] for s in TL['sections']) / 60:.1f} min")
