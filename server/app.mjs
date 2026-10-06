import express from 'express';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { validateProject } from './validation.mjs';
import { readJson, atomicJson, serialQueue } from './storage.mjs';
import { downloadSample, sampleInstalled, samplePath } from './download.mjs';
import { createSongStore } from './songs.mjs';

function localRequest(req, res, next) {
  const host = req.headers.host;
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(host)) {
    return res.status(403).json({ error: '只接受本机地址访问' });
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.headers.origin && req.headers.origin !== `http://${host}`) return res.status(403).json({ error: '拒绝跨来源写入' });
    if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: '拒绝跨站写入' });
    if (!req.is('application/json')) return res.status(415).json({ error: '写入请求必须使用 application/json' });
  }
  next();
}

export async function createApp({ root, dataDir = path.join(root, 'data'), downloader = downloadSample, serveFrontend = true, dev = false, devHmrServer, autoDownload = false } = {}) {
  const publicDir = path.join(root, 'public');
  const samplesRoot = path.join(dataDir, 'samples');
  const projectFile = path.join(dataDir, 'project.json');
  const requestFile = path.join(dataDir, 'requests.json');
  const library = await readJson(path.join(publicDir, 'library.json'));
  if (!Array.isArray(library) || new Set(library.map((item) => item.id)).size !== library.length) throw new Error('library.json 必须为 ID 不重复的数组');
  for (const item of library) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(item.id) || !Array.isArray(item.samples) || !item.samples.length) throw new Error('音色清单格式错误');
    for (const sample of item.samples) samplePath(samplesRoot, sample.url);
  }
  let state = await readJson(projectFile, null);
  if (!state) {
    state = { revision: 1, project: await readJson(path.join(publicDir, 'demo.json')) };
    const issues = validateProject(state.project, library);
    if (issues.length) throw new Error(`示范工程无效：${issues.join('；')}`);
    await atomicJson(projectFile, state);
  } else {
    const issues = validateProject(state.project, library);
    if (!Number.isSafeInteger(state.revision) || state.revision < 1 || issues.length) throw new Error(`已保存工程无法读取，请备份 data/project.json 后检查：${issues.join('；')}`);
  }
  // Song library: the active project is always mirrored, so nothing is lost when switching songs.
  const songs = createSongStore(dataDir);
  if (!await songs.read(state.project.id)) await songs.write(state.project);
  let requests = await readJson(requestFile, []);
  if (!Array.isArray(requests)) throw new Error('data/requests.json 格式错误');
  const queueState = serialQueue();
  const queueRequests = serialQueue();
  const downloads = new Map();
  const installed = async (instrument) => (await Promise.all(instrument.samples.map((sample) => sampleInstalled(samplePath(samplesRoot, sample.url), sample)))).every(Boolean);
  // One shared task per instrument: concurrent callers wait on the same download.
  const install = (instrument) => {
    if (!downloads.has(instrument.id)) {
      const task = (async () => {
        for (const sample of instrument.samples) {
          const filename = samplePath(samplesRoot, sample.url);
          if (!await sampleInstalled(filename, sample)) await downloader(sample, filename);
        }
      })();
      downloads.set(instrument.id, task);
      task.finally(() => { downloads.delete(instrument.id); }).catch(() => {});
    }
    return downloads.get(instrument.id);
  };
  // Every catalogue entry a project needs: track instruments plus cabinet IRs and NAM models.
  const resourcesOf = (project) => [...new Set((project?.tracks ?? []).flatMap((track) => [
    track.instrumentId,
    track.effects?.enabled !== false ? track.effects?.cabinetId : undefined,
    track.effects?.ampModel === 'nam' ? track.effects?.namModelId : undefined,
  ]).filter((id) => typeof id === 'string' && library.some((item) => item.id === id)))];
  const ensure = async (ids) => Promise.all(ids.map(async (id) => {
    const instrument = library.find((item) => item.id === id);
    try { await install(instrument); return { id, installed: await installed(instrument) }; }
    catch (error) { return { id, installed: false, error: error.message }; }
  }));
  // Background fetch for the active project so the editor and exports have their samples without a manual click.
  const prefetch = (project) => { if (autoDownload) ensure(resourcesOf(project)).catch(() => {}); };
  prefetch(state.project);
  const app = express();
  app.disable('x-powered-by');
  app.use(localRequest);
  app.use(express.json({ limit: '8mb' }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'XSXB-Band', version: '1.0.0' }));
  app.get('/api/license-doc', (_req, res) => {
    res.type('text/plain; charset=utf-8').sendFile(path.join(root, 'docs', 'SAMPLE-LICENSES.md'));
  });
  app.get('/api/state', (_req, res) => res.json(state));
  app.put('/api/state', async (req, res) => {
    if (!Number.isSafeInteger(req.body?.baseRevision) || req.body.baseRevision < 1) return res.status(400).json({ error: 'baseRevision 必须为从 GET /api/state 取得的版本号' });
    const issues = validateProject(req.body?.project, library);
    if (issues.length) return res.status(400).json({ error: '工程校验未通过', issues });
    return queueState(async () => {
      if (req.body.baseRevision !== state.revision) return res.status(409).json({ error: '工程已更新，请重新读取后合并修改', ...state });
      const next = { revision: state.revision + 1, project: { ...req.body.project, updatedAt: new Date().toISOString() } };
      await atomicJson(projectFile, next);
      state = next;
      await songs.write(state.project);
      prefetch(state.project);
      return res.json(state);
    });
  });
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  const activate = async (project) => {
    const next = { revision: state.revision + 1, project };
    await atomicJson(projectFile, next);
    state = next;
    await songs.write(state.project);
    prefetch(state.project);
    return state;
  };
  app.get('/api/songs', async (_req, res) => res.json(await songs.list(state.project.id)));
  app.get('/api/songs/:id', async (req, res) => {
    const song = await songs.read(req.params.id);
    return song ? res.json(song) : res.status(404).json({ error: '歌曲不存在' });
  });
  // Create a blank song (not opened). Agents use PUT /api/songs/:id to store a finished score.
  app.post('/api/songs', async (req, res) => queueState(async () => {
    const title = text(req.body?.title, 160) ? req.body.title.trim() : '未命名歌曲';
    const now = new Date().toISOString();
    const project = { schemaVersion: 1, id: songs.newId('song'), title, bpm: 100, key: 'C major', bars: 8, timeSignature: [4, 4], tracks: [], updatedAt: now };
    return res.status(201).json(songs.summary(await songs.write(project), state.project.id));
  }));
  app.put('/api/songs/:id', async (req, res) => {
    const project = req.body?.project;
    if (project?.id !== req.params.id) return res.status(400).json({ error: 'project.id 必须与地址中的歌曲 ID 一致' });
    const issues = validateProject(project, library);
    if (issues.length) return res.status(400).json({ error: '工程校验未通过', issues });
    return queueState(async () => {
      if (project.id === state.project.id) return res.status(409).json({ error: '这是当前打开的歌曲，请通过 PUT /api/state 按版本号保存' });
      const song = await songs.write({ ...project, updatedAt: new Date().toISOString() });
      return res.json(songs.summary(song, state.project.id));
    });
  });
  app.post('/api/songs/:id/open', async (req, res) => queueState(async () => {
    if (req.params.id === state.project.id) return res.json(state);
    const song = await songs.read(req.params.id);
    if (!song) return res.status(404).json({ error: '歌曲不存在' });
    const issues = validateProject(song.project, library);
    if (issues.length) return res.status(400).json({ error: '这首歌与当前音源目录不匹配，无法打开', issues });
    return res.json(await activate(song.project));
  }));
  app.post('/api/songs/:id/duplicate', async (req, res) => queueState(async () => {
    const song = await songs.read(req.params.id);
    if (!song) return res.status(404).json({ error: '歌曲不存在' });
    const title = text(req.body?.title, 160) ? req.body.title.trim() : `${song.project.title} · 副本`.slice(0, 160);
    const copy = await songs.write({ ...song.project, id: songs.newId(song.project.id.replace(/-[0-9a-f]{6}$/, '')), title, updatedAt: new Date().toISOString() });
    return res.status(201).json(songs.summary(copy, state.project.id));
  }));
  app.patch('/api/songs/:id', async (req, res) => {
    if (!text(req.body?.title, 160)) return res.status(400).json({ error: '歌曲名称必须为 1–160 字符' });
    return queueState(async () => {
      const title = req.body.title.trim();
      if (req.params.id === state.project.id) {
        const current = await activate({ ...state.project, title, updatedAt: new Date().toISOString() });
        return res.json({ ...songs.summary(await songs.read(current.project.id), current.project.id), state: current });
      }
      const song = await songs.read(req.params.id);
      if (!song) return res.status(404).json({ error: '歌曲不存在' });
      return res.json(songs.summary(await songs.write({ ...song.project, title }), state.project.id));
    });
  });
  app.delete('/api/songs/:id', async (req, res) => queueState(async () => {
    if (req.params.id === state.project.id) return res.status(409).json({ error: '不能删除正在打开的歌曲，请先打开其他歌曲' });
    if (!await songs.read(req.params.id)) return res.status(404).json({ error: '歌曲不存在' });
    return res.json({ id: req.params.id, movedTo: await songs.remove(req.params.id) });
  }));
  app.get('/api/library', async (_req, res) => res.json(await Promise.all(library.map(async (instrument) => ({ ...instrument, installed: await installed(instrument) })))));
  // Download everything a project (or an explicit id list) needs; waits until done. Used by render scripts.
  app.post('/api/instruments/ensure', async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : req.body?.project ? resourcesOf(req.body.project) : null;
    if (!ids || ids.length > library.length || !ids.every((id) => typeof id === 'string')) return res.status(400).json({ error: '请求需要 {project} 或 {ids:[音色 ID]}' });
    const unknown = ids.filter((id) => !library.some((item) => item.id === id));
    if (unknown.length) return res.status(404).json({ error: `音色不存在：${unknown.join('、')}` });
    const results = await ensure([...new Set(ids)]);
    const failed = results.filter((item) => !item.installed);
    return res.status(failed.length ? 502 : 200).json({ instruments: results, ...(failed.length ? { error: `部分音源下载失败：${failed.map((item) => item.id).join('、')}。请检查网络后重试，已完成的音源会保留。` } : {}) });
  });
  app.post('/api/instruments/:id/download', async (req, res) => {
    const instrument = library.find((item) => item.id === req.params.id);
    if (!instrument) return res.status(404).json({ error: '音色不存在' });
    try {
      await install(instrument);
      return res.json({ id: instrument.id, installed: await installed(instrument) });
    } catch (error) {
      return res.status(502).json({ error: `下载失败：${error.message}。请检查网络后重试，已完成的音源会保留。` });
    }
  });
  app.get('/api/requests', (_req, res) => res.json(requests));
  app.post('/api/requests', async (req, res) => {
    if (typeof req.body?.prompt !== 'string' || !req.body.prompt.trim() || req.body.prompt.length > 4000) return res.status(400).json({ error: '创作要求必须为 1–4000 字符' });
    return queueRequests(async () => {
      if (requests.length >= 500) return res.status(400).json({ error: '请求已达 500 条，请先整理 data/requests.json' });
      const now = new Date().toISOString();
      const request = { id: randomUUID(), prompt: req.body.prompt.trim(), status: 'pending', createdAt: now, updatedAt: now };
      const next = [...requests, request];
      await atomicJson(requestFile, next);
      requests = next;
      return res.status(201).json(request);
    });
  });
  app.patch('/api/requests/:id', async (req, res) => {
    if (!['pending', 'done'].includes(req.body?.status)) return res.status(400).json({ error: 'status 必须为 pending 或 done' });
    return queueRequests(async () => {
      const index = requests.findIndex((request) => request.id === req.params.id);
      if (index < 0) return res.status(404).json({ error: '请求不存在' });
      const request = { ...requests[index], status: req.body.status, updatedAt: new Date().toISOString() };
      const next = requests.map((item, i) => i === index ? request : item);
      await atomicJson(requestFile, next);
      requests = next;
      return res.json(request);
    });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }));
  app.use('/samples', express.static(samplesRoot, { dotfiles: 'deny', fallthrough: false, immutable: true, maxAge: '1y' }));
  let vite;
  if (serveFrontend) {
    if (dev) {
      const { createServer } = await import('vite');
      vite = await createServer({ root, server: { middlewareMode: true, allowedHosts: ['localhost', '127.0.0.1'], ...(devHmrServer ? { hmr: { server: devHmrServer } } : {}) }, appType: 'spa' });
      app.use(vite.middlewares);
    } else {
      const dist = path.join(root, 'dist');
      await access(path.join(dist, 'index.html')).catch(() => { throw new Error('前端尚未构建，请先运行 npm run build，或使用 npm run dev'); });
      app.use(express.static(dist));
      app.get('/', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    }
  }
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: '请求不是有效 JSON' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: '请求超过 8 MB 限制' });
    if (error.status === 404) return res.status(404).json({ error: '文件不存在，请先下载音色' });
    if (error.status === 400) return res.status(400).json({ error: error.message });
    console.error(error);
    return res.status(500).json({ error: '本地服务保存或读取失败，请查看服务终端' });
  });
  return { app, close: async () => { if (vite) await vite.close(); } };
}
