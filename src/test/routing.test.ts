import assert from "node:assert/strict"
import { test } from "node:test"
import { routeSlug, slugify, gameForSlug } from "../main/routing"
test("legacy item URLs preserve Polish folding, quantities and nesting", () => {
  assert.equal(slugify("Broń/TWO HANDED AXE.md"), "Bron/TWO-HANDED-AXE")
  assert.equal(slugify("Składniki/INKPOT & QUILL.md"), "Skladniki/INKPOT--and--QUILL")
  assert.equal(
    routeSlug("/DOS-crafting-docs/Mikstury-i-jedzenie/HEALING-POTION/", "/DOS-crafting-docs/"),
    "Mikstury-i-jedzenie/HEALING-POTION",
  )
  assert.equal(routeSlug("/DOS-crafting-docs/Bron/BOW.html", "/DOS-crafting-docs/"), "Bron/BOW")
  assert.equal(routeSlug("/DOS-crafting-docs/Bron/BOW/index.html", "/DOS-crafting-docs/"), "Bron/BOW")
  assert.equal(gameForSlug("dos2-crafting-overhaul"), "dos2-overhaul")
})
