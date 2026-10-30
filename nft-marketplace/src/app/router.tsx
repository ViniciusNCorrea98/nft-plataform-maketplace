import { createRootRouteWithContext, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { getSession, isAuthenticated } from './session'
import { RouteState } from './route-state'

export interface RouterContext {
  queryClient: QueryClient
}

export async function requireAuthenticated(queryClient: QueryClient) {
  const session = await getSession(queryClient)
  if (!isAuthenticated(session)) throw redirect({ href: '/login', throw: true })
  return session
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: () => <RouteState title="Página não encontrada" detail="A rota solicitada não existe." />,
})

const publicRoute = <const TPath extends string>(path: TPath, title: string, detail: string) =>
  createRoute({ getParentRoute: () => rootRoute, path, component: () => <RouteState title={title} detail={detail} /> })

const protectedRoute = (path: string, title: string, detail: string) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    beforeLoad: ({ context }) => requireAuthenticated(context.queryClient),
    component: () => <RouteState title={title} detail={detail} />,
  })

const indexRoute = publicRoute('/', 'NFT Marketplace', 'Catálogo disponível em uma próxima tarefa.')
const nftRoute = createRoute({ getParentRoute: () => rootRoute, path: '/nft/$id', component: () => <RouteState title="NFT" detail="Detalhe disponível em uma próxima tarefa." /> })
const loginRoute = publicRoute('/login', 'Login', 'A autenticação será implementada na T05.')
const registerRoute = publicRoute('/register', 'Cadastro', 'O cadastro será implementado na T05.')
const cartRoute = protectedRoute('/cart', 'Carrinho', 'O carrinho será implementado na T07.')
const checkoutRoute = protectedRoute('/checkout', 'Checkout', 'O checkout será implementado na T08.')
const orderRoute = createRoute({ getParentRoute: () => rootRoute, path: '/orders/$id', beforeLoad: ({ context }) => requireAuthenticated(context.queryClient), component: () => <RouteState title="Pedido" detail="O pedido será implementado na T08." /> })
const profileRoute = protectedRoute('/account/profile', 'Perfil', 'O perfil será implementado na T10.')
const walletsRoute = protectedRoute('/account/wallets', 'Carteiras', 'As carteiras serão implementadas na T10.')

export const routeTree = rootRoute.addChildren([indexRoute, nftRoute, loginRoute, registerRoute, cartRoute, checkoutRoute, orderRoute, profileRoute, walletsRoute])
export const router = createRouter({ routeTree, context: { queryClient: undefined as unknown as QueryClient } })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
