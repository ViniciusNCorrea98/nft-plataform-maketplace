import { ArrowLeft, ArrowUpRight, Heart, Share2 } from 'lucide-react'
import { useNavigate, useParams, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useCatalog, useNft } from './api'

export function DetailPage() {
  const { id } = useParams({ from: '/nft/$id' })
  const navigate = useNavigate()
  const result = useNft(id)
  const related = useCatalog({ page: 1, pageSize: 6, sort: 'featured' })
  if (result.isPending) return <main className="detail-page"><div className="detail-skeleton" /></main>
  if (result.isError || !result.data) return <main className="detail-page"><div className="state-panel error-state"><h1>Piece not found.</h1><p>This collectible is no longer available.</p><Button onClick={() => void navigate({ to: '/' })}>Back to explore</Button></div></main>
  const nft = result.data
  const edition = nft.editions[0]
  const relatedItems = related.data?.items.filter((item) => item.id !== nft.id) ?? []
  return (
    <main className="detail-page">
      <Link className="back-link" to="/"><ArrowLeft size={16} /> Back to collection</Link>
      <div className="detail-layout"><section className="detail-gallery"><div className="detail-image"><img src={nft.imageUrl} alt={nft.name} onError={(event) => { event.currentTarget.style.display = 'none' }} /><span className="image-index">01 / 01</span></div><div className="thumbnail-row"><button className="thumbnail active" type="button" aria-label="Imagem principal"><img src={nft.imageUrl} alt="" /></button><button className="thumbnail" type="button" aria-label="Compartilhar"><Share2 size={18} /></button></div></section><section className="detail-info"><p className="eyebrow accent">{nft.collection}</p><h1>{nft.name}</h1><p className="detail-description">{nft.description}</p><div className="creator-line"><span className="avatar">{nft.creator.slice(0, 1)}</span><span>Created by <strong>{nft.creator}</strong></span></div><div className="price-panel"><span>Current price</span><strong>{edition.priceEth} ETH</strong><small>{edition.label} · {edition.availableQuantity} available</small></div><div className="detail-actions"><Link className="detail-buy" to="/cart">Buy now <ArrowUpRight size={16} /></Link><Button variant="outline" aria-label="Adicionar aos favoritos"><Heart size={17} /> Favorite</Button></div><div className="detail-tabs"><strong>About this piece</strong><p>{nft.description} Edition {edition.label.toLowerCase()} by {nft.creator}.</p></div></section></div>
      {relatedItems.length > 0 && <section className="related-section" id="collections"><div className="section-heading"><div><p className="eyebrow accent">MORE FROM THE COLLECTION</p><h2>You may also like</h2></div></div><div className="related-grid">{relatedItems.map((item) => <Link className="related-card" key={item.id} to="/nft/$id" params={{ id: item.id }}><img src={item.imageUrl} alt={item.name} onError={(event) => { event.currentTarget.style.display = 'none' }} /><div><span>{item.collection}</span><strong>{item.name}</strong></div></Link>)}</div></section>}
    </main>
  )
}
