import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { apiErrorSchema } from "@/domain/contracts";
import { isAuthenticated, useSession } from "@/app/session";
import { useCart, useQuote } from "@/features/cart/api";
import { useCreateOrder, useWallets } from "./api";
import { realtimeStaleKey } from "@/lib/realtime/sync";

function message(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const parsed = apiErrorSchema.safeParse(
      (error as { response?: { data?: unknown } }).response?.data
    );
    if (parsed.success) return parsed.data.message;
  }
  return "Unable to complete the order. Your cart was preserved.";
}

function createKey() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `order-${Date.now()}`;
}

export function CheckoutPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/checkout" });
  const userId = session.data?.user?.id;
  const cart = useCart(userId);
  const quote = useQuote(userId, search.coupon ?? null);
  const quoteStale = useQuery({
    queryKey: userId ? realtimeStaleKey(userId) : ["realtime", "stale", "anonymous"],
    queryFn: async () => false,
    initialData: false,
    staleTime: Infinity,
    enabled: Boolean(userId),
  });
  const wallets = useWallets(userId);
  const mutation = useCreateOrder(userId);
  const [walletId, setWalletId] = useState<string>();
  const [connectedWalletId, setConnectedWalletId] = useState<string>();
  const [idempotencyKey] = useState(createKey);
  const items = cart.data?.items ?? [];
  const availableWalletId = wallets.data?.some((wallet) => wallet.id === walletId)
    ? walletId
    : wallets.data?.find((wallet) => wallet.isPrimary)?.id;
  const selectedWallet = wallets.data?.find((wallet) => wallet.id === availableWalletId);

  if (!isAuthenticated(session.data))
    return (
      <main className="checkout-page">
        <div className="state-panel">Sign in to continue to checkout.</div>
      </main>
    );
  if (cart.isPending || wallets.isPending || quote.isPending)
    return (
      <main className="checkout-page">
        <div className="cart-skeleton" aria-label="Loading checkout" />
      </main>
    );
  if (cart.isError || wallets.isError || quote.isError)
    return (
      <main className="checkout-page">
        <div className="state-panel error-state">
          <h1>Checkout unavailable.</h1>
          <p>{message(cart.error ?? wallets.error ?? quote.error)}</p>
          <Button
            onClick={() => {
              void cart.refetch();
              void wallets.refetch();
              void quote.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      </main>
    );
  if (!items.length)
    return (
      <main className="checkout-page">
        <div className="state-panel">
          <h1>Your cart is empty.</h1>
          <Link to="/" className="button button-primary">
            Explore collection
          </Link>
        </div>
      </main>
    );

  const connect = () => {
    if (!selectedWallet) return;
    setConnectedWalletId(selectedWallet.id);
  };
  const submit = () => {
    if (
      !selectedWallet ||
      connectedWalletId !== selectedWallet.id ||
      !quote.data ||
      quoteStale.data
    )
      return;
    mutation.mutate(
      {
        idempotencyKey,
        payload: {
          walletId: selectedWallet.id,
          network: selectedWallet.network,
          couponCode: quote.data.couponCode,
          quoteTotalEth: quote.data.totalEth,
        },
      },
      {
        onSuccess: (order) => {
          void navigate({ to: "/orders/$id", params: { id: order.id } });
        },
      }
    );
  };

  return (
    <main className="checkout-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow accent">FINAL REVIEW</p>
          <h1>Checkout</h1>
        </div>
        <Link to="/cart" className="text-link">
          Back to cart
        </Link>
      </div>
      <div className="checkout-layout">
        <section className="checkout-card" aria-labelledby="wallet-heading">
          <h2 id="wallet-heading">Payment wallet</h2>
          <p>Choose a wallet and connect it to the simulated network.</p>
          <label htmlFor="wallet">Wallet</label>
          <select
            id="wallet"
            value={availableWalletId ?? ""}
            onChange={(event) => {
              setWalletId(event.target.value || undefined);
              setConnectedWalletId(undefined);
            }}
          >
            <option value="">Select a wallet</option>
            {wallets.data?.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.label} · {wallet.network}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={connect}
            disabled={
              !selectedWallet || connectedWalletId === selectedWallet.id
            }
          >
            {connectedWalletId === selectedWallet?.id
              ? "Wallet connected"
              : "Connect wallet"}
          </Button>
          <p className="cart-feedback" role="status" aria-live="polite">
            {connectedWalletId
              ? `Connected to ${selectedWallet?.network}.`
              : "Wallet connection is required."}
          </p>
        </section>
        <aside className="cart-summary checkout-summary">
          <h2>Order summary</h2>
          {items.map((item) => (
            <div key={`${item.nftId}-${item.editionId}`}>
              <span>
                {item.nftId} × {item.quantity}
              </span>
              <strong>
                {(Number(item.unitPriceEth) * item.quantity).toFixed(2)} ETH
              </strong>
            </div>
          ))}
          <div>
            <span>Subtotal</span>
            <strong>{quote.data?.subtotalEth} ETH</strong>
          </div>
          <div>
            <span>Discount</span>
            <strong>- {quote.data?.discountEth} ETH</strong>
          </div>
          <div>
            <span>Network fee</span>
            <strong>{quote.data?.networkFeeEth} ETH</strong>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{quote.data?.totalEth} ETH</strong>
          </div>
          {quoteStale.data && (
            <div className="form-error" role="alert">
              The quote changed while you were reviewing. Refresh it before confirming.
            </div>
          )}
          {quoteStale.data && (
            <Button
              variant="outline"
              onClick={() => {
                void quote.refetch().then(() => {
                  if (userId) queryClient.setQueryData(realtimeStaleKey(userId), false);
                });
              }}
            >
              Refresh quote
            </Button>
          )}
          {mutation.isError && (
            <p className="form-error" role="alert">
              {message(mutation.error)}
            </p>
          )}
          <Button
            onClick={submit}
            disabled={
              !selectedWallet ||
              connectedWalletId !== selectedWallet.id ||
              Boolean(quoteStale.data) ||
              mutation.isPending
            }
          >
            {mutation.isPending ? "Processing…" : "Confirm purchase"}
          </Button>
          <p className="cart-feedback" role="status" aria-live="polite">
            {mutation.isPending
              ? "Processing payment…"
              : mutation.isSuccess
              ? "Order created."
              : ""}
          </p>
        </aside>
      </div>
    </main>
  );
}
