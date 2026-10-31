import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { nftListResponseSchema, quoteResponseSchema } from '@/domain/contracts'
import { apiClient, setAuthToken } from '@/lib/http/api-client'
import { server } from '@/mocks/server'
import { mockStore } from '@/mocks/store'
import { fetchCatalog, fetchNft } from '@/features/catalog/api'

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
    const parsed = nftListResponseSchema.parse(response.data)
    expect(parsed.items).toHaveLength(2)
    expect(parsed.collectionCounts).toEqual(expect.arrayContaining([
      { name: 'Emerald Apes', count: 1 },
      { name: 'Fotografia', count: 2 },
      { name: 'Arte 3D', count: 2 },
    ]))
    mockStore.reset('empty-catalog')
    const empty = await apiClient.get('/nfts', { params: { page: 1, pageSize: 2 } })
    expect(nftListResponseSchema.parse(empty.data)).toMatchObject({ total: 0, collectionCounts: [] })
  })

  it('applies search, ordering and pagination through the catalog contract', async () => {
    const filtered = await fetchCatalog({ search: 'Violet', sort: 'price-desc', page: 1, pageSize: 1 })
    expect(filtered.items.map((item) => item.id)).toEqual(['nft-5'])
    expect(filtered.page).toBe(1)
    expect(filtered.pageSize).toBe(1)
    const secondPage = await fetchCatalog({ sort: 'featured', page: 2, pageSize: 6 })
    expect(secondPage.items).toHaveLength(3)
    expect(secondPage.hasNext).toBe(false)
    const priceAndNetwork = await fetchCatalog({ minPrice: 1.2, maxPrice: 1.8, network: 'polygon', sort: 'featured', page: 1, pageSize: 9 })
    expect(priceAndNetwork.items.map((item) => item.id)).toEqual(['nft-2', 'nft-5', 'nft-8'].filter((id) => id !== 'nft-8'))
  })

  it('keeps nine unique demonstration NFTs with three intentional catalog images', () => {
    const ids = mockStore.state.nfts.map((nft) => nft.id)
    const imageCounts = Object.values(mockStore.state.nfts.reduce<Record<string, number>>((counts, nft) => ({ ...counts, [nft.imageUrl]: (counts[nft.imageUrl] ?? 0) + 1 }), {}))
    expect(ids).toHaveLength(9)
    expect(new Set(ids).size).toBe(9)
    expect(imageCounts.sort()).toEqual([3, 3, 3])
  })

  it('returns a typed detail and a deterministic not-found error', async () => {
    expect((await fetchNft('nft-1')).collection).toBe('Emerald Apes')
    await expect(fetchNft('missing-nft')).rejects.toMatchObject({ response: { status: 404 } })
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
