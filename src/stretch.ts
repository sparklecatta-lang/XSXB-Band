/**
 * WSOLA time stretch: change the duration of a recording without changing its pitch, so a chop recorded at one tempo
 * can sit in a song at another. factor > 1 makes it longer (slower). Frames of ~46 ms are laid down every half frame
 * and each one is taken from where the waveform best continues the previous frame (searched ±¼ frame around the
 * nominal position), which keeps the joins phase-coherent. All channels use the alignment found on their mono sum.
 */
export function timeStretch(channels: Float32Array[], factor: number, sampleRate: number): Float32Array<ArrayBuffer>[] {
  const input = channels[0];
  if (!input || input.length < 4 || Math.abs(factor - 1) < 1e-3) return channels.map(c => new Float32Array(c));
  const N = 2 ** Math.round(Math.log2(sampleRate * 0.046));
  const Hs = N / 2, Ha = Hs / factor, tolerance = N / 4, overlap = N / 2;
  const mono = new Float32Array(input.length);
  for (const c of channels) for (let i = 0; i < c.length; i++) mono[i] += c[i] / channels.length;
  const outLength = Math.ceil(input.length * factor);
  const out = channels.map(() => new Float32Array(outLength + N));
  const norm = new Float32Array(outLength + N);
  const window = new Float32Array(N);
  for (let i = 0; i < N; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  let previous = 0;
  for (let k = 0; k * Hs < outLength; k++) {
    let position = 0;
    if (k > 0) {
      // the natural continuation of what was just written, and where the clock says the next frame should come from
      const natural = previous + Hs, nominal = Math.round(k * Ha);
      const lo = Math.max(0, nominal - tolerance), hi = Math.min(input.length - overlap - 1, nominal + tolerance);
      let best = Math.min(Math.max(nominal, 0), Math.max(0, input.length - N)), bestScore = -Infinity;
      if (natural + overlap < input.length && hi > lo) {
        for (let p = lo; p <= hi; p += 2) {                     // coarse search on every 2nd lag, every 2nd sample
          let score = 0;
          for (let i = 0; i < overlap; i += 2) score += mono[natural + i] * mono[p + i];
          if (score > bestScore) { bestScore = score; best = p; }
        }
        for (let p = Math.max(lo, best - 2); p <= Math.min(hi, best + 2); p++) {   // refine around the winner
          let score = 0;
          for (let i = 0; i < overlap; i++) score += mono[natural + i] * mono[p + i];
          if (score > bestScore) { bestScore = score; best = p; }
        }
      }
      position = best;
    }
    const at = k * Hs;
    for (let i = 0; i < N && position + i < input.length; i++) {
      const w = window[i];
      for (let c = 0; c < channels.length; c++) out[c][at + i] += channels[c][position + i] * w;
      norm[at + i] += w;
    }
    previous = position;
  }
  return out.map(o => {
    const result = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) result[i] = norm[i] > 1e-3 ? o[i] / norm[i] : 0;
    return result;
  });
}
