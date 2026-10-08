"""Publish derived instruments (made in the studio from CC0 / public-domain sources, or recorded / synthesised here)
as one CC0 sample repository, then link them into the public library.

Step 1 (local only): build the sample repo from <studio>/data/user-instruments/<id>.json.
    python scripts/publish_samples.py stage --studio <studio> --repo ../XSXB-Band-Samples
  FLAC files, instrument.json, one SFZ per instrument, CC0 LICENSE, READMEs with every upstream source; commits locally.

Step 2 (after the sample repo is pushed): point library.json files at pinned raw URLs.
    python scripts/publish_samples.py link --studio <studio> --repo ../XSXB-Band-Samples --owner <github user> --library public/library.json
  Writes entries with download URL, bytes and SHA-256, copies the FLACs into the studio's sample cache (no re-download)
  and retires the personal JSONs so the ids do not collide.

Only instruments whose every source is CC0, public domain or made here may be listed in PUBLISH."""
import argparse, hashlib, json, os, re, shutil, subprocess

AUTHOR = '像素小宝 (sparklecatta-lang)'
# id → (upstream source, licence of the upstream material)
PUBLISH = {
    'xsxb-voice': ('Recorded by the author with voice-kit', 'original'),
    'xsxb-voice-f': ('Derived from xsxb-voice (WORLD vocoder formant shift)', 'original'),
    'xsxb-voice-beatbox': ('Recorded by the author with voice-kit', 'original'),
    'guzheng': ('https://freesound.org/people/Pufermufin/sounds/396868/', 'CC0 1.0'),
    'suona-oboe': ('https://github.com/sgossner/VSCO-2-CE (oboe), reshaped toward a suona', 'CC0 1.0'),
    'xiao': ('https://github.com/sgossner/VCSL (recorder), reshaped toward a xiao', 'CC0 1.0'),
    'crate-classical': ('Wikimedia Commons recordings, see docs/SAMPLE-CRATE.md in XSXB-Band', 'Public domain / CC0 (per chop)'),
    'crate-speech': ('NASA, JFK Library, Freesound, see docs/SAMPLE-CRATE.md in XSXB-Band', 'Public domain / CC0 (per chop)'),
    'crate-vocals': ('Freesound, see docs/SAMPLE-CRATE.md in XSXB-Band', 'CC0 1.0 (per chop)'),
    'nujabes-chops': ('An original jazz phrase rendered in the studio from CC0 samples (VCSL sax, VSCO piano, Meatbass, Virtuosity ride), then aged and chopped', 'original'),
    'gfunk-lead': ('Synthesised in the studio', 'original'),
    'gfunk-bass': ('Synthesised in the studio', 'original'),
}
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
note = lambda m: f'{NAMES[m % 12]}{m // 12 - 1}'
git = lambda repo, *a: subprocess.run(['git', '-C', repo, *a], capture_output=True, text=True, check=True).stdout.strip()
# drop "personal / local only" wording that only made sense before publishing
def clean(text):
    text = (text or '').replace('用 voice-kit 录制的个人', f'{AUTHOR.split(" ")[0]}用 voice-kit 录制的')
    text = re.sub(r'[，,]?[^，。]*(本机|个人练习|不对外|local only)[^。]*', '', text)
    return re.sub(r'。{2,}', '。', text).strip()

def sfz(inst):
    lines = [f'// {inst["name"]} · {AUTHOR} · CC0 1.0', '// Each <group> is one articulation; load the file and mute groups you do not want.', '']
    for art in inst.get('articulations', []):
        ss = sorted([s for s in inst['samples'] if s.get('articulation', art['id']) == art['id']], key=lambda s: s['midi'])
        if not ss: continue
        lines.append(f'<group> // {art["id"]} · {art["name"]}' + (f' seq_length={max(s.get("roundRobin", 1) for s in ss)}' if inst.get('percussive') else ''))
        roots = sorted({s['midi'] for s in ss})
        for s in ss:
            if inst.get('percussive') or len(roots) == 1:
                r = f"<region> sample={s['file']} key={s['midi']} pitch_keytrack={0 if inst.get('percussive') else 1} seq_position={s.get('roundRobin', 1)} volume={s.get('gainDb', 0)}"
            else:
                k = roots.index(s['midi']); lo = 0 if k == 0 else (roots[k - 1] + s['midi']) // 2 + 1; hi = 127 if k == len(roots) - 1 else (s['midi'] + roots[k + 1]) // 2
                r = f"<region> sample={s['file']} pitch_keycenter={s['midi']} lokey={lo} hikey={hi} tune={s.get('tuneCents', 0)} volume={s.get('gainDb', 0)}"
            if 'loopStart' in s: r += f" loop_mode=loop_continuous loop_start={round(s['loopStart'] * 48000)} loop_end={round(s['loopEnd'] * 48000)}"
            lines.append(r)
        lines.append('')
    return '\n'.join(lines)

def stage(a):
    repo = os.path.abspath(a.repo); os.makedirs(repo, exist_ok=True)
    if not os.path.isdir(os.path.join(repo, '.git')): git(repo, 'init', '-b', 'main')
    manifest = []
    for iid, (source, upstream) in PUBLISH.items():
        inst = json.load(open(os.path.join(a.studio, 'data', 'user-instruments', iid + '.json'), encoding='utf-8'))
        d = os.path.join(repo, 'samples', iid); shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
        samples = []
        for s in inst['samples']:
            src = os.path.join(a.studio, 'data', s['url'].lstrip('/'))
            name = os.path.splitext(os.path.basename(s['url']))[0] + '.flac'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-c:a', 'flac', '-compression_level', '8', os.path.join(d, name)], check=True)
            samples.append({**{k: v for k, v in s.items() if k not in ('url', 'bytes', 'downloadUrl', 'sha256')}, 'file': f'samples/{iid}/{name}'})
        entry = {k: v for k, v in inst.items() if k not in ('samples', 'personal', 'sourceUrl', 'sourceSha256')}
        entry.update({'description': clean(inst.get('description')), 'license': 'CC0-1.0', 'author': AUTHOR, 'upstreamSource': source, 'upstreamLicense': upstream, 'samples': samples})
        manifest.append(entry)
        open(os.path.join(repo, iid + '.sfz'), 'w', encoding='utf-8', newline='\n').write(sfz(entry))
    json.dump({'author': AUTHOR, 'license': 'CC0-1.0', 'instruments': manifest}, open(os.path.join(repo, 'instrument.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    shutil.copyfile(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'voice-kit', 'CC0-1.0.txt'), os.path.join(repo, 'LICENSE'))
    rng = lambda e: (lambda ms: f'{note(min(ms))}–{note(max(ms))}' if len(set(ms)) > 1 else '—')([s['midi'] for s in e['samples']])
    rows_zh = '\n'.join(f"| `{e['id']}` | {e['name']} | {len(e['samples'])} | {rng(e)} | {e['upstreamLicense']} |" for e in manifest)
    rows_src = '\n'.join(f"| `{e['id']}` | {e['upstreamSource']} | {e['upstreamLicense']} |" for e in manifest)
    open(os.path.join(repo, 'README.md'), 'w', encoding='utf-8', newline='\n').write(f"""# XSXB-Band-Samples · 小宝乐队自制音源

[English](README.en.md)

[XSXB-Band · 小宝乐队](https://github.com/sparklecatta-lang/XSXB-Band) 自己做的音源：{AUTHOR}的人声、真古筝、唢呐和箫、公版采样库、自制唱片切片、G-funk 合成器。全部以 **CC0 1.0** 发布，可以随意使用、修改、商用，不需要署名。

工作室用到这些乐器时会自动从这里下载。也可以单独用：每件乐器有一个 `.sfz` 文件，能直接加载到 sforzando 等 SFZ 采样器里。

| ID | 名称 | 采样数 | 音域 | 上游素材 |
|---|---|---|---|---|
{rows_zh}

所有上游素材都是 CC0 或公有领域，或者是在工作室里录制、合成的原创内容，所以加工后的结果也可以用 CC0 发布。上游来源见下表，采样库每一条的出处、时间点和校验值见 XSXB-Band 的 `docs/SAMPLE-CRATE.md`。

| ID | 来源 | 上游许可 |
|---|---|---|
{rows_src}

- 48 kHz FLAC。持续音带循环点，写在 `instrument.json` 和 `.sfz` 里。
- 采样库切片（`crate-*`、`nujabes-chops`）带原始速度 `bpm`，在 XSXB-Band 里会自动拉伸到歌曲速度。
""")
    open(os.path.join(repo, 'README.en.md'), 'w', encoding='utf-8', newline='\n').write(f"""# XSXB-Band-Samples

[中文](README.md)

Instruments made for [XSXB-Band](https://github.com/sparklecatta-lang/XSXB-Band): the author's voice, a real guzheng, suona and xiao, a public-domain sample crate, home-made record chops and G-funk synths. Everything is released under **CC0 1.0**: use, modify and sell freely, no attribution needed.

XSXB-Band downloads these on demand. Each instrument also has an `.sfz` file for SFZ samplers such as sforzando.

| ID | Name | Samples | Range | Upstream |
|---|---|---|---|---|
{rows_zh}

Every upstream source is CC0 or public domain, or was recorded / synthesised in the studio, so the processed results can be CC0 as well. Sources:

| ID | Source | Upstream licence |
|---|---|---|
{rows_src}

- 48 kHz FLAC. Sustains carry loop points (in `instrument.json` and the SFZ).
- Crate chops (`crate-*`, `nujabes-chops`) carry their source tempo as `bpm`; XSXB-Band time-stretches them to the song tempo.
""")
    git(repo, 'add', '-A')
    if git(repo, 'status', '--porcelain'):
        ident = [x for n, v in (('user.name', a.git_name), ('user.email', a.git_email)) if v for x in ('-c', f'{n}={v}')]
        git(repo, *ident, 'commit', '-q', '-m', 'Instruments (CC0)')
    size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(os.path.join(repo, 'samples')) for f in fs)
    print(f'staged {len(manifest)} instruments, {sum(len(e["samples"]) for e in manifest)} files, {size / 1e6:.1f} MB, commit {git(repo, "rev-parse", "HEAD")[:12]} (not pushed)')

def link(a):
    repo = os.path.abspath(a.repo); sha = a.commit or git(repo, 'rev-parse', 'HEAD')
    if not a.allow_unpushed and not git(repo, 'branch', '-r', '--contains', sha):
        raise SystemExit(f'{sha[:12]} 还没有推到 GitHub；先推送，或用 --allow-unpushed 只做演练')
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
        entries.append({**{k: v for k, v in inst.items() if k not in ('samples', 'author', 'upstreamSource', 'upstreamLicense')}, 'kind': 'instrument',
                        'sourceUrl': f'https://github.com/{a.owner}/{name}', 'licenseUrl': f'https://github.com/{a.owner}/{name}/blob/{sha}/LICENSE',
                        'sourceRevision': sha, 'samples': samples})
    for lib_path in a.library:
        lib = json.load(open(lib_path, encoding='utf-8')); ids = {e['id'] for e in entries}
        lib = [i for i in lib if i['id'] not in ids]
        at = next((k for k, i in enumerate(lib) if i.get('kind') in ('cabinet', 'amp-model')), len(lib))
        lib[at:at] = entries
        open(lib_path, 'w', encoding='utf-8', newline='\n').write(json.dumps(lib, ensure_ascii=False, indent=2) + '\n')
        print('linked', len(ids), 'instruments ->', lib_path)
    done = os.path.join(a.studio, 'data', 'user-instruments', '_published'); os.makedirs(done, exist_ok=True)
    for e in entries:
        p = os.path.join(a.studio, 'data', 'user-instruments', e['id'] + '.json')
        if os.path.exists(p): shutil.move(p, os.path.join(done, e['id'] + '.json'))

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    for c in ('stage', 'link'):
        p = sub.add_parser(c); p.add_argument('--repo', required=True); p.add_argument('--studio', required=True)
    st = sub.choices['stage']; st.add_argument('--git-name'); st.add_argument('--git-email')
    ln = sub.choices['link']; ln.add_argument('--owner', required=True); ln.add_argument('--name'); ln.add_argument('--commit')
    ln.add_argument('--library', action='append', default=[]); ln.add_argument('--allow-unpushed', action='store_true')
    a = ap.parse_args(); (stage if a.cmd == 'stage' else link)(a)
