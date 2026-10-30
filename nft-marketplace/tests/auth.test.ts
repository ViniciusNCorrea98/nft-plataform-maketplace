import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { login, logout, register, fetchSession } from '@/app/session'
import { apiClient, restoreAuthToken, setAuthToken } from '@/lib/http/api-client'
import { server } from '@/mocks/server'
import { mockStore } from '@/mocks/store'

beforeAll(() => {
  apiClient.defaults.baseURL = 'http://localhost/api'
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => { server.resetHandlers(); mockStore.reset(); setAuthToken(null); vi.unstubAllGlobals() })
afterAll(() => server.close())

describe('authentication flow', () => {
  it('authenticates valid credentials and rejects invalid credentials', async () => {
    const result = await login({ email: 'ada@example.test', password: 'demo-password' })
    expect(result.session.user?.email).toBe('ada@example.test')
    await expect(login({ email: 'ada@example.test', password: 'wrong-password' })).rejects.toMatchObject({ response: { status: 401 } })
  })

  it('registers a new user and rejects duplicate email without exposing secrets', async () => {
    const result = await register({ name: 'Grace Hopper', email: 'grace@example.test', password: 'new-password' })
    expect(result.session.user).toMatchObject({ email: 'grace@example.test', name: 'Grace Hopper' })
    expect(JSON.stringify(result)).not.toContain('passwordDigest')
    await expect(register({ name: 'Another Grace', email: 'grace@example.test', password: 'new-password' })).rejects.toMatchObject({ response: { status: 409 } })
  })

  it('restores a persisted token after a reload and clears it on logout', async () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } } })
    const result = await login({ email: 'ada@example.test', password: 'demo-password' })
    expect(values.size).toBe(1)
    delete apiClient.defaults.headers.common.Authorization
    restoreAuthToken()
    expect(apiClient.defaults.headers.common.Authorization).toBe(`Bearer ${result.token}`)
    await logout()
    expect(values.size).toBe(0)
    expect(apiClient.defaults.headers.common.Authorization).toBeUndefined()
  })

  it('handles expiration and keeps private data isolated between users', async () => {
    const ada = await login({ email: 'ada@example.test', password: 'demo-password' })
    await apiClient.post('/favorites', { nftId: 'nft-1' })
    expect((await apiClient.get('/favorites')).data.nftIds).toContain('nft-1')
    setAuthToken(null)
    const alan = await login({ email: 'alan@example.test', password: 'demo-password' })
    expect(alan.session.user?.email).toBe('alan@example.test')
    expect((await apiClient.get('/favorites')).data.nftIds).not.toContain('nft-1')
    mockStore.reset('session-expired')
    setAuthToken(ada.token)
    const expired = await fetchSession()
    expect(expired.authenticated).toBe(false)
    expect(apiClient.defaults.headers.common.Authorization).toBeUndefined()
  })
})
