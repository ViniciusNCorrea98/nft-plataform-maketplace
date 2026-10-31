// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fetchSession, login, logout } from '@/app/session'
import { apiClient, getAuthToken, setAuthToken } from '@/lib/http/api-client'
import { fetchFavorites } from '@/features/catalog/api'
import { fetchCart } from '@/features/cart/api'
import { server } from '@/mocks/server'
import { mockStore } from '@/mocks/store'

beforeAll(() => {
  apiClient.defaults.baseURL = 'http://localhost/api'
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
  mockStore.reset()
  setAuthToken(null)
})
afterAll(() => server.close())

describe('browser mock persistence', () => {
  it('restores the authenticated session and private data after a module reload', async () => {
    await login({ email: 'ada@example.test', password: 'demo-password' })
    await apiClient.post('/favorites', { nftId: 'nft-1' })
    await apiClient.put('/cart/items', { nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    const token = getAuthToken()

    mockStore.rehydrate()
    setAuthToken(token)

    expect((await fetchSession()).authenticated).toBe(true)
    expect((await fetchFavorites()).nftIds).toContain('nft-1')
    expect((await fetchCart()).items).toMatchObject([{ nftId: 'nft-1', quantity: 1 }])
  })

  it('keeps persisted private data isolated after switching users and removes the session on logout', async () => {
    await login({ email: 'ada@example.test', password: 'demo-password' })
    await apiClient.post('/favorites', { nftId: 'nft-1' })
    await apiClient.put('/cart/items', { nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    mockStore.rehydrate()

    await logout()
    await login({ email: 'alan@example.test', password: 'demo-password' })
    expect((await fetchFavorites()).nftIds).toEqual([])
    expect((await fetchCart()).items).toEqual([])

    await logout()
    expect(getAuthToken()).toBeNull()
    expect((await fetchSession()).authenticated).toBe(false)
  })
})
