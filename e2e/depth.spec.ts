import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const fixture = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'landscape.png',
)

test('estimates depth locally and renders the depth map', async ({ page }) => {
  test.slow()

  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await page.goto('./')
  await page.locator('input[type="file"]').setInputFiles(fixture)

  const depthButton = page.getByRole('button', { name: '深度' })
  await expect(depthButton).toBeEnabled({ timeout: 180_000 })
  await expect(page.getByText('深度已就绪')).toBeVisible()

  // The first depth result auto-switches to 3D and enables the strength slider.
  const view3d = page.getByRole('button', { name: '3D' })
  await expect(view3d).toHaveAttribute('aria-pressed', 'true')
  const slider = page.getByRole('slider', { name: '深度强度' })
  await expect(slider).toBeEnabled()
  await slider.evaluate((element) => {
    const input = element as HTMLInputElement
    // Bypass React's value tracker so the synthetic change is observed.
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set
    setter?.call(input, '1.5')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(slider).toHaveValue('1.5')
  await expect(page.getByText('1.50×')).toBeVisible()
  await expect(page.locator('canvas.dl-canvas')).toBeVisible()

  await page.getByRole('button', { name: '导出', exact: true }).click()
  const videoDownloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: '3 秒 WebM' }).click()
  const videoDownload = await videoDownloadPromise
  expect(videoDownload.suggestedFilename()).toMatch(/-loop\.webm$/)
  await expect(page.getByText('WebM 已导出')).toBeVisible({ timeout: 30_000 })

  await depthButton.click()
  const depthCanvas = page.locator('canvas.dl-depth-canvas')
  await expect(depthCanvas).toBeVisible()

  await page.getByRole('button', { name: '导出', exact: true }).click()
  const depthPngDownloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'PNG 截图' }).click()
  const depthPngDownload = await depthPngDownloadPromise
  expect(depthPngDownload.suggestedFilename()).toMatch(/-depth\.png$/)

  const stats = await depthCanvas.evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    const context = canvas.getContext('2d')
    if (!context) return null
    const sampleWidth = Math.min(256, canvas.width)
    const sampleHeight = Math.min(256, canvas.height)
    const startX = Math.floor((canvas.width - sampleWidth) / 2)
    const startY = Math.floor((canvas.height - sampleHeight) / 2)
    const data = context.getImageData(
      startX,
      startY,
      sampleWidth,
      sampleHeight,
    ).data
    let min = 255
    let max = 0
    for (let index = 0; index < data.length; index += 4) {
      const value = data[index]
      if (value < min) min = value
      if (value > max) max = value
    }
    return { min, max }
  })

  expect(stats).not.toBeNull()
  expect((stats?.max ?? 0) - (stats?.min ?? 0)).toBeGreaterThan(5)
  expect(consoleErrors).toEqual([])
})
