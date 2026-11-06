import { Color } from 'three'
import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { canvasToPng } from '../export/download'
import { clampAngle, YAW_LIMIT } from './orbit'

export interface StageCaptureContext {
  canvas: HTMLCanvasElement
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  group: Group
  getZoom: () => number
  getYaw: () => number
  getPitch: () => number
  setOrbit: (yaw: number, pitch: number, zoom: number) => void
  requestRender: () => void
}

export interface StageCaptureApi {
  capturePng: () => Promise<Blob>
  recordLoop: (durationMs?: number) => Promise<Blob>
}

const LOOP_YAW_AMPLITUDE = (8 * Math.PI) / 180

export function createStageCaptureApi(
  context: StageCaptureContext,
): StageCaptureApi {
  return {
    capturePng(): Promise<Blob> {
      context.renderer.render(context.scene, context.camera)
      return canvasToPng(context.canvas)
    },
    recordLoop(durationMs = 3000): Promise<Blob> {
      return recordLoop(context, durationMs)
    },
  }
}

async function recordLoop(
  context: StageCaptureContext,
  durationMs: number,
): Promise<Blob> {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof context.canvas.captureStream !== 'function'
  ) {
    throw new Error('This browser cannot record canvas video.')
  }

  const mimeType = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((type) => MediaRecorder.isTypeSupported(type))
  if (!mimeType) {
    throw new Error('This browser cannot encode WebM video.')
  }

  const stream = context.canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  })
  const chunks: BlobPart[] = []
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
    recorder.onerror = () => reject(new Error('Video recording failed.'))
  })

  const clearColor = context.renderer.getClearColor(new Color())
  const clearAlpha = context.renderer.getClearAlpha()
  const startYaw = context.getYaw()
  const startPitch = context.getPitch()
  const startZoom = context.getZoom()

  try {
    context.renderer.setClearColor(0x0a0a0b, 1)
    recorder.start(50)
    const start = performance.now()

    await new Promise<void>((resolve) => {
      const frame = (now: number): void => {
        const progress = Math.min(1, (now - start) / durationMs)
        const phase = Math.sin(progress * Math.PI * 2)
        context.setOrbit(
          clampAngle(startYaw + phase * LOOP_YAW_AMPLITUDE, YAW_LIMIT),
          startPitch,
          startZoom,
        )
        context.renderer.render(context.scene, context.camera)
        if (progress < 1) {
          requestAnimationFrame(frame)
        } else {
          resolve()
        }
      }
      requestAnimationFrame(frame)
    })

    recorder.stop()
    return await done
  } finally {
    stream.getTracks().forEach((track) => track.stop())
    context.renderer.setClearColor(clearColor, clearAlpha)
    context.setOrbit(startYaw, startPitch, startZoom)
    context.requestRender()
  }
}
