# 嘻哈扩充：808、开镲/边击、颤音琴、FM 电钢琴、卡林巴、萨克斯

核查日期：2026-10-06。为嘻哈 / Boom-bap / Trap / Lo-fi 补充音色。研究脚本、逐文件测量与合并前备份在本机 `data/research/hiphop-2026-10/`（不随源码分发）。全部乐器录音均为 CC0，只按需下载到 `data/samples/`。

目录合计：42 种乐器、2 个箱体 IR、4 个 NAM 箱头模型（48 条）。本轮新增 10 种乐器，另给 `rock-hihat`、`rock-snare` 增加奏法；新增 287 个文件（约 304 MiB）；目录全部下载合计 1,989 个文件、约 1,453 MiB。

## 来源与许可证据

| 来源（固定版本） | 用于 | 许可证据 |
| --- | --- | --- |
| [tidalcycles/sounds-tr808-fischer](https://github.com/tidalcycles/sounds-tr808-fischer) `85fbecf1bec3…` | `tr808-kick`、`tr808-snare`、`tr808-clap`、`tr808-hihat`、`tr808-perc`、`tr808-bass` | 仓库 [LICENSE 为 CC0 1.0](https://github.com/tidalcycles/sounds-tr808-fischer/blob/85fbecf1bec32553395625ea659e2a56dfd7c0e1/LICENSE)，每组 `_soundmeta/*.json` 标注 `"license": "cc0"` |
| [VCSL](https://github.com/sgossner/VCSL) `c1ea7bcc3c73…`（已有来源） | `vibraphone`、`fm-piano`、`kalimba`、`tenor-sax` | [仓库 CC0 LICENSE](https://github.com/sgossner/VCSL/blob/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/LICENSE) |
| [Virtuosity Drums](https://github.com/sfzinstruments/virtuosity_drums) `9f04cf9a7345…`（已有来源） | `rock-hihat` 开镲；`rock-snare` 边框重击、鼓边敲击 | [仓库 CC0 LICENSE](https://github.com/sfzinstruments/virtuosity_drums/blob/9f04cf9a734527edfbb0a4eee1f674e45bbf71bc/LICENSE) |

**TR-808 来源说明**：录音由 Michael Fischer（Technopolis）1994 年直接从一台真实 TR-808（序列号 103852）的单独输出采得。原始自述只写“ABSOLUTELY FREE”，没有使用 CC0 一词；CC0 声明来自 TidalCycles 维护者发布的仓库与元数据（Strudel 等项目以此作为默认 808 音色）。按本项目“仓库明确 CC0 LICENSE”的标准纳入，并在此如实记录这一层来源。

未纳入：jRhodes3 Rhodes 电钢琴（样本为 CC-BY-NC / CC-BY-NC-SA）、Greg Sullivan E-Pianos（CC-BY 3.0）。目前没有找到明确 CC0 的 Rhodes / Wurlitzer 实录，`fm-piano` 是 FM 合成器电钢琴，不是 Rhodes。

## 新增乐器

| ID | 来源 | 文件 | 奏法 | 根音 | 备注 |
| --- | --- | ---: | --- | --- | --- |
| `tr808-kick` | TR-808 BD | 2 | `hit` 短衰减（BD5025）、`long` 长衰减（BD5075） | 打击乐 60 | 音色旋钮 5.0 |
| `tr808-snare` | TR-808 SD | 2 | `hit`（SD5050）、`snappy` 响弦最大（SD5010） | 60 | |
| `tr808-clap` | TR-808 CP | 1 | `hit` | 60 | |
| `tr808-hihat` | TR-808 CH / OH | 3 | `closed`、`open-short`（OH25）、`open`（OH75） | 60 | 开镲 `gainDb` −4.5 / −3.6，使峰值约比闭镲高 2 dB |
| `tr808-perc` | TR-808 RS / CB / CL / MA | 4 | `rim`、`cowbell`、`clave`、`maracas` | 60 | 奏法间 `gainDb` 按 RMS 差的一半拉近 |
| `tr808-bass` | TR-808 BD，衰减最大 | 2 | `sub` 音色 0（BD0010）、`punch` 音色 5.0（BD5010） | **31**，`tuneCents` −24 / −23 | 旋律乐器（非 percussive），用钢琴卷帘写音高 |
| `vibraphone` | VCSL Vibraphone | 44 | `soft` 软槌、`hard` 硬槌（各 2 层力度） | 53–88 | 弓奏 6 个文件未收 |
| `fm-piano` | VCSL TX81Z FM Piano | 57 | `sustain`（3 层力度） | 24–96，每大三度 | C0 / E0 / G#0（MIDI 12–20，低于 26 Hz）未收 |
| `kalimba` | VCSL Kalimba, Tanzania | 27 | `pluck` | 44–97 | 非等律调音，根音与音分逐个实测（见下） |
| `tenor-sax` | VCSL Tenor Saxophone | 105 | `sustain` 无揉音（2 层）、`vibrato` 揉音、`staccato` 短奏（2 层，多轮替） | 44–88 | |

扩充的已有乐器（原 `hit` 奏法与样本不变，旧工程兼容）：

- `rock-hihat`：新增 `open` 开镲，oh 麦克风，4 层力度 × 3 轮替（12 个 FLAC）；`hit` 显示名改为“闭镲”。
- `rock-snare`：新增 `rimshot` 边框重击（12 层）与 `crossstick` 鼓边敲击（16 层），snaremic 麦克风，与鼓心一致使用 `velocityTracking:false`；`hit` 显示名改为“鼓心”。

力度层、轮替与 `amp_velcurve` 参考取自原库 `Programs/mappings/{oh,snaremic}/*_map.sfz`。

## 音高与电平

- VCSL 组按 YIN 实测多数结果定八度：颤音琴、卡林巴、萨克斯的文件名比 MIDI 记法低一个八度（`C3` 实为 MIDI 60）；TX81Z 文件名 `C4` 即 MIDI 60。YIN 报出的少数偏差（颤音琴最低 F3、萨克斯 C3）经 FFT 核对为泛音误判，根音保持不变。颤音琴、FM 电钢琴实测偏差都在 12 音分内，不做校正。
- 卡林巴：拇指琴并非十二平均律，且会激起其他簧片共振。取名义音高 ±1 半音内最强的频谱峰为该键基频，四舍五入为根音并写入 `tuneCents`，使它与其他乐器同律；偏差最大约 ±49 音分，部分键因此换到相邻根音。逐键结果见研究目录 `kalimba-roots.txt`。
- `tr808-bass`：YIN 实测基频 49.67 Hz（MIDI 31.24，FFT 峰约 31.3），根音 31（G1）。
- 旋律乐器 `volumeDb` 按最强力度层前 1.5 秒中位 RMS 校准到约 −18 dBFS。808 鼓件按前 0.3 秒 RMS 对齐相应的 `rock-*` 鼓件（拍手、打击乐对齐军鼓，打击乐再低 6 dB）；808 低音先对齐 `electric-bass`，再 +6 dB（衰减正弦按 RMS 读数偏小，对着底鼓会太轻）。
- 本机文件名把 TR-808 的 `.WAV` 改为小写 `.wav`（服务只接受小写扩展名），`downloadUrl` 仍指向原文件，SHA-256 为原始字节。

## 使用限制

- **没有滑音 / glide**：808 低音每个音符是独立的录音变速，不会从上一个音滑过去。
- **没有循环点**：`tr808-bass` 录音长 3 秒，按根音 31 播放；越往高写尾音越短（高八度约 1.5 秒），往低写会更长、更慢。
- **开镲不会被闭镲切断**：打击乐样本按自然衰减完整播放（choke 未实现）。808 开镲本身较短；`rock-hihat` 的 `open` 尾音较长，密集使用时注意。
- 没有黑胶噪声、采样切片（chop）或人声素材；Lo-fi 质感只能靠音色选择与编配，引擎没有低保真 / 降采样效果器。
- 节奏摇摆（swing）没有全局参数，需要在音符起点上直接写偏移。

## MIDI 导出

鼓轨按 GM 键位导出：`tr808-*` 与 `rock-*` 共用 kick 36、snare 38、hihat 42、clap 39；奏法级映射为开镲 / 短开镲 46、`rimshot` 40、`crossstick` 与 `rim` 37、`cowbell` 56、`clave` 75、`maracas` 70。`tr808-perc` 默认 37。`tr808-bass` 作为旋律轨导出（GM 38 Synth Bass 1）。
