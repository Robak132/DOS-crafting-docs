import { groupRecipes, matchesRecipeQuery, recipeColumns, tagLabel, visibleRecipeTags } from "../recipeView"
import type { RecipeItem, RecipeRow } from "../recipes"
;(() => {
  const STORAGE_INCLUDE = "wfrp_filter_include"
  const STORAGE_EXCLUDE = "wfrp_filter_exclude"
  const STORAGE_REQUIREMENTS = "wfrp_filter_requirements"
  const STORAGE_REQUIREMENTS_EXCLUDE = "wfrp_filter_requirements_exclude"
  type TagState = "neutral" | "include" | "exclude"

  interface RecipeData {
    recipes: RecipeRow[]
    labels: Record<string, string>
  }

  type FilterState = {
    include: string[]
    exclude: string[]
    requirements: string[]
    requirementsExclude: string[]
  }

  let parsedData: RecipeData | null = null

  function storageKey(key: string): string {
    return document.querySelector<HTMLElement>(".recipe-app")?.dataset.catalog === "dos2" ? `dos2_${key}` : key
  }

  function splitCsv(value: string | null): string[] {
    return value ? value.split(",").filter(Boolean) : []
  }

  function readStoredFilters(): FilterState {
    try {
      return {
        include: splitCsv(sessionStorage.getItem(storageKey(STORAGE_INCLUDE))),
        exclude: splitCsv(sessionStorage.getItem(storageKey(STORAGE_EXCLUDE))),
        requirements: splitCsv(sessionStorage.getItem(storageKey(STORAGE_REQUIREMENTS))),
        requirementsExclude: splitCsv(sessionStorage.getItem(storageKey(STORAGE_REQUIREMENTS_EXCLUDE))),
      }
    } catch {
      return { include: [], exclude: [], requirements: [], requirementsExclude: [] }
    }
  }

  function writeStoredFilters(
    include: string[],
    exclude: string[],
    requirements: string[],
    requirementsExclude: string[],
  ) {
    if (include.length > 0 || exclude.length > 0 || requirements.length > 0 || requirementsExclude.length > 0) {
      sessionStorage.setItem(storageKey(STORAGE_INCLUDE), include.join(","))
      sessionStorage.setItem(storageKey(STORAGE_EXCLUDE), exclude.join(","))
      sessionStorage.setItem(storageKey(STORAGE_REQUIREMENTS), requirements.join(","))
      sessionStorage.setItem(storageKey(STORAGE_REQUIREMENTS_EXCLUDE), requirementsExclude.join(","))
    } else {
      sessionStorage.removeItem(storageKey(STORAGE_INCLUDE))
      sessionStorage.removeItem(storageKey(STORAGE_EXCLUDE))
      sessionStorage.removeItem(storageKey(STORAGE_REQUIREMENTS))
      sessionStorage.removeItem(storageKey(STORAGE_REQUIREMENTS_EXCLUDE))
    }
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  }

  function buildRelativeHref(slug: string): string {
    const normalized = slug.replace(/^\/+/, "")
    if (!normalized || normalized === "index") return "./"
    return `./${normalized}`
  }

  function renderItem(item: RecipeItem): string {
    if (item.selectorTag) {
      return `<button type="button" class="recipe-item recipe-ingredient-tag" data-search-tag="${escapeHtml(item.selectorTag)}">${escapeHtml(item.name)}</button>`
    }
    if (!item.slug) {
      return `<span class="recipe-item">${escapeHtml(item.name)}</span>`
    }
    return `<a class="internal recipe-item" href="${escapeHtml(buildRelativeHref(item.slug))}">${escapeHtml(item.name)}</a>`
  }

  function buildRecipeHtml(group: { result: RecipeItem; variants: RecipeRow[] }): string {
    return group.variants
      .map((variant, index) => {
        const ingredients = `<ul class="recipe-ingredients">${variant.ingredients.map((item) => `<li>${renderItem(item)}</li>`).join("")}</ul>`
        const tags = visibleRecipeTags(variant.tags)
          .map(
            (tag) =>
              `<button type="button" class="recipe-search-tag" data-search-tag="${escapeHtml(tag)}">${escapeHtml(tagLabel(tag, parsedData?.labels ?? {}))}</button>`,
          )
          .join("")
        const requirements = variant.requirements?.trim()
        const notes = variant.notes?.trim()
        const resultCell =
          index === 0
            ? `<td class="recipe-cell result" rowspan="${group.variants.length}">${renderItem(group.result)}</td>`
            : ""

        const rowClass = [
          index === 0 ? "recipe-group-start" : "recipe-group-inner",
          index === group.variants.length - 1 ? "recipe-group-end" : "",
        ]
          .filter(Boolean)
          .join(" ")
        return `<tr data-recipe-id="${escapeHtml(group.result.slug ?? group.result.name)}" class="${rowClass}">
          <td class="recipe-cell ingredients">${ingredients}</td>
          ${resultCell}
          <td class="recipe-cell meta">${requirements ? escapeHtml(requirements) : `<span class="recipe-empty">—</span>`}</td>
          <td class="recipe-cell meta">${notes ? escapeHtml(notes) : `<span class="recipe-empty">—</span>`}</td>
          <td class="recipe-cell tags"><div class="recipe-row-tags">${tags}</div></td>
          <td class="recipe-cell meta source">${variant.source ? escapeHtml(variant.source) : `<span class="recipe-empty">—</span>`}</td>
        </tr>`
      })
      .join("")
  }

  function matchesTag(tags: string[], target: string): boolean {
    return tags.some((tag) => tag === target || tag.startsWith(target + "/"))
  }

  function requirementTokens(value: string): string[] {
    const tokens = value
      .split(";")
      .map((val) => val.trim().toLowerCase())
      .filter(Boolean)
    return tokens.length > 0 ? tokens : ["-"]
  }

  function applyFilters(
    recipes: RecipeRow[],
    include: string[],
    exclude: string[],
    requirements: string[],
    requirementsExclude: string[],
    query: string,
    tableBody: HTMLElement,
    countLabel: HTMLElement | null,
  ) {
    const requirementSet = requirements.map((req) => req.toLowerCase())
    const requirementExcludeSet = requirementsExclude.map((req) => req.toLowerCase())

    const filtered = recipes.filter((recipe) => {
      const candidateTags = recipe.tags
      const hasAllInclude = include.every((incTag) => matchesTag(candidateTags, incTag))
      const hasNoExclude = !exclude.some((excTag) => matchesTag(candidateTags, excTag))
      const reqTokens = requirementTokens(recipe.requirements ?? "")
      const matchesRequirements =
        requirementSet.length === 0 ? true : reqTokens.some((token) => requirementSet.includes(token))
      const matchesExcludedRequirements =
        requirementExcludeSet.length === 0 ? false : reqTokens.some((token) => requirementExcludeSet.includes(token))

      if (include.length > 0 && !hasAllInclude) return false
      if (!hasNoExclude) return false
      if (!matchesRequirements) return false
      if (matchesExcludedRequirements) return false

      return matchesRecipeQuery(recipe, query, parsedData?.labels ?? {})
    })

    const grouped = groupRecipes(filtered)
    tableBody.innerHTML =
      grouped.length > 0
        ? grouped.map(buildRecipeHtml).join("")
        : `<tr><td colspan="${recipeColumns.length}" class="recipe-empty">Brak przepisów pasujących do filtrów.</td></tr>`
    countLabel && (countLabel.textContent = `Wyników: ${grouped.length}`)
    document.dispatchEvent(new CustomEvent("contentChanged", { detail: {} }))
  }

  function updateFilterLabel(
    include: string[],
    exclude: string[],
    requirements: string[],
    requirementsExclude: string[],
    label: HTMLElement | null,
  ) {
    if (!label) return
    if (include.length === 0 && exclude.length === 0 && requirements.length === 0 && requirementsExclude.length === 0) {
      label.textContent = ""
      return
    }
    const includeText = include.length > 0 ? include.join(", ") : ""
    const excludeText = exclude.length > 0 ? "bez: " + exclude.join(", ") : ""
    const reqText =
      requirements.length > 0 ? "wym: " + requirements.map((req) => (req === "-" ? "Brak" : req)).join(", ") : ""
    const reqExcludeText =
      requirementsExclude.length > 0
        ? "bez wym: " + requirementsExclude.map((req) => (req === "-" ? "Brak" : req)).join(", ")
        : ""
    label.textContent = [includeText, excludeText, reqText, reqExcludeText].filter(Boolean).join(" | ")
  }

  function setupRecipeTable() {
    const dataScript = document.getElementById("recipe-table-data")
    const tableBody = document.querySelector<HTMLElement>(".recipe-table-body")
    const root = document.querySelector<HTMLElement>(".recipe-app")
    const tagButtons = document.querySelectorAll<HTMLButtonElement>(".recipe-tag-button:not(.requirement-button)")
    const requirementButtons = document.querySelectorAll<HTMLButtonElement>(".requirement-button")
    const resetBtn = document.querySelector<HTMLButtonElement>(".recipe-reset-btn")
    const filterLabel = document.querySelector<HTMLElement>(".recipe-filters-label")
    const searchInput = document.querySelector<HTMLInputElement>(".recipe-search-input")
    const countLabel = document.querySelector<HTMLElement>(".recipe-results-count")

    if (!dataScript || !tableBody || !root) {
      parsedData = null
      return
    }

    const previousCleanup = (root as any).recipeTableCleanup
    if (typeof previousCleanup === "function") {
      previousCleanup()
    }

    try {
      parsedData = JSON.parse(dataScript.textContent || "{}")
    } catch (e) {
      console.error("RecipeTable: failed to parse data", e)
      return
    }

    if (!parsedData || !Array.isArray(parsedData.recipes)) {
      return
    }

    const tagStates = new Map<string, TagState>()
    const requirementStates = new Map<string, TagState>()
    const params = new URLSearchParams(window.location.search)
    const queryTag = params.get("tag")
    const queryRequirement = params.get("requirement")
    const stored =
      queryTag || queryRequirement
        ? {
            include: [],
            exclude: [],
            requirements: queryRequirement ? [queryRequirement] : [],
            requirementsExclude: [],
          }
        : readStoredFilters()
    if (searchInput && queryTag) searchInput.value = `#${queryTag}`

    tagButtons.forEach((btn) => {
      const tag = btn.dataset.tag
      if (!tag) return
      let state: TagState = "neutral"
      if (stored.include.includes(tag)) {
        state = "include"
        tagStates.set(tag, "include")
      } else if (stored.exclude.includes(tag)) {
        state = "exclude"
        tagStates.set(tag, "exclude")
      }
      btn.dataset.state = state
    })

    requirementButtons.forEach((btn) => {
      const req = btn.dataset.requirement
      if (!req) return
      let state: TagState = "neutral"
      if (stored.requirements.includes(req)) {
        state = "include"
        requirementStates.set(req, "include")
      } else if (stored.requirementsExclude.includes(req)) {
        state = "exclude"
        requirementStates.set(req, "exclude")
      }
      btn.dataset.state = state
    })

    const applyFromState = () => {
      const include: string[] = []
      const exclude: string[] = []
      const requirements: string[] = []
      const requirementsExclude: string[] = []
      tagStates.forEach((state, tag) => {
        if (state === "include") include.push(tag)
        if (state === "exclude") exclude.push(tag)
      })
      requirementStates.forEach((state, req) => {
        if (state === "include") requirements.push(req)
        if (state === "exclude") requirementsExclude.push(req)
      })

      writeStoredFilters(include, exclude, requirements, requirementsExclude)
      updateFilterLabel(include, exclude, requirements, requirementsExclude, filterLabel)
      const query = searchInput?.value ?? ""
      applyFilters(
        parsedData!.recipes,
        include,
        exclude,
        requirements,
        requirementsExclude,
        query,
        tableBody,
        countLabel,
      )

      if (resetBtn) {
        resetBtn.style.display =
          include.length > 0 || exclude.length > 0 || requirements.length > 0 || requirementsExclude.length > 0
            ? "inline-flex"
            : "none"
      }
    }

    const cleanupHandlers: Array<() => void> = []
    const onTagClick = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-search-tag]") : null
      if (!target?.dataset.searchTag || !searchInput) return
      searchInput.value = `#${target.dataset.searchTag}`
      applyFromState()
    }
    root.addEventListener("click", onTagClick)
    cleanupHandlers.push(() => root.removeEventListener("click", onTagClick))

    tagButtons.forEach((btn) => {
      const handler = () => {
        const tag = btn.dataset.tag
        if (!tag) return
        const current = btn.dataset.state ?? "neutral"
        let next: TagState = "neutral"
        if (current === "neutral") {
          next = "include"
        } else if (current === "include") {
          next = "exclude"
        }

        btn.dataset.state = next
        if (next === "neutral") {
          tagStates.delete(tag)
        } else {
          tagStates.set(tag, next)
        }
        applyFromState()
      }
      btn.addEventListener("click", handler)
      cleanupHandlers.push(() => btn.removeEventListener("click", handler))
    })

    requirementButtons.forEach((btn) => {
      const handler = () => {
        const req = btn.dataset.requirement
        if (!req) return
        const current = btn.dataset.state ?? "neutral"
        const next = current === "neutral" ? "include" : current === "include" ? "exclude" : "neutral"
        btn.dataset.state = next
        if (next === "neutral") {
          requirementStates.delete(req)
        } else {
          requirementStates.set(req, next as TagState)
        }
        applyFromState()
      }
      btn.addEventListener("click", handler)
      cleanupHandlers.push(() => btn.removeEventListener("click", handler))
    })

    if (resetBtn) {
      const handler = () => {
        tagStates.clear()
        tagButtons.forEach((btn) => (btn.dataset.state = "neutral"))
        requirementStates.clear()
        requirementButtons.forEach((btn) => (btn.dataset.state = "neutral"))
        writeStoredFilters([], [], [], [])
        updateFilterLabel([], [], [], [], filterLabel)
        const query = searchInput?.value ?? ""
        applyFilters(parsedData!.recipes, [], [], [], [], query, tableBody, countLabel)
        resetBtn.style.display = "none"
      }
      resetBtn.addEventListener("click", handler)
      cleanupHandlers.push(() => resetBtn.removeEventListener("click", handler))
    }

    if (searchInput) {
      const handler = () => {
        const { include, exclude, requirements, requirementsExclude } = readStoredFilters()
        applyFilters(
          parsedData!.recipes,
          include,
          exclude,
          requirements,
          requirementsExclude,
          searchInput.value,
          tableBody,
          countLabel,
        )
      }
      searchInput.addEventListener("input", handler)
      cleanupHandlers.push(() => searchInput.removeEventListener("input", handler))
    }

    applyFromState()
    ;(root as any).recipeTableCleanup = () => {
      cleanupHandlers.forEach((fn) => fn())
      delete (root as any).recipeTableCleanup
    }
  }

  document.addEventListener("nav", () => {
    setupRecipeTable()
  })

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setupRecipeTable()
  }

  document.addEventListener("filterChanged", () => {
    const tableBody = document.querySelector<HTMLElement>(".recipe-app .recipe-table-body")
    if (!tableBody || !parsedData) return
    const { include, exclude, requirements, requirementsExclude } = readStoredFilters()
    const query = document.querySelector<HTMLInputElement>(".recipe-search-input")?.value ?? ""
    const countLabel = document.querySelector<HTMLElement>(".recipe-results-count")
    applyFilters(parsedData.recipes, include, exclude, requirements, requirementsExclude, query, tableBody, countLabel)
    updateFilterLabel(
      include,
      exclude,
      requirements,
      requirementsExclude,
      document.querySelector(".recipe-filters-label"),
    )
  })
})()
