import assert from "node:assert/strict"
import { test } from "node:test"
import { searchCatalogPages } from "../../main/domain/pageSearch"

const pages = ["dos1-only", "shared", "mod-only"].map((slug) => ({
  slug,
  title: "Stale global name",
  titlePl: "Nieaktualna nazwa",
  tags: [],
  itemPage: true,
  categoryPage: false,
}))
const base = new Map<string, { name: string; namePl?: string }>([
  ["shared", { name: "Shared Sword", namePl: "Wspólny miecz" }],
])

test("page search restricts membership to the active catalog and uses its localized names", () => {
  assert.deepEqual(
    searchCatalogPages(pages, base, "sword").map((page) => page.slug),
    ["shared"],
  )
  assert.equal(searchCatalogPages(pages, base, "MIECZ").length, 1)
  assert.equal(searchCatalogPages(pages, base, "Stale").length, 0)
  assert.deepEqual(searchCatalogPages(pages, new Map(), "sword"), [])
  assert.deepEqual(searchCatalogPages(pages, base, "  "), [])
})

test("switching catalogs changes results; combined Overhaul can include base items", () => {
  const dos1 = new Map([["dos1-only", { name: "DOS1 Sword" }]])
  const combined = new Map([...base, ["mod-only", { name: "Mod Sword" }] as const])
  assert.deepEqual(
    searchCatalogPages(pages, dos1, "sword").map((page) => page.slug),
    ["dos1-only"],
  )
  assert.deepEqual(
    searchCatalogPages(pages, combined, "sword").map((page) => page.slug),
    ["shared", "mod-only"],
  )
  assert.equal(searchCatalogPages(pages, combined, "sword", 1).length, 1)
})
