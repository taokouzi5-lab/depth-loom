import type { ImageErrorCode } from '../image/errors'
import type { SampleId } from '../samples'

export type Locale = 'zh' | 'en'

export interface Messages {
  header: {
    privacy: string
    switchLabel: string
  }
  empty: {
    eyebrow: string
    titleLine1: string
    titleLine2: string
    lede: string
    features: {
      noAccount: string
      noUpload: string
      openSource: string
    }
    dropTitle: string
    dropFormat: string
    pasteHint: string
    samplesLabel: string
    sampleNames: Record<SampleId, string>
    sampleAria: (name: string) => string
    privacy: string
    dismissError: string
    decoding: string
  }
  errors: Record<ImageErrorCode, string> & {
    sampleFailed: string
  }
  app: {
    decodingStatus: string
    stageFallback: string
    decodingNew: string
    closeNotice: string
    closeExportNotice: string
    dropOverlayTitle: string
    dropOverlayHint: string
    selectImage: string
    exportPngDone: string
    exportVideoDone: string
    exportFailed: string
    depthNotReady: string
    stageNotReady: string
    unknownError: string
  }
  depth: {
    errorTitle: string
    retry: string
    ready: string
    cpuBadge: string
    webgpuBadge: string
    loadingTitle: string
    estimatingTitle: string
    waiting: string
    mapLabel: string
    mapHint: string
    canvasAria: string
    inpainting: string
  }
  controls: {
    group: string
    viewGroup: string
    original: string
    depth: string
    threeD: string
    reset: string
    browse: string
    export: string
    exporting: string
    png: string
    webm: string
    videoReadyTitle: string
    videoDisabledTitle: string
    viewDepthTitle: string
    view3dTitle: string
    strength: string
    hintOriginal: string
    hintDepth: string
    local: string
  }
  stage: {
    canvasAria: string
    webglError: string
    boundaryMessage: string
    reload: string
  }
}

const zh: Messages = {
  header: {
    privacy: '本地处理 · 不上传',
    switchLabel: '切换到英文',
  },
  empty: {
    eyebrow: 'Local depth engine',
    titleLine1: '让一张照片，',
    titleLine2: '拥有纵深。',
    lede: '把平面照片变成可以拖拽的 3D 视差。深度在浏览器里估计，全程不上传。',
    features: {
      noAccount: '无需登录',
      noUpload: '无需上传',
      openSource: '免费开源',
    },
    dropTitle: '拖入图片，或点击选择',
    dropFormat: 'JPG · PNG · WebP · ≤ 20 MB',
    pasteHint: '或按 Ctrl / Cmd + V 粘贴',
    samplesLabel: '或试试示例',
    sampleNames: {
      landscape: '山景',
      street: '街景',
      portrait: '猫肖像',
    },
    sampleAria: (name) => `加载示例：${name}`,
    privacy: '图片只在浏览器本地处理，不会上传到任何服务器。',
    dismissError: '知道了',
    decoding: '正在解码图片…',
  },
  errors: {
    empty_file: '这个文件是空的，换一张试试。',
    unsupported_type: '只支持 JPG、PNG 或 WebP 图片。',
    too_large: '图片超过 20 MB，请先压缩或换一张。',
    decode_failed: '图片解码失败，请换一张或重新导出。',
    canvas_unavailable: '当前浏览器无法创建画布，请更换浏览器。',
    sampleFailed: '示例图片加载失败，请重试。',
  },
  app: {
    decodingStatus: '正在解码图片…',
    stageFallback: '正在准备舞台…',
    decodingNew: '正在解码新图片…',
    closeNotice: '关闭提示',
    closeExportNotice: '关闭导出提示',
    dropOverlayTitle: '松开，载入这张照片',
    dropOverlayHint: 'JPG / PNG / WebP · ≤ 20 MB',
    selectImage: '选择图片',
    exportPngDone: 'PNG 已导出',
    exportVideoDone: 'WebM 已导出',
    exportFailed: '导出失败：',
    depthNotReady: '深度图还没有准备好。',
    stageNotReady: '3D 舞台还没有准备好。',
    unknownError: '未知错误',
  },
  depth: {
    errorTitle: '深度估计失败',
    retry: '重试',
    ready: '深度已就绪',
    cpuBadge: 'CPU 模式 · 较慢',
    webgpuBadge: 'WebGPU',
    loadingTitle: '正在加载深度模型',
    estimatingTitle: '正在估计深度',
    waiting: '请稍候…',
    mapLabel: 'DEPTH MAP',
    mapHint: '越亮越近',
    canvasAria: '深度图，越亮表示越近',
    inpainting: 'AI 补全背景中…',
  },
  controls: {
    group: '视图控制',
    viewGroup: '视图切换',
    original: '原图',
    depth: '深度',
    threeD: '3D',
    reset: '重置视角',
    browse: '换一张',
    export: '导出',
    exporting: '导出中…',
    png: 'PNG 截图',
    webm: '3 秒 WebM',
    videoReadyTitle: '录制 3 秒循环 3D 视频',
    videoDisabledTitle: '深度估计完成后可用',
    viewDepthTitle: '查看深度图',
    view3dTitle: '查看 3D 视差',
    strength: '深度强度',
    hintOriginal: '拖拽旋转 · 滚轮 / 双指缩放',
    hintDepth: '深度图 · 越亮越近',
    local: '本地',
  },
  stage: {
    canvasAria:
      '可拖拽旋转的 3D 照片。拖拽旋转，滚轮或双指缩放，方向键微调，Home 重置。',
    webglError: '当前浏览器无法初始化 3D 舞台，请确认已启用 WebGL。',
    boundaryMessage: '3D 舞台加载失败，可能是网络或浏览器缓存问题。',
    reload: '重新加载',
  },
}

const en: Messages = {
  header: {
    privacy: 'Local · never uploaded',
    switchLabel: 'Switch to Chinese',
  },
  empty: {
    eyebrow: 'Local depth engine',
    titleLine1: 'Give a photo',
    titleLine2: 'a sense of depth.',
    lede: 'Turn a flat photo into a draggable 3D parallax. Depth is estimated in your browser — nothing is uploaded.',
    features: {
      noAccount: 'No sign-up',
      noUpload: 'No upload',
      openSource: 'Free & open source',
    },
    dropTitle: 'Drop a photo, or click to choose',
    dropFormat: 'JPG · PNG · WebP · ≤ 20 MB',
    pasteHint: 'or press Ctrl / Cmd + V',
    samplesLabel: 'Or try a sample',
    sampleNames: {
      landscape: 'Landscape',
      street: 'Street',
      portrait: 'Cat portrait',
    },
    sampleAria: (name) => `Load sample: ${name}`,
    privacy: 'Images are processed only in your browser and never uploaded to any server.',
    dismissError: 'Got it',
    decoding: 'Decoding the image…',
  },
  errors: {
    empty_file: 'This file is empty. Try another one.',
    unsupported_type: 'Only JPG, PNG, or WebP images are supported.',
    too_large: 'The image is larger than 20 MB. Compress it or choose another.',
    decode_failed: 'The image could not be decoded. Try another file.',
    canvas_unavailable: 'This browser cannot create a canvas. Try a different browser.',
    sampleFailed: 'The sample image failed to load. Please try again.',
  },
  app: {
    decodingStatus: 'Decoding the image…',
    stageFallback: 'Preparing the stage…',
    decodingNew: 'Decoding the new image…',
    closeNotice: 'Close notice',
    closeExportNotice: 'Close export notice',
    dropOverlayTitle: 'Drop to load this photo',
    dropOverlayHint: 'JPG / PNG / WebP · ≤ 20 MB',
    selectImage: 'Choose an image',
    exportPngDone: 'PNG exported',
    exportVideoDone: 'WebM exported',
    exportFailed: 'Export failed: ',
    depthNotReady: 'The depth map is not ready yet.',
    stageNotReady: 'The 3D stage is not ready yet.',
    unknownError: 'Unknown error',
  },
  depth: {
    errorTitle: 'Depth estimation failed',
    retry: 'Retry',
    ready: 'Depth ready',
    cpuBadge: 'CPU mode · slower',
    webgpuBadge: 'WebGPU',
    loadingTitle: 'Loading the depth model',
    estimatingTitle: 'Estimating depth',
    waiting: 'Please wait…',
    mapLabel: 'DEPTH MAP',
    mapHint: 'Brighter is nearer',
    canvasAria: 'Depth map; brighter means nearer',
    inpainting: 'Filling the background with AI…',
  },
  controls: {
    group: 'View controls',
    viewGroup: 'View switch',
    original: 'Original',
    depth: 'Depth',
    threeD: '3D',
    reset: 'Reset view',
    browse: 'New photo',
    export: 'Export',
    exporting: 'Exporting…',
    png: 'PNG snapshot',
    webm: '3-second WebM',
    videoReadyTitle: 'Record a 3-second looping 3D video',
    videoDisabledTitle: 'Available after depth estimation',
    viewDepthTitle: 'View the depth map',
    view3dTitle: 'View the 3D parallax',
    strength: 'Depth strength',
    hintOriginal: 'Drag to rotate · wheel / pinch to zoom',
    hintDepth: 'Depth map · brighter is nearer',
    local: 'local',
  },
  stage: {
    canvasAria:
      'A draggable 3D photo. Drag to rotate, wheel or pinch to zoom, arrow keys to adjust, Home to reset.',
    webglError: 'The 3D stage could not start. Make sure WebGL is enabled.',
    boundaryMessage:
      'The 3D stage failed to load. This may be a network or browser-cache issue.',
    reload: 'Reload',
  },
}

export const messages: Record<Locale, Messages> = { zh, en }
