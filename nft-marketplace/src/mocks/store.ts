import nftFourImage from '@/assets/nftFour.webp'
import nftThreeImage from '@/assets/nftThree.webp'
import nftTwoImage from '@/assets/nftTwo.webp'
import { orderSchema, profileSchema, walletSchema, type CollectorSnapshot, type Nft, type Order, type Profile, type User, type Wallet } from '@/domain/contracts'
import { z } from 'zod'

export const mockScenarios = ['default', 'empty-catalog', 'transient-error', 'session-expired', 'invalid-coupon', 'price-changed', 'payment-declined', 'order-timeout'] as const
export type MockScenario = (typeof mockScenarios)[number]

type StoredUser = User & { passwordDigest: string; bio: string; walletIds: string[] }
export type CartRecord = { nftId: string; editionId: string; quantity: number }
export type MockState = {
  scenario: MockScenario
  users: StoredUser[]
  nfts: Nft[]
  wallets: Wallet[]
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord[]>
  orders: Order[]
  idempotencyKeys: Record<string, { userId: string; walletId: string; network: Wallet['network']; couponCode: string | null; quoteTotalEth: string; collector: CollectorSnapshot }>
  sessions: Record<string, string>
  profiles: Record<string, Profile>
}

const MOCK_STATE_STORAGE_KEY = 'nft-marketplace.mock-state'
const cartRecordSchema = z.object({ nftId: z.string().min(1), editionId: z.string().min(1), quantity: z.number().int().nonnegative() })
const idempotencyRecordSchema = z.object({
  userId: z.string().min(1),
  walletId: z.string().min(1),
  network: z.enum(['ethereum', 'polygon']),
  couponCode: z.string().nullable(),
  quoteTotalEth: z.string().min(1),
  collector: z.object({
    displayName: z.string().min(1), username: z.string().min(1), profileName: z.string().min(1), email: z.string().email(), ensName: z.string().min(1), walletAddress: z.string().min(1), note: z.string().nullable(),
  }),
})
const persistedUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().nullable(),
  bio: z.string(),
  walletIds: z.array(z.string().min(1)),
})
const persistedStateSchema = z.object({
  users: z.array(persistedUserSchema),
  wallets: z.array(walletSchema),
  favorites: z.record(z.string(), z.array(z.string().min(1))),
  carts: z.record(z.string(), z.array(cartRecordSchema)),
  orders: z.array(orderSchema),
  idempotencyKeys: z.record(z.string(), idempotencyRecordSchema),
  sessions: z.record(z.string(), z.string().min(1)),
  profiles: z.record(z.string(), profileSchema),
})
type PersistedState = z.infer<typeof persistedStateSchema>

export const DEMO_PASSWORD_DIGEST = '41bd876b085d6031cb0e04de35b88d77f83a4ba39f879fee40805ac19e356023'
const initialUsers: StoredUser[] = [
  { id: 'user-1', email: 'ada@example.test', name: 'Ada Lovelace', avatarUrl: null, passwordDigest: DEMO_PASSWORD_DIGEST, bio: 'Digital collector', walletIds: ['wallet-1'] },
  { id: 'user-2', email: 'alan@example.test', name: 'Alan Turing', avatarUrl: null, passwordDigest: DEMO_PASSWORD_DIGEST, bio: 'NFT explorer', walletIds: ['wallet-2'] },
]
// Demonstration inventory: each identity is unique; the three approved catalog images are intentionally reused three times.
const initialNfts: Nft[] = [
  { id: 'nft-1', name: 'Emerald Ape #042', collection: 'Emerald Apes', imageUrl: nftTwoImage, description: 'Demonstration collectible.', creator: 'Emerald Studio', network: 'ethereum', version: 1, editions: [{ id: 'edition-1', label: '1 de 1', priceEth: '1.19', availableQuantity: 2, maxQuantity: 2 }] },
  { id: 'nft-2', name: 'Sage Nomad #009', collection: 'Fotografia', imageUrl: nftThreeImage, description: 'Demonstration collectible.', creator: 'Nomad Studio', network: 'polygon', version: 1, editions: [{ id: 'edition-2', label: '1 de 10', priceEth: '1.69', availableQuantity: 10, maxQuantity: 10 }] },
  { id: 'nft-3', name: 'Neon Vessel #552', collection: 'Arte 3D', imageUrl: nftFourImage, description: 'Demonstration collectible.', creator: 'Baron Studio', network: 'solana', version: 1, editions: [{ id: 'edition-3', label: '1 de 5', priceEth: '1.99', availableQuantity: 5, maxQuantity: 5 }] },
  { id: 'nft-4', name: 'Cosmic Bloom #118', collection: 'Arte digital', imageUrl: nftThreeImage, description: 'Demonstration collectible.', creator: 'Bloom Studio', network: 'ethereum', version: 1, editions: [{ id: 'edition-4', label: '1 de 8', priceEth: '1.29', availableQuantity: 8, maxQuantity: 8 }] },
  { id: 'nft-5', name: 'Violet Nomad #314', collection: 'Fotografia', imageUrl: nftThreeImage, description: 'Demonstration collectible.', creator: 'Nomad Studio', network: 'polygon', version: 1, editions: [{ id: 'edition-5', label: '1 de 10', priceEth: '1.39', availableQuantity: 10, maxQuantity: 10 }] },
  { id: 'nft-6', name: 'Ivory Baron #088', collection: 'Arte 3D', imageUrl: nftFourImage, description: 'Demonstration collectible.', creator: 'Baron Studio', network: 'solana', version: 1, editions: [{ id: 'edition-6', label: '1 de 5', priceEth: '1.79', availableQuantity: 5, maxQuantity: 5 }] },
  { id: 'nft-7', name: 'Golden Beat #207', collection: 'Música', imageUrl: nftTwoImage, description: 'Demonstration collectible.', creator: 'Golden Studio', network: 'ethereum', version: 1, editions: [{ id: 'edition-7', label: '1 de 20', priceEth: '0.99', availableQuantity: 20, maxQuantity: 20 }] },
  { id: 'nft-8', name: 'Golden Signal #160', collection: 'Música', imageUrl: nftTwoImage, description: 'Demonstration collectible.', creator: 'Golden Studio', network: 'polygon', version: 1, editions: [{ id: 'edition-8', label: '1 de 20', priceEth: '0.39', availableQuantity: 20, maxQuantity: 20 }] },
  { id: 'nft-9', name: 'Kurio Genesis #001', collection: 'Colecionáveis', imageUrl: nftFourImage, description: 'Demonstration collectible.', creator: 'Kurio Studio', network: 'solana', version: 1, editions: [{ id: 'edition-9', label: '1 de 3', priceEth: '2.29', availableQuantity: 3, maxQuantity: 3 }] },
]
const initialWallets: Wallet[] = [
  { id: 'wallet-1', label: 'Ada primary', address: '0xADA0000000000000000000000000000000000001', network: 'ethereum', isPrimary: true },
  { id: 'wallet-2', label: 'Alan primary', address: '0xALA0000000000000000000000000000000000002', network: 'polygon', isPrimary: true },
]

function clone<T>(value: T): T { return structuredClone(value) }

function readPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(MOCK_STATE_STORAGE_KEY)
    if (!raw) return null
    const parsed = persistedStateSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function publicUsers(users: StoredUser[]) {
  return users.map((user) => persistedUserSchema.parse(Object.fromEntries(Object.entries(user).filter(([key]) => key !== 'passwordDigest'))))
}

function toPersistedState(state: MockState): PersistedState {
  return {
    users: publicUsers(state.users),
    wallets: state.wallets,
    favorites: state.favorites,
    carts: state.carts,
    orders: state.orders,
    idempotencyKeys: state.idempotencyKeys,
    sessions: state.sessions,
    profiles: state.profiles,
  }
}

function hydrateState(state: MockState): MockState {
  const persisted = readPersistedState()
  if (!persisted) return state

  const persistedUsers = new Map(persisted.users.map((user) => [user.id, user]))
  state.users = state.users.map((user) => {
    const persistedUser = persistedUsers.get(user.id)
    return persistedUser ? { ...user, ...persistedUser } : user
  })
  state.wallets = persisted.wallets
  for (const user of persisted.users) {
    if (!state.users.some((current) => current.id === user.id)) state.users.push({ ...user, passwordDigest: '' })
  }
  state.favorites = persisted.favorites
  state.carts = persisted.carts
  state.orders = persisted.orders
  state.idempotencyKeys = persisted.idempotencyKeys
  state.sessions = persisted.sessions
  state.profiles = persisted.profiles
  return state
}

export function createInitialMockState(scenario: MockScenario = 'default'): MockState {
  return {
    scenario,
    users: clone(initialUsers),
    nfts: clone(initialNfts),
    wallets: clone(initialWallets),
    favorites: { 'user-1': ['nft-2'], 'user-2': [] },
    carts: { 'user-1': [], 'user-2': [] },
    orders: [],
    idempotencyKeys: {},
    sessions: {},
    profiles: Object.fromEntries(initialUsers.map((user) => [user.id, { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, bio: user.bio, walletIds: user.walletIds }])),
  }
}

export const mockStore = {
  state: hydrateState(createInitialMockState()),
  persist() {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(MOCK_STATE_STORAGE_KEY, JSON.stringify(toPersistedState(this.state))) } catch { /* storage is optional in the mock */ }
  },
  rehydrate() { this.state = hydrateState(createInitialMockState(this.state.scenario)) },
  reset(scenario: MockScenario = 'default') {
    if (typeof window !== 'undefined') window.localStorage.removeItem(MOCK_STATE_STORAGE_KEY)
    this.state = createInitialMockState(scenario)
  },
}

export function getStoredUser(userId: string) { return mockStore.state.users.find((user) => user.id === userId) }
export function getUserByEmail(email: string) { return mockStore.state.users.find((user) => user.email === email) }
export function toPublicUser(user: StoredUser): User {
  return Object.fromEntries(Object.entries(user).filter(([key]) => !['passwordDigest', 'bio', 'walletIds'].includes(key))) as User
}
export function getUserIdFromToken(token: string | null) { return token ? mockStore.state.sessions[token] : undefined }
export function getTokenFromHeaders(headers: Headers) { const value = headers.get('authorization'); return value?.startsWith('Bearer ') ? value.slice(7) : null }
export function getCartForUser(userId: string) { return mockStore.state.carts[userId] ?? (mockStore.state.carts[userId] = []) }
export function getNft(nftId: string) { return mockStore.state.nfts.find((nft) => nft.id === nftId) }
export async function digestPassword(password: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
