import { useCallback, useEffect, useRef, useState } from 'react';
import type { Instrument, Project, ServerState } from './types';

export function useStudio() {
  const [project, setProject] = useState<Project | null>(null);
  const [library, setLibrary] = useState<Instrument[]>([]);
  const [status, setStatus] = useState('连接工作室…');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<ServerState | null>(null);
  const [historyCount, setHistoryCount] = useState([0, 0]);
  const projectRef = useRef<Project | null>(null);
  const revision = useRef(0), dirty = useRef(false), saving = useRef(false), blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const history = useRef<Project[]>([]), future = useRef<Project[]>([]);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const applyRemote = useCallback((state: ServerState) => {
    revision.current = state.revision; projectRef.current = state.project; setProject(state.project);
    history.current = []; future.current = []; setHistoryCount([0, 0]);
    dirty.current = false; blocked.current = false; setConflict(null); setStatus('已保存到本机');
  }, []);
  const refreshLibrary = useCallback(async () => {
    const response = await fetch('/api/library');
    if (!response.ok) throw Error('无法读取音源目录');
    const data = await response.json() as Instrument[]; setLibrary(data); return data;
  }, []);
  saveRef.current = async () => {
    if (saving.current || !dirty.current || blocked.current || !projectRef.current) return;
    saving.current = true; setStatus('保存中…'); const snapshot = projectRef.current;
    try {
      const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseRevision: revision.current, project: snapshot }) });
      const data = await response.json();
      if (response.status === 409) { blocked.current = true; setConflict(data.state || data.current || data); setStatus('有新版本，请处理冲突'); return; }
      if (!response.ok) throw Error(data.error || '保存失败');
      revision.current = data.revision;
      if (projectRef.current === snapshot) { dirty.current = false; setStatus('已保存到本机'); if (localStorage.getItem('klein-recovery') === JSON.stringify(snapshot)) localStorage.removeItem('klein-recovery'); }
    } catch (err) { setStatus('保存失败 · 已留本地备份'); setError(String((err as Error).message)); }
    finally { saving.current = false; if (dirty.current && !blocked.current) timer.current = setTimeout(() => void saveRef.current(), 2500); }
  };
  useEffect(() => {
    let alive = true;
    Promise.all([fetch('/api/state').then(async r => { if (!r.ok) throw Error('工作室服务没有响应'); return r.json(); }), refreshLibrary()])
      .then(([state]) => { if (alive) applyRemote(state); }).catch(e => { if (alive) setError(e.message); });
    const polling = setInterval(async () => {
      if (dirty.current || saving.current || blocked.current || !projectRef.current) return;
      try { const r = await fetch('/api/state'); if (!r.ok) return; const s = await r.json(); if (alive && !dirty.current && !saving.current && !blocked.current && s.revision > revision.current) applyRemote(s); } catch { /* save status reports actionable errors */ }
    }, 2000);
    const onClose = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onClose);
    return () => { alive = false; clearInterval(polling); clearTimeout(timer.current); window.removeEventListener('beforeunload', onClose); };
  }, [applyRemote, refreshLibrary]);
  const change = useCallback((next: Project | ((p: Project) => Project), record = true) => {
    if (!projectRef.current) return;
    const old = projectRef.current;
    const value = typeof next === 'function' ? next(old) : next;
    if (value === old) return;
    const updated = { ...value, updatedAt: new Date().toISOString() };
    if (record) { history.current = [...history.current.slice(-79), old]; future.current = []; }
    setHistoryCount([history.current.length, future.current.length]);
    projectRef.current = updated; setProject(updated); dirty.current = true;
    setStatus(blocked.current ? '有新版本，请处理冲突' : '等待保存…');
    try { localStorage.setItem('klein-recovery', JSON.stringify(updated)); } catch { /* server is primary storage */ }
    clearTimeout(timer.current); timer.current = setTimeout(() => void saveRef.current(), 550);
  }, []);
  const undo = useCallback(() => { const p = history.current.pop(); if (p && projectRef.current) { future.current.push(projectRef.current); change(p, false); } }, [change]);
  const redo = useCallback(() => { const p = future.current.pop(); if (p && projectRef.current) { history.current.push(projectRef.current); change(p, false); } }, [change]);
  /** Saves pending edits; resolves false if they could not be stored (conflict, error or timeout). */
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    for (let attempt = 0; attempt < 40; attempt++) {
      if (blocked.current) return false;
      if (!dirty.current && !saving.current) return true;
      if (!saving.current) await saveRef.current();
      else await new Promise(resolve => setTimeout(resolve, 150));
    }
    return !dirty.current && !saving.current;
  }, []);
  return { project, library, status, error, setError, change, undo, redo, historyCount, conflict, applyRemote, refreshLibrary, save: () => saveRef.current(), flush };
}
