import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { apiClient, setAuthToken } from '@/lib/http/api-client'
import { sessionQueryKey } from '@/app/session'
import { favoriteResponseSchema, favoriteMutationSchema, nftListResponseSchema, nftSchema, type FavoriteResponse, type NftListQuery } from '@/domain/contracts'

export const catalogQueryKey = (query: NftListQuery) => ['nfts', query] as const
export const nftQueryKey = (id: string) => ['nft', id] as const
export const favoritesQueryKey = (userId: string) => ['favorites', userId] as const

export async function fetchCatalog(query: NftListQuery) {
  const response = await apiClient.get('/nfts', { params: query })
  return nftListResponseSchema.parse(response.data)
}

export async function fetchNft(id: string) {
  const response = await apiClient.get(`/nfts/${id}`)
  return nftSchema.parse(response.data)
}

export async function fetchFavorites() {
  try {
    const response = await apiClient.get('/favorites')
    return favoriteResponseSchema.parse(response.data)
  } catch (error) {
    if (isUnauthorized(error)) setAuthToken(null)
    throw error
  }
}

async function addFavorite(nftId: string) {
  const payload = favoriteMutationSchema.parse({ nftId })
  const response = await apiClient.post('/favorites', payload)
  return favoriteResponseSchema.parse(response.data)
}

async function removeFavorite(nftId: string) {
  const response = await apiClient.delete(`/favorites/${encodeURIComponent(nftId)}`)
  return favoriteResponseSchema.parse(response.data)
}

function isUnauthorized(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401
}

export function useFavorites(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: userId ? favoritesQueryKey(userId) : ['favorites', 'anonymous'],
    queryFn: fetchFavorites,
    enabled: Boolean(userId) && enabled,
    retry: false,
  })
}

export function useFavoriteMutation(userId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = userId ? favoritesQueryKey(userId) : ['favorites', 'anonymous'] as const

  return useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean }) => favorite ? addFavorite(nftId) : removeFavorite(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<FavoriteResponse>(queryKey)
      queryClient.setQueryData<FavoriteResponse>(queryKey, (current) => ({
        nftIds: favorite
          ? [...new Set([...(current?.nftIds ?? []), nftId])]
          : (current?.nftIds ?? []).filter((id) => id !== nftId),
      }))
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      else queryClient.removeQueries({ queryKey })
      if (isUnauthorized(error)) {
        setAuthToken(null)
        queryClient.setQueryData(sessionQueryKey, { authenticated: false, user: null, expiresAt: null })
        if (userId) queryClient.removeQueries({ queryKey: favoritesQueryKey(userId) })
      }
    },
    onSuccess: (serverState) => {
      queryClient.setQueryData(queryKey, serverState)
    },
    onSettled: (_data, error) => {
      if (error && !isUnauthorized(error) && userId) void queryClient.invalidateQueries({ queryKey: favoritesQueryKey(userId) })
    },
  })
}

export function useCatalog(query: NftListQuery) {
  return useQuery({ queryKey: catalogQueryKey(query), queryFn: () => fetchCatalog(query), placeholderData: (previous) => previous })
}

export function useNft(id: string) {
  return useQuery({ queryKey: nftQueryKey(id), queryFn: () => fetchNft(id) })
}
