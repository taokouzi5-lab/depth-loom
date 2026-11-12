import { describe, expect, it } from 'vitest'
import { downloadProgress } from './progress'

describe('downloadProgress', () => {
  it('reports the fraction of the advertised size', () => {
    expect(downloadProgress(50, 100)).toBe(50)
    expect(downloadProgress(100, 100)).toBe(100)
  })

  it('clamps when decompression makes the read byte count exceed Content-Length', () => {
    expect(downloadProgress(117, 100)).toBe(100)
    expect(downloadProgress(2_000_000, 1_000_000)).toBe(100)
  })

  it('returns zero for an unknown or invalid total', () => {
    expect(downloadProgress(100, 0)).toBe(0)
    expect(downloadProgress(100, Number.NaN)).toBe(0)
    expect(downloadProgress(Number.NaN, 100)).toBe(0)
  })
})
