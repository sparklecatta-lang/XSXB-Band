import test from 'node:test';
import assert from 'node:assert/strict';
import { timeStretch } from '../src/stretch.ts';

const SR = 48000;
const tone = (hz, seconds) => Float32Array.from({ length: Math.round(SR * seconds) }, (_, i) => Math.sin((2 * Math.PI * hz * i) / SR) * 0.5);
// zero-crossing pitch estimate over the steady middle of a signal
function pitch(x) {
  const a = Math.floor(x.length * 0.25), b = Math.floor(x.length * 0.75);
  let crossings = 0;
  for (let i = a + 1; i < b; i++) if (x[i - 1] < 0 && x[i] >= 0) crossings++;
  return crossings / ((b - a) / SR);
}

test('time stretch changes duration by the factor and keeps the pitch', () => {
  const input = tone(220, 2);
  for (const factor of [0.75, 1.25, 1.6]) {
    const [out] = timeStretch([input], factor, SR);
    assert.equal(out.length, Math.ceil(input.length * factor));
    assert.ok(Math.abs(pitch(out) - 220) < 3, `pitch kept at ×${factor}: ${pitch(out).toFixed(1)} Hz`);
    const rms = Math.sqrt(out.slice(SR / 4, -SR / 4).reduce((s, v) => s + v * v, 0) / (out.length - SR / 2));
    assert.ok(Math.abs(rms - 0.5 / Math.SQRT2) < 0.05, `level kept at ×${factor}: rms ${rms.toFixed(3)}`);
  }
});

test('stereo channels stay aligned and a factor of 1 is an exact copy', () => {
  const l = tone(330, 1), r = tone(330, 1);
  const [ol, or] = timeStretch([l, r], 1.3, SR);
  assert.deepEqual(ol, or);
  const [same] = timeStretch([l], 1, SR);
  assert.deepEqual(same, l);
});
