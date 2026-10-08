export interface Note {
  id: string;
  midi: number;
  start: number;
  duration: number;
  velocity: number;
  articulation?: string;
}
export interface Track {
  id: string;
  name: string;
  instrumentId: string;
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  notes: Note[];
  /** Melodic note release in seconds; omitted uses the sample library default. */
  release?: number;
  articulation?: string;
  /** Post-fader send to the shared room reverb, 0–1; omitted = dry. */
  reverb?: number;
  /** Deterministic timing / velocity / tuning variation, 0–1; omitted = exact grid. */
  humanize?: number;
  effects?: { enabled: boolean; drive: number; tone: number; mix: number; output: number; ampModel?: 'none' | 'high-gain' | 'nam'; cabinetId?: string; namModelId?: string };
}
export interface InstrumentSample {
  midi: number;
  url: string;
  /** Absent for personal instruments that only exist on this machine. */
  downloadUrl?: string;
  sha256?: string;
  bytes?: number;
  articulation?: string;
  velocityMin?: number;
  velocityMax?: number;
  roundRobin?: number;
  gainDb?: number;
  offsetSeconds?: number;
  tuneCents?: number;
  velocityTracking?: boolean;
  velocityReference?: number;
  /** Sustain loop in source seconds; lets a short recorded vowel hold for any note length. */
  loopStart?: number;
  loopEnd?: number;
  /** Source tempo of a chop; with `Instrument.stretch` it is time-stretched to the song tempo. */
  bpm?: number;
}
export interface Project {
  schemaVersion: 1;
  id: string;
  title: string;
  bpm: number;
  key: string;
  bars: number;
  timeSignature: [4, 4];
  tracks: Track[];
  updatedAt: string;
}
export interface Instrument {
  kind?: 'instrument' | 'cabinet' | 'amp-model';
  /** Capture author for attribution (amp models). */
  author?: string;
  id: string;
  name: string;
  englishName: string;
  family: string;
  description: string;
  license: string;
  sourceUrl: string;
  licenseUrl?: string;
  installed?: boolean;
  volumeDb?: number;
  color?: string;
  icon?: string;
  samples: InstrumentSample[];
  /** `release` caps the note release for this articulation (short sounds stop with the note); `attack` overrides the fade-in; `legato` joins touching notes;
   *  `glide` (seconds, with `legato`) slides a joined note in from the previous pitch (portamento). */
  articulations?: { id: string; name: string; release?: number; attack?: number; legato?: boolean; glide?: number }[];
  defaultArticulation?: string;
  percussive?: boolean;
  gmProgram?: number;
  attack?: number;
  release?: number;
  /** Local-only instrument from data/user-instruments (e.g. your own voice); never downloaded or published. */
  personal?: boolean;
  /** Chop crates: samples carrying `bpm` follow the project tempo (time-stretched, pitch kept). */
  stretch?: boolean;
}
export interface ServerState { revision: number; project: Project }
