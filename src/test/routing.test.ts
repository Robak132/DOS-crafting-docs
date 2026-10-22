import assert from "node:assert/strict"
import { test } from "node:test"
import { routeSlug, gameForSlug, isPublicPage } from "../main/routing"
test("item routes resolve nested pages under the deployment base", () => {
  assert.equal(
    routeSlug("/DOS-crafting-docs/Mikstury-i-jedzenie/HEALING-POTION/", "/DOS-crafting-docs/"),
    "Mikstury-i-jedzenie/HEALING-POTION",
  )
  assert.equal(routeSlug("/DOS-crafting-docs/Bron/BOW.html", "/DOS-crafting-docs/"), "Bron/BOW")
  assert.equal(routeSlug("/DOS-crafting-docs/Bron/BOW/index.html", "/DOS-crafting-docs/"), "Bron/BOW")
  assert.equal(gameForSlug("dos2-crafting-overhaul"), "dos2-overhaul")
})

test("only item pages and game catalogs are public; category and tag landing pages stay blocked", () => {
  assert.equal(isPublicPage({ slug: "Bron/BOW", itemPage: true, categoryPage: false }), true)
  for (const slug of ["index", "DOS2", "dos2-crafting-overhaul"])
    assert.equal(isPublicPage({ slug, itemPage: false, categoryPage: false }), true)
  for (const slug of ["Bron", "Skladniki", "Typ/Bron", "tags/Essence", "Przedmioty"])
    assert.equal(isPublicPage({ slug, itemPage: false, categoryPage: slug !== "Przedmioty" }), false)
  assert.equal(isPublicPage({ slug: "Bron", itemPage: true, categoryPage: true }), false)
})

test("a malformed percent escape in the address does not crash routing", () => {
  // decodeURIComponent throws URIError here; App reads the route during its first render.
  assert.doesNotThrow(() => routeSlug("/DOS-crafting-docs/Bron/%E0%A4%A", "/DOS-crafting-docs/"))
  assert.equal(routeSlug("/DOS-crafting-docs/100%", "/DOS-crafting-docs/"), "100%")
  assert.equal(routeSlug("/DOS-crafting-docs/Bron/%C5%81UK", "/DOS-crafting-docs/"), "Bron/ŁUK")
})
