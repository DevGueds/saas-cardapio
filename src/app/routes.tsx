import { createBrowserRouter, Navigate, Outlet } from "react-router"

function HydrateFallback() {
  return (
    <div className="min-h-screen bg-[#f6f6f2] flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-medium text-[#6d7068]">Carregando...</span>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    id: "root",
    HydrateFallback,
    Component: Outlet,
    children: [
      {
        path: "/",
        lazy: async () => {
          const { default: Component } = await import("./PublicMenu")
          return { Component }
        },
      },
      {
        path: "/menu/:slug?",
        lazy: async () => {
          const { default: Component } = await import("./PublicMenu")
          return { Component }
        },
      },
      {
        path: "/admin",
        lazy: async () => {
          const { default: Component } = await import("./AdminDashboard")
          return { Component }
        },
      },
      {
        path: "/admin/menu",
        lazy: async () => {
          const { default: Component } = await import("./AdminDashboard")
          return { Component }
        },
      },
      {
        path: "/admin/products",
        lazy: async () => {
          const { default: Component } = await import("./AdminDashboard")
          return { Component }
        },
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
])
