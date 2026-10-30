import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/http/api-client'
import { favoriteResponseSchema, nftListResponseSchema, nftSchema, type NftListQuery } from '@/domain/contracts'

export const catalogQueryKey = (query: NftListQuery) => ['nfts', query] as const
export const nftQueryKey = (id: string) => ['nft', id] as const
export const favoritesQueryKey = ['favorites'] as const

export async function fetchCatalog(query: NftListQuery) {
  const response = await apiClient.get('/nfts', { params: query })
  return nftListResponseSchema.parse(response.data)
}

export async function fetchNft(id: string) {
  const response = await apiClient.get(`/nfts/${id}`)
  return nftSchema.parse(response.data)
}

export async function fetchFavorites() {
  const response = await apiClient.get('/favorites')
  return favoriteResponseSchema.parse(response.data)
}

export function useCatalog(query: NftListQuery) {
  return useQuery({ queryKey: catalogQueryKey(query), queryFn: () => fetchCatalog(query), placeholderData: (previous) => previous })
}

export function useNft(id: string) {
  return useQuery({ queryKey: nftQueryKey(id), queryFn: () => fetchNft(id) })
}
