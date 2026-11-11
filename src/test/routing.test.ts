import assert from "node:assert/strict"
import { test } from "node:test"
import { routeSlug, gameForSlug, itemHref, pageGames, parseItemRoute } from "../main/routing"
test("item routes resolve nested pages under the deployment base", () => {
  assert.equal(
    routeSlug("/DOS-crafting-docs/Mikstury-i-jedzenie/HEALING-POTION/", "/DOS-crafting-docs/"),
    "Mikstury-i-jedzenie/HEALING-POTION",
  )
  assert.equal(routeSlug("/DOS-crafting-docs/Bron/BOW.html", "/DOS-crafting-docs/"), "Bron/BOW")
  assert.equal(routeSlug("/DOS-crafting-docs/Bron/BOW/index.html", "/DOS-crafting-docs/"), "Bron/BOW")
  assert.equal(gameForSlug("dos2-crafting-overhaul"), "dos2-overhaul")
})

test("a malformed percent escape in the address does not crash routing", () => {
  // decodeURIComponent throws URIError here; App reads the route during its first render.
  assert.doesNotThrow(() => routeSlug("/DOS-crafting-docs/Bron/%E0%A4%A", "/DOS-crafting-docs/"))
  assert.equal(routeSlug("/DOS-crafting-docs/100%", "/DOS-crafting-docs/"), "100%")
  assert.equal(routeSlug("/DOS-crafting-docs/Bron/%C5%81UK", "/DOS-crafting-docs/"), "Bron/ŁUK")
})

test("item pages live under their game's catalog address", () => {
  assert.equal(itemHref("dos2", "apple"), "/DOS2/apple")
  assert.deepEqual(parseItemRoute(routeSlug("/DOS-crafting-docs/receptury/apple.html", "/DOS-crafting-docs/")), {
    game: "dos1",
    item: "apple",
  })
  for (const slug of ["apple", "DOS2", "DOS2/a/b"]) assert.equal(parseItemRoute(slug), undefined, slug)
  // Overhaul lists every base DOS2 item as well as its own.
  assert.deepEqual(pageGames(["DOS2", "Category"]), ["dos2", "dos2-overhaul"])
  assert.deepEqual(pageGames(["DOS2-CO"]), ["dos2-overhaul"])
  assert.deepEqual(pageGames(["DOS1"]), ["dos1"])
})
