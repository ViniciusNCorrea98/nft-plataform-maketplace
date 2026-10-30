// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { login } from '@/app/session'
import { apiClient, setAuthToken } from '@/lib/http/api-client'
import { fetchFavorites, favoritesQueryKey, useFavoriteMutation, useFavorites } from '@/features/catalog/api'
import { server } from '@/mocks/server'
import { mockStore } from '@/mocks/store'

beforeAll(() => {
  apiClient.defaults.baseURL = 'http://localhost/api'
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => { server.resetHandlers(); mockStore.reset(); setAuthToken(null) })
afterAll(() => server.close())

async function signIn(email: string) {
  const result = await login({ email, password: 'demo-password' })
  return result
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('authenticated favorites', () => {
  it('loads the initial favorite through GET /api/favorites', async () => {
    const result = await signIn('ada@example.test')
    expect((await fetchFavorites()).nftIds).toEqual(['nft-2'])
    expect(result.session.user?.id).toBe('user-1')
  })

  it('optimistically adds and removes a favorite and reconciles the cache', async () => {
    await signIn('ada@example.test')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    client.setQueryData(favoritesQueryKey('user-1'), { nftIds: ['nft-2'] })
    const hook = renderHook(() => useFavoriteMutation('user-1'), { wrapper: createWrapper(client) })

    await act(async () => { await hook.result.current.mutateAsync({ nftId: 'nft-1', favorite: true }) })
    expect(client.getQueryData(favoritesQueryKey('user-1'))).toEqual({ nftIds: ['nft-2', 'nft-1'] })
    await act(async () => { await hook.result.current.mutateAsync({ nftId: 'nft-1', favorite: false }) })
    expect(client.getQueryData(favoritesQueryKey('user-1'))).toEqual({ nftIds: ['nft-2'] })
    expect((await fetchFavorites()).nftIds).toEqual(['nft-2'])
    client.clear()
  })

  it('rolls back the optimistic value when the mutation fails', async () => {
    await signIn('ada@example.test')
    server.use(http.post('http://localhost/api/favorites', () => HttpResponse.json({ code: 'TEMPORARY_FAILURE', message: 'Try again' }, { status: 503 })))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    client.setQueryData(favoritesQueryKey('user-1'), { nftIds: ['nft-2'] })
    const hook = renderHook(() => useFavoriteMutation('user-1'), { wrapper: createWrapper(client) })
    await act(async () => { await expect(hook.result.current.mutateAsync({ nftId: 'nft-1', favorite: true })).rejects.toMatchObject({ response: { status: 503 } }) })
    expect(client.getQueryData(favoritesQueryKey('user-1'))).toEqual({ nftIds: ['nft-2'] })
    client.clear()
  })

  it('keeps favorite caches isolated between users', async () => {
    await signIn('ada@example.test')
    const client = new QueryClient()
    client.setQueryData(favoritesQueryKey('user-1'), { nftIds: ['nft-1'] })
    setAuthToken(null)
    await signIn('alan@example.test')
    const initial = renderHook(() => useFavorites('user-2'), { wrapper: createWrapper(client) })
    await waitFor(() => expect(initial.result.current.data).toEqual({ nftIds: [] }))
    expect(client.getQueryData(favoritesQueryKey('user-2'))).toEqual({ nftIds: [] })
    expect(client.getQueryData(favoritesQueryKey('user-1'))).toEqual({ nftIds: ['nft-1'] })
    client.clear()
  })

  it('rejects an expired session and clears the persisted token', async () => {
    const result = await signIn('ada@example.test')
    mockStore.reset('session-expired')
    setAuthToken(result.token)
    await expect(fetchFavorites()).rejects.toMatchObject({ response: { status: 401 } })
    expect(apiClient.defaults.headers.common.Authorization).toBeUndefined()
  })

  it('reconciles a server response instead of retaining optimistic duplicates', async () => {
    await signIn('ada@example.test')
    server.use(http.post('http://localhost/api/favorites', () => HttpResponse.json({ nftIds: ['nft-2', 'nft-3'] })))
    const client = new QueryClient()
    client.setQueryData(favoritesQueryKey('user-1'), { nftIds: ['nft-2'] })
    const hook = renderHook(() => useFavoriteMutation('user-1'), { wrapper: createWrapper(client) })
    await act(async () => { await hook.result.current.mutateAsync({ nftId: 'nft-1', favorite: true }) })
    expect(client.getQueryData(favoritesQueryKey('user-1'))).toEqual({ nftIds: ['nft-2', 'nft-3'] })
    client.clear()
  })
})
