# XSXB-Band · 小宝乐队

**中文** | [English](README.en.md)

让 Agent 写谱，用真实录音的乐器演奏。

XSXB-Band 是一个本地编曲工作室，配套一个 Agent skill。你在聊天窗口里描述想要的音乐，Agent 写出一份每个音都能改的乐谱，工作室用真人演奏、真实录音的乐器把它演奏出来，导出 WAV、MIDI 和分轨。不调用任何音乐生成模型，也不需要 API Key。

## 为什么做这个

Agent 做视频时配的背景音乐，通常是它写代码用正弦波、方波“算”出来的：音色从头到尾一个样，每个音一样响、死死卡在拍子上，而写代码的 AI 自己听不见。

XSXB-Band 换了一个分工：谱子本质上是文字，交给 AI 写；演奏交给真实录音。播放引擎会为每个音找最近的录音、按力度换用轻重不同的录音、轮换同一个音的多次录音，再加一点人性化和混响。AI 听不见，就看渲染报告里的电平和削波自己调平衡。

## 交给 Agent 安装

不需要自己研究 Node.js 和构建命令。把仓库地址发给你的 Agent（Claude Code、Codex 等能读文档、能跑命令的 Agent），并发送：

> 请安装 XSXB-Band：https://github.com/sparklecatta-lang/XSXB-Band 。按仓库里的 AGENTS.md 安装依赖、构建、测试、启动服务，并把 skill 装好。不要预先下载整个音源库。

Agent 会从 [AGENTS.md](AGENTS.md) 读取安装步骤。手动安装：需要 Node.js 22.12+（推荐 24 LTS），运行 `npm ci`、`npm run build`、`npm start`（Windows 可双击 `start.bat`），然后打开 http://127.0.0.1:4318 ，再把 `skills/xsxb-band/` 复制进 Agent 的 skills 目录。

## 怎么用

用起来跟用 Suno 差不多，只是对面是你的 Agent：

> 做一段三十秒的古风，萧瑟一点，负能量，适合做氛围。

> 弄个 trap beat，一惊一乍的那种。

> 给这段过场动画配乐，前半段民乐铺垫，Boss 起身时转成金属。

Agent 会挑乐器、写谱、渲染、看报告调平衡，最后给你音频，并把可编辑的工程存进歌曲库。不满意就接着说：“二胡往后放一放”“改成一分钟”“换成爵士”。

想自己动手，打开 http://127.0.0.1:4318 ：钢琴卷帘、鼓机、每轨音量 / 声像 / 混响、奏法和吉他效果都可以直接改。操作说明见 [docs/GUIDE.md](docs/GUIDE.md)。

`examples/` 里有六个不同风格的示范工程（古风、爵士、电影配乐、trap、治愈民谣、民乐金属），可以让 Agent 打开来改。

## 乐器

42 种真实录音的乐器，外加 2 个实测箱体 IR 和 4 个 NAM 神经网络箱头模型：

| 类别 | 乐器 |
| --- | --- |
| 键盘 | 立式钢琴、FM 电钢琴（Yamaha TX81Z） |
| 弦乐与吉他 | 小提琴组、大提琴组、竖琴、原声吉他、干净电吉他、分层电吉他（延音 / 短奏）、实心电吉他直录 |
| 低音 | 低音提琴、拨片电贝斯、808 低音 |
| 管乐 | 长笛、次中音萨克斯、圆号、小号、长号 |
| 敲击 | 马林巴、颤音琴、卡林巴、定音鼓、大锣 |
| 鼓 | 分层架子鼓（底鼓、军鼓、踩镲、嗵鼓、吊镲）、Roland TR-808（底鼓、军鼓、拍手、踩镲、边击 / 牛铃 / 响棒 / 沙锤）、基础鼓件 |
| 民乐 | 筝（越南筝）、笛子、二胡 |

实时列表以 `/api/library` 为准。

## 音源与下载

- **仓库里没有任何音频。** `public/library.json` 只记录每个文件的作者仓库、固定版本下载地址、大小、SHA-256 和许可。
- 工程用到某个乐器时，工作室会从作者的原始地址自动下载到本机 `data/samples/`，校验通过才使用。只下载用得到的乐器；全部下载约 1.5 GB。
- 乐器录音全部是 CC0（作者放弃版权）。NAM 箱头模型是 GPL-3.0，同样只按需下载、不随仓库分发。
- 来源与逐文件记录：[docs/SAMPLE-LICENSES.md](docs/SAMPLE-LICENSES.md)、[docs/REALISM-SOURCES.md](docs/REALISM-SOURCES.md)、[docs/HIPHOP-SOURCES.md](docs/HIPHOP-SOURCES.md)、[docs/METAL-SAMPLE-LICENSES.md](docs/METAL-SAMPLE-LICENSES.md)、[docs/AMP-SOURCES.md](docs/AMP-SOURCES.md)。

## 限制

- 808 低音没有滑音（glide），采样没有循环点，长音会随录音自然结束。
- 筝是越南筝的录音，不是古筝；笛子、二胡是有损的公开试听版，只有一层力度。
- 没有真实的掌根闷音、推弦或连奏；开镲不会被闭镲切断。
- AI 不会替你判断好不好听，最后要靠你的耳朵。

## 给开发者

- 接口：[docs/AGENT-API.md](docs/AGENT-API.md)；音频引擎：[docs/AUDIO.md](docs/AUDIO.md)。
- `npm run dev` 开发模式，`npm test` 运行测试。
- 命令行：`node scripts/agent.mjs`（读写工程、歌曲库、下载音源）。

## 许可

代码以 [MIT](LICENSE) 许可发布。音源不属于本仓库，各自遵循原作者的许可（乐器录音 CC0，NAM 模型 GPL-3.0）。第三方代码见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
