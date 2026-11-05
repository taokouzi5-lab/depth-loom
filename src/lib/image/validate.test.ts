import { describe, expect, it } from 'vitest'
import { MAX_FILE_BYTES, validateImageFile } from './validate'

function fakeFile(type: string, size: number): Pick<File, 'type' | 'size'> {
  return { type, size }
}

describe('validateImageFile', () => {
  it('accepts JPEG, PNG, and WebP', () => {
    expect(validateImageFile(fakeFile('image/jpeg', 1024))).toEqual({
      ok: true,
      mimeType: 'image/jpeg',
    })
    expect(validateImageFile(fakeFile('image/png', 1024))).toEqual({
      ok: true,
      mimeType: 'image/png',
    })
    expect(validateImageFile(fakeFile('image/webp', 1024))).toEqual({
      ok: true,
      mimeType: 'image/webp',
    })
  })

  it('rejects an empty file before checking the type', () => {
    expect(validateImageFile(fakeFile('image/jpeg', 0))).toEqual({
      ok: false,
      code: 'empty_file',
    })
  })

  it('rejects unsupported or missing MIME types', () => {
    expect(validateImageFile(fakeFile('image/gif', 1024))).toEqual({
      ok: false,
      code: 'unsupported_type',
    })
    expect(validateImageFile(fakeFile('', 1024))).toEqual({
      ok: false,
      code: 'unsupported_type',
    })
  })

  it('accepts exactly 20 MB and rejects one byte more', () => {
    expect(validateImageFile(fakeFile('image/jpeg', MAX_FILE_BYTES)).ok).toBe(true)
    expect(validateImageFile(fakeFile('image/jpeg', MAX_FILE_BYTES + 1))).toEqual({
      ok: false,
      code: 'too_large',
    })
  })
})
