import { Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { NftListQuery } from '@/domain/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NftCard } from './nft-card'
import { useCatalog } from './api'

export function CatalogPage() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  const [draftSearch, setDraftSearch] = useState(search.search ?? '')
  const sort = search.sort ?? 'featured'
  const page = search.page ?? 1
  const query: NftListQuery = { search: search.search, collection: search.collection, sort, page, pageSize: 6 }
  const result = useCatalog(query)
  const collections = [...new Set((result.data?.items ?? []).map((item) => item.collection))]
  const updateSearch = (updates: Partial<NftListQuery>) => {
    void navigate({ search: (current) => ({ ...current, ...updates }) })
  }
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    updateSearch({ search: draftSearch.trim() || undefined, page: 1 })
  }

  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy"><p className="eyebrow accent">THE DIGITAL FRONTIER</p><h1>Own a piece of<br /><em>the uncommon.</em></h1><p>Discover collectible digital art from creators shaping the next era of culture.</p><a className="cta-button" href="#catalog">Explore collection <span>↗</span></a></div>
        <div className="hero-art" aria-label="Artwork preview"><div className="hero-glow" /><span>O</span><div className="hero-art-label">UNCOMMON<br /><small>Digital collection / 01</small></div></div>
      </section>
      <section className="catalog-section" id="catalog">
        <div className="section-heading"><div><p className="eyebrow accent">CURATED FOR YOU</p><h2>Explore the collection</h2></div><span className="catalog-count">{result.data?.total ?? '—'} pieces</span></div>
        <form className="catalog-toolbar" onSubmit={submitSearch} role="search">
          <div className="search-field"><Search size={18} /><Input aria-label="Buscar NFTs" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Search by name or collection" /></div>
          <label className="select-field"><SlidersHorizontal size={17} /><span className="sr-only">Coleção</span><select value={search.collection ?? ''} onChange={(event) => updateSearch({ collection: event.target.value || undefined, page: 1 })}><option value="">All collections</option>{collections.map((collection) => <option key={collection} value={collection}>{collection}</option>)}</select></label>
          <label className="select-field"><span className="sr-only">Ordenar</span><select value={sort} onChange={(event) => updateSearch({ sort: event.target.value as NftListQuery['sort'], page: 1 })}><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label>
        </form>
        {result.isPending && <div className="catalog-grid" aria-label="Carregando catálogo">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item} />)}</div>}
        {result.isError && <div className="state-panel error-state"><h3>We lost the signal.</h3><p>Unable to load the collection right now.</p><Button variant="outline" onClick={() => void result.refetch()}>Try again</Button></div>}
        {!result.isPending && !result.isError && result.data?.items.length === 0 && <div className="state-panel"><h3>No pieces found.</h3><p>Try another search or collection.</p></div>}
        {!result.isPending && !result.isError && result.data && result.data.items.length > 0 && <div className="catalog-grid">{result.data.items.map((nft) => <NftCard key={nft.id} nft={nft} />)}</div>}
        <div className="pagination" aria-label="Paginação"><Button variant="outline" disabled={page <= 1} onClick={() => updateSearch({ page: page - 1 })}>Previous</Button><span>Page {page}</span><Button variant="outline" disabled={!result.data?.hasNext} onClick={() => updateSearch({ page: page + 1 })}>Next</Button></div>
      </section>
    </main>
  )
}
