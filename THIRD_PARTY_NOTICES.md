# Third-party notices / 第三方声明

XSXB-Band's own code is MIT-licensed (see `LICENSE`). The components below are bundled or adapted and keep their own licences.
XSXB-Band 自身代码以 MIT 发布；下列组件为内置或改编，保留各自的许可。

## Bundled code / 内置代码

| Component | Where | Licence |
| --- | --- | --- |
| [neural-amp-modeler-wasm](https://github.com/tone-3000/neural-amp-modeler-wasm) 2.0.1 (engine part) | `src/vendor/nam/`, `public/nam/` | MIT, © 2026 TONE3000 |
| [NeuralAmpModelerCore](https://github.com/sdatkinson/NeuralAmpModelerCore) (compiled into `nam-engine.wasm`) | `public/nam/nam-engine.wasm` | MIT, © 2023 Steven Atkinson |
| [Eigen](https://gitlab.com/libeigen/eigen) (compiled into `nam-engine.wasm`) | `public/nam/nam-engine.wasm` | MPL-2.0 — source: https://gitlab.com/libeigen/eigen |
| [nlohmann/json](https://github.com/nlohmann/json) (compiled into `nam-engine.wasm`) | `public/nam/nam-engine.wasm` | MIT, © 2013-2026 Niels Lohmann |
| [Tuna.js](https://github.com/Theodeus/tuna) Overdrive algorithm 0, adapted | `src/vendor/tuna-overdrive.ts` | MIT, © 2012 DinahMoe AB & Oskar Eriksson — see `docs/TUNA-LICENSE.txt` |
| [AmpSim3](https://github.com/micbuffa/WebAudio-Guitar-Amplifier-Simulator-3) preamp curves, adapted | `src/vendor/ampsim3-curves.ts` | MIT, © 2016 micbuffa — see `docs/AMPSIM-LICENSE.txt` |

npm dependencies (React, Express, Vite, lucide-react, …) are installed by `npm ci` and carry their own licences in `node_modules/`.

## Downloaded on demand, not distributed / 按需下载、不随仓库分发

- Instrument recordings: CC0 1.0, from the authors' public repositories listed in `public/library.json` and `docs/SAMPLE-LICENSES.md`.
- Guitar-cabinet IRs (Jester's Brutal Pack): CC0 1.0 — `docs/AMP-SOURCES.md`.
- NAM amp models from [pelennor2170/NAM_models](https://github.com/pelennor2170/NAM_models): GPL-3.0, authors credited in `public/library.json` — `docs/REALISM-SOURCES.md`.

---

## Licence texts

### tone-3000/neural-amp-modeler-wasm

```text
MIT License

Copyright (c) 2026 TONE3000

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### sdatkinson/NeuralAmpModelerCore

```text
MIT License

Copyright (c) 2023 Steven Atkinson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### nlohmann/json

```text
MIT License

Copyright (c) 2013-2026 Niels Lohmann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### micbuffa/WebAudio-Guitar-Amplifier-Simulator-3

```text
The MIT License (MIT)

Copyright (c) 2016 micbuffa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

