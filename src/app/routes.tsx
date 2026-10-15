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
        { path: "/login", Component: LoginPage },

        { path: "/menu/:slug?", Component: PublicRoute },

        {
          path: "/admin",
          Component: AdminRoute,
          children: [
            { index: true, Component: AdminAlias },

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
