"""Publish a voice-kit instrument as a CC0 sample repository, then link it into the public library.

Step 1 (local only): build the sample repo from data/user-instruments/<id>.json (+ <id>-beatbox.json if present).
    python publish_voice.py stage --repo ../My-Voice
  FLAC files, instrument.json, an SFZ for DAW users, CC0 LICENSE and READMEs; commits locally, never pushes.

Step 2 (after the repo has been pushed to GitHub): point the library at pinned raw URLs.
    python publish_voice.py link --repo ../My-Voice --owner sparklecatta-lang [--library <other library.json> ...]
  Writes entries with download URL, bytes and SHA-256 into public/library.json, copies the FLACs into the local
  sample cache (no re-download) and retires the personal JSON so the ids do not collide."""
import argparse, hashlib, json, os, shutil, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
STUDIO = os.path.dirname(HERE)
AUTHOR = 'Anonymous'  # pass --author with your name
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
note = lambda m: f'{NAMES[m % 12]}{m // 12 - 1}'
git = lambda repo, *a: subprocess.run(['git', '-C', repo, *a], capture_output=True, text=True, check=True).stdout.strip()

def instruments(studio, base_id):
    out = []
    for iid in (base_id, base_id + '-beatbox'):
        p = os.path.join(studio, 'data', 'user-instruments', iid + '.json')
        if os.path.exists(p): out.append(json.load(open(p, encoding='utf-8')))
    if not out: raise SystemExit(f'没有找到 data/user-instruments/{base_id}.json，先运行 slice_voice.py')
    return out

def stage(a):
    global AUTHOR; AUTHOR = a.author
    insts = instruments(a.studio, a.id); repo = a.repo
    os.makedirs(repo, exist_ok=True)
    if not os.path.isdir(os.path.join(repo, '.git')): git(repo, 'init', '-b', 'main')
    manifest = []
    for inst in insts:
        d = os.path.join(repo, 'samples', inst['id']); shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
        samples = []
        for s in inst['samples']:
            src = os.path.join(a.studio, 'data', s['url'].lstrip('/'))
            name = os.path.splitext(os.path.basename(s['url']))[0] + '.flac'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-c:a', 'flac', '-compression_level', '8', os.path.join(d, name)], check=True)
            samples.append({**{k: v for k, v in s.items() if k not in ('url', 'bytes', 'downloadUrl')}, 'file': f"samples/{inst['id']}/{name}"})
        manifest.append({**{k: v for k, v in inst.items() if k not in ('samples', 'personal')}, 'license': 'CC0-1.0', 'author': AUTHOR, 'samples': samples})
    json.dump({'author': AUTHOR, 'license': 'CC0-1.0', 'instruments': manifest}, open(os.path.join(repo, 'instrument.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    shutil.copyfile(os.path.join(HERE, 'CC0-1.0.txt'), os.path.join(repo, 'LICENSE'))
    # SFZ for DAW samplers (sforzando etc.): one file per instrument, articulations as keyswitch-free groups
    for inst in manifest:
        lines = [f'// {inst["name"]} · {AUTHOR} · CC0 1.0', '// Each <group> is one articulation; load the file and mute groups you do not want.', '']
        arts = {x['id']: x['name'] for x in inst.get('articulations', [])}
        for art in arts:
            ss = sorted([s for s in inst['samples'] if s.get('articulation') == art], key=lambda s: s['midi'])
            if not ss: continue
            lines.append(f'<group> // {art} · {arts[art]}' + (' seq_length=%d' % max(s.get('roundRobin', 1) for s in ss) if inst.get('percussive') else ''))
            roots = sorted({s['midi'] for s in ss})
            for s in ss:
                k = roots.index(s['midi']); lo = 0 if k == 0 else (roots[k - 1] + s['midi']) // 2 + 1; hi = 127 if k == len(roots) - 1 else (s['midi'] + roots[k + 1]) // 2
                r = f"<region> sample={s['file']} pitch_keycenter={s['midi']} lokey={lo} hikey={hi} tune={s.get('tuneCents', 0)} volume={s.get('gainDb', 0)}"
                if inst.get('percussive'): r = f"<region> sample={s['file']} key=60 pitch_keytrack=0 seq_position={s.get('roundRobin', 1)} volume={s.get('gainDb', 0)}"
                if 'loopStart' in s: r += f" loop_mode=loop_continuous loop_start={round(s['loopStart'] * 48000)} loop_end={round(s['loopEnd'] * 48000)}"
                lines.append(r)
            lines.append('')
        open(os.path.join(repo, inst['id'] + '.sfz'), 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    voice = manifest[0]
    rng = lambda art: (lambda ms: f'{note(min(ms))}–{note(max(ms))}' if ms else '')([s['midi'] for s in voice['samples'] if s['articulation'] == art])
    table = '\n'.join(f"| `{x['id']}` | {x['name']} | {rng(x['id'])} |" for x in voice['articulations'])
    bb = len(manifest) > 1
    open(os.path.join(repo, 'README.md'), 'w', encoding='utf-8', newline='\n').write(f"""# {os.path.basename(os.path.normpath(repo))} · 人声采样

[English](README.en.md)

{AUTHOR}自己录的人声采样：无词的元音长音、人声贝斯短音{'和 beatbox' if bb else ''}。以 **CC0 1.0** 发布，可以随意使用、修改、商用，不需要署名。

主要给 [XSXB-Band · 小宝乐队](https://github.com/sparklecatta-lang/XSXB-Band) 用：工作室用到这件乐器时会自动从这里下载。也可以单独用：用 `.sfz` 文件加载到 sforzando 等 SFZ 采样器里。

| 奏法 | 名称 | 采样音域 |
|---|---|---|
{table}

- 48 kHz、16-bit、单声道 FLAC，干声，每个小三度一个采样。
- 长音带循环点，写在 `instrument.json` 和 `.sfz` 文件里。
- 音高已经测量过，修正量写在 `tuneCents` / `tune` 里。
- 采样不包含歌词，没有颤音。

录制和切片工具在 XSXB-Band 的 `voice-kit/` 目录里，你也可以用它录一套自己的声音。
""")
    open(os.path.join(repo, 'README.en.md'), 'w', encoding='utf-8', newline='\n').write(f"""# {os.path.basename(os.path.normpath(repo))}

[中文](README.md)

Voice samples recorded by {AUTHOR} (Pixel Xiaobao): wordless sustained vowels and short vocal-bass hits{' plus beatbox' if bb else ''}. Released under **CC0 1.0**: use, modify and sell freely, no attribution needed.

Made for [XSXB-Band](https://github.com/sparklecatta-lang/XSXB-Band), which downloads these files on demand. Also usable on its own via the `.sfz` files (e.g. in sforzando).

| Articulation | Name | Sampled range |
|---|---|---|
{table}

- 48 kHz, 16-bit, mono FLAC, dry, one sample per minor third.
- Sustains carry loop points (in `instrument.json` and the SFZ).
- Pitch is measured, with corrections in `tuneCents` / `tune`.
- No lyrics, no vibrato.

The recording and slicing kit is in XSXB-Band's `voice-kit/` folder, so you can record your own.
""")
    git(repo, 'add', '-A')
    if git(repo, 'status', '--porcelain'):
        ident = [x for n, v in (('user.name', a.git_name), ('user.email', a.git_email)) if v for x in ('-c', f'{n}={v}')]
        git(repo, *ident, 'commit', '-q', '-m', 'Voice samples (CC0)')
    size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(os.path.join(repo, 'samples')) for f in fs)
    print(f'staged {sum(len(i["samples"]) for i in manifest)} files, {size / 1e6:.1f} MB, commit {git(repo, "rev-parse", "HEAD")[:12]} (not pushed)')

def link(a):
    global AUTHOR; AUTHOR = a.author
    repo = a.repo; sha = a.commit or git(repo, 'rev-parse', 'HEAD')
    if not a.allow_unpushed and sha not in git(repo, 'ls-remote', 'origin'):
        try: pushed = git(repo, 'branch', '-r', '--contains', sha)
        except subprocess.CalledProcessError: pushed = ''
        if not pushed: raise SystemExit(f'{sha[:12]} 还没有推到 GitHub；先推送，或用 --allow-unpushed 只做演练')
    name = a.name or os.path.basename(os.path.normpath(repo))
    base = f'https://raw.githubusercontent.com/{a.owner}/{name}/{sha}/'
    man = json.load(open(os.path.join(repo, 'instrument.json'), encoding='utf-8'))
    entries = []
    for inst in man['instruments']:
        samples = []
        for s in inst['samples']:
            f = os.path.join(repo, s['file']); b = open(f, 'rb').read()
            cache = os.path.join(a.studio, 'data', 'samples', inst['id']); os.makedirs(cache, exist_ok=True)
            shutil.copyfile(f, os.path.join(cache, os.path.basename(f)))
            samples.append({**{k: v for k, v in s.items() if k != 'file'}, 'url': f"/samples/{inst['id']}/{os.path.basename(f)}",
                            'downloadUrl': base + s['file'], 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()})
        desc = inst['description'].split('。')[0].replace('用 voice-kit 录制的个人人声', f'{AUTHOR}的人声').replace('用 voice-kit 录制的个人 beatbox', f'{AUTHOR}的 beatbox')
        entries.append({**{k: v for k, v in inst.items() if k != 'samples'}, 'kind': 'instrument', 'description': desc + '。干声逐音采样，长音带循环点，CC0。',
                        'sourceUrl': f'https://github.com/{a.owner}/{name}', 'licenseUrl': f'https://github.com/{a.owner}/{name}/blob/{sha}/LICENSE',
                        'sourceRevision': sha, 'samples': samples})
    for lib_path in [os.path.join(a.studio, 'public', 'library.json'), *a.library]:
        lib = json.load(open(lib_path, encoding='utf-8')); ids = {e['id'] for e in entries}
        lib = [i for i in lib if i['id'] not in ids]
        at = next((k for k, i in enumerate(lib) if i.get('kind') in ('cabinet', 'amp-model')), len(lib))
        lib[at:at] = entries
        open(lib_path, 'w', encoding='utf-8', newline='').write(json.dumps(lib, ensure_ascii=False, indent=2) + '\n')
        print('linked', ', '.join(ids), '->', lib_path)
    done = os.path.join(a.studio, 'data', 'user-instruments', '_published'); os.makedirs(done, exist_ok=True)
    for e in entries:
        p = os.path.join(a.studio, 'data', 'user-instruments', e['id'] + '.json')
        if os.path.exists(p): shutil.move(p, os.path.join(done, e['id'] + '.json'))

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    for c in ('stage', 'link'):
        p = sub.add_parser(c); p.add_argument('--repo', required=True); p.add_argument('--id', default='my-voice'); p.add_argument('--studio', default=STUDIO); p.add_argument('--author', default=AUTHOR)
    st = sub.choices['stage']; st.add_argument('--git-name'); st.add_argument('--git-email')  # default: your git config
    ln = sub.choices['link']; ln.add_argument('--owner', required=True); ln.add_argument('--name'); ln.add_argument('--commit')
    ln.add_argument('--library', action='append', default=[]); ln.add_argument('--allow-unpushed', action='store_true')
    a = ap.parse_args(); (stage if a.cmd == 'stage' else link)(a)
