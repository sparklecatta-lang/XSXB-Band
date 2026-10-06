/**
 * Native AudioNode adaptation of AmpSim3's two-stage preamp and tone stack.
 * MIT, Copyright (c) 2016 micbuffa. See docs/AMPSIM-LICENSE.txt.
 * Source: https://github.com/micbuffa/WebAudio-Guitar-Amplifier-Simulator-3/blob/63c9faad4132780fc75cb0380ac60e3f926e004a/js/amp.js
 * Local changes: no UI/global state; normalized drive/tone controls; 4x
 * oversampling; tight input high-pass; modest level compensation; no reverb.
 */
import { ampAsymmetricCurve, ampStandardCurve } from './vendor/ampsim3-curves';

export interface HighGainAmp {
  input: GainNode;
  output: GainNode;
  update(drive: number, tone: number): void;
  dispose(): void;
}

const unit = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function createHighGainAmp(context: BaseAudioContext, drive = 0.5, tone = 0.5): HighGainAmp {
  const input = context.createGain();
  const output = context.createGain();
  const filter = (type: BiquadFilterType, frequency: number, gain = 0) => {
    const node = context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = 0.7071;
    node.gain.value = gain;
    return node;
  };
  const tight = filter('highpass', 70);
  const lowShelf1 = filter('lowshelf', 720, -6);
  const lowShelf2 = filter('lowshelf', 320, -5);
  const stage1Gain = context.createGain();
  const stage1 = context.createWaveShaper();
  stage1.curve = ampAsymmetricCurve();
  stage1.oversample = '4x';
  const dcBlock = filter('highpass', 6);
  const lowShelf3 = filter('lowshelf', 720, -6);
  const stage2Gain = context.createGain();
  const stage2 = context.createWaveShaper();
  stage2.oversample = '4x';
  const treble = filter('highshelf', 6500);
  const bass = filter('lowshelf', 100);
  const mid = filter('peaking', 1700);
  const presence = filter('peaking', 3900);
  const dcOut = filter('highpass', 20);
  const nodes: AudioNode[] = [input, tight, lowShelf1, lowShelf2, stage1Gain, stage1,
    dcBlock, lowShelf3, stage2Gain, stage2, treble, bass, mid, presence, dcOut, output];
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  output.gain.value = 0.7;
  let initialized = false;
  let lastDrive = -1;
  const update = (driveValue: number, toneValue: number) => {
    const d = unit(driveValue), t = unit(toneValue);
    const set = (parameter: AudioParam, value: number) => {
      if (initialized) parameter.setTargetAtTime(value, context.currentTime, 0.012);
      else parameter.value = value;
    };
    set(stage1Gain.gain, 1 + 1.5 * d);
    set(stage2Gain.gain, 0.8 + 1.6 * d);
    if (d !== lastDrive) {
      stage2.curve = ampStandardCurve(6 + 70 * d * d);
      lastDrive = d;
    }
    set(bass.gain, 3 - 4 * t);
    set(mid.gain, -1 + 4 * t);
    set(treble.gain, (t - 0.5) * 10);
    set(presence.gain, (t - 0.5) * 6);
    initialized = true;
  };
  update(drive, tone);
  return { input, output, update, dispose: () => nodes.forEach(node => node.disconnect()) };
}

/** Prepare an actual downloaded IR, preserving source files and measured response. */
export function prepareCabinetBuffer(context: BaseAudioContext, source: AudioBuffer): AudioBuffer {
  if (source.sampleRate !== context.sampleRate) {
    throw new Error('音箱 IR 采样率与当前音频环境不同，请按目标采样率重新解码。');
  }
  if (source.numberOfChannels < 1 || source.numberOfChannels > 2 || source.length < 8) {
    throw new Error('音箱 IR 必须是有效的单声道或立体声录音。');
  }
  // Both curated measured IRs retain >99.9% of their energy within 100 ms.
  const frames = Math.min(source.length, Math.ceil(context.sampleRate * 0.1));
  const buffer = context.createBuffer(source.numberOfChannels, frames, context.sampleRate);
  const fade = Math.min(Math.ceil(context.sampleRate * 0.002), Math.floor(frames / 4));
  let referenceEnergy = 0;
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const target = buffer.getChannelData(channel);
    target.set(source.getChannelData(channel).subarray(0, frames));
    for (let i = 0; i < fade; i++) target[frames - fade + i] *= 1 - i / (fade - 1);
    let real = 0, imaginary = 0;
    for (let i = 0; i < frames; i++) {
      const phase = 2 * Math.PI * 1000 * i / context.sampleRate;
      real += target[i] * Math.cos(phase);
      imaginary -= target[i] * Math.sin(phase);
    }
    referenceEnergy += real * real + imaginary * imaginary;
  }
  const reference = Math.sqrt(referenceEnergy / source.numberOfChannels);
  if (!Number.isFinite(reference) || reference < 0.00001) {
    throw new Error('音箱 IR 在校准频率处没有有效响应，请重新下载音箱资源。');
  }
  const scale = 1 / reference;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  }
  return buffer;
}
