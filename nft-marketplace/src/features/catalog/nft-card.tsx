import { ArrowUpRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { Nft } from '@/domain/contracts'
import { FavoriteButton } from './favorite-button'

export function NftCard({ nft }: { nft: Nft }) {
  const edition = nft.editions[0]
  return (
    <article className="nft-card">
      <Link className="nft-card-image" to="/nft/$id" params={{ id: nft.id }}>
        <img src={nft.imageUrl} alt={`${nft.name}, ${nft.collection}`} onError={(event) => { event.currentTarget.style.display = 'none' }} />
        <span className="card-arrow"><ArrowUpRight size={17} /></span>
      </Link>
      <div className="nft-card-body">
        <div className="nft-card-heading"><div><p className="eyebrow">{nft.collection}</p><h3>{nft.name}</h3></div><FavoriteButton nftId={nft.id} compact /></div>
        <div className="nft-card-meta"><span>{edition.label}</span><strong>{edition.priceEth} ETH</strong></div>
      </div>
    </article>
  )
}
