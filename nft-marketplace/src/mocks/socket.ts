import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { nftUpdatedEventSchema, orderUpdatedEventSchema } from '@/domain/contracts'

export const socketEndpoint = 'ws://localhost'

const eventSchemas = {
  'nft.updated': nftUpdatedEventSchema,
  'order.updated': orderUpdatedEventSchema,
} as const

const socketLink = ws.link(socketEndpoint)
type SocketConnection = ReturnType<typeof toSocketIo>
const connections = new Set<SocketConnection>()

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
    io.server.on('mock:emit', (eventName: unknown, payload: unknown) => {
      if (typeof eventName !== 'string' || !(eventName in eventSchemas)) return
      emitMockEvent(eventName as keyof typeof eventSchemas, payload)
    })
  }),
]
