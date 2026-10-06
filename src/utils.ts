import type { Project } from './types';
export const BLUE = '#002fa7';
export const COLORS = ['#002fa7', '#dd8059', '#77906d', '#aa87ad', '#d2a544', '#598e99', '#b65f74'];
export const uid = () => crypto.randomUUID();
export const noteName = (midi: number) => ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][midi % 12] + (Math.floor(midi / 12) - 1);
export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export function download(blob: Blob, filename: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
export function validateImport(p: unknown): asserts p is Project {
  if (!p || typeof p !== 'object') throw Error('请选择有效的 XSXB-Band 工程 JSON 文件');
  const v = p as Project;
  const validId = (s: unknown) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(s);
  const text = (s: unknown, max: number) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
  if (!validId(v.id) || !text(v.title, 160) || !text(v.key, 60) || typeof v.updatedAt !== 'string' || !Number.isFinite(Date.parse(v.updatedAt))) throw Error('工程名称、标识或日期不正确');
  if (v.schemaVersion !== 1 || typeof v.id !== 'string' || !v.id || typeof v.title !== 'string' || typeof v.key !== 'string' || !Number.isFinite(v.bpm) || v.bpm < 40 || v.bpm > 240 || !Number.isInteger(v.bars) || v.bars < 1 || v.bars > 64 || JSON.stringify(v.timeSignature) !== '[4,4]' || !Array.isArray(v.tracks) || v.tracks.length > 32) throw Error('工程格式不正确：支持 4/4 拍、40–240 BPM、1–64 小节');
  const ids = new Set<string>();
  for (const t of v.tracks) {
    if (!t || !validId(t.id) || !text(t.name, 80)) throw Error('音轨标识或名称不正确');
    if (t.release !== undefined && (!Number.isFinite(t.release) || t.release < .005 || t.release > 2)) throw Error('收音时间应为 0.005–2 秒');
    for (const key of ['reverb', 'humanize'] as const) { const value = t[key]; if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) throw Error('空间混响与人性化应为 0–1 的数值'); }
    if (t.articulation !== undefined && (typeof t.articulation !== 'string' || !t.articulation.trim() || t.articulation.length > 40)) throw Error('音轨奏法不正确');
    if (t.effects?.ampModel !== undefined && !['none','high-gain','nam'].includes(t.effects.ampModel)) throw Error('音箱型号不正确');
    if (t.effects?.namModelId !== undefined && !validId(t.effects.namModelId)) throw Error('箱头模型标识不正确');
    if (t.effects?.cabinetId !== undefined && !validId(t.effects.cabinetId)) throw Error('箱体响应标识不正确');
    if (t.effects !== undefined && (!t.effects || typeof t.effects.enabled !== 'boolean' || ['drive', 'tone', 'mix', 'output'].some(k => { const value = t.effects![k as 'drive']; return !Number.isFinite(value) || value < 0 || value > 1; }))) throw Error('效果器参数不正确，应为 0–1 的数值');
    if (!t || typeof t.id !== 'string' || ids.has(t.id) || typeof t.name !== 'string' || typeof t.instrumentId !== 'string' || !/^#[0-9a-f]{6}$/i.test(t.color) || !Number.isFinite(t.volume) || t.volume < 0 || t.volume > 1 || !Number.isFinite(t.pan) || Math.abs(t.pan) > 1 || typeof t.muted !== 'boolean' || typeof t.solo !== 'boolean' || !Array.isArray(t.notes) || t.notes.length > 10000) throw Error('音轨数据不正确');
    ids.add(t.id); const notes = new Set<string>();
    for (const n of t.notes) {
      if (!n || !validId(n.id)) throw Error('音符标识不正确');
      if (n.articulation !== undefined && (typeof n.articulation !== 'string' || !n.articulation.trim() || n.articulation.length > 40)) throw Error('音符奏法不正确');
      if (!n || typeof n.id !== 'string' || notes.has(n.id) || !Number.isInteger(n.midi) || n.midi < 0 || n.midi > 127 || !Number.isFinite(n.start) || n.start < 0 || !Number.isFinite(n.duration) || n.duration < .0625 || n.start + n.duration > v.bars * 4 + .0001 || !Number.isFinite(n.velocity) || n.velocity < 0 || n.velocity > 1) throw Error('音符数据不正确或超出工程长度');
      notes.add(n.id);
    }
  }
}
