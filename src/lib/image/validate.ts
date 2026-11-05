import type { ImageErrorCode } from './errors'

export const MAX_FILE_BYTES = 20 * 1024 * 1024

export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number]

export type ImageValidationResult =
  | { ok: true; mimeType: AcceptedMimeType }
  | {
      ok: false
      code: Extract<ImageErrorCode, 'empty_file' | 'unsupported_type' | 'too_large'>
    }

/**
 * Validate a browser File before doing any decode work.
 * Order matters: an empty file should report `empty_file`, not a type error.
 */
export function validateImageFile(file: Pick<File, 'type' | 'size'>): ImageValidationResult {
  if (file.size === 0) {
    return { ok: false, code: 'empty_file' }
  }

  const isAccepted = ACCEPTED_MIME_TYPES.some((mimeType) => mimeType === file.type)
  if (!isAccepted) {
    return { ok: false, code: 'unsupported_type' }
  }

  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, code: 'too_large' }
  }

  return { ok: true, mimeType: file.type as AcceptedMimeType }
}
