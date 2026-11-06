import type {
  DepthClient,
  DepthEstimateRequest,
  DepthWorkerResponse,
} from './protocol'

export function createDepthWorker(
  onMessage: (message: DepthWorkerResponse) => void,
): DepthClient {
  if (typeof Worker === 'undefined') {
    throw new Error('This browser does not support Web Workers.')
  }

  const worker = new Worker(new URL('./depth.worker.ts', import.meta.url), {
    type: 'module',
  })

  worker.onmessage = (event: MessageEvent<DepthWorkerResponse>) => {
    onMessage(event.data)
  }

  worker.onerror = (event: ErrorEvent) => {
    onMessage({
      type: 'error',
      requestId: -1,
      message: event.message || 'Depth worker failed.',
    })
  }

  return {
    estimate(image, requestId, modelBase, ortBase) {
      const context = image.canvas.getContext('2d')
      if (!context) {
        onMessage({
          type: 'error',
          requestId,
          message: '无法读取图片像素。',
        })
        return
      }

      const imageData = context.getImageData(0, 0, image.width, image.height)
      const buffer = imageData.data.buffer as ArrayBuffer
      const request: DepthEstimateRequest = {
        type: 'estimate',
        requestId,
        buffer,
        width: image.width,
        height: image.height,
        modelBase,
        ortBase,
      }
      worker.postMessage(request, [buffer])
    },

    dispose() {
      worker.terminate()
    },
  }
}
