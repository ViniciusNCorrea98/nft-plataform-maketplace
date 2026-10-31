import type { Socket } from 'socket.io-client'
import { getAuthToken } from '@/lib/http/api-client'

export async function createRealtimeSocket() {
  const { io } = await import('socket.io-client')
  const url = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  const socket = io(url, {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 1000,
    randomizationFactor: 0,
    auth: { token: getAuthToken() },
  })
  return socket
}

export type RealtimeSocket = Socket
