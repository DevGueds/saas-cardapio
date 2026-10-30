import { readFile, writeFile } from "node:fs/promises"

// Only the trusted Vite shell is a Caddy template. User data is HTML-escaped by
// the API (including braces); it can never introduce Caddy template actions.
export function prepareMenuShell(html) {
  const tags = []
  const stripped = html.replace(
    /<title\b[^>]*>[\s\S]*?<\/title>|<meta\b(?=[^>]*(?:name=["'](?:description|twitter:[^"']+)["']|property=["']og:[^"']+["']))[^>]*>|<link\b(?=[^>]*rel=["']canonical["'])[^>]*>/gi,
    (tag) => {
      tags.push(tag)
      return ""
    },
  )
  const dynamic =
    '{{if regexMatch "^/menu/[a-z0-9]+(-[a-z0-9]+)*$" .OriginalReq.URL.Path}}{{httpInclude (printf "/api/v1/public/restaurants/%s/share" (trimPrefix "/menu/" .OriginalReq.URL.Path))}}{{else}}' +
    tags.join("\n") +
    "{{end}}"
  return stripped.replace("</head>", dynamic + "\n</head>")
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/prepare-menu-shell.mjs")) {
  const filename = process.argv[2] ?? "dist/index.html"
  await writeFile(filename, prepareMenuShell(await readFile(filename, "utf8")), "utf8")
}
