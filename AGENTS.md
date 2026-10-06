# XSXB-Band · 给 Agent 的说明

本仓库是一个本地编曲工作室和配套 skill。Agent 写乐谱（JSON），工作室用真实录音的乐器演奏、混音和导出。仓库不含任何音频；音源在用到时从作者的原始地址下载。

## 安装（用户把仓库地址交给你时）

1. 克隆仓库，确认 Node.js 22.12 或以上（推荐 24 LTS）。
2. 在仓库根目录运行 `npm ci`、`npm run build`、`npm test`。
3. 启动服务：`npm start`（Windows 可双击 `start.bat`，后台启动用 `Start-Process -WindowStyle Hidden`）。服务只监听 `http://127.0.0.1:4318`，端口被占用时设置 `PORT`。
4. 安装 skill：把 `skills/xsxb-band/` 整个复制到你的 skills 目录（Claude Code：`~/.claude/skills/xsxb-band/`；Codex：`~/.codex/skills/xsxb-band/`；其他 Agent 按其约定），并在复制后的目录里新建 `studio-path.txt`，第一行写本仓库的绝对路径。
5. 渲染还需要 Chrome / Edge，或 `npx playwright install chromium`。
6. 安装完成后告诉用户：工作室地址、skill 名称 `xsxb-band`，以及“直接描述想要的音乐即可”。不要预先下载整个音源库。

## 编曲时

- 先读 `docs/AGENT-API.md`，再 GET `/api/state` 与 `/api/library`。乐谱以四分音符为一拍，从 0 开始，MIDI 60 = C4。
- 新曲用 `node scripts/agent.mjs song save` 存进歌曲库再 `song open`；改当前曲用 `apply`（`PUT /api/state` + 读取时的 `baseRevision`），409 时重新读取并合并。不要直接编辑 `data/project.json`。
- 渲染用 `skills/xsxb-band/scripts/render.mjs`。工程用到但本机没有的音源会自动下载并校验 SHA-256；也可以 `node scripts/agent.mjs install <工程JSON>` 先下载。服务启动后，当前打开的工程所需音源也会在后台下载（`KLEIN_AUTO_DOWNLOAD=0` 可关闭）。
- 你听不见：用渲染报告（峰值、逐秒峰值、削波帧、分轨电平）调平衡，交付真实音频让用户判断。

## 音源与许可

- 下载链接只来自 `public/library.json`，缓存在 `data/samples/`（已被 Git 忽略）。绝不把 WAV / FLAC / MP3、NAM 模型或缓存放进 `public/`、`src/`、`dist/` 或提交到仓库。
- 新乐器录音必须有明确的 CC0 依据；箱头模型等效果资源可用允许使用的开放许可（如 GPL-3.0），须保留作者与许可链接、只按需下载。每个新文件都要记录来源页、许可页、固定版本下载地址、大小、SHA-256 和实测 MIDI 根音，并更新 `docs/SAMPLE-LICENSES.md`。

## 修改程序

- React + TypeScript + Vite，Express 本地服务。播放与效果在 `src/audio.ts`、`src/effects.ts`，数据契约在 `src/types.ts`，服务校验在 `server/validation.mjs`。改数据格式时同步客户端导入校验、服务校验、API 文档。
- 构建 `npm run build`，测试 `npm test`。
- 除非用户要求，不截图、不做画面审美验收。保留米白与克莱因蓝主色和真实可操作的音符 / 鼓机交互。
