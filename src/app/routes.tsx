import { createBrowserRouter, Navigate, Outlet } from "react-router"

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

        { path: "/menu/:slug?", Component: PublicRoute },

        {
          path: "/admin",
          Component: AdminRoute,
          children: [
            { index: true, element: <Navigate to="menu" replace /> },

            {
              path: "products",
              element: <Navigate to="/admin/menu" replace />,
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
                Component: (
                  await import("../modules/demo-orders/presentation/DemoOrdersPage")
                ).default,
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
