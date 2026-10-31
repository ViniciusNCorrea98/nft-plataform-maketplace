import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { sessionQueryKey } from '@/app/session'
import { apiErrorSchema, changePasswordSchema, profileSchema, profileUpdateSchema, walletCreateSchema, walletSchema, walletUpdateSchema, type ChangePassword, type Profile, type ProfileUpdate, type Session, type Wallet, type WalletCreate, type WalletUpdate } from '@/domain/contracts'
import { fetchWallets, walletsQueryKey } from '@/features/checkout/api'
import { apiClient, setAuthToken } from '@/lib/http/api-client'

export const profileQueryKey = (userId: string) => ['profile', userId] as const

function isUnauthorized(error: unknown) {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) return false
  const code = apiErrorSchema.safeParse(error.response.data)
  return code.success && (code.data.code === 'UNAUTHORIZED' || code.data.code === 'SESSION_EXPIRED')
}
function handleUnauthorized(error: unknown): never {
  if (isUnauthorized(error)) setAuthToken(null)
  throw error
}

export async function fetchProfile() {
  try {
    const response = await apiClient.get('/profile')
    return profileSchema.parse(response.data)
  } catch (error) { return handleUnauthorized(error) }
}

export async function updateProfile(input: ProfileUpdate): Promise<Profile> {
  const payload = profileUpdateSchema.parse(input)
  try {
    const response = await apiClient.put('/profile', payload)
    return profileSchema.parse(response.data)
  } catch (error) { return handleUnauthorized(error) }
}

export async function changePassword(input: ChangePassword) {
  const payload = changePasswordSchema.parse(input)
  try {
    const response = await apiClient.put('/auth/password', payload)
    return response.data as { changed: boolean }
  } catch (error) { return handleUnauthorized(error) }
}

export async function createWallet(input: WalletCreate): Promise<Wallet> {
  const payload = walletCreateSchema.parse(input)
  try {
    const response = await apiClient.post('/wallets', payload)
    return walletSchema.parse(response.data)
  } catch (error) { return handleUnauthorized(error) }
}

export async function updateWallet(input: { walletId: string; changes: WalletUpdate }): Promise<Wallet> {
  const payload = walletUpdateSchema.parse(input.changes)
  try {
    const response = await apiClient.patch(`/wallets/${encodeURIComponent(input.walletId)}`, payload)
    return walletSchema.parse(response.data)
  } catch (error) { return handleUnauthorized(error) }
}

export async function setPrimaryWallet(walletId: string): Promise<Wallet> {
  try {
    const response = await apiClient.put(`/wallets/${encodeURIComponent(walletId)}/primary`)
    return walletSchema.parse(response.data)
  } catch (error) { return handleUnauthorized(error) }
}

export async function deleteWallet(walletId: string) {
  try {
    await apiClient.delete(`/wallets/${encodeURIComponent(walletId)}`)
  } catch (error) { return handleUnauthorized(error) }
}

function handleMutationUnauthorized(queryClient: ReturnType<typeof useQueryClient>, userId: string | undefined, error: unknown) {
  if (!isUnauthorized(error)) return
  setAuthToken(null)
  queryClient.setQueryData(sessionQueryKey, { authenticated: false, user: null, expiresAt: null })
  if (userId) {
    queryClient.removeQueries({ queryKey: profileQueryKey(userId) })
    queryClient.removeQueries({ queryKey: walletsQueryKey(userId) })
  }
}

export function useProfile(userId: string | undefined) {
  return useQuery({ queryKey: userId ? profileQueryKey(userId) : ['profile', 'anonymous'], queryFn: fetchProfile, enabled: Boolean(userId), retry: false })
}

export function useProfileMutation(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => {
      if (!userId) return
      queryClient.setQueryData(profileQueryKey(userId), profile)
      queryClient.setQueryData<Session>(sessionQueryKey, (current) => current?.user ? { ...current, user: { ...current.user, name: profile.name, avatarUrl: profile.avatarUrl } } : current)
    },
    onError: (error) => handleMutationUnauthorized(queryClient, userId, error),
  })
}

export function usePasswordMutation(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: changePassword, onError: (error) => handleMutationUnauthorized(queryClient, userId, error) })
}

export function useWalletMutation(userId: string | undefined) {
  const queryClient = useQueryClient()
  const invalidate = () => { if (userId) void queryClient.invalidateQueries({ queryKey: walletsQueryKey(userId) }) }
  const onError = (error: unknown) => handleMutationUnauthorized(queryClient, userId, error)
  return {
    create: useMutation({ mutationFn: createWallet, onSuccess: invalidate, onError }),
    update: useMutation({ mutationFn: updateWallet, onSuccess: invalidate, onError }),
    primary: useMutation({ mutationFn: setPrimaryWallet, onSuccess: invalidate, onError }),
    remove: useMutation({ mutationFn: deleteWallet, onSuccess: invalidate, onError }),
  }
}

export { fetchWallets }
