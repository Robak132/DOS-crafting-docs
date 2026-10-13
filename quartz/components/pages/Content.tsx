import { ComponentChildren } from "preact"
import { htmlToJsx } from "../../util/jsx"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { Element, Root, RootContent } from "hast"
import { toString } from "hast-util-to-string"
import { getCatalogData, OVERHAUL_SLUG, DOS2_SLUG } from "../recipeCatalog"
import { getItemCraftRoles } from "../recipeItemRoles"
import { parseItemQuantity } from "../recipeQuantity"
import { RecipeCatalog, RecipeRow } from "../recipes"
import { RecipeTable } from "../RecipeTable"
import { FullSlug, resolveRelative } from "../../util/path"
import { itemNameKeys, recipeUsesItem, uniqueItemEffects, uniqueItemRemarks } from "../recipeView"
import style from "../styles/recipeTable.scss"

const CATALOG_META: { id: RecipeCatalog; label: string; slug: FullSlug }[] = [
  { id: "dos1", label: "DOS1", slug: "receptury" as FullSlug },
  { id: "dos2", label: "DOS2", slug: DOS2_SLUG as FullSlug },
  { id: "dos2-overhaul", label: "DOS2 – Crafting Overhaul", slug: OVERHAUL_SLUG as FullSlug },
]

const sectionCatalogs: Record<string, RecipeCatalog> = {
  DOS1: "dos1",
  DOS2: "dos2",
  "DOS2 – Crafting Overhaul": "dos2-overhaul",
  "DOS2 - Crafting Overhaul": "dos2-overhaul",
}

function renderCatalogTables(
  currentSlug: FullSlug,
  entries: { label: string; slug: FullSlug; recipes: RecipeRow[]; labels: Record<string, string> }[],
  itemRoles: ReturnType<typeof getItemCraftRoles>,
) {
  return entries.map(({ label, slug, recipes, labels }) => (
    <div class="recipe-item-catalog">
      <h3>{label}</h3>
      <RecipeTable
        recipes={recipes}
        slug={currentSlug}
        labels={labels}
        catalogSlug={slug}
        showRequirements={slug !== OVERHAUL_SLUG && slug !== DOS2_SLUG}
        itemRoles={itemRoles}
      />
    </div>
  ))
}

const Content: QuartzComponent = ({ fileData, tree, allFiles }: QuartzComponentProps) => {
  let content = htmlToJsx(fileData.filePath!, tree) as ComponentChildren
  let insertedCraftInline = false
  const itemRoles =
    fileData.frontmatter?.itemPage === true ? getItemCraftRoles(allFiles) : ({} as ReturnType<typeof getItemCraftRoles>)

  if (fileData.frontmatter?.itemPage === true && tree.type === "root") {
    let catalog: RecipeCatalog | null = null
    let inserted = false
    const countLinks = (node: RootContent | Element): number =>
      node.type === "element"
        ? (node.tagName === "a" ? 1 : 0) + node.children.reduce((sum, child) => sum + countLinks(child), 0)
        : 0

    let skippedItemTitle = false
    content = (tree as Root).children.map((node) => {
      // Tytuł przedmiotu renderuje ArticleTitle (EN/PL) — pomiń zduplikowane H1 z markdown.
      if (!skippedItemTitle && node.type === "element" && node.tagName === "h1") {
        skippedItemTitle = true
        return null
      }
      if (node.type === "element" && /^h[1-6]$/.test(node.tagName)) {
        catalog = sectionCatalogs[toString(node).trim()] ?? null
        inserted = false
      }
      if (catalog && node.type === "element") {
        const recipes = getCatalogData(allFiles, catalog).recipes.filter(
          (recipe) => recipe.result.slug === fileData.slug,
        )
        if (recipes.length && node.tagName === "p" && countLinks(node) >= 2 && /[+=]/.test(toString(node))) {
          if (inserted) return null
          inserted = true
          insertedCraftInline = true
          const data = getCatalogData(allFiles, catalog)
          const labels = Object.fromEntries(data.tags.map((tag) => [tag.tag, tag.label ?? tag.tag]))
          const meta = CATALOG_META.find((entry) => entry.id === catalog)!
          return (
            <RecipeTable
              recipes={recipes}
              slug={fileData.slug! as FullSlug}
              labels={labels}
              catalogSlug={meta.slug}
              showRequirements={catalog === "dos1"}
              itemRoles={itemRoles}
            />
          )
        }
        if (inserted && node.tagName === "ul" && /^(Wymagania|Uwagi|Źródło):/.test(toString(node))) return null
      }
      return htmlToJsx(fileData.filePath!, { type: "root", children: [node] } as Root) as ComponentChildren
    })
  }

  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const classString = ["popover-hint", ...classes].join(" ")

  if (fileData.frontmatter?.itemPage !== true || !fileData.slug) {
    return <article class={classString}>{content}</article>
  }

  const currentSlug = fileData.slug as FullSlug
  const title = (fileData.frontmatter?.title as string | undefined) ?? currentSlug.split("/").at(-1) ?? currentSlug
  const titleParsed = parseItemQuantity(title)
  const titleBaseLeaf = titleParsed.base.includes("/")
    ? (titleParsed.base.split("/").at(-1) ?? titleParsed.base)
    : titleParsed.base
  const nameKeys = itemNameKeys(title, titleBaseLeaf, currentSlug.split("/").at(-1))
  const baseNameKeys = itemNameKeys(titleBaseLeaf)

  const isCraftResult = (recipe: RecipeRow) => {
    if (recipe.result.slug === currentSlug) return true
    // Strona „Foo (x2 or x3)” — receptury trafiają na bazowy Foo; pokaż je też tutaj.
    if (titleParsed.quantities.length === 0 || !recipe.result.quantity) return false
    const resultKeys = itemNameKeys(recipe.result.name, recipe.result.namePl)
    return [...baseNameKeys].some((key) => resultKeys.has(key))
  }

  const craftEntries = CATALOG_META.map(({ id, label, slug }) => {
    const data = getCatalogData(allFiles, id)
    const recipes = data.recipes.filter(isCraftResult)
    if (recipes.length === 0) return null
    return {
      label,
      slug,
      recipes,
      labels: Object.fromEntries(data.tags.map((tag) => [tag.tag, tag.label ?? tag.tag])),
    }
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  const usedEntries = CATALOG_META.map(({ id, label, slug }) => {
    const data = getCatalogData(allFiles, id)
    const recipes = data.recipes.filter((recipe) => recipeUsesItem(recipe, currentSlug, nameKeys))
    if (recipes.length === 0) return null
    return {
      label,
      slug,
      recipes,
      labels: Object.fromEntries(data.tags.map((tag) => [tag.tag, tag.label ?? tag.tag])),
    }
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  const allCraftRecipes = craftEntries.flatMap((entry) => entry.recipes)
  const effects = uniqueItemEffects(allCraftRecipes)
  const remarks = uniqueItemRemarks(allCraftRecipes)
  const effectsCatalog = craftEntries[0]?.slug ?? ("receptury" as FullSlug)

  return (
    <article class={classString}>
      {content}
      <section class="recipe-item-sections">
        <div class="recipe-item-section recipe-item-effects-section">
          <h2>Co daje</h2>
          {effects.length > 0 ? (
            <ul class="recipe-item-effects">
              {effects.map((effect) => (
                <li>
                  <a
                    class="internal recipe-effect-chip"
                    data-no-popover="true"
                    href={`${resolveRelative(currentSlug, effectsCatalog)}?as=result&q=${encodeURIComponent(effect)}`}
                  >
                    {effect}
                  </a>
                </li>
              ))}
            </ul>
          ) : craftEntries.length > 0 ? (
            <p class="recipe-empty-state">Brak opisanych efektów w znanych recepturach.</p>
          ) : (
            <p class="recipe-empty-state">Brak danych o efektach — przedmiot nie ma znanej receptury wytworzenia.</p>
          )}
        </div>
        {(remarks.length > 0 || craftEntries.length > 0) && (
          <div class="recipe-item-section recipe-item-remarks-section">
            <h2>Uwagi</h2>
            {remarks.length > 0 ? (
              <ul class="recipe-item-remarks">
                {remarks.map((remark) => (
                  <li>{remark}</li>
                ))}
              </ul>
            ) : (
              <p class="recipe-empty-state">Brak dodatkowych uwag do craftingu.</p>
            )}
          </div>
        )}
        {!insertedCraftInline && (
          <div class="recipe-item-section">
            <h2>Jak craftować</h2>
            {craftEntries.length > 0 ? (
              renderCatalogTables(currentSlug, craftEntries, itemRoles)
            ) : (
              <p class="recipe-empty-state">Brak znanej receptury wytworzenia tego przedmiotu.</p>
            )}
          </div>
        )}
        <div class="recipe-item-section">
          <h2>Używane w craftingu</h2>
          {usedEntries.length > 0 ? (
            renderCatalogTables(currentSlug, usedEntries, itemRoles)
          ) : (
            <p class="recipe-empty-state">Ten przedmiot nie występuje jako składnik w znanych recepturach.</p>
          )}
        </div>
      </section>
    </article>
  )
}
Content.css = style

export default (() => Content) satisfies QuartzComponentConstructor
