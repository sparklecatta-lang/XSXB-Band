# 高增益前级与真实音箱响应

## 开源前级

采用 Michel Buffa 的 [WebAudio-Guitar-Amplifier-Simulator-3](https://github.com/micbuffa/WebAudio-Guitar-Amplifier-Simulator-3)，固定提交 `63c9faad4132780fc75cb0380ac60e3f926e004a`。该版本 [LICENSE](https://github.com/micbuffa/WebAudio-Guitar-Amplifier-Simulator-3/blob/63c9faad4132780fc75cb0380ac60e3f926e004a/LICENSE) 明确为 MIT，Copyright (c) 2016 micbuffa。

移植的是 `js/amp.js` 的两级前级和音色滤波拓扑，以及 `js/distorsionFactory.js` 中 `asymetric`、`classicDistorsion` 的实际传递曲线。代码位于 `src/amp.ts` 和 `src/vendor/ampsim3-curves.ts`；完整许可保留在 `docs/AMPSIM-LICENSE.txt`。

本地改动包括移除 DOM/全局状态、归一化驱动与明暗旋钮、8192 项曲线表、4×过采样、70Hz 输入高通和适度电平补偿。它是开源算法的前级模拟，不是对特定实体音箱逐电路测量的精确克隆，也不包含神经网络或音乐生成模型。

## 音箱 IR

真实测量音箱响应来自 [Jester Dyne Productions — Jester's Brutal Pack 1.0](https://www.jester-dyne-productions.com/brutal-ir-pack/)。[作者原始 ZIP](https://www.jester-dyne-productions.com/content/files/2023/04/JestersBrutalPack_1.0.zip) 内 `Jesters Brutal IR Pack Handbook.pdf` 第 2 页明确声明 CC0，第 4 页列出麦克风与单元，第 5 页列出箱体/测量信息。

选入两个测量配置，均为改装加大 Behringer BG412S 4×12 音箱：

| ID | 作者原名 | 单元 / 麦克风 | 单文件下载 |
| --- | --- | --- | --- |
| cab-v30-sm57 | Cookie Monster | Celestion Vintage 30 / Shure SM57 | [原始 WAV 镜像](https://darwinscat.com/sound-utils/cabinet-ir-utility/samples/01-cookie-monster.wav) |
| cab-dv77-sm57 | Darth Genocider | Eminence DV-77 / Shure SM57 | [原始 WAV 镜像](https://darwinscat.com/sound-utils/cabinet-ir-utility/samples/02-darth-genocider.wav) |

镜像由 [Darwin's Cat](https://darwinscat.com/sound-utils/cabinet-ir-utility) 提供。两个单文件的 SHA-256 已分别与作者 ZIP 内 48kHz 目录同名音频逐字节核对一致。

- V30：172304 字节；`48b4e8dc8bde8595f8b8153128e99debd981c30b2b7a427e8bf8f3db0a84f49f`。
- DV-77：160152 字节；`92e702fa7cf3d9f5f8bddb9e27c5f7cbdf770c60334b1db9681dfdb1af27bdc9`。

原文件为单声道、48kHz、24-bit PCM，长度约 1.196s / 1.112s。软件目录保存来源、许可和下载地址，音频由用户下载至本地缓存，不随源码或发行包分发。没有把纯滤波频响冒称测量 IR。

## 接口与信号路径

```ts
createTrackEffect(context, {
  enabled: true,
  drive: 0.55,
  tone: 0.50,
  mix: 1,
  output: 0.55,
  ampModel: 'high-gain',
  cabinetId: 'cab-v30-sm57',
}, { cabinetBuffer });
```

`ampModel` 省略或为 `none` 时使用原 Tuna 过载；`high-gain` 时选择 AmpSim3 两级前级，绕过 Tuna 过载，避免重复叠加高增益。四个旋钮仍工作：drive 调整所选前级，tone 调整该前级音色，mix 控制完整湿声与原始干声的比例，output 控制最终输出。需要完整吉他音箱音色时 mix 使用 1。

高增益路径：输入高通 → 720/320Hz 低频棚架衰减 → 增益及非对称失真 → 去直流 → 720Hz 棚架衰减 → 第二级增益及对称失真 → 低/中/高/临场感音色滤波 → 可选真实 IR 卷积 → 干湿混合 → 输出。省略 cabinetId 允许只使用前级。效果器启用且指定 cabinetId 时，缺少已解码 buffer 会明确报错，不会静默改用滤波器；效果器旁路时可以保存音箱选择但不下载或建立卷积节点。

IR 按实时或离线目标 `context.sampleRate` 分别解码，`AudioEngine` 以文件地址和采样率为键缓存。`prepareCabinetBuffer` 在内存中裁取前 100ms，末尾 2ms 淡出；两条已选 IR 的原始能量超过 99.9% 都在该窗口内。这使快速节奏避免长房间尾音，不改动下载缓存原件。以 1kHz 传递响应做单位增益校准，关闭浏览器 `ConvolverNode.normalize`，避免不同文件长度导致不可控音量变化。WAV 渲染在最后声部结束后额外保留 125ms，覆盖该卷积尾音。

实时播放和 OfflineAudioContext 都使用同一原生 AudioNode 链。更换 cabinetId 需要重新加载并建立轨道链；从缺少 IR 的旁路状态启用效果器也需加载资源后重建。既有 drive/tone/mix/output 可实时更新。目录把 IR 标为 `kind: "cabinet"`，它们不会作为可奏乐器加入音轨。

建议首轮检查从 drive 0.45～0.60、tone 0.45～0.55、mix 1、output 0.45～0.60 开始，节奏吉他轨音量约 0.45～0.60。混音需与实际鼓分轨电平共同调整，这些参数不是听感验收结果。
