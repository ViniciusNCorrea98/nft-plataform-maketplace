import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { nftUpdatedEventSchema, orderUpdatedEventSchema } from '@/domain/contracts'

export const socketEndpoint = 'ws://localhost'

const eventSchemas = {
  'nft.updated': nftUpdatedEventSchema,
  'order.updated': orderUpdatedEventSchema,
} as const

// The Socket.IO binding removes `/socket.io/` before matching. Resolve the
// browser host dynamically while keeping the Node/MSW default stable.
const socketLink = ws.link(
  typeof window === 'undefined' ? socketEndpoint : `ws://${window.location.host}`,
)
type SocketConnection = ReturnType<typeof toSocketIo>
const connections = new Set<SocketConnection>()

export function disconnectMockConnections() {
  const activeConnections = [...connections]
  if (typeof window !== 'undefined') console.debug(`[mock-socket] transport-failure connections=${activeConnections.length}`)
  connections.clear()
  activeConnections.forEach((connection) => connection.client.emit('mock:disconnect'))
}

export function emitMockEvent(eventName: keyof typeof eventSchemas, payload: unknown) {
  const parsed = eventSchemas[eventName].safeParse(payload)
  if (!parsed.success) return false
  connections.forEach((connection) => connection.client.emit(eventName, parsed.data))
  return true
}

export const socketHandlers = [
  socketLink.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    connections.add(io)
    connection.client.addEventListener('close', () => connections.delete(io))
    io.client.on('mock:emit', (_event: MessageEvent, eventName: unknown, payload: unknown) => {
      if (eventName === 'mock:disconnect') {
        disconnectMockConnections()
        return
      }
      if (typeof eventName !== 'string' || !(eventName in eventSchemas)) return
      emitMockEvent(eventName as keyof typeof eventSchemas, payload)
    })
  }),
]
