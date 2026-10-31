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
        {data.transactionReference && (
          <p>Transaction: {data.transactionReference}</p>
        )}
        <p>Total: {data.totalEth} ETH</p>
      </div>
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
