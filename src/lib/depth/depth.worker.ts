import { env, pipeline, RawImage } from '@huggingface/transformers'
import { normalizeDepth } from './normalize'
import type {
  DepthEstimateRequest,
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
let queue = Promise.resolve()

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
  return error instanceof Error ? error.message : '鏈煡閿欒'
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
