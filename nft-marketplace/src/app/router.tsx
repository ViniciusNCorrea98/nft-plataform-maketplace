import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { getSession, isAuthenticated } from "./session";
import { RouteState } from "./route-state";
import { AppShell } from "@/components/layout/app-shell";
import { safeReturnPath } from "@/features/auth/return-path";

export interface RouterContext {
  queryClient: QueryClient;
}
export type CatalogSearch = {
  search?: string;
  collection?: string;
  minPrice?: number;
  maxPrice?: number;
  network?: "ethereum" | "polygon" | "solana";
  sort?: "featured" | "price-asc" | "price-desc";
  page?: number;
};
export type AuthSearch = { redirect?: string };
export type CheckoutSearch = { coupon?: string };

export async function requireAuthenticated(
  queryClient: QueryClient,
  requestedPath = "/"
) {

  const session = await getSession(queryClient);

  if (!isAuthenticated(session))

    throw redirect({
      href: `/login?redirect=${encodeURIComponent(
        safeReturnPath(requestedPath)
      )}`,
      throw: true,
    });

  return session;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
  notFoundComponent: () => (
    <RouteState
      title="Página não encontrada"
      detail="A rota solicitada não existe."
    />
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>): CatalogSearch => ({
    search:
      typeof search.search === "string" && search.search
        ? search.search
        : undefined,
    collection:
      typeof search.collection === "string" && search.collection
        ? search.collection
        : undefined,
    minPrice:
      typeof search.minPrice === "number" && Number.isFinite(search.minPrice) && search.minPrice >= 0
        ? search.minPrice
        : undefined,
    maxPrice:
      typeof search.maxPrice === "number" && Number.isFinite(search.maxPrice) && search.maxPrice >= 0
        ? search.maxPrice
        : undefined,
    network:
      search.network === "ethereum" || search.network === "polygon" || search.network === "solana"
        ? search.network
        : undefined,
    sort:
      search.sort === "price-asc" || search.sort === "price-desc"
        ? search.sort
        : "featured",
    page:
      typeof search.page === "number" &&
      Number.isInteger(search.page) &&
      search.page > 0
        ? search.page
        : 1,
  }),
  component: lazyRouteComponent(
    () => import("@/features/catalog/catalog-page"),
    "CatalogPage"
  ),
});

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/nft/$id",
  component: lazyRouteComponent(
    () => import("@/features/catalog/detail-page"),
    "DetailPage"
  ),
});
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: lazyRouteComponent(
    () => import("@/features/auth/auth-form"),
    "LoginPage"
  ),
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: lazyRouteComponent(
    () => import("@/features/auth/auth-form"),
    "RegisterPage"
  ),
});
const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cart",
  beforeLoad: ({ context, location }) =>
    requireAuthenticated(context.queryClient, location.href),
  component: lazyRouteComponent(
    () => import("@/features/cart/cart-page"),
    "CartPage"
  ),
});

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/checkout",
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    coupon:
      typeof search.coupon === "string" && search.coupon
        ? search.coupon
        : undefined,
  }),
  beforeLoad: ({ context, location }) =>
    requireAuthenticated(context.queryClient, location.href),
  component: lazyRouteComponent(
    () => import("@/features/checkout/checkout-page"),
    "CheckoutPage"
  ),
});

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders/$id",
  beforeLoad: ({ context, location }) =>
    requireAuthenticated(context.queryClient, location.href),
  component: lazyRouteComponent(
    () => import("@/features/orders/order-page"),
    "OrderPage"
  ),
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account/profile",
  beforeLoad: ({ context, location }) =>
    requireAuthenticated(context.queryClient, location.href),
  component: lazyRouteComponent(
    () => import("@/features/account/profile-page"),
    "ProfilePage"
  ),
});

const walletsRoute = createRoute({

  getParentRoute: () => rootRoute,
  path: "/account/wallets",
  beforeLoad: ({ context, location }) =>
    requireAuthenticated(context.queryClient, location.href),
  component: lazyRouteComponent(
    () => import("@/features/account/wallets-page"),
    "WalletsPage"
  ),
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  nftRoute,
  loginRoute,
  registerRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  profileRoute,
  walletsRoute,
]);
export const router = createRouter({
  routeTree,
  context: { queryClient: undefined as unknown as QueryClient },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
