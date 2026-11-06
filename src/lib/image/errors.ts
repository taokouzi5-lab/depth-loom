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
