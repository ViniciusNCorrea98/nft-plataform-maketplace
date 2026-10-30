import { Minus, Plus, Trash2 } from "lucide-react";
import Decimal from "decimal.js";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSession, isAuthenticated } from "@/app/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorSchema } from "@/domain/contracts";
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
  const items = cart.data?.items ?? [];

  if (!isAuthenticated(session.data))
    return (
      <main className="cart-page">
        <div className="state-panel">Sign in to view your cart.</div>
      </main>
    );
  if (cart.isPending)
    return (
      <main className="cart-page">
        <div className="cart-skeleton" aria-label="Carregando carrinho" />
      </main>
    );
  if (cart.isError)
    return (
      <main className="cart-page">
        <div className="state-panel error-state">
          <h1>Cart unavailable.</h1>
          <p>{apiMessage(cart.error)}</p>
          <Button onClick={() => void cart.refetch()}>Try again</Button>
        </div>
      </main>
    );

  const changeQuantity = (item: (typeof items)[number], quantity: number) => {
    if (quantity >= 0 && quantity <= item.availableQuantity)
      mutation.mutate({
        nftId: item.nftId,
        editionId: item.editionId,
        quantity,
      });
  };
  const couponError = quote.isError ? apiMessage(quote.error) : "";
  return (
    <main className="cart-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow accent">YOUR COLLECTION</p>
          <h1>Shopping cart</h1>
        </div>
        <span className="catalog-count">
          {items.length} {items.length === 1 ? "piece" : "pieces"}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="state-panel">
          <h2>Your cart is empty.</h2>
          <p>Explore the collection and add something uncommon.</p>
        </div>
      ) : (
        <div className="cart-layout">
          <section className="cart-items" aria-label="Itens do carrinho">
            {items.map((item) => (
              <article
                className="cart-item"
                key={`${item.nftId}-${item.editionId}`}
              >
                <div className="cart-item-image">
                  <span>{item.nftId.replace("nft-", "#")}</span>
                </div>
                <div className="cart-item-info">
                  <p className="eyebrow">{item.editionId}</p>
                  <h2>{item.nftId}</h2>
                  <p>
                    {item.unitPriceEth} ETH each · {item.availableQuantity}{" "}
                    available
                  </p>
                </div>
                <div
                  className="quantity-control"
                  aria-label={`Quantidade de ${item.nftId}`}
                >
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => changeQuantity(item, item.quantity - 1)}
                    disabled={mutation.isPending || item.quantity <= 1}
                    aria-label="Diminuir quantidade"
                  >
                    <Minus size={14} />
                  </Button>
                  <span aria-live="polite">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => changeQuantity(item, item.quantity + 1)}
                    disabled={
                      mutation.isPending ||
                      item.quantity >= item.availableQuantity
                    }
                    aria-label="Aumentar quantidade"
                  >
                    <Plus size={14} />
                  </Button>
                </div>
                <strong className="cart-item-total">
                  {new Decimal(item.unitPriceEth)
                    .times(item.quantity)
                    .toFixed(2)}{" "}
                  ETH
                </strong>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => changeQuantity(item, 0)}
                  disabled={mutation.isPending}
                  aria-label={`Remover ${item.nftId}`}
                >
                  <Trash2 size={16} />
                </Button>
              </article>
            ))}
          </section>
          <aside className="cart-summary">
            <h2>Summary</h2>
            <div>
              <span>Subtotal</span>
              <strong>
                {quote.data?.subtotalEth ?? cart.data?.subtotalEth ?? "0.00"}{" "}
                ETH
              </strong>
            </div>
            <div>
              <span>Discount</span>
              <strong>- {quote.data?.discountEth ?? "0.00"} ETH</strong>
            </div>
            <div>
              <span>Network fee</span>
              <strong>{quote.data?.networkFeeEth ?? "0.01"} ETH</strong>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <strong>
                {quote.data?.totalEth ?? cart.data?.subtotalEth ?? "0.00"} ETH
              </strong>
            </div>
            <form
              className="coupon-form"
              onSubmit={(event) => {
                event.preventDefault();
                setCouponCode(couponDraft.trim() || null);
              }}
            >
              <label htmlFor="coupon">Coupon code</label>
              <div>
                <Input
                  id="coupon"
                  value={couponDraft}
                  onChange={(event) => setCouponDraft(event.target.value)}
                  placeholder="WELCOME10"
                />
                <Button type="submit" disabled={quote.isFetching}>
                  Apply
                </Button>
              </div>
            </form>
            {couponCode && (
              <Button
                variant="ghost"
                onClick={() => {
                  setCouponCode(null);
                  setCouponDraft("");
                }}
              >
                Remove coupon
              </Button>
            )}
            {couponError && (
              <p className="form-error" role="alert">
                {couponError}
              </p>
            )}
            {mutation.isError && (
              <p className="form-error" role="alert">
                {apiMessage(mutation.error)}
              </p>
            )}
            <p className="cart-feedback" role="status" aria-live="polite">
              {mutation.isPending
                ? "Updating cart…"
                : mutation.isSuccess
                ? "Cart updated."
                : quote.isFetching
                ? "Refreshing quote…"
                : ""}
            </p>
            <Link to="/checkout" search={{ coupon: couponCode ?? undefined }} className="button button-primary checkout-link">
              Continue to checkout
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
