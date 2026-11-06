import { expect, test } from '@playwright/test'

test('loads a CC0 sample and exports the original view as PNG', async ({ page }) => {
  await page.goto('./?depth=off')

  await page.getByRole('button', { name: /加载示例：山景/ }).click()
  await expect(page.locator('canvas.dl-canvas')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('landscape.jpg')).toBeVisible()

  await page.getByRole('button', { name: '导出', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'PNG 截图' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/landscape-original\.png$/)
  await expect(page.getByText('PNG 已导出')).toBeVisible()
})
