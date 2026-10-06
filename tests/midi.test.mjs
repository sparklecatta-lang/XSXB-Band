import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/midi.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { exportMidi } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const library = [
  { id: 'piano', gmProgram: 0, installed: false },
  { id: 'bass', gmProgram: 32, installed: false },
  { id: 'kick', percussive: true, installed: false },
  { id: 'snare', percussive: true, installed: false },
  { id: 'hihat', percussive: true, installed: false },
  { id: 'tom', percussive: true, installed: false },
  { id: 'crash', percussive: true, installed: false },
  { id: 'clap', percussive: true, installed: false },
  { id: 'shaker', percussive: true, installed: false },
];
const note = (start = 0, duration = 1, midi = 60) => ({ id: `n${start}`, start, duration, midi, velocity: 0.8 });
const track = (id, extra = {}) => ({ id, name: id, instrumentId: id, color: '', volume: 0.75, pan: 0, muted: false, solo: false, notes: [note()], ...extra });
const project = tracks => ({ schemaVersion: 1, id: 'test', title: '测试 / MIDI', bpm: 120, key: 'C', bars: 2, timeSignature: [4, 4], tracks, updatedAt: '' });

// Parse the actual file chunks and delta times, independent of exporter internals.
async function parse(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(Buffer.from(bytes.slice(0, 4)).toString(), 'MThd');
  assert.equal(view.getUint32(4), 6);
  const result = { format: view.getUint16(8), division: view.getUint16(12), tracks: [] };
  let offset = 14;
  const variable = () => {
    let value = 0;
    let byte;
    do { byte = bytes[offset++]; value = value * 128 + (byte & 127); } while (byte & 128);
    return value;
  };
  for (let i = 0; i < view.getUint16(10); i++) {
    assert.equal(Buffer.from(bytes.slice(offset, offset + 4)).toString(), 'MTrk');
    const end = offset + 8 + view.getUint32(offset + 4);
    offset += 8;
    let tick = 0;
    const events = [];
    while (offset < end) {
      tick += variable();
      const status = bytes[offset++];
      if (status === 255) {
        const kind = bytes[offset++];
        const size = variable();
        events.push({ tick, status, kind, data: [...bytes.slice(offset, offset + size)] });
        offset += size;
      } else {
        const size = (status & 240) === 192 || (status & 240) === 208 ? 1 : 2;
        events.push({ tick, status, data: [...bytes.slice(offset, offset + size)] });
        offset += size;
      }
    }
    assert.equal(offset, end);
    result.tracks.push(events);
  }
  assert.equal(offset, bytes.length);
  return result;
}

test('MIDI file contains tempo, signature, UTF-8 title, GM programs and exact quarter-note gates', async () => {
  const file = await parse(exportMidi(project([track('piano', { pan: -1 }), track('bass')]), library));
  assert.equal(file.format, 1);
  assert.equal(file.division, 480);
  assert.equal(file.tracks.length, 3);
  const meta = file.tracks[0];
  assert.equal(new TextDecoder().decode(new Uint8Array(meta.find(e => e.kind === 3).data)), '测试 / MIDI');
  assert.deepEqual(meta.find(e => e.kind === 0x51).data, [7, 161, 32]);
  assert.deepEqual(meta.find(e => e.kind === 0x58).data, [4, 2, 24, 8]);
  assert.equal(meta.at(-1).tick, 8 * 480);
  assert.deepEqual(file.tracks[1].find(e => e.status === 0xb0 && e.data[0] === 10).data, [10, 0]);
  assert.deepEqual(file.tracks[1].find(e => e.status === 0xb0 && e.data[0] === 7).data, [7, 95]);
  assert.deepEqual(file.tracks[2].find(e => e.status === 0xc1).data, [32]);
  assert.deepEqual(file.tracks[1].filter(e => (e.status & 0xe0) === 0x80), [
    { tick: 0, status: 0x90, data: [60, 102] },
    { tick: 480, status: 0x80, data: [60, 0] },
  ]);
});

test('solo and mute select the same audible tracks as audio export, without installed samples', async () => {
  const file = await parse(exportMidi(project([
    track('piano'), track('bass', { solo: true }), track('kick', { solo: true, muted: true }),
  ]), library));
  assert.equal(file.tracks.length, 2);
  assert.equal(new TextDecoder().decode(new Uint8Array(file.tracks[1][0].data)), 'bass');
});

test('GM percussion uses channel 10, fixed drum pitches and per-track velocity gain', async () => {
  const file = await parse(exportMidi(project(['kick', 'snare', 'hihat', 'tom', 'crash', 'clap', 'shaker'].map(id => track(id))), library));
  assert.deepEqual(file.tracks.slice(1).map(events => events.find(e => e.status === 0x99).data), [
    [36, 76], [38, 76], [42, 76], [45, 76], [49, 76], [39, 76], [70, 76],
  ]);
  assert.equal(file.tracks.slice(1).flat().some(e => (e.status & 0xf0) === 0xc0), false);
});

test('overlapping and adjacent repeated notes retain attacks, with note-off before next note-on', async () => {
  const file = await parse(exportMidi(project([track('piano', { notes: [note(0, 2), note(1, 1), note(2, 1)] })]), library));
  const notes = file.tracks[1].filter(e => (e.status & 0xe0) === 0x80);
  assert.deepEqual(notes.map(e => [e.tick, e.status]), [
    [0, 0x90], [480, 0x80], [480, 0x90], [960, 0x80], [960, 0x90], [1440, 0x80],
  ]);
});

test('new acoustic rock kit exports the correct GM drum pitches', async () => {
  const ids = ['rock-kick', 'rock-snare', 'rock-hihat', 'rock-tom', 'rock-crash'];
  const kit = ids.map(id => ({ id, percussive: true }));
  const file = await parse(exportMidi(project(ids.map(id => track(id))), kit));
  assert.deepEqual(file.tracks.slice(1).map(events => events.find(e => e.status === 0x99).data[0]), [36, 38, 42, 45, 49]);
});

test('808 kit and drum articulations export their own GM drum keys', async () => {
  const kit = [
    { id: 'tr808-kick', percussive: true }, { id: 'tr808-snare', percussive: true }, { id: 'tr808-clap', percussive: true },
    { id: 'tr808-hihat', percussive: true, defaultArticulation: 'closed' }, { id: 'tr808-perc', percussive: true, defaultArticulation: 'rim' },
    { id: 'rock-hihat', percussive: true, defaultArticulation: 'hit' }, { id: 'rock-snare', percussive: true, defaultArticulation: 'hit' },
  ];
  const tracks = [
    track('tr808-kick'), track('tr808-snare'), track('tr808-clap'), track('tr808-hihat'),
    track('tr808-hihat', { id: 'oh', notes: [{ ...note(), articulation: 'open' }] }), track('tr808-perc'),
    track('tr808-perc', { id: 'cb', articulation: 'cowbell' }), track('rock-hihat', { notes: [{ ...note(), articulation: 'open' }] }),
    track('rock-snare', { notes: [{ ...note(), articulation: 'crossstick' }] }),
  ];
  const file = await parse(exportMidi(project(tracks), kit));
  assert.deepEqual(file.tracks.slice(1).map(events => events.find(e => e.status === 0x99).data[0]), [36, 38, 39, 42, 46, 37, 56, 46, 37]);
});

test('notes outside the project are omitted and gates are clipped to its boundary', async () => {
  const file = await parse(exportMidi(project([track('piano', { notes: [note(-1), note(7, 4), note(8), { ...note(1), velocity: 0 }] })]), library));
  assert.deepEqual(file.tracks[1].filter(e => (e.status & 0xe0) === 0x80).map(e => [e.tick, e.status]), [
    [3360, 0x90], [3840, 0x80],
  ]);
});

test('melodic channel allocation skips channel 10 and rejects unsupported channel collisions', async () => {
  const tracks = Array.from({ length: 15 }, (_, i) => track('piano', { id: `t${i}` }));
  const file = await parse(exportMidi(project(tracks), library));
  const channels = file.tracks.slice(1).map(events => events.find(e => (e.status & 0xf0) === 0x90).status & 15);
  assert.deepEqual(channels, [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15]);
  assert.throws(() => exportMidi(project([...tracks, track('piano')]), library), /15/);
});
