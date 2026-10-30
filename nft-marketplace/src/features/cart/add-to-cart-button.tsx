import { Link, useNavigate } from "@tanstack/react-router";
import { useSession, isAuthenticated } from "@/app/session";
import { Button } from "@/components/ui/button";
import { apiErrorSchema } from "@/domain/contracts";
import { useCartMutation } from "./api";

function apiMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const parsed = apiErrorSchema.safeParse((error as { response?: { data?: unknown } }).response?.data);
    if (parsed.success) return parsed.data.message;
  }
  return "Unable to add this NFT to your cart.";
}

export function AddToCartButton({
  nftId,
  editionId,
  availableQuantity,
}: {
  nftId: string;
  editionId: string;
  availableQuantity: number;
}) {
  const session = useSession();
  const userId = session.data?.user?.id;
  const navigate = useNavigate();
  const mutation = useCartMutation(userId);
  if (session.isPending) return <Button className="detail-buy" type="button" disabled>Loading…</Button>;
  if (!isAuthenticated(session.data))
    return (
      <Link
        className="detail-buy"
        to="/login"
        search={{ redirect: `/nft/${nftId}` }}
      >
        Sign in to buy
      </Link>
    );
  const add = () =>
    mutation.mutate(
      { nftId, editionId, quantity: 1 },
      { onSuccess: () => void navigate({ to: "/cart" }) }
    );
  return (
    <span className="cart-action">
      <Button
        className="detail-buy"
        type="button"
        onClick={add}
        disabled={availableQuantity < 1 || mutation.isPending}
      >
        {availableQuantity < 1
          ? "Sold out"
          : mutation.isPending
          ? "Adding…"
          : "Buy now"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {mutation.isError
          ? "Unable to add item to cart."
          : mutation.isSuccess
          ? "Added to cart."
          : ""}
      </span>
      {mutation.isError && <span className="cart-action-feedback" role="alert">{apiMessage(mutation.error)}</span>}
    </span>
  );
}
