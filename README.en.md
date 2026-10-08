# XSXB-Band

[中文](README.md) | **English**

Let your agent write the score, and let real recorded instruments play it.

XSXB-Band is a local music studio with a companion agent skill. You describe the music you want in your agent's chat; the agent writes a score in which every note can be edited, and the studio performs it with instruments recorded from real players, then exports WAV, MIDI and stems. No music-generation model and no API key are involved.

## Why

When an agent scores a video, the background music is usually computed in code from sine and square waves: the timbre never changes, every note is equally loud and locked to the grid, and the AI that wrote it cannot hear it.

XSXB-Band splits the work differently. A score is text, which is what language models are good at, so the agent only writes the score. The playing is left to real recordings: for each note the engine picks the nearest recorded pitch, switches between soft and hard recordings by velocity, rotates through repeated takes, and adds a little humanisation and reverb. Since the agent cannot hear, it balances the mix from the render report (levels, peaks, clipping).

## Let your agent install it

Send the repository URL to your agent (Claude Code, Codex or any agent that can read docs and run commands) together with:

> Please install XSXB-Band from https://github.com/sparklecatta-lang/XSXB-Band. Follow AGENTS.md to install dependencies, build, test, start the server and install the skill. Do not pre-download the whole sample library.

The agent reads the steps from [AGENTS.md](AGENTS.md) (written in Chinese; agents handle it fine). Manual install: Node.js 22.12+ (24 LTS recommended), run `npm ci`, `npm run build`, `npm start` (or double-click `start.bat` on Windows), open http://127.0.0.1:4318, then copy `skills/xsxb-band/` into your agent's skills folder.

## Usage

It works much like Suno, except you are talking to your agent:

> Make 30 seconds of bleak, melancholic ancient-Chinese-style ambience.

> Give me a trap beat full of sudden stops and jump scares.

> Score this cutscene: folk instruments build up, then switch to metal when the boss stands up.

The agent picks instruments, writes the score, renders, checks the report and rebalances, then hands you the audio and saves an editable project to the song library. Keep iterating: "move the erhu back", "make it a minute long", "turn it into jazz".

To edit by hand, open http://127.0.0.1:4318: piano roll, drum machine, per-track volume / pan / reverb, articulations and guitar effects. The UI is in Chinese; see [docs/GUIDE.md](docs/GUIDE.md).

`examples/` holds six projects in different styles (Chinese ambient, jazz, film score, trap, acoustic folk, folk metal) for your agent to open and modify.

## Instruments

71 instruments, plus 2 measured guitar-cabinet IRs and 4 NAM neural amp models:

| Group | Instruments |
| --- | --- |
| Keys | Upright piano, FM electric piano (Yamaha TX81Z), reed organ |
| Strings & guitars | Violin section, cello section, concert harp, acoustic guitar, clean electric guitar, layered electric guitar (sustain / staccato), solid-body electric guitar DI |
| Bass | Upright bass, picked electric bass, 808 bass, Moog-style synth bass (with glide) |
| Winds & brass | Flute, oboe, tenor saxophone (legato, vibrato), French horn, trumpet, trombone |
| Synth | G-funk whine lead (round and nasal variants, with portamento) |
| Mallets & percussion | Marimba, vibraphone, kalimba, timpani, gong, tubular bells |
| Drums | Layered acoustic kit (kick, snare, hi-hat, tom, crash), ride, flat ride, Roland TR-808 (kick, snare, clap, hats, rim / cowbell / clave / maracas), basic kit pieces |
| Hand percussion | Congas, bongos, frame drum, tambourine, sleigh bells, finger cymbals, Nepalese bells, bell tree, wind chimes |
| Chinese & Asian | Guzheng (real, tuned D F G A C), suona, xiao, dizi, erhu, Vietnamese đàn tranh |
| Voice | XSXB voice (male sustains, vocal bass, falsetto), XSXB voice · female, two beatbox kits, plus your own recorded voice (below) |
| Sample crate | Public-domain speech (Apollo, JFK), classical phrases, CC0 vocal shots, home-made jazz record chops; chops are time-stretched to the song tempo |
| Texture | Vinyl crackle |

The live list is served at `/api/library`.

## Use your own voice

No usable CC0 sustained-choir samples exist, so pitched voices come from you:

1. Run `start.bat` and open http://127.0.0.1:4318/voice-kit/ in Chrome or Edge.
2. Press record for each note: a reference tone, a two-click count-in, four seconds of singing, then it stops and saves by itself. The 45 required notes take about 10 minutes. See [voice-kit/录音说明.md](voice-kit/录音说明.md) (in Chinese).
3. Run `python voice-kit/slice_voice.py`. It slices, pitch-measures, corrects off-pitch notes, loops the sustains and splits repeated hits by their waveform, producing a personal voice instrument with oo / aa / hum / "dm" bass / "ba" / falsetto articulations, plus a personal beatbox if you recorded one.
4. Optional: `python voice-kit/derive_voice.py` derives a female-sounding version with the WORLD vocoder; `voice-kit/publish_voice.py` publishes your voice as CC0 to your own GitHub repository.

Your agent can then write wordless a cappella, or mix voices with instruments. Personal instruments stay in your local `data/` folder; they are never uploaded or committed. The author's own set is published as "XSXB voice" and ready to use.

## Samples and downloads

- **The repository contains no audio.** `public/library.json` only records each file's author repository, pinned download URL, size, SHA-256 and licence.
- When a project uses an instrument, the studio downloads it from the author's original URL into `data/samples/` and verifies it before use. Only the instruments you use are fetched; the full set is about 1.5 GB.
- All instrument recordings are CC0. The NAM amp models are GPL-3.0 and are likewise downloaded on demand, never redistributed here.
- The voices, guzheng, suona, xiao, sample crate, record chops and G-funk synths were recorded, processed or synthesised for this project from CC0 / public-domain material. They are hosted at [XSXB-Band-Samples](https://github.com/sparklecatta-lang/XSXB-Band-Samples), also CC0, with SFZ files for use in any sampler. Every crate chop's source is listed in [docs/SAMPLE-CRATE.md](docs/SAMPLE-CRATE.md) (in Chinese).
- Per-file sources: [docs/SAMPLE-LICENSES.md](docs/SAMPLE-LICENSES.md), [docs/REALISM-SOURCES.md](docs/REALISM-SOURCES.md), [docs/HIPHOP-SOURCES.md](docs/HIPHOP-SOURCES.md), [docs/METAL-SAMPLE-LICENSES.md](docs/METAL-SAMPLE-LICENSES.md), [docs/AMP-SOURCES.md](docs/AMP-SOURCES.md), [docs/VOCAL-SOURCES.md](docs/VOCAL-SOURCES.md) (in Chinese).

## Limitations

- The 808 bass has no glide, and its samples have no loop points, so long notes end with the recording. Use the Moog-style synth bass when you need slides.
- The sampler cannot sing lyrics: voices are wordless vowels and beatbox.
- Guzheng, dizi and erhu come from lossy public previews; suona and xiao are stand-ins shaped from oboe and recorder samples.
- No real palm muting or bends on guitars; legato exists only on voices, sax, xiao and synths; open hi-hats are not choked by closed ones.
- The agent cannot judge whether it sounds good. Your ears decide.

## For developers

- API: [docs/AGENT-API.md](docs/AGENT-API.md); audio engine: [docs/AUDIO.md](docs/AUDIO.md).
- `npm run dev` for development, `npm test` for tests.
- CLI: `node scripts/agent.mjs` (project, song library, sample downloads).

## Licence

Code is released under the [MIT](LICENSE) licence. Samples are not part of this repository and keep their authors' licences (instrument recordings CC0, NAM models GPL-3.0). Third-party code: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
