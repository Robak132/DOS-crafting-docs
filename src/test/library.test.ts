import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { loadLibrary } from "../../scripts/load-library"
import { expandSmallGroups } from "../main/domain/itemGroups"

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dos-json-library-"))
  await fs.mkdir(path.join(directory, "pages"))
  await fs.mkdir(path.join(directory, "recipes"))
  const page = {
    slug: "item",
    title: "An item",
    titlePl: "Przedmiot",
    tags: ["DOS2", "Typ/Materialy"],
  }
  const recipe = {
    id: "craft-item",
    result: { name: "An item", slug: "item", tags: [] },
    ingredients: [{ name: "Ingredient", tags: [], quantity: "x2" }],
    tags: [],
    requirements: "",
    notes: "Effect",
    remarks: "Instruction",
    source: "Spreadsheet A1",
  }
  const writePages = async (pages: Record<string, object[]>) => {
    for (const [game, name] of [
      ["DOS1", "dos1"],
      ["DOS2", "dos2"],
      ["DOS2-CO", "dos2-co"],
    ])
      await fs.writeFile(path.join(directory, `pages/${name}.json`), JSON.stringify({ game, pages: pages[game] ?? [] }))
  }
  await writePages({ DOS2: [page] })
  for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
    await fs.writeFile(
      path.join(directory, "recipes", `${game}.json`),
      JSON.stringify({ game, recipes: game === "dos2" ? [recipe] : [] }),
    )
  }
  return { directory, page, recipe, writePages }
}

test("JSON library reads structured recipes and item pages from one file per game", async () => {
  const { directory, page, recipe, writePages } = await fixture()
  try {
    const library = await loadLibrary(directory)
    assert.deepEqual(library.pages, [{ ...page, itemPage: true, categoryPage: false }])
    assert.deepEqual(library.sources.dos2, [recipe])
    assert.deepEqual(library.sources["dos2-overhaul"], [])
    await writePages({ DOS2: [{ ...page, title: "Renamed" }] })
    assert.equal((await loadLibrary(directory)).pages[0].title, "Renamed")
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("JSON source rejects empty tags, wrong game files and pages without their game tag", async () => {
  const { directory, page, writePages } = await fixture()
  try {
    await writePages({ DOS2: [{ ...page, tags: [""] }] })
    await assert.rejects(loadLibrary(directory), /Invalid tags/)
    await writePages({ DOS1: [page] })
    await assert.rejects(loadLibrary(directory), /without its game tag DOS1/)
    await writePages({ DOS2: [page] })
    await fs.writeFile(path.join(directory, "pages/dos2.json"), JSON.stringify({ game: "DOS1", pages: [page] }))
    await assert.rejects(loadLibrary(directory), /Wrong game/)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("a page shared by several games is listed identically in each of their files", async () => {
  const { directory, page, writePages } = await fixture()
  const shared = { ...page, tags: ["DOS1", "DOS2", "Typ/Materialy"] }
  try {
    await writePages({ DOS1: [shared], DOS2: [shared] })
    const library = await loadLibrary(directory)
    assert.deepEqual(library.pages, [{ ...shared, itemPage: true, categoryPage: false }])
    await writePages({ DOS1: [shared], DOS2: [{ ...shared, titlePl: "Inny" }] })
    await assert.rejects(loadLibrary(directory), /Copies of a shared page differ/)
    await writePages({ DOS2: [shared] })
    await assert.rejects(loadLibrary(directory), /listed in every game file/)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("page slugs are lowercase English words joined by hyphens and never shadow app routes", async () => {
  const { directory, page, writePages } = await fixture()
  try {
    for (const slug of [
      "Skladniki/apple",
      "Apple",
      "apple_pie",
      "-apple",
      "apple-",
      "a--b",
      "cutting-tool>",
      "jabłko",
    ]) {
      await writePages({ DOS2: [{ ...page, slug }] })
      await assert.rejects(loadLibrary(directory), /Invalid slug/, slug)
    }
    for (const slug of ["receptury", "dos2", "data", "assets"]) {
      await writePages({ DOS2: [{ ...page, slug }] })
      await assert.rejects(loadLibrary(directory), /reserved/, slug)
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("redirects map retired addresses to existing pages only", async () => {
  const { directory } = await fixture()
  const write = (redirects: object) => fs.writeFile(path.join(directory, "redirects.json"), JSON.stringify(redirects))
  try {
    await write({ "Skladniki/ITEM": "item" })
    assert.deepEqual((await loadLibrary(directory)).redirects, { "Skladniki/ITEM": "item" })
    await write({ "Skladniki/ITEM": "missing" })
    await assert.rejects(loadLibrary(directory), /Redirect to a missing page/)
    await write({ item: "item" })
    await assert.rejects(loadLibrary(directory), /shadows an existing page/)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("JSON source rejects malformed recipes and wrong game files", async () => {
  const { directory, recipe } = await fixture()
  try {
    const filename = path.join(directory, "recipes/dos2.json")
    await fs.writeFile(filename, JSON.stringify({ game: "dos2", recipes: [{ ...recipe, ingredients: [] }] }))
    await assert.rejects(loadLibrary(directory), /Invalid ingredients/)
    await fs.writeFile(filename, JSON.stringify({ game: "dos1", recipes: [recipe] }))
    await assert.rejects(loadLibrary(directory), /Wrong game/)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("repository JSON library is complete and independent of the removed Markdown directory", async () => {
  const library = await loadLibrary()
  assert.ok(library.pages.length > 0)
  assert.ok(library.pages.some((page) => page.slug === "wood-pile"))
  assert.ok(library.sources.dos1.length && library.sources.dos2.length && library.sources["dos2-overhaul"].length)
  await assert.rejects(fs.access("content"), /ENOENT/)
})

test("every recipe item link resolves to an item page", async () => {
  const library = await loadLibrary()
  const known = new Set(library.pages.map((page) => page.slug))
  for (const rows of Object.values(library.sources)) {
    for (const row of rows) {
      for (const item of [row.result, ...row.ingredients]) {
        if (item.slug) assert.ok(known.has(item.slug), `Missing recipe page: ${item.slug}`)
      }
    }
  }
})

test("mushroom pages use game names and inventory icons", async () => {
  const library = await loadLibrary()
  const icons = JSON.parse(await fs.readFile("data/itemIcons.json", "utf8"))
  const { resolveItemIcon } = await import("../main/domain/itemIcons")
  for (const [name, slug] of [
    ["Calocera", "calocera"],
    ["Boletus", "boletus"],
    ["Amethyst Deceiver", "amethyst-deceiver"],
  ]) {
    const page = library.pages.find((page) => page.slug === slug)
    assert.equal(page?.title, name)
    assert.ok(!library.pages.some((page) => page.title === `Mushroom ${name}`))
    const references = library.sources["dos2-overhaul"].flatMap((row) => [row.result, ...row.ingredients])
    const item = references.find((item) => item.slug === page?.slug)
    assert.equal(item?.name, name)
    assert.ok(item && resolveItemIcon(icons, "dos2-overhaul", item), name)
  }
})

test("the White Dye URL uses the actual White Fabric Dye name and inventory icon", async () => {
  const library = await loadLibrary()
  const page = library.pages.find((page) => page.slug === "white-fabric-dye")
  assert.equal(page?.title, "White Fabric Dye")
  const recipe = library.sources["dos2-overhaul"].find((row) => row.result.slug === page?.slug)
  assert.equal(recipe?.result.name, "White Fabric Dye")
  const sources = JSON.parse(await fs.readFile("data/itemIcons.provenance.json", "utf8"))
  assert.equal(sources["dos2-overhaul"].whitefabricdye?.icon, "Item_TOOL_Dye_White")
  const icons = JSON.parse(await fs.readFile("data/itemIcons.json", "utf8"))
  assert.ok(icons["dos2-overhaul"].whitefabricdye?.endsWith("/white-fabric-dye.webp"))
})

test("Branch bow and spear recipes belong to DOS1 and use the DOS1 branch icon", async () => {
  const library = await loadLibrary()
  const ids = ["Bron/BOW:Bowstring+Branch", "Bron/SPEAR:Dagger+Branch"]
  for (const id of ids) {
    assert.ok(library.sources.dos1.some((row) => row.id === id))
    assert.ok(!library.sources["dos2-overhaul"].some((row) => row.id === id))
  }
  assert.ok(
    !library.sources["dos2-overhaul"].some((row) =>
      [row.result, ...row.ingredients].some((item) => item.slug === "branch"),
    ),
  )
  const sources = JSON.parse(await fs.readFile("data/itemIcons.provenance.json", "utf8"))
  assert.equal(sources.dos1.branch?.icon, "Item_WPN_Branch_A")
  assert.equal(sources.dos1.branch?.template, "568ab219-039b-4200-a24b-d29c9500fe4f")
})

test("Big Tongs Roped Together retain both DOS2 recipes and use the game recipe preview icon", async () => {
  const library = await loadLibrary()
  const slug = "big-tongs-roped-together"
  const recipes = library.sources.dos2.filter((row) => row.result.slug === slug)
  assert.equal(recipes.length, 2)
  assert.ok(recipes.every((row) => row.result.name === "Big Tongs Roped Together"))
  assert.deepEqual(recipes.map((row) => row.ingredients.map((item) => item.name).sort()).sort(), [
    ["Cloth Scraps", "Tongs"],
    ["Leather Scraps", "Tongs"],
  ])
  const sources = JSON.parse(await fs.readFile("data/itemIcons.provenance.json", "utf8"))
  for (const game of ["dos2", "dos2-overhaul"]) {
    assert.equal(sources[game].bigtongsropedtogether?.icon, "Item_WPN_Common_Mace_2H_B")
    assert.equal(sources[game].bigtongsropedtogether?.stats, "WPN_CraftedMace_2H_B")
  }
})

test("source recipe files contain no duplicate ingredient combinations", async () => {
  const { sources } = await loadLibrary()
  for (const [game, recipes] of Object.entries(sources)) {
    assert.equal(expandSmallGroups(recipes, {}).length, recipes.length, `${game}: deduplicate the source JSON`)
  }
})

test("Elven Stew has one recipe preserving its effects and source", async () => {
  const { sources } = await loadLibrary()
  for (const recipes of [sources.dos2, [...sources.dos2, ...sources["dos2-overhaul"]]]) {
    const stew = recipes.filter((row) => row.result.slug === "elven-stew")
    assert.equal(stew.length, 1)
    assert.deepEqual(
      stew[0].ingredients.map((item) => item.name),
      ["Dinner", "Tomato Sauce"],
    )
    assert.equal(stew[0].notes, "Add 10% Heal, 1 Dexterity")
    assert.ok(stew[0].source.includes("main_sheet!A691:G691"))
  }
})

test("merged alias ingredients keep the localized catalog page", async () => {
  const { sources } = await loadLibrary()
  const cloth = sources.dos2.find((row) => row.id === "Skladniki/CLOTH-SCRAPS:Bed Linen+CuttingTool")!
  assert.equal(cloth.ingredients[1].name, "Cutting Tool")
  assert.equal(cloth.ingredients[1].slug, "cutting-tool")
  assert.equal(cloth.ingredients[1].namePl, "Narzędzie do krojenia")
  const pixie = sources.dos2.find((row) => row.result.slug === "pouch-of-superior-pixie-dust")!
  assert.equal(pixie.ingredients[1].name, "Pouch Of Superior Star Dust")
  assert.equal(pixie.ingredients[1].slug, "pouch-of-superior-star-dust")
  assert.equal(pixie.ingredients[1].namePl, "Sakiewka znakomitego gwiezdnego pyłu")
})

test("Jar of Honey has one recipe using the localized Empty Honey Jar, not its Jar alias", async () => {
  const { sources } = await loadLibrary()
  for (const recipes of [sources.dos2, [...sources.dos2, ...sources["dos2-overhaul"]]]) {
    const honey = recipes.filter((row) => row.result.slug === "jar-of-honey")
    assert.equal(honey.length, 1)
    assert.deepEqual(
      honey[0].ingredients.map((item) => item.name),
      ["Empty Honey Jar", "Beehive"],
    )
    assert.equal(honey[0].ingredients[0].namePl, "Słoik po miodzie")
    assert.equal(honey[0].notes, "Add 5% Heal, 1 Intelligence, 15% Poison Resist")
    assert.ok(honey[0].source.includes("main_sheet!A698:G698"))
  }
})

test("DOS1 crafting-level recipes stay out of Overhaul and mod silver arrowheads yield four", async () => {
  const { sources } = await loadLibrary()
  assert.ok(sources["dos2-overhaul"].every((row) => !/\b(?:Crafting|Blacksmithing) [1-5]\b/.test(row.requirements)))
  const dagger = sources.dos1.find((row) => row.id === "Narzedzia/DAGGER:Knife+Anvil")
  assert.equal(dagger?.requirements, "Blacksmithing 1")
  assert.ok(!sources.dos1.some((row) => row.source === "Crafting Overhaul"))
  const silver = sources["dos2-overhaul"].find(
    (row) => row.id === "Strzaly-i-granaty/SILVER-ARROWHEAD:Scrapper's Pickaxe+Silver Ore",
  )
  assert.equal(silver?.result.quantity, "x4")
})

test("audited DOS1 requirements and flask/chicken ingredients follow game definitions", async () => {
  const { sources } = await loadLibrary()
  for (const [name, ingredients, requirement] of [
    ["Explosive Arrowhead", ["Fire Arrowhead", "Cup of Oil"], "Crafting 2"],
    ["Large Iron Bar", ["Iron Bar", "Iron Bar"], ""],
    ["Lucky Rabbit Paw Belt", ["Rope", "Magical Lucky Rabbit Paw"], "Crafting 1"],
    ["Poorman's Best", ["Barrel", "Rope"], "Crafting 1"],
    ["Slowdown Arrow", ["Arrow Shaft", "Slowdown Arrowhead"], "Crafting 1"],
    ["Slowdown Arrowhead", ["Arrowhead", "Cup of Oil"], "Crafting 2"],
  ] as const) {
    const row = sources.dos1.find(
      (r) =>
        r.result.name === name &&
        r.ingredients
          .map((i) => i.name)
          .sort()
          .join("|") === [...ingredients].sort().join("|"),
    )
    assert.ok(row, name)
    assert.equal(row.requirements, requirement, name)
  }
  for (const name of ["Chicken Amulet", "Chicken Belt"])
    assert.ok(
      sources.dos1.find((r) => r.result.name === name)?.ingredients.some((i) => i.name === "Magical Chicken foot"),
    )
  const magicalFoot = sources.dos1.find((r) => r.result.name === "Magical Chicken foot")
  assert.ok(magicalFoot?.ingredients.some((i) => i.name === "Pixie Dust"))
  assert.equal(magicalFoot?.result.slug, "magical-chicken-foot")
  for (const row of sources.dos1.filter((r) => ["Oil Flask", "Poison Flask"].includes(r.result.name))) {
    assert.ok(row.ingredients.some((i) => i.name === "Empty Flask"))
    assert.ok(!row.ingredients.some((i) => i.name === "Empty Bottle"))
  }
})

test("audited DOS2 and Workshop recipes retain correct modes, stations, quantities and outputs", async () => {
  const { sources, pages } = await loadLibrary()
  assert.ok(sources.dos2.every((r) => !r.requirements))
  assert.ok(
    !sources.dos2.some(
      (r) => r.result.name === "Charming Arrowhead" && r.ingredients.some((i) => i.name === "Drudanae"),
    ),
  )
  assert.ok(
    sources.dos1.some(
      (r) => r.result.name === "Charming Arrowhead" && r.ingredients.some((i) => i.name === "Drudenae"),
    ),
  )
  for (const name of ["Cluster Grenade", "Thunderbolt Grenade", "Static Cloud Arrow"])
    assert.ok(
      sources.dos2.some((r) => r.result.name === name),
      `Preserve valid DOS2 ${name}`,
    )
  assert.ok(sources.dos1.some((r) => r.result.name === "Taser Grenade" && r.requirements === "Crafting 4"))
  const hair = sources.dos2.find(
    (r) =>
      r.result.name === "Thread" &&
      r.ingredients.length === 2 &&
      r.ingredients[0].name === "Hair" &&
      r.ingredients[1].name !== "Hair",
  )
  assert.equal(hair?.ingredients[1].name, "Spinning Wheel")
  assert.ok(
    sources.dos2
      .find((r) => r.result.name === "Shocking Touch Scroll")
      ?.ingredients.some((i) => i.selectorTag === "EssenceAir"),
  )
  assert.ok(
    !sources.dos2.find((r) => r.result.name === "Tainted Stew")?.ingredients.some((i) => i.name === "Cooking station"),
  )
  const cloth = sources["dos2-overhaul"].find(
    (r) =>
      r.result.name === "Cloth Scraps" && r.ingredients.map((i) => i.name).join("|") === "Thread|Thread|Spinning Wheel",
  )
  assert.equal(cloth?.result.quantity, "x2")
  const scythe = sources["dos2-overhaul"].find(
    (r) => r.ingredients.some((i) => i.name === "Shrieker Soul") && r.ingredients.some((i) => i.name === "Long Branch"),
  )
  assert.equal(scythe?.result.name, "Shrieker's Scythe")
  assert.equal(pages.find((p) => p.slug === scythe?.result.slug)?.title, "Shrieker's Scythe")
  assert.ok(sources["dos2-overhaul"].some((r) => r.result.name === "Crafter's Anvil"))
  assert.ok(sources["dos2-overhaul"].some((r) => r.result.name === "Crafted Barricade"))
  const icons = JSON.parse(await fs.readFile("data/itemIcons.json", "utf8"))
  assert.ok(icons.dos1.magicalchickenfoot)
  assert.ok(icons["dos2-overhaul"].shriekersscythe)
})

test("Workshop requires its crafted workbench and does not consume its own crafted result", async () => {
  const { sources } = await loadLibrary()
  for (const row of sources["dos2-overhaul"].filter((r) => r.ingredients.some((i) => i.name === "Workbench")))
    assert.ok(
      row.ingredients.some((i) => i.name === "Scrapper's Pickaxe"),
      row.id,
    )
  for (const name of ["Nails", "Needle", "Ghost Cape"])
    assert.ok(
      sources["dos2-overhaul"]
        .find((r) => r.result.name === name)
        ?.ingredients.some((i) => i.name === "Crafter's Workbench"),
      name,
    )
  const magic = sources["dos2-overhaul"].find((r) => r.result.name === "Magic Needle & Thread")!
  assert.equal(magic.ingredients.length, 2)
  assert.ok(!magic.ingredients.some((i) => i.name === magic.result.name))
  const cursed = sources["dos2-overhaul"].find((r) => r.result.name === "Cursed Frost Grenade")!
  assert.ok(cursed.ingredients.some((i) => i.name === "Frost Grenade"))
  assert.ok(!cursed.ingredients.some((i) => i.name === "Cursed Frost Grenade"))
})

test("DOS1 crafted quality names and scripted DOS2 interactions follow game rules", async () => {
  const { sources } = await loadLibrary()
  for (const [name, level] of [
    ["Homemade Shortbow", "Crafting 1"],
    ["Superior Longbow", "Crafting 5"],
    ["Superior Spear", "Crafting 5"],
    ["Superior Arbalest", "Crafting 5"],
  ])
    assert.ok(
      sources.dos1.some((r) => r.result.name === name && r.requirements === level),
      name,
    )
  assert.ok(!sources.dos2.some((r) => r.ingredients.length === 1 && r.ingredients[0].name === "Dreamer Pipe"))
  assert.ok(sources.dos2.some((r) => r.result.name === "Alertness Herbmix" && r.ingredients.length === 2))
  const statue = sources.dos2.find((r) => r.result.name === "Curious Angelic Statue")!
  assert.deepEqual(
    new Set(statue.ingredients.map((i) => i.name)),
    new Set(["Broken Angelic Statue", "Head of Angelic Statue"]),
  )
  assert.ok(!sources.dos2.some((r) => r.result.name === "Head of Angelic Statue"))
  for (const row of sources.dos2.filter((r) => r.result.name === "Glass of Wine"))
    assert.ok(row.ingredients.some((i) => i.name === "Empty Cup"))
})

test("recipe files carry upgrades separately and reject malformed ones", async () => {
  const { directory, recipe } = await fixture()
  const filename = path.join(directory, "recipes/dos2.json")
  const upgrade = {
    id: "shield:air",
    effect: { en: "Air Resistance" },
    target: { name: "Shield", tags: [] },
    targetTags: ["Typ/Pancerz/Tarcze"],
    tags: [],
    ingredients: [{ name: "Air Essence", tags: [] }],
    requirements: "",
    notes: "",
    remarks: "",
    source: "",
  }
  try {
    await fs.writeFile(filename, JSON.stringify({ game: "dos2", recipes: [recipe], upgrades: [upgrade] }))
    const library = await loadLibrary(directory)
    assert.deepEqual(library.upgrades.dos2, [upgrade])
    assert.deepEqual(library.upgrades.dos1, [])
    await fs.writeFile(
      filename,
      JSON.stringify({ game: "dos2", recipes: [recipe], upgrades: [{ ...upgrade, targetTags: [] }] }),
    )
    await assert.rejects(loadLibrary(directory), /Invalid upgrade target: shield:air/)
    await fs.writeFile(
      filename,
      JSON.stringify({ game: "dos2", recipes: [recipe], upgrades: [{ ...upgrade, effect: { en: "" } }] }),
    )
    await assert.rejects(loadLibrary(directory), /Invalid upgrade effect: shield:air/)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
