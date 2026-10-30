import { createRootRouteWithContext, createRoute, createRouter, redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { getSession, isAuthenticated } from './session'
import { RouteState } from './route-state'
import { AppShell } from '@/components/layout/app-shell'
import { CatalogPage } from '@/features/catalog/catalog-page'
import { DetailPage } from '@/features/catalog/detail-page'
import { LoginPage, RegisterPage } from '@/features/auth/auth-form'
import { safeReturnPath } from '@/features/auth/return-path'
import { CartPage } from '@/features/cart/cart-page'
import { CheckoutPage } from '@/features/checkout/checkout-page'
import { OrderPage } from '@/features/orders/order-page'

export interface RouterContext {
  queryClient: QueryClient
}
export type CatalogSearch = { search?: string; collection?: string; sort?: 'featured' | 'price-asc' | 'price-desc'; page?: number }
export type AuthSearch = { redirect?: string }
export type CheckoutSearch = { coupon?: string }

export async function requireAuthenticated(queryClient: QueryClient, requestedPath = '/') {
  const session = await getSession(queryClient)
  if (!isAuthenticated(session)) throw redirect({ href: `/login?redirect=${encodeURIComponent(safeReturnPath(requestedPath))}`, throw: true })
  return session
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
  notFoundComponent: () => <RouteState title="Página não encontrada" detail="A rota solicitada não existe." />,
})

const protectedRoute = <const TPath extends string>(path: TPath, title: string, detail: string) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    beforeLoad: ({ context, location }) => requireAuthenticated(context.queryClient, location.href),
    component: () => <RouteState title={title} detail={detail} />,
  })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): CatalogSearch => ({
    search: typeof search.search === 'string' && search.search ? search.search : undefined,
    collection: typeof search.collection === 'string' && search.collection ? search.collection : undefined,
    sort: search.sort === 'price-asc' || search.sort === 'price-desc' ? search.sort : 'featured',
    page: typeof search.page === 'number' && Number.isInteger(search.page) && search.page > 0 ? search.page : 1,
  }),
  component: CatalogPage,
})
const nftRoute = createRoute({ getParentRoute: () => rootRoute, path: '/nft/$id', component: DetailPage })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', validateSearch: (search: Record<string, unknown>): AuthSearch => ({ redirect: typeof search.redirect === 'string' ? search.redirect : undefined }), component: LoginPage })
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/register', component: RegisterPage })
const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cart', beforeLoad: ({ context, location }) => requireAuthenticated(context.queryClient, location.href), component: CartPage })
const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/checkout', validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({ coupon: typeof search.coupon === 'string' && search.coupon ? search.coupon : undefined }), beforeLoad: ({ context, location }) => requireAuthenticated(context.queryClient, location.href), component: CheckoutPage })
const orderRoute = createRoute({ getParentRoute: () => rootRoute, path: '/orders/$id', beforeLoad: ({ context, location }) => requireAuthenticated(context.queryClient, location.href), component: OrderPage })
const profileRoute = protectedRoute('/account/profile', 'Perfil', 'O perfil será implementado na T10.')
const walletsRoute = protectedRoute('/account/wallets', 'Carteiras', 'As carteiras serão implementadas na T10.')

export const routeTree = rootRoute.addChildren([indexRoute, nftRoute, loginRoute, registerRoute, cartRoute, checkoutRoute, orderRoute, profileRoute, walletsRoute])
export const router = createRouter({ routeTree, context: { queryClient: undefined as unknown as QueryClient } })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
