import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { getCatalogData, getRecipeCatalog, isRecipePage, OVERHAUL_SLUG, DOS2_SLUG } from "./recipeCatalog"
import { groupRecipeTags, recipeCatalogSlug } from "./recipeView"
import type { RecipeData, TagStat } from "./recipes"
import { FullSlug, resolveRelative } from "../util/path"
import style from "./styles/recipeTable.scss"
// @ts-ignore
import script from "./scripts/recipeSidebar.inline"

export default (() => {
  const cache = new WeakMap<QuartzComponentProps["allFiles"], RecipeData>()
  const combinedData = (allFiles: QuartzComponentProps["allFiles"]): RecipeData => {
    const cached = cache.get(allFiles)
    if (cached) return cached
    const catalogs = [
      getCatalogData(allFiles, "dos1"),
      getCatalogData(allFiles, "dos2"),
      getCatalogData(allFiles, "dos2-overhaul"),
    ]
    const combine = (field: "tags" | "requirements") => {
      const entries = new Map<string, TagStat>()
      for (const catalog of catalogs)
        for (const stat of catalog[field]) {
          const previous = entries.get(stat.tag)
          entries.set(stat.tag, { ...stat, count: stat.count + (previous?.count ?? 0) })
        }
      return [...entries.values()].sort((a, b) => (a.label ?? a.tag).localeCompare(b.label ?? b.tag, "pl"))
    }
    const data = {
      recipes: catalogs.flatMap((data) => data.recipes),
      tags: combine("tags"),
      requirements: combine("requirements"),
    }
    cache.set(allFiles, data)
    return data
  }
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
    const { tags, requirements } = filterPage ? getRecipeCatalog(allFiles, fileData.slug) : combinedData(allFiles)
    const tagGroups = groupRecipeTags(tags)
    const pageTags = fileData.frontmatter?.tags ?? []
    const overhaulPage =
      fileData.slug === DOS2_SLUG ||
      fileData.slug === OVERHAUL_SLUG ||
      ((pageTags.includes("DOS2-CO") || pageTags.includes("DOS2")) && !pageTags.includes("DOS1"))
    const showRequirements = !overhaulPage && requirements.some((req) => req.tag !== "-")
    const preferred = recipeCatalogSlug("", fileData.frontmatter?.tags ?? [])
    const filterHref = (value: string, kind: "tag" | "requirement") => {
      const field = kind === "tag" ? "tags" : "requirements"
      const catalog = [preferred, DOS2_SLUG, OVERHAUL_SLUG, "receptury"].find((slug) =>
        getRecipeCatalog(allFiles, slug)[field].some((stat) => stat.tag === value && stat.count > 0),
      )
      if (!catalog) throw new Error(`Brak katalogu dla filtra ${value}`)
      return `${resolveRelative(fileData.slug! as FullSlug, catalog as FullSlug)}?${kind}=${encodeURIComponent(value)}`
    }
    const itemIndex = allFiles.find(
      (file) => file.frontmatter?.title === "Przedmioty" && file.frontmatter?.tags?.includes("index"),
    )
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
          <a
            class="internal recipe-nav-link"
            href={resolveRelative(fileData.slug! as FullSlug, itemIndex?.slug ?? ("Przedmioty" as FullSlug))}
            data-no-popover="true"
          >
            Przedmioty
          </a>
        </div>
        <details class="recipe-sidebar-filters" open>
          <summary>Filtry przepisów</summary>
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
                  <h3>WYMAGANIA</h3>
                </div>
                <div class="recipe-tag-list requirements-list">
                  {requirements.map((req) => {
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
                        <span class="recipe-tag-name">{req.tag === "-" ? "Brak" : prettifyLabel(req.tag)}</span>
                        <span class="recipe-tag-count">({req.count})</span>
                      </Control>
                    )
                  })}
                </div>
              </div>
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
        {categoryPages.length > 0 && (
          <details class="recipe-category-navigation">
            <summary>Przedmioty według kategorii</summary>
            <nav class="recipe-category-links" aria-label="Kategorie przedmiotów">
              {categoryPages.map((page) => (
                <a
                  class="internal"
                  href={resolveRelative(fileData.slug! as FullSlug, page.slug! as FullSlug)}
                  data-no-popover="true"
                >
                  {page.frontmatter?.title}
                </a>
              ))}
            </nav>
          </details>
        )}
      </div>
    )
  }

  RecipeTagSidebar.css = style
  RecipeTagSidebar.afterDOMLoaded = script

  return RecipeTagSidebar
}) satisfies QuartzComponentConstructor
