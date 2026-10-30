import { test } from "node:test"
import assert from "node:assert/strict"
import sharp from "sharp"
import { parseMenuDocument } from "@cardapio/domain/menu-document"
import { saveCategory, deleteCategory } from "@cardapio/domain/catalog-changes"
import { defaultMenuSharing, parseMenuSharing } from "@cardapio/domain/menu-sharing"
import {
  SocialImages,
  socialMetadata,
} from "../../src/modules/catalog/infrastructure/social-images.js"
import { loadConfig } from "../../src/app/config.js"
const menu = parseMenuDocument(
  {
    schemaVersion: 1,
    revision: 0,
    restaurant: {
      id: "store",
      slug: "minha-loja",
      name: 'Loja <script> {{env "SECRET"}}',
      description: "Boa comida & bons momentos",
      logoUrl: "",
      coverUrl: "",
      whatsapp: "",
      whatsappConfigured: false,
      deliveryFee: 0,
      minOrder: 0,
      address: "",
      isOpen: false,
      eta: "30 min",
    },
    products: [],
    categories: [],
  },
  "store",
)

test("social metadata escapes HTML and Caddy template actions and uses the configured canonical origin", () => {
  const result = socialMetadata(menu, "https://menu.example.test")
  assert.match(result, /https:\/\/menu.example.test\/menu\/minha-loja/)
  assert.match(result, /share-image\/square.png\?v=0/)
  assert.match(result, /og:image:width" content="600"/)
  assert.match(result, /&#123;&#123;env &quot;SECRET&quot;&#125;&#125;/)
  assert.ok(!result.includes("<script>") && !result.includes("{{"))
})
test("social images generate real 600x600 and 1200x630 PNGs, crop uploads and reject damaged images", async () => {
  const images = new SocialImages()
  for (const format of ["square", "landscape"] as const) {
    const output = await images.render(menu, format),
      metadata = await sharp(output).metadata()
    assert.equal(metadata.format, "png")
    assert.equal(metadata.width, format === "square" ? 600 : 1200)
    assert.equal(metadata.height, format === "square" ? 600 : 630)
    assert.ok(output.length < 5 * 1024 * 1024)
  }
  const upload = await sharp({
    create: { width: 100, height: 200, channels: 3, background: "#cc2200" },
  })
    .png()
    .toBuffer()
  const image = "data:image/png;base64," + upload.toString("base64")
  await images.validate(image)
  const custom = {
    ...menu,
    revision: 1,
    restaurant: {
      ...menu.restaurant,
      sharing: { ...defaultMenuSharing(), squareImage: image },
    },
  }
  assert.equal((await sharp(await images.render(custom, "square")).metadata()).width, 600)
  await assert.rejects(() => images.validate("data:image/png;base64,iVBORw0KGgo="))
  assert.throws(() =>
    parseMenuSharing({
      ...defaultMenuSharing(),
      squareImage: "https://attacker.test/private",
    }),
  )
})
test("category names are unique after normalization and deleting a category never deletes products", () => {
  const created = saveCategory(menu, "Bebidas", "drinks")
  assert.throws(() => saveCategory(created, " béBidas ", "other"))
  const renamed = saveCategory(created, "Sucos", "drinks")
  assert.equal(renamed.categories[0]?.name, "Sucos")
  assert.equal(deleteCategory(renamed, "drinks").categories.length, 0)
  assert.throws(() => deleteCategory(menu, "missing"))
})
test("global email switch disables even stale provider configuration without disabling production signup", () => {
  const config = loadConfig({
    NODE_ENV: "production",
    REDIS_URL: "rediss://:test@127.0.0.1/0",
    DATABASE_URL: "postgresql://test:test@127.0.0.1/test",
    DATABASE_TLS: "true",
    SESSION_SECRET: "a".repeat(64),
    CORS_ORIGINS: "https://menu.test",
    SIGNUP_ENABLED: "true",
    EMAIL_SEND_ENABLED: "false",
    MAIL_PROVIDER: "postal",
    MAIL_API_URL: "not-ready",
    MAIL_API_KEY: "",
  })
  assert.equal(config.mail.provider, "disabled")
  assert.equal(config.emailSendEnabled, false)
  assert.equal(config.signupEnabled, true)
})
