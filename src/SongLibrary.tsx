import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, FolderOpen, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { ServerState } from './types';

export interface SongSummary {
  id: string; title: string; key: string; bpm: number; bars: number; seconds: number;
  tracks: number; notes: number; instruments: string[]; createdAt: string; updatedAt: string; active: boolean;
}

async function call<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw Error([data.error, ...(data.issues || []).slice(0, 3)].filter(Boolean).join('：'));
  return data as T;
}
const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const when = (iso: string) => new Date(iso).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Every score in data/songs: open one into the editor, rename, duplicate, create or delete (to trash). */
export function SongLibrary({ onOpen, onActiveRenamed, notify }: {
  onOpen: (id: string) => Promise<void>;
  onActiveRenamed: (state: ServerState) => void;
  notify: (text: string) => void;
}) {
  const [songs, setSongs] = useState<SongSummary[] | null>(null);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => { setSongs(await call<SongSummary[]>('/api/songs')); }, []);
  useEffect(() => { load().catch(e => setError(e.message)); }, [load]);
  const run = async (id: string, work: () => Promise<void>) => {
    setBusy(id); setError('');
    try { await work(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  const rename = (song: SongSummary) => run(song.id, async () => {
    const result = await call<SongSummary & { state?: ServerState }>(`/api/songs/${song.id}`, 'PATCH', { title: name });
    if (result.state) onActiveRenamed(result.state);
    setEditing(null); notify(`已改名为《${result.title}》`);
  });
  const remove = (song: SongSummary) => {
    if (!window.confirm(`删除《${song.title}》？\n文件会移到 data/songs/.trash，可以手动找回。`)) return;
    void run(song.id, async () => { await call(`/api/songs/${song.id}`, 'DELETE', {}); notify(`《${song.title}》已移到回收站`); });
  };
  const shown = (songs || []).filter(song => `${song.title} ${song.id}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="song-library">
    <div className="song-toolbar">
      <input aria-label="搜索歌曲" placeholder="找一首歌…" value={search} onChange={e => setSearch(e.target.value)}/>
      <button className="primary" disabled={!!busy} onClick={() => void run('new', async () => { const song = await call<SongSummary>('/api/songs', 'POST', { title: '未命名歌曲' }); await onOpen(song.id); })}><Plus size={15}/>新建空白歌曲</button>
    </div>
    {error && <p className="song-error" role="alert">{error}</p>}
    {!songs ? <p className="song-empty"><LoaderCircle className="spin" size={16}/> 读取歌曲库…</p> : !shown.length ? <p className="song-empty">没有找到歌曲</p> :
      <ul className="song-list">{shown.map(song => <li key={song.id} className={`song-row ${song.active ? 'active' : ''}`}>
        <div className="song-main">
          {editing === song.id
            ? <form className="song-rename" onSubmit={e => { e.preventDefault(); if (name.trim()) void rename(song); }}>
                <input aria-label="新的歌曲名称" autoFocus value={name} maxLength={160} onChange={e => setName(e.target.value)}/>
                <button className="icon-button" aria-label="确认改名" type="submit" disabled={!name.trim() || busy === song.id}><Check size={15}/></button>
                <button className="icon-button" aria-label="取消改名" type="button" onClick={() => setEditing(null)}><X size={15}/></button>
              </form>
            : <h3>{song.title}{song.active && <span className="song-badge">正在编辑</span>}</h3>}
          <p className="song-meta">{song.bpm} BPM · {song.bars} 小节 · {duration(song.seconds)} · {song.tracks} 轨 · {song.notes} 音符 · {song.key}</p>
          <p className="song-meta subtle">更新于 {when(song.updatedAt)} · {song.id}</p>
        </div>
        <div className="song-actions">
          {busy === song.id && <LoaderCircle className="spin" size={15}/>}
          <button className="text-button" disabled={song.active || !!busy} onClick={() => void run(song.id, () => onOpen(song.id))}><FolderOpen size={14}/>打开</button>
          <button className="icon-button" aria-label={`重命名 ${song.title}`} title="重命名" disabled={!!busy} onClick={() => { setEditing(song.id); setName(song.title); }}><Pencil size={14}/></button>
          <button className="icon-button" aria-label={`复制 ${song.title}`} title="复制一份" disabled={!!busy} onClick={() => void run(song.id, async () => { const copy = await call<SongSummary>(`/api/songs/${song.id}/duplicate`, 'POST', {}); notify(`已复制为《${copy.title}》`); })}><Copy size={14}/></button>
          <button className="icon-button danger" aria-label={`删除 ${song.title}`} title={song.active ? '正在编辑的歌曲不能删除' : '删除（移到回收站）'} disabled={song.active || !!busy} onClick={() => remove(song)}><Trash2 size={14}/></button>
        </div>
      </li>)}</ul>}
    <p className="modal-footnote">当前编辑的歌曲会自动保存在这里。打开另一首前会先保存当前修改；删除的歌曲移到 data/songs/.trash。</p>
  </div>;
}
