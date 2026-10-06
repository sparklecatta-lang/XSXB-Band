// Functional browser checks only: no screenshots, recordings, or visual acceptance.
// The live workspace data directory is never read or modified by this test server.
import { chromium, expect } from '@playwright/test';
import { createApp } from '../server/app.mjs';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'klein-ui-smoke-'));
// Attach Vite's HMR transport to this same ephemeral loopback server. A second
// development instance must never contend for Vite's default global HMR port.
const server = createServer();
const { app, close } = await createApp({ root, dataDir: path.join(temporary, 'data'), dev: true, devHmrServer: server });
server.on('request', app);
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1680, height: 1200 }, acceptDownloads: true });
await context.addInitScript(() => {
  window.__kleinAudioProbe = { decoded: 0, started: 0, errors: [] };
  const decode = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (...arguments_) {
    const result = decode.apply(this, arguments_);
    result.then(() => { window.__kleinAudioProbe.decoded += 1; }, (error) => { window.__kleinAudioProbe.errors.push(error.message); });
    return result;
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...arguments_) {
    start.apply(this, arguments_);
    window.__kleinAudioProbe.started += 1;
  };
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const runtimeErrors = [];
const results = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));
page.on('dialog', (dialog) => void dialog.accept());
const state = async () => {
  const response = await fetch(`${base}/api/state`);
  assert.equal(response.status, 200);
  return response.json();
};
const writeState = async (value, title) => {
  const response = await fetch(`${base}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseRevision: value.revision, project: { ...value.project, title } }) });
  assert.equal(response.status, 200);
  return response.json();
};
async function saved() {
  await expect(page.locator('.save-state')).toContainText('已保存到本机');
  return state();
}
async function step(name, work) {
  console.log(`RUN ${name}`);
  try { await work(); results.push({ name, ok: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, ok: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
const firstId = 'demo-note-1';
const noteElement = (id) => page.locator(`[data-note-id="${id}"]`);
let addedId;
let jsonDownload;
let midiDownload;

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await step('load default project and six tracks without runtime errors', async () => {
    await expect(page.locator('.track-card')).toHaveCount(6);
    await expect(page.getByLabel('工程名称')).toHaveValue('小行星漫游');
    assert.deepEqual(runtimeErrors, []);
    await expect(page.getByRole('alert')).toHaveCount(0);
    const library = await (await fetch(`${base}/api/library`)).json();
    assert.equal(library.length, 14);
    assert.ok(library.every((item) => !item.installed), 'isolated test must start without audio');
  });
  await step('select a note and edit pitch, duration and velocity', async () => {
    await noteElement(firstId).click();
    await expect(page.getByLabel('音符音高')).toHaveValue('48');
    await page.getByLabel('音符音高').selectOption('61');
    await page.getByLabel('音符时值').fill('1.25');
    await page.locator('#velocity').focus();
    await page.locator('#velocity').press('End');
    await page.locator('#velocity').press('ArrowLeft');
    const current = await saved();
    const note = current.project.tracks[0].notes.find((item) => item.id === firstId);
    assert.equal(note.midi, 61);
    assert.equal(note.duration, 1.25);
    assert.equal(note.velocity, 0.99);
  });
  await step('double-click a blank piano-roll cell to add a note', async () => {
    const count = await page.locator('.note-grid [data-note-id]').count();
    await page.locator('.piano-scroll').scrollIntoViewIfNeeded();
    await page.locator('.piano-scroll').evaluate((element) => { element.scrollTop = 200; element.scrollLeft = 0; });
    const grid = await page.getByTestId('note-grid').boundingBox();
    assert.ok(grid);
    // Coordinates are used solely to generate an input event at beat 7.25 / MIDI 66.
    await page.mouse.dblclick(grid.x + 7.25 * 36 + 4, grid.y + (84 - 66) * 18 + 9);
    await expect(page.locator('.note-grid [data-note-id]')).toHaveCount(count + 1);
    addedId = await page.locator('.note-grid .note.selected').getAttribute('data-note-id');
    assert.ok(addedId);
    const current = await saved();
    const note = current.project.tracks[0].notes.find((item) => item.id === addedId);
    assert.equal(note.midi, 66);
    assert.equal(note.start, 7.25);
  });
  await step('drag note pitch/time and resize its right edge', async () => {
    assert.ok(addedId, 'add-note prerequisite');
    const element = noteElement(addedId);
    await element.scrollIntoViewIfNeeded();
    let box = await element.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + 8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 8 + 36, box.y + box.height / 2 - 18, { steps: 8 });
    await page.mouse.up();
    let current = await saved();
    let note = current.project.tracks[0].notes.find((item) => item.id === addedId);
    assert.equal(note.start, 8.25);
    assert.equal(note.midi, 67);
    box = await element.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 3 + 18, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    current = await saved();
    note = current.project.tracks[0].notes.find((item) => item.id === addedId);
    assert.equal(note.duration, 1.5);
  });
  await step('delete, undo, and redo operate on note history', async () => {
    assert.ok(addedId, 'add-note prerequisite');
    await noteElement(addedId).click();
    await page.keyboard.press('Delete');
    await expect(noteElement(addedId)).toHaveCount(0);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(noteElement(addedId)).toHaveCount(1);
    await page.getByRole('button', { name: '重做', exact: true }).click();
    await expect(noteElement(addedId)).toHaveCount(0);
    await saved();
  });
  await step('effect switch and drive slider persist', async () => {
    await page.getByLabel('开关失真效果器').click();
    await page.getByLabel('效果器驱动').focus();
    await page.getByLabel('效果器驱动').press('End');
    await page.getByLabel('效果器驱动').press('ArrowLeft');
    const current = await saved();
    assert.equal(current.project.tracks[0].effects.enabled, true);
    assert.equal(current.project.tracks[0].effects.drive, 0.99);
  });
  await step('reload restores the saved project', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.track-card')).toHaveCount(6);
    await noteElement(firstId).click();
    await expect(page.getByLabel('音符音高')).toHaveValue('61');
    await expect(page.getByLabel('音符时值')).toHaveValue('1.25');
    await expect(page.getByLabel('开关失真效果器')).toHaveAttribute('aria-pressed', 'true');
  });
  await step('external AI changes appear through polling', async () => {
    await writeState(await state(), '外部编曲更新');
    await expect(page.getByLabel('工程名称')).toHaveValue('外部编曲更新', { timeout: 8000 });
  });
  await step('concurrent edit conflicts preserve the server version', async () => {
    let intercepted;
    let release;
    const arrived = new Promise((resolve) => { intercepted = resolve; });
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route('**/api/state', async (route) => {
      if (route.request().method() === 'PUT') { intercepted(); await gate; }
      await route.continue();
    });
    await page.getByLabel('工程名称').fill('窗口内尚未提交的编辑');
    try {
      await Promise.race([arrived, new Promise((_resolve, reject) => setTimeout(() => reject(Error('browser save did not start')), 10000))]);
      await writeState(await state(), 'AI 并发版本');
      release();
      await expect(page.locator('.conflict-banner')).toHaveCount(1);
      assert.equal((await state()).project.title, 'AI 并发版本');
      await expect(page.getByLabel('工程名称')).toHaveValue('窗口内尚未提交的编辑');
      await page.getByRole('button', { name: '载入新版本', exact: true }).click();
      await expect(page.getByLabel('工程名称')).toHaveValue('AI 并发版本');
    } finally { release(); await page.unroute('**/api/state'); }
  });
  await step('instrument library exposes all 14 CC0 source/download links', async () => {
    await page.getByRole('button', { name: '添加音轨', exact: true }).click();
    await expect(page.locator('.instrument-card')).toHaveCount(14);
    const sourceLinks = await page.locator('.source-links a').evaluateAll((elements) => elements.map((element) => element.href));
    const library = await (await fetch(`${base}/api/library`)).json();
    for (const instrument of library) {
      assert.ok(sourceLinks.includes(instrument.sourceUrl));
      assert.ok(sourceLinks.includes(instrument.licenseUrl));
      for (const sample of instrument.samples) assert.ok(sourceLinks.includes(sample.downloadUrl));
    }
  });
  await step('download one clap sample on demand and preview decoded audio', async () => {
    const card = page.locator('.instrument-card').filter({ has: page.getByRole('heading', { name: '拍手', exact: true }) });
    const downloaded = page.waitForResponse((response) => response.url().endsWith('/api/instruments/clap/download') && response.request().method() === 'POST', { timeout: 100000 });
    await card.getByRole('button', { name: '下载音源', exact: true }).click();
    const response = await downloaded;
    assert.equal(response.status(), 200, await response.text());
    await expect(card.getByRole('button', { name: '试听', exact: true })).toBeEnabled();
    const sampleResponse = page.waitForResponse((result) => result.url().endsWith('/samples/clap/60.wav'));
    await card.getByRole('button', { name: '试听', exact: true }).click();
    assert.equal((await sampleResponse).status(), 200);
    await page.waitForFunction(() => window.__kleinAudioProbe.decoded > 0 && window.__kleinAudioProbe.started > 0);
    assert.deepEqual(await page.evaluate(() => window.__kleinAudioProbe.errors), []);
    const library = await (await fetch(`${base}/api/library`)).json();
    assert.equal(library.filter((item) => item.installed).length, 1);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  });
  await step('JSON and MIDI export produce valid files', async () => {
    if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '导出作品', exact: true }).click();
    let downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: /保存工程文件/ }).click();
    jsonDownload = await downloadEvent;
    const project = JSON.parse(await readFile(await jsonDownload.path(), 'utf8'));
    assert.equal(project.schemaVersion, 1);
    assert.equal(project.tracks.length, 6);
    downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: /导出 MIDI 乐谱/ }).click();
    midiDownload = await downloadEvent;
    const midi = await readFile(await midiDownload.path());
    assert.equal(midi.subarray(0, 4).toString(), 'MThd');
    assert.ok(midi.byteLength > 50);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  });
  await step('16-step drum machine creates, selects and removes notes across bars', async () => {
    await page.getByLabel('打开鼓机', { exact: true }).click();
    await expect(page.getByLabel('16 步鼓机', { exact: true })).toHaveCount(1);
    await expect(page.locator('[data-drum-row][data-drum-step]')).toHaveCount(112);
    const clapPad = page.locator('[data-drum-row="5"][data-drum-step="0"]');
    await clapPad.click();
    await expect(clapPad).toHaveAttribute('aria-pressed', 'true');
    let current = await saved();
    let clap = current.project.tracks.find((track) => track.instrumentId === 'clap');
    assert.ok(clap);
    assert.equal(current.project.tracks.length, 7);
    assert.equal(clap.notes[0].start, 0);
    await clapPad.click({ modifiers: ['Shift'] });
    await expect(page.getByLabel('音符音高')).toHaveValue('60');
    await expect(clapPad).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('鼓机小节', { exact: true }).selectOption('1');
    await clapPad.click();
    current = await saved();
    clap = current.project.tracks.find((track) => track.instrumentId === 'clap');
    assert.deepEqual(clap.notes.map((note) => note.start), [0, 4]);
    await clapPad.click();
    await expect(clapPad).toHaveAttribute('aria-pressed', 'false');
    current = await saved();
    clap = current.project.tracks.find((track) => track.instrumentId === 'clap');
    assert.deepEqual(clap.notes.map((note) => note.start), [0]);
    await clapPad.focus();
    await clapPad.press('ArrowRight');
    await expect(page.locator('[data-drum-row="5"][data-drum-step="1"]')).toBeFocused();
    await page.getByLabel('打开钢琴卷帘', { exact: true }).click();
    await expect(page.getByTestId('note-grid')).toHaveCount(1);
  });
  await step('runtime and network-visible application errors remain absent', async () => {
    assert.deepEqual(runtimeErrors, []);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
  const report = { ok: results.every((item) => item.ok), checkedAt: new Date().toISOString(), results, runtimeErrors, screenshots: 0, isolatedData: true };
  const reportPath = path.resolve(process.env.UI_SMOKE_REPORT || path.join(root, 'reports', 'ui-smoke.json'));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log(`REPORT ${reportPath}`);
  if (results.some((item) => !item.ok)) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  await close();
  const relative = path.relative(os.tmpdir(), temporary);
  assert.match(relative, /^klein-ui-smoke-[A-Za-z0-9]+$/);
  await rm(temporary, { recursive: true, force: true });
}
