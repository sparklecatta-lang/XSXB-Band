# 音频与 MIDI

`src/audio.ts` 使用浏览器 Web Audio API 播放用户下载的真实录音，当前目录包含 WAV 乐器采样、FLAC 摇滚鼓采样以及 WAV 音箱脉冲响应（IR）。文件由浏览器 `decodeAudioData` 解码，使用支持这些格式的现代 Chrome/Edge。
音源缺失时会明确提示下载或修复，不替换成振荡器、合成音或在线音乐模型。软件目录保留下载链接及校验信息；录音与 IR 位于用户本地缓存，不随源码或发行包分发。

## 浏览器接口

```ts
const engine = new AudioEngine();
engine.setLibrary(instruments); // /api/library 返回的完整目录，包括音箱 IR 和已安装状态
engine.setMasterVolume(0.8);
await engine.preload(project);  // 可选；play / renderWav 也会按需加载
await engine.play(project, {
  fromBeat: 0,
  loop: true,
  onBeat: beat => {},
  onEnd: () => {}, // 非循环播放到工程末尾
});
engine.stop();
await engine.preview('piano', 60, 0.7, 0.6, selectedTrack);
engine.updateTrack(selectedTrack); // 调整既有轨道链的音量、声像及驱动/明暗/干湿/输出
const wav: Blob = await engine.renderWav(project);
const midi: Blob = exportMidi(project, instruments);
```

`preview` 的 duration 单位是秒；工程音符的 start / duration 单位是四分音符拍。
播放必须由用户点击触发，使浏览器允许 AudioContext 发声。点击停止会取消旧播放/试听的待加载请求结果；已经获取的采样会保留在内存，以便下一次播放。

## 演奏法、力度层与轮替采样

采样选择由 `src/sample-selection.ts` 和 `AudioEngine.assignments` 共同完成：

1. 先选择演奏法，优先级为音符 `articulation` → 轨道 `articulation` → 乐器 `defaultArticulation` → 乐器演奏法列表第一项。指定演奏法没有录音时明确报错。
2. 在该演奏法内选最近的 MIDI 根音；距离相等时固定选较低根音，轮替不会在两个不同根音之间跳动。
3. 按音符力度选择 `velocityMin` / `velocityMax` 范围内的真实力度层；没有范围命中时取最近一层。
4. 同一候选组按 `roundRobin`、文件地址排序，使用由轨道 ID 决定的起始位置轮替。计数按音符时间/音高排序建立，播放和 WAV 使用同样的确定性分配；循环复用该轮分配。单音试听使用独立递增计数。

`metal-guitar` 提供实际的 `sustain` / `staccato` 录音，`electric-bass` 提供拨奏录音，`rock-*` 鼓提供力度层及轮替击打。旧版单样本乐器仍按同一选择流程兼容。具体采样数和来源以音源目录及 [SAMPLE-LICENSES.md](SAMPLE-LICENSES.md) 为准。

样本元数据还能保留原库的 `gainDb`、`offsetSeconds`、`tuneCents`。其中偏移用于跳过录音前部，微调用于修正音高，单样本增益与乐器 `volumeDb` 相加。默认力度增益为 `(velocity / velocityReference)^1.35`，比值限于 0～1；`velocityReference` 默认 1。若样本设置 `velocityTracking: false`，力度仍用于选择真实动态层，但不再额外按同一力度降低音量，避免已经较轻的录音被重复衰减。

目录中 `kind: "cabinet"` 的条目只能接入效果链，不能作为音符轨道乐器。仅当有效可听轨启用了效果器并选择 `cabinetId` 时加载其 IR；旁路状态不要求下载该 IR。

## 播放规则

- 选择真实采样后，用 `2 ** ((midi - root) / 12 + tuneCents / 1200)` 调节播放速率；`tuneCents` 省略时为 0。
- 音符动态层、力度增益、乐器/单样本 dB 补偿、轨道音量和声像都会生效；总线有动态压缩和独立监听音量。
- 起音使用乐器 `attack`，省略时旋律为 4ms、打击乐为 1ms。旋律音符可以提前结束录音，但不会强行延长录音。打击乐不按钢琴卷帘音符的短时值截尾，保持单次录音自然衰减，单击上限 12 秒。
- 旋律轨可设置 `release`（秒，0.005～2），覆盖该轨的音源默认释放时长；省略则保持原有默认。播放、单音试听和 WAV 导出同时生效，打击乐忽略该值以保留自然衰减。适合快速吉他断奏，例如 176 BPM 下时值 0.15 拍、release 0.018 秒的音符，总长约 69ms，短于十六分音符的 85ms。它缩短包络尾音，并不生成原录音中不存在的掌根闷音演奏法。修改 release 后重新播放以更新调度。
- 静音覆盖独奏；如果存在独奏轨道，仅播放未静音的独奏轨道。无有效音符轨以及静音轨不加载采样或音箱。零音量轨仍建立调度，以便播放中拉高音量后发声；零力度及工程范围以外的音符不调度。
- 以 AudioContext 时钟提前 180ms 调度，每 25ms 补充下一批；循环处使用下一轮准确时间，上一轮释放尾音可以自然衔接。
- 从中间开始时，处于按住状态的音符从录音的相应位置继续；停止时使用短淡出。
- 浏览器后台节流或设备切换可能中断实时播放。恢复时跳过已错过的事件，不会堆积补播。
- 缺少官方循环点的长音录音会在原始录音末尾自然结束。移调同时改变录音时长与音色；这不是高端采样器的独立时长伸缩。

## 导出

WAV：使用 `OfflineAudioContext` 按同一份演奏法/力度层/轮替采样分配、轨道混音、包络及效果链离线渲染，44.1kHz、16-bit PCM、立体声。记录最后一个录音声部的自然尾音，并额外留出 125ms，覆盖音箱的 100ms 卷积响应。导出总线固定 0.8 的主增益，界面监听音量不影响文件。浏览器内存限制下单次工程时长最多 5 分钟。离线导出不需要实时播放完整首曲子。

MIDI：SMF Format 1，每拍 480 ticks；独立速度/拍号轨、UTF-8 轨道名、GM 音色、音量和声像，保留各音符力度。无需先安装音源。MIDI 不包含音频，其他软件的 GM 音色会与本工具的采样不同。

标准 MIDI 仅有 16 个通道，其中第 10 通道用于鼓，因此最多输出 15 条独立旋律轨。底鼓/军鼓/闭镲/嗵鼓/悬镲/拍手分别映射 36/38/42/45/49/39；`rock-*` 对应鼓沿用相同映射。沙锤用 GM1 的 maracas 70 近似。同一鼓轨所有音高导出为对应 GM 鼓音。各鼓轨音量折算进音符力度；GM 鼓共用通道，不能保留各鼓轨独立声像。采样演奏法、轮替选择、原始录音补偿、包络 release、前级和音箱 IR 不写入 MIDI；需要保留这些实际音色请导出 WAV。

同一旋律轨内同音高重叠时，MIDI 会在下一次起音前关闭前一音符，保留每次重新弹奏；同一 tick 同音高合并为一个事件。同拍先写 note-off 再写 note-on，避免相邻音符互相截断。

## 过载、高增益前级与音箱

失真核心来自 [Tuna.js v1.1.2 的 Overdrive algorithm 0](https://github.com/Theodeus/tuna/blob/f7f45f28364ae44177c91e646dd5d3ba4499a818/tuna.js)，固定提交 `f7f45f28364ae44177c91e646dd5d3ba4499a818`，MIT 许可。移植代码和完整声明保存在 `src/vendor/tuna-overdrive.ts`，许可副本保存在 `docs/TUNA-LICENSE.txt`。

Tuna 分支保留原来的过载踏板功能。另外提供 MIT 开源 AmpSim3 的两级高增益前级，以及 Jester Brutal 的真实 CC0 音箱 IR；固定源代码版本、许可证、IR 来源和校验值见 [AMP-SOURCES.md](AMP-SOURCES.md)。前级由本地 AudioNode 执行；音箱录音按需下载，完成后可离线使用。

每条轨道可以保存可选设置：

```json
{
  "effects": {
    "enabled": true,
    "drive": 0.5,
    "tone": 0.5,
    "mix": 1,
    "output": 0.55,
    "ampModel": "high-gain",
    "cabinetId": "cab-v30-sm57"
  }
}
```

`ampModel` 省略或为 `none` 时选择 Tuna，`high-gain` 时选择 AmpSim3；两种高增益路径不会串联叠加。四个旋钮均为 0～1：drive 控制选定分支的驱动；tone 在 Tuna 分支控制 800Hz～12kHz 低通，在 AmpSim3 分支联动低/中/高/临场感滤波；mix 混合原始干声与经过前级及音箱的湿声；output 控制最终音量。关闭 `enabled` 时直通原声，无需加载已选但旁路的音箱。

信号路径：本轨所有音符混合 → Tuna 或 AmpSim3 分支 → 可选真实 IR 卷积 → 干湿混合 → 效果输出 → 轨道音量/声像 → 监听或导出主增益/压缩。先混合再失真使和弦进入同一个效果器。IR 必须按目标 AudioContext 的采样率解码，缓存按文件地址和采样率区分；缺少启用的 IR 时明确报错。

实时 `updateTrack` 用于既有链上的音量、声像和四个连续旋钮。修改音符、演奏法、release、静音/独奏、前级模式、音箱选择或需重新加载资源的启停状态后，应停止并重新播放以建立正确调度和音频链。

## 实现资料

- [MDN：AudioBufferSourceNode playbackRate](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate)
- [MDN：AudioBufferSourceNode start（offset 使用原始录音时间）](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start)
- [MDN：OfflineAudioContext startRendering](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/startRendering)

## 技术检查

`node --test tests/midi.test.mjs tests/sample-selection.test.mjs` 核验 MIDI 二进制事件、GM 鼓映射、通道分配，以及采样演奏法、力度层和轮替选择。

`node scripts/audio-smoke.mjs` 是只读浏览器技术检查入口，开发和生产服务均可使用：脚本用 esbuild 在内存中打包当前引擎，通过测试页路由加载，不要求服务暴露 `/src`，也不写入当前工程。它解码每个目录资源的首采样，再由引擎解码测试工程实际选中的全部录音；`kind: cabinet` 自动排除出可奏音轨。

检查范围包括 WAV 格式、四个效果旋钮、监听/导出隔离、实时更新、停止竞态、实际吉他录音经过 AmpSim3 与真实音箱 IR 后的 PCM 差异，以及旁路缺失 IR 和启用缺失 IR 的不同处理。采样库全量解码/文件完整性属于另一项资源核验，首采样抽查不能替代它。可以用 `KLEIN_URL` 修改默认 `http://127.0.0.1:4318`，用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定浏览器路径；Windows 上会查找现有系统 Chrome/Edge。技术检查不截图，也不代替听感验收。

整曲 PCM 非零只证明存在音频，不能证明每件乐器都可听。排查混音应分别渲染鼓、吉他、贝斯等声部，比较各分轨峰值、有效段 RMS 与同段伴奏电平；还应检查瞬态频谱、失真和音箱开关前后的分轨变化。最终听感由用户判断。
