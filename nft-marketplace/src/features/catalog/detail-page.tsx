import { ArrowLeft, Share2 } from "lucide-react";
import { useNavigate, useParams, Link } from "@tanstack/react-router";
import axios from "axios";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCatalog, useNft } from "./api";
import { FavoriteButton } from "./favorite-button";
import { AddToCartButton } from "@/features/cart/add-to-cart-button";

export function DetailPage() {
  const { id } = useParams({ from: "/nft/$id" });
  const navigate = useNavigate();
  const result = useNft(id);
  const related = useCatalog({ page: 1, pageSize: 6, sort: "featured" });
  const [shareStatus, setShareStatus] = useState("");
  if (result.isPending)
    return (
      <main className="detail-page">
        <div className="detail-skeleton" />
      </main>
    );
  if (result.isError || !result.data) {
    const notFound = axios.isAxiosError(result.error) && result.error.response?.status === 404;
    return (
      <main className="detail-page">
        <div className="state-panel error-state">
          <h1>{notFound ? "Piece not found." : "We lost the signal."}</h1>
          <p>{notFound ? "This collectible is no longer available." : "Unable to load this collectible right now."}</p>
          {!notFound && <Button variant="outline" onClick={() => void result.refetch()}>Try again</Button>}
          <Button onClick={() => void navigate({ to: "/" })}>
            Back to explore
          </Button>
        </div>
      </main>
    );
  }
  const nft = result.data;
  const edition = nft.editions[0];
  const relatedItems =
    related.data?.items.filter((item) => item.id !== nft.id) ?? [];
  return (
    <main className="detail-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} /> Back to collection
      </Link>
      <div className="detail-layout">
        <section className="detail-gallery">
          <div className="detail-image">
            <img
              src={nft.imageUrl}
              alt={nft.name}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <span className="image-index">01 / 01</span>
          </div>
          <div className="thumbnail-row">
            <div className="thumbnail active" aria-label="Imagem principal">
              <img src={nft.imageUrl} alt="" />
            </div>
            <button
              className="thumbnail"
              type="button"
              aria-label="Compartilhar NFT"
              onClick={() => {
                if (!navigator.clipboard) {
                  setShareStatus("Unable to copy link.");
                  return;
                }
                void navigator.clipboard.writeText(window.location.href).then(
                  () => setShareStatus("Link copied."),
                  () => setShareStatus("Unable to copy link."),
                );
              }}
            >
              <Share2 size={18} />
            </button>
          </div>
          <span className="sr-only" role="status" aria-live="polite">{shareStatus}</span>
        </section>
        <section className="detail-info">
          <p className="eyebrow accent">{nft.collection}</p>
          <h1>{nft.name}</h1>
          <p className="detail-description">{nft.description}</p>
          <div className="creator-line">
            <span className="avatar">{nft.creator.slice(0, 1)}</span>
            <span>
              Created by <strong>{nft.creator}</strong>
            </span>
          </div>
          <div className="price-panel">
            <span>Current price</span>
            <strong>{edition.priceEth} ETH</strong>
            <small>
              {edition.label} · {edition.availableQuantity} available
            </small>
          </div>
          <div className="detail-actions">
            <AddToCartButton
              nftId={nft.id}
              editionId={edition.id}
              availableQuantity={edition.availableQuantity}
            />
            <FavoriteButton nftId={nft.id} />
          </div>
          <div className="detail-tabs">
            <strong>About this piece</strong>
            <p>
              {nft.description} Edition {edition.label.toLowerCase()} by{" "}
              {nft.creator}.
            </p>
          </div>
        </section>
      </div>
      {relatedItems.length > 0 && (
        <section className="related-section" id="collections">
          <div className="section-heading">
            <div>
              <p className="eyebrow accent">MORE FROM THE COLLECTION</p>
              <h2>You may also like</h2>
            </div>
          </div>
          <div className="related-grid">
            {relatedItems.map((item) => (
              <Link
                className="related-card"
                key={item.id}
                to="/nft/$id"
                params={{ id: item.id }}
              >
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
                <div>
                  <span>{item.collection}</span>
                  <strong>{item.name}</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
