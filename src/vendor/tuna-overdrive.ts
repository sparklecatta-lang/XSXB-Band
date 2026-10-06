/*!
 * Adapted from Tuna.js Overdrive.waveshaperAlgorithms[0], v1.1.2.
 * Source: https://github.com/Theodeus/tuna/blob/f7f45f28364ae44177c91e646dd5d3ba4499a818/tuna.js
 * Changes: isolated pure function; TypeScript types; returns the table.
 *
 * Copyright (c) 2012 DinahMoe AB & Oskar Eriksson
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

export function tunaOverdriveCurve(amount: number): Float32Array<ArrayBuffer> {
  const n_samples = 8192;
  const ws_table = new Float32Array(n_samples);
  amount = Math.min(amount, 0.9999);
  const k = 2 * amount / (1 - amount);
  for (let i = 0; i < n_samples; i++) {
    const x = i * 2 / n_samples - 1;
    ws_table[i] = (1 + k) * x / (1 + k * Math.abs(x));
  }
  return ws_table;
}
