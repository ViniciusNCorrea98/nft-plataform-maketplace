import { http, HttpResponse, type JsonBodyType } from 'msw'
import { z } from 'zod'
import Decimal from 'decimal.js'
import { cartItemMutationSchema, createOrderRequestSchema, favoriteMutationSchema, loginRequestSchema, nftListQuerySchema, quoteRequestSchema, registerRequestSchema } from '@/domain/contracts'
import { digestPassword, getCartForUser, getNft, getStoredUser, getTokenFromHeaders, getUserByEmail, getUserIdFromToken, mockStore, toPublicUser } from './store'
import { emitMockEvent } from './socket'

const ok = (data: JsonBodyType, init?: ResponseInit) => HttpResponse.json(data, init)
const fail = (status: number, code: string, message: string) => HttpResponse.json({ code, message }, { status })
const now = () => new Date().toISOString()
const route = (path: string) => typeof window === 'undefined' || import.meta.env.MODE === 'test' ? new URL(path, 'http://localhost').toString() : path

async function readJson<T>(request: Request, schema: z.ZodType<T>) {
  return schema.safeParse(await request.json())
}
function authUser(request: Request) {
  const userId = getUserIdFromToken(getTokenFromHeaders(request.headers))
  return userId ? getStoredUser(userId) : undefined
}
function requireUser(request: Request) {
  if (mockStore.state.scenario === 'session-expired') return { response: fail(401, 'SESSION_EXPIRED', 'Session expired') }
  const user = authUser(request)
  return user ? { user } : { response: fail(401, 'UNAUTHORIZED', 'Authentication required') }
}
function withScenario(nft: NonNullable<ReturnType<typeof getNft>>) {
  if (mockStore.state.scenario !== 'price-changed') return nft
  const changed = structuredClone(nft)
  changed.version += 1
  changed.editions[0].priceEth = '2.49'
  changed.editions[0].availableQuantity = 1
  return changed
}
function getCartResponse(userId: string) {
  const items = getCartForUser(userId).flatMap((item) => {
    const nft = getNft(item.nftId)
    const edition = nft?.editions.find((candidate) => candidate.id === item.editionId)
    return nft && edition ? [{ ...item, unitPriceEth: edition.priceEth, availableQuantity: edition.availableQuantity, version: nft.version }] : []
  })
  const subtotalEth = items.reduce((sum, item) => sum.plus(new Decimal(item.unitPriceEth).times(item.quantity)), new Decimal(0)).toFixed(2)
  return { items, subtotalEth }
}
function getQuote(userId: string, couponCode: string | null) {
  if (couponCode && (mockStore.state.scenario === 'invalid-coupon' || couponCode !== 'WELCOME10')) return null
  const subtotal = getCartForUser(userId).reduce((sum, item) => {
    const nft = getNft(item.nftId)
    const currentNft = nft ? withScenario(nft) : undefined
    const currentEdition = currentNft?.editions.find((candidate) => candidate.id === item.editionId)
    return sum.plus(currentEdition ? new Decimal(currentEdition.priceEth).times(item.quantity) : 0)
  }, new Decimal(0))
  const discount = couponCode ? subtotal.times('0.1') : new Decimal(0)
  const networkFee = new Decimal('0.01')
  return { subtotalEth: subtotal.toFixed(2), discountEth: discount.toFixed(2), networkFeeEth: networkFee.toFixed(2), totalEth: subtotal.minus(discount).plus(networkFee).toFixed(2), couponCode }
}

export const handlers = [
  http.post(route('/api/auth/login'), async ({ request }) => {
    const parsed = await readJson(request, loginRequestSchema)
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid login payload')
    const user = getUserByEmail(parsed.data.email)
    if (!user || user.passwordDigest !== await digestPassword(parsed.data.password)) return fail(401, 'INVALID_CREDENTIALS', 'Invalid credentials')
    const token = `token-${user.id}`
    mockStore.state.sessions[token] = user.id
    return ok({ token, session: { authenticated: true, user: toPublicUser(user), expiresAt: new Date(Date.now() + 3_600_000).toISOString() } })
  }),
  http.post(route('/api/auth/register'), async ({ request }) => {
    const parsed = await readJson(request, registerRequestSchema)
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid registration payload')
    if (getUserByEmail(parsed.data.email)) return fail(409, 'ACCOUNT_CONFLICT', 'An account already exists')
    const id = `user-${mockStore.state.users.length + 1}`
    const user = { id, email: parsed.data.email, name: parsed.data.name, avatarUrl: null, passwordDigest: await digestPassword(parsed.data.password), bio: '', walletIds: [] }
    mockStore.state.users.push(user)
    mockStore.state.favorites[id] = []
    mockStore.state.carts[id] = []
    mockStore.state.profiles[id] = { id, email: user.email, name: user.name, avatarUrl: null, bio: user.bio, walletIds: [] }
    const token = `token-${id}`
    mockStore.state.sessions[token] = id
    return ok({ token, session: { authenticated: true, user: toPublicUser(user), expiresAt: new Date(Date.now() + 3_600_000).toISOString() } }, { status: 201 })
  }),
  http.get(route('/api/auth/session'), ({ request }) => {
    const user = authUser(request)
    if (!user || mockStore.state.scenario === 'session-expired') return ok({ authenticated: false, user: null, expiresAt: null })
    return ok({ authenticated: true, user: toPublicUser(user), expiresAt: new Date(Date.now() + 3_600_000).toISOString() })
  }),
  http.post(route('/api/auth/logout'), ({ request }) => {
    const token = getTokenFromHeaders(request.headers)
    if (token) delete mockStore.state.sessions[token]
    return ok({ authenticated: false, user: null, expiresAt: null })
  }),

  http.get(route('/api/nfts'), ({ request }) => {
    if (mockStore.state.scenario === 'transient-error') return fail(503, 'TEMPORARY_FAILURE', 'Catalog temporarily unavailable')
    const parsed = nftListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid catalog query')
    const { search, collection, sort, page, pageSize } = parsed.data
    let items = mockStore.state.nfts.map(withScenario)
    if (mockStore.state.scenario === 'empty-catalog') items = []
    if (search) items = items.filter((nft) => `${nft.name} ${nft.collection}`.toLowerCase().includes(search.toLowerCase()))
    if (collection) items = items.filter((nft) => nft.collection === collection)
    if (sort === 'price-asc') items.sort((a, b) => Number(a.editions[0].priceEth) - Number(b.editions[0].priceEth))
    if (sort === 'price-desc') items.sort((a, b) => Number(b.editions[0].priceEth) - Number(a.editions[0].priceEth))
    const start = (page - 1) * pageSize
    return ok({ items: items.slice(start, start + pageSize), total: items.length, page, pageSize, hasNext: start + pageSize < items.length })
  }),
  http.get(route('/api/nfts/:nftId'), ({ params }) => {
    const nft = getNft(String(params.nftId))
    return nft ? ok(withScenario(nft)) : fail(404, 'NFT_NOT_FOUND', 'NFT not found')
  }),

  http.get(route('/api/favorites'), ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    return ok({ nftIds: mockStore.state.favorites[result.user.id] ?? [] })
  }),
  http.post(route('/api/favorites'), async ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const parsed = await readJson(request, favoriteMutationSchema)
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid favorite payload')
    if (!getNft(parsed.data.nftId)) return fail(404, 'NFT_NOT_FOUND', 'NFT not found')
    const favorites = mockStore.state.favorites[result.user.id] ?? []
    if (!favorites.includes(parsed.data.nftId)) favorites.push(parsed.data.nftId)
    return ok({ nftIds: favorites })
  }),
  http.delete(route('/api/favorites/:nftId'), ({ request, params }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const favorites = mockStore.state.favorites[result.user.id] ?? []
    mockStore.state.favorites[result.user.id] = favorites.filter((nftId) => nftId !== String(params.nftId))
    return ok({ nftIds: mockStore.state.favorites[result.user.id] })
  }),

  http.get(route('/api/cart'), ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    return ok(getCartResponse(result.user.id))
  }),
  http.put(route('/api/cart/items'), async ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const parsed = await readJson(request, cartItemMutationSchema)
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid cart item payload')
    const nft = getNft(parsed.data.nftId)
    const edition = nft?.editions.find((candidate) => candidate.id === parsed.data.editionId)
    if (!nft || !edition) return fail(404, 'EDITION_NOT_FOUND', 'Edition not found')
    if (parsed.data.quantity > edition.availableQuantity) return fail(409, 'OUT_OF_STOCK', 'Quantity is unavailable')
    const cart = getCartForUser(result.user.id)
    const index = cart.findIndex((item) => item.nftId === parsed.data.nftId && item.editionId === parsed.data.editionId)
    if (parsed.data.quantity === 0) { if (index >= 0) cart.splice(index, 1) } else if (index >= 0) cart[index].quantity = parsed.data.quantity
    else cart.push(parsed.data)
    return ok(getCartResponse(result.user.id))
  }),

  http.post(route('/api/quotes'), async ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const parsed = await readJson(request, quoteRequestSchema)
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid quote payload')
    const quote = getQuote(result.user.id, parsed.data.couponCode)
    if (!quote) return fail(422, 'INVALID_COUPON', 'Coupon is invalid or expired')
    return ok(quote)
  }),

  http.get(route('/api/profile'), ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    return ok(mockStore.state.profiles[result.user.id])
  }),
  http.get(route('/api/wallets'), ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const walletIds = mockStore.state.profiles[result.user.id].walletIds
    return ok(mockStore.state.wallets.filter((wallet) => walletIds.includes(wallet.id)))
  }),

  http.post(route('/api/orders'), async ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const parsed = await readJson(request, createOrderRequestSchema)
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid order payload')
    const idempotencyKey = request.headers.get('idempotency-key')
    if (!idempotencyKey) return fail(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required')
    const existingKey = mockStore.state.idempotencyKeys[idempotencyKey]
    if (existingKey) {
      const sameOperation = existingKey.userId === result.user.id && existingKey.walletId === parsed.data.walletId && existingKey.network === parsed.data.network && existingKey.couponCode === parsed.data.couponCode && (!parsed.data.quoteTotalEth || existingKey.quoteTotalEth === parsed.data.quoteTotalEth)
      if (!sameOperation) return fail(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key was already used for another operation')
      const existing = mockStore.state.orders.find((order) => order.id === idempotencyKey)
      return existing ? ok(existing) : fail(409, 'ORDER_UNAVAILABLE', 'Order result is not available')
    }
    const cart = getCartForUser(result.user.id)
    if (!cart.length) return fail(409, 'EMPTY_CART', 'Cart is empty')
    const wallet = mockStore.state.wallets.find((candidate) => candidate.id === parsed.data.walletId && mockStore.state.profiles[result.user.id].walletIds.includes(candidate.id))
    if (!wallet || wallet.network !== parsed.data.network) return fail(422, 'INVALID_WALLET', 'Wallet is not available for this account or network')
    const quote = getQuote(result.user.id, parsed.data.couponCode)
    if (!quote) return fail(422, 'INVALID_COUPON', 'Coupon is invalid or expired')
    const requestedQuoteTotal = parsed.data.quoteTotalEth ?? quote.totalEth
    if (mockStore.state.scenario === 'price-changed' || quote.totalEth !== requestedQuoteTotal) return fail(409, 'QUOTE_STALE', 'The quote changed. Review it before confirming the order')
    const items = cart.flatMap((item) => {
      const nft = getNft(item.nftId)
      const currentNft = nft ? withScenario(nft) : undefined
      const currentEdition = currentNft?.editions.find((candidate) => candidate.id === item.editionId)
      return currentNft && currentEdition && item.quantity <= currentEdition.availableQuantity ? [{ ...item, name: currentNft.name, unitPriceEth: currentEdition.priceEth, availableQuantity: currentEdition.availableQuantity, version: currentNft.version }] : []
    })
    if (items.length !== cart.length) return fail(409, 'OUT_OF_STOCK', 'An item is no longer available')
    const status: 'pending' | 'confirmed' | 'declined' = mockStore.state.scenario === 'payment-declined' ? 'declined' : mockStore.state.scenario === 'order-timeout' ? 'pending' : 'confirmed'
    const order = { id: idempotencyKey, userId: result.user.id, status, transactionReference: status === 'confirmed' ? `tx-${idempotencyKey}` : null, items, subtotalEth: quote.subtotalEth, discountEth: quote.discountEth, networkFeeEth: quote.networkFeeEth, totalEth: quote.totalEth, walletId: parsed.data.walletId, network: parsed.data.network, createdAt: now() }
    mockStore.state.idempotencyKeys[idempotencyKey] = { userId: result.user.id, walletId: parsed.data.walletId, network: parsed.data.network, couponCode: parsed.data.couponCode, quoteTotalEth: requestedQuoteTotal }
    mockStore.state.orders.push(order)
    emitMockEvent('order.updated', { id: order.id, userId: order.userId, version: 1, order })
    if (status === 'confirmed') {
      mockStore.state.carts[result.user.id] = cart.flatMap((cartItem) => {
        const purchased = items.find((item) => item.nftId === cartItem.nftId && item.editionId === cartItem.editionId)
        const remaining = cartItem.quantity - (purchased?.quantity ?? 0)
        return remaining > 0 ? [{ ...cartItem, quantity: remaining }] : []
      })
    }
    if (mockStore.state.scenario === 'order-timeout') return HttpResponse.error()
    return ok(order, { status: status === 'declined' ? 402 : 201 })
  }),
  http.get(route('/api/orders/:orderId'), ({ request, params }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const order = mockStore.state.orders.find((candidate) => candidate.id === String(params.orderId) && candidate.userId === result.user.id)
    return order ? ok(order) : fail(404, 'ORDER_NOT_FOUND', 'Order not found')
  }),
]
