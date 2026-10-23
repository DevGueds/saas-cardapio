import LoginPage from "../modules/identity/presentation/LoginPage"
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router"

import PublicRoute from "./presentation/PublicRoute"

import AdminRoute from "./presentation/AdminRoute"

import NotFoundPage from "./presentation/NotFoundPage"

import RouteErrorPage from "./presentation/RouteErrorPage"

export const router = createBrowserRouter(
  [
    {
      Component: Outlet,
      ErrorBoundary: RouteErrorPage,

      HydrateFallback: () => (
        <main className="state-page">
          <p role="status">Carregando…</p>
        </main>
      ),

      children: [
        { path: "/", Component: PublicRoute },
        {
          path: "/painel/:slug",
          lazy: async () => ({
            Component: (await import("../modules/engagement/presentation/BoardPage"))
              .default,
          }),
        },
        { path: "/login", Component: LoginPage },
        {
          path: "/mfa",
          lazy: async () => ({
            Component: (await import("../modules/identity/presentation/MfaPage")).default,
          }),
        },
        {
          path: "/pedido/:slug/:orderId",
          lazy: async () => ({
            Component: (await import("../modules/orders/presentation/TrackingPage"))
              .default,
          }),
        },

        { path: "/menu/:slug?", Component: PublicRoute },

        {
          path: "/admin",
          Component: AdminRoute,
          children: [
            {
              path: "security",
              lazy: async () => ({
                Component: (await import("../modules/identity/presentation/SecurityPage"))
                  .default,
              }),
            },
            { index: true, Component: AdminAlias },
            {
              path: "channels",
              lazy: async () => ({
                Component: (
                  await import("../modules/engagement/presentation/ChannelsPage")
                ).default,
              }),
            },
            {
              path: "addons",
              lazy: async () => ({
                Component: (await import("../modules/commerce/presentation/AddonsPage"))
                  .default,
              }),
            },
            {
              path: "appearance",
              lazy: async () => ({
                Component: (
                  await import("../modules/commerce/presentation/AppearancePage")
                ).default,
              }),
            },
            {
              path: "finance",
              lazy: async () => ({
                Component: (await import("../modules/payments/presentation/FinancePage"))
                  .default,
              }),
            },
            {
              path: "offers",
              lazy: async () => ({
                Component: (await import("../modules/commerce/presentation/OffersPage"))
                  .default,
              }),
            },
            {
              path: "delivery",
              lazy: async () => ({
                Component: (
                  await import("../modules/commerce/presentation/DeliverySettingsPage")
                ).default,
              }),
            },
            {
              path: "team",
              lazy: async () => ({
                Component: (await import("../modules/identity/presentation/TeamPage"))
                  .default,
              }),
            },

            {
              path: "products",
              Component: AdminAlias,
            },

            {
              path: "menu",
              lazy: async () => ({
                Component: (await import("../modules/catalog/presentation/CatalogPage"))
                  .default,
              }),
            },

            {
              path: "settings",
              lazy: async () => ({
                Component: (
                  await import("../modules/restaurant/presentation/RestaurantSettingsPage")
                ).default,
              }),
            },

            {
              path: "orders",
              lazy: async () => ({
                Component:
                  import.meta.env.VITE_APP_MODE === "api"
                    ? (await import("../modules/orders/presentation/OrdersPage")).default
                    : (await import("../modules/demo-orders/presentation/DemoOrdersPage"))
                        .default,
              }),
            },
          ],
        },

        { path: "*", Component: NotFoundPage },
      ],
    },
  ],
  {
    basename:
      new URL(import.meta.env.BASE_URL, window.location.origin).pathname.replace(
        /\/$/,
        "",
      ) || "/",
  },
)

function AdminAlias() {
  const location = useLocation()
  return <Navigate to={`/admin/menu${location.search}`} replace />
}
