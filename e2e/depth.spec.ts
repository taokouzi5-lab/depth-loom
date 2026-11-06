import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const fixture = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'landscape.png',
)

test('estimates depth locally and renders the depth map', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Real-model depth is verified on desktop; mobile covered later.',
  )
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

  await depthButton.click()
  const depthCanvas = page.locator('canvas.dl-depth-canvas')
  await expect(depthCanvas).toBeVisible()

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
