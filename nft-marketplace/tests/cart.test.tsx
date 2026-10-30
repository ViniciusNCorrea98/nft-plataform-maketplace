// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { login } from '@/app/session'
import { apiClient, setAuthToken } from '@/lib/http/api-client'
import { cartQueryKey, fetchCart, fetchQuote, quoteQueryKey, updateCartItem, useCartMutation } from '@/features/cart/api'
import { server } from '@/mocks/server'
import { mockStore } from '@/mocks/store'

beforeAll(() => {
  apiClient.defaults.baseURL = 'http://localhost/api'
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => { server.resetHandlers(); mockStore.reset(); setAuthToken(null) })
afterAll(() => server.close())

async function signIn(email: string) { return login({ email, password: 'demo-password' }) }
function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider> }
}

describe('authenticated cart', () => {
  it('adds, updates, removes and persists cart items through MSW', async () => {
    await signIn('ada@example.test')
    await updateCartItem({ nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    expect((await fetchCart()).items[0]).toMatchObject({ nftId: 'nft-1', quantity: 1, unitPriceEth: '1.19' })
    await updateCartItem({ nftId: 'nft-1', editionId: 'edition-1', quantity: 2 })
    expect((await fetchCart()).items[0].quantity).toBe(2)
    await updateCartItem({ nftId: 'nft-1', editionId: 'edition-1', quantity: 0 })
    expect((await fetchCart()).items).toEqual([])
    await updateCartItem({ nftId: 'nft-2', editionId: 'edition-2', quantity: 1 })
    expect((await fetchCart()).items).toHaveLength(1)
  })

  it('calculates precise subtotal, valid coupon discount and total from the quote API', async () => {
    await signIn('ada@example.test')
    await updateCartItem({ nftId: 'nft-1', editionId: 'edition-1', quantity: 2 })
    await updateCartItem({ nftId: 'nft-2', editionId: 'edition-2', quantity: 1 })
    expect(await fetchQuote(null)).toMatchObject({ subtotalEth: '3.67', discountEth: '0.00', networkFeeEth: '0.01', totalEth: '3.68', couponCode: null })
    expect(await fetchQuote('WELCOME10')).toMatchObject({ subtotalEth: '3.67', discountEth: '0.37', networkFeeEth: '0.01', totalEth: '3.31', couponCode: 'WELCOME10' })
  })

  it('rejects invalid coupons without changing cart contents', async () => {
    mockStore.reset('invalid-coupon')
    await signIn('ada@example.test')
    await updateCartItem({ nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    await expect(fetchQuote('WELCOME10')).rejects.toMatchObject({ response: { status: 422 } })
    expect((await fetchCart()).items).toMatchObject([{ nftId: 'nft-1', quantity: 1 }])
  })

  it('isolates carts and cache keys between Ada and Alan', async () => {
    await signIn('ada@example.test')
    await updateCartItem({ nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    const client = new QueryClient()
    client.setQueryData(cartQueryKey('user-1'), await fetchCart())
    setAuthToken(null)
    await signIn('alan@example.test')
    expect((await fetchCart()).items).toEqual([])
    expect(client.getQueryData(cartQueryKey('user-1'))).toMatchObject({ items: [{ nftId: 'nft-1' }] })
    expect(client.getQueryData(cartQueryKey('user-2'))).toBeUndefined()
    expect(client.getQueryData(quoteQueryKey('user-1', null))).toBeUndefined()
    client.clear()
  })

  it('rolls back cache after an API failure and keeps server state consistent', async () => {
    await signIn('ada@example.test')
    await updateCartItem({ nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    server.use(http.put('http://localhost/api/cart/items', () => HttpResponse.json({ code: 'TEMPORARY_FAILURE', message: 'Cart unavailable' }, { status: 503 })))
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    client.setQueryData(cartQueryKey('user-1'), await fetchCart())
    const hook = renderHook(() => useCartMutation('user-1'), { wrapper: wrapper(client) })
    await act(async () => { await expect(hook.result.current.mutateAsync({ nftId: 'nft-1', editionId: 'edition-1', quantity: 2 })).rejects.toMatchObject({ response: { status: 503 } }) })
    expect(client.getQueryData(cartQueryKey('user-1'))).toMatchObject({ items: [{ nftId: 'nft-1', quantity: 1 }] })
    expect((await fetchCart()).items[0].quantity).toBe(1)
    client.clear()
  })

  it('clears authentication when the cart session expires', async () => {
    const result = await signIn('ada@example.test')
    mockStore.reset('session-expired')
    setAuthToken(result.token)
    await expect(fetchCart()).rejects.toMatchObject({ response: { status: 401 } })
    expect(apiClient.defaults.headers.common.Authorization).toBeUndefined()
  })
})
