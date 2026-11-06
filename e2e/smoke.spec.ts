import { expect, test } from '@playwright/test'

test('renders the empty state and upload affordance', async ({ page }) => {
  await page.goto('./?depth=off')

  await expect(page.getByRole('heading', { name: /让一张照片/ })).toBeVisible()
  await expect(
    page.getByRole('button', { name: /拖入图片，或点击选择/ }),
  ).toBeVisible()
  await expect(page.getByText('图片只在浏览器本地处理')).toBeVisible()
})
