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
    const socket = createRealtimeSocket()
    const statusKey = realtimeStatusKey(userId)
    const reconcile = () => {
      queryClient.setQueryData(statusKey, 'connected')
      void queryClient.invalidateQueries({ queryKey: ['nfts'] })
      void queryClient.invalidateQueries({ queryKey: ['cart', userId] })
      void queryClient.invalidateQueries({ queryKey: ['quote', userId] })
      void queryClient.invalidateQueries({ queryKey: ['order', userId] })
    }
    queryClient.setQueryData(statusKey, 'connecting')
    socket.on('connect', reconcile)
    socket.on('reconnect', reconcile)
    socket.on('disconnect', () => queryClient.setQueryData(statusKey, 'disconnected'))
    socket.on('connect_error', () => queryClient.setQueryData(statusKey, 'error'))
    socket.on('nft.updated', (payload: unknown) => {
      const parsed = nftUpdatedEventSchema.safeParse(payload)
      if (parsed.success) applyNftUpdated(queryClient, parsed.data, userId)
    })
    socket.on('order.updated', (payload: unknown) => {
      const parsed = orderUpdatedEventSchema.safeParse(payload)
      if (parsed.success) applyOrderUpdated(queryClient, parsed.data, userId)
    })
    socket.connect()
    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      queryClient.removeQueries({ queryKey: statusKey })
    }
  }, [queryClient, session.data, token, userId])
}
