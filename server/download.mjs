import { mkdir, open, rename, unlink, stat, readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

const MAX_BYTES = 40 * 1024 * 1024;
const TIMEOUT_MS = 90000;

export function samplePath(samplesRoot, url) {
  // A local manifest owns these paths. Never accept a filesystem path from an HTTP body.
  if (typeof url !== 'string' || !/^\/samples\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.(wav|ogg|mp3|flac|nam)$/.test(url)) {
    throw new Error('音源清单含无效的本地路径');
  }
  const resolved = path.resolve(samplesRoot, url.slice('/samples/'.length));
  const relative = path.relative(path.resolve(samplesRoot), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('音源路径越界');
  return resolved;
}

export async function sampleInstalled(filename, sample) {
  try {
    const info = await stat(filename);
    return info.isFile() && info.size > 0 && (!sample.bytes || info.size === sample.bytes);
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function validAudioHeader(header, extension) {
  if (extension === '.wav') return header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WAVE';
  if (extension === '.ogg') return header.subarray(0, 4).toString() === 'OggS';
  if (extension === '.flac') return header.subarray(0, 4).toString() === 'fLaC';
  // Neural Amp Modeler files are JSON documents.
  if (extension === '.nam') return header.toString('utf8').trimStart().startsWith('{');
  return header.subarray(0, 3).toString() === 'ID3' || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
}

/** Downloads one manifest-owned URL, using a same-directory temporary file and an atomic rename. */
export async function downloadSample(sample, filename, { fetchImpl = fetch, maxBytes = MAX_BYTES, timeoutMs = TIMEOUT_MS } = {}) {
  const upstream = new URL(sample.downloadUrl);
  if (upstream.protocol !== 'https:' || upstream.username || upstream.password || upstream.port || upstream.hostname === 'localhost' || /^[\d.]+$/.test(upstream.hostname) || upstream.hostname.includes(':')) {
    throw new Error('音源清单仅允许公共 HTTPS 下载地址');
  }
  if (sample.bytes && sample.bytes > maxBytes) throw new Error('单个音源超出下载大小限制');
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  let file;
  let response;
  try {
    response = await fetchImpl(upstream, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'XSXB-Band/1.0 (CC0 sample download)' } });
    if (!response.ok || !response.body) throw new Error(`上游下载失败（HTTP ${response.status}）`);
    const contentLength = Number(response.headers.get('content-length'));
    if (contentLength > maxBytes) throw new Error('单个音源超出下载大小限制');
    file = await open(temporary, 'wx');
    let size = 0;
    const hash = createHash('sha256');
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > maxBytes) throw new Error('单个音源超出下载大小限制');
      hash.update(chunk);
      await file.write(chunk);
    }
    await file.close();
    file = null;
    if (size < 12 || (sample.bytes && size !== sample.bytes)) throw new Error('音源下载不完整，文件大小校验失败');
    if (sample.sha256 && hash.digest('hex') !== sample.sha256.toLowerCase()) throw new Error('音源校验失败（SHA-256 不一致）');
    const header = (await readFile(temporary)).subarray(0, 12);
    if (!validAudioHeader(header, path.extname(filename).toLowerCase())) throw new Error('下载内容不是预期的音频或模型格式');
    await rename(temporary, filename);
  } finally {
    if (file) await file.close();
    if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}
