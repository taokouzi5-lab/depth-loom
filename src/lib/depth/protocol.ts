export type DepthMode = 'webgpu' | 'wasm'

export type DepthStatus = 'idle' | 'loading' | 'estimating' | 'ready' | 'error'

export interface DepthProgress {
  loaded: number
  total: number
  progress: number
}

export interface DepthMap {
  /** Row-major normalized values in [0, 1]; 1 is near. */
  data: Float32Array
  width: number
  height: number
}

export interface DepthState {
  status: DepthStatus
  progress: DepthProgress | null
  mode: DepthMode | null
  depth: DepthMap | null
  error: string | null
}

export interface DepthEstimateRequest {
  type: 'estimate'
  requestId: number
  buffer: ArrayBuffer
  width: number
  height: number
  modelBase: string
  ortBase: string
}

export type DepthWorkerResponse =
  | {
      type: 'progress'
      requestId: number
      loaded: number
      total: number
      progress: number
    }
  | { type: 'ready'; requestId: number; mode: DepthMode }
  | { type: 'estimating'; requestId: number }
  | {
      type: 'result'
      requestId: number
      buffer: ArrayBuffer
      width: number
      height: number
      mode: DepthMode
    }
  | { type: 'error'; requestId: number; message: string }

export interface DepthClient {
  estimate(
    image: import('../image/decode').ProcessedImage,
    requestId: number,
    modelBase: string,
    ortBase: string,
  ): void
  dispose(): void
}

export type CreateDepthClient = (
  onMessage: (message: DepthWorkerResponse) => void,
) => DepthClient
