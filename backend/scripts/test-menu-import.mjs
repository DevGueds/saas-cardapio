import { before, after, test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { Client } from "pg"
import { normalizeName } from "@cardapio/domain/validation"
import { parseMenuDocument } from "@cardapio/domain/menu-document"

// Manual SQL is verified only against the explicitly configured local test database.
const url = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://invalid/invalid")
if (!url.pathname.endsWith("_test") || !["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Configure TEST_DATABASE_URL com um banco local terminado em _test.")
const options = { connectionString: url.href, ssl: false, connectionTimeoutMillis: 5000 }
const client = new Client(options)
const sql = await readFile(
  new URL("../../scripts/sql/importar-cardapio-cliente.sql", import.meta.url),
  "utf8",
)
const catalog = JSON.parse(sql.split("$catalog$")[1])
const fixtures = []
const originalCategories = ["Pizzas G (8 Fatias)", "Hambúrguer's Tradicionais", "Bebidas"]
const originalProducts = {
  Muçarela: "Mussarela",
  "Três Queijos": "Tres Queijos",
  "Egg-Burger": "Egg-burgue",
  "Eggs-Double-Salsicha": "Eggs-Double-salcisha",
  "X-Double-Calabacon": "X-Double calabacon",
  "Tuchaua Champ 350 ml": "Tuchaua Champ Lata 350ml",
  "Coca-Cola Original 1 L": "Refrigerante Coca-Cola Original 1 Litro",
}
const forStore = (slug) =>
  sql.replace("v_slug text := 'PREENCHA_O_SLUG_DA_LOJA';", `v_slug text := '${slug}';`)
async function store(active = true) {
  const fixture = {
    tenantId: randomUUID(),
    id: randomUUID(),
    slug: `sql-import-${randomUUID()}`,
  }
  await client.query(
    'INSERT INTO public."Tenant" (id, name, active) VALUES ($1, $2, $3)',
    [fixture.tenantId, "Importação de teste", active],
  )
  fixtures.push(fixture)
  await client.query(
    `INSERT INTO public."Restaurant"
    (id, "tenantId", slug, name, description, whatsapp, address, "logoUrl", "coverUrl", eta)
    VALUES ($1, $2, $3, 'Loja de teste SQL', '', '', '', '', '', '30–50 min')`,
    [fixture.id, fixture.tenantId, fixture.slug],
  )
  return fixture
}
async function category(fixture, name) {
  const id = randomUUID()
  await client.query(
    'INSERT INTO public."Category" (id, "tenantId", "restaurantId", name, "normalizedName") VALUES ($1,$2,$3,$4,$5)',
    [id, fixture.tenantId, fixture.id, name, normalizeName(name)],
  )
  return id
}
async function product(fixture, categoryId, name) {
  const id = randomUUID()
  await client.query(
    `INSERT INTO public."Product" (id,"tenantId","restaurantId","categoryId",name,description,price,"imageUrl",available,popular)
    VALUES ($1,$2,$3,$4,$5,'Texto anterior.',1,'https://example.test/product.png',false,true)`,
    [id, fixture.tenantId, fixture.id, categoryId, name],
  )
  return id
}
async function menu(fixture) {
  const restaurant = (
    await client.query('SELECT * FROM public."Restaurant" WHERE id=$1', [fixture.id])
  ).rows[0]
  const categories = (
    await client.query(
      'SELECT * FROM public."Category" WHERE "tenantId"=$1 AND "restaurantId"=$2 ORDER BY name',
      [fixture.tenantId, fixture.id],
    )
  ).rows
  const products = (
    await client.query(
      'SELECT * FROM public."Product" WHERE "tenantId"=$1 AND "restaurantId"=$2 ORDER BY name',
      [fixture.tenantId, fixture.id],
    )
  ).rows
  return {
    schemaVersion: 1,
    revision: restaurant.revision,
    restaurant,
    categories,
    products,
  }
}
before(() => client.connect())
after(async () => {
  try {
    for (const fixture of fixtures) {
      const scope = [fixture.tenantId, fixture.id]
      await client.query(
        'DELETE FROM public."Product" WHERE "tenantId"=$1 AND "restaurantId"=$2',
        scope,
      )
      await client.query(
        'DELETE FROM public."Category" WHERE "tenantId"=$1 AND "restaurantId"=$2',
        scope,
      )
      await client.query(
        'DELETE FROM public."Restaurant" WHERE "tenantId"=$1 AND id=$2',
        scope,
      )
      await client.query('DELETE FROM public."Tenant" WHERE id=$1', [fixture.tenantId])
    }
  } finally {
    await client.end()
  }
})

test("SQL requires an explicit existing active store", async () => {
  await assert.rejects(client.query(sql), /Preencha v_slug/)
  await assert.rejects(
    client.query(forStore(`not-found-${randomUUID()}`)),
    /Loja não encontrada/,
  )
  const inactive = await store(false)
  await assert.rejects(client.query(forStore(inactive.slug)), /organização inativa/)
  assert.equal((await menu(inactive)).products.length, 0)
})
test("SQL imports 41 products once, uses exact cents and produces a valid domain menu", async () => {
  const target = await store(),
    other = await store()
  const untouched = await menu(other)
  await client.query(forStore(target.slug))
  const first = await menu(target)
  assert.equal(first.categories.length, 3)
  assert.equal(first.products.length, 41)
  assert.equal(first.revision, 1)
  assert.equal(first.products.find((p) => p.name === "Hambúrguer").price, 1560)
  assert.equal(first.products.find((p) => p.name === "Da Casa").price, 6000)
  assert.equal(
    first.products.find((p) => p.name === "Coca-Cola Original 600 ml").price,
    1000,
  )
  assert.equal(
    first.products.every((p) => p.available && !p.popular && p.imageUrl === ""),
    true,
  )
  parseMenuDocument(first, target.id)
  await client.query(forStore(target.slug))
  assert.deepEqual(await menu(target), first)
  assert.deepEqual(await menu(other), untouched)
})
test("SQL recognizes legacy spelling and preserves IDs, images, flags and unrelated products", async () => {
  const target = await store(),
    ids = new Map(),
    categoryIds = []
  for (const [index, source] of catalog.entries()) {
    const categoryId = await category(target, originalCategories[index])
    categoryIds.push(categoryId)
    for (const p of source.products)
      ids.set(
        p.name,
        await product(
          target,
          categoryId,
          originalProducts[p.name] ??
            ` ${p.name
              .toUpperCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replaceAll("-", " - ")} `,
        ),
      )
  }
  const extra = await product(target, categoryIds[2], "Produto fora da importação")
  const before = (await menu(target)).products.find((p) => p.id === extra)
  await client.query(forStore(target.slug))
  const actual = await menu(target)
  assert.deepEqual(new Set(actual.categories.map((c) => c.id)), new Set(categoryIds))
  assert.equal(actual.products.length, 42)
  for (const source of catalog)
    for (const expected of source.products) {
      const p = actual.products.find((p) => p.id === ids.get(expected.name))
      assert.equal(p.name, expected.name)
      assert.equal(p.description, expected.description)
      assert.equal(p.price, expected.price)
      assert.equal(p.imageUrl, "https://example.test/product.png")
      assert.equal(p.available, false)
      assert.equal(p.popular, true)
    }
  assert.deepEqual(
    actual.products.find((p) => p.id === extra),
    before,
  )
  parseMenuDocument(actual, target.id)
  await client.query(forStore(target.slug))
  assert.deepEqual(await menu(target), actual)
})
test("SQL rolls back earlier category changes if equivalent products are ambiguous", async () => {
  const target = await store(),
    categoryId = await category(target, originalCategories[0])
  await product(target, categoryId, "Mussarela")
  await product(target, categoryId, "MUÇARELA")
  const before = await menu(target)
  await assert.rejects(client.query(forStore(target.slug)), /Há produtos equivalentes/)
  assert.deepEqual(await menu(target), before)
})
test("SQL refuses ambiguous equivalent categories without merging or deleting them", async () => {
  const target = await store()
  await category(target, originalCategories[0])
  await category(target, catalog[0].name)
  const before = await menu(target)
  await assert.rejects(client.query(forStore(target.slug)), /Há categorias equivalentes/)
  assert.deepEqual(await menu(target), before)
})
test("concurrent imports serialize on the store and do not duplicate products or revisions", async () => {
  const target = await store(),
    second = new Client(options)
  await second.connect()
  try {
    await Promise.all([
      client.query(forStore(target.slug)),
      second.query(forStore(target.slug)),
    ])
  } finally {
    await second.end()
  }
  const actual = await menu(target)
  assert.equal(actual.categories.length, 3)
  assert.equal(actual.products.length, 41)
  assert.equal(actual.revision, 1)
})
