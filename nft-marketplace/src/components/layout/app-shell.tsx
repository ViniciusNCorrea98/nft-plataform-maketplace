import { Heart, Menu, ShoppingBag, Sparkles } from "lucide-react";
import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logout, useSession } from "@/app/session";

export function AppShell() {
  const session = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      void router.navigate({ href: "/", replace: true });
    },
  });
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="NFT Marketplace início">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          <span>
            NFT<span className="brand-accent">MKT</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <Link to="/" activeOptions={{ exact: true }}>
            Explore
          </Link>
          <a href="#collections">Collections</a>
          <a href="#about">About</a>
        </nav>
        <div className="header-actions">
          <Link
            className="icon-button"
            to="/login"
            search={{}}
            aria-label="Favoritos"
          >
            <Heart size={19} />
          </Link>
          <Link className="icon-button" to="/cart" aria-label="Carrinho">
            <ShoppingBag size={19} />
          </Link>
          {session.data?.authenticated ? (
            <button
              className="connect-button"
              type="button"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <Link className="connect-button" to="/login" search={{}}>
              Connect wallet
            </Link>
          )}
          <button className="menu-button" type="button" aria-label="Abrir menu">
            <Menu size={22} />
          </button>
        </div>
      </header>
      <div className="page-content">
        <Outlet />
      </div>
      <footer className="site-footer" id="about">
        <div>
          <strong>
            NFT<span className="brand-accent">MKT</span>
          </strong>
          <p>Collect the uncommon.</p>
        </div>
        <span>Built for digital collectors</span>
      </footer>
    </div>
  );
}
