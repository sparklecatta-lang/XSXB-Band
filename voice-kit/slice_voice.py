"""Turn the voice-kit recordings into personal sampler instruments.
Takes from the recorder page (recordings/items/<item>.wav) and whole-section takes (recordings/01_*.wav) are both accepted.

    python slice_voice.py                      # recordings/ -> data/samples/my-voice + data/user-instruments/my-voice.json
    python slice_voice.py --id my-voice --name 我的人声 --studio <XSXB-Band dir>

Each recording is aligned to timeline.json by searching for the offset where voice activity best matches the sing windows
(so DAW overdubs, clap-synced takes and late starts all work). Then every take is trimmed, pitch-measured (YIN),
level-matched, and sustains get a crossfaded loop so a 4-second vowel can hold any note length.
Skipped or unusable notes are simply left out; the sampler stretches the neighbouring roots."""
import argparse, glob, json, os, re, subprocess, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
ART = {'01': ('oo', '乌 · 长音'), '02': ('aa', '啊 · 长音'), '03': ('mm', '嗯 · 哼鸣'), '04': ('dm', 'dm · 低音短音'),
       '05': ('ba', '吧 · 短音'), '06': ('falsetto', '乌 · 假声')}
DEFAULT_ART = 'oo'
PRE = 0.5  # recorder page keeps this much before the singing starts

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)

def frames_db(x, hop=480, win=960):
    n = max(1, (len(x) - win) // hop)
    idx = np.arange(win)[None, :] + hop * np.arange(n)[:, None]
    return 10 * np.log10(np.mean(x[idx] ** 2, axis=1) + 1e-12)

def yin(x, fmin=60, fmax=900, win=2048, hop=480, thr=0.15):
    """Per-frame f0 (Hz, 0 = unvoiced) with the cumulative-mean-normalised difference function."""
    tmax = int(SR / fmin); tmin = int(SR / fmax); out = []
    for i in range(0, len(x) - win - tmax, hop):
        f = x[i:i + win + tmax]
        if np.sqrt(np.mean(f[:win] ** 2)) < 1e-4: out.append(0.0); continue
        n = 1 << int(np.ceil(np.log2(len(f) + win)))
        r = np.fft.irfft(np.conj(np.fft.rfft(f[:win], n)) * np.fft.rfft(f, n), n)[:tmax + 1]
        e = np.concatenate([[0.0], np.cumsum(f ** 2)]); t = np.arange(tmax + 1)
        d = e[win] + (e[t + win] - e[t]) - 2 * r
        cm = d[1:] * np.arange(1, tmax + 1) / np.maximum(np.cumsum(d[1:]), 1e-12)
        cand = np.where(cm[tmin - 1:] < thr)[0]
        if not len(cand): out.append(0.0); continue
        t = cand[0] + tmin
        while t < tmax - 1 and cm[t] < cm[t - 1]: t += 1
        t -= 1
        a, b, c = cm[t - 2], cm[t - 1], cm[t]
        shift = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) else 0
        out.append(SR / (t + shift))
    return np.array(out)

def cents(f, midi): return 1200 * np.log2(f / (440 * 2 ** ((midi - 69) / 12)))

def align(x, sec):
    """Best offset (s) of the recording relative to the guide: maximise voice inside sing windows, penalise voice elsewhere."""
    db = frames_db(x); fr = 100
    floor = np.percentile(db, 20); act = (db > floor + 12).astype(float)
    L = int(sec['length'] * fr) + 1; mask = np.full(L, -0.6)
    for it in sec['items']:
        if sec['kind'] == 'sustain': mask[int(it['sing'] * fr):int(it['end'] * fr)] = 1
        else:
            for h in it['hits']: mask[int(h * fr):int((h + 0.35) * fr)] = 1
        mask[int(it['ref'] * fr):int((it['sing'] - 0.1) * fr)] = -0.6
    mask[int((sec['clap'] - 0.05) * fr):int((sec['clap'] + 0.25) * fr)] = 0  # the clap itself is neither
    scores = {}
    for off in range(-200, max(1, len(act) - L // 3)):  # recording time = guide time + off/fr
        a = act[max(0, off):off + L]; m = mask[max(0, -off):max(0, -off) + len(a)]
        if len(a) < L // 3: break
        scores[off] = float(np.dot(a[:len(m)], m))
    top = max(scores.values()); first = min(o for o, v in scores.items() if v >= top - 1e-6)
    end = first
    while scores.get(end + 1, -1e9) >= top - 1e-6: end += 1      # only the contiguous plateau around the best offset
    off = (first + end) / 2 / fr
    if sec['kind'] != 'sustain':
        # short windows leave a plateau: snap to where the voice actually starts in each window
        deltas = []
        for it in sec['items']:
            for h in it['hits']:
                s0 = int((h + off - 0.3) * SR); seg = x[max(0, s0):s0 + int(0.7 * SR)]
                sp = voiced_span(seg, floor + 15)
                if sp: deltas.append(sp[0] / SR - 0.3)
        if deltas: off += float(np.clip(np.median(deltas), -0.25, 0.25))
    return off, top

def fade(y, a=0.01, b=0.06):
    y = y.copy(); na, nb = int(a * SR), int(b * SR)
    y[:na] *= np.linspace(0, 1, na); y[-nb:] *= np.linspace(1, 0, nb); return y

def voiced_span(seg, floor_db):
    db = frames_db(seg, 240, 480); on = np.where(db > floor_db)[0]
    if not len(on): return None
    # longest run of active frames (allow 60 ms gaps)
    runs, s, prev = [], on[0], on[0]
    for k in on[1:]:
        if k - prev > 12: runs.append((s, prev)); s = k
        prev = k
    runs.append((s, prev)); s, e = max(runs, key=lambda r: r[1] - r[0])
    return s * 240, e * 240 + 480

def attack(y, drop=10):
    """Sample index where the note really speaks: first 1 ms frame within `drop` dB of the take's sustained level.
    Breath, soft scoops and a slow swell before it would make every note sound late in the sampler."""
    h = SR // 1000; n = len(y) // h
    if n < 5: return 0
    e = 20 * np.log10(np.sqrt(np.mean(y[:n * h].reshape(n, h) ** 2, axis=1)) + 1e-9)
    return int(np.argmax(e > np.percentile(e, 95) - drop)) * h

def split_hits(x, expected, gap, max_len=1.2, min_rise=6):
    """Cut repeated short sounds by the waveform, not the clock: around each expected time (±~half a gap) take the
    strongest re-attack of a smoothed envelope, then end each piece just before the next one starts.
    Returns [(start_sample, end_sample)] (None for a hit that was not sung)."""
    lo = max(0, int((min(expected) - 0.6 * gap) * SR)); hi = min(len(x), int((max(expected) + gap + max_len) * SR))
    spans = split_hits_local(x[lo:hi], [e - lo / SR for e in expected], gap, max_len, min_rise)
    return [(a + lo, b + lo) if a is not None else None for a, b in ((sp if sp else (None, None)) for sp in spans)]

def split_hits_local(x, expected, gap, max_len, min_rise):
    hop, win = SR // 200, SR // 50                                    # 5 ms hop, 20 ms RMS window
    n = max(1, (len(x) - win) // hop); idx = np.arange(win)[None, :] + hop * np.arange(n)[:, None]
    env = 10 * np.log10(np.mean(x[idx] ** 2, axis=1) + 1e-12); pk = np.percentile(env, 99); env = np.maximum(env, pk - 60)
    odf = np.array([env[t] - env[max(0, t - 8):t].min() if t else 0.0 for t in range(n)])   # rise over the last 40 ms
    odf[env < pk - 30] = 0
    starts = []
    for e in expected:
        a, b = int((e - 0.4 * gap) * 200), int((e + 0.5 * gap) * 200)
        a = max(a, (starts[-1] // hop + int(0.3 * gap * 200)) if starts and starts[-1] is not None else 0); b = min(b, n)
        if b - a < 3 or odf[a:b].max() < min_rise: starts.append(None); continue
        t = a + int(np.argmax(odf[a:b]))
        # refine to the 1 ms frame where this hit really speaks
        s0 = max(0, (t - 8) * hop); seg = x[s0:s0 + int(0.25 * SR)]
        starts.append(s0 + attack(seg))
    out = []
    for k, st in enumerate(starts):
        if st is None: out.append(None); continue
        nxt = next((v for v in starts[k + 1:] if v is not None), len(x))
        end = min(nxt - int(0.005 * SR), st + int(max_len * SR), len(x))
        # stop where the sound has died away (40 dB under its own peak)
        t0, t1 = st // hop, max(st // hop + 1, min(n, end // hop))
        local = env[t0:t1]; peak_at = int(np.argmax(local))
        quiet = np.where(local[peak_at:] < local[peak_at] - 40)[0]
        if len(quiet): end = min(end, (t0 + peak_at + quiet[0]) * hop + int(0.03 * SR))
        out.append((max(0, st - int(0.003 * SR)), end))
    return out

def extend_tail(y, f0, max_tail=2.5, floor_db=-55):
    """Let a cut-short note ring out instead of stopping: continue it pitch-synchronously (repeat whole periods of its
    last ~80 ms with crossfades), decay at the rate the note was already decaying, darken it as it fades, and add a
    touch of diffuse room. Used where a take had to be cut before the next note in a continuous performance."""
    from scipy.signal import fftconvolve, butter, sosfilt
    P = SR / f0; grain_periods = max(2, int(round(0.08 * f0))); G = int(round(grain_periods * P))
    if len(y) < G + int(0.25 * SR): return y
    h = SR // 50; tail_env = 20 * np.log10(np.sqrt(np.mean(y[-int(0.4 * SR) // h * h:].reshape(-1, h) ** 2, axis=1)) + 1e-9)
    slope = np.polyfit(np.arange(len(tail_env)) * h / SR, tail_env, 1)[0]                      # dB per second
    slope = float(np.clip(slope if slope < -8 else -20, -60, -8))
    length = int(min(max_tail, floor_db / slope) * SR)
    grain = y[-G:].copy(); xf = int(0.02 * SR); win = np.ones(G); win[:xf] = np.linspace(0, 1, xf); win[-xf:] = np.linspace(1, 0, xf)
    hop = G - xf; tail = np.zeros(length + G)
    for k, pos in enumerate(range(0, length, hop)):
        tail[pos:pos + G] += grain * win
    tail = tail[:length]
    t = np.arange(length) / SR; tail *= 10 ** (slope * t / 20)
    dark = sosfilt(butter(1, max(1500, 6 * f0), 'lowpass', fs=SR, output='sos'), tail); mix = np.clip(t / (0.6 * length / SR + 1e-9), 0, 1)
    tail = tail * (1 - mix) + dark * mix                                                        # highs die first, like a real string
    rng = np.random.default_rng(1); ir = rng.standard_normal(int(0.5 * SR)) * np.exp(-6.9 * np.arange(int(0.5 * SR)) / (0.5 * SR)); ir /= np.sqrt(np.sum(ir ** 2))
    room = fftconvolve(np.concatenate([y[-G:] * win, tail]), ir)[:G + length]
    out = np.concatenate([y[:-xf], y[-xf:] * np.linspace(1, 0, xf) + tail[:xf] * np.linspace(0, 1, xf), tail[xf:]])
    out[len(y) - G:] += room[:len(out) - (len(y) - G)] * 0.12
    n = int(0.05 * SR); out[-n:] *= np.linspace(1, 0, n)
    return out

def make_loop(y, a, b, L=int(0.06 * SR)):
    """Pick loop end near b whose waveform matches the loop start, then bake a crossfade so the loop is seamless."""
    ref = y[a:a + 960]; best = (-2, b)
    for e in range(b - 600, b + 600):
        seg = y[e:e + 960]
        if len(seg) < 960: break
        c = float(np.dot(ref, seg) / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-12))
        if c > best[0]: best = (c, e)
    e = best[1]; y = y.copy(); w = np.linspace(0, 1, L)
    y[e - L:e] = y[e - L:e] * (1 - w) + y[a - L:a] * w
    return y, a, e, best[0]

def write(path, y):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--id', default='my-voice'); ap.add_argument('--name', default='我的人声')
    ap.add_argument('--studio', default=os.path.dirname(HERE)); ap.add_argument('--recordings', default=os.path.join(HERE, 'recordings'))
    a = ap.parse_args()
    TL = json.load(open(os.path.join(HERE, 'timeline.json'), encoding='utf-8'))
    out_dir = os.path.join(a.studio, 'data', 'samples', a.id); bb_id = a.id + '-beatbox'; bb_dir = os.path.join(a.studio, 'data', 'samples', bb_id)
    voice, beat, report = [], [], []
    for sec in TL['sections']:
        files = sorted(f for f in glob.glob(os.path.join(a.recordings, sec['id'] + '*'))
                       if re.match(re.escape(sec['id']) + r'(\D|$)', os.path.basename(f)) and f.lower().endswith(('.wav', '.flac', '.m4a', '.mp3', '.ogg', '.aac')))
        sources = []
        # recorder page: one file per item in recordings/items/, each starting PRE seconds before the singing
        item_files = {it['id']: os.path.join(a.recordings, 'items', it['id'] + '.wav') for it in sec['items']}
        item_files = {k: v for k, v in item_files.items() if os.path.exists(v)}
        if item_files:
            x = np.zeros(int((sec['length'] + 3) * SR)); parts = []
            for it in sec['items']:
                if it['id'] not in item_files: continue
                y = load(item_files[it['id']]); i = int((it['sing'] - PRE) * SR); n = min(len(y), len(x) - i); x[i:i + n] += y[:n]; parts.append(y)
            pre = np.concatenate([y[:int(0.4 * SR)] for y in parts])   # before the count-in ends nobody is singing: room noise only
            sources.append((f'录音页 {len(item_files)} 条', x, 0.0, float(np.percentile(frames_db(pre), 50)), None))
        for f in files:  # whole-section takes recorded along with a guide track
            x = load(f); off, score = align(x, sec); sources.append((os.path.basename(f), x, off, float(np.percentile(frames_db(x), 20)), score))
        if not sources: report.append({'section': sec['id'], 'status': '未录'}); continue
        for take, (fname, x, off, floor, score) in enumerate(sources, 1):
            report.append({'section': sec['id'], 'file': fname, 'offset': round(off, 3), 'alignScore': score and round(score, 1), 'noiseFloorDb': round(floor, 1)})
            for it in sec['items']:
                t0 = it['sing'] + off - 0.3; t1 = it['end'] + off + 1.1
                seg = x[max(0, int(t0 * SR)):int(t1 * SR)]
                row = {'item': it['id'], 'take': take}
                if sec['kind'] == 'perc':
                    hits = [x[a0:b0] for a0, b0 in filter(None, split_hits(x, [h + off for h in it['hits']], 0.5, 0.6, 3))]
                    for k, y in enumerate(hits, 1):
                        name = f"bb-{it['key']}-{take}{k}.wav"; write(os.path.join(bb_dir, name), fade(y / (np.max(np.abs(y)) + 1e-9) * 0.89, 0.002, 0.03))
                        beat.append({'midi': 60, 'url': f'/samples/{bb_id}/{name}', 'articulation': it['key'], 'roundRobin': len([b for b in beat if b['articulation'] == it['key']]) + 1,
                                     'rms': float(20 * np.log10(np.sqrt(np.mean(y[:int(0.05 * SR)] ** 2)) / (np.max(np.abs(y)) + 1e-9) * 0.89 + 1e-9))})
                    row.update(found=len(hits)); report.append(row); continue
                art = ART[sec['id']][0]; midi = it['midi']
                if sec['kind'] == 'sustain':
                    sp = voiced_span(seg, floor + 12)
                    if not sp or (sp[1] - sp[0]) / SR < 1.5: row.update(status='跳过（没有足够长的声音）'); report.append(row); continue
                    y = seg[max(0, sp[0] - 480):sp[1] + int(0.05 * SR)]
                    lead = int(0.004 * SR); y = y[max(0, attack(y) - lead):]; on = lead   # start 4 ms before the voice speaks
                    f0 = yin(y); fr = 100; v = f0[int(0.4 * fr):max(int(0.4 * fr) + 1, len(f0) - int(0.4 * fr))]; v = v[v > 0]
                    if len(v) < 20: row.update(status='跳过（测不到稳定音高）'); report.append(row); continue
                    c = cents(v, midi); dev = float(np.median(c)); wob = float(np.percentile(c, 90) - np.percentile(c, 10))
                    oct = int(round(dev / 1200)); dev -= 1200 * oct; midi += 12 * oct; c = c - 1200 * oct   # sung an octave off: keep it at its real pitch
                    if abs(dev) > 120: row.update(status=f'跳过（音高偏差 {dev:+.0f} 音分，可能唱成了别的音）'); report.append(row); continue
                    if oct: row.update(octave=oct)
                    rms = float(np.sqrt(np.mean(y[on + int(0.4 * SR):len(y) - int(0.5 * SR)] ** 2)))
                    y = y * (10 ** (-20 / 20) / max(rms, 1e-6)); pk = float(np.max(np.abs(y))); gain = 0.0
                    if pk > 0.94: gain = 20 * np.log10(pk / 0.94); y = y * 0.94 / pk
                    ls = on + int(0.6 * SR); le = len(y) - int(0.55 * SR)
                    loop = None
                    if le - ls > int(0.6 * SR):
                        y, ls, le, q = make_loop(y, ls, le); loop = (ls / SR, le / SR, q)
                    name = f'{art}-{midi}-{take}.wav'; write(os.path.join(out_dir, name), fade(y, 0.003, 0.08))
                    s = {'midi': midi, 'url': f'/samples/{a.id}/{name}', 'articulation': art, 'tuneCents': round(-dev), 'gainDb': round(gain, 1), 'roundRobin': take}
                    if loop: s.update(loopStart=round(loop[0], 4), loopEnd=round(loop[1], 4))
                    voice.append(s); row.update(status='ok', cents=round(dev), wobble=round(wob), loopMatch=loop and round(loop[2], 3))
                else:
                    got, hits = 0, []
                    for span in split_hits(x, [h + off for h in it['hits']], 1.0):
                        if not span: continue
                        y = x[span[0]:span[1]]; f0 = yin(y); v = f0[f0 > 0]
                        if len(v) >= 3: hits.append((y, float(np.median(cents(v, it['midi'])))))
                    # one octave decision per note from all its hits, so a single sub-harmonic misread cannot drop a hit an octave
                    oct = int(round(np.median([d for _, d in hits]) / 1200)) if hits else 0; midi = it['midi'] + 12 * oct
                    for y, dev in hits:
                        dev -= 1200 * oct
                        if abs(dev) > 120: continue
                        pk = float(np.max(np.abs(y))); y = y * 0.89 / max(pk, 1e-6); got += 1
                        name = f'{art}-{midi}-{take}{got}.wav'; write(os.path.join(out_dir, name), fade(y, 0.003, 0.05))
                        voice.append({'midi': midi, 'url': f'/samples/{a.id}/{name}', 'articulation': art, 'tuneCents': round(-dev), 'gainDb': 0, 'roundRobin': got + 10 * (take - 1)})
                    row.update(status='ok' if got else '跳过', takes=got); report.append(row)
    best = {}
    for s in voice:
        if 'loopStart' in s or s['articulation'] in ('oo', 'aa', 'mm', 'falsetto'):
            k = (s['articulation'], s['midi']); best[k] = s if k not in best or abs(s['tuneCents']) < abs(best[k]['tuneCents']) else best[k]
    voice = [s for s in voice if not (s['articulation'] in ('oo', 'aa', 'mm', 'falsetto')) or best[(s['articulation'], s['midi'])] is s]
    # level-match short articulations to sustains of the same family by their own loudest 50 ms
    for s in voice:
        p = os.path.join(out_dir, os.path.basename(s['url'])); b = open(p, 'rb').read(); s['bytes'] = len(b)
    arts = [a2 for a2 in ['oo', 'aa', 'mm', 'dm', 'ba', 'falsetto'] if any(s['articulation'] == a2 for s in voice)]
    os.makedirs(os.path.join(a.studio, 'data', 'user-instruments'), exist_ok=True)
    if voice:
        names = {v[0]: v[1] for v in ART.values()}
        inst = {'kind': 'instrument', 'id': a.id, 'name': a.name, 'englishName': 'Personal Voice', 'family': 'vocal',
                'description': f'用 voice-kit 录制的个人人声：{"、".join(names[x] for x in arts)}。只保存在本机，不会上传或随源码发布。',
                'icon': 'voice', 'color': '#B8572A', 'license': 'personal', 'sourceUrl': 'voice-kit/录音说明.md', 'gmProgram': 52,
                'attack': 0.006, 'release': 0.3, 'volumeDb': 0, 'articulations': [{'id': x, 'name': names[x], **({'release': 0.04} if x in ('dm', 'ba') else {'legato': True})} for x in arts],
                'defaultArticulation': arts[0], 'samples': voice}
        json.dump(inst, open(os.path.join(a.studio, 'data', 'user-instruments', a.id + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if beat:
        for b in beat:
            b['gainDb'] = round(min(0.0, -20 - b.pop('rms')), 1)   # hits are peak-normalised; only ever turn them down; b['bytes'] = os.path.getsize(os.path.join(bb_dir, os.path.basename(b['url'])))
        keys = list(dict.fromkeys(b['articulation'] for b in beat))
        labels = {it['key']: it['label'] for sec in TL['sections'] if sec['kind'] == 'perc' for it in sec['items']}
        inst = {'kind': 'instrument', 'id': bb_id, 'name': a.name + ' · Beatbox', 'englishName': 'Personal Beatbox', 'family': 'vocal',
                'description': '用 voice-kit 录制的个人 beatbox，只保存在本机。', 'icon': 'drum', 'color': '#C2553D', 'license': 'personal',
                'sourceUrl': 'voice-kit/录音说明.md', 'gmProgram': 0, 'attack': 0.001, 'release': 0.05, 'volumeDb': 0, 'percussive': True,
                'articulations': [{'id': k, 'name': labels.get(k, k)} for k in keys], 'defaultArticulation': keys[0], 'samples': beat}
        json.dump(inst, open(os.path.join(a.studio, 'data', 'user-instruments', bb_id + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(report, open(os.path.join(HERE, 'report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for r in report:
        if 'item' not in r: print(r)
        elif r.get('status') != 'ok' or abs(r.get('cents', 0)) > 35 or r.get('wobble', 0) > 60: print('  ', r)
    print(f'voice samples: {len(voice)}  beatbox samples: {len(beat)}')

if __name__ == '__main__':
    main()
