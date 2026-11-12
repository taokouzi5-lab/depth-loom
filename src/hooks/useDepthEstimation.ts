import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProcessedImage } from '../lib/image/decode'
import type {
  BackgroundImage,
  BackgroundStatus,
  CreateDepthClient,
  DepthClient,
  DepthMap,
  DepthProgress,
  DepthState,
  DepthWorkerResponse,
} from '../lib/depth/protocol'

export interface UseDepthEstimationResult extends DepthState {
  retry: () => void
  background: BackgroundImage | null
  backgroundStatus: BackgroundStatus
  backgroundProgress: DepthProgress | null
}

function createIdleState(): DepthState {
  return {
    status: 'idle',
    progress: null,
    mode: null,
    depth: null,
    error: null,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误'
}

export function useDepthEstimation(
  image: ProcessedImage | null,
  createClient: CreateDepthClient,
): UseDepthEstimationResult {
  const [state, setState] = useState<DepthState>(createIdleState)
  const [background, setBackground] = useState<BackgroundImage | null>(null)
  const [backgroundStatus, setBackgroundStatus] =
    useState<BackgroundStatus>('idle')
  const [backgroundProgress, setBackgroundProgress] =
    useState<DepthProgress | null>(null)
  const clientRef = useRef<DepthClient | null>(null)
  const activeRequest = useRef(0)
  const lastImage = useRef<ProcessedImage | null>(null)
  const mounted = useRef(true)

  const handleMessage = useCallback((message: DepthWorkerResponse) => {
    if (!mounted.current) return

    if (message.type === 'progress') {
      // Model loading is global to the worker. Accept progress even when a
      // newer image has superseded the request that triggered the load.
      setState((previous) =>
        previous.status === 'loading'
          ? {
              ...previous,
              progress: {
                loaded: message.loaded,
                total: message.total,
                progress: message.progress,
              },
            }
          : previous,
      )
      return
    }

    if (message.requestId !== -1 && message.requestId !== activeRequest.current) {
      return
    }

    if (message.type === 'background-start') {
      setBackground(null)
      setBackgroundStatus('loading')
      setBackgroundProgress(null)
      return
    }

    if (message.type === 'inpaint-progress') {
      setBackgroundStatus('loading')
      setBackgroundProgress({
        loaded: message.loaded,
        total: message.total,
        progress: message.progress,
      })
      return
    }

    if (message.type === 'background') {
      setBackground({
        buffer: message.buffer,
        width: message.width,
        height: message.height,
      })
      setBackgroundStatus('ready')
      setBackgroundProgress(null)
      return
    }

    if (message.type === 'background-error') {
      setBackgroundStatus('error')
      setBackgroundProgress(null)
      return
    }

    if (message.type === 'ready') {
      setState((previous) => ({
        ...previous,
        status: 'estimating',
        mode: message.mode,
        progress: null,
        error: null,
      }))
    } else if (message.type === 'estimating') {
      setState((previous) =>
        previous.status === 'estimating'
          ? previous
          : { ...previous, status: 'estimating', progress: null },
      )
    } else if (message.type === 'result') {
      const depth: DepthMap = {
        data: new Float32Array(message.buffer),
        width: message.width,
        height: message.height,
      }
      setState({
        status: 'ready',
        progress: null,
        mode: message.mode,
        depth,
        error: null,
      })
    } else if (message.type === 'error') {
      setState((previous) => ({
        ...previous,
        status: 'error',
        progress: null,
        depth: null,
        error: message.message,
      }))
    }
  }, [])

  const start = useCallback(
    (nextImage: ProcessedImage, forceNewClient = false) => {
      lastImage.current = nextImage

      if (forceNewClient) {
        clientRef.current?.dispose()
        clientRef.current = null
      }

      let client = clientRef.current
      if (!client) {
        try {
          client = createClient(handleMessage)
          clientRef.current = client
        } catch (error) {
          setState({
            status: 'error',
            progress: null,
            mode: null,
            depth: null,
            error: errorMessage(error),
          })
          return
        }
      }

      const requestId = activeRequest.current + 1
      activeRequest.current = requestId
      setBackground(null)
      setBackgroundStatus('idle')
      setBackgroundProgress(null)
      setState({
        status: 'loading',
        progress: null,
        mode: null,
        depth: null,
        error: null,
      })

      try {
        client.estimate(
          nextImage,
          requestId,
          // A path (not an absolute URL) keeps Transformers.js' local-file
          // metadata check on the local branch, so it can detect
          // preprocessor_config.json next to the weights.
          new URL('models/', document.baseURI).pathname,
          new URL('ort/', document.baseURI).href,
        )
      } catch (error) {
        setState({
          status: 'error',
          progress: null,
          mode: null,
          depth: null,
          error: errorMessage(error),
        })
      }
    },
    [createClient, handleMessage],
  )

  useEffect(() => {
    if (!image) return
    // Starting a worker is an external-system effect; the status transition is
    // the observable result of creating it.
    // oxlint-disable-next-line react/set-state-in-effect
    start(image)
  }, [image, start])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clientRef.current?.dispose()
      clientRef.current = null
    }
  }, [])

  const retry = useCallback(() => {
    const current = lastImage.current
    if (current) {
      start(current, true)
    }
  }, [start])

  return {
    ...state,
    retry,
    background,
    backgroundStatus,
    backgroundProgress,
  }
}
