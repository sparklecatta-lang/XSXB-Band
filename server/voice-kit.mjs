import express from 'express';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rename, stat, unlink, writeFile, copyFile } from 'node:fs/promises';
import { readJson } from './storage.mjs';

const MAX_TAKE_BYTES = 6 * 1024 * 1024;

/** Voice-kit recorder: serves voice-kit/ and stores one WAV per timeline item in voice-kit/recordings/items/. */
export function mountVoiceKit(app, root) {
  const kit = path.join(root, 'voice-kit');
  const items = path.join(kit, 'recordings', 'items');
  const known = async () => new Set(((await readJson(path.join(kit, 'timeline.json'), { sections: [] })).sections ?? [])
    .flatMap((section) => section.items.map((item) => item.id)));

  app.get('/api/voice-kit/takes', async (_req, res) => {
    const files = await readdir(items).catch(() => []);
    const takes = {};
    for (const file of files) {
      const match = /^(\d\d-[a-z0-9]+)\.wav$/.exec(file);
      if (!match) continue;
      const info = await stat(path.join(items, file));
      takes[match[1]] = { bytes: info.size, savedAt: info.mtime.toISOString() };
    }
    res.json(takes);
  });
  app.put('/api/voice-kit/takes/:item', async (req, res) => {
    const id = req.params.item;
    if (!/^\d\d-[a-z0-9]{1,20}$/.test(id) || !(await known()).has(id)) return res.status(404).json({ error: '录音条目不存在' });
    const audio = typeof req.body?.wav === 'string' ? Buffer.from(req.body.wav, 'base64') : null;
    if (!audio || audio.length < 44 || audio.length > MAX_TAKE_BYTES || audio.subarray(0, 4).toString() !== 'RIFF' || audio.subarray(8, 12).toString() !== 'WAVE') {
      return res.status(400).json({ error: '录音必须是 6 MB 以内的 WAV' });
    }
    await mkdir(items, { recursive: true });
    const target = path.join(items, `${id}.wav`);
    // The previous take is kept once, so an accidental re-record can be undone by hand.
    await copyFile(target, path.join(items, `${id}.prev.wav`)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, audio, { flag: 'wx' }); await rename(temporary, target); }
    finally { await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; }); }
    return res.json({ id, bytes: audio.length });
  });
  app.get(['/voice-kit', '/voice-kit/'], (_req, res) => res.sendFile(path.join(kit, 'index.html')));
  app.use('/voice-kit', express.static(kit, { dotfiles: 'deny', index: false }));
  // A mistyped or over-copied address (e.g. a trailing 。 from chat) lands on the recorder instead of a 404.
  app.use('/voice-kit', (req, res) => req.method === 'GET' ? res.redirect('/voice-kit/') : res.status(404).end());
}
