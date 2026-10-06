# CC0 音源目录与来源

> 2026-10-06 更新：为嘻哈新增 TR-808 鼓组与低音（tidalcycles/sounds-tr808-fischer，CC0）、颤音琴、FM 电钢琴、卡林巴、次中音萨克斯（VCSL，CC0），并给分层踩镲 / 军鼓增加开镲、边框重击、鼓边敲击；目录现为 42 种乐器。来源、实测音高与限制见 [HIPHOP-SOURCES.md](HIPHOP-SOURCES.md)。

> 2026-10-05 更新：目录已扩充为 32 种乐器、2 个箱体 IR、4 个 NAM 箱头模型，共 1,702 个文件（约 1,148 MiB）。弦乐组、长笛、马林巴已换成多力度、多轮替的完整录音，并新增大提琴组、竖琴、圆号、小号、长号、定音鼓、大锣、实心电吉他直录、越南筝、笛子、二胡。新增来源、实测音高、调音校正与 NAM 模型的 GPL-3.0 许可见 [REALISM-SOURCES.md](REALISM-SOURCES.md)。下文为此前 21 种乐器的原始记录，其中 strings、flute、marimba 三项的逐文件表已被新版本取代。

核查日期：2026-10-04。当前 `public/library.json` 共有 **21 种乐器、2 个箱体 IR、657 个原始音频文件**：561 WAV 与 96 FLAC，合计 296,908,618 字节（约 283.15 MiB）。原有音色与来源继续保留。

| 分组 | 目录条目 | 文件 | 原始下载大小 | 来源详表 |
| --- | ---: | ---: | ---: | --- |
| 基础乐器 | 14 | 59 WAV | 95,310,860 字节 | 本文件原有来源与逐文件表 |
| 分层电吉他、电贝斯与架子鼓 | 7 | 500 WAV + 96 FLAC | 201,265,302 字节 | [分层音源记录](METAL-SAMPLE-LICENSES.md) |
| 实测箱体 IR | 2 | 2 WAV | 332,456 字节 | [前级与箱体来源](AMP-SOURCES.md) |

## 分发边界

这个项目的源代码只包含 `public/library.json` 音源目录、许可记录和下载链接。WAV / FLAC 乐器音源从作者公开仓库下载，箱体 IR 使用与作者原始 ZIP 核验一致的单文件镜像；文件都保存在用户本机 `data/samples/` 缓存，不放入 `public/`，不随网页构建产物一起分发。开源项目或打包发布时应排除整个 `data/` 目录。

音源是预先录制的乐器单音；演奏器在指定奏法中选择最近根音、对应力度层和可用轮替录音，再通过变速移调播放 MIDI 音高，不使用音乐生成模型。基础组保持原有的单层、单次演奏选样；新增组使用多力度或独立轮替，具体数量依音色而定。弦乐与长笛没有循环点，因此超过原始录音长度的持续音会自然结束。箱体 IR 用于卷积处理，不能作为乐器编写音符。

CC0 允许复制、修改、传播和商业使用，无强制署名条件。这里仍保留作者与原始来源，便于核验和感谢贡献。CC0 法律文本：[Creative Commons CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/legalcode)。本文件只记录音频素材的来源与许可，不替代软件代码本身的许可。

## 来源库

| 来源 | 本工具使用的乐器 | 作者/录音贡献者 | 许可证据 | 固定版本 |
| --- | --- | --- | --- | --- |
| [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) | 立式钢琴、弦乐组、长笛、马林巴 | Versilian Studios；Sam Gossner、Simon Dalzell；采样剪辑 Elan Hickler / Soundemote | [仓库 CC0 LICENSE](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/LICENSE) | `440300901dfe9275fd84e0b7763af1f8443ae62e` |
| [Versilian Community Sample Library](https://github.com/sgossner/VCSL) | 大鼓、军鼓、闭合踩镲、高嗵鼓、悬镲、拍手、沙锤 | Versilian Studios LLC 及项目贡献者 | [仓库 CC0 LICENSE](https://github.com/sgossner/VCSL/blob/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/LICENSE)；[README 明确音源为 CC0](https://github.com/sgossner/VCSL/blob/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/README.md) | `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e` |
| [Karoryfer Shinyguitar](https://shop.karoryfer.com/pages/free-shinyguitar) | 原声吉他（麦克风录音）、干净电吉他（磁拾音器直出） | Karoryfer Samples / D. Smolken | [仓库 CC0 LICENSE](https://github.com/sfzinstruments/karoryfer.shinyguitar/blob/57243cca85277dbcc120ce17c6178032f93c80f3/LICENSE)；[作者免费音源总页](https://shop.karoryfer.com/pages/free-samples) | `57243cca85277dbcc120ce17c6178032f93c80f3` |
| [Karoryfer Meatbass](https://github.com/sfzinstruments/karoryfer.meatbass) | 低音提琴拨奏 | 演奏与映射 D. Smolken；录音 Ludwik Zamenhof | [仓库 CC0 LICENSE](https://github.com/sfzinstruments/karoryfer.meatbass/blob/ac9e859564bda286ab5ec672d00ff1aa2fef2895/LICENSE)；[作者免费音源总页](https://shop.karoryfer.com/pages/free-samples) | `ac9e859564bda286ab5ec672d00ff1aa2fef2895` |
| [Karoryfer Black And Green Guitars](https://shop.karoryfer.com/pages/free-black-and-green-guitars) | Hofner Club 分层电吉他，延音与短奏 | Karoryfer；录音 Brian Wood | [仓库 CC0 LICENSE](https://github.com/sfzinstruments/karoryfer.black-and-green-guitars/blob/b3b3249d37dc977a1a297bd2dc053e6d9b6b805c/LICENSE) | `b3b3249d37dc977a1a297bd2dc053e6d9b6b805c` |
| [Karoryfer Black And Blue Basses](https://shop.karoryfer.com/pages/free-black-and-blue-basses) | Babyblue 五弦拨片电贝斯，桥拾音器 | 录音、剪辑与编程 D. Smolken | [仓库 CC0 license](https://github.com/sfzinstruments/karoryfer.black-and-blue-basses/blob/6e7d674cdb41be7a54dbccb15472401ad01099b9/license) | `6e7d674cdb41be7a54dbccb15472401ad01099b9` |
| [Virtuosity Drums](https://versilian-studios.com/virtuosity-drums/) | 分层架子鼓：底鼓、军鼓、闭镲、嗵鼓、吊镲 | Austin McMahon 演奏；Versilian Studios 与 Karoryfer 制作 | [作者页面明确 CC0](https://versilian-studios.com/virtuosity-drums/)；[固定清单与许可记录](METAL-SAMPLE-LICENSES.md) | 见 `public/library.json` 的 `sourceRevision` |
| [Jester's Brutal Pack 1.0](https://www.jester-dyne-productions.com/brutal-ir-pack/) | V30 / SM57 与 DV-77 / SM57 实测箱体 IR | Jester Dyne Productions | [作者 ZIP 内 Handbook 第 2 页的 CC0 声明](https://www.jester-dyne-productions.com/content/files/2023/04/JestersBrutalPack_1.0.zip)；[镜像校验记录](AMP-SOURCES.md) | 以两个原始 WAV 的 SHA-256 固定内容 |

Karoryfer 作者页面明确说明免费样本库已改为 CC0，旧下载包可能仍带旧许可。这里使用的 Shinyguitar 与 Meatbass 固定仓库版本同时具备 CC0 LICENSE。没有纳入作者单独注明不同许可的 Marie Ork，也没有使用 CC-BY 音源。

### 原声与电吉他的区别

Shinyguitar 的[原作者介绍](https://shop.karoryfer.com/pages/free-shinyguitar)明确记录同一把拱面爵士吉他的两种录音方式：麦克风收取琴体的原声，以及直接录制磁拾音器输出。`guitar` 使用 `Samples/acoustic/`，`electric-guitar` 使用 `Samples/electric/`，后者是干净的电吉他信号，适合接入过载、失真、滤波或音箱模拟效果器。原始录音本身不包含本工具新增的失真处理。

上述两个 Shinyguitar 音色选取相同的八个根音 40、45、51、57、63、69、75、81；电吉他取自对应的 `electric_one.sfz` 映射。没有将原声录音改名当作电吉他。

新增的 `metal-guitar` 来自另一套 Black And Green Guitars 的 Hofner Club 录音，拥有 `sustain` 延音与独立录制的 `staccato` 短奏。当前没有核实的 `palm-mute` 掌根闷音样本，不将短奏或缩短尾音称为掌根闷音。原作者没有完整披露该库录音链，不能宣称已经证实其为未经放大器处理的 DI。新增 `electric-bass` 是五弦拨片电贝斯；原来的 `bass` 仍为 Meatbass 低音提琴，两者分别保留。

### 打击乐范围

基础打击乐保留七个独立音色：大鼓、军鼓、闭合踩镲、高嗵鼓、悬镲、拍手、沙锤。`tom` 使用高嗵鼓棒单击，`crash` 使用鼓棒击悬镲录音；该条的精确乐器名称为 Suspended Cymbal。新增五个 `rock-*` 音色来自 Virtuosity 架子鼓录音，使用指定麦克风位置的力度层；`rock-snare` / `rock-tom` 的 36 / 16 层是连续演奏力度层，各层没有独立 RR。底鼓、闭镲和吊镲则有真实轮替录音。目录没有宣称包含未核实的 Ride 叮叮镲录音。

## 音高与播放元数据

- 所有 `midi` 均为 MIDI 标准音高数字，中央 C 是 60。VSCO 的文件名 `C3` 实际映射 MIDI 60；Karoryfer 文件名使用 `C4` 对应 MIDI 60。根音取自原库 SFZ 映射，不按文件名一概推断。
- 钢琴根音取自 VSCO `MappingChart.txt`，并对照 `UprightPiano.sfz` 核验。
- VSCO 钢琴、弦乐、长笛、马林巴的 `volumeDb` 参考对应原库 SFZ。基础组军鼓 `snare` 增加 8 dB 默认播放增益以补偿较低录音电平；基础组嗵鼓、悬镲、拍手和沙锤按峰值提供起始增益，其中拍手降低约 9.6 dB。新增分层组使用各自的应用增益，数值以清单为准。WAV / FLAC 本体未归一化、重采样、剪裁或转码。
- `gmProgram` 使用从 0 开始的 General MIDI 节目编号。打击乐采样的根音统一写为 60，`percussive: true`；MIDI 导出需要分别映射大鼓 36、军鼓 38、闭合踩镲 42。
- 乐器的每个 `downloadUrl` 指向固定 Git commit 的原始 WAV / FLAC；两个箱体 IR 的镜像文件已与作者原始 ZIP 逐字节核验一致。`bytes` 为原文件长度，`sha256` 为原始文件内容的 SHA-256。软件可据此检测下载损坏。
- 新增分层样本保留 `articulation`、`velocityMin` / `velocityMax`、`roundRobin`、`gainDb`、`offsetSeconds`、`tuneCents`、`velocityTracking` 与 `velocityReference`。军鼓/嗵鼓的 `velocityTracking:false` 避免对本来就有演奏强弱的录音再次降低幅度；贝斯 `offsetSeconds:0.02` 沿用原库允许的预录起音跳过设置。具体范围、录音编号和 SFZ 依据见 [分层音源记录](METAL-SAMPLE-LICENSES.md)。

## 技术核验

基础组的 59 个 WAV 已从清单固定地址取得并核验有效 PCM。新增组的 596 个文件也已下载、解码并核验非空 PCM 和 SHA-256，记录见 `data/research/metal-verification.json`；96 个 FLAC 保持原始格式，未伪装成 WAV。两个箱体 IR 的格式与作者 ZIP 一致性记录见 [AMP-SOURCES.md](AMP-SOURCES.md)。缓存保留全部上游原始字节，校验值列于 `public/library.json`。浏览器解码、调度和导出检查由应用技术测试执行；文件头或 PCM 核查本身不代表听感验收。

## 基础组逐文件下载目录

以下保留原有 14 种乐器、59 个文件的逐项链接，与 `public/library.json` 对应。新增 596 个分层样本的完整链接与选样元数据也保留在该清单中，来源与选取依据见 [METAL-SAMPLE-LICENSES.md](METAL-SAMPLE-LICENSES.md)；两个箱体的单文件链接见 [AMP-SOURCES.md](AMP-SOURCES.md)。软件通过本地缓存路径读取下载结果。

| Instrument | MIDI root | Download | Bytes | Local cache |
| --- | --- | --- | ---: | --- |
| 立式钢琴 | 37 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Keys/Upright%20Piano/Player_dyn2_rr1_008.wav) | 6862312 | `data/samples/piano/37.wav` |
| 立式钢琴 | 45 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Keys/Upright%20Piano/Player_dyn2_rr1_012.wav) | 6306106 | `data/samples/piano/45.wav` |
| 立式钢琴 | 53 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Keys/Upright%20Piano/Player_dyn2_rr1_016.wav) | 4643212 | `data/samples/piano/53.wav` |
| 立式钢琴 | 61 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Keys/Upright%20Piano/Player_dyn2_rr1_020.wav) | 4346848 | `data/samples/piano/61.wav` |
| 立式钢琴 | 69 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Keys/Upright%20Piano/Player_dyn2_rr1_024.wav) | 3204940 | `data/samples/piano/69.wav` |
| 立式钢琴 | 77 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Keys/Upright%20Piano/Player_dyn2_rr1_028.wav) | 3008866 | `data/samples/piano/77.wav` |
| 立式钢琴 | 85 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Keys/Upright%20Piano/Player_dyn2_rr1_032.wav) | 2888572 | `data/samples/piano/85.wav` |
| 立式钢琴 | 93 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Keys/Upright%20Piano/Player_dyn2_rr1_036.wav) | 2254930 | `data/samples/piano/93.wav` |
| 原声吉他 | 40 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/acoustic/e2_vl3_rr1_1.wav) | 1054316 | `data/samples/guitar/40.wav` |
| 原声吉他 | 45 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/acoustic/a2_vl3_rr1_1.wav) | 930284 | `data/samples/guitar/45.wav` |
| 原声吉他 | 51 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/acoustic/eb3_vl3_rr1_1.wav) | 930284 | `data/samples/guitar/51.wav` |
| 原声吉他 | 57 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/acoustic/a3_vl3_rr1_1.wav) | 930284 | `data/samples/guitar/57.wav` |
| 原声吉他 | 63 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/acoustic/eb4_vl3_rr1_1.wav) | 744236 | `data/samples/guitar/63.wav` |
| 原声吉他 | 69 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/acoustic/a4_vl3_rr1_1.wav) | 744236 | `data/samples/guitar/69.wav` |
| 原声吉他 | 75 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/acoustic/eb5_vl3_rr1_1.wav) | 620204 | `data/samples/guitar/75.wav` |
| 原声吉他 | 81 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/acoustic/a5_vl3_rr1_1.wav) | 558188 | `data/samples/guitar/81.wav` |
| 低音提琴 | 24 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.meatbass/ac9e859564bda286ab5ec672d00ff1aa2fef2895/Samples/pizz/c1_vl3_rr1.wav) | 664302 | `data/samples/bass/24.wav` |
| 低音提琴 | 30 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.meatbass/ac9e859564bda286ab5ec672d00ff1aa2fef2895/Samples/pizz/gb1_vl3_rr1.wav) | 558462 | `data/samples/bass/30.wav` |
| 低音提琴 | 36 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.meatbass/ac9e859564bda286ab5ec672d00ff1aa2fef2895/Samples/pizz/c2_vl3_rr1.wav) | 532000 | `data/samples/bass/36.wav` |
| 低音提琴 | 42 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.meatbass/ac9e859564bda286ab5ec672d00ff1aa2fef2895/Samples/pizz/gb2_vl3_rr1.wav) | 532002 | `data/samples/bass/42.wav` |
| 低音提琴 | 48 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.meatbass/ac9e859564bda286ab5ec672d00ff1aa2fef2895/Samples/pizz/c3_vl3_rr1.wav) | 505542 | `data/samples/bass/48.wav` |
| 低音提琴 | 54 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.meatbass/ac9e859564bda286ab5ec672d00ff1aa2fef2895/Samples/pizz/gb3_vl3_rr1.wav) | 426162 | `data/samples/bass/54.wav` |
| 弦乐组 | 55 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Violin%20Section/susVib/VlnEns_susVib_G2_v2.wav) | 2681324 | `data/samples/strings/55.wav` |
| 弦乐组 | 62 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Violin%20Section/susVib/VlnEns_susVib_D3_v2.wav) | 2457908 | `data/samples/strings/62.wav` |
| 弦乐组 | 69 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Violin%20Section/susVib/VlnEns_susVib_A3_v2.wav) | 1671704 | `data/samples/strings/69.wav` |
| 弦乐组 | 76 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Violin%20Section/susVib/VlnEns_susVib_E4_v2.wav) | 1702620 | `data/samples/strings/76.wav` |
| 弦乐组 | 83 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Violin%20Section/susVib/VlnEns_susVib_B4_v2.wav) | 1923744 | `data/samples/strings/83.wav` |
| 弦乐组 | 86 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Violin%20Section/susVib/VlnEns_susVib_D5_v2.wav) | 1976276 | `data/samples/strings/86.wav` |
| 长笛 | 60 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Woodwinds/Flute/susNV/LDFlute_susNV_C3_v3_1.wav) | 2729730 | `data/samples/flute/60.wav` |
| 长笛 | 64 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Woodwinds/Flute/susNV/LDFlute_susNV_E3_v3_1.wav) | 2814822 | `data/samples/flute/64.wav` |
| 长笛 | 69 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Woodwinds/Flute/susNV/LDFlute_susNV_A3_v3_1.wav) | 2765718 | `data/samples/flute/69.wav` |
| 长笛 | 72 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Woodwinds/Flute/susNV/LDFlute_susNV_C4_v3_1.wav) | 2539512 | `data/samples/flute/72.wav` |
| 长笛 | 76 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Woodwinds/Flute/susNV/LDFlute_susNV_E4_v3_1.wav) | 2449278 | `data/samples/flute/76.wav` |
| 长笛 | 81 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Woodwinds/Flute/susNV/LDFlute_susNV_A4_v3_1.wav) | 2147490 | `data/samples/flute/81.wav` |
| 长笛 | 84 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Woodwinds/Flute/susNV/LDFlute_susNV_C5_v2_1.wav) | 2382720 | `data/samples/flute/84.wav` |
| 长笛 | 88 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Woodwinds/Flute/susNV/LDFlute_susNV_E5_v2_1.wav) | 2121246 | `data/samples/flute/88.wav` |
| 马林巴 | 48 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Percussion/Marimba/Marimba_hit_Outrigger_C2_loud_01.wav) | 2236004 | `data/samples/marimba/48.wav` |
| 马林巴 | 55 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Percussion/Marimba/Marimba_hit_Outrigger_G2_loud_01.wav) | 1855448 | `data/samples/marimba/55.wav` |
| 马林巴 | 59 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Percussion/Marimba/Marimba_hit_Outrigger_B2_loud_01.wav) | 1585778 | `data/samples/marimba/59.wav` |
| 马林巴 | 65 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Percussion/Marimba/Marimba_hit_Outrigger_F3_loud_01.wav) | 1589876 | `data/samples/marimba/65.wav` |
| 马林巴 | 72 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Percussion/Marimba/Marimba_hit_Outrigger_C4_loud_01.wav) | 1016564 | `data/samples/marimba/72.wav` |
| 马林巴 | 79 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Percussion/Marimba/Marimba_hit_Outrigger_G4_loud_01.wav) | 800102 | `data/samples/marimba/79.wav` |
| 马林巴 | 83 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Percussion/Marimba/Marimba_hit_Outrigger_B4_loud_01.wav) | 694454 | `data/samples/marimba/83.wav` |
| 马林巴 | 89 | [WAV](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/Percussion/Marimba/Marimba_hit_Outrigger_F5_loud_01.wav) | 551306 | `data/samples/marimba/89.wav` |
| 大鼓 | 60 | [WAV](https://raw.githubusercontent.com/sgossner/VCSL/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/Membranophones/Struck%20Membranophones/Bass%20Drum%201/BDrumNew_hit_v5_rr1_Sum.wav) | 588092 | `data/samples/kick/60.wav` |
| 军鼓 | 60 | [WAV](https://raw.githubusercontent.com/sgossner/VCSL/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/Membranophones/Struck%20Membranophones/Snare%20Drum%2C%20Modern%201/Snare2_HitSN_v5_rr1_Mid.wav) | 240496 | `data/samples/snare/60.wav` |
| 闭合踩镲 | 60 | [WAV](https://raw.githubusercontent.com/sgossner/VCSL/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/Idiophones/Struck%20Idiophones/Hi-Hat%20Cymbal/HiHat_HitC_v3_rr1_Mid.wav) | 218792 | `data/samples/hihat/60.wav` |
| 干净电吉他 | 40 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/electric/e2_vl3_rr1_2.wav) | 1054316 | `data/samples/electric-guitar/40.wav` |
| 干净电吉他 | 45 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/electric/a2_vl3_rr1_2.wav) | 930284 | `data/samples/electric-guitar/45.wav` |
| 干净电吉他 | 51 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/electric/eb3_vl3_rr1_2.wav) | 930284 | `data/samples/electric-guitar/51.wav` |
| 干净电吉他 | 57 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/electric/a3_vl3_rr1_2.wav) | 930284 | `data/samples/electric-guitar/57.wav` |
| 干净电吉他 | 63 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/electric/eb4_vl3_rr1_2.wav) | 744236 | `data/samples/electric-guitar/63.wav` |
| 干净电吉他 | 69 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/electric/a4_vl3_rr1_2.wav) | 744236 | `data/samples/electric-guitar/69.wav` |
| 干净电吉他 | 75 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/electric/eb5_vl3_rr1_2.wav) | 620204 | `data/samples/electric-guitar/75.wav` |
| 干净电吉他 | 81 | [WAV](https://raw.githubusercontent.com/sfzinstruments/karoryfer.shinyguitar/57243cca85277dbcc120ce17c6178032f93c80f3/Samples/electric/a5_vl3_rr1_2.wav) | 558188 | `data/samples/electric-guitar/81.wav` |
| 嗵鼓 | 60 | [WAV](https://raw.githubusercontent.com/sgossner/VCSL/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/Membranophones/Struck%20Membranophones/Tom%201/Stick/TomH_HitS_v3_rr1_Mid.wav) | 424648 | `data/samples/tom/60.wav` |
| 悬镲 | 60 | [WAV](https://raw.githubusercontent.com/sgossner/VCSL/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/Idiophones/Struck%20Idiophones/Suspended%20Cymbal%201/susCymb1_hit_stick_f1.wav) | 1213358 | `data/samples/crash/60.wav` |
| 拍手 | 60 | [WAV](https://raw.githubusercontent.com/sgossner/VCSL/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/Idiophones/Struck%20Idiophones/Claps/Clap_rr1.wav) | 141974 | `data/samples/clap/60.wav` |
| 沙锤 | 60 | [WAV](https://raw.githubusercontent.com/sgossner/VCSL/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/Idiophones/Struck%20Idiophones/Shaker%2C%20Small/Mid_ShakerHighFaster_Down_rr1.wav) | 31556 | `data/samples/shaker/60.wav` |
