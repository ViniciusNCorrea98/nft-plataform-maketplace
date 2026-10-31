import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { isAuthenticated, useSession } from "@/app/session";
import {
  apiErrorSchema,
  type Wallet,
  type WalletCreate,
} from "@/domain/contracts";
import { useWalletMutation } from "./api";
import { useWallets } from "@/features/checkout/api";

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const parsed = apiErrorSchema.safeParse(
      (error as { response?: { data?: unknown } }).response?.data
    );
    if (parsed.success) return parsed.data.message;
  }
  return "Unable to update wallets.";
}

function WalletForm({
  userId,
  wallet,
  onDone,
}: {
  userId: string;
  wallet?: Wallet;
  onDone: () => void;
}) {
  const mutations = useWalletMutation(userId);
  const [label, setLabel] = useState(wallet?.label ?? "");
  const [address, setAddress] = useState(wallet?.address ?? "");
  const [network, setNetwork] = useState<WalletCreate["network"]>(
    wallet?.network ?? "ethereum"
  );
  const mutation = wallet ? mutations.update : mutations.create;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (wallet)
      mutations.update.mutate(
        { walletId: wallet.id, changes: { label, address, network } },
        { onSuccess: onDone }
      );
    else
      mutations.create.mutate(
        { label, address, network },
        { onSuccess: onDone }
      );
  };
  return (
    <form className="account-card account-form" onSubmit={submit}>
      <div className="account-card-heading">
        <h2>{wallet ? "Edit wallet" : "Add wallet"}</h2>
        {wallet && (
          <button className="text-link" type="button" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
      <label htmlFor="wallet-label">
        Label
        <input
          id="wallet-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
        />
      </label>
      <label htmlFor="wallet-address">
        Address
        <input
          id="wallet-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          required
        />
      </label>
      <label htmlFor="wallet-network">
        Network
        <select
          id="wallet-network"
          value={network}
          onChange={(event) =>
            setNetwork(event.target.value as WalletCreate["network"])
          }
        >
          <option value="ethereum">Ethereum</option>
          <option value="polygon">Polygon</option>
        </select>
      </label>
      {mutation.isError && (
        <p className="form-error" role="alert">
          {errorMessage(mutation.error)}
        </p>
      )}
      <button
        className="button button-primary"
        type="submit"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Saving…" : wallet ? "Save wallet" : "Add wallet"}
      </button>
    </form>
  );
}

export function WalletsPage() {
  const session = useSession();
  const [editing, setEditing] = useState<Wallet>();
  const [adding, setAdding] = useState(false);
  if (!isAuthenticated(session.data) || !session.data.user)
    return (
      <main className="account-page">
        <div className="state-panel">Sign in to manage wallets.</div>
      </main>
    );
  const userId = session.data.user.id;
  return (
    <WalletsContent
      userId={userId}
      editing={editing}
      adding={adding}
      setEditing={setEditing}
      setAdding={setAdding}
    />
  );
}

function WalletsContent({
  userId,
  editing,
  adding,
  setEditing,
  setAdding,
}: {
  userId: string;
  editing?: Wallet;
  adding: boolean;
  setEditing: (wallet: Wallet | undefined) => void;
  setAdding: (value: boolean) => void;
}) {
  const wallets = useWallets(userId);
  const mutations = useWalletMutation(userId);
  if (wallets.isPending)
    return (
      <main className="account-page">
        <div className="cart-skeleton" aria-label="Loading wallets" />
      </main>
    );
  if (wallets.isError)
    return (
      <main className="account-page">
        <div className="state-panel error-state">
          <h1>Wallets unavailable.</h1>
          <p>{errorMessage(wallets.error)}</p>
          <button
            className="button button-outline"
            type="button"
            onClick={() => void wallets.refetch()}
          >
            Try again
          </button>
        </div>
      </main>
    );
  const remove = (wallet: Wallet) => {
    if (window.confirm(`Remove ${wallet.label}?`))
      mutations.remove.mutate(wallet.id);
  };
  return (
    <main className="account-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow accent">COLLECTOR ACCOUNT</p>
          <h1>Wallets</h1>
        </div>
        <Link to="/account/profile" className="text-link">
          Back to profile
        </Link>
      </div>
      <div className="account-layout">
        <section
          className="account-card wallet-list"
          aria-labelledby="wallets-heading"
        >
          <div className="account-card-heading">
            <h2 id="wallets-heading">Your wallets</h2>
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                setAdding(true);
                setEditing(undefined);
              }}
            >
              Add wallet
            </button>
          </div>
          {!wallets.data?.length && (
            <p className="account-muted">No wallets registered yet.</p>
          )}
          {wallets.data?.map((wallet) => (
            <article className="wallet-row" key={wallet.id}>
              <div>
                <strong>{wallet.label}</strong>
                <span>{wallet.address}</span>
                <small>
                  {wallet.network}
                  {wallet.isPrimary ? " · Primary" : ""}
                </small>
              </div>
              <div className="wallet-actions">
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => {
                    setEditing(wallet);
                    setAdding(false);
                  }}
                >
                  Edit
                </button>
                {!wallet.isPrimary && (
                  <button
                    className="button button-outline"
                    type="button"
                    onClick={() => mutations.primary.mutate(wallet.id)}
                    disabled={mutations.primary.isPending}
                  >
                    Make primary
                  </button>
                )}
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => remove(wallet)}
                  disabled={mutations.remove.isPending}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
          {mutations.remove.isError && (
            <p className="form-error" role="alert">
              {errorMessage(mutations.remove.error)}
            </p>
          )}
          {mutations.primary.isSuccess && (
            <p className="form-success" role="status">
              Primary wallet updated.
            </p>
          )}
        </section>
        {(adding || editing) && (
          <WalletForm
            userId={userId}
            wallet={editing}
            onDone={() => {
              setAdding(false);
              setEditing(undefined);
            }}
          />
        )}
      </div>
    </main>
  );
}
