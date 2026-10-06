# 真实感升级：新增与补全的音源、箱头模型和引擎功能

核查日期：2026-10-05。本轮目标是减少“像 MIDI / 像模拟”的听感：补全多力度、多轮替、更密的真实录音；加入共享房间混响、演奏人性化和 NAM 神经网络箱头。生成清单的研究脚本与逐文件报告在本机 `data/research/realism-2026-10/`（不随源码分发）。

目录合计：32 种乐器、2 个箱体 IR、4 个 NAM 箱头模型；1,702 个文件（1,585 WAV、96 FLAC、17 MP3、4 NAM），全部下载约 1,148 MiB。

## 许可政策变化（用户已确认）

- 乐器录音仍以 **CC0** 为准。
- 箱头模型允许**非 CC0 但允许使用的开放许可**，须保留作者与许可链接，并且只按需下载到本机、不随软件分发。本轮四个 NAM 模型来自 GPL-3.0 社区仓库（见下）。
- Freesound 的原始 WAV 需要登录才能下载；本轮笛子与二胡使用 Freesound **公开试听版（有损 MP3，约 128 kbps）**，在乐器说明中标注。登录后下载原始文件可替换为无损版本。

## 补全与新增的乐器

所有音高均经实测：ffmpeg 解码后用 YIN 基频检测比对文件名。VSCO-2 CE 与越南筝文件名的八度编号比标准 MIDI 记法低一个八度（例如 `G2` 实际为 G3），已逐组按多数实测结果校正。检测置信度低的个别文件（短促拨弦、低音铜管短奏）沿用同音其他力度层已验证的音名。

| ID | 来源（固定版本） | 文件 | 奏法 | 根音范围 | 力度 / 轮替 | 备注 |
| --- | --- | ---: | --- | --- | --- | --- |
| `strings`（替换） | VSCO-2 CE 小提琴组 | 131 | 揉弦长音、跳弓、拨弦、震音 | 55–86 | 2 层 / 短奏 2 RR | 原 6 个单层文件扩充 |
| `cello-section` | VSCO-2 CE 大提琴组 | 156 | 同上 | 36–77 | 2 层 / 2 RR | 新增 |
| `harp` | VCSL Concert Harp | 45 | 拨奏 | 28–101 | 2 层 | 10 个文件做音分校正 |
| `flute`（替换） | VSCO-2 CE 长笛 | 80 | 揉音长音、无揉音长音、吐音短奏 | 60–96 | 至多 4 层 / 2 RR | 原 8 个单层文件扩充 |
| `french-horn` | VSCO-2 CE 圆号 | 83 | 长音、短奏 | 33–77 | 至多 4 层 / 2 RR | 新增 |
| `trumpet` | VSCO-2 CE 小号 | 86 | 长音、短奏 | 53–84 | 2–3 层 / 2 RR | 新增 |
| `trombone` | VSCO-2 CE 次中音长号 | 87 | 长音、短奏 | 34–65 | 至多 4 层 / 2 RR | 新增 |
| `marimba`（替换） | VCSL Marimba | 30 | 敲击 | 41–96 | 3 层 | 原 8 个单层文件扩充 |
| `timpani` | VCSL Timpani 1 | 30 | 单击 | 42–55 | 3 层 / 2–4 RR | 五面鼓音高见下 |
| `gong` | VCSL Gong 1 | 6 | 敲击 | — | 5 层 | 打击乐，自然长尾 |
| `emily-guitar` | Karoryfer Emilyguitar | 216 | 拨弦延音 | 37–86 | 4 层 / 3 RR | Epiphone 实心琴双拾音器直录（DI），适合接 NAM；无掌根闷音 |
| `dan-tranh` | VCSL Dan Tranh | 96 | 拨弦、揉弦、摇指 | 47–83 | 拨弦 3 层、揉弦 2 层 | **越南筝**，与古筝同属筝类，不是古筝录音；五声定弦（B C# D# F# G#），23 个拨弦/摇指文件做音分校正 |
| `dizi` | Freesound · Hypnotriod（CC0） | 8 | 长音 | 77–91 | 单层 | C 调笛高音区；仅收录原包自然音，作者移调生成的半音不收；低于 F5 的音需向下移调 |
| `erhu` | Freesound · tarane468（CC0） | 9 | 长音 | 62–86 | 单层 | D4–D6 每小三度一个音 |

来源与许可：VSCO-2 CE [`440300901dfe…`](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/LICENSE)（CC0）；VCSL [`c1ea7bcc3c73…`](https://github.com/sgossner/VCSL/blob/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/LICENSE)（CC0）；Karoryfer Emilyguitar [`b4920dc662fd…`](https://github.com/sfzinstruments/karoryfer.emilyguitar/blob/b4920dc662fd9cad6dcaccdeecffdd91c8725d8c/LICENSE)（CC0；作者 readme：D. Smolken 演奏与映射，双拾音器直录）；Freesound [Hypnotriod 笛子包](https://freesound.org/people/Hypnotriod/packs/21613/) 与 [tarane468 二胡包](https://freesound.org/people/tarane468/packs/26451/)，每个声音页面均核实为 CC0 1.0，清单保留各自 `sourcePage`。

### 调音校正

拨弦/敲击类录音（筝、竖琴、电吉他）在实测偏差 12–70 音分时写入 `tuneCents` 校正，原文件不改。揉弦、乐团长音不校正，因为音高起伏本身是演奏表现。

### 定音鼓音高

YIN 对定音鼓不可靠，改用频谱：取主音（1,1 模态），并以约 1.5 倍处的 (2,1) 模态佐证。五面鼓实测主音约为 MIDI 41.50、46.80、49.61、52.53、54.68，分别映射到 42、47、50、53、55 并写入 +50、+20、+39、+47、+32 音分校正。

### 电平

新乐器的 `volumeDb` 按最强力度层前 1.5 秒的中位 RMS 校准到约 −18 dBFS（经引擎 0.55 的单音增益后），上限 24 dB。

## NAM 神经网络箱头

- 引擎：[neural-amp-modeler-wasm](https://github.com/tone-3000/neural-amp-modeler-wasm) 2.0.1，MIT，Copyright (c) 2026 TONE3000。核心为 [NeuralAmpModelerCore](https://github.com/sdatkinson/NeuralAmpModelerCore)（MIT，Copyright (c) 2023 Steven Atkinson），内部依赖 Eigen（MPL-2.0）与 nlohmann/json（MIT）。只引入框架无关的 `engine` 部分：`src/vendor/nam/engine.js` 与 `public/nam/nam-worklet.js`、`public/nam/nam-engine.wasm`（SHA-256 `e452148108c6d972cfa1ca0f218bdb0554d72ab80cc2985bbd80442ec6e0ed00`）。
- 模型：来自 [pelennor2170/NAM_models](https://github.com/pelennor2170/NAM_models/tree/944ca6718581c60cc5365586d2f378d740e181f3)，固定提交 `944ca671…`，仓库声明 **GPL-3.0**（[COPYING](https://github.com/pelennor2170/NAM_models/blob/944ca6718581c60cc5365586d2f378d740e181f3/COPYING)）。作者署名取自文件名：Helga B（5150 Boosted、6505+ Red MXR）、Tim R（JCM2000 Crunch / Clean）。
- 频谱实测 5150 模型 6–10 kHz 能量较强（−11.7 dB，相对总能量），属于只录箱头、不含音箱的捕获，应搭配箱体 IR；接 V30 IR 后同频段降到 −28.7 dB。
- **输入电平（2026-10-05 修正）**：送入 NAM 的信号会先抵消乐器的 `volumeDb` 听感校准，使模型看到原始直录电平（Karoryfer 两把吉他的原始峰值约 −10 至 −13 dBFS）。此前 `emily-guitar`（`volumeDb` +13.4）以超过 0 dBFS 的电平进入模型，主奏听感像喇叭破音；驱动旋钮在原始电平上再做 ±12 dB。NAM 前另有 80 Hz 高通收紧低频。
- 这些旧模型没有响度元数据；目录中的 `volumeDb` 为在原始直录电平下实测的补偿增益（5150 +23.9 dB、6505+ +19.8、Crunch +9.5、Clean +21.0），使同一乐句经 V30 IR 时输出约 −16.5 dBFS RMS，与 AmpSim3 接近。高增益模型在输入降低 13 dB 后输出几乎不变，说明其本身已深度饱和。
- 模型训练采样率未声明（NAM 默认 48 kHz）；工作室 WAV 导出为 44.1 kHz，NAM 不做重采样，音色会有细微偏移。

## 引擎新增

- `track.reverb`（0–1）：发送到共享厅堂混响。脉冲响应由固定种子生成（预延迟 16 ms、早期反射、约 2.3 秒衰减、高频衰减更快），不使用第三方录音；混响返回经 160 Hz 低切与 9 kHz 高切。导出时自动多留 2.4 秒尾音。
- `track.humanize`（0–1）：按音轨与音符 ID 固定生成的起点（±12 ms）、力度（±8%）与音准（±4 音分）偏差，三角分布；先于选样执行，因此可能切换到另一真实力度层。
- `effects.ampModel:"nam"` + `effects.namModelId`：每条音轨一个 NAM 实例；驱动旋钮调整模型输入 −12 到 +12 dB，明暗为 250 Hz / 2.5 kHz 倾斜均衡。离线导出在时间 0 挂起渲染器后加载模型，再恢复渲染。

## 实时播放：NAM 冻结（2026-10-05）

每个 WaveNet 箱头约占实时算力的 30%（实测：1 条 0.31、2 条 0.47、4 条 1.16 倍实时）。浏览器里所有 AudioWorklet 共用一条实时音频线程，3 条以上 NAM 轨会断音，听感像喇叭破音；离线导出不受影响。

现在网页播放会“冻结” NAM 轨：每 6 秒一段，先离线渲染直录信号（采样、输入电平、80 Hz 高通），再交给 `public/nam/nam-worker.js` 的 Web Worker 池运行同一个 NAM wasm（核心数减 2，最多 6 个并行）。每段带 0.3 秒预热、末尾 20 ms 交叉淡化；相邻段接缝处差异低于信号 100 dB 以上。播放头之后两段持续预渲染，结果按音符与参数缓存。箱体、明暗、输出、音量、声像与混响仍实时生效；驱动与模型的改动从之后渲染的段开始生效。NAM 轨的干湿比例请保持 1（冻结时不提供干声）。WAV 导出走同一 Worker 路径，与网页播放一致。

`nam-worker.js` 由 `scripts/build-nam-worker.mjs` 从 `nam-worklet.js` 的 Emscripten 胶水生成，更新 NAM 引擎后需重新生成并构建。
