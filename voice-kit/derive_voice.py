"""Derive a new voice instrument from a recorded one with the WORLD vocoder (pyworld), e.g. a female-sounding voice
from a male recording. Pitch and vocal-tract size are changed separately, so it does not sound like a sped-up tape:
    python derive_voice.py --src my-voice --id my-voice-f --name "我的人声 · 女声" --shift 4 --formant 1.17
--shift moves the pitch (semitones); --formant scales the spectral envelope (>1 = shorter vocal tract, more feminine);
--breath adds a little aperiodicity. Short "dm" bass hits are left out by default (a low male idiom)."""
import argparse, importlib.util, json, os
import numpy as np
import pyworld as pw

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sv', os.path.join(HERE, 'slice_voice.py')); sv = importlib.util.module_from_spec(spec); spec.loader.exec_module(sv)
SR = sv.SR

def convert(x, shift, formant, breath):
    f0, t = pw.harvest(x, SR, f0_floor=60, f0_ceil=1300, frame_period=5)
    f0 = pw.stonemask(x, f0, t, SR)
    sp = pw.cheaptrick(x, f0, t, SR); ap = pw.d4c(x, f0, t, SR)
    bins = np.arange(sp.shape[1]); src = np.clip(bins / formant, 0, sp.shape[1] - 1)   # read each output bin from a lower input frequency
    sp2 = np.stack([np.interp(src, bins, row) for row in sp]); ap2 = np.stack([np.interp(src, bins, row) for row in ap])
    ap2 = 1 - (1 - ap2) * (1 - breath)
    y = pw.synthesize(f0 * 2 ** (shift / 12), sp2, ap2, SR, frame_period=5)[:len(x)]
    return y * (np.sqrt(np.mean(x ** 2)) / max(np.sqrt(np.mean(y ** 2)), 1e-9))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='my-voice'); ap.add_argument('--id', default='my-voice-f'); ap.add_argument('--name', default='我的人声 · 女声')
    ap.add_argument('--shift', type=float, default=4); ap.add_argument('--formant', type=float, default=1.17); ap.add_argument('--breath', type=float, default=0.06)
    ap.add_argument('--skip', default='dm'); ap.add_argument('--studio', default=os.path.dirname(HERE))
    a = ap.parse_args()
    inst = json.load(open(os.path.join(a.studio, 'data', 'user-instruments', a.src + '.json'), encoding='utf-8'))
    out_dir = os.path.join(a.studio, 'data', 'samples', a.id); os.makedirs(out_dir, exist_ok=True)
    skip = set(filter(None, a.skip.split(','))); samples = []
    for s in inst['samples']:
        if s['articulation'] in skip: continue
        x = sv.load(os.path.join(a.studio, 'data', s['url'].lstrip('/')))
        y = convert(x, a.shift, a.formant, a.breath)
        new = {k: v for k, v in s.items() if k not in ('url', 'bytes', 'loopStart', 'loopEnd')}
        new['midi'] = s['midi'] + int(round(a.shift))
        if 'loopStart' in s:   # the vocoder re-renders the crossfade region, so find and bake the loop again
            y, ls, le, q = sv.make_loop(y, int(s['loopStart'] * SR), int(s['loopEnd'] * SR)); new.update(loopStart=round(ls / SR, 4), loopEnd=round(le / SR, 4))
        pk = float(np.max(np.abs(y)))
        if pk > 0.94: y *= 0.94 / pk; new['gainDb'] = round(s.get('gainDb', 0) + 20 * np.log10(pk / 0.94), 1)
        name = os.path.basename(s['url']).replace('.wav', '') + '-f.wav'
        sv.write(os.path.join(out_dir, name), sv.fade(y, 0.003, 0.05))
        new.update(url=f'/samples/{a.id}/{name}', bytes=os.path.getsize(os.path.join(out_dir, name)))
        samples.append(new)
    arts = [x for x in inst['articulations'] if x['id'] not in skip]
    out = {**{k: v for k, v in inst.items() if k not in ('samples', 'articulations', 'id', 'name', 'description')}, 'id': a.id, 'name': a.name,
           'englishName': 'Personal Voice (derived)', 'description': f'由「{inst["name"]}」用 WORLD 声码器转换：音高 {a.shift:+g} 半音，共振峰 ×{a.formant}。只保存在本机。',
           'derivedFrom': {'id': a.src, 'shift': a.shift, 'formant': a.formant, 'breath': a.breath}, 'articulations': arts, 'samples': samples}
    json.dump(out, open(os.path.join(a.studio, 'data', 'user-instruments', a.id + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{a.id}: {len(samples)} samples, articulations {[x["id"] for x in arts]}, roots {min(s["midi"] for s in samples)}–{max(s["midi"] for s in samples)}')

if __name__ == '__main__':
    main()
