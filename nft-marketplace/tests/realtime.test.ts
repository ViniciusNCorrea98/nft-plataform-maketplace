// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { io } from 'socket.io-client'
import { QueryClient } from '@tanstack/react-query'
import { apiClient, setAuthToken } from '@/lib/http/api-client'
import { orderSchema, nftUpdatedEventSchema, orderUpdatedEventSchema } from '@/domain/contracts'
import { applyNftUpdated, applyOrderUpdated, realtimeStaleKey } from '@/lib/realtime/sync'
import { createRealtimeSocket } from '@/lib/realtime/socket-client'
import { orderQueryKey } from '@/features/checkout/api'
import { cartQueryKey } from '@/features/cart/api'
import { server } from '@/mocks/server'
import { mockStore } from '@/mocks/store'

beforeAll(() => {
  apiClient.defaults.baseURL = 'http://localhost/api'
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => { server.resetHandlers(); mockStore.reset(); setAuthToken(null) })
afterAll(() => server.close())

async function login(email = 'ada@example.test') {
  const response = await apiClient.post('/auth/login', { email, password: 'demo-password' })
  setAuthToken(response.data.token as string)
}

describe('Socket.IO realtime integration', () => {
  it('loads socket.io-client after the MSW bootstrap and keeps the mock transport configuration', async () => {
    const socket = await createRealtimeSocket()
    expect(socket.io.opts.transports).toEqual(['websocket'])
    expect(socket.io.opts.path).toBe('/socket.io')
    expect(socket.io.opts.reconnection).toBe(true)
    expect(socket.io.opts.reconnectionDelay).toBe(1000)
    expect(socket.io.opts.randomizationFactor).toBe(0)
    socket.disconnect()
  })

  it('uses socket.io-client with the configured mock transport and cleans up connections', () => {
    const socket = io('http://localhost', { path: '/socket.io', transports: ['websocket'], autoConnect: false })
    expect(socket.io.opts.transports).toEqual(['websocket'])
    expect(socket.io.opts.path).toBe('/socket.io')
    socket.connect()
    socket.disconnect()
    expect(socket.active).toBe(false)
  })

  it('validates the nft.updated payload used by the Socket.IO mock', () => {
    const nft = structuredClone(mockStore.state.nfts[0])
    nft.version = 2
    nft.editions[0].priceEth = '2.49'
    const payload = nftUpdatedEventSchema.parse({ id: nft.id, version: 2, nft })
    expect(payload.nft.editions[0].priceEth).toBe('2.49')
    expect(nftUpdatedEventSchema.safeParse({ id: nft.id, version: 2 }).success).toBe(false)
  })

  it('updates catalog/detail/cart cache once and marks checkout quote stale, ignoring duplicate and old events', () => {
    const queryClient = new QueryClient()
    const nft = structuredClone(mockStore.state.nfts[0])
    queryClient.setQueryData(['nft', nft.id], nft)
    queryClient.setQueryData(['nfts', { page: 1 }], { items: [nft], total: 1, page: 1, pageSize: 1, hasNext: false })
    queryClient.setQueryData(cartQueryKey('user-1'), { items: [{ nftId: nft.id, editionId: nft.editions[0].id, quantity: 1, unitPriceEth: '1.19', availableQuantity: 2, version: 1 }], subtotalEth: '1.19' })
    const changed = { ...nft, version: 2, editions: [{ ...nft.editions[0], priceEth: '2.49', availableQuantity: 1 }] }
    const event = nftUpdatedEventSchema.parse({ id: nft.id, version: 2, nft: changed })
    expect(applyNftUpdated(queryClient, event, 'user-1')).toBe(true)
    expect(applyNftUpdated(queryClient, event, 'user-1')).toBe(false)
    expect(applyNftUpdated(queryClient, nftUpdatedEventSchema.parse({ id: nft.id, version: 1, nft }), 'user-1')).toBe(false)
    expect(queryClient.getQueryData(['nft', nft.id])).toMatchObject({ version: 2 })
    expect(queryClient.getQueryData(cartQueryKey('user-1'))).toMatchObject({ subtotalEth: '2.49' })
    expect(queryClient.getQueryData(realtimeStaleKey('user-1'))).toBe(true)
  })

  it('updates only the owning order, preserves terminal states and validates payloads', async () => {
    await login()
    const order = orderSchema.parse({ id: 'order-realtime', userId: 'user-1', status: 'pending', transactionReference: null, items: [{ ...mockStore.state.nfts[0].editions[0], nftId: 'nft-1', editionId: 'edition-1', quantity: 1, unitPriceEth: '1.19', availableQuantity: 2, version: 1, name: 'Emerald Ape #042' }], subtotalEth: '1.19', discountEth: '0.00', networkFeeEth: '0.01', totalEth: '1.20', walletId: 'wallet-1', network: 'ethereum', collector: { displayName: 'Ada Lovelace', username: 'ada', profileName: 'Ada collection', email: 'ada@example.test', ensName: 'ada', walletAddress: '0xADA0000000000000000000000000000000001', note: null }, createdAt: new Date().toISOString() })
    const queryClient = new QueryClient()
    queryClient.setQueryData(orderQueryKey('user-1', order.id), order)
    const confirmed = orderUpdatedEventSchema.parse({ id: order.id, userId: 'user-1', version: 2, order: { ...order, status: 'confirmed', transactionReference: 'tx-1' } })
    expect(applyOrderUpdated(queryClient, confirmed, 'user-1')).toBe(true)
    expect(queryClient.getQueryData(orderQueryKey('user-1', order.id))).toMatchObject({ status: 'confirmed' })
    expect(applyOrderUpdated(queryClient, orderUpdatedEventSchema.parse({ id: order.id, userId: 'user-1', version: 1, order }), 'user-1')).toBe(false)
    expect(applyOrderUpdated(queryClient, confirmed, 'user-2')).toBe(false)
    expect(orderUpdatedEventSchema.safeParse({ id: order.id, userId: 'user-1', version: 3 }).success).toBe(false)
  })
})
