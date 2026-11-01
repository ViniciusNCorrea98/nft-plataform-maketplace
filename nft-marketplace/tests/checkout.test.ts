import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { apiClient, setAuthToken } from '@/lib/http/api-client'
import { createOrder, fetchOrder } from '@/features/checkout/api'
import { server } from '@/mocks/server'
import { mockStore } from '@/mocks/store'

beforeAll(() => {
  apiClient.defaults.baseURL = 'http://localhost/api'
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => { server.resetHandlers(); mockStore.reset(); setAuthToken(null) })
afterAll(() => server.close())

async function login(email: string) {
  const response = await apiClient.post('/auth/login', { email, password: 'demo-password' })
  setAuthToken(response.data.token as string)
}

async function addAdaItem() {
  await login('ada@example.test')
  await apiClient.put('/cart/items', { nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
}

const collector = { displayName: 'Ada Lovelace', username: 'ada', profileName: 'Ada collection', email: 'ada@example.test', ensName: 'ada', walletAddress: '0xADA0000000000000000000000000000000000001', note: null }
const orderInput = (quoteTotalEth: string, couponCode: string | null = null) => ({ walletId: 'wallet-1', network: 'ethereum' as const, couponCode, quoteTotalEth, collector })

describe('checkout and order contracts', () => {
  it('creates a confirmed order with the quoted subtotal, discount and total, then clears only the bought cart', async () => {
    await addAdaItem()
    const quote = (await apiClient.post('/quotes', { couponCode: 'WELCOME10' })).data
    const order = await createOrder({ payload: orderInput(quote.totalEth, 'WELCOME10'), idempotencyKey: 'confirmed-1' })
    expect(order).toMatchObject({ status: 'confirmed', subtotalEth: '1.19', discountEth: '0.12', totalEth: '1.08' })
    expect(order.collector).toEqual(collector)
    expect((await apiClient.get('/cart')).data.items).toHaveLength(0)
  })

  it('returns the same order for a repeated key and rejects a conflicting operation', async () => {
    await addAdaItem()
    const first = await createOrder({ payload: orderInput('1.20'), idempotencyKey: 'same-key' })
    const second = await createOrder({ payload: orderInput('1.20'), idempotencyKey: 'same-key' })
    expect(second.id).toBe(first.id)
    await expect(createOrder({ payload: orderInput('1.20', 'WELCOME10'), idempotencyKey: 'same-key' })).rejects.toMatchObject({ response: { status: 409 } })
    expect(mockStore.state.orders).toHaveLength(1)
  })

  it('requires a valid collector snapshot and treats changed collector data as an idempotency conflict', async () => {
    await addAdaItem()
    await expect(apiClient.post('/orders', { walletId: 'wallet-1', network: 'ethereum', couponCode: null }, { headers: { 'Idempotency-Key': 'invalid-collector' } })).rejects.toMatchObject({ response: { status: 422 } })
    await createOrder({ payload: orderInput('1.20'), idempotencyKey: 'collector-key' })
    await expect(createOrder({ payload: { ...orderInput('1.20'), collector: { ...collector, username: 'another-ada' } }, idempotencyKey: 'collector-key' })).rejects.toMatchObject({ response: { status: 409 } })
  })

  it('requires quote revalidation and preserves the cart after a price change', async () => {
    await addAdaItem()
    mockStore.reset('price-changed')
    await login('ada@example.test')
    await apiClient.put('/cart/items', { nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    await expect(createOrder({ payload: orderInput('1.20'), idempotencyKey: 'stale-1' })).rejects.toMatchObject({ response: { status: 409 } })
    expect((await apiClient.get('/cart')).data.items).toHaveLength(1)
  })

  it('keeps the cart for declined payment and exposes pending results after a timeout', async () => {
    await addAdaItem()
    mockStore.reset('payment-declined')
    await login('ada@example.test')
    await apiClient.put('/cart/items', { nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    const declined = await createOrder({ payload: orderInput('1.20'), idempotencyKey: 'declined-1' })
    expect(declined.status).toBe('declined')
    expect((await apiClient.get('/cart')).data.items).toHaveLength(1)

    mockStore.reset('order-timeout')
    await login('ada@example.test')
    await apiClient.put('/cart/items', { nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    await expect(createOrder({ payload: orderInput('1.20'), idempotencyKey: 'timeout-1' })).rejects.toBeDefined()
    await expect(fetchOrder('timeout-1')).resolves.toMatchObject({ id: 'timeout-1', status: 'pending' })
    expect((await createOrder({ payload: orderInput('1.20'), idempotencyKey: 'timeout-1' })).status).toBe('pending')
    expect((await apiClient.get('/cart')).data.items).toHaveLength(1)
  })

  it('isolates orders and rejects cross-user reuse of an idempotency key', async () => {
    await addAdaItem()
    await createOrder({ payload: orderInput('1.20'), idempotencyKey: 'private-key' })
    mockStore.state.carts['user-2'] = [{ nftId: 'nft-2', editionId: 'edition-2', quantity: 1 }]
    await login('alan@example.test')
    await expect(fetchOrder('private-key')).rejects.toMatchObject({ response: { status: 404 } })
    await expect(createOrder({ payload: { walletId: 'wallet-2', network: 'polygon', couponCode: null, quoteTotalEth: '1.30', collector: { ...collector, walletAddress: '0xALA0000000000000000000000000000000002' } }, idempotencyKey: 'private-key' })).rejects.toMatchObject({ response: { status: 409 } })
  })
})
