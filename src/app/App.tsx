import { RouterProvider } from "react-router"
import Notifications from "../shared/presentation/Notifications"
import ConnectionNotice from "../shared/presentation/ConnectionNotice"

import AppErrorBoundary from "../shared/presentation/AppErrorBoundary"

import { services } from "./composition"

import ServicesProvider from "./presentation/ServicesProvider"

import { router } from "./routes"

export default function App() {
  return (
    <ServicesProvider services={services}>
      <AppErrorBoundary report={services.reportUnexpected}>
        {services.mode === "api" && <ConnectionNotice />}
        <RouterProvider router={router} />
        <Notifications />
      </AppErrorBoundary>
    </ServicesProvider>
  )
}
