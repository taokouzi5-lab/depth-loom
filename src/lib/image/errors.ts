export type ImageErrorCode =
  | 'empty_file'
  | 'unsupported_type'
  | 'too_large'
  | 'decode_failed'
  | 'canvas_unavailable'

export class ImageError extends Error {
  readonly code: ImageErrorCode

  constructor(code: ImageErrorCode, message: string) {
    super(message)
    this.name = 'ImageError'
    this.code = code
  }
}

/** UI copy for each failure mode. M4 moves this into the i18n dictionary. */
export const IMAGE_ERROR_MESSAGES: Record<ImageErrorCode, string> = {
  empty_file: '这个文件是空的，换一张试试。',
  unsupported_type: '只支持 JPG、PNG 或 WebP 图片。',
  too_large: '图片超过 20 MB，请先压缩或换一张。',
  decode_failed: '图片解码失败，请换一张或重新导出。',
  canvas_unavailable: '当前浏览器无法创建画布，请更换浏览器。',
}
