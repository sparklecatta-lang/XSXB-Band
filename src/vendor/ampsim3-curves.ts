/*!
 * Wave-shaping functions adapted from Michel Buffa's AmpSim3, MIT.
 * https://github.com/micbuffa/WebAudio-Guitar-Amplifier-Simulator-3/blob/63c9faad4132780fc75cb0380ac60e3f926e004a/js/distorsionFactory.js
 * Original functions: classicDistorsion and asymetric.
 * Changes: standalone TypeScript functions; 8192-entry tables; no DOM bindings.
 *
 * Copyright (c) 2016 micbuffa
 * Asymmetric curve originally from Tuna.js:
 * Copyright (c) 2012 DinahMoe AB & Oskar Eriksson
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export function ampStandardCurve(k: number): Float32Array<ArrayBuffer> {
  const n_samples = 8192;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; i++) {
    const x = i * 2 / n_samples - 1;
    curve[i] = (3 + k) * x * 57 * deg / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export function ampAsymmetricCurve(): Float32Array<ArrayBuffer> {
  const n_samples = 8192;
  const curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; i++) {
    const x = i * 2 / n_samples - 1;
    if (x < -0.08905) {
      curve[i] = (-3 / 4) * (1 - Math.pow(1 - (Math.abs(x) - 0.032857), 12)
        + (1 / 3) * (Math.abs(x) - 0.032847)) + 0.01;
    } else if (x < 0.320018) {
      curve[i] = (-6.153 * x * x) + 3.9375 * x;
    } else {
      curve[i] = 0.630035;
    }
  }
  return curve;
}
