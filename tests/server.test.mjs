import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server/app.mjs';
import { validateProject } from '../server/validation.mjs';
import { downloadSample, samplePath } from '../server/download.mjs';

const wave = Buffer.from('RIFF0000WAVEfixture-audio');
const library = [{ id: 'piano', name: '钢琴', license: 'CC0-1.0', samples: [{ midi: 60, url: '/samples/piano/60.wav', downloadUrl: 'https://example.org/piano.wav', bytes: wave.length }] }];
const project = {
  schemaVersion: 1, id: 'test-song', title: '测试乐谱', bpm: 100, key: 'C major', bars: 4,
  timeSignature: [4, 4], updatedAt: '2026-10-04T12:00:00.000Z',
  tracks: [{ id: 't1', name: '钢琴', instrumentId: 'piano', color: '#002FA7', volume: 0.8, pan: 0, muted: false, solo: false,
    notes: [{ id: 'n1', midi: 60, start: 0, duration: 1, velocity: 0.8 }] }],
};
const extendedLibrary = [
  ...library,
  { id: 'electric-guitar', name: '电吉他', kind: 'instrument', license: 'CC0-1.0', articulations: [{ id: 'sustain', name: '延音' }, { id: 'palm-mute', name: '掌根闷音' }], samples: [
    { midi: 48, url: '/samples/electric-guitar/palm-48-rr1.wav', downloadUrl: 'https://example.org/palm-48-rr1.wav', bytes: wave.length, velocityMin: 0, velocityMax: 0.65, roundRobin: 1, articulation: 'palm-mute' },
  ] },
  { id: 'cab-test', name: '箱体 IR', kind: 'cabinet', license: 'CC0-1.0', samples: [
    { midi: 60, url: '/samples/cab-test/open-back.wav', downloadUrl: 'https://example.org/open-back.wav', bytes: wave.length },
  ] },
];

async function fixture(t, options = {}) {
  const { manifest = library, ...appOptions } = options;
  const root = await mkdtemp(path.join(os.tmpdir(), 'klein-server-test-'));
  await mkdir(path.join(root, 'public'));
  await writeFile(path.join(root, 'public/library.json'), JSON.stringify(manifest));
  await writeFile(path.join(root, 'public/demo.json'), JSON.stringify(project));
  let active;
  async function start(runtimeOptions = {}) {
    const result = await createApp({ root, serveFrontend: false, ...appOptions, ...runtimeOptions });
    const server = result.app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    active = { ...result, server, base: `http://127.0.0.1:${server.address().port}` };
    return active;
  }
  async function stop() {
    if (!active) return;
    await new Promise((resolve, reject) => {
      active.server.close((error) => error ? reject(error) : resolve());
      active.server.closeAllConnections();
    });
    await active.close();
    active = null;
  }
  t.after(async () => {
    await stop();
    const relative = path.relative(os.tmpdir(), root);
    assert.match(relative, /^klein-server-test-[A-Za-z0-9]+$/);
    await rm(root, { recursive: true, force: true });
  });
  await start();
  const request = async (route, method = 'GET', body, headers = {}) => {
    const response = await fetch(`${active.base}${route}`, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  return { root, request, start, stop, base: () => active.base };
}

test('validator accepts legal scores, and rejects out-of-range notes, IDs and instruments', () => {
  assert.deepEqual(validateProject(project, library), []);
  const bad = structuredClone(project);
  bad.bpm = 20;
  bad.tracks[0].notes[0].duration = 0;
  bad.tracks[0].notes[0].midi = 128;
  bad.tracks[0].notes[0].velocity = 2;
  bad.tracks[0].instrumentId = 'missing';
  bad.tracks.push(structuredClone(bad.tracks[0]));
  const issues = validateProject(bad, library).join('\n');
  for (const field of ['bpm', 'duration', 'midi', 'velocity', 'instrumentId', '重复']) assert.ok(issues.includes(field));
  const overflow = structuredClone(project);
  overflow.tracks[0].notes[0] = { id: 'n1', midi: 60, start: 15.9, duration: 1, velocity: 1 };
  assert.ok(validateProject(overflow, library).some((message) => message.includes('结束位置')));
  const duplicates = structuredClone(project);
  duplicates.tracks[0].notes.push(structuredClone(duplicates.tracks[0].notes[0]));
  assert.ok(validateProject(duplicates, library).some((message) => message.includes('重复')));
});

test('project saves are revision-checked, atomic, and survive a restart', async (t) => {
  const f = await fixture(t);
  const initial = await f.request('/api/state');
  assert.equal(initial.body.revision, 1);
  const edited = { ...initial.body.project, title: '新的旋律' };
  const saved = await f.request('/api/state', 'PUT', { baseRevision: 1, project: edited });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.revision, 2);
  const conflict = await f.request('/api/state', 'PUT', { baseRevision: 1, project });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.project.title, '新的旋律');
  const bad = await f.request('/api/state', 'PUT', { baseRevision: 2, project: { ...edited, bars: 0 } });
  assert.equal(bad.status, 400);
  assert.equal(JSON.parse(await readFile(path.join(f.root, 'data/project.json'))).revision, 2);
  assert.ok(!(await readdir(path.join(f.root, 'data'))).some((file) => file.endsWith('.tmp')));
  await f.stop();
  await f.start();
  assert.equal((await f.request('/api/state')).body.project.title, '新的旋律');
});

test('optional track effects are validated and preserved across saves and restart', async (t) => {
  const effects = { enabled: true, drive: 0.75, tone: 0.6, mix: 0.4, output: 0.8 };
  const score = structuredClone(project);
  score.tracks[0].effects = effects;
  assert.deepEqual(validateProject(score, library), []);
  for (const invalid of [null, [], { ...effects, enabled: 1 }, { ...effects, drive: -0.01 }, { ...effects, tone: 1.01 }, { ...effects, mix: NaN }, { ...effects, output: '0.8' }]) {
    const bad = structuredClone(score);
    bad.tracks[0].effects = invalid;
    assert.ok(validateProject(bad, library).some((issue) => issue.includes('effects')));
  }
  const f = await fixture(t);
  const saved = await f.request('/api/state', 'PUT', { baseRevision: 1, project: score });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.project.tracks[0].effects, effects);
  await f.stop();
  await f.start();
  assert.deepEqual((await f.request('/api/state')).body.project.tracks[0].effects, effects);
  const bad = structuredClone(score);
  bad.tracks[0].effects.drive = 2;
  const rejected = await f.request('/api/state', 'PUT', { baseRevision: 2, project: bad });
  assert.equal(rejected.status, 400);
  assert.deepEqual((await f.request('/api/state')).body.project.tracks[0].effects, effects);
});

test('short melodic release is validated and survives saving and restarting', async (t) => {
  const score = structuredClone(project);
  score.tracks[0].release = .018;
  assert.deepEqual(validateProject(score, library), []);
  for (const value of [0, .004, 2.01, NaN, '0.018', null]) {
    const bad = structuredClone(score); bad.tracks[0].release = value;
    assert.ok(validateProject(bad, library).some(issue => issue.includes('release')));
  }
  const f = await fixture(t);
  assert.equal((await f.request('/api/state', 'PUT', { baseRevision: 1, project: score })).status, 200);
  await f.stop(); await f.start();
  assert.equal((await f.request('/api/state')).body.project.tracks[0].release, .018);
});

test('articulations and amp/cabinet references must match the selected instrument and resource kind', () => {
  const score = structuredClone(project);
  score.tracks[0].instrumentId = 'electric-guitar';
  score.tracks[0].articulation = 'palm-mute';
  score.tracks[0].notes[0].articulation = 'sustain';
  score.tracks[0].effects = { enabled: true, drive: 0.7, tone: 0.5, mix: 0.8, output: 0.6, ampModel: 'high-gain', cabinetId: 'cab-test' };
  assert.deepEqual(validateProject(score, extendedLibrary), []);
  assert.deepEqual(validateProject(project, extendedLibrary), [], 'legacy tracks without optional fields remain valid');
  for (const invalid of ['', ' ', 'x'.repeat(41), 'unknown', 3, null]) {
    for (const target of ['track', 'note']) {
      const bad = structuredClone(score);
      if (target === 'track') bad.tracks[0].articulation = invalid;
      else bad.tracks[0].notes[0].articulation = invalid;
      const path = target === 'track' ? 'tracks[0].articulation' : 'tracks[0].notes[0].articulation';
      assert.ok(validateProject(bad, extendedLibrary).some((issue) => issue.includes(path)), `${path} rejects ${JSON.stringify(invalid)}`);
    }
  }
  for (const invalid of ['crunch', '', 1, null]) {
    const bad = structuredClone(score);
    bad.tracks[0].effects.ampModel = invalid;
    assert.ok(validateProject(bad, extendedLibrary).some((issue) => issue.includes('ampModel')));
  }
  for (const invalid of ['piano', 'electric-guitar', 'unknown', '', 1, null]) {
    const bad = structuredClone(score);
    bad.tracks[0].effects.cabinetId = invalid;
    assert.ok(validateProject(bad, extendedLibrary).some((issue) => issue.includes('cabinetId')));
  }
  const badInstrument = structuredClone(project);
  badInstrument.tracks[0].instrumentId = 'cab-test';
  assert.ok(validateProject(badInstrument, extendedLibrary).some((issue) => issue.includes('instrumentId')));
  const wrongArticulation = structuredClone(score);
  wrongArticulation.tracks[0].instrumentId = 'piano';
  assert.ok(validateProject(wrongArticulation, extendedLibrary).some((issue) => issue.includes('articulation')));
  for (const ampModel of ['none', undefined]) {
    const cabinetOnly = structuredClone(score);
    cabinetOnly.tracks[0].effects.ampModel = ampModel;
    assert.deepEqual(validateProject(cabinetOnly, extendedLibrary), [], 'cabinet does not require high-gain amp');
  }
});

test('track/note articulations, amp model and cabinet survive API save and restart', async (t) => {
  const f = await fixture(t, { manifest: extendedLibrary });
  const score = structuredClone(project);
  score.tracks[0].instrumentId = 'electric-guitar';
  score.tracks[0].articulation = 'palm-mute';
  score.tracks[0].notes[0].articulation = 'sustain';
  score.tracks[0].release = 0.02;
  score.tracks[0].effects = { enabled: true, drive: 0.6, tone: 0.4, mix: 0.8, output: 0.5, ampModel: 'high-gain', cabinetId: 'cab-test' };
  const saved = await f.request('/api/state', 'PUT', { baseRevision: 1, project: score });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.project.tracks[0], score.tracks[0]);
  await f.stop();
  await f.start();
  assert.deepEqual((await f.request('/api/state')).body.project.tracks[0], score.tracks[0]);
  const invalid = structuredClone(score);
  invalid.tracks[0].notes[0].articulation = 'undeclared';
  assert.equal((await f.request('/api/state', 'PUT', { baseRevision: 2, project: invalid })).status, 400);
  assert.equal((await f.request('/api/state')).body.revision, 2);
  score.tracks[0].effects.ampModel = 'none';
  const cabinetOnly = await f.request('/api/state', 'PUT', { baseRevision: 2, project: score });
  assert.equal(cabinetOnly.status, 200);
  assert.equal(cabinetOnly.body.project.tracks[0].effects.cabinetId, 'cab-test');
});

test('cabinet IR uses on-demand download while library sample selection metadata is retained', async (t) => {
  let downloads = 0;
  const f = await fixture(t, { manifest: extendedLibrary, downloader: async (sample, filename) => {
    downloads += 1;
    assert.equal(sample.downloadUrl, 'https://example.org/open-back.wav');
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, wave);
  } });
  const listing = (await f.request('/api/library')).body;
  assert.deepEqual(listing.find((item) => item.id === 'electric-guitar').samples, extendedLibrary[1].samples);
  assert.deepEqual(listing.find((item) => item.id === 'electric-guitar').articulations, extendedLibrary[1].articulations);
  assert.equal(listing.find((item) => item.id === 'cab-test').kind, 'cabinet');
  assert.equal(listing.find((item) => item.id === 'cab-test').installed, false);
  assert.equal(downloads, 0);
  const downloaded = await f.request('/api/instruments/cab-test/download', 'POST', {});
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.body.installed, true);
  assert.equal(downloads, 1);
  const audio = await fetch(`${f.base()}/samples/cab-test/open-back.wav`);
  assert.equal(audio.status, 200);
  assert.deepEqual(Buffer.from(await audio.arrayBuffer()), wave);
});

test('simultaneous writes from one revision cannot overwrite each other', async (t) => {
  const f = await fixture(t);
  const results = await Promise.all(['A', 'B'].map((title) => f.request('/api/state', 'PUT', { baseRevision: 1, project: { ...project, title } })));
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await f.request('/api/state')).body.revision, 2);
});

test('browser writes require same origin and a local Host', async (t) => {
  const f = await fixture(t);
  const body = { prompt: '写一段钢琴曲' };
  assert.equal((await f.request('/api/requests', 'POST', body, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.request('/api/requests', 'POST', body, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  const reboundStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(`${f.base()}/api/health`, { headers: { Host: 'evil.example' } }, (response) => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
    request.end();
  });
  assert.equal(reboundStatus, 403);
  assert.equal((await f.request('/api/requests', 'POST', body, { Origin: f.base() })).status, 201);
  const form = await fetch(`${f.base()}/api/requests`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
  assert.equal(form.status, 415);
});

test('production mode serves the built document and assets alongside API routes', async (t) => {
  const f = await fixture(t);
  await f.stop();
  await mkdir(path.join(f.root, 'dist/assets'), { recursive: true });
  await writeFile(path.join(f.root, 'dist/index.html'), '<!doctype html><title>Klein Studio fixture</title>');
  await writeFile(path.join(f.root, 'dist/assets/app.js'), 'export const ready = true;');
  const active = await f.start({ serveFrontend: true });
  assert.equal(active.server.address().address, '127.0.0.1');
  const page = await fetch(`${f.base()}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /Klein Studio fixture/);
  const asset = await fetch(`${f.base()}/assets/app.js`);
  assert.equal(asset.status, 200);
  assert.match(await asset.text(), /ready = true/);
  assert.equal((await f.request('/api/health')).body.ok, true);
});

test('user prompts and completion status are persistent and validated', async (t) => {
  const f = await fixture(t);
  assert.deepEqual((await f.request('/api/requests')).body, []);
  const created = await f.request('/api/requests', 'POST', { prompt: '  冷静的钢琴主题  ' });
  assert.equal(created.status, 201);
  assert.equal(created.body.prompt, '冷静的钢琴主题');
  assert.equal(created.body.status, 'pending');
  const complete = await f.request(`/api/requests/${created.body.id}`, 'PATCH', { status: 'done' });
  assert.equal(complete.body.status, 'done');
  assert.equal((await f.request('/api/requests', 'POST', { prompt: ' ' })).status, 400);
  assert.equal((await f.request(`/api/requests/${created.body.id}`, 'PATCH', { status: 'executing' })).status, 400);
  await f.stop();
  await f.start();
  assert.equal((await f.request('/api/requests')).body[0].status, 'done');
});

test('ensure downloads every resource a project uses, including its cabinet IR', async (t) => {
  const fetched = [];
  const f = await fixture(t, { manifest: extendedLibrary, downloader: async (sample, filename) => {
    fetched.push(sample.downloadUrl);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, wave);
  } });
  const song = { ...project, tracks: [{ ...project.tracks[0], instrumentId: 'piano', effects: { enabled: true, drive: 0.5, tone: 0.5, mix: 1, output: 0.5, cabinetId: 'cab-test' } }] };
  const result = await f.request('/api/instruments/ensure', 'POST', { project: song });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.instruments.map(item => [item.id, item.installed]).sort(), [['cab-test', true], ['piano', true]]);
  assert.deepEqual(fetched.sort(), ['https://example.org/open-back.wav', 'https://example.org/piano.wav']);
  assert.equal((await f.request('/api/instruments/ensure', 'POST', { ids: ['nope'] })).status, 404);
  assert.equal((await f.request('/api/instruments/ensure', 'POST', {})).status, 400);
});

test('with autoDownload the active project fetches its samples in the background', async (t) => {
  let done;
  const finished = new Promise((resolve) => { done = resolve; });
  const f = await fixture(t, { autoDownload: true, downloader: async (sample, filename) => {
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, wave);
    done();
  } });
  await finished;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal((await f.request('/api/library')).body[0].installed, true);
});

test('samples only download on request; concurrent requests are deduplicated and cached', async (t) => {
  let downloads = 0;
  const f = await fixture(t, { downloader: async (sample, filename) => {
    downloads += 1;
    assert.equal(sample.downloadUrl, library[0].samples[0].downloadUrl);
    await new Promise((resolve) => setTimeout(resolve, 40));
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, wave);
  } });
  assert.equal(downloads, 0);
  assert.equal((await f.request('/api/library')).body[0].installed, false);
  assert.equal((await f.request('/samples/piano/60.wav')).status, 404);
  assert.equal(downloads, 0);
  const results = await Promise.all([1, 2].map(() => f.request('/api/instruments/piano/download', 'POST', { downloadUrl: 'http://localhost/secrets' })));
  assert.ok(results.every((result) => result.status === 200 && result.body.installed));
  assert.equal(downloads, 1);
  assert.equal((await f.request('/api/library')).body[0].installed, true);
  await f.request('/api/instruments/piano/download', 'POST', {});
  assert.equal(downloads, 1);
  const audio = await fetch(`${f.base()}/samples/piano/60.wav`);
  assert.deepEqual(Buffer.from(await audio.arrayBuffer()), wave);
  assert.equal((await f.request('/api/instruments/unknown/download', 'POST', {})).status, 404);
});

test('sample paths cannot escape the cache', () => {
  for (const url of ['/samples/../project.json', '/samples/piano/../../secret.wav', '/samples/piano/%2e%2e.wav', '/samples/piano/C:\\secret.wav']) {
    assert.throws(() => samplePath('/cache', url));
  }
});

test('real downloader validates file length and SHA-256, writes atomically, and removes failed temp files', async (t) => {
  const f = await fixture(t);
  const filename = path.join(f.root, 'data/samples/piano/60.wav');
  const sample = { ...library[0].samples[0], sha256: createHash('sha256').update(wave).digest('hex') };
  const fetchImpl = async (_url, options) => {
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(wave, { status: 200, headers: { 'content-length': String(wave.length) } });
  };
  await downloadSample(sample, filename, { fetchImpl });
  assert.deepEqual(await readFile(filename), wave);
  await assert.rejects(downloadSample({ ...sample, sha256: 'bad' }, filename, { fetchImpl }), /SHA-256/);
  await assert.rejects(downloadSample(sample, filename, { fetchImpl, maxBytes: 5 }), /大小限制/);
  await assert.rejects(downloadSample({ ...sample, bytes: wave.length + 1 }, filename, { fetchImpl }), /大小校验失败/);
  assert.deepEqual(await readFile(filename), wave, 'a failed update must preserve an existing sample');
  assert.deepEqual(await readdir(path.dirname(filename)), ['60.wav']);
});

test('download failures do not leave a stuck in-flight entry and can be retried', async (t) => {
  let attempts = 0;
  const f = await fixture(t, { downloader: async (_sample, filename) => {
    attempts += 1;
    if (attempts === 1) throw new Error('fixture upstream unavailable');
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, wave);
  } });
  assert.equal((await f.request('/api/instruments/piano/download', 'POST', {})).status, 502);
  assert.equal((await f.request('/api/library')).body[0].installed, false);
  assert.equal((await f.request('/api/instruments/piano/download', 'POST', {})).status, 200);
  assert.equal(attempts, 2);
});

test("optional reverb send and humanize are validated within 0-1", async () => {
  const library = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../public/library.json", import.meta.url), "utf8"));
  const instrument = library.find(item => item.kind !== "cabinet");
  const score = { schemaVersion: 1, id: "space", title: "space", bpm: 120, key: "C", bars: 1, timeSignature: [4, 4], updatedAt: new Date().toISOString(),
    tracks: [{ id: "a", name: "a", instrumentId: instrument.id, color: "#002fa7", volume: .7, pan: 0, muted: false, solo: false, reverb: .3, humanize: .5, notes: [] }] };
  assert.deepEqual(validateProject(score, library), []);
  for (const [key, value] of [["reverb", -0.01], ["reverb", 1.01], ["reverb", "0.3"], ["humanize", NaN], ["humanize", 2]]) {
    const bad = structuredClone(score); bad.tracks[0][key] = value;
    assert.ok(validateProject(bad, library).some(issue => issue.includes(key)), key + "=" + value);
  }
});

test("NAM amp models are a separate resource kind and need an explicit model", () => {
  const library = [
    { id: "gtr", kind: "instrument", samples: [{ midi: 60, url: "/samples/gtr/a.wav" }] },
    { id: "amp", kind: "amp-model", samples: [{ midi: 60, url: "/samples/amp/model.nam" }] },
    { id: "cab", kind: "cabinet", samples: [{ midi: 60, url: "/samples/cab/ir.wav" }] },
  ];
  const effects = { enabled: true, drive: .5, tone: .5, mix: 1, output: .5, ampModel: "nam", namModelId: "amp", cabinetId: "cab" };
  const score = { schemaVersion: 1, id: "nam", title: "nam", bpm: 120, key: "E", bars: 1, timeSignature: [4, 4], updatedAt: new Date().toISOString(),
    tracks: [{ id: "a", name: "a", instrumentId: "gtr", color: "#002fa7", volume: .7, pan: 0, muted: false, solo: false, effects, notes: [] }] };
  assert.deepEqual(validateProject(score, library), []);
  const missing = structuredClone(score); delete missing.tracks[0].effects.namModelId;
  assert.ok(validateProject(missing, library).some(issue => issue.includes("namModelId")));
  const wrongKind = structuredClone(score); wrongKind.tracks[0].effects.namModelId = "cab";
  assert.ok(validateProject(wrongKind, library).some(issue => issue.includes("namModelId")));
  const asInstrument = structuredClone(score); asInstrument.tracks[0].instrumentId = "amp";
  assert.ok(validateProject(asInstrument, library).some(issue => issue.includes("instrumentId")));
  assert.ok(samplePath(path.join(os.tmpdir(), "s"), "/samples/amp/model.nam").endsWith("model.nam"));
});

test('song library mirrors the active project and supports open, rename, duplicate and recoverable delete', async (t) => {
  const f = await fixture(t);
  let songs = (await f.request('/api/songs')).body;
  assert.deepEqual(songs.map(song => [song.id, song.active]), [['test-song', true]]);
  // Saving the active project updates its library entry.
  const state = (await f.request('/api/state')).body;
  const renamed = { ...state.project, title: '改过的标题' };
  assert.equal((await f.request('/api/state', 'PUT', { baseRevision: state.revision, project: renamed })).status, 200);
  assert.equal((await f.request('/api/songs/test-song')).body.project.title, '改过的标题');
  // An agent stores another score without opening it; the active slot cannot be overwritten this way.
  const other = { ...project, id: 'other-song', title: '另一首' };
  assert.equal((await f.request('/api/songs/other-song', 'PUT', { project: other })).status, 200);
  assert.equal((await f.request('/api/songs/test-song', 'PUT', { project: renamed })).status, 409);
  assert.equal((await f.request('/api/songs/x', 'PUT', { project: other })).status, 400);
  // Opening switches the active project and bumps the revision; the previous song stays in the library.
  const opened = await f.request('/api/songs/other-song/open', 'POST', {});
  assert.equal(opened.status, 200);
  assert.equal(opened.body.project.id, 'other-song');
  assert.equal(opened.body.revision, state.revision + 2);
  songs = (await f.request('/api/songs')).body;
  assert.equal(songs.find(song => song.active).id, 'other-song');
  assert.equal(songs.length, 2);
  // Renaming the active song changes the live state too.
  const patch = await f.request('/api/songs/other-song', 'PATCH', { title: '新名字' });
  assert.equal(patch.body.state.project.title, '新名字');
  assert.equal((await f.request('/api/state')).body.project.title, '新名字');
  // Duplicate gets a fresh id; deleting the active song is refused; deleting another moves it to trash.
  const copy = await f.request('/api/songs/test-song/duplicate', 'POST', {});
  assert.equal(copy.status, 201);
  assert.match(copy.body.id, /^test-song-[0-9a-f]{6}$/);
  assert.equal((await f.request('/api/songs/other-song', 'DELETE', {})).status, 409);
  const removed = await f.request('/api/songs/test-song', 'DELETE', {});
  assert.equal(removed.status, 200);
  assert.match(removed.body.movedTo, /^songs\/\.trash\/test-song-/);
  assert.equal((await f.request('/api/songs/test-song')).status, 404);
  assert.equal((await f.request('/api/songs/bad%20id')).status, 400);
  const blank = await f.request('/api/songs', 'POST', { title: '空白' });
  assert.equal(blank.status, 201);
  assert.equal(blank.body.tracks, 0);
});
