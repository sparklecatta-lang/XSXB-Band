import { useEffect, useRef, useState } from 'react';
import type { Note, Track } from './types';
import { clamp, isBlack, noteName, uid } from './utils';

interface Props {
  track: Track; beats: number; beat: number; snap: number; zoom: number; selected: string | null;
  onSelect: (id: string | null) => void; onChange: (notes: Note[]) => void; onPreview: (midi: number) => void;
  onSeek: (beat: number) => void;
}
const ROW = 18, KEYS = 58;
export default function PianoRoll({ track, beats, beat, snap, zoom, selected, onSelect, onChange, onPreview, onSeek }: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Note | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; note: Note; resize: boolean; moved: boolean } | null>(null);
  const low = Math.max(0, Math.min(36, ...track.notes.map(n => Math.floor(n.midi / 12) * 12)));
  const high = Math.min(127, Math.max(84, ...track.notes.map(n => Math.ceil(n.midi / 12) * 12)));
  const rows = Array.from({ length: high - low + 1 }, (_, i) => high - i);
  const width = beats * zoom, height = rows.length * ROW;
  useEffect(() => {
    if (scroll.current) {
      const center = track.notes.length ? track.notes.reduce((sum, n) => sum + n.midi, 0) / track.notes.length : 60;
      scroll.current.scrollTop = Math.max(0, (high - center) * ROW - scroll.current.clientHeight / 2 + 30);
    }
  }, [track.id, high]);
  function pointerDown(e: React.PointerEvent<HTMLButtonElement>, note: Note, resize = false) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); onSelect(note.id); onPreview(note.midi);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: note.id, x: e.clientX, y: e.clientY, note, resize, moved: false };
  }
  function pointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current; if (!d) return;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 3) return;
    d.moved = true;
    const dx = Math.round((e.clientX - d.x) / zoom / snap) * snap;
    const next = d.resize ? { ...d.note, duration: clamp(d.note.duration + dx, snap, beats - d.note.start) } : { ...d.note, start: clamp(d.note.start + dx, 0, beats - d.note.duration), midi: clamp(d.note.midi - Math.round((e.clientY - d.y) / ROW), low, high) };
    setDraft(next);
  }
  function pointerUp() { if (drag.current?.moved && draft) onChange(track.notes.map(n => n.id === draft.id ? draft : n)); drag.current = null; setDraft(null); }
  function addNote(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const start = clamp(Math.floor((e.clientX - rect.left) / zoom / snap) * snap, 0, beats - snap);
    const midi = clamp(high - Math.floor((e.clientY - rect.top) / ROW), low, high);
    const note = { id: uid(), midi, start, duration: Math.min(1, beats - start), velocity: .75 };
    onChange([...track.notes, note]); onSelect(note.id); onPreview(midi);
  }
  return <div className="piano-scroll" ref={scroll} aria-label="钢琴卷帘编辑区">
    <div className="piano-content" style={{ width: width + KEYS, height: height + 88 }}>
      <div className="piano-ruler" style={{ width: width + KEYS }}>
        <span className="ruler-key">4/4</span>
        <div className="ruler-bars" style={{ width }} onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onSeek(clamp((e.clientX - r.left) / zoom, 0, beats - .001)); }}>
          {Array.from({ length: beats / 4 }, (_, i) => <span key={i} style={{ left: i * zoom * 4 }}>{String(i + 1).padStart(2, '0')}<i>1</i></span>)}
        </div>
      </div>
      <div className="piano-keys" style={{ height }}>
        {rows.map(midi => <button key={midi} className={`piano-key ${isBlack(midi) ? 'black' : ''} ${midi % 12 === 0 ? 'octave' : ''}`} onClick={() => onPreview(midi)} aria-label={`试听 ${noteName(midi)}`}><span>{midi % 12 === 0 || selected && track.notes.find(n => n.id === selected)?.midi === midi ? noteName(midi) : ''}</span></button>)}
      </div>
      <div className="note-grid" data-testid="note-grid" style={{ left: KEYS, top: 30, width, height, backgroundSize: `${zoom * 4}px 100%, ${zoom}px 100%, 100% ${ROW}px` }} onDoubleClick={addNote} onClick={e => { if (e.target === e.currentTarget) onSelect(null); }}>
        {rows.filter(m => isBlack(m) || m % 12 === 0).map(m => <div key={m} className={`grid-tone ${isBlack(m) ? 'black-row' : 'octave-row'}`} style={{ top: (high - m) * ROW, height: ROW }} />)}
        {track.notes.map(original => {
          const n = draft?.id === original.id ? draft : original;
          return <button key={n.id} data-note-id={n.id} aria-label={`${noteName(n.midi)} 第 ${Math.floor(n.start / 4) + 1} 小节`} className={`note ${selected === n.id ? 'selected' : ''}`} style={{ left: n.start * zoom, top: (high - n.midi) * ROW + 2, width: Math.max(6, n.duration * zoom - 2), height: ROW - 4, background: track.color, opacity: .48 + n.velocity * .52 }} onPointerDown={e => pointerDown(e, n, e.clientX - e.currentTarget.getBoundingClientRect().left > e.currentTarget.clientWidth - 8)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; setDraft(null); }} onKeyDown={e => { if (e.key === 'Enter') onSelect(n.id); }} title={`${noteName(n.midi)} · ${n.duration.toFixed(2)} 拍 · 拖动右缘改时值`}><span>{noteName(n.midi)}</span><i className="note-handle" /></button>;
        })}
        <div className="playhead" style={{ left: beat * zoom }} />
      </div>
      <div className="velocity-lane" style={{ left: KEYS, top: height + 30, width }}>
        <span>力度</span>{track.notes.map(n => <button key={n.id} className={selected === n.id ? 'active' : ''} aria-label={`选中 ${noteName(n.midi)} 力度 ${Math.round(n.velocity * 100)}`} onClick={() => onSelect(n.id)} style={{ left: n.start * zoom, height: n.velocity * 38, background: track.color }} />)}
      </div>
    </div>
  </div>;
}
