---
name: xsxb-band
description: "用 XSXB-Band（小宝乐队）本地工作室为用户作曲、编曲、修改音符、调音色，并用真实采样导出 WAV / MIDI。用户想要一段配乐、背景音乐、某种风格的曲子，或要修改工作室里的乐谱和音色时使用；不用于写歌词，也不调用音乐生成模型。"
---

# XSXB-Band · 小宝乐队

你负责写谱和编曲；工作室用真实录音的乐器演奏、混音、保存和导出。乐谱是可编辑的 JSON，用户之后可以在网页钢琴卷帘里继续改。不调用任何音乐生成模型。

## 找到工作室

- 工作室根目录按顺序确定：`--studio` 参数 → 环境变量 `XSXB_BAND_HOME` → 本 skill 目录下 `studio-path.txt` 的第一行 → 本 skill 所在仓库（skill 位于仓库 `skills/xsxb-band/` 时）。都没有时询问用户。
- 默认服务 `http://127.0.0.1:4318`，可用 `--url` 或 `KLEIN_URL` 覆盖。
- 先读工作室的 `AGENTS.md`、`docs/AGENT-API.md`，再获取 `/api/health`、`/api/state`、`/api/library`。以实时服务和清单为准，不沿用聊天里的版本号、曲名或音色数量。
- 服务未运行时在工作室目录启动：首次 `npm ci` 和 `npm run build`，之后 `npm start`（Windows 可双击 `start.bat`；后台启动用 `Start-Process -WindowStyle Hidden`）。服务已可用就复用，不为编曲重启。
- Windows PowerShell 读写中文文档 / JSON 时显式使用 UTF-8。

工作室 CLI（在工作室目录运行）：

```text
node scripts/agent.mjs state | library
node scripts/agent.mjs install <工程JSON>          下载工程用到的全部音源
node scripts/agent.mjs apply <{revision,project} JSON>
node scripts/agent.mjs song list | song save <{project} JSON> | song open <ID>
node scripts/agent.mjs request list | request complete <ID>
```

没有 CLI 的 Agent 直接调用同一 REST API，写请求用 `Content-Type: application/json`。

## 创作和保存

1. 读取当前工程和用户要求。缺少会改变结果的关键信息时再问；风格、长度、修改目标已明确就直接做。编曲方法和音色选择见 [references/composition.md](references/composition.md)。
2. 先把读到的 `{revision,project}` 备份到工作室 `data/compositions/<工作名>/`。
3. 用一小段确定性脚本生成乐谱（保存在同一目录，便于整段重写），只使用清单里的乐器和真实奏法。`kind: cabinet` / `amp-model` 是效果资源，不能建音符轨。
4. 保存：
   - **新曲**：给新的 `project.id`，`song save` 存进歌曲库，再 `song open` 打开。不要覆盖用户正在编辑的歌。
   - **修改当前曲**：`apply`（`PUT /api/state`，带读取时的 `baseRevision`）。409 时重新读取并合并用户的新修改，禁止只换版本号重发。保留未涉及的音轨、音符 ID 和效果参数。
   - 不要直接改运行中服务的 `data/project.json`。
5. 写入后读回核对。用户在网页保存的需求只是队列，做完对应工作后再标记 done。

确有功能缺口时如实说明，不把做不到的演奏技巧伪装成已实现。

## 音符约定

- 4/4 拍，时间单位是四分音符拍数，从 0 开始；MIDI 60 = C4。`duration: 0.25` 是十六分音符，**不是 0.25 秒**。
- 名义时长（秒）= `bars × 4 × 60 / bpm`；WAV 另含自然尾音。1–64 小节、40–240 BPM，音符不能越过工程边界。
- 打击乐按采样根音播放，鼓件一律写 MIDI 60（不要写 GM 鼓号）；MIDI 导出会换成 GM 鼓键。
- `bass` 是低音提琴，`electric-bass` 是拨片电贝斯，`tr808-bass` 是 808 低音（根音 31，无滑音）。`metal-guitar` 有真实 `sustain` / `staccato`，没有掌根闷音。
- 效果链：`ampModel` 省略或 `"none"` 仍有 Tuna 过载；整链旁路用 `enabled:false`；高增益前级 `high-gain`，箱体 ID 从清单选。

## 试听与交付

用同一工作室引擎渲染，不要另写合成器代替真实音源。工程用到但本机还没有的音源，会先由工作室从作者原始地址下载并校验 SHA-256：

```text
node <skill目录>/scripts/render.mjs
node <skill目录>/scripts/render.mjs --project <草案JSON> --stems
```

默认渲染当前工程；`--project` 接受纯 project 或 `{revision,project}`。输出到工作室 `exports/` 下的新目录：`mix.wav`、`score.mid`、`project.json`、`report.json`，`--stems` 另出分轨。需要工作室依赖和 Chrome / Edge 或 Playwright Chromium（`--browser` 可指定）。

你听不见，所以用 `report.json` 判断：全混与每条分轨的峰值、逐秒峰值、削波帧。主旋律被盖住、某轨顶到 0 dBFS、某轨几乎无声，都要回去调音量或力度再渲染。需要调音色或排查声音时读 [references/audio-checks.md](references/audio-checks.md)。非零 PCM 不等于好听；交付真实音频让用户判断，不声称自己听过。

所有第三方录音只留在工作室 `data/samples/`，不放进 skill、源码或发布包。新增音源需要明确的 CC0 证据，并按 `AGENTS.md` 记录来源、许可、固定版本地址、大小和 SHA-256。

交付时给出：工作室地址、曲名、速度与时长、歌曲库 ID、音频路径，以及影响使用的限制。
