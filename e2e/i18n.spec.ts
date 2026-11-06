import { expect, test } from '@playwright/test'

test('toggles Chinese and English and persists the choice', async ({ page }) => {
  await page.goto('./?depth=off')

  await expect(page.getByRole('heading', { name: /让一张照片/ })).toBeVisible()
  await page.getByRole('button', { name: '切换到英文' }).click()
  await expect(page.getByRole('heading', { name: /Give a photo/ })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: /Give a photo/ })).toBeVisible()

  await page.getByRole('button', { name: 'Switch to Chinese' }).click()
  await expect(page.getByRole('heading', { name: /让一张照片/ })).toBeVisible()
})
