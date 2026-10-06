// Read-only Web Audio checks. Works with the production or development server.
// No screenshots, screen recordings, project writes, or visual assertions.
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';

const baseURL = process.env.KLEIN_URL || 'http://127.0.0.1:4318';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Bundle the current engine in memory; production servers need not expose /src.
const modules = new Map(await Promise.all(['audio', 'midi'].map(async name => {
  const result = await build({
    entryPoints: [path.join(root, 'src', `${name}.ts`)], bundle: true, write: false,
    platform: 'browser', format: 'esm', target: 'es2022', logLevel: 'silent',
  });
  return [name, result.outputFiles[0].text];
})));
async function chromiumPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  try { await access(chromium.executablePath()); return chromium.executablePath(); } catch {}
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    // A system browser also works when Playwright's downloaded revision is absent.
    for (const executable of [
      path.join(process.env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    ]) {
      try { await access(executable); return executable; } catch {}
    }
    const cache = path.join(process.env.LOCALAPPDATA, 'ms-playwright');
    const folders = (await readdir(cache)).filter(name => /^chromium-\d+$/.test(name))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const folder of folders) {
      const executable = path.join(cache, folder, 'chrome-win64', 'chrome.exe');
      try { await access(executable); return executable; } catch {}
    }
  }
  return undefined;
}

const response = await fetch(`${baseURL}/api/library`);
if (!response.ok) throw new Error('Start XSXB-Band before running audio-smoke.');
const library = await response.json();
const missing = library.filter(instrument => !instrument.installed);
if (missing.length) throw new Error(`Download these instruments in the app before testing: ${missing.map(item => item.id).join(', ')}`);
const slowAudio = Buffer.from(await (await fetch(`${baseURL}${library[0].samples[0].url}`)).arrayBuffer());
const browser = await chromium.launch({
  headless: true,
  executablePath: await chromiumPath(),
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  const requestedSamples = new Set();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (new URL(response.url()).pathname.startsWith('/samples/') && response.ok()) requestedSamples.add(response.url());
  });
  for (const [name, code] of modules) {
    await page.route(`**/__audio-smoke-modules/${name}.js`, route => route.fulfill({ contentType: 'text/javascript', body: code }));
  }
  await page.route('**/__audio-smoke__', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Audio technical checks</title>',
  }));
  await page.route('**/__slow-audio.wav', async route => {
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.fulfill({ contentType: 'audio/wav', body: slowAudio });
  });
  await page.goto(`${baseURL}/__audio-smoke__`);
  const result = await page.evaluate(async () => {
    const { AudioEngine } = await import('/__audio-smoke-modules/audio.js');
    const { exportMidi } = await import('/__audio-smoke-modules/midi.js');
    const library = await (await fetch('/api/library')).json();
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const pause = duration => new Promise(resolve => setTimeout(resolve, duration));
    const decoder = new AudioContext();
    let decoded = 0;
    for (const instrument of library) {
      // Catalog bulk integrity is checked separately; here decode one of each
      // resource, then the engine decodes every actual sample selected below.
      for (const sample of instrument.samples.slice(0, 1)) {
        const response = await fetch(sample.url);
        assert(response.ok, `Sample fetch failed: ${sample.url}`);
        if (instrument.kind === 'amp-model') { JSON.parse(await response.text()); decoded++; continue; }
        const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
        assert(buffer.duration > 0 && buffer.numberOfChannels > 0, `Empty sample: ${sample.url}`);
        decoded++;
      }
    }
    await decoder.close();
    const engine = new AudioEngine();
    engine.setLibrary(library.map(instrument => ({ ...instrument, installed: false })));
    let missingError = false;
    try { await engine.preview('piano', 60); } catch (error) { missingError = /下载/.test(error.message); }
    assert(missingError, 'Missing sample must explain that downloading is required.');
    engine.setLibrary(library);
    const project = {
      schemaVersion: 1, id: 'audio-test', title: 'Read-only audio test', bpm: 120,
      key: 'C', bars: 2, timeSignature: [4, 4], updatedAt: '',
      tracks: library.filter(instrument => !instrument.kind || instrument.kind === 'instrument').map((instrument, index) => ({
        id: instrument.id, instrumentId: instrument.id, name: instrument.name, color: '',
        volume: 0.7, pan: index % 2 ? -0.65 : 0.65, muted: false, solo: false,
        notes: [{ id: `n${index}`, midi: 60, start: index * 0.2, duration: 0.5, velocity: 0.8 }],
      })),
    };
    const wav = await engine.renderWav(project);
    const view = new DataView(await wav.arrayBuffer());
    assert(view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57415645, 'Missing RIFF/WAVE header.');
    assert(view.getUint16(22, true) === 2 && view.getUint32(24, true) === 44100
      && view.getUint16(34, true) === 16, 'Incorrect stereo PCM metadata.');
    assert(view.getUint32(40, true) === view.byteLength - 44, 'Incorrect PCM payload size.');
    let nonzero = 0, stereo = 0, peak = 0;
    for (let offset = 44; offset < view.byteLength; offset += 4) {
      const left = view.getInt16(offset, true), right = view.getInt16(offset + 2, true);
      if (left || right) nonzero++;
      if (left !== right) stereo++;
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
    }
    assert(nonzero > 4000 && stereo > 4000, 'Rendered WAV must contain stereo audio.');

    const guitar = project.tracks.find(track => track.instrumentId === 'electric-guitar');
    assert(guitar, 'Electric guitar instrument is required for the overdrive test.');
    const dryProject = { ...project, tracks: [{ ...guitar, pan: 0,
      notes: [60, 64, 67].map(midi => ({ id: `g${midi}`, midi, start: 0, duration: 2, velocity: 0.7 })),
    }] };
    const pedal = { enabled: true, drive: 0.75, tone: 0.6, mix: 1, output: 0.65 };
    const wetProject = { ...dryProject, tracks: [{ ...dryProject.tracks[0], effects: pedal }] };
    const dry = new Int16Array(await (await engine.renderWav(dryProject)).arrayBuffer(), 44);
    const wet = new Int16Array(await (await engine.renderWav(wetProject)).arrayBuffer(), 44);
    let diff = 0, dryEnergy = 0, wetEnergy = 0;
    for (let i = 0; i < Math.min(dry.length, wet.length); i++) {
      diff += (dry[i] - wet[i]) ** 2;
      dryEnergy += dry[i] ** 2;
      wetEnergy += wet[i] ** 2;
    }
    const differenceRms = Math.sqrt(diff / dry.length) / 32768;
    assert(dryEnergy > 0 && wetEnergy > 0 && differenceRms > 0.001, 'Tuna effect must change the rendered PCM.');
    const renderPedal = async effects => new Int16Array(await (await engine.renderWav({
      ...dryProject, tracks: [{ ...dryProject.tracks[0], effects }],
    })).arrayBuffer(), 44);
    const difference = (first, second) => {
      let energy = 0;
      for (let i = 0; i < first.length; i++) energy += (first[i] - second[i]) ** 2;
      return Math.sqrt(energy / first.length) / 32768;
    };
    const bypassed = await renderPedal({ ...pedal, enabled: false, output: 0 });
    const unmixed = await renderPedal({ ...pedal, mix: 0, output: 1 });
    const zeroOutput = await renderPedal({ ...pedal, output: 0 });
    const dark = await renderPedal({ ...pedal, tone: 0 });
    const lightDrive = await renderPedal({ ...pedal, drive: 0 });
    assert(difference(dry, bypassed) < 1 / 32768, 'Disabled pedal must preserve the dry signal.');
    assert(difference(dry, unmixed) < 1 / 32768, 'Zero wet mix must preserve the dry signal.');
    assert(zeroOutput.every(sample => sample === 0), 'Pedal output zero must mute the effect output.');
    assert(difference(wet, dark) > 0.001, 'Tone control must change the PCM.');
    assert(difference(wet, lightDrive) > 0.001, 'Drive control must change the PCM.');

    const cabinet = library.find(instrument => instrument.id === 'cab-v30-sm57');
    const metal = project.tracks.find(track => track.instrumentId === 'metal-guitar');
    assert(cabinet && metal, 'New metal guitar and measured cabinet IR are required.');
    const ampSettings = { enabled: true, drive: 0.55, tone: 0.5, mix: 1, output: 0.55,
      ampModel: 'high-gain', cabinetId: cabinet.id };
    const ampTrack = { ...metal, pan: 0, release: 0.035, articulation: 'staccato',
      effects: ampSettings, notes: [0, 0.5, 1, 1.5].map((start, index) => ({
        id: `metal-${index}`, midi: 40, start, duration: 0.22, velocity: 0.83,
      })),
    };
    const ampProject = { ...project, tracks: [ampTrack] };
    const renderAmp = async (effects, targetEngine = engine) => new Int16Array(await (await targetEngine.renderWav({
      ...ampProject, tracks: [{ ...ampTrack, effects }],
    })).arrayBuffer(), 44);
    const preampOnly = await renderAmp({ ...ampSettings, cabinetId: undefined });
    const measuredCab = await renderAmp(ampSettings);
    const cleanMetal = await renderAmp({ ...ampSettings, enabled: false });
    const ampDifference = difference(cleanMetal, preampOnly);
    const cabinetDifference = difference(preampOnly, measuredCab);
    assert(ampDifference > 0.001, 'AmpSim3 must change actual guitar PCM.');
    assert(cabinetDifference > 0.001, 'Measured IR must change actual preamp PCM.');
    // NAM capture: renders offline through the AudioWorklet and changes the PCM.
    const namModel = library.find(instrument => instrument.kind === 'amp-model');
    assert(namModel, 'At least one NAM amp model is required.');
    const namSettings = { ...ampSettings, ampModel: 'nam', namModelId: namModel.id };
    const namRender = await renderAmp(namSettings);
    const namAgain = await renderAmp(namSettings);
    assert(namRender.some(sample => sample !== 0), 'NAM render must not be silent.');
    assert(difference(cleanMetal, namRender) > 0.001 && difference(measuredCab, namRender) > 0.001, 'NAM must change the PCM differently from AmpSim3.');
    assert(difference(namRender, namAgain) < 0.002, 'NAM offline renders must be repeatable.');
    // Room reverb send and deterministic humanisation.
    const reverbRender = new Int16Array(await (await engine.renderWav({ ...wetProject, tracks: [{ ...wetProject.tracks[0], reverb: 0.4 }] })).arrayBuffer(), 44);
    assert(reverbRender.length > wet.length && difference(wet, reverbRender.subarray(0, wet.length)) > 0.001, 'Reverb send must add a room and tail.');
    const humanProject = { ...ampProject, tracks: [{ ...ampTrack, effects: undefined, humanize: 1 }] };
    const human1 = new Int16Array(await (await engine.renderWav(humanProject)).arrayBuffer(), 44);
    const human2 = new Int16Array(await (await engine.renderWav(humanProject)).arrayBuffer(), 44);
    assert(difference(human1, human2) === 0, 'Humanize must be deterministic.');
    assert(difference(cleanMetal, human1.subarray(0, cleanMetal.length)) > 0.001, 'Humanize must change timing or dynamics.');
    const absentCabinetEngine = new AudioEngine();
    absentCabinetEngine.setLibrary(library.map(instrument => instrument.kind === 'cabinet'
      ? { ...instrument, installed: false } : instrument));
    await renderAmp({ ...ampSettings, enabled: false }, absentCabinetEngine);
    let missingCabinetError = false;
    try { await renderAmp(ampSettings, absentCabinetEngine); } catch (error) { missingCabinetError = /下载/.test(error.message); }
    assert(missingCabinetError, 'Enabled missing cabinet must request download.');
    const pcmRmsDb = samples => {
      let sum = 0;
      // Compare the first 1.5s containing this short riff, excluding long silence.
      const count = Math.min(samples.length, 44100 * 2 * 1.5);
      for (let i = 0; i < count; i++) sum += samples[i] ** 2;
      return Number((20 * Math.log10(Math.max(1e-12, Math.sqrt(sum / count) / 32768))).toFixed(2));
    };
    engine.setMasterVolume(0);
    const quietMonitor = new Uint8Array(await (await engine.renderWav(wetProject)).arrayBuffer());
    engine.setMasterVolume(1);
    const loudMonitor = new Uint8Array(await (await engine.renderWav(wetProject)).arrayBuffer());
    let monitorMaxDifference = 0, monitorDifferenceCount = 0;
    const quietPcm = new Int16Array(quietMonitor.buffer, 44);
    const loudPcm = new Int16Array(loudMonitor.buffer, 44);
    for (let i = 0; i < quietPcm.length; i++) {
      const difference = Math.abs(quietPcm[i] - loudPcm[i]);
      monitorMaxDifference = Math.max(monitorMaxDifference, difference);
      if (difference) monitorDifferenceCount++;
    }
    // Browser render passes can differ by one 16-bit quantization unit.
    assert(quietMonitor.length === loudMonitor.length && monitorMaxDifference <= 1,
      `Monitor gain must not change the exported WAV: max PCM difference ${monitorMaxDifference}, ${monitorDifferenceCount} changed samples.`);

    let beats = 0;
    await engine.play(wetProject, { fromBeat: 1, loop: true, onBeat: beat => {
      assert(beat >= 0 && beat < 8, 'Loop position must remain inside project.'); beats++;
    } });
    await pause(100);
    engine.updateTrack({ ...wetProject.tracks[0], volume: 0.3, pan: -0.6,
      effects: { ...pedal, drive: 0.2, tone: 0.8, mix: 0.5 } });
    const beforeEdit = beats;
    await pause(100);
    assert(beats > beforeEdit, 'Live pedal update must not stop transport.');
    engine.stop();
    const stoppedAt = beats;
    await pause(100);
    assert(stoppedAt > 1 && beats === stoppedAt, 'Stop must end transport callbacks.');
    let ended = 0;
    await engine.play({ ...dryProject, bars: 1, bpm: 400 }, { loop: false, onEnd: () => { ended++; } });
    await pause(800);
    assert(ended === 1, 'Nonloop playback must emit exactly one end.');
    engine.stop();
    await engine.play(ampProject, { loop: true });
    engine.updateTrack({ ...ampTrack, effects: { ...ampSettings, drive: 0.4, tone: 0.65, output: 0.45 } });
    await pause(60);
    engine.stop();
    await engine.preview('metal-guitar', 40, 0.83, 0.08, ampTrack);
    await pause(60);
    engine.stop();
    await engine.preview('electric-guitar', 64, 0.65, 0.08, wetProject.tracks[0]);
    await pause(50);
    engine.stop();

    const pendingEngine = new AudioEngine();
    pendingEngine.setLibrary([{ ...library[0], samples: [{ midi: 60, url: '/__slow-audio.wav' }] }]);
    let delayedBeats = 0;
    const pending = pendingEngine.play({ ...project, tracks: [project.tracks[0]] }, { onBeat: () => { delayedBeats++; } });
    pendingEngine.stop();
    await pending;
    await pause(80);
    assert(delayedBeats === 0, 'Stopping during preload must not restart playback.');
    // Standard MIDI has 15 melodic channels; the full catalogue now exceeds that, so check a fitting subset.
    const melodic = project.tracks.filter(track => !library.find(item => item.id === track.instrumentId)?.percussive);
    const midiProject = { ...project, tracks: [...melodic.slice(0, 15), ...project.tracks.filter(track => !melodic.includes(track))] };
    const midi = new DataView(await exportMidi(midiProject, library).arrayBuffer());
    assert(midi.getUint32(0) === 0x4d546864 && midi.getUint16(8) === 1, 'MIDI must be a format-1 SMF.');
    return {
      firstResourcesDecoded: decoded, instruments: project.tracks.length,
      cabinets: library.filter(instrument => instrument.kind === 'cabinet').length, wavBytes: view.byteLength,
      nonzeroFrames: nonzero, stereoFrames: stereo, peakPCM: peak,
      effectDifferenceRms: Number(differenceRms.toFixed(6)),
      dryRms: Number((Math.sqrt(dryEnergy / dry.length) / 32768).toFixed(6)),
      wetRms: Number((Math.sqrt(wetEnergy / wet.length) / 32768).toFixed(6)),
      pedalControlsAndBypass: 'passed',
      ampActualPcmDifferenceRms: Number(ampDifference.toFixed(6)),
      cabinetActualPcmDifferenceRms: Number(cabinetDifference.toFixed(6)),
      guitarRiffRmsDb: { dry: pcmRmsDb(cleanMetal), ampOnly: pcmRmsDb(preampOnly), ampAndCab: pcmRmsDb(measuredCab) },
      disabledCabinetWithoutDownload: 'passed', missingEnabledCabinetError: 'passed',
      liveTransportCallbacks: beats, naturalEndEvents: ended,
      monitorIndependentExport: 'passed', monitorMaxPcmDifference: monitorMaxDifference, stopWhileLoading: 'passed',
      missingSampleError: 'passed', midiBytes: midi.byteLength,
    };
  });
  if (errors.length) throw new Error(`Browser runtime errors: ${errors.join('; ')}`);
  console.log(JSON.stringify({ ...result, uniqueSampleFilesFetched: requestedSamples.size, moduleSource: 'in-memory bundle of current src' }, null, 2));
} finally {
  await browser.close();
}
