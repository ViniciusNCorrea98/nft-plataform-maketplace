import { LogIn, Menu, Search, ShoppingCart, X } from "lucide-react";
import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { logout, useSession } from "@/app/session";
import { useRealtimeSync } from "@/lib/realtime/use-realtime-sync";

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const session = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  useRealtimeSync();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      void router.navigate({ href: "/", replace: true });
    },
  });
  const closeMenu = () => setMenuOpen(false);
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link
          className="brand"
          to="/"
          aria-label="Kurio início"
          onClick={closeMenu}
        >
          KURIO
        </Link>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <Link to="/" activeOptions={{ exact: true }}>
            Início
          </Link>
          <a href="#catalog">Mercado</a>
          <a href="#editorial">Criadores</a>
          <a href="#about">Aprenda</a>
        </nav>
        <div className="header-actions">
          <a
            className="icon-button desktop-only"
            href="#catalog"
            aria-label="Buscar no catálogo"
          >
            <Search size={21} />
          </a>
          <Link
            className="icon-button cart-icon"
            to="/cart"
            aria-label="Carrinho"
          >
            <ShoppingCart size={21} />
          </Link>
          {session.data?.authenticated ? (
            <>
              <Link className="account-link" to="/account/profile">
                Minha conta
              </Link>
              <button
                className="connect-button"
                aria-label="Sign out"
                type="button"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? "Saindo…" : "Sair"}
              </button>
            </>
          ) : (
            <Link
              className="connect-button"
              aria-label="Connect wallet"
              to="/login"
              search={{}}
            >
              <LogIn size={17} /> Entrar
            </Link>
          )}
          <button
            className="menu-button"
            type="button"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      {menuOpen && (
        <nav className="mobile-nav" aria-label="Navegação móvel">
          <Link to="/" onClick={closeMenu}>
            Início
          </Link>
          <a href="#catalog" onClick={closeMenu}>
            Mercado
          </a>
          <a href="#editorial" onClick={closeMenu}>
            Criadores
          </a>
          <a href="#about" onClick={closeMenu}>
            Aprenda
          </a>
          <Link to="/cart" onClick={closeMenu}>
            Carrinho
          </Link>
        </nav>
      )}
      <div className="page-content">
        <Outlet />
      </div>
      <footer className="site-footer" aria-label="Rodapé">
        <div className="footer-identity">
          <strong>KURIO</strong>
          <p>
            Feito para colecionadores,
            <br />
            criadores e cultura
          </p>
          <a href="mailto:contato@email.com">contato@email.com</a>
          <span>+55 11 4002 8922</span>
        </div>
        <div className="footer-links">
          <section>
            <h2>Meu perfil</h2>
            <Link to="/account/profile">Meu perfil</Link>
            <span>Minha coleção</span>
            <span>Atividade</span>
            <span>Estúdio do criador</span>
            <span>Lista de interesse</span>
          </section>
          <section>
            <h2>Central de ajuda</h2>
            <span>Central de ajuda</span>
            <span>Como comprar NFTs</span>
            <span>Carteira e segurança</span>
            <span>Política do mercado</span>
            <span>Denunciar item</span>
          </section>
          <section>
            <h2>Coleções</h2>
            <span>Arte digital</span>
            <span>Fotografia</span>
            <span>Música</span>
            <span>Arte 3D</span>
            <span>Utilidade</span>
          </section>
          <section className="footer-social">
            <h2>Redes sociais</h2>
            <div aria-label="Redes sociais">
              <span>f</span>
              <span>◎</span>
              <span>♥</span>
              <span>in</span>
              <span>▶</span>
            </div>
            <h2>Carteiras compatíveis</h2>
            <p>METAMASK · WALLETCONNECT · COINBASE</p>
          </section>
        </div>
        <small style={{backgroundColor: '#000'}}>© 2026 Kurio. Propriedade digital para todos.</small>
      </footer>
    </div>
  );
}
