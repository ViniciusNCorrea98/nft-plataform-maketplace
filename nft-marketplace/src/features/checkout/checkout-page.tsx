import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  apiErrorSchema,
  collectorSnapshotSchema,
  type CollectorSnapshot,
} from "@/domain/contracts";
import { isAuthenticated, useSession } from "@/app/session";
import { useCart, useQuote } from "@/features/cart/api";
import { useCatalog } from "@/features/catalog/api";
import { useCreateOrder, useWallets } from "./api";
import { realtimeStaleKey } from "@/lib/realtime/sync";

type CollectorDraft = Omit<CollectorSnapshot, "walletAddress">;
type WalletConnection = "disconnected" | "connected" | "rejected";

function message(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const parsed = apiErrorSchema.safeParse(
      (error as { response?: { data?: unknown } }).response?.data
    );
    if (parsed.success) return parsed.data.message;
  }
  return "Unable to complete the simulated order. Your cart was preserved.";
}

function createKey() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `order-${Date.now()}`;
}

const paymentMethods = ["MetaMask", "WalletConnect", "Coinbase Wallet"];

export function CheckoutPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/checkout" });
  const userId = session.data?.user?.id;
  const cart = useCart(userId);
  const quote = useQuote(userId, search.coupon ?? null);
  const catalog = useCatalog({ page: 1, pageSize: 50, sort: "featured" });
  const quoteStale = useQuery({
    queryKey: userId
      ? realtimeStaleKey(userId)
      : ["realtime", "stale", "anonymous"],
    queryFn: async () => false,
    initialData: false,
    staleTime: Infinity,
    enabled: Boolean(userId),
  });
  const wallets = useWallets(userId);
  const mutation = useCreateOrder(userId);
  const [walletId, setWalletId] = useState<string>();
  const [walletConnection, setWalletConnection] =
    useState<WalletConnection>("disconnected");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [validation, setValidation] = useState<Record<string, string>>({});
  const [idempotencyKey] = useState(createKey);
  const [collector, setCollector] = useState<CollectorDraft>({
    displayName: session.data?.user?.name ?? "",
    username: "",
    profileName: "",
    email: session.data?.user?.email ?? "",
    ensName: "",
    note: null,
  });
  const items = cart.data?.items ?? [];
  const nftsById = new Map(catalog.data?.items.map((nft) => [nft.id, nft]));
  const availableWalletId = wallets.data?.some(
    (wallet) => wallet.id === walletId
  )
    ? walletId
    : wallets.data?.find((wallet) => wallet.isPrimary)?.id;
  const selectedWallet = wallets.data?.find(
    (wallet) => wallet.id === availableWalletId
  );

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

  const field = (name: keyof CollectorDraft, value: string) =>
    setCollector((current) => ({
      ...current,
      [name]: name === "note" ? value || null : value,
    }));
  const submit = () => {
    const payload = {
      ...collector,
      walletAddress: selectedWallet?.address ?? "",
    };
    const parsed = collectorSnapshotSchema.safeParse(payload);
    if (!parsed.success) {
      setValidation(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ])
        )
      );
      return;
    }
    setValidation({});
    if (
      !selectedWallet ||
      walletConnection !== "connected" ||
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
          collector: parsed.data,
        },
      },
      {
        onSuccess: (order) => {
          void navigate({ to: "/orders/$id", params: { id: order.id } });
        },
      }
    );
  };
  const error = (name: keyof CollectorSnapshot) =>
    validation[name] && (
      <small className="field-error" id={`${name}-error`}>
        {validation[name]}
      </small>
    );

  return (
    <main className="checkout-page payment-page">
      <nav className="checkout-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Início</Link>
        <span>/</span>
        <Link to="/cart">Mercado</Link>
        <span>/</span>
        <span aria-current="page">Pagamento</span>
      </nav>
      <div className="checkout-layout">
        <section
          className="checkout-card collector-card"
          aria-labelledby="collector-heading"
        >
          <div className="checkout-card-heading">
            <p className="eyebrow">Perfil do colecionador</p>
            <h1 id="collector-heading">Detalhes de pagamento</h1>
          </div>
          <div className="collector-fields">
            <label htmlFor="collector-display-name">
              Nome de exibição *
              <input
                id="collector-display-name"
                value={collector.displayName}
                onChange={(event) => field("displayName", event.target.value)}
                aria-invalid={Boolean(validation.displayName)}
                aria-describedby={
                  validation.displayName ? "displayName-error" : undefined
                }
              />
              {error("displayName")}
            </label>
            <label htmlFor="collector-username">
              Nome de usuário *
              <input
                id="collector-username"
                value={collector.username}
                onChange={(event) => field("username", event.target.value)}
                aria-invalid={Boolean(validation.username)}
                aria-describedby={
                  validation.username ? "username-error" : undefined
                }
              />
              {error("username")}
            </label>
            <label htmlFor="collector-network">
              Rede *
              <select
                id="collector-network"
                value={selectedWallet?.network ?? ""}
                disabled
              >
                <option value="">Selecione uma carteira</option>
                <option value="ethereum">Ethereum</option>
                <option value="polygon">Polygon</option>
              </select>
            </label>
            <label htmlFor="collector-profile-name">
              Nome do perfil *
              <input
                id="collector-profile-name"
                value={collector.profileName}
                onChange={(event) => field("profileName", event.target.value)}
                aria-invalid={Boolean(validation.profileName)}
                aria-describedby={
                  validation.profileName ? "profileName-error" : undefined
                }
              />
              {error("profileName")}
            </label>
            <label htmlFor="collector-wallet-address">
              Endereço da carteira *
              <input
                id="collector-wallet-address"
                value={selectedWallet?.address ?? ""}
                readOnly
                aria-invalid={Boolean(validation.walletAddress)}
                aria-describedby={
                  validation.walletAddress ? "walletAddress-error" : undefined
                }
              />
              {error("walletAddress")}
            </label>
            <label htmlFor="collector-ens">
              Nome ENS *
              <span className="ens-input">
                <input
                  id="collector-ens"
                  value={collector.ensName}
                  onChange={(event) => field("ensName", event.target.value)}
                  aria-invalid={Boolean(validation.ensName)}
                  aria-describedby={
                    validation.ensName ? "ensName-error" : undefined
                  }
                />
                <b>.eth</b>
              </span>
              {error("ensName")}
            </label>
            <label htmlFor="collector-wallet">
              Tipo de carteira *
              <select
                id="collector-wallet"
                value={availableWalletId ?? ""}
                onChange={(event) => {
                  setWalletId(event.target.value || undefined);
                  setWalletConnection("disconnected");
                }}
              >
                <option value="">Selecione uma carteira</option>
                {wallets.data?.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.label} · {wallet.network}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="collector-email">
              E-mail *
              <input
                id="collector-email"
                type="email"
                value={collector.email}
                onChange={(event) => field("email", event.target.value)}
                aria-invalid={Boolean(validation.email)}
                aria-describedby={validation.email ? "email-error" : undefined}
              />
              {error("email")}
            </label>
          </div>
          <label className="collector-note" htmlFor="collector-note">
            Observação do colecionador <span>(opcional)</span>
            <textarea
              id="collector-note"
              value={collector.note ?? ""}
              onChange={(event) => field("note", event.target.value)}
            />
          </label>
        </section>

        <aside
          className="checkout-summary payment-summary"
          aria-label="Resumo do pedido"
        >
          <div className="summary-heading">
            <div>
              <p className="eyebrow">Seus NFTs</p>
              <h2>NFTs</h2>
            </div>
            <span>Subtotal</span>
          </div>
          <div className="summary-items">
            {items.map((item) => {
              const nft = nftsById.get(item.nftId);
              return (
                <div
                  className="summary-item"
                  key={`${item.nftId}-${item.editionId}`}
                >
                  <div className="summary-item-image">
                    {nft?.imageUrl ? (
                      <img src={nft.imageUrl} alt="" width={96} height={96} decoding="async" />
                    ) : (
                      <span>{item.nftId.replace("nft-", "#")}</span>
                    )}
                  </div>
                  <div>
                    <strong>{nft?.name ?? item.nftId}</strong>
                    <small>
                      ID do token: #{item.nftId.replace("nft-", "")}
                    </small>
                  </div>
                  <b>({item.quantity})</b>
                  <em>
                    {(Number(item.unitPriceEth) * item.quantity).toFixed(2)} ETH
                  </em>
                </div>
              );
            })}
          </div>
          <p className="coupon-hint">Tem um código promocional? Aplique aqui</p>
          <div className="summary-line">
            <span>Subtotal</span>
            <strong>{quote.data?.subtotalEth} ETH</strong>
          </div>
          <div className="summary-line">
            <span>Desconto do lançamento</span>
            <strong>- {quote.data?.discountEth} ETH</strong>
          </div>
          <div className="summary-line">
            <span>
              Taxa de rede <small>Taxa estimada</small>
            </span>
            <strong>{quote.data?.networkFeeEth} ETH</strong>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{quote.data?.totalEth} ETH</strong>
          </div>
          <fieldset className="payment-methods">
            <legend>Carteira e rede</legend>
            {paymentMethods.map((method) => (
              <label
                key={method}
                className={paymentMethod === method ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="payment-method"
                  checked={paymentMethod === method}
                  onChange={() => setPaymentMethod(method)}
                />
                <span>{method}</span>
                {method === "MetaMask" && <small>SIMULAÇÃO DE CARTEIRA</small>}
              </label>
            ))}
          </fieldset>
          <div className="wallet-connection-actions">
            {walletConnection === "connected" ? (
              <Button
                variant="outline"
                className="connect-wallet"
                onClick={() => setWalletConnection("disconnected")}
              >
                Disconnect wallet
              </Button>
            ) : (
              <Button
                variant="outline"
                className="connect-wallet"
                onClick={() => setWalletConnection("connected")}
                disabled={!selectedWallet}
              >
                Connect wallet
              </Button>
            )}
            {walletConnection !== "connected" && (
              <Button
                variant="ghost"
                onClick={() => setWalletConnection("rejected")}
                disabled={!selectedWallet}
              >
                Decline connection
              </Button>
            )}
          </div>
          {quoteStale.data && (
            <>
              <p className="form-error" role="alert">
                The quote changed while you were reviewing. Refresh it before
                confirming.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  void quote.refetch().then(() => {
                    if (userId)
                      queryClient.setQueryData(realtimeStaleKey(userId), false);
                  });
                }}
              >
                Refresh quote
              </Button>
            </>
          )}
          {mutation.isError && (
            <p className="form-error" role="alert">
              {message(mutation.error)}
            </p>
          )}
          <Button
            className="confirm-purchase"
            onClick={submit}
            disabled={
              !selectedWallet ||
              walletConnection !== "connected" ||
              Boolean(quoteStale.data) ||
              mutation.isPending
            }
          >
            {mutation.isPending ? "Processing…" : "Confirm purchase"}
          </Button>
          <p className="cart-feedback" role="status" aria-live="polite">
            {walletConnection === "connected"
              ? `Connected to ${selectedWallet?.network}.`
              : walletConnection === "rejected"
              ? "Wallet connection was declined. No simulated order was created."
              : "Wallet connection is required."}{" "}
            This checkout uses a simulated payment.
          </p>
        </aside>
      </div>
    </main>
  );
}
