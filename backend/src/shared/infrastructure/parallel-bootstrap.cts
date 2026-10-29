// IPC is private to the parent process. Only source generated from application-owned
// functions by Parallel.js is evaluated; HTTP input is sent separately as JSON data.
// No database credentials, session keys or provider tokens are passed to this process.
process.on("uncaughtException", () => process.exit(1))
process.on("unhandledRejection", () => process.exit(1))
process.on("disconnect", () => process.exit(0))
process.once("message", (message: unknown) => {
  const source = JSON.parse(String(message)) as { data?: unknown }
  if (typeof source.data !== "string" || source.data.length > 32_000) process.exit(1)
  // Parallel.js' protocol serializes its trusted callback once, then sends task data.
  eval(source.data)
})
export {}
