import { mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { readJson, atomicJson } from './storage.mjs';

const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id);

/**
 * Song library: every score lives in data/songs/<project.id>.json as { createdAt, savedAt, project }.
 * The active project (data/project.json) is mirrored here on every save; deletes move to .trash.
 */
export function createSongStore(dataDir) {
  const dir = path.join(dataDir, 'songs');
  const trash = path.join(dir, '.trash');
  const file = (id) => {
    if (!validId(id)) throw Object.assign(new Error('歌曲 ID 无效'), { status: 400 });
    return path.join(dir, `${id}.json`);
  };
  const read = async (id) => readJson(file(id), null);
  async function write(project) {
    const now = new Date().toISOString();
    const old = await read(project.id);
    const song = { createdAt: old?.createdAt ?? now, savedAt: now, project };
    await atomicJson(file(project.id), song);
    return song;
  }
  function summary(song, activeId) {
    const { project } = song;
    return {
      id: project.id, title: project.title, key: project.key, bpm: project.bpm, bars: project.bars,
      seconds: Math.round(project.bars * 4 * 60 / project.bpm),
      tracks: project.tracks.length, notes: project.tracks.reduce((sum, track) => sum + track.notes.length, 0),
      instruments: [...new Set(project.tracks.map((track) => track.instrumentId))],
      createdAt: song.createdAt, updatedAt: song.savedAt, active: project.id === activeId,
    };
  }
  async function list(activeId) {
    await mkdir(dir, { recursive: true });
    const names = (await readdir(dir)).filter((name) => name.endsWith('.json'));
    const songs = await Promise.all(names.map((name) => readJson(path.join(dir, name), null).catch(() => null)));
    return songs.filter((song) => song?.project?.id).map((song) => summary(song, activeId))
      .sort((a, b) => Number(b.active) - Number(a.active) || b.updatedAt.localeCompare(a.updatedAt));
  }
  async function remove(id) {
    await mkdir(trash, { recursive: true });
    const target = path.join(trash, `${id}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await rename(file(id), target);
    return path.relative(dataDir, target).split(path.sep).join('/');
  }
  function newId(base) {
    return `${String(base || 'song').slice(0, 66)}-${randomBytes(3).toString('hex')}`;
  }
  return { read, write, summary, list, remove, newId, validId };
}
