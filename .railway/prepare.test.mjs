import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

function fixture(t, remote) {
  const parent = resolve(tmpdir())
  const root = mkdtempSync(join(parent, "cardapio railway prepare-"))
  t.after(() => {
    assert.equal(dirname(root), parent)
    rmSync(root, { recursive: true, force: true })
  })
  const folder = join(root, ".railway")
  mkdirSync(folder)
  for (const file of ["package.json", "parameters.ts", "prepare.mjs"])
    copyFileSync(new URL(file, import.meta.url), join(folder, file))
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      stdio: "pipe",
      windowsHide: true,
    })
  git("init", "--quiet")
  if (remote) git("remote", "add", "origin", remote)
  const file = join(folder, "local", "production.json")
  return {
    git,
    file,
    read: () => JSON.parse(readFileSync(file, "utf8")),
    run: (...args) =>
      spawnSync(process.execPath, [join(folder, "prepare.mjs"), ...args], {
        cwd: parent,
        encoding: "utf8",
        windowsHide: true,
      }),
  }
}

test("prepare selects the current GitHub origin over HTTPS and SSH", (t) => {
  for (const remote of [
    "https://github.com/ExampleFork/saas-cardapio.git",
    "git@github.com:ExampleFork/saas-cardapio.git",
    "ssh://git@github.com/ExampleFork/saas-cardapio.git",
  ]) {
    const local = fixture(t, remote)
    const result = local.run("--branch", "deploy/production")
    assert.equal(result.status, 0, result.stderr)
    const parameters = local.read()
    assert.equal(parameters.repository, "ExampleFork/saas-cardapio")
    assert.equal(parameters.branch, "deploy/production")
    assert.match(result.stdout, /Esta preparação não cria serviços/)
    for (const secret of Object.values(parameters.secrets))
      assert.equal(result.stdout.includes(secret), false)
  }
})

test("prepare preserves saved repository and secrets until an explicit override", (t) => {
  const local = fixture(t, "https://github.com/ExampleFork/saas-cardapio.git")
  assert.equal(local.run().status, 0)
  const original = local.read()
  local.git("remote", "set-url", "origin", "https://github.com/OtherFork/menu.git")
  assert.equal(local.run().status, 0)
  assert.deepEqual(local.read(), original)
  assert.equal(local.run("--repository", "OtherFork/menu").status, 0)
  assert.equal(local.read().repository, "OtherFork/menu")
  assert.deepEqual(local.read().secrets, original.secrets)
})

test("prepare requires an explicit repository when GitHub origin is unavailable", (t) => {
  for (const remote of [undefined, "https://gitlab.com/ExampleFork/menu.git"]) {
    const local = fixture(t, remote)
    const result = local.run()
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /--repository dono\/repositorio/)
    assert.equal(existsSync(local.file), false)
    assert.equal(local.run("--repository", "ExampleFork/menu").status, 0)
    assert.equal(local.read().repository, "ExampleFork/menu")
  }
})
