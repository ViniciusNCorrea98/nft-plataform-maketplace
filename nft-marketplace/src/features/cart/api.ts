import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Decimal from 'decimal.js'
import { sessionQueryKey } from '@/app/session'
import { apiClient, setAuthToken } from '@/lib/http/api-client'
import { cartItemMutationSchema, cartResponseSchema, quoteRequestSchema, quoteResponseSchema, type CartResponse, type QuoteResponse } from '@/domain/contracts'

export const cartQueryKey = (userId: string) => ['cart', userId] as const
export const quoteQueryKey = (userId: string, couponCode: string | null) => ['quote', userId, couponCode] as const

function isUnauthorized(error: unknown) { return axios.isAxiosError(error) && error.response?.status === 401 }
function handleUnauthorized(error: unknown): never { if (isUnauthorized(error)) setAuthToken(null); throw error }

export async function fetchCart() {
  try {
    const response = await apiClient.get('/cart')
    return cartResponseSchema.parse(response.data)
  } catch (error) { return handleUnauthorized(error) }
}

export async function updateCartItem(input: { nftId: string; editionId: string; quantity: number }) {
  const payload = cartItemMutationSchema.parse(input)
  try {
    const response = await apiClient.put('/cart/items', payload)
    return cartResponseSchema.parse(response.data)
  } catch (error) { return handleUnauthorized(error) }
}

export async function fetchQuote(couponCode: string | null): Promise<QuoteResponse> {
  const payload = quoteRequestSchema.parse({ couponCode })
  try {
    const response = await apiClient.post('/quotes', payload)
    return quoteResponseSchema.parse(response.data)
  } catch (error) { return handleUnauthorized(error) }
}

export function useCart(userId: string | undefined) {
  return useQuery({ queryKey: userId ? cartQueryKey(userId) : ['cart', 'anonymous'], queryFn: fetchCart, enabled: Boolean(userId), retry: false })
}

export function useQuote(userId: string | undefined, couponCode: string | null) {
  return useQuery({ queryKey: userId ? quoteQueryKey(userId, couponCode) : ['quote', 'anonymous', couponCode], queryFn: () => fetchQuote(couponCode), enabled: Boolean(userId), retry: false })
}

function updateCachedCart(current: CartResponse | undefined, input: { nftId: string; editionId: string; quantity: number }): CartResponse | undefined {

  if (!current) return current

  const items = current.items.filter((item) => !(item.nftId === input.nftId && item.editionId === input.editionId))

  const existing = current.items.find((item) => item.nftId === input.nftId && item.editionId === input.editionId)

  if (input.quantity > 0 && existing) items.push({ ...existing, quantity: input.quantity })

  const subtotal = items.reduce(
    (sum, item) => sum.plus(
      new Decimal(item.unitPriceEth).times(item.quantity)
    ), new Decimal(0)
  )


  return { items, subtotalEth: subtotal.toFixed(2) }
}

export function useCartMutation(userId: string | undefined) {
  const queryClient = useQueryClient()
  const key = userId ? cartQueryKey(userId) : ['cart', 'anonymous'] as const
  return useMutation({
    mutationFn: updateCartItem,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<CartResponse>(key)
      queryClient.setQueryData(key, updateCachedCart(previous, input))
      return { previous }
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      else queryClient.removeQueries({ queryKey: key })
      if (isUnauthorized(error)) {
        setAuthToken(null)
        queryClient.setQueryData(sessionQueryKey, { authenticated: false, user: null, expiresAt: null })
        if (userId) queryClient.removeQueries({ queryKey: cartQueryKey(userId) })
      }
    },
    onSuccess: (serverState) => queryClient.setQueryData(key, serverState),
    onSettled: (_data, error) => {
      if (error && !isUnauthorized(error) && userId) void queryClient.invalidateQueries({ queryKey: cartQueryKey(userId) })
      if (userId) void queryClient.invalidateQueries({ queryKey: ['quote', userId] })
    },
  })
}
