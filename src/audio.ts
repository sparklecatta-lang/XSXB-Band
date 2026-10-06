import type { Instrument, InstrumentSample, Note, Project, Track } from './types';
import { createTrackEffect, type NamAmpNode } from './effects';
import { NamEngine } from './vendor/nam/engine';
import { NamWorkerPool } from './nam-workers';
import { effectiveArticulation, sampleCandidates, selectSample, trackSeed } from './sample-selection';
import { createRoomReverb, noteVariation, type RoomReverb } from './space';

export interface PlayOptions {
  fromBeat?: number;
  loop?: boolean;
  onBeat?: (beat: number) => void;
  onEnd?: () => void;
  /** Background failures after playback started (e.g. a NAM chunk could not render). */
  onError?: (error: Error) => void;
}

interface ScheduledNote {
  note: Note;
  track: Track;
  instrument: Instrument;
  buffer: AudioBuffer;
  root: number;
  sample: InstrumentSample;
  /** Deterministic humanisation detune, in cents. */
  cents: number;
}

interface Voice { source: AudioBufferSourceNode; gain: GainNode }
interface TrackBus { input: GainNode; update(track: Track): void; dispose(): void }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
// Live playback "freezes" NAM tracks: each WaveNet costs ~30 % of real time, so several running
// on the single audio thread would underrun. Chunks render ahead on offline threads instead.
const NAM_CHUNK_SECONDS = 6;
const NAM_PREROLL_SECONDS = 0.3;
const NAM_OVERLAP_SECONDS = 0.02;
const validNote = (note: Note) => Number.isFinite(note.midi) && Number.isFinite(note.start)
  && Number.isFinite(note.duration) && note.start >= 0 && note.duration > 0 && note.velocity > 0;

function audibleTracks(project: Project): Track[] {
  const solo = project.tracks.some(track => track.solo);
  const beats = project.bars * project.timeSignature[0] * 4 / project.timeSignature[1];
  return project.tracks.filter(track => !track.muted && (!solo || track.solo)
    && track.notes.some(note => validNote(note) && note.start < beats));
}

function projectTiming(project: Project) {
  if (!Number.isFinite(project.bpm) || project.bpm < 20 || project.bpm > 400
    || !Number.isFinite(project.bars) || project.bars < 1) {
    throw new Error('工程速度或小节数无效，无法播放。');
  }
  const beats = project.bars * project.timeSignature[0] * 4 / project.timeSignature[1];
  return { beats, secondsPerBeat: 60 / project.bpm };
}

/** Sample-only instrument player: a missing recording is an error, never a synth fallback. */
export class AudioEngine {
  private library = new Map<string, Instrument>();
  private context?: AudioContext;
  private master?: GainNode;
  private reverb?: RoomReverb;
  private volume = 0.8;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private voices = new Set<Voice>();
  private buses = new Map<string, TrackBus>();
  private trackSettings = new Map<string, Track>();
  private cabinetBuffers = new Map<string, Promise<AudioBuffer>>();
  private namModels = new Map<string, Promise<string>>();
  private namChunks = new Map<string, Promise<AudioBuffer>>();
  /** Diagnostics: frozen NAM chunks that finished rendering after their start time. */
  lateNamChunks = 0;
  private namPool?: NamWorkerPool;

  private namWorkers(): NamWorkerPool {
    // Leave cores for the UI and the real-time audio thread.
    this.namPool ??= new NamWorkerPool(new URL('/nam/nam-worker.js', globalThis.location?.href),
      clamp((globalThis.navigator?.hardwareConcurrency ?? 4) - 2, 1, 6));
    return this.namPool;
  }
  private previewIndex = 0;
  private timer?: ReturnType<typeof setInterval>;
  private generation = 0;

  setLibrary(instruments: Instrument[]): void {
    this.library = new Map(instruments.map(instrument => [instrument.id, instrument]));
  }

  setMasterVolume(value: number): void {
    this.volume = clamp(Number.isFinite(value) ? value : 0.8, 0, 1);
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.015);
    }
  }

  /** Apply mixer and pedal edits immediately without restarting the transport. */
  updateTrack(track: Track): void {
    this.trackSettings.set(track.id, track);
    this.buses.get(track.id)?.update(track);
  }

  private createBus(context: BaseAudioContext, output: GainNode, track: Track, cabinetBuffer?: AudioBuffer, reverb?: RoomReverb, namNode?: NamAmpNode): TrackBus {
    // A capture expects a real DI level: remove the instrument's listening calibration before the amp.
    const namInputTrimDb = -(this.library.get(track.instrumentId)?.volumeDb ?? 0);
    const effect = createTrackEffect(context, track.effects, { cabinetBuffer, namNode, namInputTrimDb });
    const volume = context.createGain();
    const pan = context.createStereoPanner();
    const send = context.createGain();
    volume.gain.value = clamp(track.volume, 0, 1);
    pan.pan.value = clamp(track.pan, -1, 1);
    send.gain.value = clamp(track.reverb ?? 0, 0, 1);
    effect.output.connect(volume);
    volume.connect(pan);
    pan.connect(output);
    // Post-fader, post-pan send keeps the room image where the dry sound sits.
    if (reverb) pan.connect(send).connect(reverb.input);
    return {
      input: effect.input,
      update(next) {
        effect.update(next.effects);
        volume.gain.setTargetAtTime(clamp(next.volume, 0, 1), context.currentTime, 0.012);
        pan.pan.setTargetAtTime(clamp(next.pan, -1, 1), context.currentTime, 0.012);
        send.gain.setTargetAtTime(clamp(next.reverb ?? 0, 0, 1), context.currentTime, 0.012);
      },
      dispose() { effect.dispose(); volume.disconnect(); pan.disconnect(); send.disconnect(); },
    };
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      ({ master: this.master, reverb: this.reverb } = this.createOutput(this.context));
    }
    return this.context;
  }

  private createOutput(context: BaseAudioContext, masterLevel = this.volume): { master: GainNode; reverb: RoomReverb } {
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.gain.value = masterLevel;
    compressor.threshold.value = -8;
    compressor.knee.value = 12;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    master.connect(compressor);
    compressor.connect(context.destination);
    return { master, reverb: createRoomReverb(context, master) };
  }

  private instrument(id: string): Instrument {
    const instrument = this.library.get(id);
    if (!instrument) throw new Error(`找不到乐器「${id}」，请刷新音源库。`);
    if (instrument.installed === false) {
      throw new Error(`「${instrument.name}」音源尚未下载，请在音源库中点击下载。`);
    }
    if (!instrument.samples.length) throw new Error(`「${instrument.name}」没有可用采样。`);
    return instrument;
  }

  private loadSample(instrument: Instrument, sample: InstrumentSample): Promise<AudioBuffer> {
    const existing = this.buffers.get(sample.url);
    if (existing) return existing;
    const context = this.getContext();
    const pending = (async () => {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 30_000);
      try {
        const response = await fetch(sample.url, { signal: abort.signal });
        if (!response.ok) {
          if (response.status === 404) throw new Error(`「${instrument.name}」音源尚未下载或文件缺失，请前往音源库下载。`);
          throw new Error(`「${instrument.name}」采样读取失败（${response.status}）。`);
        }
        try {
          return await context.decodeAudioData(await response.arrayBuffer());
        } catch {
          throw new Error(`「${instrument.name}」采样无法解码，请在音源库重新下载。`);
        }
      } catch (error) {
        this.buffers.delete(sample.url);
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error(`「${instrument.name}」采样读取超时，请确认本地服务仍在运行。`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    })();
    this.buffers.set(sample.url, pending);
    return pending;
  }

  private assignments(project: Project) {
    const { beats, secondsPerBeat } = projectTiming(project);
    const events: { note: Note; track: Track; instrument: Instrument; sample: InstrumentSample; cents: number }[] = [];
    for (const track of audibleTracks(project)) {
      const notes = track.notes.filter(note => validNote(note) && note.start < beats).sort((a, b) => a.start - b.start || a.midi - b.midi);
      if (!notes.length) continue;
      const instrument = this.instrument(track.instrumentId);
      if (instrument.kind === 'cabinet') throw new Error('箱体响应不能作为音符乐器');
      const counters = new Map<string, number>();
      for (const note of notes) {
        // Humanise before choosing a recording, so a velocity change can select a different real layer.
        const variation = noteVariation(track.id, note.id, track.humanize ?? 0);
        const velocity = clamp(note.velocity * variation.velocity, 0.01, 1);
        const start = clamp(note.start + variation.seconds / secondsPerBeat, 0, beats - 0.001);
        const candidates = sampleCandidates(instrument, note.midi, velocity, effectiveArticulation(instrument, track, note));
        const key = candidates.map(s => s.url).join('|');
        const rr = counters.get(key) ?? trackSeed(track.id);
        counters.set(key, rr + 1);
        const sample = candidates[rr % candidates.length];
        events.push({ note: { ...note, start, velocity, duration: Math.max(0.001, Math.min(note.duration, beats - start)) }, track, instrument, sample, cents: variation.cents });
      }
    }
    return events.sort((a, b) => a.note.start - b.note.start);
  }

  private async loadCabinet(track: Pick<Track, 'effects'>, context: BaseAudioContext) {
    const id = track.effects?.enabled ? track.effects.cabinetId : undefined;
    if (!id) return undefined;
    const instrument = this.instrument(id);
    if (instrument.kind !== 'cabinet') throw new Error('选中的音源不是箱体响应');
    const sample = instrument.samples[0], key = `${sample.url}:${context.sampleRate}`;
    if (!this.cabinetBuffers.has(key)) {
      const pending = (async () => {
        const response = await fetch(sample.url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`请先下载箱体响应「${instrument.name}」`);
        return context.decodeAudioData(await response.arrayBuffer());
      })().catch(error => { this.cabinetBuffers.delete(key); throw error; });
      this.cabinetBuffers.set(key, pending);
    }
    return this.cabinetBuffers.get(key)!;
  }

  /** One NAM node per track (mono WaveNet capture), loaded while the context is running. */
  private async loadNam(track: Pick<Track, 'effects'>, context: BaseAudioContext): Promise<NamAmpNode | undefined> {
    const effects = track.effects;
    if (!effects?.enabled || effects.ampModel !== 'nam' || !effects.namModelId) return undefined;
    const model = this.instrument(effects.namModelId);
    if (model.kind !== 'amp-model') throw new Error('选中的音源不是 NAM 箱头模型');
    const url = model.samples[0].url;
    if (!this.namModels.has(url)) {
      const pending = (async () => {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`请先下载箱头模型「${model.name}」`);
        return response.text();
      })().catch(error => { this.namModels.delete(url); throw error; });
      this.namModels.set(url, pending);
    }
    const json = await this.namModels.get(url)!;
    const timeout = <T,>(promise: Promise<T>) => Promise.race([promise, new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`NAM 箱头「${model.name}」加载超时，请确认浏览器支持 AudioWorklet。`)), 20000))]);
    const engine = await timeout(NamEngine.attach(context, { assetBaseUrl: new URL('/nam/', globalThis.location?.href) }));
    const node = await timeout(engine.createNode());
    await timeout(node.loadModel(json));
    // Older captures carry no loudness metadata; the catalogue stores a measured make-up gain.
    return Object.assign(node, { makeupDb: model.volumeDb ?? 0 });
  }

  private isNam(track: Pick<Track, 'effects'>) {
    return !!(track.effects?.enabled && track.effects.ampModel === 'nam' && track.effects.namModelId);
  }

  /** Live stand-in for a frozen capture: pre-rendered chunks feed this node instead of a running NAM. */
  private frozenNamInput(track: Track, context: BaseAudioContext): NamAmpNode {
    const model = this.instrument(track.effects!.namModelId!);
    if (model.kind !== 'amp-model') throw new Error('选中的音源不是 NAM 箱头模型');
    return Object.assign(context.createGain(), { makeupDb: model.volumeDb ?? 0 });
  }

  /**
   * Renders one chunk of a track's capture output (pre-cabinet, mono) on its own offline thread.
   * A pre-roll warms the network state; a short overlap at the end feeds the crossfade.
   */
  private renderNamChunk(trackId: string, events: ScheduledNote[], k: number, secondsPerBeat: number,
    sampleRate: number, totalSeconds: number): Promise<AudioBuffer> {
    const track = this.trackSettings.get(trackId) ?? events[0].track;
    const effects = track.effects!;
    const start = k * NAM_CHUNK_SECONDS, from = Math.max(0, start - NAM_PREROLL_SECONDS);
    const end = Math.min(totalSeconds, start + NAM_CHUNK_SECONDS) + NAM_OVERLAP_SECONDS;
    const relevant = events.filter(event => {
      const at = event.note.start * secondsPerBeat;
      return at < end && at + this.voiceLength(event, secondsPerBeat) > from;
    });
    const key = JSON.stringify([trackId, track.instrumentId, effects.namModelId, effects.drive, sampleRate, secondsPerBeat, k, totalSeconds,
      relevant.map(event => [event.note.id, event.note.midi, event.note.start, event.note.duration, event.note.velocity, event.sample.url, event.cents, event.track.release])]);
    const cached = this.namChunks.get(key);
    if (cached) return cached;
    const pending = this.renderNamSpan(track, relevant, from, start, end, secondsPerBeat, sampleRate).then(wet => {
      const chunk = new AudioBuffer({ numberOfChannels: 1, length: Math.max(1, wet.length), sampleRate });
      chunk.copyToChannel(wet, 0);
      return chunk;
    }).catch(error => { this.namChunks.delete(key); throw error; });
    if (this.namChunks.size > 600) this.namChunks.delete(this.namChunks.keys().next().value!);
    this.namChunks.set(key, pending);
    return pending;
  }

  /**
   * Renders a track's capture output (pre-cabinet, mono) for [start, end): the DI is rendered offline
   * from `from` (pre-roll that warms the network), the capture runs in a worker, and the pre-roll is dropped.
   */
  private async renderNamSpan(track: Track, events: ScheduledNote[], from: number, start: number, end: number,
    secondsPerBeat: number, sampleRate: number): Promise<Float32Array<ArrayBuffer>> {
    const effects = track.effects!;
    {
      const context = new OfflineAudioContext(1, Math.ceil((end - from) * sampleRate), sampleRate);
      const trim = context.createGain();
      trim.channelCount = 1;
      trim.channelCountMode = 'explicit';
      // Same input stage as the live chain: raw DI level, then drive, then the tightening high-pass.
      trim.gain.value = 10 ** ((clamp(effects.drive, 0, 1) * 24 - 12 - (this.library.get(track.instrumentId)?.volumeDb ?? 0)) / 20);
      const tight = context.createBiquadFilter();
      tight.type = 'highpass';
      tight.frequency.value = 80;
      tight.Q.value = 0.707;
      // 1) The DI part (sample voices, trim, high-pass) is cheap: render it offline.
      trim.connect(tight).connect(context.destination);
      for (const event of events) {
        const at = event.note.start * secondsPerBeat;
        if (at + this.voiceLength(event, secondsPerBeat) <= from || at >= end) continue;
        if (at >= from) this.schedule(context, trim, event, at - from, secondsPerBeat);
        else this.schedule(context, trim, event, 0, secondsPerBeat, from - at);
      }
      const di = await context.startRendering();
      // 2) The capture runs in a worker; several tracks and chunks render on separate cores.
      const model = this.instrument(effects.namModelId!);
      const wet = await this.namWorkers().process(new URL(model.samples[0].url, globalThis.location?.href).href,
        di.getChannelData(0).slice(), sampleRate);
      return wet.slice(Math.round((start - from) * sampleRate));
    }
  }

  async preload(project: Project): Promise<void> {
    await Promise.all([
      ...this.assignments(project).map(event => this.loadSample(event.instrument, event.sample)),
      ...audibleTracks(project).map(track => this.loadCabinet(track, this.getContext())),
    ]);
  }

  private async events(project: Project): Promise<ScheduledNote[]> {
    return Promise.all(this.assignments(project).map(async event => ({ ...event, buffer: await this.loadSample(event.instrument, event.sample), root: event.sample.midi })));
  }

  private playbackRate(event: ScheduledNote) {
    return 2 ** ((event.note.midi - event.root) / 12 + ((event.sample.tuneCents ?? 0) + event.cents) / 1200);
  }

  private noteRelease(event: ScheduledNote): number {
    return event.track.release === undefined
      ? clamp(event.instrument.release ?? 0.15, 0.012, 2)
      : clamp(event.track.release, 0.005, 2);
  }

  private voiceLength(event: ScheduledNote, secondsPerBeat: number, elapsed = 0): number {
    const rate = this.playbackRate(event);
    const available = Math.max(0, (event.buffer.duration - (event.sample.offsetSeconds ?? 0)) / rate - elapsed);
    const release = this.noteRelease(event);
    // Drums are one-shot recordings; a short grid note must not clip their natural decay.
    return Math.min(available, event.instrument.percussive
      ? 12 : Math.max(0, event.note.duration * secondsPerBeat - elapsed) + release);
  }

  private schedule(context: BaseAudioContext, output: GainNode, event: ScheduledNote,
    when: number, secondsPerBeat: number, elapsed = 0, live = false, onEnded?: () => void): void {
    const length = this.voiceLength(event, secondsPerBeat, elapsed);
    if (length < 0.003) { onEnded?.(); return; }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const rate = this.playbackRate(event);
    const instrumentDb = (event.instrument.volumeDb ?? 0) + (event.sample.gainDb ?? 0);
    const velocityGain = event.sample.velocityTracking === false ? 1
      : clamp(event.note.velocity / (event.sample.velocityReference ?? 1), 0, 1) ** 1.35;
    const level = 0.55 * velocityGain * 10 ** (clamp(instrumentDb, -36, 24) / 20);
    const attack = Math.min(event.instrument.attack ?? (event.instrument.percussive ? 0.001 : 0.004), length / 4);
    const release = Math.min(event.instrument.percussive ? 0.014 : this.noteRelease(event), length / 2);
    source.buffer = event.buffer;
    source.playbackRate.value = rate;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + attack);
    gain.gain.setValueAtTime(level, when + Math.max(attack, length - release));
    gain.gain.linearRampToValueAtTime(0, when + length);
    source.connect(gain);
    gain.connect(output);
    const voice = { source, gain };
    if (live) this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect();
      gain.disconnect();
      onEnded?.();
    };
    source.start(when, Math.max(0, (event.sample.offsetSeconds ?? 0) + elapsed * rate));
    source.stop(when + length + 0.002);
  }

  async play(project: Project, options: PlayOptions = {}): Promise<void> {
    this.stop();
    const generation = this.generation;
    this.trackSettings = new Map(project.tracks.map(track => [track.id, track]));
    const context = this.getContext();
    // Resume inside the user gesture, before waiting for network / decoding.
    const resumed = context.resume();
    const { beats, secondsPerBeat } = projectTiming(project);
    const fromBeat = clamp(options.fromBeat ?? 0, 0, beats - 0.000001);
    const loop = options.loop ?? true;
    const frozen = new Set(audibleTracks(project).filter(track => this.isNam(track)).map(track => track.id));
    const [allEvents, , cabinets] = await Promise.all([this.events(project), resumed,
      Promise.all(audibleTracks(project).map(async track => [track.id, await this.loadCabinet(track, context)] as const))]);
    if (generation !== this.generation) return;
    const namInputs = new Map(audibleTracks(project).filter(track => frozen.has(track.id)).map(track => [track.id, this.frozenNamInput(track, context)] as const));
    const cabinetMap = new Map(cabinets);
    for (const event of allEvents) {
      if (!this.buses.has(event.track.id)) this.buses.set(event.track.id,
        this.createBus(context, this.master!, this.trackSettings.get(event.track.id) ?? event.track, cabinetMap.get(event.track.id), this.reverb, namInputs.get(event.track.id)));
    }
    const length = beats * secondsPerBeat;
    const fromSeconds = fromBeat * secondsPerBeat;
    const frozenEvents = new Map([...frozen].map(id => [id, allEvents.filter(event => event.track.id === id)] as const));
    const chunkCount = Math.ceil(length / NAM_CHUNK_SECONDS);
    const firstChunk = Math.floor(fromSeconds / NAM_CHUNK_SECONDS);
    const chunk = (id: string, k: number) => this.renderNamChunk(id, frozenEvents.get(id)!, k, secondsPerBeat, context.sampleRate, length);
    // Render the chunk under the playhead before starting; later chunks render while playing.
    await Promise.all([...frozen].flatMap(id => [chunk(id, firstChunk), ...(firstChunk + 1 < chunkCount ? [chunk(id, firstChunk + 1)] : [])]));
    if (generation !== this.generation) return;
    const events = allEvents.filter(event => !frozen.has(event.track.id));
    const begin = context.currentTime + 0.045;
    const origin = begin - fromSeconds;
    let cycle = 0;
    let index = events.findIndex(event => event.note.start >= fromBeat);
    if (index < 0) { index = 0; cycle = 1; }

    const playChunk = (id: string, buffer: AudioBuffer, chunkCycle: number, k: number) => {
      if (generation !== this.generation) return;
      const chunkStart = k * NAM_CHUNK_SECONDS, chunkEnd = Math.min(length, chunkStart + NAM_CHUNK_SECONDS);
      const fades = chunkEnd < length;
      let when = origin + chunkCycle * length + chunkStart, offset = 0;
      if (chunkCycle === 0 && k === firstChunk && fromSeconds > chunkStart) { offset = fromSeconds - chunkStart; when = begin; }
      const now = context.currentTime;
      if (when < now) { offset += now - when; when = now; this.lateNamChunks++; } // rendered late: skip ahead rather than drift
      const stopAt = origin + chunkCycle * length + chunkEnd + (fades ? NAM_OVERLAP_SECONDS : 0);
      if (stopAt <= when + 0.003 || offset >= buffer.duration) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      if (k > 0 && offset === 0) { gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(1, when + NAM_OVERLAP_SECONDS); }
      if (fades && stopAt - NAM_OVERLAP_SECONDS > when + NAM_OVERLAP_SECONDS) {
        gain.gain.setValueAtTime(1, stopAt - NAM_OVERLAP_SECONDS);
        gain.gain.linearRampToValueAtTime(0, stopAt);
      }
      source.connect(gain);
      gain.connect(namInputs.get(id)!);
      const voice = { source, gain };
      this.voices.add(voice);
      source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); };
      source.start(when, offset);
      source.stop(stopAt);
    };
    // Global chunk sequence (cycle * chunkCount + k) of the next chunk to request, per frozen track.
    const nextChunk = new Map([...frozen].map(id => [id, firstChunk] as const));
    const pumpChunks = (now: number) => {
      for (const id of frozen) {
        let sequence = nextChunk.get(id)!;
        // After a background-tab pause, jump to the chunk under the playhead.
        const behind = Math.floor(Math.max(0, now - origin) / length) * chunkCount + Math.floor((Math.max(0, now - origin) % length) / NAM_CHUNK_SECONDS);
        if (sequence < behind) sequence = behind;
        while (true) {
          const chunkCycle = Math.floor(sequence / chunkCount), k = sequence % chunkCount;
          if (!loop && chunkCycle > 0) break;
          if (origin + chunkCycle * length + k * NAM_CHUNK_SECONDS > now + 2 * NAM_CHUNK_SECONDS) break;
          chunk(id, k).then(buffer => playChunk(id, buffer, chunkCycle, k))
            .catch(error => { if (generation === this.generation) options.onError?.(error); });
          sequence += 1;
        }
        nextChunk.set(id, sequence);
      }
    };

    // Seeking into a held note uses the matching position inside its recording.
    for (const event of events) {
      if (event.note.start < fromBeat && event.note.start + event.note.duration > fromBeat) {
        this.schedule(context, this.buses.get(event.track.id)!.input, event, begin, secondsPerBeat,
          (fromBeat - event.note.start) * secondsPerBeat, true);
      }
    }
    const tick = () => {
      if (generation !== this.generation) return;
      const now = context.currentTime;
      const elapsed = Math.max(fromBeat * secondsPerBeat, now - origin);
      if (!loop && elapsed >= length) {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
        options.onBeat?.(beats);
        options.onEnd?.();
        return;
      }
      options.onBeat?.((loop ? elapsed % length : elapsed) / secondsPerBeat);
      pumpChunks(now);
      if (!events.length) return;
      // A background-tab pause must not schedule every missed loop in a burst.
      const currentCycle = Math.max(0, Math.floor((now - origin) / length));
      if (loop && cycle < currentCycle) { cycle = currentCycle; index = 0; }
      while (loop || cycle === 0) {
        const event = events[index];
        const when = origin + cycle * length + event.note.start * secondsPerBeat;
        if (when > now + 0.18) break;
        if (when >= now - 0.025) {
          this.schedule(context, this.buses.get(event.track.id)!.input, event, Math.max(when, now), secondsPerBeat, 0, true);
        }
        index += 1;
        if (index >= events.length) { index = 0; cycle += 1; }
      }
    };
    this.timer = setInterval(tick, 25);
    tick();
  }

  stop(): void {
    this.generation += 1;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    const now = this.context?.currentTime ?? 0;
    for (const { source, gain } of this.voices) {
      gain.gain.cancelAndHoldAtTime(now);
      gain.gain.linearRampToValueAtTime(0, now + 0.008);
      source.stop(now + 0.01);
    }
    this.voices.clear();
    const buses = [...this.buses.values()];
    this.buses.clear();
    this.trackSettings.clear();
    // Keep the old buses connected until the short stop-fade has finished.
    if (buses.length) setTimeout(() => buses.forEach(bus => bus.dispose()), 30);
  }

  async preview(instrumentId: string, midi: number, velocity = 0.7, duration = 0.6,
    settings?: Pick<Track, 'effects' | 'volume' | 'pan' | 'release' | 'articulation'>): Promise<void> {
    const generation = this.generation;
    const instrument = this.instrument(instrumentId);
    const context = this.getContext();
    const sample = selectSample(instrument, midi, velocity, effectiveArticulation(instrument, settings), this.previewIndex++);
    const resumed = context.resume();
    const [buffer, , cabinet, nam] = await Promise.all([this.loadSample(instrument, sample), resumed, this.loadCabinet(settings || {}, context), resumed.then(() => this.loadNam(settings || {}, context))]);
    if (generation !== this.generation) { void nam?.dispose?.(); return; }
    const event: ScheduledNote = {
      instrument, buffer, sample, root: sample.midi, cents: 0,
      note: { id: 'preview', midi, start: 0, duration: clamp(duration, 0.03, 10), velocity },
      track: { id: 'preview', instrumentId, name: '', color: '', volume: 0.8, pan: 0, muted: false, solo: false, notes: [], ...settings },
    };
    const bus = this.createBus(context, this.master!, event.track, cabinet, this.reverb, nam);
    this.schedule(context, bus.input, event, context.currentTime + 0.006, 1, 0, true, () => bus.dispose());
  }

  async renderWav(project: Project): Promise<Blob> {
    const { beats, secondsPerBeat } = projectTiming(project);
    const seconds = beats * secondsPerBeat;
    if (seconds > 300) throw new Error('WAV 离线导出暂限 5 分钟以内，以避免浏览器内存不足。可缩短工程或导出 MIDI。');
    const events = await this.events(project);
    const lastEnd = events.reduce((end, event) => Math.max(end,
      event.note.start * secondsPerBeat + this.voiceLength(event, secondsPerBeat)), seconds);
    // Leave room for the reverb tail when any audible track sends to it.
    const roomTail = audibleTracks(project).some(track => (track.reverb ?? 0) > 0) ? 2.4 : 0;
    const context = new OfflineAudioContext(2, Math.ceil((lastEnd + roomTail + 0.125) * 44100), 44100);
    // Monitor volume is local listening comfort; exports always use a fixed master.
    const { master: output, reverb } = this.createOutput(context, 0.8);
    const buses = new Map<string, TrackBus>();
    const cabinets = new Map(await Promise.all(audibleTracks(project).map(async track => [track.id, await this.loadCabinet(track, context)] as const)));
    const namTracks = audibleTracks(project).filter(track => this.isNam(track));
    const namInputs = new Map(namTracks.map(track => [track.id, this.frozenNamInput(track, context)] as const));
    const captures = await Promise.all(namTracks.map(track => this.renderNamSpan(track,
      events.filter(event => event.track.id === track.id), 0, 0, lastEnd, secondsPerBeat, context.sampleRate)));
    for (const event of events) {
      if (!buses.has(event.track.id)) buses.set(event.track.id, this.createBus(context, output, event.track, cabinets.get(event.track.id), reverb, namInputs.get(event.track.id)));
      if (!namInputs.has(event.track.id)) this.schedule(context, buses.get(event.track.id)!.input, event, event.note.start * secondsPerBeat, secondsPerBeat);
    }
    namTracks.forEach((track, i) => {
      const buffer = context.createBuffer(1, captures[i].length, context.sampleRate);
      buffer.copyToChannel(captures[i], 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(namInputs.get(track.id)!);
      source.start(0);
    });
    const audio = await context.startRendering();
    for (const bus of buses.values()) bus.dispose();
    reverb.dispose();
    const bytes = new ArrayBuffer(44 + audio.length * 4);
    const view = new DataView(bytes);
    const writeText = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
    };
    writeText(0, 'RIFF');
    view.setUint32(4, bytes.byteLength - 8, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, 44100, true);
    view.setUint32(28, 44100 * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    writeText(36, 'data');
    view.setUint32(40, audio.length * 4, true);
    const left = audio.getChannelData(0);
    const right = audio.getChannelData(1);
    for (let i = 0; i < audio.length; i += 1) {
      const l = clamp(left[i], -1, 1);
      const r = clamp(right[i], -1, 1);
      view.setInt16(44 + i * 4, Math.round(l * (l < 0 ? 32768 : 32767)), true);
      view.setInt16(46 + i * 4, Math.round(r * (r < 0 ? 32768 : 32767)), true);
    }
    return new Blob([bytes], { type: 'audio/wav' });
  }
}
