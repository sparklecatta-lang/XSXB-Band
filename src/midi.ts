import type { Instrument, Note, Project } from './types';

const TICKS = 480;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
type Event = { tick: number; priority: number; bytes: number[] };

function variableLength(value: number): number[] {
  let number = Math.max(0, Math.round(value));
  const bytes = [number & 0x7f];
  while ((number = Math.floor(number / 128)) > 0) bytes.unshift((number & 0x7f) | 0x80);
  return bytes;
}

function word(value: number): number[] { return [(value >>> 8) & 255, value & 255]; }
function long(value: number): number[] {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}
function textEvent(text: string): number[] {
  const bytes = [...new TextEncoder().encode(text)];
  return [0xff, 0x03, ...variableLength(bytes.length), ...bytes];
}
function trackChunk(events: Event[], endTick: number): number[] {
  events.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
  const data: number[] = [];
  let lastTick = 0;
  for (const event of events) {
    data.push(...variableLength(event.tick - lastTick), ...event.bytes);
    lastTick = event.tick;
  }
  data.push(...variableLength(Math.max(endTick, lastTick) - lastTick), 0xff, 0x2f, 0);
  return [0x4d, 0x54, 0x72, 0x6b, ...long(data.length), ...data];
}

// MIDI has no voice identity for overlapping copies of a pitch on one channel.
// End an earlier gate before retriggering, preserving every distinct attack.
function prepareNotes(notes: Note[], beats: number, drumPitch?: (note: Note) => number): Note[] {
  const pitches = new Map<number, Note[]>();
  for (const note of notes) {
    if (!Number.isFinite(note.start) || !Number.isFinite(note.duration) || !Number.isFinite(note.midi)
      || note.start < 0 || note.start >= beats || note.duration <= 0 || note.velocity <= 0) continue;
    const midi = drumPitch ? drumPitch(note) : clamp(Math.round(note.midi), 0, 127);
    const list = pitches.get(midi) ?? [];
    list.push({ ...note, midi, duration: Math.min(note.duration, beats - note.start) });
    pitches.set(midi, list);
  }
  const result: Note[] = [];
  for (const notesAtPitch of pitches.values()) {
    notesAtPitch.sort((a, b) => a.start - b.start);
    let previous: Note | undefined;
    for (const note of notesAtPitch) {
      if (previous && Math.round(note.start * TICKS) === Math.round(previous.start * TICKS)) {
        previous.duration = Math.max(previous.duration, note.duration);
        previous.velocity = Math.max(previous.velocity, note.velocity);
        continue;
      }
      if (previous && note.start < previous.start + previous.duration) {
        previous.duration = note.start - previous.start;
      }
      result.push(note);
      previous = note;
    }
  }
  return result;
}

/** Standard MIDI file, format 1. Export requires instrument metadata, not installed samples. */
export function exportMidi(project: Project, library: Instrument[]): Blob {
  if (!Number.isFinite(project.bpm) || project.bpm < 20 || project.bpm > 400
    || !Number.isFinite(project.bars) || project.bars < 1) {
    throw new Error('工程速度或小节数无效，无法导出 MIDI。');
  }
  const beats = project.bars * project.timeSignature[0] * 4 / project.timeSignature[1];
  const endTick = Math.round(beats * TICKS);
  const tempo = Math.round(60_000_000 / project.bpm);
  const solo = project.tracks.some(track => track.solo);
  const audible = project.tracks.filter(track => !track.muted && (!solo || track.solo) && track.volume > 0);
  const instruments = new Map(library.map(instrument => [instrument.id, instrument]));
  const melodicCount = audible.filter(track => !instruments.get(track.instrumentId)?.percussive).length;
  if (melodicCount > 15) throw new Error('标准 MIDI 最多支持 15 条独立旋律音轨；请静音部分轨道后导出。');
  const chunks = [trackChunk([
    { tick: 0, priority: 0, bytes: textEvent(project.title) },
    { tick: 0, priority: 0, bytes: [0xff, 0x51, 3, (tempo >>> 16) & 255, (tempo >>> 8) & 255, tempo & 255] },
    { tick: 0, priority: 0, bytes: [0xff, 0x58, 4, project.timeSignature[0], Math.log2(project.timeSignature[1]), 24, 8] },
  ], endTick)];
  let nextChannel = 0;
  const drumPitches: Record<string, number> = {
    kick: 36, snare: 38, hihat: 42, tom: 45, crash: 49, ride: 51, clap: 39, shaker: 70, perc: 37,
  };
  // Drum articulations that are separate GM drum keys.
  const articulationPitches: Record<string, number> = {
    open: 46, 'open-short': 46, rimshot: 40, crossstick: 37, rim: 37, cowbell: 56, clave: 75, maracas: 70,
  };
  for (const track of audible) {
    const instrument = instruments.get(track.instrumentId);
    if (!instrument) throw new Error(`找不到乐器「${track.instrumentId}」，无法确定 MIDI 音色。`);
    const drum = instrument.percussive ?? false;
    if (nextChannel === 9) nextChannel += 1;
    const channel = drum ? 9 : nextChannel++;
    const events: Event[] = [{ tick: 0, priority: -2, bytes: textEvent(track.name) }];
    if (!drum) {
      events.push(
        { tick: 0, priority: -1, bytes: [0xc0 | channel, clamp(Math.round(instrument.gmProgram ?? 0), 0, 127)] },
        { tick: 0, priority: -1, bytes: [0xb0 | channel, 7, clamp(Math.round(track.volume * 127), 0, 127)] },
        { tick: 0, priority: -1, bytes: [0xb0 | channel, 10, clamp(Math.round((track.pan + 1) * 63.5), 0, 127)] },
      );
    }
    const drumPitch = drumPitches[instrument.id.replace(/^(rock|tr808)-/, '')] ?? 36;
    const notes = prepareNotes(track.notes, beats, drum
      ? note => articulationPitches[note.articulation ?? track.articulation ?? instrument.defaultArticulation ?? ''] ?? drumPitch : undefined);
    for (const note of notes) {
      const start = Math.round(note.start * TICKS);
      const end = Math.max(start + 1, Math.round((note.start + note.duration) * TICKS));
      // All GM drums share channel 10; fold each drum track's gain into velocity.
      const velocity = clamp(Math.round(note.velocity * (drum ? track.volume : 1) * 127), 1, 127);
      events.push(
        { tick: start, priority: 1, bytes: [0x90 | channel, note.midi, velocity] },
        { tick: end, priority: 0, bytes: [0x80 | channel, note.midi, 0] },
      );
    }
    chunks.push(trackChunk(events, endTick));
  }
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, ...word(chunks.length), ...word(TICKS)];
  const length = header.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(length);
  bytes.set(header);
  let offset = header.length;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new Blob([bytes], { type: 'audio/midi' });
}
