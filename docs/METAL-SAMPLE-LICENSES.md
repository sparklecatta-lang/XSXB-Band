# 分层电吉他、电贝斯与架子鼓音源研究

核查日期：2026-10-04。以下 7 个新音色已加入 `public/library.json`，原有音色保留。开源版本使用公开清单和软件内下载入口；本机的 `data/research/` 是核查工作记录，不随源码包分发。

## 已落实的 CC0 音源

| 新音色 ID | 真实录音 | 采样范围与层次 | 文件数 | 原始下载大小 |
| --- | --- | --- | ---: | ---: |
| `metal-guitar` | Karoryfer Black And Green 中黑色 Hofner Club，独立延音和短奏录音 | MIDI 40–59 逐半音；60–86 隔全音。延音 3 个力度层，低中区软层 2 RR、其余层 4 RR；78–86 每层 2 RR。短奏单力度、4 RR | 456 WAV | 145,889,766 B |
| `electric-bass` | Karoryfer Babyblue 五弦实心电贝斯，拨片、桥拾音器 | 实音 MIDI 23–43 隔全音；2 个力度层 × 2 个实际轮替样本 | 44 WAV | 29,109,520 B |
| `rock-kick` | Virtuosity 鼓棒架子鼓，底鼓近距麦克风、响弦关闭 | 4 个力度层 × 4 RR | 16 FLAC | 1,602,090 B |
| `rock-snare` | Virtuosity 军鼓中央敲击，军鼓近距麦克风 | 36 个连续力度层，原库没有此奏法的 RR | 36 FLAC | 3,119,355 B |
| `rock-hihat` | Virtuosity 闭合踩镲，吊顶麦克风 | 4 个力度层 × 4 RR | 16 FLAC | 1,366,330 B |
| `rock-tom` | Virtuosity 高嗵鼓中央敲击，吊顶麦克风 | 16 个连续力度层，原库没有此奏法的 RR | 16 FLAC | 3,351,622 B |
| `rock-crash` | Virtuosity Crash 吊镲，吊顶麦克风 | 3 个力度层 × 4 RR | 12 FLAC | 16,826,619 B |

总计 7 个音色、596 个原始文件、201,265,302 字节（约 191.94 MiB）。所有单文件下载地址固定到 Git commit，包含原始字节数和 SHA-256。音频只保存在 `data/samples/<instrument-id>/<filename>`，没有放入公开构建目录。

### 吉他奏法与录音链的准确边界

`metal-guitar` 的用户可见名称是“电吉他 · 分层短奏”；ID 表示此应用中的用途，不是原作者产品名。短奏来自独立的 `Samples/black/stac/` 文件，延音来自 `Samples/black/ord/`；短奏 **不是已经核实的 palm mute 掌根闷音**，也没有把缩短延音包络称作真实掌根闷音。

[原作者 Black And Green 页面](https://shop.karoryfer.com/pages/free-black-and-green-guitars)说明这是 Gretsch Anniversary 与 Hofner Club 两把空心电吉他；[仓库说明](https://github.com/sfzinstruments/karoryfer.black-and-green-guitars/blob/b3b3249d37dc977a1a297bd2dc053e6d9b6b805c/readme.txt)将录音归于 Brian Wood。作者未在这些文字中详述录音链，因此本项目不宣称已证实这些文件是未经任何放大器处理的 DI。选用的 SFZ 中心声部没有内置失真或箱体模拟；应用的音箱与箱体处理属于另外的播放效果。

另一候选 [Emilyguitar](https://github.com/sfzinstruments/karoryfer.emilyguitar)的作者说明明确是 Epiphone 实心电吉他双拾音器直录，4 力度、3 RR，但它没有独立短奏或掌根闷音采样，因而本轮没有用它替换有真实短奏录音的 Hofner。

### 未纳入的库

Unreal Instruments Standard Guitar 与 Metal-GTX 有相应金属吉他奏法，但**不是 CC0**。[作者使用条款](https://unreal-instruments.wixsite.com/unreal-instruments/about)允许使用音源制作的作品商用，却限制未经授权加工、再分发音源数据。它们没有下载进入本次 CC0 清单，也没有被换标为 CC0。

在本次针对性研究范围内，没有找到同时满足权威 CC0 许可证据、真实掌根闷音、多力度、多轮替和可获取原始单音的完整金属吉他库。此项限制保留在记录中，不以声学模拟冒充已取得的真实奏法。

## 作者与许可记录

| 库 | 作者来源与许可 | 固定版本 |
| --- | --- | --- |
| Black And Green Guitars | [原作者页面](https://shop.karoryfer.com/pages/free-black-and-green-guitars)、[CC0 LICENSE](https://github.com/sfzinstruments/karoryfer.black-and-green-guitars/blob/b3b3249d37dc977a1a297bd2dc053e6d9b6b805c/LICENSE)、[Karoryfer 免费库 CC0 总声明](https://shop.karoryfer.com/pages/free-samples) | `b3b3249d37dc977a1a297bd2dc053e6d9b6b805c` |
| Black And Blue Basses | [原作者明确 CC0](https://shop.karoryfer.com/pages/free-black-and-blue-basses)、[CC0 license](https://github.com/sfzinstruments/karoryfer.black-and-blue-basses/blob/6e7d674cdb41be7a54dbccb15472401ad01099b9/license)、仓库用户手册。录音、剪辑和编程 D. Smolken | `6e7d674cdb41be7a54dbccb15472401ad01099b9` |
| Virtuosity Drums | [Versilian 原作者页面明确 CC0](https://versilian-studios.com/virtuosity-drums/)、[固定版本 CC0 LICENSE](https://github.com/sfzinstruments/virtuosity_drums/blob/9f04cf9a734527edfbb0a4eee1f674e45bbf71bc/LICENSE)。演奏 Austin McMahon，Versilian Studios 与 Karoryfer 制作 | `9f04cf9a734527edfbb0a4eee1f674e45bbf71bc` |

三个库的原始许可文件已保存到 `data/research/` 对应来源目录；清单各音色的 `licenseSha256` 对应下载的许可文件原始字节。

## 保留的 SFZ 元数据子集

本次不是完整 SFZ 解析器。只提取本次中心声部与指定麦克风位置实际需要的元数据，未宣称实现原库全部控制器、反馈、颤音、复合声部或效果。

- **奏法**：`articulation` 使用 `sustain` / `staccato`；贝斯为 `sustain`；鼓为 `hit`，各音色明确 `defaultArticulation`。没有 `palm-mute` 样本。
- **根音**：吉他以 SFZ 的 `pitch_keycenter` 为准，省略时按 SFZ 默认 60。吉他文件名 `e3` 实音约 82.9 Hz，映射 MIDI 40；文件名的八度不能直接作为标准 MIDI 八度。
- **贝斯记谱八度**：原库将 `babyblue_b1` 映射到 keycenter 35，而原录音声学周期约 30.99 Hz，为实音 B0（MIDI 23）。本应用使用实音 MIDI，因此将选中贝斯的根音相对原库降低 12，并保留 `sourceMidi`。这不会变更录音，只避免本应用 MIDI 播放低一八度。抽查的周期自相关为 0.933。
- **力度**：`velocityMin` / `velocityMax` 按原 SFZ 0–127 范围归一化；`velocityReference` 保存该层达到原始振幅的参考力度，取 `amp_velcurve_N=1`，没有显式曲线时使用选定层的上界。离散 MIDI 层间的浮点空隙由引擎选最近层。
- **连续力度鼓**：军鼓和嗵鼓原 SFZ `amp_veltrack=0`，故写 `velocityTracking: false`；避免对已经包含实际演奏强弱的录音再次压低幅度。这些连续层的 `roundRobin: 1` 表示没有该层的独立轮替，没有将相邻力度层虚标为 RR。
- **轮替**：`roundRobin` 使用真实录音编号。原库低力度吉他将同两个文件排列成四步序列，本项目去重后保留两个真实文件，不宣称四个独立演奏。
- **包络**：吉他 attack 10 ms / release 250 ms；贝斯 attack 1 ms / release 250 ms。打击乐单击保留自然尾音。选中的声部没有必须运行的循环点；反馈和滚奏循环不在本次子集中。
- **起音偏移**：贝斯手册说明约 25 ms 的拨弦预录噪声，SFZ 的 Preroll 控制允许跳过 882 帧。本应用选择 `offsetSeconds: 0.02`，等同 44.1 kHz 下原库可用控制的最大响应设定；仍保留末端起拨。吉他和鼓为 0，不擅自截去瞬态。
- **调音与增益**：选中声部在默认控制器下无固定微调，故 `tuneCents: 0`。`gainDb` 保留为 0；各音色 `volumeDb` 为应用的保守起始电平校准，不改写 WAV/FLAC。原贝斯 SFZ 默认 +3 dB 在此由应用校准值替代。最终听感与混音仍需结合音箱和总线，不能凭 PCM 检测判定。
- **踩镲互斥**：本次只有闭镲，未把原库开放/半开放/踏板的整套 choke 组错误套到所有击打；今后加入这些奏法时需要对应实现互斥组。

## 技术验证与已知限制

596 个文件均下载并解码为有效 PCM，帧数与幅值非零，SHA-256 与本机缓存一致。500 个吉他和贝斯 WAV 为 44.1 kHz / 24-bit / 单声道；96 个鼓 FLAC 为 48 kHz / 24-bit，其中 52 个单声道、44 个立体声。FLAC 保留原始扩展名和文件内容，服务器按原始音频格式提供，未伪装成 WAV。

`data/research/metal-verification.json` 记录逐文件采样率、声道、帧数、峰值和固定时间窗 RMS。短促军鼓/踩镲的 RMS 明显受选窗影响；例如强军鼓首 50 ms 约 -12.4 dBFS，而跳过起音后长窗会低很多，因此不能用一个固定长窗指标直接替代听感验收。

吉他实际最高根音为 MIDI 86。超过此范围仍会由最近采样移调，编曲应避免把大量领奏放在采样范围之外。CC0 表明许可范围，不保证单个库与某个音乐风格的听感吻合。用户最终判断音乐和音色是否满足需求。

## 重建入口

- `data/research/build_metal_library.py`：固定来源清单生成、原始文件按需缓存、技术解码验证。
- `data/research/metal-library.json`：7 个新音色的完整数组，逐样本含直接下载链接、SHA-256、字节数和播放元数据。
- `data/research/metal-verification.json`：客观技术检查报告。
- `data/samples/`：本机缓存，仍应排除在开源发行包和网页公开构建产物之外。

这些记录不需要购买产品，不需要下载闭源播放器，也不包含任何非 CC0 音源。
