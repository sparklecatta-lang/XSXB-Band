import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, AudioLines, Check, ChevronDown, Copy, Disc3, Download, ExternalLink, FolderOpen, Guitar, Headphones, HelpCircle, Library, LoaderCircle, Maximize2, Minus, Music2, Pause, Piano, Play, Plus, Redo2, Repeat2, Save, Scissors, SlidersHorizontal, Sparkles, Square, Trash2, Undo2, Volume2, Wind, X } from 'lucide-react';
import { AudioEngine } from './audio';
import { DEFAULT_EFFECTS } from './effects';
import { exportMidi } from './midi';
import PianoRoll from './PianoRoll';
import DrumMachine from './DrumMachine';
import { useStudio } from './useStudio';
import { SongLibrary } from './SongLibrary';
import type { Instrument, Note, Project, ServerState, Track } from './types';
import { clamp, COLORS, download, noteName, uid, validateImport } from './utils';

function InstrumentIcon({ id, size = 19 }: { id: string; size?: number }) {
  const Icon = id === 'piano' || id === 'fm-piano' ? Piano : ['guitar', 'electric-guitar', 'metal-guitar', 'emily-guitar', 'electric-bass', 'bass', 'tr808-bass'].includes(id) ? Guitar : ['flute', 'dizi', 'french-horn', 'trumpet', 'trombone', 'tenor-sax'].includes(id) ? Wind : ['kick', 'snare', 'hihat', 'tom', 'crash', 'clap', 'shaker', 'perc', 'timpani', 'gong'].includes(id.replace(/^(rock|tr808)-/, '')) ? Disc3 : ['strings', 'cello-section', 'erhu'].includes(id) ? AudioLines : Music2;
  return <Icon size={size} strokeWidth={1.7} />;
}
function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide ? 'wide' : ''}`}><header><div><span className="eyebrow">KLEIN STUDIO</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={21} /></button></header>{children}</section></div>;
}
export default function App() {
  const studio = useStudio();
  const { project, library, change, error, setError } = studio;
  const engine = useMemo(() => new AudioEngine(), []);
  const [trackId, setTrackId] = useState('keys'), [selected, setSelected] = useState<string | null>(null);
  const [beat, setBeat] = useState(0), [playing, setPlaying] = useState(false), [loadingAudio, setLoadingAudio] = useState(false), [loop, setLoop] = useState(true);
  const [snap, setSnap] = useState(.25), [zoom, setZoom] = useState(36), [master, setMaster] = useState(.8);
  const [modal, setModal] = useState<'library' | 'export' | 'help' | 'songs' | null>(null);
  const [family, setFamily] = useState('全部'), [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(''), [exporting, setExporting] = useState(false), [prompt, setPrompt] = useState(''), [briefBusy, setBriefBusy] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [editorMode, setEditorMode] = useState<'piano' | 'drums'>('piano');
  const fileInput = useRef<HTMLInputElement>(null), toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const transportGeneration = useRef(0), lastProject = useRef<Project | null>(null);
  const activeTrack = project?.tracks.find(t => t.id === trackId) || project?.tracks[0];
  const note = activeTrack?.notes.find(n => n.id === selected);
  const instruments = library.filter(i => !i.kind || i.kind === 'instrument');
  const cabinets = library.filter(i => i.kind === 'cabinet');
  const ampModels = library.filter(i => i.kind === 'amp-model');
  const instrument = instruments.find(i => i.id === activeTrack?.instrumentId);
  const used = library.filter(i => project?.tracks.some(t => (t.instrumentId === i.id || t.effects?.enabled && (t.effects.cabinetId === i.id || t.effects.ampModel === 'nam' && t.effects.namModelId === i.id)) && !t.muted && t.notes.some(n => n.velocity > 0) && (!project.tracks.some(a => a.solo) || t.solo)));
  const missing = used.filter(i => !i.installed);
  const notify = useCallback((text: string) => { setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4200); }, []);
  useEffect(() => { engine.setLibrary(library); }, [engine, library]);
  useEffect(() => { engine.setMasterVolume(master); }, [engine, master]);
  const stop = useCallback((reset = false) => { ++transportGeneration.current; engine.stop(); setPlaying(false); setLoadingAudio(false); if (reset) setBeat(0); }, [engine]);
  useEffect(() => {
    const timing = (p: Project) => JSON.stringify({ bpm: p.bpm, bars: p.bars, tracks: p.tracks.map(t => ({ id: t.id, instrumentId: t.instrumentId, muted: t.muted, solo: t.solo, release: t.release, articulation: t.articulation, notes: t.notes })) });
    const routing = (p: Project) => JSON.stringify(p.tracks.map(t => [t.id,t.instrumentId,t.effects?.enabled,t.effects?.cabinetId,t.effects?.ampModel]));
    if (lastProject.current && project && routing(project) !== routing(lastProject.current)) stop();
    else if (lastProject.current && project && timing(project) !== timing(lastProject.current) && (playing || loadingAudio)) stop();
    else project?.tracks.forEach(t => engine.updateTrack(t));
    lastProject.current = project;
  }, [project, stop, engine, playing, loadingAudio]);
  useEffect(() => () => { engine.stop(); clearTimeout(toastTimer.current); }, [engine]);
  const preview = useCallback((midi: number, instrumentId = activeTrack?.instrumentId) => { if (!instrumentId) return; void engine.preview(instrumentId, midi, .7, .6, activeTrack?.instrumentId === instrumentId ? { ...activeTrack, articulation: note?.articulation ?? activeTrack.articulation } : undefined).catch(e => notify(e.message)); }, [activeTrack, note?.articulation, engine, notify]);
  const updateTrack = useCallback((patch: Partial<Track>) => { if (!activeTrack) return; change(p => ({ ...p, tracks: p.tracks.map(t => t.id === activeTrack.id ? { ...t, ...patch } : t) })); }, [activeTrack, change]);
  const updateNote = useCallback((patch: Partial<Note>) => { if (note && activeTrack) updateTrack({ notes: activeTrack.notes.map(n => n.id === note.id ? { ...n, ...patch } : n) }); }, [note, activeTrack, updateTrack]);
  const deleteNote = useCallback(() => { if (selected && activeTrack) { updateTrack({ notes: activeTrack.notes.filter(n => n.id !== selected) }); setSelected(null); } }, [selected, activeTrack, updateTrack]);
  const duplicateNote = useCallback(() => {
    if (!note || !activeTrack || !project) return;
    const start = note.start + note.duration;
    if (start + note.duration > project.bars * 4) { notify('后面没有足够空间，可以先增加小节'); return; }
    const next = { ...note, id: uid(), start }; updateTrack({ notes: [...activeTrack.notes, next] }); setSelected(next.id);
  }, [note, activeTrack, project, updateTrack, notify]);
  async function togglePlay() {
    if (!project) return;
    if (playing || loadingAudio) { stop(); return; }
    if (missing.length) { setModal('library'); notify('先下载当前乐队所需的音源，就可以播放了'); return; }
    const generation = ++transportGeneration.current;
    setLoadingAudio(true);
    try { await engine.play(project, { fromBeat: beat >= project.bars * 4 ? 0 : beat, loop, onBeat: setBeat, onEnd: () => { setPlaying(false); setBeat(0); }, onError: e => setError(e.message) }); if (generation === transportGeneration.current) setPlaying(true); }
    catch (e) { setError((e as Error).message); }
    finally { if (generation === transportGeneration.current) setLoadingAudio(false); }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) return;
      if (e.key === 'Escape') { setModal(null); setSelected(null); return; }
      if (modal) return;
      if (e.code === 'Space') { e.preventDefault(); void togglePlay(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? studio.redo() : studio.undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void studio.save(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && note) { e.preventDefault(); duplicateNote(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && note) { e.preventDefault(); deleteNote(); }
      if (note && project && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const midi = clamp(note.midi + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1), 0, 127); updateNote({ midi }); preview(midi); }
        else updateNote({ start: clamp(note.start + (e.key === 'ArrowRight' ? snap : -snap), 0, project.bars * 4 - note.duration) });
      }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  });
  function selectTrack(id: string) { setTrackId(id); setSelected(null); const track = project?.tracks.find(t => t.id === id); if (track) setEditorMode(library.find(i => i.id === track.instrumentId)?.percussive ? 'drums' : 'piano'); }
  /** Saves pending edits, then switches the editor to another song from the library. */
  async function openSong(id: string) {
    stop(true);
    if (!await studio.flush()) throw Error('当前修改还没有保存成功，请先处理保存问题再切换歌曲');
    const response = await fetch(`/api/songs/${id}/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await response.json();
    if (!response.ok) throw Error([data.error, ...(data.issues || []).slice(0, 3)].filter(Boolean).join('：'));
    studio.applyRemote(data as ServerState);
    setSelected(null); setTrackId(data.project.tracks[0]?.id ?? ''); setModal(null);
    notify(`已打开《${data.project.title}》`);
  }
  function addTrack(i: Instrument) {
    if (i.kind === 'amp-model') { if (activeTrack) { updateTrack({ effects: { ...(activeTrack.effects || DEFAULT_EFFECTS), enabled: true, ampModel: 'nam', namModelId: i.id } }); setModal(null); notify('NAM 箱头已接入，未下载时请先下载'); } return; }
    if (i.kind === 'cabinet') { if (activeTrack) { updateTrack({ effects: { ...(activeTrack.effects || DEFAULT_EFFECTS), enabled: true, ampModel: 'high-gain', cabinetId: i.id } }); setModal(null); notify('箱体已接入，音源未下载时请先下载'); } return; }
    if (!project || project.tracks.length >= 32) { notify('一个工程最多支持 32 条音轨'); return; }
    const id = uid(); change({ ...project, tracks: [...project.tracks, { id, name: i.name, instrumentId: i.id, color: COLORS[project.tracks.length % COLORS.length], volume: .7, pan: 0, muted: false, solo: false, notes: [] }] });
    selectTrack(id); setModal(null); notify(`已添加 ${i.name}，双击卷帘空白处写入音符`);
  }
  async function install(i: Instrument) {
    if (downloading.has(i.id)) return;
    setDownloading(old => new Set(old).add(i.id));
    try { const r = await fetch(`/api/instruments/${i.id}/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const result = await r.json(); if (!r.ok) throw Error(result.error || '下载失败'); await studio.refreshLibrary(); notify(`${i.name} 已准备好`); }
    catch (e) { setError((e as Error).message); }
    finally { setDownloading(old => { const n = new Set(old); n.delete(i.id); return n; }); }
  }
  async function importProject(file: File) {
    try { const p: unknown = JSON.parse(await file.text()); validateImport(p); for (const t of p.tracks) { const i = instruments.find(i => i.id === t.instrumentId); if (!i) throw Error('工程使用了目录里没有的乐器'); const articulations = new Set(i.articulations?.map(a => a.id)); if ([t.articulation,...t.notes.map(n => n.articulation)].some(a => a !== undefined && !articulations.has(a))) throw Error('工程的演奏法与音源不匹配'); if (t.effects?.cabinetId && !cabinets.some(c => c.id === t.effects?.cabinetId)) throw Error('工程使用了目录里没有的箱体'); } change(p); setSelected(null); setBeat(0); notify('工程已导入，可以用撤销返回'); }
    catch (e) { setError((e as Error).message); }
  }
  async function exportFile(kind: 'wav' | 'midi' | 'json') {
    if (!project) return; setExporting(true);
    try {
      const blob = kind === 'wav' ? await engine.renderWav(project) : kind === 'midi' ? exportMidi(project, library) : new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      download(blob, `${project.title.replace(/[<>:"/\\|?*]/g, '_')}.${kind === 'midi' ? 'mid' : kind}`); notify(`${kind.toUpperCase()} 已导出`);
    } catch (e) { setError((e as Error).message); }
    finally { setExporting(false); }
  }
  async function saveBrief() {
    if (!prompt.trim() || briefBusy) return; setBriefBusy(true);
    try { const r = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt.trim() }) }); const data = await r.json(); if (!r.ok) throw Error(data.error || '保存失败'); notify('需求已保存。回到你的 Agent，告诉它“读取 XSXB-Band 的编曲需求”即可。'); }
    catch (e) { setError((e as Error).message); } finally { setBriefBusy(false); }
  }
  if (!project) return <div className="loading-screen"><div className="brand-mark"><i/><i/><i/></div><h1>XSXB-Band · 小宝乐队</h1><p>{error || '正在打开你的音乐工作台…'}</p>{error && <button className="primary" onClick={() => location.reload()}>重新连接</button>}</div>;
  const totalNotes = project.tracks.reduce((s, t) => s + t.notes.length, 0), duration = project.bars * 4 * 60 / project.bpm;
  return <div className="app-shell">
    <header className="app-header">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setModal('help'); }} aria-label="XSXB-Band 使用帮助"><div className="brand-mark"><i/><i/><i/></div><div><strong>小宝乐队</strong><small>XSXB-BAND</small></div></a>
      <div className="project-heading"><span className="eyebrow">我的工作室 <span>/</span></span><input aria-label="工程名称" maxLength={100} value={project.title} onChange={e => change({ ...project, title: e.target.value })}/><span className="save-state"><i className={studio.status.includes('失败') || studio.conflict ? 'warning' : ''}/>{studio.status}</span></div>
      <div className="header-actions"><button className="text-button" onClick={() => setModal('songs')}><Library size={17}/><span>我的歌曲</span></button><button className="text-button" onClick={() => fileInput.current?.click()}><FolderOpen size={17}/><span>打开工程</span></button><button className="icon-button" aria-label="使用帮助" onClick={() => setModal('help')}><HelpCircle size={19}/></button><button className="primary" onClick={() => setModal('export')}><ArrowDownToLine size={17}/>导出作品</button></div>
      <input hidden ref={fileInput} type="file" accept=".json,application/json" onChange={e => { const file = e.target.files?.[0]; if (file) void importProject(file); e.target.value = ''; }}/>
    </header>
    <section className="transport" aria-label="播放控制">
      <div className="transport-caption"><span className="eyebrow">LET’S MAKE SOME MUSIC</span><span>今天的灵感，有了形状。</span></div>
      <div className="transport-buttons"><button className={`play-button ${playing ? 'playing' : ''}`} aria-label={playing || loadingAudio ? '暂停' : '播放'} onClick={() => void togglePlay()}>{loadingAudio ? <LoaderCircle size={23} className="spin"/> : playing ? <Pause size={23} fill="currentColor"/> : <Play size={23} fill="currentColor"/>}</button><button className="icon-button" aria-label="停止并回到开头" onClick={() => stop(true)}><Square size={18} fill="currentColor"/></button><button className={`icon-button ${loop ? 'active' : ''}`} aria-label="循环播放" aria-pressed={loop} onClick={() => { stop(); setLoop(!loop); }}><Repeat2 size={21}/></button></div>
      <div className="position"><strong>{String(Math.floor(beat / 4) + 1).padStart(2, '0')}<b>:</b>{String(Math.floor(beat % 4) + 1).padStart(2, '0')}<small>:{String(Math.floor((beat % 1) * 100)).padStart(2, '0')}</small></strong><span>小节 / 拍</span></div>
      <div className="transport-field"><label htmlFor="bpm">速度 BPM</label><div><input id="bpm" aria-label="速度 BPM" type="number" min={40} max={240} value={project.bpm} onChange={e => { const bpm = +e.target.value; if (bpm >= 40 && bpm <= 240) change({ ...project, bpm }); }}/><AudioLines size={16}/></div></div>
      <div className="transport-field key-field"><label htmlFor="project-key">调性标记</label><select id="project-key" value={project.key} onChange={e => change({ ...project, key: e.target.value })}>{Array.from(new Set([project.key, 'C major', 'A minor', 'D major', 'D minor', 'E minor', 'F major', 'G major', 'B♭ major'])).map(k => <option key={k}>{k}</option>)}</select></div>
      <div className="transport-field meter"><label>拍号</label><strong>4 <span>/</span> 4</strong></div>
      <div className="master-volume"><Volume2 size={18}/><input aria-label="监听音量" type="range" min={0} max={1} step={.01} value={master} onChange={e => setMaster(+e.target.value)}/><span>{Math.round(master * 100)}%</span></div>
    </section>
    {studio.conflict && <div className="conflict-banner">AI 或其他窗口更新了工程。先导出你的本地修改，再载入新版本。<button onClick={() => void exportFile('json')}>导出本地修改</button><button onClick={() => { if (studio.conflict) studio.applyRemote(studio.conflict); }}>载入新版本</button></div>}
    {error && <div className="error-banner" role="alert"><span>{error}</span><button className="icon-button" aria-label="关闭错误提示" onClick={() => setError('')}><X size={16}/></button></div>}
    <main className="workspace">
      <aside className="track-sidebar"><div className="sidebar-title"><div><span className="eyebrow">THE BAND</span><h2>你的乐队 <span>{String(project.tracks.length).padStart(2, '0')}</span></h2></div><button className="icon-button inverse" aria-label="添加音轨" onClick={() => setModal('library')}><Plus size={21}/></button></div>
        <div className="track-list">{project.tracks.map((t, index) => <div key={t.id} className={`track-card ${activeTrack?.id === t.id ? 'selected' : ''} ${t.muted ? 'muted' : ''}`}><button className="track-select" onClick={() => selectTrack(t.id)}><span className="track-index">{String(index + 1).padStart(2, '0')}</span><span className="track-instrument" style={{ color: t.color }}><InstrumentIcon id={t.instrumentId}/></span><span className="track-copy"><strong>{t.name}</strong><small>{library.find(i => i.id === t.instrumentId)?.name || t.instrumentId} · {t.notes.length} 音符</small></span><span className="track-color" style={{ background: t.color }}/></button><div className="track-controls"><button aria-label={`${t.name} 静音`} aria-pressed={t.muted} className={t.muted ? 'on' : ''} onClick={() => change(p => ({ ...p, tracks: p.tracks.map(a => a.id === t.id ? { ...a, muted: !a.muted } : a) }))}>M</button><button aria-label={`${t.name} 独奏`} aria-pressed={t.solo} className={t.solo ? 'on' : ''} onClick={() => change(p => ({ ...p, tracks: p.tracks.map(a => a.id === t.id ? { ...a, solo: !a.solo } : a) }))}>S</button><div className="track-level"><i style={{ width: `${t.volume * 100}%`, background: t.color }}/></div></div></div>)}</div>
        <button className="add-track" onClick={() => setModal('library')}><Plus size={16}/>为乐队添一件乐器</button>
        <div className="sidebar-footer"><div className={`vinyl ${playing ? 'spinning' : ''}`}><div><span>蓝</span><i/></div></div><div><strong>留一点空间<br/>给意外的好听。</strong><span>MADE OF LITTLE NOTES.</span></div></div>
        <button className="library-link" onClick={() => setModal('library')}><Library size={18}/><span>探索音源库</span><b>CC0</b><ArrowRight size={16}/></button>
      </aside>
      <div className="editor-main">
        <section className="arrangement"><header className="section-header"><div className="section-name"><span>01</span><h2>编曲全景</h2><small>{project.bars} 小节 · {Math.round(duration)} 秒</small></div><div className="section-actions"><label>长度 <select aria-label="工程小节数" value={project.bars} onChange={e => { const bars = +e.target.value; if (project.tracks.some(t => t.notes.some(n => n.start + n.duration > bars * 4))) { notify('缩短前，请先移走或删除超出范围的音符'); return; } change({ ...project, bars }); }}>{Array.from(new Set([project.bars, 4, 8, 16, 32, 64])).sort((a, b) => a - b).map(b => <option key={b} value={b}>{b} 小节</option>)}</select></label><button className="icon-button" aria-label="显示音轨参数" onClick={() => setSidebar(!sidebar)}><SlidersHorizontal size={17}/></button></div></header>
          <div className="arrangement-body"><div className="arrange-ruler"><span className="arrange-label">TRACK / BAR</span><div>{Array.from({ length: project.bars }, (_, i) => <button key={i} onClick={() => { stop(); setBeat(i * 4); }}>{String(i + 1).padStart(2, '0')}</button>)}</div></div>
            <div className="arrange-tracks">{project.tracks.map((t, index) => <div className={`arrange-row ${activeTrack?.id === t.id ? 'active' : ''}`} key={t.id}><button className="arrange-label" onClick={() => selectTrack(t.id)}><span style={{ background: t.color }}/>{String(index + 1).padStart(2, '0')}<InstrumentIcon id={t.instrumentId} size={15}/></button><button className={`arrange-clip ${t.muted ? 'muted' : ''}`} style={{ '--track-color': t.color, backgroundSize: `${100 / project.bars}% 100%` } as React.CSSProperties} onClick={() => selectTrack(t.id)} aria-label={`编辑 ${t.name}`}><span className="clip-title">{t.name}</span>{t.notes.map(n => <i key={n.id} style={{ left: `${n.start / (project.bars * 4) * 100}%`, width: `${Math.max(.22, n.duration / (project.bars * 4) * 100)}%`, top: 17 + ((84 - n.midi) % 24) * .65 }}/>) }<div className="arrange-playhead" style={{ left: `${beat / (project.bars * 4) * 100}%` }}/></button></div>)}</div>
          </div>
          <div className="arrangement-caption"><span><i/>每一个小块，都是一个想法。</span><span>{totalNotes} NOTES / {project.tracks.length} TRACKS</span></div>
        </section>
        <section className="piano-section"><header className="section-header"><div className="section-name"><span>02</span><h2>钢琴卷帘</h2>{activeTrack && <small className="track-chip" style={{ color: activeTrack.color }}>{activeTrack.name}</small>}</div><div className="section-actions"><button className="icon-button" aria-label="撤销" disabled={!studio.historyCount[0]} onClick={studio.undo}><Undo2 size={16}/></button><button className="icon-button" aria-label="重做" disabled={!studio.historyCount[1]} onClick={studio.redo}><Redo2 size={16}/></button><i className="divider"/><label>吸附 <select aria-label="音符吸附" value={snap} onChange={e => setSnap(+e.target.value)}><option value={.25}>1/16</option><option value={.5}>1/8</option><option value={1}>1/4</option></select></label><div className="zoom-control"><button aria-label="缩小卷帘" onClick={() => setZoom(z => Math.max(18, z - 6))}><Minus size={14}/></button><span>{Math.round(zoom / 36 * 100)}%</span><button aria-label="放大卷帘" onClick={() => setZoom(z => Math.min(90, z + 6))}><Plus size={14}/></button></div></div></header>
          <div className="editor-mode"><button aria-label="打开钢琴卷帘" className={editorMode === 'piano' ? 'active' : ''} onClick={() => setEditorMode('piano')}><Piano size={14}/>钢琴卷帘</button><button aria-label="打开鼓机" className={editorMode === 'drums' ? 'active' : ''} onClick={() => setEditorMode('drums')}><Disc3 size={14}/>16 步鼓机</button><span>{editorMode === 'drums' ? '把节奏，一格一格点亮。' : '音高在上下，时间往右走。'}</span></div>
          {editorMode === 'drums' ? <DrumMachine project={project} activeTrackId={activeTrack?.id} library={library} beat={playing ? beat : -1} selected={selected} onChange={change} onSelect={(id, n) => { setTrackId(id); setSelected(n); }} onPreview={id => preview(60, id)}/> : activeTrack ? <PianoRoll track={activeTrack} beats={project.bars * 4} beat={beat} snap={snap} zoom={zoom} selected={selected} onSelect={setSelected} onChange={notes => updateTrack({ notes })} onPreview={m => preview(m)} onSeek={b => { stop(); setBeat(b); }}/> : <div className="empty-editor"><Music2 size={42}/><h3>第一颗音符，从这里开始。</h3><button className="primary" onClick={() => setModal('library')}>添加一件乐器</button></div>}
          <div className="editor-hints"><span><kbd>双击</kbd> 添加音符</span><span><kbd>拖动</kbd> 移动 · 拉右缘改长度</span><span><kbd>空格</kbd> 播放</span><span><kbd>Delete</kbd> 删除</span></div>
        </section>
      </div>
      <aside className={`inspector ${sidebar ? 'mobile-open' : ''}`}><div className="inspector-heading"><SlidersHorizontal size={17}/><h2>细调一下</h2><button className="icon-button inspector-close" aria-label="收起参数" onClick={() => setSidebar(false)}><X size={16}/></button></div>
        {activeTrack && <><div className="instrument-summary"><span style={{ background: activeTrack.color }}><InstrumentIcon id={activeTrack.instrumentId} size={26}/></span><div><small>{instrument?.englishName || 'INSTRUMENT'}</small><input aria-label="音轨名称" value={activeTrack.name} maxLength={80} onChange={e => updateTrack({ name: e.target.value })}/></div></div>
        <label className="control-label">音色<select aria-label="切换音色" value={activeTrack.instrumentId} onChange={e => { const next = instruments.find(i => i.id === e.target.value); updateTrack({ instrumentId: e.target.value, articulation: undefined, notes: activeTrack.notes.map(n => ({ ...n, articulation: next?.articulations?.some(a => a.id === n.articulation) ? n.articulation : undefined })) }); }}>{instruments.map(i => <option key={i.id} value={i.id}>{i.name}{i.installed ? '' : ' · 未下载'}</option>)}</select></label>
        {instrument?.articulations && <label className="control-label">默认奏法<select aria-label="音轨奏法" value={activeTrack.articulation ?? instrument.defaultArticulation ?? instrument.articulations[0]?.id} onChange={e => updateTrack({ articulation: e.target.value })}>{instrument.articulations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        <div className="slider-control"><label htmlFor="track-volume">音轨音量 <b>{Math.round(activeTrack.volume * 100)}%</b></label><input id="track-volume" type="range" min={0} max={1} step={.01} value={activeTrack.volume} onChange={e => updateTrack({ volume: +e.target.value })}/></div>
        {!instrument?.percussive && <div className="slider-control"><label htmlFor="track-release">收音时间 <b>{Math.round((activeTrack.release ?? instrument?.release ?? .15) * 1000)} ms</b></label><input id="track-release" title="音符结束后的尾音长度；短值适合紧促的节奏吉他" type="range" min={.005} max={2} step={.001} value={activeTrack.release ?? instrument?.release ?? .15} onChange={e => updateTrack({ release: +e.target.value })}/></div>}
        <div className="slider-control"><label htmlFor="track-pan">声像 <b>{Math.abs(activeTrack.pan) < .01 ? '居中' : `${activeTrack.pan < 0 ? 'L' : 'R'} ${Math.round(Math.abs(activeTrack.pan) * 100)}`}</b></label><input id="track-pan" type="range" min={-1} max={1} step={.01} value={activeTrack.pan} onChange={e => updateTrack({ pan: +e.target.value })}/><div className="range-labels"><span>L</span><span>R</span></div></div>
        <div className="slider-control"><label htmlFor="track-reverb">空间混响 <b>{Math.round((activeTrack.reverb ?? 0) * 100)}%</b></label><input id="track-reverb" title="发送到共享房间混响的量；0 为干声" type="range" min={0} max={1} step={.01} value={activeTrack.reverb ?? 0} onChange={e => updateTrack({ reverb: +e.target.value })}/></div>
        <div className="slider-control"><label htmlFor="track-humanize">演奏人性化 <b>{Math.round((activeTrack.humanize ?? 0) * 100)}%</b></label><input id="track-humanize" title="按音符固定的细微时值、力度和音准变化，每次播放与导出都一致" type="range" min={0} max={1} step={.01} value={activeTrack.humanize ?? 0} onChange={e => updateTrack({ humanize: +e.target.value })}/></div>
        <div className="amp-controls"><label className="control-label">音箱前级<select aria-label="音箱前级" value={activeTrack.effects?.ampModel ?? "none"} onChange={e => { const ampModel = e.target.value as "none" | "high-gain" | "nam"; updateTrack({ effects: { ...(activeTrack.effects || DEFAULT_EFFECTS), ampModel, ...(ampModel === "nam" && !activeTrack.effects?.namModelId && ampModels[0] ? { namModelId: ampModels[0].id } : {}) } }); }}><option value="none">Tuna 过载</option><option value="high-gain">AmpSim3 高增益</option>{ampModels.length > 0 && <option value="nam">NAM 神经网络箱头</option>}</select></label>{activeTrack.effects?.ampModel === "nam" && <label className="control-label">箱头模型<select aria-label="NAM 箱头模型" value={activeTrack.effects?.namModelId ?? ""} onChange={e => updateTrack({ effects: { ...(activeTrack.effects || DEFAULT_EFFECTS), namModelId: e.target.value } })}>{ampModels.map(m => <option key={m.id} value={m.id}>{m.name}{m.installed ? "" : " · 未下载"}</option>)}</select></label>}<label className="control-label">箱体响应<select aria-label="箱体响应" value={activeTrack.effects?.cabinetId ?? ""} onChange={e => updateTrack({ effects: { ...(activeTrack.effects || DEFAULT_EFFECTS), cabinetId: e.target.value || undefined } })}><option value="">无箱体</option>{cabinets.map(c => <option key={c.id} value={c.id}>{c.name}{c.installed ? "" : " · 未下载"}</option>)}</select></label></div>
        <div className={`effect-pedal ${(activeTrack.effects || DEFAULT_EFFECTS).enabled ? 'enabled' : ''}`}><div className="pedal-top"><div><small>{activeTrack.effects?.ampModel === "nam" ? "NAM / NEURAL CAPTURE" : activeTrack.effects?.ampModel === "high-gain" ? "AMPSIM3 / HIGH GAIN" : "TUNA / OVERDRIVE"}</small><strong>一点毛边，一点性格。</strong></div><button className="pedal-switch" aria-label="开关失真效果器" aria-pressed={(activeTrack.effects || DEFAULT_EFFECTS).enabled} onClick={() => updateTrack({ effects: { ...(activeTrack.effects || DEFAULT_EFFECTS), enabled: !(activeTrack.effects || DEFAULT_EFFECTS).enabled } })}><i/></button></div><div className="pedal-knobs">{([{ key: 'drive', name: '驱动', label: 'DRIVE' }, { key: 'tone', name: '明暗', label: 'TONE' }, { key: 'mix', name: '干湿', label: 'MIX' }, { key: 'output', name: '输出', label: 'LEVEL' }] as const).map(k => { const value = (activeTrack.effects || DEFAULT_EFFECTS)[k.key]; return <label className="pedal-knob" key={k.key}><span className="knob-face"><i style={{ transform: `rotate(${-135 + value * 270}deg)` }}/></span><span>{k.name}<b>{Math.round(value * 100)}</b></span><input aria-label={`效果器${k.name}`} type="range" min={0} max={1} step={.01} value={value} onChange={e => updateTrack({ effects: { ...(activeTrack.effects || DEFAULT_EFFECTS), [k.key]: +e.target.value } })}/><small>{k.label}</small></label>; })}</div><div className="pedal-bottom"><span>{(activeTrack.effects || DEFAULT_EFFECTS).enabled ? '效果已接入 · 实时调节' : 'BYPASS · 原声直通'}</span><a href={activeTrack.effects?.ampModel === "nam" ? "https://github.com/tone-3000/neural-amp-modeler-wasm" : activeTrack.effects?.ampModel === "high-gain" ? "https://github.com/micbuffa/WebAudio-Guitar-Amplifier-Simulator-3" : "https://github.com/Theodeus/tuna"} target="_blank" rel="noreferrer">MIT <ExternalLink size={9}/></a></div></div>
        <div className="note-inspector"><div className="subheading"><span>音符细节</span>{note ? <span className="note-badge">{noteName(note.midi)}</span> : <span>未选择</span>}</div>
          {note ? <>{instrument?.articulations && <label className="control-label note-articulation">此音奏法<select aria-label="音符奏法" value={note.articulation ?? ""} onChange={e => updateNote({ articulation: e.target.value || undefined })}><option value="">跟随音轨</option>{instrument.articulations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}<div className="note-form"><label>音高<select aria-label="音符音高" value={note.midi} onChange={e => { updateNote({ midi: +e.target.value }); preview(+e.target.value); }}>{Array.from({ length: 128 }, (_, m) => <option key={m} value={m}>{noteName(m)}</option>)}</select></label><label>时值 / 拍<input aria-label="音符时值" type="number" step={snap} min={snap} max={project.bars * 4 - note.start} value={Math.round(note.duration * 10000) / 10000} onChange={e => { const d = +e.target.value; if (d >= .0625 && d + note.start <= project.bars * 4) updateNote({ duration: d }); }}/></label><label className="wide-field">起点 / 拍 <input aria-label="音符起点" type="number" step={snap} min={0} max={project.bars * 4 - note.duration} value={Math.round(note.start * 10000) / 10000} onChange={e => { const start = +e.target.value; if (start >= 0 && start + note.duration <= project.bars * 4) updateNote({ start }); }}/></label></div><div className="slider-control"><label htmlFor="velocity">力度 <b>{Math.round(note.velocity * 100)}</b></label><input id="velocity" type="range" min={.01} max={1} step={.01} value={note.velocity} onChange={e => updateNote({ velocity: +e.target.value })}/></div><div className="note-actions"><button onClick={duplicateNote}><Copy size={14}/>复制</button><button onClick={deleteNote}><Trash2 size={14}/>删除</button></div></> : <div className="note-empty"><div className="tiny-notes"><i/><i/><i/></div><p>选中一颗音符，<br/>让它更像你想的那样。</p></div>}
        </div><button className="delete-track" onClick={() => { change(p => ({ ...p, tracks: p.tracks.filter(t => t.id !== activeTrack.id) })); setSelected(null); notify('音轨已移除，可以撤销'); }}><Trash2 size={13}/>移除这条音轨</button></>}
        <div className="brief"><div className="brief-title"><Sparkles size={16}/><strong>给下一段灵感留个言</strong></div><textarea aria-label="编曲需求" value={prompt} maxLength={4000} onChange={e => setPrompt(e.target.value)} placeholder="例如：保留旋律，把鼓点变轻一点，再加一层温暖的弦乐…"/><div className="brief-actions"><button disabled={!prompt.trim() || briefBusy} onClick={() => void saveBrief()}><Save size={14}/>{briefBusy ? '保存中' : '保存需求'}</button><button aria-label="复制需求给 Agent" disabled={!prompt.trim()} onClick={() => void navigator.clipboard.writeText(`请使用 xsxb-band skill 和本地编曲工作室（${location.origin}，说明见仓库 docs/AGENT-API.md），先读取当前工程，再根据以下要求谱曲编曲：\n${prompt}`).then(() => notify('已复制，粘贴到 Agent 聊天即可')).catch(() => notify('复制失败，请直接复制输入框中的文字'))}><Copy size={14}/></button></div><p>保存后回到 Agent 聊天，让它读取并编曲。</p></div>
      </aside>
    </main>
    <footer className="statusbar"><div><span className="connection-dot"/>本地工作室<span className="status-divider"/>音源 {library.filter(i => i.installed).length}/{library.length} 就绪{missing.length > 0 && <button onClick={() => setModal('library')}>下载当前乐队音源 <ArrowRight size={12}/></button>}</div><div><Headphones size={13}/><span>戴上耳机，慢慢玩。</span><b>KLEIN / 001</b></div></footer>
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
    {modal === 'library' && <Modal wide title="为灵感，挑一件乐器。" subtitle="开放许可音源与箱头模型 · 按需下载到本机 · 下载后可离线使用" onClose={() => setModal(null)}><div className="library-toolbar"><div className="library-filters">{['全部', ...new Set(library.map(i => i.family))].map(f => <button className={family === f ? 'active' : ''} key={f} onClick={() => setFamily(f)}>{f}</button>)}</div><input aria-label="搜索乐器" placeholder="找一种声音…" value={search} onChange={e => setSearch(e.target.value)}/></div>
      {missing.length > 0 && <div className="download-band"><span>当前工程还需要 {missing.length} 件乐器的音源</span><button disabled={downloading.size > 0} onClick={() => void (async () => { for (const i of missing) await install(i); })()}><Download size={15}/>下载当前乐队</button></div>}
      <div className="instrument-library">{library.filter(i => (family === '全部' || family === i.family) && `${i.name} ${i.englishName}`.toLowerCase().includes(search.toLowerCase())).map(i => <article className="instrument-card" key={i.id}><div className="instrument-card-head"><span className="library-instrument-icon" style={{ color: i.color || '#002fa7' }}><InstrumentIcon id={i.id} size={33}/></span><span className={`installed ${i.installed ? 'yes' : ''}`}>{i.installed ? <><Check size={12}/>已就绪</> : `${(i.samples.reduce((s, a) => s + (a.bytes || 0), 0) / 1024 / 1024).toFixed(1)} MB`}</span></div><small>{i.englishName}</small><h3>{i.name}</h3><p>{i.description}</p><div className="instrument-card-actions">{i.installed ? i.kind === "cabinet" || i.kind === "amp-model" ? <button disabled><Check size={14}/>{i.kind === "cabinet" ? "IR 已就绪" : "模型已就绪"}</button> : <button onClick={() => preview(60, i.id)}><Play size={14}/>试听</button> : <button disabled={downloading.has(i.id)} onClick={() => void install(i)}>{downloading.has(i.id) ? <LoaderCircle className="spin" size={14}/> : <Download size={14}/>} {downloading.has(i.id) ? '下载中…' : '下载音源'}</button>}<button className="add-instrument" disabled={(i.kind === "cabinet" || i.kind === "amp-model") && !activeTrack} onClick={() => addTrack(i)}><Plus size={15}/>{i.kind === "cabinet" ? "应用箱体" : i.kind === "amp-model" ? "应用箱头" : "加入乐队"}</button></div><details><summary>来源、许可与下载链接 <ExternalLink size={11}/></summary><div className="source-links"><a href={i.sourceUrl} target="_blank" rel="noreferrer">原作者 / 来源 <ExternalLink size={11}/></a><a href={i.licenseUrl || i.sourceUrl} target="_blank" rel="noreferrer">{i.license.replace(/-1\.0$/, '')} 许可说明{i.author ? ` · ${i.author}` : ''} <ExternalLink size={11}/></a>{i.samples.filter(s => s.downloadUrl).map(s => <a key={s.url} href={s.downloadUrl} target="_blank" rel="noreferrer">{noteName(s.midi)} · {s.url.split('.').pop()?.toUpperCase()} 原始下载 <ArrowDownToLine size={11}/></a>)}</div></details></article>)}</div><div className="license-note"><span>CC0</span><p>软件仅提供目录和链接，音源保存在本机缓存中，不随源码或发布包分发。原始下载来自作者公开仓库。</p><a href="/api/license-doc" target="_blank" rel="noreferrer">完整来源清单 <ExternalLink size={13}/></a></div></Modal>}
    {modal === 'songs' && <Modal wide title="你的每一首歌，都在这里。" subtitle="打开、改名、复制或删除 · 当前编辑的歌曲会自动保存" onClose={() => setModal(null)}><SongLibrary notify={notify} onOpen={openSong} onActiveRenamed={(state: ServerState) => studio.applyRemote(state)}/></Modal>}
    {modal === 'export' && <Modal title="让音乐，走出工作台。" subtitle={`${project.title} · ${project.bars} 小节 · ${project.bpm} BPM`} onClose={() => setModal(null)}><div className="export-options"><button disabled={exporting || missing.length > 0} onClick={() => void exportFile('wav')}><div className="export-icon"><AudioLines/></div><div><strong>导出 WAV 音频</strong><span>{missing.length ? '请先下载当前工程音源' : '立体声音频 · 使用当前混音和静音设置'}</span></div>{exporting ? <LoaderCircle className="spin" size={18}/> : <Download size={18}/>}</button><button disabled={exporting} onClick={() => void exportFile('midi')}><div className="export-icon"><Piano/></div><div><strong>导出 MIDI 乐谱</strong><span>继续在其他编曲软件中编辑 · 不含音源</span></div><Download size={18}/></button><button disabled={exporting} onClick={() => void exportFile('json')}><div className="export-icon"><FolderOpen/></div><div><strong>保存工程文件</strong><span>保留全部音轨、音符和混音参数 · JSON</span></div><Download size={18}/></button></div><p className="modal-footnote">WAV / MIDI 导出遵循音轨静音与独奏；监听音量不影响导出。工程文件保留全部内容。</p></Modal>}
    {modal === 'help' && <Modal title="你给方向，我们写成音乐。" subtitle="XSXB-Band · 为你和 AI 准备的本地编曲工作台" onClose={() => setModal(null)}><div className="help-content"><div><span>01</span><p><strong>告诉我，你想听到什么。</strong>在 Agent 聊天里描述风格、情绪、乐器和时长。我通过本地接口把乐谱写入这里，页面会自动载入更新。</p></div><div><span>02</span><p><strong>下载乐器，按下播放。</strong>音源库保存所有 CC0 来源与原始链接，只在你点击下载时获取文件。下载后保存在本机。</p></div><div><span>03</span><p><strong>每颗音符，都可以再想一想。</strong>双击空白写音符，拖动改音高和位置，拉右缘改长度。选中后可用方向键微调，Shift＋上下键移动八度。</p></div><div><span>04</span><p><strong>带走你的作品。</strong>导出 WAV 试听分享，导出 MIDI 继续制作，或保存 JSON 工程。工程会自动保存，Ctrl＋Z 可撤销。</p></div><p className="help-note">调性是编曲参考标记，更改它不会自动转调。起点与时值均以四分音符为一拍。音源采用有限采样移调，长音自然衰减。</p><button className="text-button" onClick={() => { const recovery = localStorage.getItem('klein-recovery'); if (!recovery) { notify('没有尚未保存的本地备份'); return; } try { const p = JSON.parse(recovery); validateImport(p); download(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), 'XSXB-Band-恢复备份.json'); } catch { notify('备份格式无法读取'); } }}><Save size={16}/>导出未保存的恢复备份</button></div></Modal>}
  </div>;
}
