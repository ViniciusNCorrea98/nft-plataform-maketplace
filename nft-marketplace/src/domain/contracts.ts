import { z } from 'zod'

const ethAmount = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid ETH amount')
const id = z.string().min(1)

export const userSchema = z.object({
  id,
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().nullable(),
})
export type User = z.infer<typeof userSchema>

export const sessionSchema = z.object({
  authenticated: z.boolean(),
  user: userSchema.nullable(),
  expiresAt: z.string().datetime().nullable(),
})
export type Session = z.infer<typeof sessionSchema>

export const authResponseSchema = z.object({ token: z.string().min(1), session: sessionSchema })
export type AuthResponse = z.infer<typeof authResponseSchema>

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const registerRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
})
export type RegisterRequest = z.infer<typeof registerRequestSchema>

export const nftEditionSchema = z.object({
  id,
  label: z.string().min(1),
  priceEth: ethAmount,
  availableQuantity: z.number().int().nonnegative(),
  maxQuantity: z.number().int().positive(),
})
export type NftEdition = z.infer<typeof nftEditionSchema>

export const nftSchema = z.object({
  id,
  name: z.string().min(1),
  collection: z.string().min(1),
  imageUrl: z.string().min(1),
  description: z.string(),
  creator: z.string().min(1),
  network: z.enum(['ethereum', 'polygon', 'solana']).default('ethereum'),
  editions: z.array(nftEditionSchema).min(1),
  version: z.number().int().nonnegative(),
})
export type Nft = z.infer<typeof nftSchema>

export const nftListQuerySchema = z.object({
  search: z.string().optional(),
  collection: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  network: z.enum(['ethereum', 'polygon', 'solana']).optional(),
  sort: z.enum(['featured', 'price-asc', 'price-desc']).default('featured'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(6),
}).refine((query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice, { message: 'Minimum price cannot exceed maximum price', path: ['maxPrice'] })
export type NftListQuery = z.infer<typeof nftListQuerySchema>

export const collectionCountSchema = z.object({
  name: z.string().min(1),
  count: z.number().int().nonnegative(),
})
export type CollectionCount = z.infer<typeof collectionCountSchema>

export const nftListResponseSchema = z.object({
  items: z.array(nftSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasNext: z.boolean(),
  collectionCounts: z.array(collectionCountSchema),
})
export type NftListResponse = z.infer<typeof nftListResponseSchema>

export const favoriteResponseSchema = z.object({ nftIds: z.array(id) })
export type FavoriteResponse = z.infer<typeof favoriteResponseSchema>

export const favoriteMutationSchema = z.object({ nftId: id })
export type FavoriteMutation = z.infer<typeof favoriteMutationSchema>

export const cartItemSchema = z.object({
  nftId: id,
  editionId: id,
  quantity: z.number().int().positive(),
  unitPriceEth: ethAmount,
  availableQuantity: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const cartResponseSchema = z.object({
  items: z.array(cartItemSchema),
  subtotalEth: ethAmount,
})
export type CartResponse = z.infer<typeof cartResponseSchema>

export const cartItemMutationSchema = z.object({
  nftId: id,
  editionId: id,
  quantity: z.number().int().nonnegative(),
})
export type CartItemMutation = z.infer<typeof cartItemMutationSchema>

export const couponRequestSchema = z.object({
  code: z.string().trim().min(1).nullable(),
})
export type CouponRequest = z.infer<typeof couponRequestSchema>

export const quoteRequestSchema = z.object({
  couponCode: z.string().trim().min(1).nullable(),
})
export type QuoteRequest = z.infer<typeof quoteRequestSchema>

export const quoteResponseSchema = z.object({
  subtotalEth: ethAmount,
  discountEth: ethAmount,
  networkFeeEth: ethAmount,
  totalEth: ethAmount,
  couponCode: z.string().nullable(),
})
export type QuoteResponse = z.infer<typeof quoteResponseSchema>

export const walletSchema = z.object({
  id,
  label: z.string().min(1),
  address: z.string().min(1),
  network: z.enum(['ethereum', 'polygon']),
  isPrimary: z.boolean(),
})
export type Wallet = z.infer<typeof walletSchema>

export const walletCreateSchema = z.object({
  label: z.string().trim().min(1).max(60),
  address: z.string().trim().min(1).max(120),
  network: z.enum(['ethereum', 'polygon']),
})
export type WalletCreate = z.infer<typeof walletCreateSchema>

export const walletUpdateSchema = walletCreateSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one wallet field is required')
export type WalletUpdate = z.infer<typeof walletUpdateSchema>

export const profileSchema = userSchema.extend({ bio: z.string(), walletIds: z.array(id) })
export type Profile = z.infer<typeof profileSchema>

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1),
  bio: z.string().trim().max(280),
  avatarUrl: z.string().url().nullable(),
})
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})
export type ChangePassword = z.infer<typeof changePasswordSchema>

export const orderStatusSchema = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const orderItemSnapshotSchema = cartItemSchema.extend({ name: z.string().min(1) })
export const orderSchema = z.object({
  id,
  userId: id,
  status: orderStatusSchema,
  transactionReference: z.string().min(1).nullable(),
  items: z.array(orderItemSnapshotSchema).min(1),
  subtotalEth: ethAmount,
  discountEth: ethAmount,
  networkFeeEth: ethAmount,
  totalEth: ethAmount,
  walletId: id,
  network: z.enum(['ethereum', 'polygon']),
  createdAt: z.string().datetime(),
})
export type Order = z.infer<typeof orderSchema>

export const nftUpdatedEventSchema = z.object({
  id,
  version: z.number().int().nonnegative(),
  nft: nftSchema,
}).refine((event) => event.id === event.nft.id && event.version === event.nft.version, 'NFT event identity and version must match the resource')
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

export const orderUpdatedEventSchema = z.object({
  id,
  userId: id,
  version: z.number().int().nonnegative(),
  order: orderSchema,
})
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>

export const createOrderRequestSchema = z.object({
  walletId: id,
  network: z.enum(['ethereum', 'polygon']),
  couponCode: z.string().trim().min(1).nullable(),
  quoteTotalEth: ethAmount.optional(),
})
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  fields: z.record(z.string(), z.array(z.string())).optional(),
})
export type ApiError = z.infer<typeof apiErrorSchema>
