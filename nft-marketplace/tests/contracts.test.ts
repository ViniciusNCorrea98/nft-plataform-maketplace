import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { nftListResponseSchema, quoteResponseSchema } from '@/domain/contracts'
import { apiClient, setAuthToken } from '@/lib/http/api-client'
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

describe('REST contracts through MSW and Axios', () => {
  it('validates catalog responses and the empty scenario', async () => {
    const response = await apiClient.get('/nfts', { params: { page: 1, pageSize: 2 } })
    expect(nftListResponseSchema.parse(response.data).items).toHaveLength(2)
    mockStore.reset('empty-catalog')
    const empty = await apiClient.get('/nfts', { params: { page: 1, pageSize: 2 } })
    expect(nftListResponseSchema.parse(empty.data).total).toBe(0)
  })

  it('isolates favorites and cart by authenticated user', async () => {
    await login('ada@example.test')
    await apiClient.post('/favorites', { nftId: 'nft-1' })
    expect((await apiClient.get('/favorites')).data.nftIds).toContain('nft-1')
    await login('alan@example.test')
    expect((await apiClient.get('/favorites')).data.nftIds).not.toContain('nft-1')
    await expect(apiClient.get('/cart')).resolves.toMatchObject({ data: { items: [] } })
  })

  it('validates quotes and deterministic coupon errors', async () => {
    await login('ada@example.test')
    await apiClient.put('/cart/items', { nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    expect(quoteResponseSchema.parse((await apiClient.post('/quotes', { couponCode: 'WELCOME10' })).data).couponCode).toBe('WELCOME10')
    mockStore.reset('invalid-coupon')
    await login('ada@example.test')
    await expect(apiClient.post('/quotes', { couponCode: 'WELCOME10' })).rejects.toMatchObject({ response: { status: 422 } })
  })

  it('requires idempotency and returns the same order on retry', async () => {
    await login('ada@example.test')
    await apiClient.put('/cart/items', { nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    const payload = { walletId: 'wallet-1', network: 'ethereum', couponCode: null }
    const first = await apiClient.post('/orders', payload, { headers: { 'Idempotency-Key': 'order-attempt-1' } })
    const second = await apiClient.post('/orders', payload, { headers: { 'Idempotency-Key': 'order-attempt-1' } })
    expect(first.data.id).toBe(second.data.id)
    expect(mockStore.state.orders).toHaveLength(1)
  })
})
