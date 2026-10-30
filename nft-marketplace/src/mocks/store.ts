import type { Nft, Order, Profile, User, Wallet } from '@/domain/contracts'

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
  sessions: Record<string, string>
  profiles: Record<string, Profile>
}

export const DEMO_PASSWORD_DIGEST = '41bd876b085d6031cb0e04de35b88d77f83a4ba39f879fee40805ac19e356023'
const initialUsers: StoredUser[] = [
  { id: 'user-1', email: 'ada@example.test', name: 'Ada Lovelace', avatarUrl: null, passwordDigest: DEMO_PASSWORD_DIGEST, bio: 'Digital collector', walletIds: ['wallet-1'] },
  { id: 'user-2', email: 'alan@example.test', name: 'Alan Turing', avatarUrl: null, passwordDigest: DEMO_PASSWORD_DIGEST, bio: 'NFT explorer', walletIds: ['wallet-2'] },
]
const initialNfts: Nft[] = [
  { id: 'nft-1', name: 'Emerald Ape #042', collection: 'Emerald Apes', imageUrl: '/assets/ape-emerald.png', description: 'A simulated collectible for deterministic tests.', creator: 'Emerald Studio', version: 1, editions: [{ id: 'edition-1', label: '1 of 1', priceEth: '1.19', availableQuantity: 2, maxQuantity: 2 }] },
  { id: 'nft-2', name: 'Violet Nomad #214', collection: 'Violet Nomads', imageUrl: '/assets/ape-violet.png', description: 'A second simulated collectible.', creator: 'Nomad Studio', version: 1, editions: [{ id: 'edition-2', label: '1 of 10', priceEth: '1.29', availableQuantity: 10, maxQuantity: 10 }] },
  { id: 'nft-3', name: 'Ivory Baron #488', collection: 'Ivory Barons', imageUrl: '/assets/ape-ivory.png', description: 'A third simulated collectible.', creator: 'Baron Studio', version: 1, editions: [{ id: 'edition-3', label: '1 of 5', priceEth: '1.79', availableQuantity: 5, maxQuantity: 5 }] },
]
const initialWallets: Wallet[] = [
  { id: 'wallet-1', label: 'Ada primary', address: '0xADA0000000000000000000000000000000000001', network: 'ethereum', isPrimary: true },
  { id: 'wallet-2', label: 'Alan primary', address: '0xALA0000000000000000000000000000000000002', network: 'polygon', isPrimary: true },
]

function clone<T>(value: T): T { return structuredClone(value) }

export function createInitialMockState(scenario: MockScenario = 'default'): MockState {
  return {
    scenario,
    users: clone(initialUsers),
    nfts: clone(initialNfts),
    wallets: clone(initialWallets),
    favorites: { 'user-1': ['nft-2'], 'user-2': [] },
    carts: { 'user-1': [], 'user-2': [] },
    orders: [],
    sessions: {},
    profiles: Object.fromEntries(initialUsers.map((user) => [user.id, { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, bio: user.bio, walletIds: user.walletIds }])),
  }
}

export const mockStore = {
  state: createInitialMockState(),
  reset(scenario: MockScenario = 'default') { this.state = createInitialMockState(scenario) },
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
