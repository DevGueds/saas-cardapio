import React from "react"

import ReactDOM from "react-dom/client"

import App from "./app/App"
import { browserExecutor } from "./shared/browser-executor"

import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!, {
  // Local boundaries report sanitized diagnostics; React's default console output
  // would also include the original exception, which can contain customer data.
  onCaughtError: () => undefined,
  onUncaughtError: (cause) => {
    void browserExecutor.run("presentation", "uncaught", async () => {
      throw cause
    })
  },
  onRecoverableError: (cause) => {
    void browserExecutor.run("presentation", "recoverable", async () => {
      throw cause
    })
  },
}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
