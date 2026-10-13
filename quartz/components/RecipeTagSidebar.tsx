import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { getAllCatalogsData, getCatalogData, getRecipeCatalog, isRecipePage, OVERHAUL_SLUG, DOS2_SLUG } from "./recipeCatalog"
import {
  CRAFTING_MAX_LEVELS,
  groupRecipeTags,
  groupRequirementStats,
  matchesCraftingMax,
  recipeCatalogSlug,
} from "./recipeView"
import { FullSlug, resolveRelative } from "../util/path"
import style from "./styles/recipeTable.scss"
// @ts-ignore
import script from "./scripts/recipeSidebar.inline"

export default (() => {
  const prettifyLabel = (value: string): string => value.replaceAll("-", " ")
  const getTagParts = (tag: string): string[] => tag.split("/").filter(Boolean)
  const formatHierarchyLabel = (tag: string): string => {
    const parts = getTagParts(tag)
    return prettifyLabel(parts[parts.length - 1] ?? tag)
  }
  const getTagConnector = (tag: string): string => {
    const depth = Math.max(0, getTagParts(tag).length - 1)
    return depth > 0 ? "↳ ".repeat(depth) : ""
  }
  const getTagDepth = (tag: string): number => Math.max(0, tag.split("/").filter(Boolean).length - 1)

  const RecipeTagSidebar: QuartzComponent = ({ allFiles, displayClass, fileData }: QuartzComponentProps) => {
    const filterPage = isRecipePage(fileData.slug)
    const catalog = filterPage ? getRecipeCatalog(allFiles, fileData.slug) : getAllCatalogsData(allFiles)
    const { tags, requirements, recipes, selectors } = catalog
    const tagGroups = groupRecipeTags(tags)
    const pageTags = fileData.frontmatter?.tags ?? []
    const overhaulPage =
      fileData.slug === DOS2_SLUG ||
      fileData.slug === OVERHAUL_SLUG ||
      ((pageTags.includes("DOS2-CO") || pageTags.includes("DOS2")) && !pageTags.includes("DOS1"))
    const showRequirements = !overhaulPage && requirements.some((req) => req.tag !== "-")
    const preferred = recipeCatalogSlug("", fileData.frontmatter?.tags ?? [])
    const dos1Href = resolveRelative(fileData.slug! as FullSlug, "receptury" as FullSlug)
    const filterHref = (value: string, kind: "tag" | "requirement" | "craftingMax" | "selector") => {
      if (kind === "craftingMax") {
        return `${dos1Href}?craftingMax=${encodeURIComponent(value)}`
      }
      if (kind === "selector") {
        const catalogSlug = [preferred, DOS2_SLUG, OVERHAUL_SLUG, "receptury"].find((slug) =>
          getRecipeCatalog(allFiles, slug).selectors.some((stat) => stat.tag === value && stat.count > 0),
        )
        if (!catalogSlug) throw new Error(`Brak katalogu dla selektora ${value}`)
        return `${resolveRelative(fileData.slug! as FullSlug, catalogSlug as FullSlug)}?selector=${encodeURIComponent(value)}`
      }
      const field = kind === "tag" ? "tags" : "requirements"
      const catalogSlug = [preferred, DOS2_SLUG, OVERHAUL_SLUG, "receptury"].find((slug) =>
        getRecipeCatalog(allFiles, slug)[field].some((stat) => stat.tag === value && stat.count > 0),
      )
      if (!catalogSlug) throw new Error(`Brak katalogu dla filtra ${value}`)
      return `${resolveRelative(fileData.slug! as FullSlug, catalogSlug as FullSlug)}?${kind}=${encodeURIComponent(value)}`
    }
    const dos1Recipes = filterPage && fileData.slug === "receptury" ? recipes : getCatalogData(allFiles, "dos1").recipes
    const craftingMaxCounts = showRequirements
      ? CRAFTING_MAX_LEVELS.map((level) => ({
          level,
          count: dos1Recipes.filter((recipe) => matchesCraftingMax(recipe.requirements ?? "", level)).length,
        }))
      : []
    const categoryPages = allFiles
      .filter((file) => file.frontmatter?.categoryPage === true)
      .sort((a, b) => (a.frontmatter?.title ?? "").localeCompare(b.frontmatter?.title ?? "", "pl"))
    const categoryLabels = new Map(
      categoryPages.flatMap((file) =>
        (file.frontmatter?.tags ?? []).map((tag) => [tag, file.frontmatter?.title ?? tag] as const),
      ),
    )

    if (tags.length === 0) {
      return null
    }

    return (
      <div class={classNames(displayClass, "recipe-sidebar")}>
        <div class="recipe-sidebar-nav">
          <a
            class="internal recipe-nav-link"
            href={resolveRelative(fileData.slug! as FullSlug, "receptury" as FullSlug)}
            data-no-popover="true"
          >
            DOS1 – Receptury
          </a>
          <a
            class="internal recipe-nav-link"
            href={resolveRelative(fileData.slug! as FullSlug, DOS2_SLUG as FullSlug)}
            data-no-popover="true"
          >
            DOS2 – Receptury
          </a>
          <a
            class="internal recipe-nav-link"
            href={resolveRelative(fileData.slug! as FullSlug, OVERHAUL_SLUG as FullSlug)}
            data-no-popover="true"
          >
            DOS2 – Crafting Overhaul
          </a>
        </div>
        <details class="recipe-sidebar-filters" open>
          <summary>Filtry przedmiotów</summary>
          <div class="recipe-sidebar-content">
            <div class="recipe-active-filters top">
              <span class="recipe-filters-label"></span>
              <button type="button" class="recipe-reset-btn" style="display: none;">
                Resetuj
              </button>
            </div>
            {showRequirements && (
              <div class="recipe-sidebar-section">
                <div class="recipe-sidebar-header">
                  <h3>MÓJ CRAFTING</h3>
                </div>
                <div class="recipe-tag-list crafting-max-list">
                  {craftingMaxCounts.map(({ level, count }) => {
                    const Control = filterPage ? "button" : "a"
                    return (
                      <Control
                        type={filterPage ? "button" : undefined}
                        href={filterPage ? undefined : filterHref(String(level), "craftingMax")}
                        class={`recipe-tag-button crafting-max-button${filterPage ? "" : " internal"}`}
                        data-no-popover="true"
                        data-crafting-max={level}
                        data-state="neutral"
                      >
                        <span class="recipe-tag-name">≤ {level}</span>
                        <span class="recipe-tag-count">({count})</span>
                      </Control>
                    )
                  })}
                </div>
                <div class="recipe-sidebar-header">
                  <h3>WYMAGANIA</h3>
                </div>
                {groupRequirementStats(requirements).map((group) => (
                  <div class="recipe-requirement-group">
                    <div class="recipe-requirement-group-label">{group.label}</div>
                    <div class="recipe-tag-list requirements-list">
                      {group.items.map((req) => {
                        const Control = filterPage ? "button" : "a"
                        return (
                          <Control
                            type={filterPage ? "button" : undefined}
                            href={filterPage ? undefined : filterHref(req.tag, "requirement")}
                            class={`recipe-tag-button requirement-button${filterPage ? "" : " internal"}`}
                            data-no-popover="true"
                            data-requirement={req.tag}
                            data-state="neutral"
                          >
                            <span class="recipe-tag-name">
                              {req.tag === "-" ? "Brak" : prettifyLabel(req.tag)}
                            </span>
                            <span class="recipe-tag-count">({req.count})</span>
                          </Control>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectors.length > 0 && (
              <details class="recipe-tag-group recipe-selector-group">
                <summary>Grupy składników</summary>
                <div class="recipe-tag-list">
                  {selectors.map((sel) => {
                    const Control = filterPage ? "button" : "a"
                    return (
                      <Control
                        type={filterPage ? "button" : undefined}
                        href={filterPage ? undefined : filterHref(sel.tag, "selector")}
                        class={`recipe-tag-button selector-button${filterPage ? "" : " internal"}`}
                        data-no-popover="true"
                        data-selector={sel.tag}
                        data-state="neutral"
                      >
                        <span class="recipe-tag-name">#{prettifyLabel(sel.label ?? sel.tag)}</span>
                        <span class="recipe-tag-count">({sel.count})</span>
                      </Control>
                    )
                  })}
                </div>
              </details>
            )}
            <div class="recipe-sidebar-header">
              <h3>TAGI</h3>
            </div>
            {tagGroups.map((group) => (
              <details class="recipe-tag-group" open={group.label === "Kategorie"}>
                <summary>{group.label}</summary>
                <div class="recipe-tag-list">
                  {group.tags.map((tag) => {
                    const Control = filterPage ? "button" : "a"
                    return (
                      <Control
                        type={filterPage ? "button" : undefined}
                        href={filterPage ? undefined : filterHref(tag.tag, "tag")}
                        class={`recipe-tag-button tag-hierarchy${filterPage ? "" : " internal"}`}
                        data-no-popover="true"
                        data-tag={tag.tag}
                        data-state="neutral"
                        style={`--tag-depth: ${Math.max(0, getTagDepth(tag.tag) - (tag.tag.startsWith("Typ/") ? 1 : 0))};`}
                      >
                        <span class="recipe-tag-name">
                          {!tag.tag.startsWith("Typ/") && (
                            <span class="recipe-tag-connector">{getTagConnector(tag.tag)}</span>
                          )}
                          {prettifyLabel(categoryLabels.get(tag.tag) ?? tag.label ?? formatHierarchyLabel(tag.tag))}
                        </span>
                        <span class="recipe-tag-count">({tag.count})</span>
                      </Control>
                    )
                  })}
                </div>
              </details>
            ))}
          </div>
        </details>
      </div>
    )
  }

  RecipeTagSidebar.css = style
  RecipeTagSidebar.afterDOMLoaded = script

  return RecipeTagSidebar
}) satisfies QuartzComponentConstructor
