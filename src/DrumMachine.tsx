import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import type { Instrument, Note, Project, Track } from './types';
import { COLORS, uid } from './utils';
import './drums.css';

const DRUM_IDS = ['kick', 'snare', 'hihat', 'tom', 'crash', 'clap', 'shaker'];
const GROUPS = [0, 1, 2, 3];
const STEPS = [0, 1, 2, 3];
const SAME_BEAT = 0.0001;

export interface DrumMachineProps {
  project: Project;
  library: Instrument[];
  selected: string | null;
  onChange: (project: Project) => void;
  onSelect: (trackId: string, noteId: string | null) => void;
  onPreview: (instrumentId: string) => void;
  beat: number;
  activeTrackId?: string;
}

function DrumGlyph({ id }: { id: string }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {id === 'kick' && <><circle cx="12" cy="11" r="7"/><circle cx="12" cy="11" r="4.5"/><path d="m7 17-2 4m12-4 2 4m-7-10 3 3"/></>}
    {id === 'snare' && <><ellipse cx="12" cy="8" rx="8" ry="3"/><path d="M4 8v7c0 4 16 4 16 0V8M7 11v5m5-4v6m5-7v5M5 2l14 4"/></>}
    {id === 'hihat' && <><path d="M3 9h18M5 6c4-3 10-3 14 0M5 12c4 3 10 3 14 0M12 2v19m-4 0 4-3 4 3"/></>}
    {id === 'tom' && <><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v10c0 4 14 4 14 0V6M8 9v9m8-9v9"/></>}
    {id === 'crash' && <><path d="M2 10c5 2 15 2 20 0L13 7h-2L2 10ZM12 4v17m-4 0 4-3 4 3M4 3l2 2m14-2-2 2"/></>}
    {id === 'clap' && <><path d="m8 19-4-6c-1-2 1-3 2-1l2 2V6c0-2 2-2 2 0v5-7c0-2 2-2 2 0v7-6c0-2 2-2 2 0v7-4c0-2 2-2 2 0v8l-2 4H9ZM19 5l2-2m-2 6h3"/></>}
    {id === 'shaker' && <><path d="m6 6 9-3 4 13-9 3L6 6ZM6 6c0 2 9-1 9-3M10 19c1 2 10-1 9-3M3 10l1 5m17-6 1 4"/></>}
  </svg>;
}

export default function DrumMachine({ project, library, selected, onChange, onSelect, onPreview, beat, activeTrackId }: DrumMachineProps) {
  const [page, setPage] = useState(0);
  const grid = useRef<HTMLDivElement>(null);
  const bar = Math.min(page, Math.max(0, project.bars - 1));
  const drums = DRUM_IDS.flatMap(id => {
    const aliases = [id, `rock-${id}`];
    const current = project.tracks.find(t => t.id === activeTrackId && aliases.includes(t.instrumentId))
      ?? project.tracks.find(t => aliases.includes(t.instrumentId));
    const instrument = library.find(item => item.id === current?.instrumentId)
      ?? library.find(item => item.id === `rock-${id}`)
      ?? library.find(item => item.id === id);
    return instrument ? [instrument] : [];
  });
  const playingBar = Number.isFinite(beat) && beat >= 0 ? Math.floor(beat / 4) : -1;
  const currentStep = playingBar === bar ? Math.floor((beat - bar * 4) * 4) : -1;
  const maxTracks = project.tracks.length >= 32;

  useEffect(() => { setPage(0); }, [project.id]);
  useEffect(() => { setPage(previous => Math.min(previous, Math.max(0, project.bars - 1))); }, [project.bars]);

  function toggleStep(instrument: Instrument, track: Track | undefined, step: number, event: MouseEvent<HTMLButtonElement>) {
    const start = bar * 4 + step * .25;
    const existing = track?.notes.find(note => Math.abs(note.start - start) < SAME_BEAT);
    if (existing && event.shiftKey) {
      onSelect(track!.id, existing.id);
      return;
    }
    if (existing && track) {
      onChange({ ...project, tracks: project.tracks.map(item => item.id === track.id
        ? { ...item, notes: item.notes.filter(note => Math.abs(note.start - start) >= SAME_BEAT) }
        : item) });
      onSelect(track.id, null);
      return;
    }
    if ((!track && maxTracks) || (track && track.notes.length >= 10000)) return;
    const note: Note = { id: uid(), midi: 60, start, duration: .125, velocity: step % 4 === 0 ? .8 : .55 };
    const nextTrack: Track = track
      ? { ...track, notes: [...track.notes, note].sort((a, b) => a.start - b.start) }
      : { id: uid(), name: instrument.name, instrumentId: instrument.id,
          color: COLORS[project.tracks.length % COLORS.length], volume: .7, pan: 0,
          muted: false, solo: false, notes: [note] };
    onChange({ ...project, tracks: track
      ? project.tracks.map(item => item.id === track.id ? nextTrack : item)
      : [...project.tracks, nextTrack] });
    onSelect(nextTrack.id, note.id);
    if (instrument.installed !== false) onPreview(instrument.id);
  }

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, row: number, step: number) {
    if (event.key === ' ' || event.key === 'Enter') { event.stopPropagation(); return; }
    let nextRow = row, nextStep = step;
    if (event.key === 'ArrowLeft') nextStep = Math.max(0, step - 1);
    else if (event.key === 'ArrowRight') nextStep = Math.min(15, step + 1);
    else if (event.key === 'ArrowUp') nextRow = Math.max(0, row - 1);
    else if (event.key === 'ArrowDown') nextRow = Math.min(drums.length - 1, row + 1);
    else if (event.key === 'Home') nextStep = 0;
    else if (event.key === 'End') nextStep = 15;
    else return;
    event.preventDefault();
    event.stopPropagation();
    grid.current?.querySelector<HTMLButtonElement>(`[data-drum-row="${nextRow}"][data-drum-step="${nextStep}"]`)?.focus();
  }

  return <section className="drum-machine" aria-label="16 步鼓机" onKeyDown={event => {
    if ((event.target as HTMLElement).closest('button') && [' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) event.stopPropagation();
  }}>
    <div className="drum-toolbar">
      <div className="drum-title"><span className="drum-title-mark" aria-hidden="true"><i/><i/><i/><i/></span><div><strong>敲点节奏</strong><span>16 STEP SEQUENCER</span></div></div>
      <div className="drum-pagination">
        <button type="button" aria-label="鼓机上一小节" disabled={bar === 0} onClick={() => setPage(bar - 1)}><ChevronLeft size={17}/></button>
        <label className="drum-bar-select"><span>小节</span><select aria-label="鼓机小节" value={bar} onChange={event => setPage(Number(event.target.value))}>{Array.from({ length: project.bars }, (_, index) => <option key={index} value={index}>{String(index + 1).padStart(2, '0')}</option>)}</select><span>/ {String(project.bars).padStart(2, '0')}</span></label>
        <button type="button" aria-label="鼓机下一小节" disabled={bar >= project.bars - 1} onClick={() => setPage(bar + 1)}><ChevronRight size={17}/></button>
      </div>
      <div className="drum-meter"><strong>{project.timeSignature[0]}<span>/</span>{project.timeSignature[1]}</strong><span>每格 1/16</span></div>
    </div>
    <div className="drum-scroll" ref={grid}>
      <div className="drum-grid">
        <div className="drum-row drum-ruler" aria-hidden="true">
          <span className="drum-ruler-caption"><Volume2 size={12}/> 点乐器试听</span>
          {GROUPS.map(group => <div className="drum-group drum-ruler-group" key={group}>{STEPS.map(offset => {
            const step = group * 4 + offset;
            return <span className={`drum-step-number ${offset === 0 ? 'drum-downbeat' : ''} ${step === currentStep ? 'drum-current' : ''}`} key={step}>{String(step + 1).padStart(2, '0')}</span>;
          })}</div>)}
        </div>
        {drums.map((instrument, row) => {
          const track = project.tracks.find(item => item.instrumentId === instrument.id);
          const rowSelected = !!selected && !!track?.notes.some(note => note.id === selected);
          const style = { '--drum-track-color': track?.color || instrument.color || COLORS[row % COLORS.length] } as CSSProperties;
          return <div className={`drum-row ${rowSelected ? 'drum-row-selected' : ''} ${track?.muted ? 'drum-row-muted' : ''}`} key={instrument.id} style={style}>
            <button type="button" className="drum-instrument" aria-label={`试听${instrument.name}`} disabled={instrument.installed === false}
              title={instrument.installed === false ? '请先在音源库下载此乐器' : `试听${instrument.name}`}
              onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') event.stopPropagation(); }}
              onClick={() => { if (track) onSelect(track.id, null); onPreview(instrument.id); }}>
              <span className="drum-instrument-icon"><DrumGlyph id={instrument.id.replace(/^rock-/, '')}/></span>
              <span className="drum-instrument-copy"><strong>{instrument.name}</strong><small>{instrument.installed === false ? '音源未下载' : track?.muted ? '已静音' : track ? track.name : maxTracks ? '音轨已满' : '点格子添加'}</small></span>
            </button>
            {GROUPS.map(group => <div className="drum-group" key={group}>{STEPS.map(offset => {
              const step = group * 4 + offset;
              const note = track?.notes.find(item => Math.abs(item.start - (bar * 4 + step * .25)) < SAME_BEAT);
              const disabled = !track ? maxTracks : !note && track.notes.length >= 10000;
              const label = `${instrument.name}，第 ${bar + 1} 小节，第 ${step + 1} 步${note ? `，力度 ${Math.round(note.velocity * 100)}，点击移除` : '，点击添加'}`;
              return <button type="button" key={step} className={`drum-pad ${offset === 0 ? 'drum-downbeat' : ''} ${note ? 'drum-on' : ''} ${note?.id === selected ? 'drum-selected' : ''} ${step === currentStep ? 'drum-current' : ''}`}
                data-drum-row={row} data-drum-step={step} aria-label={label} aria-pressed={!!note} disabled={disabled}
                title={disabled ? '无法添加：已达到音轨或音符数量上限' : note ? `${label}；Shift + 单击选择并调整力度` : label}
                onKeyDown={event => moveFocus(event, row, step)}
                onClick={event => toggleStep(instrument, track, step, event)}>
                <span className="drum-pad-light" aria-hidden="true"/>
                {note && <span className="drum-velocity" style={{ height: `${Math.max(4, note.velocity * 55)}%` }} aria-hidden="true"/>}
              </button>;
            })}</div>)}
          </div>;
        })}
        {drums.length === 0 && <p className="drum-empty">音源目录载入后，就可以在这里写鼓点。</p>}
      </div>
    </div>
    <div className="drum-footer"><span><i className="drum-legend-dot"/> 点格子写鼓点，再点移除</span><span><kbd>Shift</kbd> + 单击选中，右侧调力度</span>{maxTracks && <span className="drum-limit" role="status">已达 32 条音轨，仍可编辑已有鼓轨</span>}</div>
  </section>;
}
