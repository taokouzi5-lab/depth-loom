import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const fixture = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'landscape.png',
)

test('uploads a photo, mounts the 3D stage, and survives a drag', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await page.goto('./?depth=off')

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(fixture)

  const canvas = page.locator('canvas.dl-canvas')
  await expect(canvas).toBeVisible({ timeout: 30_000 })

  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  expect(box?.width ?? 0).toBeGreaterThan(100)
  expect(box?.height ?? 0).toBeGreaterThan(100)

  await expect(page.getByText('landscape.png')).toBeVisible()
  await expect(page.getByRole('button', { name: '重置视角' })).toBeVisible()

  if (box) {
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    await page.mouse.move(centerX + 80, centerY + 24, { steps: 8 })
    await page.mouse.up()
  }

  await expect(canvas).toBeVisible()

  if (testInfo.project.name === 'desktop-chromium') {
    await page.setViewportSize({ width: 1000, height: 700 })
    await page.waitForTimeout(300)
    const sizes = await canvas.evaluate((element) => {
      const canvasElement = element as HTMLCanvasElement
      return {
        width: canvasElement.width,
        height: canvasElement.height,
        clientWidth: canvasElement.clientWidth,
        clientHeight: canvasElement.clientHeight,
      }
    })
    expect(sizes.clientWidth).toBeGreaterThan(0)
    expect(
      Math.abs(sizes.width / sizes.height - sizes.clientWidth / sizes.clientHeight),
    ).toBeLessThan(0.02)
  }

  expect(consoleErrors).toEqual([])
})
