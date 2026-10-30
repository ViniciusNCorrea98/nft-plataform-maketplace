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
  editions: z.array(nftEditionSchema).min(1),
  version: z.number().int().nonnegative(),
})
export type Nft = z.infer<typeof nftSchema>

export const nftListQuerySchema = z.object({
  search: z.string().optional(),
  collection: z.string().optional(),
  sort: z.enum(['featured', 'price-asc', 'price-desc']).default('featured'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(6),
})
export type NftListQuery = z.infer<typeof nftListQuerySchema>

export const nftListResponseSchema = z.object({
  items: z.array(nftSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasNext: z.boolean(),
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

export const profileSchema = userSchema.extend({ bio: z.string(), walletIds: z.array(id) })
export type Profile = z.infer<typeof profileSchema>

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

export const createOrderRequestSchema = z.object({
  walletId: id,
  network: z.enum(['ethereum', 'polygon']),
  couponCode: z.string().trim().min(1).nullable(),
})
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  fields: z.record(z.string(), z.array(z.string())).optional(),
})
export type ApiError = z.infer<typeof apiErrorSchema>

