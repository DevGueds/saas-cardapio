import { test } from "node:test"
import assert from "node:assert/strict"
import { prepareMenuShell } from "./prepare-menu-shell.mjs"
test("Caddy shell injects metadata in the initial head and preserves generic routes and hashed assets", () => {
  const html =
    '<html><head><title>Pede Aqui</title><meta property="og:title" content="Pede Aqui"><meta name="twitter:card" content="summary"><meta name="description" content="App"><meta name="viewport" content="width=device-width"><script type="module" src="/assets/main.js"></script></head><body><div id="root"></div></body></html>'
  const result = prepareMenuShell(html)
  assert.match(result, /httpInclude/)
  assert.match(result, /OriginalReq.URL.Path/)
  assert.match(result, /\{\{else\}\}<title>Pede Aqui/)
  assert.match(result, /name="viewport"/)
  assert.match(result, /src="\/assets\/main.js"/)
  assert.ok(result.indexOf("httpInclude") < result.indexOf("</head>"))
})
