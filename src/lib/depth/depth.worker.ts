import { env, pipeline, RawImage } from '@huggingface/transformers'
import * as ort from 'onnxruntime-web/all'
import { buildForegroundMask, computeDepthThreshold } from './mask'
import { normalizeDepth } from './normalize'
import type {
  DepthEstimateRequest,
  DepthMap,
  DepthMode,
  DepthWorkerResponse,
} from './protocol'

interface DepthTensor {
  data: Float32Array | ArrayLike<number>
  dims: number[]
}

interface DepthEstimator {
  (image: RawImage): Promise<{ predicted_depth: DepthTensor }>
}

interface ProgressInfo {
  status: string
  file?: string
  loaded?: number
  total?: number
  progress?: number
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<DepthEstimateRequest>) => void) | null
  postMessage: (message: DepthWorkerResponse, transfer?: Transferable[]) => void
}

const scope = self as unknown as WorkerScope
const MODEL_ID = 'depth-anything-v2-small'

let estimatorPromise: Promise<{ estimator: DepthEstimator; mode: DepthMode }> | null =
  null
let inpaintSessionPromise: Promise<ort.InferenceSession> | null = null
let queue = Promise.resolve()

const INPAINT_MODEL = 'lama/inpainting_lama_2025jan.onnx'
const INPAINT_SIZE = 512
const INPAINT_DILATION = 3

function post(message: DepthWorkerResponse, transfer?: Transferable[]): void {
  scope.postMessage(message, transfer)
}

function normalizeBase(base: string): string {
  return base.endsWith('/') ? base : `${base}/`
}

function configureEnvironment(modelBase: string): void {
  env.allowLocalModels = true
  env.allowRemoteModels = false
  env.localModelPath = normalizeBase(modelBase)
  // The browser CacheStorage write can fail for the large q8 weights in some
  // Chromium profiles (ERR_CACHE_WRITE_FAILURE), which surfaces as a fatal
  // network error. The worker keeps the pipeline in memory, so switching
  // images still never reloads the weights.
  env.useBrowserCache = false

  const wasm = env.backends.onnx.wasm
  if (wasm) {
    wasm.numThreads = 1
    wasm.proxy = false
  }
}

type GpuNavigator = Navigator & {
  gpu?: {
    requestAdapter?: () => Promise<unknown | null>
  }
}

async function hasWebGpuAdapter(): Promise<boolean> {
  const gpu = (navigator as GpuNavigator).gpu
  if (!gpu?.requestAdapter) return false
  try {
    return (await gpu.requestAdapter()) !== null
  } catch {
    return false
  }
}

function setWasmDirectory(ortBase: string): void {
  const wasm = env.backends.onnx.wasm
  if (wasm) {
    wasm.wasmPaths = normalizeBase(ortBase)
  }
}

function setAsyncifyWasm(ortBase: string): void {
  const wasm = env.backends.onnx.wasm
  if (!wasm) return
  const base = normalizeBase(ortBase)
  wasm.wasmPaths = {
    wasm: new URL('ort-wasm-simd-threaded.asyncify.wasm', base).href,
    mjs: new URL('ort-wasm-simd-threaded.asyncify.mjs', base).href,
  }
}

function createProgressCallback(requestId: number) {
  return (info: ProgressInfo): void => {
    if (info.status !== 'progress_total') return
    const loaded = info.loaded ?? 0
    const total = info.total ?? 0
    const progress = info.progress ?? (total > 0 ? (loaded / total) * 100 : 0)
    post({ type: 'progress', requestId, loaded, total, progress })
  }
}

async function loadEstimator(
  requestId: number,
  modelBase: string,
  ortBase: string,
): Promise<{ estimator: DepthEstimator; mode: DepthMode }> {
  configureEnvironment(modelBase)
  const progress_callback = createProgressCallback(requestId)
  let webgpuFailure: unknown = null

  if (await hasWebGpuAdapter()) {
    setWasmDirectory(ortBase)
    try {
      const estimator = (await pipeline('depth-estimation', MODEL_ID, {
        device: 'webgpu',
        dtype: 'q4f16',
        progress_callback,
        local_files_only: true,
      })) as unknown as DepthEstimator
      return { estimator, mode: 'webgpu' }
    } catch (error) {
      webgpuFailure = error
    }
  }

  // WebGPU can be missing, blocklisted, or unable to run this graph.
  // Fall back to the q8 WASM export, which is the compatibility floor.
  setAsyncifyWasm(ortBase)
  try {
    const estimator = (await pipeline('depth-estimation', MODEL_ID, {
      device: 'wasm',
      dtype: 'q8',
      progress_callback,
      local_files_only: true,
    })) as unknown as DepthEstimator
    return { estimator, mode: 'wasm' }
  } catch (wasmError) {
    const webgpuDetail = webgpuFailure
      ? ` || WebGPU: ${errorMessage(webgpuFailure)}`
      : ''
    throw new Error(
      `WASM fallback failed: ${errorMessage(wasmError)}${webgpuDetail}`,
    )
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误'
}

function configureOrt(ortBase: string): void {
  ort.env.logLevel = 'error'
  ort.env.wasm.wasmPaths = normalizeBase(ortBase)
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
}

async function fetchModelBuffer(
  url: string,
  requestId: number,
): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Inpaint model request failed: ${response.status}`)
  }

  const total = Number(response.headers.get('content-length') ?? 0)
  const reader = response.body?.getReader()
  if (!reader) return response.arrayBuffer()

  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    chunks.push(value)
    loaded += value.length
    post({
      type: 'inpaint-progress',
      requestId,
      loaded,
      total,
      progress: total > 0 ? (loaded / total) * 100 : 0,
    })
  }

  const merged = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged.buffer
}

async function createInpaintSession(
  buffer: ArrayBuffer,
): Promise<ort.InferenceSession> {
  return ort.InferenceSession.create(buffer, { executionProviders: ['wasm'] })
}

async function getInpaintSession(
  requestId: number,
  modelBase: string,
  ortBase: string,
): Promise<ort.InferenceSession> {
  if (!inpaintSessionPromise) {
    configureOrt(ortBase)
    post({ type: 'background-start', requestId })
    const url = `${normalizeBase(modelBase)}${INPAINT_MODEL}`
    inpaintSessionPromise = fetchModelBuffer(url, requestId)
      .then((buffer) => createInpaintSession(buffer))
      .catch((error: unknown) => {
        inpaintSessionPromise = null
        throw error
      })
  }
  return inpaintSessionPromise
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface MaskBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function findForegroundBounds(
  mask: Uint8Array,
  width: number,
  height: number,
): MaskBounds | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY }
}

/** Bilinear foreground weight in depth coordinates; 1 = fill. */
function foregroundWeightAt(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const cx = clamp(x - 0.5, 0, width - 1)
  const cy = clamp(y - 0.5, 0, height - 1)
  const x0 = Math.floor(cx)
  const y0 = Math.floor(cy)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const fx = cx - x0
  const fy = cy - y0
  const value = (px: number, py: number): number =>
    mask[py * width + px] === 0 ? 1 : 0
  const top = value(x0, y0) * (1 - fx) + value(x1, y0) * fx
  const bottom = value(x0, y1) * (1 - fx) + value(x1, y1) * fx
  return top * (1 - fy) + bottom * fy
}

async function runInpainting(
  request: DepthEstimateRequest,
  depthData: Float32Array,
  depthWidth: number,
  depthHeight: number,
): Promise<void> {
  const threshold = computeDepthThreshold(depthData)
  if (threshold === null) return

  const depth: DepthMap = {
    data: depthData,
    width: depthWidth,
    height: depthHeight,
  }
  const lowMask = buildForegroundMask(depth, threshold, INPAINT_DILATION)
  const bounds = findForegroundBounds(lowMask, depthWidth, depthHeight)
  if (!bounds) return

  const session = await getInpaintSession(
    request.requestId,
    request.modelBase,
    request.ortBase,
  )

  const imageWidth = request.width
  const imageHeight = request.height
  const depthPerPixelX = depthWidth / imageWidth
  const depthPerPixelY = depthHeight / imageHeight
  const padding = Math.max(
    16,
    Math.round(Math.max(imageWidth, imageHeight) * 0.04),
  )
  const left = clamp(
    Math.floor(bounds.minX / depthPerPixelX) - padding,
    0,
    imageWidth - 1,
  )
  const top = clamp(
    Math.floor(bounds.minY / depthPerPixelY) - padding,
    0,
    imageHeight - 1,
  )
  const right = clamp(
    Math.ceil((bounds.maxX + 1) / depthPerPixelX) + padding,
    left + 1,
    imageWidth,
  )
  const bottom = clamp(
    Math.ceil((bounds.maxY + 1) / depthPerPixelY) + padding,
    top + 1,
    imageHeight,
  )
  const cropWidth = right - left
  const cropHeight = bottom - top

  const rgba = new Uint8ClampedArray(request.buffer)
  const size = INPAINT_SIZE
  const imageInput = new Float32Array(3 * size * size)
  const maskInput = new Float32Array(size * size)

  for (let y = 0; y < size; y += 1) {
    const sourceY = top + ((y + 0.5) / size) * cropHeight - 0.5
    const y0 = clamp(Math.floor(sourceY), 0, imageHeight - 1)
    const y1 = Math.min(imageHeight - 1, y0 + 1)
    const fy = sourceY - y0
    for (let x = 0; x < size; x += 1) {
      const sourceX = left + ((x + 0.5) / size) * cropWidth - 0.5
      const x0 = clamp(Math.floor(sourceX), 0, imageWidth - 1)
      const x1 = Math.min(imageWidth - 1, x0 + 1)
      const fx = sourceX - x0
      const index00 = (y0 * imageWidth + x0) * 4
      const index10 = (y0 * imageWidth + x1) * 4
      const index01 = (y1 * imageWidth + x0) * 4
      const index11 = (y1 * imageWidth + x1) * 4
      const target = y * size + x

      for (let channel = 0; channel < 3; channel += 1) {
        const topValue =
          rgba[index00 + channel] * (1 - fx) +
          rgba[index10 + channel] * fx
        const bottomValue =
          rgba[index01 + channel] * (1 - fx) +
          rgba[index11 + channel] * fx
        imageInput[channel * size * size + target] =
          (topValue * (1 - fy) + bottomValue * fy) / 255
      }

      maskInput[target] =
        foregroundWeightAt(
          lowMask,
          depthWidth,
          depthHeight,
          (sourceX + 0.5) * depthPerPixelX,
          (sourceY + 0.5) * depthPerPixelY,
        ) > 0.5
          ? 1
          : 0
    }
  }

  const output = await session.run({
    image: new ort.Tensor('float32', imageInput, [1, 3, size, size]),
    mask: new ort.Tensor('float32', maskInput, [1, 1, size, size]),
  })
  const result = output.output ?? Object.values(output)[0]
  const data = result.data as Float32Array

  const background = new Uint8ClampedArray(rgba)
  for (let y = top; y < bottom; y += 1) {
    const outputY = clamp(
      ((y + 0.5 - top) / cropHeight) * size - 0.5,
      0,
      size - 1,
    )
    const y0 = Math.floor(outputY)
    const y1 = Math.min(size - 1, y0 + 1)
    const fy = outputY - y0
    for (let x = left; x < right; x += 1) {
      const outputX = clamp(
        ((x + 0.5 - left) / cropWidth) * size - 0.5,
        0,
        size - 1,
      )
      const x0 = Math.floor(outputX)
      const x1 = Math.min(size - 1, x0 + 1)
      const fx = outputX - x0
      const alphaRaw = foregroundWeightAt(
        lowMask,
        depthWidth,
        depthHeight,
        (x + 0.5) * depthPerPixelX,
        (y + 0.5) * depthPerPixelY,
      )
      if (alphaRaw <= 0) continue
      const alpha = alphaRaw * alphaRaw * (3 - 2 * alphaRaw)
      const target = (y * imageWidth + x) * 4

      for (let channel = 0; channel < 3; channel += 1) {
        const topValue =
          data[channel * size * size + y0 * size + x0] * (1 - fx) +
          data[channel * size * size + y0 * size + x1] * fx
        const bottomValue =
          data[channel * size * size + y1 * size + x0] * (1 - fx) +
          data[channel * size * size + y1 * size + x1] * fx
        const generated = topValue * (1 - fy) + bottomValue * fy
        background[target + channel] = Math.round(
          rgba[target + channel] * (1 - alpha) + generated * alpha,
        )
      }
    }
  }

  post(
    {
      type: 'background',
      requestId: request.requestId,
      buffer: background.buffer,
      width: imageWidth,
      height: imageHeight,
    },
    [background.buffer],
  )
}

async function handleEstimate(request: DepthEstimateRequest): Promise<void> {
  try {
    if (!estimatorPromise) {
      estimatorPromise = loadEstimator(
        request.requestId,
        request.modelBase,
        request.ortBase,
      )
    }

    const { estimator, mode } = await estimatorPromise
    post({ type: 'ready', requestId: request.requestId, mode })
    post({ type: 'estimating', requestId: request.requestId })

    const image = new RawImage(
      new Uint8ClampedArray(request.buffer),
      request.width,
      request.height,
      4,
    )
    const output = await estimator(image)
    const predicted = output.predicted_depth
    const dims = predicted.dims
    const height = dims[dims.length - 2] ?? request.height
    const width = dims[dims.length - 1] ?? request.width
    const normalized = normalizeDepth(predicted.data)
    const backgroundDepth = normalized.slice()
    const buffer = normalized.buffer as ArrayBuffer

    post(
      {
        type: 'result',
        requestId: request.requestId,
        buffer,
        width,
        height,
        mode,
      },
      [buffer],
    )

    void runInpainting(request, backgroundDepth, width, height).catch(
      (inpaintError: unknown) => {
        post({
          type: 'background-error',
          requestId: request.requestId,
          message: errorMessage(inpaintError),
        })
      },
    )
  } catch (error) {
    estimatorPromise = null
    post({
      type: 'error',
      requestId: request.requestId,
      message: errorMessage(error),
    })
  }
}

scope.onmessage = (event: MessageEvent<DepthEstimateRequest>): void => {
  const request = event.data
  if (request.type !== 'estimate') return
  queue = queue.then(() => handleEstimate(request)).catch(() => {})
}
