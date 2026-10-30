import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { socketHandlers } from './socket'

export const server = setupServer(...handlers, ...socketHandlers)
