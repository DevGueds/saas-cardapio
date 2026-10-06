import { createBrowserRouter, Navigate } from "react-router"

export const router = createBrowserRouter([
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
])
