import { QueryClient } from '@tanstack/react-query'
import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { initializeMocks } from '@/app/bootstrap'
import { isAuthenticated, getSession } from '@/app/session'
import { sessionSchema } from '@/domain/contracts'
import { apiClient, setAuthToken } from '@/lib/http/api-client'
import { server } from '@/mocks/server'
import { mockStore } from '@/mocks/store'
import { requireAuthenticated, router } from '@/app/router'
import { safeReturnPath } from '@/features/auth/return-path'

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

describe('application bootstrap and session boundary', () => {
  it('waits for the browser worker before continuing', async () => {
    const events: string[] = []
    const started = await initializeMocks(true, async () => { events.push('worker-ready') })
    events.push('render')
    expect(started).toBe(true)
    expect(events).toEqual(['worker-ready', 'render'])
  })

  it('does not start browser mocks in a non-browser environment', async () => {
    const start = vi.fn(async () => undefined)
    expect(await initializeMocks(false, start)).toBe(false)
    expect(start).not.toHaveBeenCalled()
  })

  it('treats absent and expired sessions as unauthenticated', () => {
    expect(isAuthenticated(undefined)).toBe(false)
    expect(isAuthenticated(sessionSchema.parse({ authenticated: false, user: null, expiresAt: null }))).toBe(false)
  })

  it('loads the session through the QueryClient and Axios/MSW contract', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const session = await getSession(client)
    expect(session.authenticated).toBe(false)
    expect(client.getQueryData(['auth', 'session'])).toEqual(session)
  })

  it('rejects unauthenticated access with a single login redirect', async () => {
    const promise = requireAuthenticated(new QueryClient({ defaultOptions: { queries: { retry: false } } }))
    await expect(promise).rejects.toMatchObject({ options: { href: '/login?redirect=%2F' } })
  })

  it('registers the protected route paths in the typed router', () => {
    expect(router.buildLocation({ to: '/cart' }).pathname).toBe('/cart')
    expect(router.buildLocation({ to: '/orders/$id', params: { id: 'order-1' } }).pathname).toBe('/orders/order-1')
  })

  it('accepts internal return paths and rejects external or auth-loop paths', () => {
    expect(safeReturnPath('/cart?from=detail')).toBe('/cart?from=detail')
    expect(safeReturnPath('https://evil.example')).toBe('/')
    expect(safeReturnPath('//evil.example')).toBe('/')
    expect(safeReturnPath('/login')).toBe('/')
  })
})
