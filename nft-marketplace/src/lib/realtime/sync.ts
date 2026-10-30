import Decimal from 'decimal.js'
import type { QueryClient } from '@tanstack/react-query'
import { cartQueryKey } from '@/features/cart/api'
import { nftQueryKey } from '@/features/catalog/api'
import { orderQueryKey } from '@/features/checkout/api'
import type { CartResponse, NftListResponse, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/domain/contracts'

export const realtimeStatusKey = (userId: string) => ['realtime', 'status', userId] as const
export const realtimeStaleKey = (userId: string) => ['realtime', 'stale', userId] as const

type RealtimeMetadata = { nftVersions: Map<string, number>; orderVersions: Map<string, number> }
const metadataByClient = new WeakMap<QueryClient, RealtimeMetadata>()

function metadata(queryClient: QueryClient) {
  const current = metadataByClient.get(queryClient)
  if (current) return current
  const created = { nftVersions: new Map<string, number>(), orderVersions: new Map<string, number>() }
  metadataByClient.set(queryClient, created)
  return created
}

function isNewer(currentVersion: number | undefined, nextVersion: number) {
  return currentVersion === undefined || nextVersion > currentVersion
}

export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent, userId?: string) {
  if (event.id !== event.nft.id) return false
  const versions = metadata(queryClient).nftVersions
  if (!isNewer(versions.get(event.id), event.version)) return false
  versions.set(event.id, event.version)

  queryClient.setQueryData(nftQueryKey(event.id), (current: NftUpdatedEvent['nft'] | undefined) => current && current.version > event.nft.version ? current : event.nft)
  queryClient.setQueriesData<NftListResponse>({ queryKey: ['nfts'] }, (current) => current ? {
    ...current,
    items: current.items.map((item) => item.id === event.id && item.version <= event.nft.version ? event.nft : item),
  } : current)

  if (!userId) return true
  const cartKey = cartQueryKey(userId)
  const cart = queryClient.getQueryData<CartResponse>(cartKey)
  const affectsCart = Boolean(cart?.items.some((item) => item.nftId === event.id))
  if (affectsCart) {
    queryClient.setQueryData<CartResponse>(cartKey, (current) => current ? {
      ...current,
      items: current.items.map((item) => item.nftId === event.id ? {
        ...item,
        unitPriceEth: event.nft.editions.find((edition) => edition.id === item.editionId)?.priceEth ?? item.unitPriceEth,
        availableQuantity: event.nft.editions.find((edition) => edition.id === item.editionId)?.availableQuantity ?? item.availableQuantity,
        version: event.nft.version,
      } : item),
      subtotalEth: current.items.reduce((sum, item) => {
        const next = item.nftId === event.id ? event.nft.editions.find((edition) => edition.id === item.editionId)?.priceEth ?? item.unitPriceEth : item.unitPriceEth
        return sum.plus(new Decimal(next).times(item.quantity))
      }, new Decimal(0)).toFixed(2),
    } : current)
    queryClient.setQueryData(realtimeStaleKey(userId), true)
    void queryClient.invalidateQueries({ queryKey: ['quote', userId] })
  }
  return true
}

function terminal(status: Order['status']) { return status === 'confirmed' || status === 'declined' }

export function applyOrderUpdated(queryClient: QueryClient, event: OrderUpdatedEvent, userId: string) {
  if (event.userId !== userId || event.order.userId !== userId || event.id !== event.order.id) return false
  const versions = metadata(queryClient).orderVersions
  if (!isNewer(versions.get(`${userId}:${event.id}`), event.version)) return false
  const current = queryClient.getQueryData<Order>(orderQueryKey(userId, event.id))
  if (current && terminal(current.status)) return false
  versions.set(`${userId}:${event.id}`, event.version)
  queryClient.setQueryData(orderQueryKey(userId, event.id), (cached: Order | undefined) => cached && terminal(cached.status) ? cached : event.order)
  if (event.order.status === 'confirmed') {
    queryClient.removeQueries({ queryKey: cartQueryKey(userId) })
    queryClient.removeQueries({ queryKey: ['quote', userId] })
  }
  return true
}
