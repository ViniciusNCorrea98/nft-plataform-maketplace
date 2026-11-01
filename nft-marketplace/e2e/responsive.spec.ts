import { expect, test } from '@playwright/test'
import { login } from './helpers'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

test('catalog, detail and cart work without horizontal overflow', async ({ page }) => {
  await login(page)
  await expect(page.getByRole('heading', { name: 'Explore the collection' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expect(page).toHaveScreenshot('catalog.png', { fullPage: true })

  await page.goto('/nft/nft-1')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expect(page).toHaveScreenshot('detail.png', { fullPage: true })

  await page.getByRole('button', { name: 'Buy now' }).click()
  await expect(page.getByRole('heading', { name: 'Shopping cart' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expect(page).toHaveScreenshot('cart.png', { fullPage: true })
})
