import { expect, type Page } from '@playwright/test'

export const users = {
  ada: { email: 'ada@example.test', password: 'demo-password' },
  alan: { email: 'alan@example.test', password: 'demo-password' },
} as const

export async function login(page: Page, user: keyof typeof users = 'ada', password = users[user].password) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(users[user].email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/?(?:\?sort=featured&page=1)?$/)
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('link', { name: 'Connect wallet' })).toBeVisible()
}

export async function setScenario(page: Page, scenario: string) {
  const result = await page.evaluate(async (nextScenario) => {
    const response = await fetch('/api/test/scenario', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-E2E-Control': 'playwright' },
      body: JSON.stringify({ scenario: nextScenario }),
    })
    return { ok: response.ok, status: response.status }
  }, scenario)
  expect(result).toEqual({ ok: true, status: 200 })
}

export async function emitSocketEvent(page: Page, eventName: string, payload: unknown) {
  await page.evaluate(async ({ name, data }) => {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`)
      const timer = window.setTimeout(() => {
        socket.close()
        reject(new Error(`Timed out emitting ${name}`))
      }, 5_000)
      socket.addEventListener('error', () => {
        window.clearTimeout(timer)
        reject(new Error(`WebSocket failed while emitting ${name}`))
      })
      socket.addEventListener('message', (message) => {
        const frame = String(message.data)
        if (frame.startsWith('0')) socket.send('40')
        else if (frame.startsWith('40')) socket.send(`42${JSON.stringify(['mock:emit', name, data])}`)
        else if (frame.startsWith('42') && frame.includes(`"${name}"`)) {
          window.clearTimeout(timer)
          socket.close()
          resolve()
        }
      })
    })
  }, { name: eventName, data: payload })
}

export async function triggerTransportFailure(page: Page) {
  await page.evaluate(() => {
    const testWindow = window as Window & { __nftMarketplaceTestTransportFailure?: () => void }
    if (!testWindow.__nftMarketplaceTestTransportFailure) throw new Error('Realtime test control is unavailable')
    testWindow.__nftMarketplaceTestTransportFailure()
  })
}

export function nftEvent(version: number, priceEth: string) {
  const nft = {
    id: 'nft-1',
    name: 'Emerald Ape #042',
    collection: 'Emerald Apes',
    imageUrl: '/src/assets/nftTwo.svg',
    description: 'A simulated collectible for deterministic tests.',
    creator: 'Emerald Studio',
    version,
    editions: [{ id: 'edition-1', label: '1 of 1', priceEth, availableQuantity: 2, maxQuantity: 2 }],
  }
  return { id: nft.id, version, nft }
}

export function orderEvent(orderId: string, status: 'pending' | 'confirmed', version: number) {
  const order = {
    id: orderId,
    userId: 'user-1',
    status,
    transactionReference: status === 'confirmed' ? `tx-${orderId}` : null,
    items: [{ nftId: 'nft-1', editionId: 'edition-1', quantity: 1, unitPriceEth: '1.19', availableQuantity: 2, version: 1, name: 'Emerald Ape #042' }],
    subtotalEth: '1.19',
    discountEth: '0.00',
    networkFeeEth: '0.01',
    totalEth: '1.20',
    walletId: 'wallet-1',
    network: 'ethereum',
    createdAt: '2026-10-31T12:00:00.000Z',
  }
  return { id: orderId, userId: 'user-1', version, order }
}
