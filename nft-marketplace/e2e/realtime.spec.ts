import { expect, test } from '@playwright/test'
import { emitSocketEvent, login, nftEvent, orderEvent, triggerTransportFailure } from './helpers'

test('applies nft.updated and order.updated through a real Socket.IO transport', async ({ page }) => {
  const logs: string[] = []
  page.on('console', (message) => logs.push(message.text()))
  await login(page)
  await page.goto('/nft/nft-1')
  await expect(page.getByText('1.19 ETH', { exact: true })).toBeVisible()
  await expect.poll(() => logs.some((entry) => entry.includes('[realtime] reconnected'))).toBe(true)

  await emitSocketEvent(page, 'nft.updated', nftEvent(2, '3.49'))
  await expect(page.getByText('3.49 ETH', { exact: true })).toBeVisible()

  await page.goto('/orders/e2e-realtime-order')
  await expect(page.getByRole('heading', { name: 'Order unavailable.' })).toBeVisible()
  await emitSocketEvent(page, 'order.updated', orderEvent('e2e-realtime-order', 'pending', 1))
  await expect(page.getByRole('heading', { name: 'Payment processing' })).toBeVisible()
  await emitSocketEvent(page, 'order.updated', orderEvent('e2e-realtime-order', 'confirmed', 2))
  await expect(page.getByRole('heading', { name: 'Purchase confirmed' })).toBeVisible()
})

test('reconnects after controlled transport failure and stops reconnecting on logout', async ({ page }) => {
  const logs: string[] = []
  let webSockets = 0
  page.on('console', (message) => logs.push(message.text()))
  page.on('websocket', () => { webSockets += 1 })
  await login(page)
  await expect.poll(() => logs.some((entry) => entry.includes('[realtime] reconnected'))).toBe(true)
  await page.getByRole('link', { name: /Emerald Ape #042, Emerald Apes/ }).click()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()

  await triggerTransportFailure(page)
  await expect.poll(() => logs.some((entry) => entry.includes('disconnected:transport close'))).toBe(true)
  await expect.poll(() => logs.some((entry) => entry.includes('reconnect_attempt:1'))).toBe(true)
  await expect.poll(() => logs.filter((entry) => entry.includes('[realtime] reconnected')).length).toBeGreaterThan(1)
  await emitSocketEvent(page, 'nft.updated', nftEvent(3, '4.29'))
  await expect(page.getByText('4.29 ETH', { exact: true })).toBeVisible()

  const disconnectsBeforeLogout = logs.filter((entry) => entry.includes('disconnected:transport close')).length
  await triggerTransportFailure(page)
  await expect.poll(() => logs.filter((entry) => entry.includes('disconnected:transport close')).length).toBeGreaterThan(disconnectsBeforeLogout)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('link', { name: 'Connect wallet' })).toBeVisible()
  const socketsAtLogout = webSockets
  await page.waitForTimeout(1_200) // reconnectionDelay is deterministically configured to 1,000 ms
  expect(webSockets).toBe(socketsAtLogout)
})
