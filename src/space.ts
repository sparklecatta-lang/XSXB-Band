/**
 * Shared room reverb and deterministic performance variation.
 * The reverb impulse is generated from a fixed seed (no third-party recording), so
 * live playback and every WAV export of the same score are identical.
 */

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stereo hall-like impulse: sparse early reflections, then a decorrelated tail whose highs decay faster. */
export function createRoomImpulse(context: BaseAudioContext, seconds = 2.3, preDelay = 0.016): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.ceil((seconds + preDelay) * rate);
  const buffer = context.createBuffer(2, length, rate);
  const reflections = [0.0071, 0.0113, 0.0167, 0.0211, 0.0283, 0.0347, 0.0419];
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    const random = mulberry32(0x5eed + channel * 7919);
    const start = Math.floor(preDelay * rate);
    reflections.forEach((time, i) => {
      const at = start + Math.floor((time + channel * 0.0013 * (i % 2 ? 1 : -1) + 0.0013) * rate);
      if (at < length) data[at] += (random() < 0.5 ? -1 : 1) * 0.55 * 0.82 ** i;
    });
    // Tail: -60 dB at `seconds`; a one-pole low-pass that closes over time darkens the decay.
    let low = 0;
    const tailStart = start + Math.floor(0.02 * rate);
    for (let i = tailStart; i < length; i++) {
      const t = (i - tailStart) / rate;
      const coefficient = Math.min(0.92, 0.18 + t * 0.55);
      low += (1 - coefficient) * ((random() * 2 - 1) - low);
      const fadeIn = Math.min(1, t / 0.035);
      data[i] += low * Math.exp(-6.91 * t / seconds) * fadeIn * 0.9;
    }
  }
  // Normalise energy so a send of 1 returns roughly the dry level.
  let energy = 0;
  for (let channel = 0; channel < 2; channel++) for (const value of buffer.getChannelData(channel)) energy += value * value;
  const scale = 1 / Math.sqrt(energy / 2);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] *= scale;
  }
  return buffer;
}

export interface RoomReverb { input: GainNode; dispose(): void }

/** One shared reverb per audio context; tracks feed it through post-fader sends. */
export function createRoomReverb(context: BaseAudioContext, destination: AudioNode): RoomReverb {
  const input = context.createGain();
  const lowCut = context.createBiquadFilter();
  const highCut = context.createBiquadFilter();
  const convolver = context.createConvolver();
  const output = context.createGain();
  lowCut.type = 'highpass';
  lowCut.frequency.value = 160;
  highCut.type = 'lowpass';
  highCut.frequency.value = 9000;
  convolver.normalize = false;
  convolver.buffer = createRoomImpulse(context);
  output.gain.value = 0.7;
  input.connect(lowCut);
  lowCut.connect(highCut);
  highCut.connect(convolver);
  convolver.connect(output);
  output.connect(destination);
  return { input, dispose() { for (const node of [input, lowCut, highCut, convolver, output]) node.disconnect(); } };
}

function hash(text: string) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
  return value;
}

export interface Variation { seconds: number; velocity: number; cents: number }

/**
 * Deterministic per-note variation from the track and note IDs.
 * amount 1 = up to ±12 ms timing, ±8 % velocity and ±4 cents.
 */
export function noteVariation(trackId: string, noteId: string, amount: number): Variation {
  if (!(amount > 0)) return { seconds: 0, velocity: 1, cents: 0 };
  const random = mulberry32(hash(`${trackId}\u0000${noteId}`));
  const signed = () => random() + random() - 1; // triangular: small deviations are more common
  const a = Math.min(1, amount);
  return { seconds: signed() * 0.012 * a, velocity: 1 + signed() * 0.08 * a, cents: signed() * 4 * a };
}
