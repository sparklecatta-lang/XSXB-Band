import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4318);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须为 1–65535 的整数');
// The active project's instruments download in the background; KLEIN_AUTO_DOWNLOAD=0 turns that off.
const { app, close } = await createApp({ root, dev: process.argv.includes('--dev'), autoDownload: process.env.KLEIN_AUTO_DOWNLOAD !== '0' });
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`XSXB-Band 已启动：http://127.0.0.1:${port}`);
  console.log('工程用到的音源会自动下载到 data/samples/；按 Ctrl+C 停止。');
});
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用；现有服务可能已启动。可设置 PORT 使用其他端口。` : error);
  process.exitCode = 1;
  void close();
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(async () => { await close(); process.exit(0); });
  server.closeIdleConnections();
});
