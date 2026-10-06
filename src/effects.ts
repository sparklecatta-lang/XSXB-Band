import type { Track } from './types';
import { tunaOverdriveCurve } from './vendor/tuna-overdrive';
import { createHighGainAmp, prepareCabinetBuffer } from './amp';

export type TrackEffects = NonNullable<Track['effects']>;
export const DEFAULT_EFFECTS: TrackEffects = {
  enabled: false, drive: 0.5, tone: 0.6, mix: 1, output: 0.65,
};

export interface TrackEffect {
  input: GainNode;
  output: GainNode;
  update(settings?: TrackEffects): void;
  dispose(): void;
}

/** A loaded Neural Amp Modeler node (mono in / mono out) owned by this effect. */
export type NamAmpNode = AudioNode & { dispose?: () => Promise<void>; makeupDb?: number };
export interface TrackEffectOptions {
  cabinetBuffer?: AudioBuffer;
  namNode?: NamAmpNode;
  /** dB that undoes the instrument's listening calibration, so the capture sees the raw DI level. */
  namInputTrimDb?: number;
}

const normalized = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/** Select Tuna overdrive, AmpSim3 preamp or a NAM capture, followed by an optional measured cabinet IR. */
export function createTrackEffect(context: BaseAudioContext, initial?: TrackEffects,
  options: TrackEffectOptions = {}): TrackEffect {
  const cabinetId = initial?.cabinetId || undefined;
  const namModelId = initial?.namModelId || undefined;
  if (initial?.enabled && cabinetId && !options.cabinetBuffer) {
    throw new Error('已选择的音箱 IR 尚未加载，请先在音源库下载对应音箱。');
  }
  if (initial?.enabled && initial.ampModel === 'nam' && !options.namNode) {
    throw new Error('已选择的 NAM 箱头尚未加载，请先在音源库下载对应箱头模型。');
  }
  const input = context.createGain();
  const dry = context.createGain();
  const lowCut = context.createBiquadFilter();
  const preamp = context.createGain();
  const shaper = context.createWaveShaper();
  const tone = context.createBiquadFilter();
  const wet = context.createGain();
  const output = context.createGain();
  const pedalSelect = context.createGain();
  const ampSelect = context.createGain();
  const wetInput = context.createGain();
  const amp = createHighGainAmp(context, initial?.drive, initial?.tone);
  // NAM: mono downmix -> 80 Hz tightening high-pass -> input trim (drive) -> neural capture -> tilt EQ (tone).
  const namSelect = context.createGain();
  const namInput = context.createGain();
  const namTight = context.createBiquadFilter();
  namTight.type = 'highpass';
  namTight.frequency.value = 80;
  namTight.Q.value = 0.707;
  namInput.channelCount = 1;
  namInput.channelCountMode = 'explicit';
  namInput.channelInterpretation = 'speakers';
  const namLow = context.createBiquadFilter();
  const namHigh = context.createBiquadFilter();
  namLow.type = 'lowshelf';
  namLow.frequency.value = 250;
  namHigh.type = 'highshelf';
  namHigh.frequency.value = 2500;
  if (options.namNode) {
    input.connect(namInput);
    namInput.connect(namTight);
    namTight.connect(options.namNode);
    options.namNode.connect(namLow);
    namLow.connect(namHigh);
    namHigh.connect(namSelect);
    namSelect.connect(wetInput);
  }
  const cabinet = cabinetId && options.cabinetBuffer ? context.createConvolver() : undefined;
  if (cabinet) {
    cabinet.normalize = false;
    cabinet.buffer = prepareCabinetBuffer(context, options.cabinetBuffer!);
  }
  lowCut.type = 'highpass';
  lowCut.frequency.value = 65;
  lowCut.Q.value = 0.707;
  tone.type = 'lowpass';
  tone.Q.value = 0.707;
  shaper.oversample = '4x';
  input.connect(dry);
  dry.connect(output);
  input.connect(lowCut);
  lowCut.connect(preamp);
  preamp.connect(shaper);
  shaper.connect(tone);
  tone.connect(pedalSelect);
  pedalSelect.connect(wetInput);
  input.connect(amp.input);
  amp.output.connect(ampSelect);
  ampSelect.connect(wetInput);
  if (cabinet) { wetInput.connect(cabinet); cabinet.connect(wet); }
  else wetInput.connect(wet);
  wet.connect(output);
  let lastDrive = -1;
  let initialized = false;
  const update = (settings: TrackEffects = DEFAULT_EFFECTS) => {
    if ((settings.cabinetId || undefined) !== cabinetId) {
      throw new Error('音箱选择已更改，请重新开始播放以加载对应 IR。');
    }
    if (settings.enabled && settings.ampModel === 'nam' && ((settings.namModelId || undefined) !== namModelId || !options.namNode)) {
      throw new Error('NAM 箱头已更改，请重新开始播放以加载对应模型。');
    }
    if (settings.enabled && cabinetId && !options.cabinetBuffer) {
      throw new Error('已选择的音箱 IR 尚未加载，请先在音源库下载对应音箱。');
    }
    const drive = normalized(settings.drive);
    const mix = normalized(settings.mix);
    const smooth = (parameter: AudioParam, value: number) => {
      if (!initialized) parameter.value = value;
      else parameter.setTargetAtTime(value, context.currentTime, 0.012);
    };
    if (drive !== lastDrive) {
      shaper.curve = tunaOverdriveCurve(drive * 0.95);
      lastDrive = drive;
    }
    smooth(preamp.gain, 1 + 8 * drive * drive);
    smooth(tone.frequency, 800 * 15 ** normalized(settings.tone));
    const useAmp = settings.ampModel === 'high-gain', useNam = settings.ampModel === 'nam';
    smooth(pedalSelect.gain, useAmp || useNam ? 0 : 1);
    smooth(ampSelect.gain, useAmp ? 1 : 0);
    smooth(namSelect.gain, useNam ? 10 ** ((options.namNode?.makeupDb ?? 0) / 20) : 0);
    // Drive trims the raw DI level from -12 dB to +12 dB; tone tilts lows against highs.
    smooth(namInput.gain, 10 ** ((drive * 24 - 12 + (options.namInputTrimDb ?? 0)) / 20));
    smooth(namLow.gain, (0.5 - normalized(settings.tone)) * 8);
    smooth(namHigh.gain, (normalized(settings.tone) - 0.5) * 10);
    amp.update(drive, settings.tone);
    smooth(dry.gain, settings.enabled ? 1 - mix : 1);
    smooth(wet.gain, settings.enabled ? mix : 0);
    smooth(output.gain, settings.enabled ? normalized(settings.output) : 1);
    initialized = true;
  };
  update(initial);
  return {
    input, output, update,
    dispose() {
      amp.dispose();
      for (const node of [input, dry, lowCut, preamp, shaper, tone, wet, output,
        pedalSelect, ampSelect, wetInput, namSelect, namInput, namTight, namLow, namHigh]) node.disconnect();
      cabinet?.disconnect();
      if (options.namNode) { options.namNode.disconnect(); void options.namNode.dispose?.().catch(() => {}); }
    },
  };
}
