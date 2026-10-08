# 编曲时的决策

此文件辅助创作，不规定所有音乐必须采用同一结构。用户的风格、参考、配器和修改范围优先。

## 从要求到乐谱

先确定速度、调性、主要动机和段落关系，再编写声部。用时间与小节的换算检查长度；对于约一分钟的短曲，仍要有可辨认的开头、变化与结束，不只把一个小节循环堆满。说明采用的创作选择，不为每个常规音乐选择请求批准。

将旋律、和声、低音与节奏分工。旋律留呼吸，低音与底鼓有节奏关系，过门为段落服务；密集音符和多轨数量本身不等于能量。根据乐器实际音域与演奏方式配置和弦、重复音、力度、长短和空间。

多轨 JSON 可用小型确定性脚本生成，保留脚本在 `data/compositions/` 便于修订。每个音符显式写 start、duration、midi、velocity 与稳定 ID；随机变化如有需要使用固定种子。只为演奏表达而变化，不把全曲随机偏拍当成人性化。

## 选音色而不被名称误导

先从 `/api/library` 摘要出 id、kind、percussive、奏法、根音范围、力度/轮替结构和 installed，避免向上下文打印数百条完整样本地址。根音由 `samples[].midi` 给出。选择同一根音上的真实录音层优先于过度移调；超出采样范围的领奏会改变录音音色。

目前可选的乐队声部（将来以实时库为准）：

| 需要的声部 | 当前 ID / 用法 |
| --- | --- |
| 实际短奏和延音电吉他 | `metal-guitar`，低区实音 40–59 逐半音，高区至 86 隔全音 |
| 干净电吉他 | `electric-guitar`，基础采样较稀疏 |
| 拨片电贝斯 | `electric-bass`，当前实音根音 23–43 |
| 原声拨弦 / 笛声 | `guitar` / `flute`；不要声称它们是古筝、琵琶或竹笛实录 |
| 架子鼓 | `rock-kick`、`rock-snare`（hit/rimshot/crossstick）、`rock-hihat`（hit 闭镲/open）、`rock-tom`、`rock-crash`，每件鼓单独一轨便于混音 |
| 808 鼓机 | `tr808-kick`（hit/long）、`tr808-snare`（hit/snappy）、`tr808-clap`、`tr808-hihat`（closed/open-short/open）、`tr808-perc`（rim/cowbell/clave/maracas），打击乐写 MIDI 60 |
| 808 低音 | `tr808-bass`（sub/punch）是旋律轨，根音 31；常用 MIDI 26–40。无滑音、无循环，越高尾音越短，用 note duration 控制长度 |
| 嘻哈和声色彩 | `fm-piano`（TX81Z FM 电钢琴，不是 Rhodes）、`vibraphone`（soft/hard）、`kalimba`（已校正到平均律）、`tenor-sax`（sustain/vibrato/staccato） |
| 中国民乐（新增） | `guzheng` 古筝（真古筝实录，D F G A C 定弦，C2–D6，奏法 pluck）；`xiao` 箫（由竖笛加工：压掉吐音、收暗、加气声、缓起，F3–C6，sustain/vibrato 连奏、staccato）；`xiao-recorder` 未加工的竖笛；`suona-oboe` 唢呐·双簧管代（B♭3–F6，sustain/vibrato/staccato）；`oboe` 双簧管。`dan-tranh` 是越南筝，音色更"野"，适合游戏氛围，与古筝并存 |
| 采样盒（嘻哈 / lo-fi） | `crate-classical` 古典乐句 loop（写在 MIDI 60，按切片 ID 选奏法；带 BPM，自动拉伸到工程速度、音高不变；一条音符 = 切片长度，常见 16 拍）；`crate-speech` NASA / 肯尼迪等公有领域讲话、`crate-vocals` CC0 人声短句（一次性触发）。逐条的 BPM、调性、和弦、原文见工作室 `docs/SAMPLE-CRATE.md`，按调性配 808 贝斯 |
| 爵士鼓与镲（新增） | `ride` 叮叮镲（ride / bell，3 档力度）、`flat-ride` 平头叮叮镲（ride / crash），与 `rock-*` 同套麦克风，可混用；摇摆爵士用 ride 打 "ding ding-a ding"，踩镲只踩 2、4 拍 |
| 手鼓与小打击（新增） | `conga` 康加（quinto / conga / tumba × open / muted）、`bongos` 邦戈（high / low / muted / roll）、`frame-drum` 手鼓（large / small / muted / hand）、`tambourine` 铃鼓（hit / roll / shake）；全部写 MIDI 60，用音符 articulation 切换 |
| 铃与氛围（新增） | `wind-chimes` 风铃（asc / desc / fast-asc / slow-asc / slow-desc / random，一次性长音）、`bell-tree` 铃树（stroke / hit）、`sleigh-bells` 雪橇铃（hit / shake）、`finger-cymbals` 指钹、`nepal-bells` 尼泊尔手铃；适合仪式感、灵性爵士、转场 |
| 管钟与簧风琴（新增） | `tubular-bells` 管钟（C4–E5，2 档力度）；`reed-organ` 簧风琴·管风琴代（VCSL 文艺复兴管风琴 8'，C2–E6，长音铺底，代替 harmonium） |
| 做旧质感（新增） | `vinyl` 黑胶底噪（crackle 噼啪 / surface 沙沙 / loop 短循环，带循环点，一条长音符铺满全曲；音量放低，-30 dB 左右的存在感即可） |
| 自制唱片切片（新增） | `nujabes-chops`：工作室自己演奏的原创萨克斯乐句（take H：即兴口气、松弛节奏，95 BPM，Dbmaj9 C7b9 Fm9 Fm9 | Bbm9 Eb13 Abmaj9 C7b9）做旧后的切片：`bars1-8` / `bars1-4` / `bars5-8` 萨克斯整句、`bars1-2` 等 2 小节、`bar1`–`bar8`、`stab-Dbmaj9` / `stab-Bbm9` / `stab-Abmaj9` 无萨克斯和弦单击；带 BPM 自动拉伸。要做新的"采样感"素材时照这个做法：先写一段有记忆点、节奏自由的乐句并渲染成 WAV，再做旧（轻微抖动、带通、软饱和）并按小节切片，标上原始 BPM、开启乐器的 `stretch`；旋律跨小节时以整句切片为主；不要直接采有版权的唱片 |
| 合成器（新增） | `gfunk-lead` G-funk 哼鸣主音（自制正弦为主的 Minimoog 式高音，C4–C7，`lead` 直音 / `vibrato` 延迟颤音是圆润版，`sly` / `sly-vibrato` 是坏笑鼻音版，G-funk 优先用 sly；四种都是连奏 + portamento 滑音：音符首尾相接（间隙 < 60 ms）就从前一个音高滑过去，想要滑音就让音符相接，不想滑就留缝）；`gfunk-bass` Moog 式合成器贝斯（C1–B3，`sustain` 连奏可滑、`pluck` 短拨、`deep` 正弦为主的深沉低频、慢滑音；`deep` 在小音箱上听不清时叠一轨 `sustain` 做亮层）。引擎奏法字段 `glide`（秒）配合 `legato` 即为滑音，其它乐器也可以用。合成器音色电平高，混音时先对比底鼓 |
| 人声打击（beatbox） | `beatbox`（CC0 真人录音），奏法 kick / snare / ksnare / hihat / open / rim / clap / breath，全部写 MIDI 60、一条轨里用音符 `articulation` 切换 |
| 人声 | `xsxb-voice` 小宝人声（作者录的男声，已公开）、`xsxb-voice-f` 女声版（声码器转换，高音区容易发尖，慎用）、`xsxb-voice-beatbox`；用户自己用 voice-kit 录的是 `personal:true` 的乐器（默认 `my-voice`），只存在本机；奏法 oo（乌）/ aa（啊）/ mm（哼）/ dm（低音短音）/ ba（短音）/ falsetto（假声乌），以实际清单为准 |

分层采样由 velocity 决定，播放器负责真实录音轮替，不要把轮替编号写进音符。音符 `articulation` 优先于轨道默认奏法。切换乐器时清除或更新不兼容的奏法。

## 阿卡贝拉（只用人声）

只放 `family:"vocal"` 的轨道，就是纯人声作品；也可以把人声轨和乐器混用。采样器不会唱歌词，这里做的是无词阿卡贝拉：和声垫、人声贝斯、beatbox 和无词旋律。

- 声部按真人合唱来分：贝斯（dm 或 oo，大约 MIDI 40–55）、男中音和男高音和声（oo / aa / mm，大约 48–67）、高声部（falsetto，64 以上）。每个声部单独一轨，声部之间保持平滑进行：多用共同音和级进，少平行五八度，不要让所有声部同时大跳。
- 长音奏法带循环，音符写多长就唱多长；dm / ba 是短音，duration 写 0.25–0.5 拍。人声贝斯可以用 dm 打出节奏型，再在长音处换成 oo。
- 和声垫用 mm 最柔、oo 居中、aa 最亮；按段落换元音就能做出层次，不必一直叠更多声部。
- beatbox 一条轨即可：kick 和 snare 搭骨架，hihat / ksnare 填缝，breath 放在乐句前当换气。
- 个人人声只有用户录过的音域：先在 `/api/library` 里看 `samples[].midi` 的范围，超出太多会变成"花栗鼠"声。同一个音高上的多轨重叠会显得单薄，可以把同度改成八度或三度，或者用 `pan` 左右分开。

## 慢旋律别写成"塑料味"

采样乐器没有气息、没有滑音。旋律慢下来、音区居中时最容易暴露这一点，管乐和人声尤其明显。写的时候：

- 一拍以上的长音用带颤音的奏法（`tenor-sax` 的 `vibrato`）；直音（`sustain`）只用在短的连接音上。
- 长音前加"兜音"：低一个全音、约 0.12 拍的短音，力度约主音的一半。装饰音、转音和乐句之间的五声快跑，都要用连音奏法（`sustain`），时值刚好接上下一个音，让它们滑过去。
- **不要在连贯的旋律里夹断奏（staccato）装饰音**，也不要在句尾加"往下甩"的几个短音：断奏采样每下都是独立的吐音，夹在旋律里像突然蹦出来的几个音，用户明确反馈过突兀。句尾用带颤音的长音收住就行；断奏只用在本来就一下一下的段落，比如狂喜段的快速爬升。
- **节奏要松，不要套格子**：句子从反拍、三连音的弱位进来，跨小节线落地；长音后接一小串快音；乐句之间留空白。整体往拍子后面挪约 0.07 拍，每个音再加一点不规则的前后偏差。伴奏的节奏型也要每小节变化。爵士和 lo-fi 的旋律如果全落在拍点、时值只有一拍和半拍，用户会觉得"太固定、不自由"。
- 力度要有起伏：弱起，长音推上去，句尾收。轨道上加 `humanize` 0.3 左右。
- `tenor-sax` 的 sustain / vibrato，人声和箫的长音，都已开启连音：相邻音符首尾相接（间隔不超过 60 ms）就会自动衔接，不会重新起音。

## 需要重型吉他时

用低音弦 riff 与适当音程配置，而不是把键盘大和弦送进失真。快速重复音可选录制短奏，并控制 note duration 与轨道 release；重音、长和弦与领奏可使用 sustain。当前没有核实的真实掌根闷音，也没有弯音、滑音或连奏控制，不能靠添加未定义字段实现它们。

双吉他可使用两条轨、不同实际演奏轮替及左右声像；检查单声道叠加和节奏关系，避免相同样本的固定延迟造成梳状滤波。录音限制需要如实反映，不能宣称等同真人双轨录制。

以下只是已有引擎的起始设置，按实际素材调整，不能保证听感：

```json
{"enabled":true,"drive":0.55,"tone":0.5,"mix":1,"output":0.55,"ampModel":"high-gain","cabinetId":"cab-v30-sm57"}
```

完整音箱音色通常使用 mix=1。节奏轨 release 可从约 0.02 秒开始试，领奏适度放长。高增益会改变音量和频谱，要与鼓组重新平衡；不得只不断叠加失真。

中式旋律由旋律材料、句法与节奏建立，不靠给轨道起民族乐器名称。例如用户需要时可围绕五声音阶写独立主题，再在不同段落变化、回应；这不是每首作品的强制模板。
