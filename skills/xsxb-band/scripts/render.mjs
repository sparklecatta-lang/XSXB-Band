#!/usr/bin/env node
// Render with the studio's actual sampler. Never writes the project; asks the studio to fetch missing samples first.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const usage = `XSXB-Band — render with the studio's own sampler engine
node render.mjs [--studio PATH] [--url http://127.0.0.1:4318]
                [--project FILE.json] [--out NEW_DIRECTORY] [--stems] [--browser EXE]
Studio: --studio, XSXB_BAND_HOME, <skill>/studio-path.txt, or the repository this skill sits in.
Default: current project; new timestamped folder under studio/exports.
Writes mix.wav, score.mid, project.json, report.json; --stems adds audible track WAVs.
Missing samples are downloaded by the studio from the pinned author URLs before rendering.
Does not save the project to the server or take screenshots.`;

// Studio root: explicit flag, env, studio-path.txt written at install time, or the repo containing this skill.
async function findStudio(flag) {
  const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let fromFile;
  try { fromFile = (await readFile(path.join(skillDir, 'studio-path.txt'), 'utf8')).split(String.fromCharCode(10))[0].trim(); } catch {}
  for (const candidate of [flag, process.env.XSXB_BAND_HOME, process.env.KLEIN_STUDIO, fromFile, path.resolve(skillDir, '../..')]) {
    if (!candidate) continue;
    try { await access(path.join(candidate, 'server/validation.mjs')); return path.resolve(candidate); } catch {}
  }
  throw Error('Studio not found. Pass --studio <path>, set XSXB_BAND_HOME, or write the path into studio-path.txt next to SKILL.md.');
}

function options(args) {
  const result = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') { result.help = true; continue; }
    if (arg === '--stems') { result.stems = true; continue; }
    if (!['--studio', '--url', '--project', '--out', '--browser'].includes(arg)) throw Error(`Unknown argument: ${arg}`);
    const value = args[++index];
    if (!value || value.startsWith('--')) throw Error(`Missing value for ${arg}`);
    result[arg.slice(2)] = value;
  }
  return result;
}

async function browserPath(explicit, chromium) {
  const choices = [explicit, process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE];
  if (explicit) { await access(explicit); return explicit; }
  if (process.platform === 'win32') choices.push(
    path.join(process.env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
  );
  choices.push(chromium.executablePath());
  for (const candidate of choices.filter(Boolean)) {
    try { await access(candidate); return candidate; } catch { /* try the next existing browser */ }
  }
  throw Error('No usable browser found. Pass --browser with an installed Chrome/Edge executable.');
}

function pcmStats(bytes, scoreSeconds) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE'
    || bytes.readUInt16LE(22) !== 2 || bytes.readUInt16LE(34) !== 16) throw Error('Unexpected WAV format from studio engine');
  const sampleRate = bytes.readUInt32LE(24), frames = bytes.readUInt32LE(40) / 4;
  if (bytes.length !== 44 + frames * 4) throw Error('WAV payload length mismatch');
  const scoreFrames = Math.min(frames, Math.round(scoreSeconds * sampleRate));
  let peak = 0, energy = 0, saturatedFrames = 0, activeFrames = 0;
  const secondPeaks = [];
  for (let frame = 0; frame < frames; frame++) {
    const left = bytes.readInt16LE(44 + frame * 4), right = bytes.readInt16LE(46 + frame * 4);
    const localPeak = Math.max(Math.abs(left), Math.abs(right)) / 32768;
    peak = Math.max(peak, localPeak);
    if (frame < scoreFrames) energy += (left * left + right * right) / (2 * 32768 ** 2);
    if (left || right) activeFrames++;
    if (left >= 32767 || left <= -32768 || right >= 32767 || right <= -32768) saturatedFrames++;
    const second = Math.floor(frame / sampleRate);
    secondPeaks[second] = Math.max(secondPeaks[second] || 0, localPeak);
  }
  const db = value => value > 0 ? Number((20 * Math.log10(value)).toFixed(3)) : null;
  return { sampleRate, seconds: frames / sampleRate, scoreSeconds, frames,
    peakDbFS: db(peak), scoreRmsDbFS: db(Math.sqrt(energy / Math.max(1, scoreFrames))),
    saturatedFrames, activeFrames, secondPeakDbFS: secondPeaks.map(db) };
}

async function main() {
  const opts = options(process.argv.slice(2));
  if (opts.help) { console.log(usage); return; }
  const studio = await findStudio(opts.studio);
  const base = new URL(opts.url || process.env.KLEIN_URL || 'http://127.0.0.1:4318');
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)
    || base.username || base.password) throw Error('Use the local studio HTTP URL.');
  const api = async route => {
    const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error(`${route}: HTTP ${response.status}`);
    return response.json();
  };
  const readJson = async file => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  let [health, library, envelope] = await Promise.all([
    api('/api/health'), api('/api/library'), opts.project ? readJson(path.resolve(opts.project)) : api('/api/state'),
  ]);
  if (!health.ok || !['Klein Studio', 'XSXB-Band'].includes(health.name)) throw Error('The URL is not a running studio instance.');
  const project = envelope.project ?? envelope;
  const { validateProject } = await import(pathToFileURL(path.join(studio, 'server/validation.mjs')).href);
  const issues = validateProject(project, library);
  if (issues.length) throw Error(`Invalid score:\n${issues.join('\n')}`);
  const hasSolo = project.tracks.some(track => track.solo);
  const audible = project.tracks.filter(track => !track.muted && (!hasSolo || track.solo)
    && track.volume > 0 && track.notes.some(note => note.velocity > 0));
  if (!audible.length) throw Error('The score has no audible notes. Check mute, solo, volume and velocity.');
  // Engine also preloads zero-volume tracks so their faders can be raised live.
  const used = new Set(project.tracks.filter(track => !track.muted && (!hasSolo || track.solo)
    && track.notes.some(note => note.velocity > 0)).flatMap(track => [track.instrumentId,
      ...(track.effects?.enabled && track.effects.cabinetId ? [track.effects.cabinetId] : [])]));
  if (library.some(instrument => used.has(instrument.id) && !instrument.installed)) {
    // The studio downloads every resource the score uses (instruments, cabinet IRs, NAM models) and verifies SHA-256.
    const response = await fetch(new URL('/api/instruments/ensure', base), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }), signal: AbortSignal.timeout(30 * 60 * 1000) });
    const result = await response.json();
    for (const item of result.instruments ?? []) console.error(`${item.installed ? 'ready' : 'FAILED'} ${item.id}${item.error ? ` — ${item.error}` : ''}`);
    if (!response.ok) throw Error(result.error || `Sample download failed (HTTP ${response.status}).`);
    library = await api('/api/library');
  }
  const missing = library.filter(instrument => used.has(instrument.id) && !instrument.installed);
  if (missing.length) throw Error(`Required resources are still missing: ${missing.map(item => item.id).join(', ')}.`);

  const require = createRequire(path.join(studio, 'package.json'));
  const { build } = require('esbuild'), { chromium } = require('@playwright/test');
  const modules = new Map(await Promise.all(['audio', 'midi'].map(async name => {
    const bundle = await build({ entryPoints: [path.join(studio, 'src', `${name}.ts`)],
      bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent' });
    return [name, bundle.outputFiles[0].text];
  })));
  const executablePath = await browserPath(opts.browser, chromium);
  const out = path.resolve(opts.out || path.join(studio, 'exports', `${project.id}-${Date.now()}-${randomUUID().slice(0, 6)}`));
  await mkdir(path.dirname(out), { recursive: true });
  await mkdir(out); // EEXIST is intentional: never overwrite an earlier export.
  const browser = await chromium.launch({ executablePath, headless: true,
    args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [], requests = new Map(), prefix = `/__klein_export_${randomUUID()}`;
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/samples/')) requests.set(url.pathname, response.status());
    });
    await page.route(`**${prefix}/index`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>XSXB-Band render</title>' }));
    for (const [name, body] of modules) await page.route(`**${prefix}/${name}.js`, route => route.fulfill({ contentType: 'text/javascript', body }));
    await page.goto(new URL(`${prefix}/index`, base).href);
    await page.evaluate(async ({ prefix, library }) => {
      const { AudioEngine } = await import(`${prefix}/audio.js`);
      const { exportMidi } = await import(`${prefix}/midi.js`);
      window.engine = new AudioEngine(); window.engine.setLibrary(library);
      window.exportMidi = project => exportMidi(project, library);
    }, { prefix, library });
    const convert = async (kind, score) => Buffer.from(await page.evaluate(async ({ kind, score }) => {
      const blob = kind === 'wav' ? await window.engine.renderWav(score) : window.exportMidi(score);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return btoa(binary);
    }, { kind, score }), 'base64');
    const scoreSeconds = project.bars * 4 * 60 / project.bpm;
    const mix = await convert('wav', project);
    const melodicCount = project.tracks.filter(track => !track.muted && (!hasSolo || track.solo)
      && track.volume > 0 && !library.find(item => item.id === track.instrumentId)?.percussive).length;
    const midi = melodicCount <= 15 ? await convert('midi', project) : null;
    const report = { title: project.title, revision: envelope.revision ?? envelope.baseRevision ?? null,
      input: opts.project ? path.resolve(opts.project) : 'current server project', studio, service: base.href,
      mix: pcmStats(mix, scoreSeconds), stems: [], runtimeErrors: errors, screenshots: 0 };
    await writeFile(path.join(out, 'mix.wav'), mix, { flag: 'wx' });
    if (midi) await writeFile(path.join(out, 'score.mid'), midi, { flag: 'wx' });
    await writeFile(path.join(out, 'project.json'), JSON.stringify(project, null, 2), { flag: 'wx' });
    if (opts.stems) {
      await mkdir(path.join(out, 'stems'));
      for (const track of audible) {
        const bytes = await convert('wav', { ...project, tracks: [{ ...track, solo: false }] });
        const file = `stems/${track.id}.wav`;
        await writeFile(path.join(out, file), bytes, { flag: 'wx' });
        report.stems.push({ id: track.id, instrumentId: track.instrumentId, file, ...pcmStats(bytes, scoreSeconds) });
      }
    }
    report.sampleResponses = [...requests].map(([url, status]) => ({ url, status }));
    report.warnings = [];
    report.midiExported = !!midi;
    if (!midi) report.warnings.push('MIDI omitted: more than 15 independent melodic channels. WAV and JSON are complete.');
    if (!report.mix.activeFrames) report.warnings.push('Rendered mix is silent.');
    if (report.mix.saturatedFrames) report.warnings.push('Rendered PCM reaches full scale; inspect gain staging.');
    await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
    if (errors.length || [...requests.values()].some(status => status !== 200)) throw Error(`Audio request/runtime failure; inspect ${path.join(out, 'report.json')}`);
    console.log(JSON.stringify({ out, ...report.mix, stems: report.stems.length, samplesFetched: requests.size,
      warnings: report.warnings, savedToStudio: false }, null, 2));
    if (!report.mix.activeFrames) process.exitCode = 1;
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
