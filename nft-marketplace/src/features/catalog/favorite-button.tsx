import { Heart } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSession, isAuthenticated } from "@/app/session";
import { Button } from "@/components/ui/button";
import { useFavoriteMutation, useFavorites } from "./api";

export function FavoriteButton({
  nftId,
  compact = false,
}: {
  nftId: string;
  compact?: boolean;
}) {
  const session = useSession();
  const userId = session.data?.user?.id;
  const authenticated = isAuthenticated(session.data);
  const favorites = useFavorites(userId, authenticated);
  const mutation = useFavoriteMutation(userId);
  const selected = favorites.data?.nftIds.includes(nftId) ?? false;
  const busy = favorites.isPending || mutation.isPending;

  if (session.isPending) {
    return <Button className={compact ? "favorite-control compact" : "favorite-control"} variant="outline" type="button" disabled aria-label="Carregando sessão"><Heart size={17} /></Button>;
  }

  if (!authenticated) {
    return (
      <Link
        className={compact ? "favorite-control compact" : "favorite-control"}
        to="/login"
        search={{ redirect: `/nft/${nftId}` }}
        aria-label="Entrar para favoritar"
      >
        <Heart size={compact ? 17 : 17} />
        {!compact && "Favorite"}
      </Link>
    );
  }

  const toggle = () => mutation.mutate({ nftId, favorite: !selected });
  const label = mutation.isError
    ? "Não foi possível atualizar favorito. Tente novamente."
    : selected
    ? "Remover dos favoritos"
    : "Adicionar aos favoritos";
  const status = mutation.isPending
    ? "Salvando favorito…"
    : mutation.isSuccess
    ? "Favorito atualizado."
    : mutation.isError
    ? "Falha ao atualizar favorito."
    : "";

  return (
    <span className="favorite-control-wrap">
      <Button
        className={compact ? "favorite-control compact" : "favorite-control"}
        variant="outline"
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={label}
        aria-pressed={selected}
      >
        <Heart size={17} fill={selected ? "currentColor" : "none"} />
        {!compact && (busy ? "Saving…" : selected ? "Favorited" : "Favorite")}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>
      {mutation.isError && <span className="favorite-feedback" role="alert">Unable to update favorite.</span>}
    </span>
  );
}
