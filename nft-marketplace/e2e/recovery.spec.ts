import { expect, test } from '@playwright/test'
import { setScenario } from './helpers'

test('recovers the catalog after a controlled API failure', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Explore the collection' })).toBeVisible()
  await setScenario(page, 'transient-error')
  await page.getByLabel('Ordenar').selectOption('price-asc')
  await expect(page.getByText('Unable to load the collection right now.')).toBeVisible()
  await setScenario(page, 'default')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
})
