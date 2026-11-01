import { http, HttpResponse, type JsonBodyType } from 'msw'
import { z } from 'zod'
import Decimal from 'decimal.js'
import { cartItemMutationSchema, changePasswordSchema, createOrderRequestSchema, favoriteMutationSchema, loginRequestSchema, nftListQuerySchema, profileUpdateSchema, quoteRequestSchema, registerRequestSchema, walletCreateSchema, walletUpdateSchema } from '@/domain/contracts'
import { digestPassword, getCartForUser, getNft, getStoredUser, getTokenFromHeaders, getUserByEmail, getUserIdFromToken, mockScenarios, mockStore, toPublicUser } from './store'
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
function walletsForUser(userId: string) {
  const walletIds = mockStore.state.profiles[userId]?.walletIds ?? []
  return mockStore.state.wallets.filter((wallet) => walletIds.includes(wallet.id))
}
function setPrimaryWallet(userId: string, walletId: string) {
  const ownedWalletIds = new Set(mockStore.state.profiles[userId]?.walletIds ?? [])
  for (const wallet of mockStore.state.wallets) {
    if (ownedWalletIds.has(wallet.id)) wallet.isPrimary = wallet.id === walletId
  }
}
function nextWalletId() {
  const largestId = mockStore.state.wallets.reduce((largest, wallet) => {
    const match = /^wallet-(\d+)$/.exec(wallet.id)
    return match ? Math.max(largest, Number(match[1])) : largest
  }, 0)
  return `wallet-${largestId + 1}`
}

export const handlers = [
  http.put(route('/api/test/scenario'), async ({ request }) => {
    if (request.headers.get('x-e2e-control') !== 'playwright') return fail(404, 'NOT_FOUND', 'Test control not found')
    const parsed = z.object({ scenario: z.enum(mockScenarios) }).safeParse(await request.json())
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid test scenario')
    mockStore.state.scenario = parsed.data.scenario
    return ok({ scenario: mockStore.state.scenario })
  }),
  http.post(route('/api/auth/login'), async ({ request }) => {
    const parsed = await readJson(request, loginRequestSchema)
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid login payload')
    const user = getUserByEmail(parsed.data.email)
    if (!user || user.passwordDigest !== await digestPassword(parsed.data.password)) return fail(401, 'INVALID_CREDENTIALS', 'Invalid credentials')
    const token = `token-${user.id}`
    mockStore.state.sessions[token] = user.id
    mockStore.persist()
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
    mockStore.persist()
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
    mockStore.persist()
    return ok({ authenticated: false, user: null, expiresAt: null })
  }),

  http.get(route('/api/nfts'), ({ request }) => {
    if (mockStore.state.scenario === 'transient-error') return fail(503, 'TEMPORARY_FAILURE', 'Catalog temporarily unavailable')
    const parsed = nftListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid catalog query')
    const { search, collection, minPrice, maxPrice, network, sort, page, pageSize } = parsed.data
    let items = mockStore.state.nfts.map(withScenario)
    if (mockStore.state.scenario === 'empty-catalog') items = []
    if (search) items = items.filter((nft) => `${nft.name} ${nft.collection}`.toLowerCase().includes(search.toLowerCase()))
    if (minPrice !== undefined) items = items.filter((nft) => Number(nft.editions[0].priceEth) >= minPrice)
    if (maxPrice !== undefined) items = items.filter((nft) => Number(nft.editions[0].priceEth) <= maxPrice)
    if (network) items = items.filter((nft) => nft.network === network)
    const collectionCounts = Array.from(items.reduce((counts, nft) => counts.set(nft.collection, (counts.get(nft.collection) ?? 0) + 1), new Map<string, number>())).map(([name, count]) => ({ name, count }))
    if (collection) items = items.filter((nft) => nft.collection === collection)
    if (sort === 'price-asc') items.sort((a, b) => Number(a.editions[0].priceEth) - Number(b.editions[0].priceEth))
    if (sort === 'price-desc') items.sort((a, b) => Number(b.editions[0].priceEth) - Number(a.editions[0].priceEth))
    const start = (page - 1) * pageSize
    return ok({ items: items.slice(start, start + pageSize), total: items.length, page, pageSize, hasNext: start + pageSize < items.length, collectionCounts })
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
    mockStore.persist()
    return ok({ nftIds: favorites })
  }),
  http.delete(route('/api/favorites/:nftId'), ({ request, params }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const favorites = mockStore.state.favorites[result.user.id] ?? []
    mockStore.state.favorites[result.user.id] = favorites.filter((nftId) => nftId !== String(params.nftId))
    mockStore.persist()
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
    mockStore.persist()
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
  http.put(route('/api/profile'), async ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const parsed = await readJson(request, profileUpdateSchema)
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid profile payload')
    const current = mockStore.state.profiles[result.user.id]
    const profile = { ...current, ...parsed.data }
    mockStore.state.profiles[result.user.id] = profile
    result.user.name = profile.name
    result.user.avatarUrl = profile.avatarUrl
    mockStore.persist()
    return ok(profile)
  }),
  http.put(route('/api/auth/password'), async ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const parsed = await readJson(request, changePasswordSchema)
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid password payload')
    if (result.user.passwordDigest !== await digestPassword(parsed.data.currentPassword)) return fail(401, 'INVALID_CREDENTIALS', 'Current password is incorrect')
    result.user.passwordDigest = await digestPassword(parsed.data.newPassword)
    mockStore.persist()
    return ok({ changed: true })
  }),
  http.get(route('/api/wallets'), ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    return ok(walletsForUser(result.user.id))
  }),
  http.post(route('/api/wallets'), async ({ request }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const parsed = await readJson(request, walletCreateSchema)
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid wallet payload')
    if (walletsForUser(result.user.id).some((wallet) => wallet.address === parsed.data.address)) return fail(409, 'WALLET_CONFLICT', 'This wallet is already registered')
    const ownedWallets = walletsForUser(result.user.id)
    const wallet = { id: nextWalletId(), ...parsed.data, isPrimary: ownedWallets.length === 0 }
    mockStore.state.wallets.push(wallet)
    mockStore.state.profiles[result.user.id].walletIds.push(wallet.id)
    mockStore.persist()
    return ok(wallet, { status: 201 })
  }),
  http.patch(route('/api/wallets/:walletId'), async ({ request, params }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const walletId = String(params.walletId)
    if (!mockStore.state.profiles[result.user.id].walletIds.includes(walletId)) return fail(404, 'WALLET_NOT_FOUND', 'Wallet not found')
    const parsed = await readJson(request, walletUpdateSchema)
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', 'Invalid wallet payload')
    const wallet = mockStore.state.wallets.find((candidate) => candidate.id === walletId)
    if (!wallet) return fail(404, 'WALLET_NOT_FOUND', 'Wallet not found')
    if (parsed.data.address && walletsForUser(result.user.id).some((candidate) => candidate.id !== walletId && candidate.address === parsed.data.address)) return fail(409, 'WALLET_CONFLICT', 'This wallet is already registered')
    const usedByOrder = mockStore.state.orders.some((order) => order.userId === result.user.id && order.walletId === walletId)
    const changesOrderIdentity = (parsed.data.address !== undefined && parsed.data.address !== wallet.address) || (parsed.data.network !== undefined && parsed.data.network !== wallet.network)
    if (usedByOrder && changesOrderIdentity) return fail(409, 'WALLET_IN_USE', 'Address and network cannot change after a wallet is used in an order')
    Object.assign(wallet, parsed.data)
    mockStore.persist()
    return ok(wallet)
  }),
  http.put(route('/api/wallets/:walletId/primary'), ({ request, params }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const walletId = String(params.walletId)
    if (!mockStore.state.profiles[result.user.id].walletIds.includes(walletId)) return fail(404, 'WALLET_NOT_FOUND', 'Wallet not found')
    setPrimaryWallet(result.user.id, walletId)
    mockStore.persist()
    return ok(mockStore.state.wallets.find((wallet) => wallet.id === walletId)!)
  }),
  http.delete(route('/api/wallets/:walletId'), ({ request, params }) => {
    const result = requireUser(request)
    if ('response' in result) return result.response
    const walletId = String(params.walletId)
    const profile = mockStore.state.profiles[result.user.id]
    if (!profile.walletIds.includes(walletId)) return fail(404, 'WALLET_NOT_FOUND', 'Wallet not found')
    if (mockStore.state.orders.some((order) => order.userId === result.user.id && order.walletId === walletId)) return fail(409, 'WALLET_IN_USE', 'Wallet is referenced by an existing order')
    const wasPrimary = mockStore.state.wallets.find((wallet) => wallet.id === walletId)?.isPrimary
    mockStore.state.wallets = mockStore.state.wallets.filter((wallet) => wallet.id !== walletId)
    profile.walletIds = profile.walletIds.filter((id) => id !== walletId)
    if (wasPrimary && profile.walletIds[0]) setPrimaryWallet(result.user.id, profile.walletIds[0])
    mockStore.persist()
    return ok({ wallets: walletsForUser(result.user.id) })
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
      const sameOperation = existingKey.userId === result.user.id && existingKey.walletId === parsed.data.walletId && existingKey.network === parsed.data.network && existingKey.couponCode === parsed.data.couponCode && (!parsed.data.quoteTotalEth || existingKey.quoteTotalEth === parsed.data.quoteTotalEth) && JSON.stringify(existingKey.collector) === JSON.stringify(parsed.data.collector)
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
    const order = { id: idempotencyKey, userId: result.user.id, status, transactionReference: status === 'confirmed' ? `tx-${idempotencyKey}` : null, items, subtotalEth: quote.subtotalEth, discountEth: quote.discountEth, networkFeeEth: quote.networkFeeEth, totalEth: quote.totalEth, walletId: parsed.data.walletId, network: parsed.data.network, collector: parsed.data.collector, createdAt: now() }
    mockStore.state.idempotencyKeys[idempotencyKey] = { userId: result.user.id, walletId: parsed.data.walletId, network: parsed.data.network, couponCode: parsed.data.couponCode, quoteTotalEth: requestedQuoteTotal, collector: parsed.data.collector }
    mockStore.state.orders.push(order)
    emitMockEvent('order.updated', { id: order.id, userId: order.userId, version: 1, order })
    if (status === 'confirmed') {
      mockStore.state.carts[result.user.id] = cart.flatMap((cartItem) => {
        const purchased = items.find((item) => item.nftId === cartItem.nftId && item.editionId === cartItem.editionId)
        const remaining = cartItem.quantity - (purchased?.quantity ?? 0)
        return remaining > 0 ? [{ ...cartItem, quantity: remaining }] : []
      })
    }
    mockStore.persist()
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
