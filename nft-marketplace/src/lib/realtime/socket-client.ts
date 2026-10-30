import { io, type Socket } from 'socket.io-client'
import { getAuthToken } from '@/lib/http/api-client'

export function createRealtimeSocket() {
  const url = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  const socket = io(url, {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    auth: { token: getAuthToken() },
  })
  return socket
}

export type RealtimeSocket = Socket
