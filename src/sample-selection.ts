import type { Instrument, InstrumentSample, Note, Track } from './types';

export function effectiveArticulation(instrument: Instrument, track?: Pick<Track, 'articulation'>, note?: Pick<Note, 'articulation'>) {
  return note?.articulation ?? track?.articulation ?? instrument.defaultArticulation ?? instrument.articulations?.[0]?.id;
}

/** Choose an actual recorded articulation and dynamic layer; never substitute an unrelated technique. */
export function sampleCandidates(instrument: Instrument, midi: number, velocity: number, articulation?: string): InstrumentSample[] {
  let pool = instrument.samples.filter(sample => articulation === undefined || sample.articulation === articulation);
  if (!pool.length) throw new Error(`「${instrument.name}」没有「${articulation || '默认'}」奏法的采样`);
  const distance = Math.min(...pool.map(sample => Math.abs(sample.midi - midi)));
  pool = pool.filter(sample => Math.abs(sample.midi - midi) === distance);
  // A tie between roots always picks one root, so round robin only rotates performances of the same pitch.
  const root = Math.min(...pool.map(sample => sample.midi));
  pool = pool.filter(sample => sample.midi === root);
  const dynamic = pool.filter(sample => velocity >= (sample.velocityMin ?? 0) && velocity <= (sample.velocityMax ?? 1));
  if (dynamic.length) pool = dynamic;
  else {
    const layerDistance = (sample: InstrumentSample) => Math.min(Math.abs(velocity - (sample.velocityMin ?? 0)), Math.abs(velocity - (sample.velocityMax ?? 1)));
    const nearest = Math.min(...pool.map(layerDistance));
    pool = pool.filter(sample => layerDistance(sample) === nearest);
  }
  return pool.sort((a, b) => (a.roundRobin ?? 1) - (b.roundRobin ?? 1) || a.url.localeCompare(b.url));
}

export function selectSample(instrument: Instrument, midi: number, velocity: number, articulation: string | undefined, roundRobin: number) {
  const pool = sampleCandidates(instrument, midi, velocity, articulation);
  return pool[((roundRobin % pool.length) + pool.length) % pool.length];
}

export function trackSeed(id: string) {
  return [...id].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0);
}
