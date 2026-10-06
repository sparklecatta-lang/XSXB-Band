#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const base = process.env.KLEIN_URL || `http://127.0.0.1:${process.env.PORT || 4318}`;
const endpoint = new URL(base);
if (endpoint.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('KLEIN_URL 必须是本机 HTTP 服务地址');

async function api(route, method = 'GET', body, timeoutMs = 15000) {
  const response = await fetch(new URL(route, endpoint), {
    method,
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const result = await response.json();
  if (!response.ok) {
    console.error(JSON.stringify(result, null, 2));
    throw new Error(`API 请求失败（HTTP ${response.status}）${response.status === 409 ? '：请重新读取工程并合并修改，禁止盲目重试覆盖。' : ''}`);
  }
  return result;
}

const [command, action, argument, ...rest] = process.argv.slice(2);
const usage = `XSXB-Band · AI 编曲接口

  node scripts/agent.mjs state               读取工程和 revision
  node scripts/agent.mjs library             读取音色、CC0 原始链接及下载状态
  node scripts/agent.mjs install <file.json>  下载工程用到的全部音源（也可写音色 ID：install piano erhu）
  node scripts/agent.mjs apply <file.json>    应用 {revision,project} 或 {baseRevision,project}
  node scripts/agent.mjs request list        读取用户创作请求
  node scripts/agent.mjs request complete ID 标记请求已完成
  node scripts/agent.mjs song list           列出歌曲库（* 为正在编辑）
  node scripts/agent.mjs song save <file.json> 把 {project} 存为歌曲库中的一首（不打开、不覆盖正在编辑的歌）
  node scripts/agent.mjs song open ID        在网页编辑器中打开歌曲库里的一首

服务地址：${base}（可设置 KLEIN_URL 或 PORT）
音符位置和长度以四分音符拍为单位，MIDI 60 = C4。详见 docs/AGENT-API.md。`;

try {
  let result;
  if (command === 'state') result = await api('/api/state');
  else if (command === 'library') result = await api('/api/library');
  else if (command === 'install' && action) {
    const ids = [action, argument, ...rest].filter(Boolean);
    const body = ids.length === 1 && ids[0].endsWith('.json')
      ? { project: (({ project, ...plain }) => project ?? plain)(JSON.parse((await readFile(ids[0], 'utf8')).replace(/^﻿/, ''))) }
      : { ids };
    const { instruments } = await api('/api/instruments/ensure', 'POST', body, 30 * 60 * 1000);
    for (const item of instruments) console.log(`${item.installed ? '✓' : '✗'} ${item.id}${item.error ? `  ${item.error}` : ''}`);
  }
  else if (command === 'apply' && action) {
    const source = JSON.parse((await readFile(action, 'utf8')).replace(/^\uFEFF/, ''));
    const baseRevision = source.baseRevision ?? source.revision;
    if (!Number.isInteger(baseRevision) || !source.project) throw new Error('文件必须包含读取时的 revision（或 baseRevision）和 project，不能省略并发版本号');
    result = await api('/api/state', 'PUT', { baseRevision, project: source.project });
  } else if (command === 'request' && action === 'list') result = await api('/api/requests');
  else if (command === 'song' && action === 'list') {
    const songs = await api('/api/songs');
    for (const song of songs) console.log(`${song.active ? '*' : ' '} ${song.id}  ${song.title}  ${song.bpm} BPM · ${song.bars} 小节 · ${song.tracks} 轨`);
  } else if (command === 'song' && action === 'save' && argument) {
    const source = JSON.parse((await readFile(argument, 'utf8')).replace(/^\uFEFF/, ''));
    const project = source.project ?? source;
    result = await api(`/api/songs/${encodeURIComponent(project.id)}`, 'PUT', { project });
  } else if (command === 'song' && action === 'open' && argument) result = await api(`/api/songs/${encodeURIComponent(argument)}/open`, 'POST', {});
  else if (command === 'request' && action === 'complete' && argument) result = await api(`/api/requests/${encodeURIComponent(argument)}`, 'PATCH', { status: 'done' });
  else {
    console.log(usage);
    if (command && !['help', '--help', '-h'].includes(command)) process.exitCode = 1;
  }
  if (result !== undefined) console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message === 'fetch failed' ? `无法连接 ${base}，请先启动 XSXB-Band（npm start）。` : error.message);
  process.exitCode = 1;
}
