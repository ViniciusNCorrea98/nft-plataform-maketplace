import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { sessionQueryKey } from '@/app/session'
import { setAuthToken } from '@/lib/http/api-client'
import { apiClient } from '@/lib/http/api-client'
import { orderSchema, walletSchema, type CreateOrderRequest, type Order } from '@/domain/contracts'
import { cartQueryKey, quoteQueryKey } from '@/features/cart/api'

export const walletsQueryKey = (userId: string) => ['wallets', userId] as const
export const orderQueryKey = (userId: string, orderId: string) => ['order', userId, orderId] as const

function isUnauthorized(error: unknown) { return axios.isAxiosError(error) && error.response?.status === 401 }
function handleUnauthorized(error: unknown): never {
  if (isUnauthorized(error)) setAuthToken(null)
  throw error
}

export async function fetchWallets() {
  try {
    const response = await apiClient.get('/wallets')
    return walletSchema.array().parse(response.data)
  } catch (error) { return handleUnauthorized(error) }
}

export async function fetchOrder(orderId: string) {
  try {
    const response = await apiClient.get(`/orders/${encodeURIComponent(orderId)}`)
    return orderSchema.parse(response.data)
  } catch (error) { return handleUnauthorized(error) }
}

export async function createOrder(input: { payload: CreateOrderRequest; idempotencyKey: string }): Promise<Order> {
  try {
    const response = await apiClient.post('/orders', input.payload, { headers: { 'Idempotency-Key': input.idempotencyKey } })
    return orderSchema.parse(response.data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 402) return orderSchema.parse(error.response.data)
    return handleUnauthorized(error)
  }
}

export function useWallets(userId: string | undefined) {
  return useQuery({ queryKey: userId ? walletsQueryKey(userId) : ['wallets', 'anonymous'], queryFn: fetchWallets, enabled: Boolean(userId), retry: false })
}

export function useOrder(userId: string | undefined, orderId: string) {
  return useQuery({ queryKey: userId ? orderQueryKey(userId, orderId) : ['order', 'anonymous', orderId], queryFn: () => fetchOrder(orderId), enabled: Boolean(userId && orderId), retry: false })
}

function clearPrivateSession(queryClient: ReturnType<typeof useQueryClient>, userId: string | undefined) {
  setAuthToken(null)
  queryClient.setQueryData(sessionQueryKey, { authenticated: false, user: null, expiresAt: null })

  if (userId) {
    queryClient.removeQueries({ queryKey: cartQueryKey(userId) })
    queryClient.removeQueries({ queryKey: ['quote', userId] })
    queryClient.removeQueries({ queryKey: ['wallets', userId] })
  }
}

export function useCreateOrder(userId: string | undefined) {

  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createOrder,
    onSuccess: (order) => {

      if (!userId) return
      queryClient.setQueryData(orderQueryKey(userId, order.id), order)

      if (order.status === 'confirmed') {
        queryClient.removeQueries({ queryKey: cartQueryKey(userId) })
        queryClient.removeQueries({ queryKey: ['quote', userId] })
      }
       else {
        void queryClient.invalidateQueries({ queryKey: cartQueryKey(userId) })
        void queryClient.invalidateQueries({ queryKey: quoteQueryKey(userId, null) })
      }
    },
    onError: (error) => { if (isUnauthorized(error)) clearPrivateSession(queryClient, userId) },
  })
}
