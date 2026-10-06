const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const id = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** Musical times are quarter-note beats, starting at 0. Returns human-readable issues. */
export function validateProject(project, instruments) {
  const errors = [];
  const check = (condition, message) => { if (!condition && errors.length < 50) errors.push(message); };
  if (!isObject(project)) return ['project 必须是一个对象'];
  check(project.schemaVersion === 1, 'schemaVersion 必须为 1');
  check(id(project.id), 'project.id 必须为 1–80 位字母、数字、下划线或短横线');
  check(text(project.title, 160), 'title 必须为 1–160 字符');
  check(number(project.bpm, 40, 240), 'bpm 必须在 40–240 之间');
  check(Number.isInteger(project.bars) && number(project.bars, 1, 64), 'bars 必须为 1–64 的整数');
  check(text(project.key, 60), 'key 必须为 1–60 字符');
  check(Array.isArray(project.timeSignature) && project.timeSignature.length === 2 && project.timeSignature[0] === 4 && project.timeSignature[1] === 4, 'timeSignature 当前必须为 [4,4]');
  check(typeof project.updatedAt === 'string' && Number.isFinite(Date.parse(project.updatedAt)), 'updatedAt 必须为有效 ISO 日期字符串');
  if (!Array.isArray(project.tracks) || project.tracks.length > 32) return [...errors, 'tracks 必须为最多 32 条音轨的数组'];
  const instrumentsById = new Map(instruments.map((instrument) => typeof instrument === 'string' ? [instrument, { id: instrument }] : [instrument.id, instrument]));
  const trackIds = new Set();
  let totalNotes = 0;
  project.tracks.forEach((track, ti) => {
    const at = `tracks[${ti}]`;
    if (!isObject(track)) { check(false, `${at} 必须为对象`); return; }
    check(id(track.id) && !trackIds.has(track.id), `${at}.id 无效或重复`);
    trackIds.add(track.id);
    check(text(track.name, 80), `${at}.name 必须为 1–80 字符`);
    const instrument = instrumentsById.get(track.instrumentId);
    check(!!instrument && (instrument.kind === undefined || instrument.kind === 'instrument'), `${at}.instrumentId 必须为音色库中的乐器，不能使用箱体 IR 或箱头模型`);
    const articulations = new Set((instrument?.articulations || []).map((articulation) => articulation.id));
    if (track.articulation !== undefined) {
      check(text(track.articulation, 40) && articulations.has(track.articulation), `${at}.articulation 必须为当前乐器声明的奏法 ID，长度为 1–40 字符`);
    }
    check(typeof track.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(track.color), `${at}.color 必须为 #RRGGBB`);
    check(number(track.volume, 0, 1), `${at}.volume 必须在 0–1 之间`);
    check(number(track.pan, -1, 1), `${at}.pan 必须在 -1–1 之间`);
    if (track.release !== undefined) check(number(track.release, 0.005, 2), `${at}.release 必须在 0.005–2 秒之间`);
    if (track.reverb !== undefined) check(number(track.reverb, 0, 1), `${at}.reverb 必须在 0–1 之间`);
    if (track.humanize !== undefined) check(number(track.humanize, 0, 1), `${at}.humanize 必须在 0–1 之间`);
    check(typeof track.muted === 'boolean' && typeof track.solo === 'boolean', `${at}.muted 与 solo 必须为布尔值`);
    if (track.effects !== undefined) {
      if (!isObject(track.effects)) check(false, `${at}.effects 必须为对象`);
      else {
        check(typeof track.effects.enabled === 'boolean', `${at}.effects.enabled 必须为布尔值`);
        for (const parameter of ['drive', 'tone', 'mix', 'output']) {
          check(number(track.effects[parameter], 0, 1), `${at}.effects.${parameter} 必须在 0–1 之间`);
        }
        if (track.effects.ampModel !== undefined) {
          check(['none', 'high-gain', 'nam'].includes(track.effects.ampModel), `${at}.effects.ampModel 必须为 none、high-gain 或 nam`);
        }
        if (track.effects.namModelId !== undefined) {
          check(typeof track.effects.namModelId === 'string' && instrumentsById.get(track.effects.namModelId)?.kind === 'amp-model', `${at}.effects.namModelId 必须对应音色库中 kind 为 amp-model 的箱头模型`);
        }
        if (track.effects.ampModel === 'nam') check(track.effects.namModelId !== undefined, `${at}.effects.ampModel 为 nam 时必须提供 namModelId`);
        if (track.effects.cabinetId !== undefined) {
          check(typeof track.effects.cabinetId === 'string' && instrumentsById.get(track.effects.cabinetId)?.kind === 'cabinet', `${at}.effects.cabinetId 必须对应音色库中 kind 为 cabinet 的箱体 IR`);
        }
      }
    }
    if (!Array.isArray(track.notes) || track.notes.length > 32768) { check(false, `${at}.notes 必须为最多 32768 个音符的数组`); return; }
    totalNotes += track.notes.length;
    const noteIds = new Set();
    track.notes.forEach((note, ni) => {
      const np = `${at}.notes[${ni}]`;
      if (!isObject(note)) { check(false, `${np} 必须为对象`); return; }
      check(id(note.id) && !noteIds.has(note.id), `${np}.id 无效或在音轨内重复`);
      noteIds.add(note.id);
      check(Number.isInteger(note.midi) && number(note.midi, 0, 127), `${np}.midi 必须为 0–127 的整数`);
      check(number(note.start, 0, project.bars * 4), `${np}.start 必须为非负拍数且不超出工程`);
      check(number(note.duration, 0.0625, project.bars * 4), `${np}.duration 必须至少为 0.0625 拍`);
      check(note.start + note.duration <= project.bars * 4 + 1e-9, `${np} 的结束位置超出工程`);
      check(number(note.velocity, 0, 1), `${np}.velocity 必须在 0–1 之间`);
      if (note.articulation !== undefined) {
        check(text(note.articulation, 40) && articulations.has(note.articulation), `${np}.articulation 必须为当前乐器声明的奏法 ID，长度为 1–40 字符`);
      }
    });
  });
  check(totalNotes <= 100000, '工程最多支持 100000 个音符');
  return errors;
}
