/**
 * Download progress in percent. Browsers decompress gzip/br responses, so the
 * number of bytes read can exceed the Content-Length header; clamp the result
 * instead of showing values above 100%.
 */
export function downloadProgress(loaded: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  const percent = (loaded / total) * 100
  if (!Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, percent))
}
