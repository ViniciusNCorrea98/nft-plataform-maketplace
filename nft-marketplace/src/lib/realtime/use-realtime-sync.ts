import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { isAuthenticated, useSession } from '@/app/session'
import { getAuthToken } from '@/lib/http/api-client'
import { nftUpdatedEventSchema, orderUpdatedEventSchema } from '@/domain/contracts'
import { createRealtimeSocket } from './socket-client'
import { applyNftUpdated, applyOrderUpdated, realtimeStatusKey } from './sync'

export function useRealtimeSync() {
  const session = useSession()
  const queryClient = useQueryClient()
  const userId = session.data?.user?.id
  const token = getAuthToken()

  useEffect(() => {
    if (!userId || !isAuthenticated(session.data) || !token) return
    const statusKey = realtimeStatusKey(userId)
    let disposed = false
    let socket: Awaited<ReturnType<typeof createRealtimeSocket>> | undefined
    let removeManagerListeners: (() => void) | undefined
    queryClient.setQueryData(statusKey, 'connecting')

    void createRealtimeSocket().then((createdSocket) => {
      if (disposed) {
        createdSocket.disconnect()
        return
      }
      socket = createdSocket
      const report = (event: string) => {
        if (import.meta.env.DEV) console.debug(`[realtime] ${event}`)
      }
      const reconcile = () => {
        report('reconnected')
        queryClient.setQueryData(statusKey, 'connected')
        void queryClient.invalidateQueries({ queryKey: ['nfts'] })
        void queryClient.invalidateQueries({ queryKey: ['cart', userId] })
        void queryClient.invalidateQueries({ queryKey: ['quote', userId] })
        void queryClient.invalidateQueries({ queryKey: ['order', userId] })
      }
      const onReconnectAttempt = (attempt: number) => report(`reconnect_attempt:${attempt}`)
      const onReconnectError = () => report('reconnect_error')
      const onReconnectFailed = () => report('reconnect_failed')
      const onMockDisconnect = () => {
        report('transport_failure')
        if (import.meta.env.DEV) createdSocket.io.engine?.transport.close()
      }
      const requestTestTransportFailure = () => createdSocket.io.engine?.transport.close()
      const testWindow = window as Window & { __nftMarketplaceTestTransportFailure?: () => void }
      socket.on('connect', reconcile)
      socket.io.on('reconnect_attempt', onReconnectAttempt)
      socket.io.on('reconnect_error', onReconnectError)
      socket.io.on('reconnect_failed', onReconnectFailed)
      socket.on('mock:disconnect', onMockDisconnect)
      testWindow.__nftMarketplaceTestTransportFailure = requestTestTransportFailure
      removeManagerListeners = () => {
        socket?.io.removeListener('reconnect_attempt', onReconnectAttempt)
        socket?.io.removeListener('reconnect_error', onReconnectError)
        socket?.io.removeListener('reconnect_failed', onReconnectFailed)
        socket?.removeListener('mock:disconnect', onMockDisconnect)
        if (testWindow.__nftMarketplaceTestTransportFailure === requestTestTransportFailure) delete testWindow.__nftMarketplaceTestTransportFailure
      }
      socket.on('disconnect', (reason) => {
        report(`disconnected:${reason}`)
        queryClient.setQueryData(statusKey, 'disconnected')
      })
      socket.on('connect_error', () => {
        report('connect_error')
        queryClient.setQueryData(statusKey, 'error')
      })
      socket.on('nft.updated', (payload: unknown) => {
        const parsed = nftUpdatedEventSchema.safeParse(payload)
        if (parsed.success) applyNftUpdated(queryClient, parsed.data, userId)
      })
      socket.on('order.updated', (payload: unknown) => {
        const parsed = orderUpdatedEventSchema.safeParse(payload)
        if (parsed.success) applyOrderUpdated(queryClient, parsed.data, userId)
      })
      report('connecting')
      socket.connect()
    }).catch(() => {
      if (!disposed) queryClient.setQueryData(statusKey, 'error')
    })

    return () => {
      disposed = true
      socket?.removeAllListeners()
      removeManagerListeners?.()
      socket?.disconnect()
      queryClient.removeQueries({ queryKey: statusKey })
    }
  }, [queryClient, session.data, token, userId])
}
