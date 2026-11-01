// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { login, logout } from '@/app/session'
import { apiClient, getAuthToken, setAuthToken } from '@/lib/http/api-client'
import { updateCartItem } from '@/features/cart/api'
import { createOrder, fetchWallets } from '@/features/checkout/api'
import { changePassword, createWallet, deleteWallet, fetchProfile, setPrimaryWallet, updateProfile, updateWallet, useProfile } from '@/features/account/api'
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

async function signIn(email = 'ada@example.test', password = 'demo-password') {
  return login({ email, password })
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('profile management', () => {
  it('loads and edits the authenticated profile, including avatar', async () => {
    await signIn()
    expect(await fetchProfile()).toMatchObject({ id: 'user-1', name: 'Ada Lovelace', bio: 'Digital collector' })

    const updated = await updateProfile({ name: 'Ada Byron', bio: 'Computing pioneer', avatarUrl: 'https://example.test/ada.png' })
    expect(updated).toMatchObject({ name: 'Ada Byron', bio: 'Computing pioneer', avatarUrl: 'https://example.test/ada.png' })
    expect((await fetchProfile()).avatarUrl).toBe('https://example.test/ada.png')
    expect(JSON.stringify(updated)).not.toContain('passwordDigest')
  })

  it('rejects invalid profile input and exposes loading and API error states', async () => {
    await signIn()
    await expect(updateProfile({ name: '', bio: '', avatarUrl: null })).rejects.toBeDefined()
    await expect(apiClient.put('/profile', { name: '', bio: '', avatarUrl: 'not-a-url' })).rejects.toMatchObject({ response: { status: 422 } })

    server.use(http.get('http://localhost/api/profile', () => HttpResponse.json({ code: 'TEMPORARY_FAILURE', message: 'Profile unavailable' }, { status: 503 })))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const profile = renderHook(() => useProfile('user-1'), { wrapper: wrapper(client) })
    expect(profile.result.current.isPending).toBe(true)
    await waitFor(() => expect(profile.result.current.isError).toBe(true))
    client.clear()
  })

  it('changes the password, rejects an incorrect current password without signing out, and never persists credentials', async () => {
    await signIn()
    const token = getAuthToken()
    await expect(changePassword({ currentPassword: 'wrong-password', newPassword: 'another-password' })).rejects.toMatchObject({ response: { status: 401 } })
    expect(getAuthToken()).toBe(token)

    await expect(changePassword({ currentPassword: 'demo-password', newPassword: 'another-password' })).resolves.toEqual({ changed: true })
    const snapshot = window.localStorage.getItem('nft-marketplace.mock-state') ?? ''
    expect(snapshot).not.toContain('passwordDigest')
    expect(snapshot).not.toContain('another-password')
    await logout()
    await expect(signIn('ada@example.test', 'demo-password')).rejects.toMatchObject({ response: { status: 401 } })
    await expect(signIn('ada@example.test', 'another-password')).resolves.toBeDefined()
  })

  it('persists profile and avatar across mock rehydration while keeping users isolated', async () => {
    await signIn()
    await updateProfile({ name: 'Ada Persisted', bio: 'Reload safe', avatarUrl: 'https://example.test/persisted.png' })
    const token = getAuthToken()
    mockStore.rehydrate()
    setAuthToken(token)
    expect(await fetchProfile()).toMatchObject({ name: 'Ada Persisted', bio: 'Reload safe', avatarUrl: 'https://example.test/persisted.png' })

    await logout()
    await signIn('alan@example.test')
    expect(await fetchProfile()).toMatchObject({ id: 'user-2', name: 'Alan Turing', avatarUrl: null })
  })
})

describe('wallet management and checkout consistency', () => {
  it('creates, edits, selects a primary wallet, removes it, and promotes the remaining wallet', async () => {
    await signIn()
    const created = await createWallet({ label: 'Spending', address: '0xADA2', network: 'polygon' })
    await expect(updateWallet({ walletId: created.id, changes: { label: 'Daily spending' } })).resolves.toMatchObject({ label: 'Daily spending' })
    await expect(setPrimaryWallet(created.id)).resolves.toMatchObject({ id: created.id, isPrimary: true })
    expect((await fetchWallets()).find((wallet) => wallet.id === 'wallet-1')?.isPrimary).toBe(false)

    await deleteWallet(created.id)
    const remaining = await fetchWallets()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toMatchObject({ id: 'wallet-1', isPrimary: true })
  })

  it('rejects invalid payloads, duplicate addresses, and every cross-user direct mutation', async () => {
    await signIn()
    const created = await createWallet({ label: 'Private', address: '0xPRIVATE', network: 'ethereum' })
    await expect(createWallet({ label: '', address: '', network: 'ethereum' })).rejects.toBeDefined()
    await expect(createWallet({ label: 'Duplicate', address: '0xPRIVATE', network: 'ethereum' })).rejects.toMatchObject({ response: { status: 409 } })

    await logout()
    await signIn('alan@example.test')
    expect((await fetchWallets()).map((wallet) => wallet.id)).not.toContain(created.id)
    await expect(updateWallet({ walletId: created.id, changes: { label: 'Stolen' } })).rejects.toMatchObject({ response: { status: 404 } })
    await expect(setPrimaryWallet(created.id)).rejects.toMatchObject({ response: { status: 404 } })
    await expect(deleteWallet(created.id)).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('keeps order wallet snapshots stable and rejects removal or identity changes after checkout', async () => {
    await signIn()
    await updateCartItem({ nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    await createOrder({ idempotencyKey: 'wallet-history', payload: { walletId: 'wallet-1', network: 'ethereum', couponCode: null, quoteTotalEth: '1.20', collector: { displayName: 'Ada Lovelace', username: 'ada', profileName: 'Ada collection', email: 'ada@example.test', ensName: 'ada', walletAddress: '0xADA0000000000000000000000000000000001', note: null } } })

    await expect(deleteWallet('wallet-1')).rejects.toMatchObject({ response: { status: 409 } })
    await expect(updateWallet({ walletId: 'wallet-1', changes: { address: '0xCHANGED' } })).rejects.toMatchObject({ response: { status: 409 } })
    await expect(updateWallet({ walletId: 'wallet-1', changes: { network: 'polygon' } })).rejects.toMatchObject({ response: { status: 409 } })
    await expect(updateWallet({ walletId: 'wallet-1', changes: { label: 'Historical wallet' } })).resolves.toMatchObject({ label: 'Historical wallet' })
    expect(mockStore.state.orders[0]).toMatchObject({ walletId: 'wallet-1', network: 'ethereum' })
  })

  it('makes a removed unused wallet unavailable to checkout and surfaces wallet API failures', async () => {
    await signIn()
    const created = await createWallet({ label: 'Temporary', address: '0xTEMP', network: 'polygon' })
    await deleteWallet(created.id)
    expect((await fetchWallets()).map((wallet) => wallet.id)).not.toContain(created.id)
    await updateCartItem({ nftId: 'nft-1', editionId: 'edition-1', quantity: 1 })
    await expect(createOrder({ idempotencyKey: 'removed-wallet', payload: { walletId: created.id, network: 'polygon', couponCode: null, quoteTotalEth: '1.20', collector: { displayName: 'Ada Lovelace', username: 'ada', profileName: 'Ada collection', email: 'ada@example.test', ensName: 'ada', walletAddress: created.address, note: null } } })).rejects.toMatchObject({ response: { status: 422 } })

    server.use(http.get('http://localhost/api/wallets', () => HttpResponse.json({ code: 'TEMPORARY_FAILURE', message: 'Wallets unavailable' }, { status: 503 })))
    await expect(fetchWallets()).rejects.toMatchObject({ response: { status: 503 } })
  })
})
