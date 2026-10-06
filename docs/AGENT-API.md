# XSXB-Band：给 Agent / 本地 AI 的编曲接口

这是一台本地可编辑采样器工作站。AI 阅读乐谱 JSON，按用户要求写入音符；浏览器负责编辑、试听与导出。没有内置音乐模型，也不会把创作要求发给外部 AI 服务。

## 启动与连接

工程目录运行 `npm install`（仅首次），然后 `npm run build`、`npm start`。以后可双击 `start.bat`；已有构建时不会重新安装或构建。开发模式用 `npm run dev`。

默认服务是 `http://127.0.0.1:4318`。服务仅监听本机，可通过 `PORT` 环境变量换端口。CLI 可通过 `KLEIN_URL` 选择本机服务。没有 API 密钥。所有写请求必须使用 `Content-Type: application/json`；浏览器写入必须同源，本地 CLI 可以不带 Origin。Host 只接受 `127.0.0.1`、`localhost` 或 `[::1]`。

## 推荐工作流程

1. `node scripts/agent.mjs request list` 阅读待办请求。
2. `node scripts/agent.mjs state` 读取当前乐谱及 `revision`。
3. `node scripts/agent.mjs library` 查阅允许的音色 ID、采样 MIDI、CC0 来源、原始下载链接与 `installed`。
4. 在临时 JSON 文件中修改 `project`，保留读取时的 `revision`。
5. `node scripts/agent.mjs apply <file.json>` 原子写入整个工程。返回新的版本与工程。
6. 只有写入成功且用户要求已完成后，运行 `node scripts/agent.mjs request complete <id>`。

发生 HTTP 409 时，读取响应里的当前 `revision` 和 `project`，结合用户最新修改重新编曲。**不要直接换上新版本号重发旧工程**，否则会覆盖用户在钢琴卷帘里的编辑。

保存的 JSON 外壳示例：

```json
{
  "revision": 1,
  "project": {
    "schemaVersion": 1,
    "id": "my-song",
    "title": "纸飞机",
    "bpm": 96,
    "key": "C major",
    "bars": 4,
    "timeSignature": [4, 4],
    "updatedAt": "2026-10-04T12:00:00.000Z",
    "tracks": [{
      "id": "piano-1",
      "name": "钢琴旋律",
      "instrumentId": "piano",
      "color": "#002FA7",
      "volume": 0.8,
      "pan": 0,
      "muted": false,
      "solo": false,
      "notes": [
        {"id": "n-1", "midi": 60, "start": 0, "duration": 1, "velocity": 0.75},
        {"id": "n-2", "midi": 64, "start": 1, "duration": 0.5, "velocity": 0.7}
      ]
    }]
  }
}
```

## 乐谱单位与约束

| 字段 | 含义与限制 |
| --- | --- |
| `schemaVersion` | 固定为 `1` |
| `id` | 工程、音轨、音符使用 1–80 位字母、数字、`_` 或 `-` |
| `title` | 1–160 字符 |
| `bpm` | 40–240，可为小数 |
| `bars` | 1–64 小节的整数；当前为 4/4 拍 |
| `key` | 1–60 字符的文字标签，例如 `C major`，不自动限制音符 |
| `tracks` | 最多 32 条；音轨 ID 互不重复 |
| `instrumentId` | 必须来自 `/api/library` 的乐器条目（`kind` 为 `instrument` 或省略），不能用 `kind:"cabinet"` 的箱体 IR；允许使用尚未下载的乐器；渲染和打开工程时会自动下载 |
| `articulation` | 可选的轨道默认奏法；1–40 字符的非空字符串，必须为当前乐器 `articulations[].id` 中的值 |
| `color` | `#RRGGBB` 六位十六进制颜色 |
| `volume` / `pan` | 音轨音量 0–1，声像 -1（左）到 +1（右） |
| `release` | 可选，旋律乐器收音尾音，0.005–2 秒；省略沿用音源默认值，鼓件保持自然衰减 |
| `reverb` | 可选，发送到共享房间混响的量，0–1；省略或 0 为干声。混响是固定种子生成的厅堂响应，播放与导出结果一致。常用起点：鼓 0.08–0.15，吉他 0.1–0.2，弦乐/铜管/民乐 0.25–0.45 |
| `humanize` | 可选，演奏人性化，0–1；按音轨与音符 ID 固定生成细微的起点（最多 ±12 ms）、力度（±8 %，可能因此切换真实力度层）与音准（±4 音分）变化，每次播放和导出一致；省略为严格网格 |
| `muted` / `solo` | 布尔值 |
| `effects` | 可选效果器对象；省略时不添加效果器 |
| `effects.enabled` | 整条效果链的开关，布尔值；关闭时绕过前级、箱体和效果器输出调整 |
| `effects.drive` / `effects.tone` | 失真强度与音色参数，分别为 0–1 |
| `effects.mix` / `effects.output` | 干湿混合比例与效果器输出，分别为 0–1 |
| `effects.ampModel` | 可选，`"none"` 或省略使用原有 Tuna 过载；`"high-gain"` 使用 AmpSim3 高增益前级；`"nam"` 使用 NAM 神经网络箱头，此时必须提供 `namModelId` |
| `effects.namModelId` | 可选，必须对应音色库中 `kind:"amp-model"` 的条目（当前 `nam-5150-boosted`、`nam-6505-red-mxr`、`nam-jcm2000-crunch`、`nam-jcm2000-clean`）；这些模型只录箱头，通常再配 `cabinetId` |
| `effects.cabinetId` | 可选，必须对应音色库中 `kind:"cabinet"` 的箱体 IR ID；可以与 `ampModel:"none"` 独立搭配 |
| `notes[].midi` | MIDI 音高整数 0–127；60=C4，69=A4（440 Hz） |
| `notes[].start` | 从工程开头起算的四分音符拍数，第一拍为 0；小节 2 起点为 4 |
| `notes[].duration` | 四分音符拍数，至少 0.0625；1=四分音符，0.5=八分音符，0.25=十六分音符 |
| `notes[].velocity` | 力度 0–1；0 表示无声 |
| `notes[].id` | 同一音轨内唯一，不同音轨可重复 |
| `notes[].articulation` | 可选，覆盖轨道默认奏法；约束同轨道 `articulation`，按该音轨的乐器清单校验 |
| `updatedAt` | 合法日期字符串；服务器在成功保存时写入当前 ISO 时间 |

每个音符必须满足 `start >= 0` 且 `start + duration <= bars * 4`。允许和弦与重叠音符，不强制量化。每条轨最多 32,768 个音符，每个工程最多 100,000 个；单个 HTTP JSON 请求不超过 8 MB。鼓轨也使用 MIDI 音符；单采样打击音色的实际播放方式由播放器处理。

可调吉他效果器使用 `effects: {"enabled":true,"drive":0.6,"tone":0.5,"mix":0.5,"output":0.75}`。添加该对象时必须提供上述五项。参数会随乐谱保存；更新已有工程时应保留用户的效果器设置，除非创作要求涉及音色调整。

电吉他可以另外指定 `effects.ampModel:"high-gain"` 和 `effects.cabinetId`；箱体 ID 要从音色库的 `kind:"cabinet"` 条目读取，当前为 `cab-v30-sm57`、`cab-dv77-sm57`。箱体 IR 是卷积处理用的录音响应文件，不能直接编写音符。`ampModel:"none"` 或省略表示选择原有 Tuna 过载，仍可搭配箱体，不能把这个值理解成整条效果链直通；直通使用 `effects.enabled:false`。这些字段与既有的五项旋钮/开关和轨道 `release` 同时保存。AmpSim3 与 Tuna 都是 MIT 开源算法移植，箱体 IR 为 CC0，详细来源见 [AMP-SOURCES.md](AMP-SOURCES.md)。

轨道和单音符都可以指定真实采样奏法：当前 `metal-guitar` 支持 `sustain` 与 `staccato`，例如设置 `track.articulation:"staccato"` 后，个别延音另写 `note.articulation:"sustain"`。优先级是音符、轨道、音色 `defaultArticulation`、音色声明的第一种奏法。`staccato` 是独立录制的短奏，当前没有 `palm-mute` 掌根闷音采样。不要凭空编造奏法 ID。更换音色时，需要清除或改写新音色不支持的轨道、音符奏法。省略这些字段的旧乐谱继续有效。

当前库有 42 种可演奏乐器、2 个箱体与 4 个 NAM 箱头模型（以实时 `/api/library` 为准）。嘻哈可用 `tr808-kick`（hit/long）、`tr808-snare`（hit/snappy）、`tr808-clap`、`tr808-hihat`（closed/open-short/open）、`tr808-perc`（rim/cowbell/clave/maracas）与旋律轨 `tr808-bass`（sub/punch，根音 31，无滑音）；`rock-hihat` 有 `open`，`rock-snare` 有 `rimshot`/`crossstick`；和声色彩可用 `fm-piano`（TX81Z FM 电钢琴，不是 Rhodes）、`vibraphone`（soft/hard）、`kalimba`、`tenor-sax`（sustain/vibrato/staccato）。见 [HIPHOP-SOURCES.md](HIPHOP-SOURCES.md)。管弦与影视可用 `strings`（小提琴组：sustain/spiccato/pizzicato/tremolo）、`cello-section`、`harp`、`flute`（sustain/sustain-nv/staccato）、`french-horn`、`trumpet`、`trombone`、`timpani`、`gong`；民乐色彩可用 `dan-tranh`（越南筝，不是古筝录音；pluck/vibrato/tremolo）、`dizi`（实录根音 77–91）、`erhu`（62–86）；失真主奏优先 `emily-guitar`（实心琴直录）接 NAM 与箱体。来源与限制见 [REALISM-SOURCES.md](REALISM-SOURCES.md)。`bass` 是原有低音提琴；需要拨片电贝斯时选 `electric-bass`。新增 `rock-kick`、`rock-snare`、`rock-hihat`、`rock-tom`、`rock-crash` 是分层架子鼓，原有基础鼓件继续保留。编曲应依据清单中的根音范围与力度层，而不是仅靠提高轨道音量。

## HTTP 接口

| 方法和路径 | 请求 / 响应 |
| --- | --- |
| `GET /api/health` | `{ok:true,name,version}` |
| `GET /api/state` | `{revision,project}` |
| `PUT /api/state` | 请求 `{baseRevision,project}`；成功返回新 `{revision,project}`；过期版本返回 `409 {error,revision,project}`；校验失败返回 `400 {error,issues}` |
| `GET /api/library` | 乐器与箱体 IR 数组，每项保留 manifest 所有字段并加 `installed:boolean` |
| `GET /api/license-doc` | 查看本项目收录音色的来源、许可与下载清单说明（纯文本 Markdown） |
| `POST /api/instruments/ensure` | 请求 `{project}` 或 `{ids:[...]}`；下载工程用到的全部乐器、箱体 IR 和 NAM 模型（或指定 ID），完成后返回 `{instruments:[{id,installed,error?}]}`；有失败时 `502` 并带 `error`。CLI：`node scripts/agent.mjs install <工程JSON>` |
| `POST /api/instruments/:id/download` | 请求 `{}`；下载单个乐器、箱体 IR 或 NAM 模型的所有文件；返回 `{id,installed:true}`；上游错误返回 `502 {error}` |
| `GET /samples/:instrument/:file` | 读取已经下载的本地采样；不存在返回 404，不自动下载 |
| `GET /api/requests` | 请求数组，每项 `{id,prompt,status,createdAt,updatedAt}` |
| `POST /api/requests` | 请求 `{prompt}`，1–4000 字符；返回 201 和新请求，初始 `status:"pending"` |
| `PATCH /api/requests/:id` | 请求 `{status:"done"}` 或 `{status:"pending"}`；返回更新后的请求 |

用户在界面提交创作要求只会进入本机请求队列，Agent 需要主动读取。服务不会在后台调用 AI，也不会假装已完成编曲。

## 歌曲库

所有歌曲保存在 `data/songs/<project.id>.json`（`{createdAt, savedAt, project}`）。正在编辑的工程（`/api/state`）每次保存都会同步到同 ID 的歌曲，所以切换歌曲不会丢失内容。网页右上角“我的歌曲”可以打开、改名、复制、新建与删除；删除会移到 `data/songs/.trash/`，可手动找回。

| 方法和路径 | 请求 / 响应 |
| --- | --- |
| `GET /api/songs` | 歌曲摘要数组：`{id,title,key,bpm,bars,seconds,tracks,notes,instruments,createdAt,updatedAt,active}`，正在编辑的排在最前 |
| `GET /api/songs/:id` | `{createdAt,savedAt,project}` |
| `PUT /api/songs/:id` | 请求 `{project}`，`project.id` 必须等于 `:id`；新建或替换一首**未打开**的歌曲。目标是正在编辑的歌曲时返回 409，请改用 `PUT /api/state` |
| `POST /api/songs/:id/open` | 请求 `{}`；把这首歌载入编辑器，返回新的 `{revision,project}`。网页会在 2 秒内自动载入（有未保存修改时除外） |
| `POST /api/songs/:id/duplicate` | 请求 `{}` 或 `{title}`；复制为新 ID |
| `PATCH /api/songs/:id` | 请求 `{title}`；改名。改的是正在编辑的歌曲时，响应额外带 `state` |
| `DELETE /api/songs/:id` | 请求 `{}`；移到回收站。正在编辑的歌曲不能删除（409） |
| `POST /api/songs` | 请求 `{}` 或 `{title}`；新建空白歌曲（不打开） |

为用户另做一首新歌时，优先用 `PUT /api/songs/:id` 保存为新歌曲，不要覆盖用户正在编辑的工程；需要直接试听时再 `open`。CLI：`node scripts/agent.mjs song list | song save <file> | song open <id>`。

## 音源下载与开源发布

`public/library.json` 是可信下载清单。每个采样保留 `downloadUrl` 原始 HTTPS 地址，`url` 是 `/samples/<音色>/<文件>` 本地缓存地址，当前使用 `.wav`、`.flac`，少量 Freesound 公开试听 `.mp3`，以及 `.nam` 箱头模型（JSON），`bytes` 与可选 `sha256` 用于校验。来源页面和许可链接（乐器为 CC0，NAM 模型为 GPL-3.0）留在每个条目的 `sourceUrl`、`licenseUrl` 字段中。乐器链接固定到 Git commit，箱体镜像按已与作者原始 ZIP 核对的 SHA-256 固定内容。

清单的 `kind` 可为 `instrument` 或 `cabinet`，省略表示普通乐器。`articulations` 是 `{id,name}` 数组，`defaultArticulation` 指定默认奏法。`attack` / `release` 是乐器包络秒数，`volumeDb` 是乐器整体播放增益。箱体 IR 同样使用 `samples` 数组及可信下载链路，固定 `midi:60` 仅用于统一资源格式，不代表其是可演奏音符。

| 采样元数据 | 播放含义 |
| --- | --- |
| `articulation` | 此录音的真实奏法 ID |
| `velocityMin` / `velocityMax` | 0–1 力度范围，先在对应根音的真实层之间选样 |
| `roundRobin` | 独立录音轮替编号；没有 RR 的连续力度层仍标为 1 |
| `gainDb` | 该录音的附加 dB 增益，与乐器 `volumeDb` 相加 |
| `offsetSeconds` | 从原始录音起点跳过的秒数，不改写缓存文件 |
| `tuneCents` | 额外音分调音，100 音分为一个半音 |
| `velocityTracking` | `false` 时不再按 MIDI 力度衰减采样幅度；仍按力度选择录音层 |
| `velocityReference` | 达到录音原始振幅的参考力度，用于该层内的幅度调整 |

这些是静态清单中的播放器元数据，服务原样返回；AI 在乐谱中设置 `velocity` 与 `articulation`，不需要把采样字段复制到 `project`。当前分层军鼓和嗵鼓使用 `velocityTracking:false`，避免把真实弱奏重复压低。播放器在同奏法内选择最近根音、匹配力度层（间隙取最近层）、再轮替独立录音。具体录音与 SFZ 依据见 [METAL-SAMPLE-LICENSES.md](METAL-SAMPLE-LICENSES.md)。

**仓库和发布包不包含第三方音频，包括箱体 IR。** 只下载用得到的音源：服务启动时以及每次写入、打开工程后，在后台下载当前工程所需的音源（环境变量 `KLEIN_AUTO_DOWNLOAD=0` 可关闭）；渲染脚本和 `ensure` 会等待下载完成；网页音源库也可手动下载。文件保存在 `data/samples/`；已有文件跳过，同一音色的并行请求共用一次下载。下载使用固定清单、拒绝任意请求 URL 和重定向、每个文件上限 40 MiB / 90 秒，临时文件校验成功后原子替换。不删除成功下载的采样来重试失败项。

AI 应保留现有音轨 ID 与音符 ID（除非删除或新增），只按用户本次要求修改乐谱。不要代替用户批量下载整个音源库；只下载当前工程用到的音源。

本地工程与请求分别保存在 `data/project.json`、`data/requests.json`。这些是用户数据，发布时排除整个 `data/`。故障或 JSON 损坏时服务会报错并保留原文件，不静默重置。
