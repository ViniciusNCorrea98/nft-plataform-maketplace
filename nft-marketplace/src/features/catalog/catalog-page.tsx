import { ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import heroImage from "@/assets/nftOne.webp";
import journalImage from "@/assets/nftOne.webp";
import editorialOne from "@/assets/nftThree.webp";
import editorialTwo from "@/assets/nftFour.webp";
import type { NftListQuery } from "@/domain/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NftCard } from "./nft-card";
import { useCatalog } from "./api";

export function CatalogPage() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const sort = search.sort ?? "featured";
  const page = search.page ?? 1;
  const [priceDraft, setPriceDraft] = useState({ min: search.minPrice?.toString() ?? "", max: search.maxPrice?.toString() ?? "" });
  const [priceError, setPriceError] = useState<string | null>(null);
  const result = useCatalog({
    search: search.search,
    collection: search.collection,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    network: search.network,
    sort,
    page,
    pageSize: 9,
  });
  const collections = result.data?.collectionCounts ?? [];
  const hasPagination = Boolean(
    result.data && (result.data.total > result.data.pageSize || page > 1)
  );
  const updateSearch = (updates: Partial<NftListQuery>) =>
    void navigate({ search: (current) => ({ ...current, ...updates }) });
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = String(
      new FormData(event.currentTarget).get("search") ?? ""
    ).trim();
    updateSearch({ search: draft || undefined, page: 1 });
  };
  const applyPrice = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const min = priceDraft.min === "" ? undefined : Number(priceDraft.min);
    const max = priceDraft.max === "" ? undefined : Number(priceDraft.max);
    if ((min !== undefined && (!Number.isFinite(min) || min < 0)) || (max !== undefined && (!Number.isFinite(max) || max < 0)) || (min !== undefined && max !== undefined && min > max)) { setPriceError("Informe uma faixa de preço válida."); return; }
    setPriceError(null); updateSearch({ minPrice: min, maxPrice: max, page: 1 });
  };
  const journal = [
    [
      heroImage,
      "12 de setembro",
      "Como funciona a propriedade de NFTs",
      "Aprenda a colecionar, negociar e verificar ativos digitais.",
    ],
    [
      editorialOne,
      "13 de setembro",
      "10 artistas digitais para acompanhar",
      "Conheça criadores que moldam a cultura digital.",
    ],
    [
      editorialTwo,
      "15 de setembro",
      "Raridade, atributos e procedência",
      "Entenda raridade, procedência, direitos autorais e utilidade.",
    ],
    [
      journalImage,
      "18 de setembro",
      "Como proteger sua carteira",
      "Conteúdo demonstrativo do marketplace para validar a composição editorial.",
    ],
  ];
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="hero-welcome">Bem-vindo à Kurio</p>
          <h1>
            SEJA DONO DO FUTURO
            <br />
            DA ARTE DIGITAL
          </h1>
          <p>
            Descubra NFTs selecionados de criadores emergentes e consagrados.
            Colecione arte digital rara, apoie artistas e tenha uma parte da
            cultura da internet.
          </p>
          <a className="cta-button" href="#catalog">
            EXPLORAR
          </a>
        </div>
        <div className="hero-art" aria-label="Artwork preview">
          <img
            className="hero-art-image"
            src={heroImage}
            alt="Arte digital em destaque"
            width={268}
            height={195}
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </section>
      <section className="marketplace-layout" id="catalog">
        <aside className="catalog-sidebar" aria-label="Filtros do catálogo">
          <section>
            <h2>Coleções</h2>
            <div className="sidebar-list">
              <button
                className={!search.collection ? "active" : ""}
                onClick={() => updateSearch({ collection: undefined, page: 1 })}
              >
                Todos os NFTs <span>{result.data?.total ?? 0}</span>
              </button>
              {collections.map(({ name, count }) => (
                <button
                  key={name}
                  className={search.collection === name ? "active" : ""}
                  onClick={() => updateSearch({ collection: name, page: 1 })}
                >
                  {name} <span>{count}</span>
                </button>
              ))}
            </div>
          </section>
          <form className="price-filter" onSubmit={applyPrice}>
            <h2>Faixa de preço</h2>
            <div className="price-range" aria-label="Faixa de preço em ETH">
              <input aria-label="Preço mínimo em ETH" type="range" min="0" max="3" step="0.01" value={priceDraft.min || "0"} onChange={(event) => setPriceDraft((draft) => ({ ...draft, min: event.target.value }))} />
              <input aria-label="Preço máximo em ETH" type="range" min="0" max="3" step="0.01" value={priceDraft.max || "3"} onChange={(event) => setPriceDraft((draft) => ({ ...draft, max: event.target.value }))} />
            </div>
            <p className="price-values">Preço: {priceDraft.min || "0,00"} – {priceDraft.max || "3,00"} ETH</p>
            {priceError && <p className="filter-error">{priceError}</p>}
            <div className="filter-actions"><button type="submit">Aplicar</button>{(search.minPrice !== undefined || search.maxPrice !== undefined) && <button type="button" onClick={() => { setPriceDraft({ min: "", max: "" }); setPriceError(null); updateSearch({ minPrice: undefined, maxPrice: undefined, page: 1 }); }}>Limpar</button>}</div>
          </form>
          <section className="network-filter">
            <h2>Rede</h2>
            <div className="sidebar-list">
              {([['ethereum', 'Ethereum'], ['polygon', 'Polygon'], ['solana', 'Solana']] as const).map(([network, label]) => <button type="button" key={network} className={search.network === network ? 'active' : ''} onClick={() => updateSearch({ network: search.network === network ? undefined : network, page: 1 })}>{label}</button>)}
            </div>
          </section>
          <section className="featured-rail">
            <p>NFT EM DESTAQUE</p>
            <Link to="/nft/$id" params={{ id: "nft-4" }}><img src={editorialOne} alt="Cosmic Bloom #118" width={250} height={250} loading="lazy" decoding="async" /><strong>Cosmic Bloom #118</strong><span>1.29 ETH</span></Link>
          </section>
        </aside>
        <div className="catalog-content">
          <h1 className="sr-only">Explore the collection</h1>
          <div className="catalog-topline">
            <div className="catalog-tabs">
              <button className="active" type="button">
                Todos os NFTs
              </button>
              <span>Novos lançamentos</span>
              <span>Em alta</span>
            </div>
            <label>
              Ordenar por:
              <select
                value={sort}
                onChange={(event) =>
                  updateSearch({
                    sort: event.target.value as NftListQuery["sort"],
                    page: 1,
                  })
                }
              >
                <option value="featured">Listados recentemente</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
              </select>
            </label>
          </div>
          <form
            className="catalog-toolbar"
            onSubmit={submitSearch}
            role="search"
          >
            <div className="search-field">
              <Search size={18} />
              <Input
                key={search.search ?? "empty-search"}
                name="search"
                aria-label="Buscar NFTs"
                defaultValue={search.search ?? ""}
                placeholder="Buscar por nome ou coleção"
              />
            </div>
            <button className="search-submit" aria-label="Buscar">
              <SlidersHorizontal size={17} />
            </button>
          </form>
          {result.isPending && (
            <div className="catalog-grid" aria-label="Carregando catálogo">
              {[1, 2, 3].map((item) => (
                <div className="skeleton-card" key={item} />
              ))}
            </div>
          )}
          {result.isError && (
            <div className="state-panel error-state">
              <h3>Não foi possível carregar.</h3>
              <p>Unable to load the collection right now.</p>
              <Button aria-label="Try again" variant="outline" onClick={() => void result.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}
          {!result.isPending &&
            !result.isError &&
            result.data?.items.length === 0 && (
              <div className="state-panel">
                <h3>Nenhum NFT encontrado.</h3>
                <p>Tente outra busca ou coleção.</p>
              </div>
            )}
          {!result.isPending &&
            !result.isError &&
            result.data &&
            result.data.items.length > 0 && (
              <div className="catalog-grid">
                {result.data.items.map((nft) => (
                  <NftCard key={nft.id} nft={nft} />
                ))}
              </div>
            )}
          {hasPagination && <div className="pagination" aria-label="Paginação">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => updateSearch({ page: page - 1 })}
            >
              Anterior
            </Button>
            <span>{page}</span>
            <Button
              variant="outline"
              disabled={!result.data?.hasNext}
              onClick={() => updateSearch({ page: page + 1 })}
            >
              Próxima
            </Button>
          </div>}
        </div>
      </section>
      <section className="promos" id="editorial">
        <article>
          <img src={heroImage} alt="Coleção com edições limitadas" width={268} height={195} loading="lazy" decoding="async" />
          <div>
            <h2>
              Lançamentos gênesis
              <br />
              de edição limitada
            </h2>
            <p>
              Colecione edições escassas diretamente dos criadores antes da
              revelação pública.
            </p>
            <a href="#catalog">
              Explorar <ChevronRight size={16} />
            </a>
          </div>
        </article>
        <article>
          <img src={editorialTwo} alt="Arte digital selecionada" width={250} height={250} loading="lazy" decoding="async" />
          <div>
            <h2>
              Arte digital selecionada
              <br />e muito mais
            </h2>
            <p>
              Explore novos artistas, coleções verificadas e obras que definem a
              cultura digital.
            </p>
            <a href="#catalog">
              Explorar <ChevronRight size={16} />
            </a>
          </div>
        </article>
      </section>
      <section className="journal">
        <h2>Diário da Cunhagem</h2>
        <p>
          Histórias, guias e insights para colecionadores sobre o universo da
          propriedade digital.
        </p>
        <div>
          {journal.map(([image, date, title, copy]) => (
            <article key={title}>
              <img src={image} alt="" width={250} height={250} loading="lazy" decoding="async" />
              <small>{date} &nbsp; | &nbsp; Leitura de 3 min</small>
              <h3>{title}</h3>
              <p>{copy}</p>
              <a href="#about">Ler mais →</a>
            </article>
          ))}
        </div>
      </section>
      <section className="benefits" id="about">
        <article>
          <b>W</b>
          <h3>Segurança da carteira</h3>
          <p>
            Proteja sua carteira e colecione arte digital verificada com
            confiança.
          </p>
        </article>
        <article>
          <b>C</b>
          <h3>Criadores em destaque</h3>
          <p>
            Conheça artistas, estúdios e comunidades que moldam a cultura
            digital na rede.
          </p>
        </article>
        <article>
          <b>D</b>
          <h3>Alertas de lançamentos</h3>
          <p>Receba calendários de cunhagem, novidades e listas de acesso.</p>
        </article>
        <form>
          <h3>Antecipe-se ao próximo lançamento</h3>
          <div>
            <input aria-label="Seu e-mail" placeholder="digite seu e-mail..." />
            <button type="submit">Enviar</button>
          </div>
          <p>
            Receba lançamentos selecionados, histórias de criadores e novidades
            do mercado.
          </p>
        </form>
      </section>
    </main>
  );
}
