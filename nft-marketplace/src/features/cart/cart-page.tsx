import { Minus, Plus, Trash2 } from "lucide-react";
import Decimal from "decimal.js";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSession, isAuthenticated } from "@/app/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorSchema } from "@/domain/contracts";
import { useCatalog } from "@/features/catalog/api";
import { useCart, useCartMutation, useQuote } from "./api";

function apiMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const parsed = apiErrorSchema.safeParse(
      (error as { response?: { data?: unknown } }).response?.data
    );
    if (parsed.success) return parsed.data.message;
  }
  return "Unable to update your cart right now.";
}

export function CartPage() {
  const session = useSession();
  const userId = session.data?.user?.id;
  const cart = useCart(userId);
  const mutation = useCartMutation(userId);
  const [couponDraft, setCouponDraft] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const quote = useQuote(userId, couponCode);
  const catalog = useCatalog({ page: 1, pageSize: 9, sort: "featured" });
  const items = cart.data?.items ?? [];
  const nftsById = new Map(catalog.data?.items.map((nft) => [nft.id, nft]));
  const recommendations = (catalog.data?.items ?? [])
    .filter((nft) => !items.some((item) => item.nftId === nft.id))
    .slice(0, 5);

  if (!isAuthenticated(session.data))
    return <main className="cart-page"><div className="state-panel">Sign in to view your cart.</div></main>;
  if (cart.isPending)
    return <main className="cart-page"><div className="cart-skeleton" aria-label="Carregando carrinho" /></main>;
  if (cart.isError)
    return (
      <main className="cart-page"><div className="state-panel error-state"><h1>Cart unavailable.</h1><p>{apiMessage(cart.error)}</p><Button onClick={() => void cart.refetch()}>Try again</Button></div></main>
    );

  const changeQuantity = (item: (typeof items)[number], quantity: number) => {
    if (quantity >= 0 && quantity <= item.availableQuantity)
      mutation.mutate({ nftId: item.nftId, editionId: item.editionId, quantity });
  };
  const couponError = quote.isError ? apiMessage(quote.error) : "";

  return (
    <main className="cart-page">
      <nav className="cart-breadcrumb" aria-label="Navegação estrutural">
        <Link to="/">Início</Link><span aria-hidden="true">/</span><Link to="/">Mercado</Link><span aria-hidden="true">/</span><span aria-current="page">Carrinho</span>
      </nav>
      <div className="section-heading">
        <div><p className="eyebrow accent">NFTs</p><h1 aria-label="Shopping cart">Meu carrinho</h1></div>
        <span className="catalog-count">{items.length} {items.length === 1 ? "peça" : "peças"}</span>
      </div>
      {items.length === 0 ? (
        <div className="state-panel"><h2>Your cart is empty.</h2><p>Explore the collection and add something uncommon.</p></div>
      ) : (
        <div className="cart-layout">
          <section className="cart-items" aria-label="Itens do carrinho">
            <div className="cart-table-heading" aria-hidden="true"><span>NFTs</span><span>Preço</span><span>Edições</span><span>Total</span></div>
            {items.map((item) => {
              const nft = nftsById.get(item.nftId);
              return (
                <article className="cart-item" key={`${item.nftId}-${item.editionId}`}>
                  <div className="cart-item-image">
                    {nft ? <img src={nft.imageUrl} alt="" /> : <span>{item.nftId.replace("nft-", "#")}</span>}
                  </div>
                  <div className="cart-item-info"><p className="eyebrow">{nft?.name ?? item.nftId}</p><h2>ID do token: #{item.nftId.replace("nft-", "")}</h2><p>{item.editionId} · {item.availableQuantity} disponíveis</p></div>
                  <strong className="cart-item-price">{item.unitPriceEth} ETH</strong>
                  <div className="quantity-control" aria-label={`Quantidade de ${item.nftId}`}>
                    <Button variant="outline" size="icon-sm" onClick={() => changeQuantity(item, item.quantity - 1)} disabled={mutation.isPending || item.quantity <= 1} aria-label="Diminuir quantidade"><Minus size={14} /></Button>
                    <span aria-live="polite">{item.quantity}</span>
                    <Button variant="outline" size="icon-sm" onClick={() => changeQuantity(item, item.quantity + 1)} disabled={mutation.isPending || item.quantity >= item.availableQuantity} aria-label="Aumentar quantidade"><Plus size={14} /></Button>
                  </div>
                  <strong className="cart-item-total">{new Decimal(item.unitPriceEth).times(item.quantity).toFixed(2)} ETH</strong>
                  <Button variant="ghost" size="icon-sm" onClick={() => changeQuantity(item, 0)} disabled={mutation.isPending} aria-label={`Remover ${item.nftId}`}><Trash2 size={16} /></Button>
                </article>
              );
            })}
          </section>
          <aside className="cart-summary">
            <h2>Resumo da carteira</h2>
            <div><span>Subtotal</span><strong>{quote.data?.subtotalEth ?? cart.data?.subtotalEth ?? "0.00"} ETH</strong></div>
            <div><span>Desconto do lançamento</span><strong>- {quote.data?.discountEth ?? "0.00"} ETH</strong></div>
            <div><span>Taxa de rede</span><strong>{quote.data?.networkFeeEth ?? "0.01"} ETH</strong></div>
            <div className="summary-total"><span>Total</span><strong>{quote.data?.totalEth ?? cart.data?.subtotalEth ?? "0.00"} ETH</strong></div>
            <form className="coupon-form" onSubmit={(event) => { event.preventDefault(); setCouponCode(couponDraft.trim() || null); }}>
              <label htmlFor="coupon">Código promocional</label>
              <div><Input id="coupon" value={couponDraft} onChange={(event) => setCouponDraft(event.target.value)} placeholder="Digite o código promocional..." /><Button className="coupon-apply" type="submit" disabled={quote.isFetching}>Aplicar</Button></div>
            </form>
            {couponCode && <Button variant="ghost" onClick={() => { setCouponCode(null); setCouponDraft(""); }}>Remover cupom</Button>}
            {couponError && <p className="form-error" role="alert">{couponError}</p>}
            {mutation.isError && <p className="form-error" role="alert">{apiMessage(mutation.error)}</p>}
            <p className="cart-feedback" role="status" aria-live="polite">{mutation.isPending ? "Updating cart…" : mutation.isSuccess ? "Cart updated." : quote.isFetching ? "Refreshing quote…" : ""}</p>
            <Link to="/checkout" search={{ coupon: couponCode ?? undefined }} className="button button-primary checkout-link" aria-label="Continue to checkout">Conectar e finalizar</Link>
            <Link to="/" className="cart-continue-link">Continuar explorando</Link>
          </aside>
        </div>
      )}
      {items.length > 0 && recommendations.length > 0 && (
        <section className="cart-recommendations" aria-labelledby="recommendations-heading">
          <div className="cart-recommendations-heading"><h2 id="recommendations-heading">Colecionadores também viram</h2></div>
          <div className="cart-recommendations-grid">
            {recommendations.map((nft) => {
              const edition = nft.editions[0];
              return <Link key={nft.id} to="/nft/$id" params={{ id: nft.id }} className="cart-recommendation-card"><img src={nft.imageUrl} alt={nft.name} /><span>{nft.name}</span><strong>{edition.priceEth} ETH</strong></Link>;
            })}
          </div>
        </section>
      )}
    </main>
  );
}
