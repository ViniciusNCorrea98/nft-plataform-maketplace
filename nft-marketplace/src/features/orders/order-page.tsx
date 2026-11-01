import { Link, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { apiErrorSchema } from "@/domain/contracts";
import { isAuthenticated, useSession } from "@/app/session";
import { useOrder } from "@/features/checkout/api";

function message(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const parsed = apiErrorSchema.safeParse(
      (error as { response?: { data?: unknown } }).response?.data
    );
    if (parsed.success) return parsed.data.message;
  }
  return "Unable to load this order.";
}

export function OrderPage() {
  const session = useSession();
  const { id } = useParams({ from: "/orders/$id" });
  const order = useOrder(session.data?.user?.id, id);
  if (!isAuthenticated(session.data))
    return (
      <main className="order-page">
        <div className="state-panel">Sign in to view this order.</div>
      </main>
    );
  if (order.isPending)
    return (
      <main className="order-page">
        <div className="cart-skeleton" aria-label="Loading order" />
      </main>
    );
  if (order.isError)
    return (
      <main className="order-page">
        <div className="state-panel error-state">
          <h1>Order unavailable.</h1>
          <p>{message(order.error)}</p>
          <Button onClick={() => void order.refetch()}>Try again</Button>
        </div>
      </main>
    );
  const data = order.data;
  return (
    <main className="order-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow accent">ORDER RECEIPT</p>
          <h1>
            {data.status === "confirmed"
              ? "Purchase confirmed"
              : data.status === "pending"
              ? "Payment processing"
              : "Payment declined"}
          </h1>
        </div>
        <Link to="/" className="text-link">
          Continue browsing
        </Link>
      </div>
      <div className="state-panel order-status" role="status">
        <p>Order {data.id}</p>
        <strong>{data.status}</strong>
        <p>This is a simulated payment; no blockchain transaction was submitted.</p>
        {data.transactionReference && (
          <p>Simulated reference: {data.transactionReference}</p>
        )}
        <dl className="order-receipt-details">
          <div><dt>Subtotal</dt><dd>{data.subtotalEth} ETH</dd></div>
          <div><dt>Discount</dt><dd>- {data.discountEth} ETH</dd></div>
          <div><dt>Network fee</dt><dd>{data.networkFeeEth} ETH</dd></div>
          <div><dt>Total</dt><dd>{data.totalEth} ETH</dd></div>
          <div><dt>Network</dt><dd>{data.network}</dd></div>
          <div><dt>Wallet</dt><dd>{data.collector.walletAddress}</dd></div>
        </dl>
      </div>
      <section className="order-status order-collector" aria-labelledby="collector-snapshot-heading">
        <h2 id="collector-snapshot-heading">Collector snapshot</h2>
        <p>{data.collector.displayName} · @{data.collector.username}</p>
        <p>{data.collector.profileName} · {data.collector.email}</p>
        <p>{data.collector.ensName}.eth</p>
        {data.collector.note && <p>{data.collector.note}</p>}
      </section>
      <section className="order-items" aria-label="Purchased items">
        {data.items.map((item) => (
          <article
            className="cart-item"
            key={`${item.nftId}-${item.editionId}`}
          >
            <div>
              <p className="eyebrow">{item.editionId}</p>
              <h2>{item.name}</h2>
            </div>
            <strong>
              {item.quantity} × {item.unitPriceEth} ETH
            </strong>
          </article>
        ))}
      </section>
    </main>
  );
}
