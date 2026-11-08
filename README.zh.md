# Depth Loom

**把一张 2D 照片变成可拖拽的 3D 视差场景——全程在浏览器里完成。**

简体中文 | [English](README.md)

Depth Loom 用 Depth Anything V2 Small 在本地估计深度，并把照片渲染成轻微位移
的网格。图片不会上传，也没有后端。

> 状态：**M5 — 双语文档与加固后的 CI。** GitHub Pages 部署与在线 Demo 链接
> 待完成。

## 已实现

- 拖拽、点击或粘贴 JPG / PNG / WebP，最大 20 MB。
- 应用 EXIF 方向，并在送入 GPU 前把最长边缩放到 1024px。
- **Depth Anything V2 Small 运行在独立的 Web Worker 中**，模型文件由本站提供，
  运行时不请求 Hugging Face 或 CDN。
- **优先使用 WebGPU**（q4f16 权重）。WebGPU 不可用或管线初始化失败时，回退到
  **q8 WASM**，界面显示“CPU 模式 · 较慢”。
- 模型加载有字节进度；推理是独立状态；加载失败会显示明确错误并可重试。
- **3D 视图**：归一化深度场驱动 257×257 平面的 CPU 顶点位移；自定义片元着色器
  从深度纹理推导法线，并叠加基于深度的雾。5% 边缘外扩与 ±25°/±15° 的轨道限制
  把去遮挡问题挡在 MVP 之外。
- **深度强度滑杆（0–2×）**：实时生效，不重建几何。首次深度结果会自动切到 3D；
  原图与深度视图随时一键返回。
- 在原图、灰度深度和 3D 之间切换。深度图越亮表示越近。
- **三张内置 CC0 示例图**（山景、街景、猫肖像），无需上传。来源见
  [`public/samples/CREDITS.md`](public/samples/CREDITS.md)。
- **导出当前视图为 PNG**，或录制 **3 秒循环 WebM**（MediaRecorder + canvas
  capture，无音频）。
- **中英文界面**，默认中文，选择保存在 `localStorage`。`?depth=off` 为仅原图
  模式，会跳过模型。
- Worker 只保留一个管线实例；切换图片不会重新加载权重。
- 拖拽旋转（yaw ±25°、pitch ±15°，带橡皮筋回弹）、滚轮 / 双指缩放、方向键、
  Home 重置。按需渲染。
- 替换图片不会泄漏 WebGL 上下文；旧几何、纹理和材质会被释放。

## 本地开发

```bash
npm install
npx playwright install chromium   # 首次跑 E2E 需要
npm run dev                       # predev 会把 ONNX Runtime WASM 复制到 public/ort
```

模型文件已提交在 `public/models/depth-anything-v2-small/` 下，首次加载后即可离线
使用。需要重新生成并校验时：

```bash
npm run fetch:model
```

质量门禁：

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build                     # prebuild 会复制 ONNX Runtime WASM
npm run test:e2e
```

`npm run test:e2e` 会先通过 `pretest:e2e` 构建 `dist`，再用 `vite preview` 提供
服务，因此测试永远跑在当前提交上。真实模型流程（加载 + 推理 + 3 秒 WebM + 深度
PNG）在 WASM 回退下每个视口约 13 秒；桌面 + 375px 移动端全套约 45 秒。

## 架构

- `src/lib/depth/` — Worker 协议、q4f16 WebGPU → q8 WASM 回退、深度归一化。
- `src/lib/three/` — 舞台生命周期、轨道/输入状态机、CPU 顶点位移、深度着色器、
  捕获与导出。
- `src/hooks/` — 上传校验、深度状态机、导出状态。
- `src/components/` — 上传区、舞台包装、深度状态、控制条。
- `docs/decisions/` — ADR 0001（渲染）、0002（模型加载）、0003（导出）。

数据流见 [docs/architecture.md](docs/architecture.md)。

## 实测构建与性能

构建产物（生产构建）：

- 首屏 JS：**78.5 KB gzip**，CSS 5.1 KB。
- 懒加载 Three.js 舞台：**134.7 KB gzip**。
- 深度 Worker chunk：未压缩 1.29 MB，仅在图片就绪后加载。
- 自托管权重：共 **46.4 MB**（WebGPU 用 q4f16 19.1 MB，WASM 用 q8 27.3 MB）。
- ONNX Runtime WASM 在 dev/build 时生成到 `public/ort/`（每个后端 26–28 MB），
  不提交到仓库。

生产构建由本地服务器提供，三次运行取平均。每次运行界面都报告 **WebGPU**
（q4f16），因此这是真实的加速路径：

**WebGPU —— Microsoft Edge 157 headless，NVIDIA Ampere 适配器**

| 阶段 | 冷启动（首张图） | 第二张图（管线已热） |
|---|---|---|
| 解码 + 缩放 | 167 ms | 含在下方总时间内 |
| 模型加载 + 初始化 | 1.68 s | 约 1 ms（管线已在 Worker 内缓存） |
| 推理 | 1.31 s | 0.38 s |
| **到深度就绪总计** | **3.16 s** | **0.45 s** |

第一次冷启动包含浏览器预热（4.01 s），后两次分别为 2.71 s 和 2.74 s；热推理
耗时在 374–382 ms 之间。

**WASM q8 回退 —— headless Chromium 156，CPU**

| 阶段 | 冷启动（首张图） | 第二张图（管线已热） |
|---|---|---|
| 解码 + 缩放 | 114 ms | 含在下方总时间内 |
| 模型加载 + 初始化 | 1.88 s | 约 1 ms（管线已在 Worker 内缓存） |
| 推理 | 5.47 s | 5.85 s |
| **到深度就绪总计** | **7.46 s** | **6.04 s** |

机器：12th Gen Intel Core i7-12700H（14 核 / 20 线程）、15.8 GB 内存、
Windows 11。这是本地预览服务器上的平均值，不是基准测试——权重在本地，传输时间
可忽略。CI runner 没有 GPU，因此 E2E 始终跑 CPU 回退；WebGPU 数据来自本地实测。

- 测试：105 个单元/组件测试，14 个 E2E（桌面 Chromium、375px Chromium 含真实
  模型深度/导出流程、375px WebKit 子集）。
- 覆盖率：`src/lib` 与 `src/hooks` 范围内语句 92.4% / 分支 82.1%。WebGL、
  Worker 和下载胶水代码不在覆盖率分母内，由 E2E 覆盖。

首屏保持在 200 KB gzip 预算内。

## 技术栈

- React 19 + TypeScript + Vite
- Three.js（原生 API，不使用 react-three-fiber）
- Transformers.js 4.3.2 + 自托管 Depth Anything V2 Small
- ONNX Runtime Web（WASM + WebGPU），构建期自托管
- Vitest + Testing Library + Playwright
- MIT 许可

## 模型、示例与第三方许可

Depth Anything V2 Small 以 **Apache-2.0** 发布（Base / Large / Giant 为
CC-BY-NC-4.0，本项目未使用）。许可证、作者、来源链接、文件大小和 SHA-256 见
[`public/models/depth-anything-v2-small/MODEL_INFO.md`](public/models/depth-anything-v2-small/MODEL_INFO.md)。

三张示例图均为 **CC0 1.0**；作者与来源页面记录在
[`public/samples/CREDITS.md`](public/samples/CREDITS.md)。许可证全文见
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## 已知问题

- **WebGPU 不可用** → 使用 q8 WASM，速度较慢，界面会明确提示。
- **WebGPU 已在本地实测**（Edge 157，NVIDIA Ampere）。CI runner 没有 GPU，
  因此 E2E 始终跑 CPU 回退；WebGPU 数据不会随每个版本重新测量。
- **Safari 由 375px WebKit 子集覆盖**（布局、上传、i18n、示例、PNG）。真实模型
  深度流程与 WebM 导出仍只跑 Chromium，因为 WebKit 没有 WebM 编码器；Safari
  用户会看到明确的导出错误。
- **首次加载模型较大**（几十 MB）。Worker 在内存中缓存管线，之后切换图片是即时
  的；硬刷新可能重新拉取，HTTP 缓存可能有帮助。
- **没有 inpainting**：3D 视图限制在 ±25° yaw / ±15° pitch，再大就会在前景去遮
  挡处露缝。5% 边缘外扩和深度雾只能减轻边缘伪影，不能替代 inpainting。
- **深度强度是视觉控制，不是测量**；2× 是刻意夸张的效果。
- **WebM 导出需要支持 WebM 编码的 MediaRecorder**（目前是 Chrome / Edge /
  Firefox）。不支持的浏览器会显式报错。导出的 PNG 是叠加在应用深色背景上的
  扁平图，不是透明背景。
- 深度图是相对深度，不是度量深度，不适合测量、医疗或安全关键用途。

## 许可证

[MIT](./LICENSE) © 2026 Chunqi Sun
