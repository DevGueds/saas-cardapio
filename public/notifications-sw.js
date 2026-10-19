/* No offline cache: orders, sessions and financial responses always come from the API. */
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()))
self.addEventListener("push", event => {
  let payload
  try { payload = event.data?.json() } catch { return }
  if (!payload || typeof payload.title !== "string" || typeof payload.body !== "string" || typeof payload.tag !== "string") return
  const path = typeof payload.url === "string" && /^\/(admin\/orders\?restaurant=[a-f0-9-]{36}|menu\/[a-z0-9-]+)$/.test(payload.url) ? payload.url : "/"
  event.waitUntil(self.registration.showNotification(payload.title.slice(0, 160), { body: payload.body.slice(0, 500), tag: payload.tag.slice(0, 100), data: { path }, icon: "/icon.svg" }))
})
self.addEventListener("notificationclick", event => {
  event.notification.close()
  const url = new URL(event.notification.data?.path || "/", self.location.origin)
  if (url.origin !== self.location.origin) return
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const existing = windows.find(client => client.url === url.href)
    if (existing) return existing.focus()
    return self.clients.openWindow(url.href)
  })())
})
