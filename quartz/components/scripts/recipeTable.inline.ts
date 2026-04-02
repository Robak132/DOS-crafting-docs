(() => {
  const STORAGE_INCLUDE = "wfrp_filter_include"
  const STORAGE_EXCLUDE = "wfrp_filter_exclude"
  type TagState = "neutral" | "include" | "exclude"

  interface RecipeItem {
    name: string
    slug?: string
    tags: string[]
  }

  interface RecipeRow {
    id: string
    ingredients: RecipeItem[]
    result: RecipeItem
    tags: string[]
    requirements: string
    notes: string
    source: string
  }

  interface TagStat {
    tag: string
    count: number
  }

  interface RecipeData {
    recipes: RecipeRow[]
    tags: TagStat[]
  }

  type FilterState = {
    include: string[]
    exclude: string[]
  }

  let parsedData: RecipeData | null = null

  function splitCsv(value: string | null): string[] {
    return value ? value.split(",").filter(Boolean) : []
  }

  function readStoredFilters(): FilterState {
    try {
      return {
        include: splitCsv(sessionStorage.getItem(STORAGE_INCLUDE)),
        exclude: splitCsv(sessionStorage.getItem(STORAGE_EXCLUDE)),
      }
    } catch {
      return { include: [], exclude: [] }
    }
  }

  function writeStoredFilters(include: string[], exclude: string[]) {
    if (include.length > 0 || exclude.length > 0) {
      sessionStorage.setItem(STORAGE_INCLUDE, include.join(","))
      sessionStorage.setItem(STORAGE_EXCLUDE, exclude.join(","))
    } else {
      sessionStorage.removeItem(STORAGE_INCLUDE)
      sessionStorage.removeItem(STORAGE_EXCLUDE)
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
    if (!item.slug) {
      return `<span class="recipe-item">${escapeHtml(item.name)}</span>`
    }
    return `<a class="internal recipe-item" href="${buildRelativeHref(item.slug)}">${escapeHtml(item.name)}</a>`
  }

  function groupRecipes(recipes: RecipeRow[]) {
    const grouped = new Map<string, { result: RecipeItem; variants: RecipeRow[] }>()
    recipes.forEach((recipe) => {
      const key = recipe.result.slug ?? recipe.result.name
      const existing = grouped.get(key)
      if (existing) {
        existing.variants.push(recipe)
      } else {
        grouped.set(key, { result: recipe.result, variants: [recipe] })
      }
    })
    return [...grouped.values()]
  }

  function buildRecipeHtml(group: { result: RecipeItem; variants: RecipeRow[] }): string {
    return group.variants
      .map((variant, index) => {
        const first = variant.ingredients[0]
        const second = variant.ingredients[1]
        const extraCount = variant.ingredients.length > 2 ? variant.ingredients.length - 2 : 0
        const extra = extraCount > 0 ? `<span class="recipe-extra">+${extraCount}</span>` : ""
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
          <td class="recipe-cell">${first ? renderItem(first) : `<span class="recipe-empty">—</span>`}</td>
          <td class="recipe-cell">
            ${second ? renderItem(second) : `<span class="recipe-empty">—</span>`}
            ${extra}
          </td>
          ${resultCell}
          <td class="recipe-cell meta">${requirements ? escapeHtml(requirements) : `<span class="recipe-empty">—</span>`}</td>
          <td class="recipe-cell meta">${notes ? escapeHtml(notes) : `<span class="recipe-empty">—</span>`}</td>
        </tr>`
      })
      .join("")
  }

  function matchesTag(tags: string[], target: string): boolean {
    return tags.some((tag) => tag === target || tag.startsWith(target + "/"))
  }

  function applyFilters(
    recipes: RecipeRow[],
    include: string[],
    exclude: string[],
    query: string,
    tableBody: HTMLElement,
    countLabel: HTMLElement | null,
  ) {
    const normalizedQuery = query.trim().toLowerCase()

    const filtered = recipes.filter((recipe) => {
      const candidateTags = recipe.tags ?? []
      const hasAllInclude = include.every((incTag) => matchesTag(candidateTags, incTag))
      const hasNoExclude = !exclude.some((excTag) => matchesTag(candidateTags, excTag))

      if (include.length > 0 && !hasAllInclude) return false
      if (!hasNoExclude) return false

      if (!normalizedQuery) return true
      const haystack = [
        recipe.result?.name ?? "",
        ...(recipe.ingredients ?? []).map((ing) => ing.name ?? ""),
        ...(recipe.tags ?? []),
        recipe.requirements ?? "",
        recipe.notes ?? "",
        recipe.source ?? "",
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })

    const grouped = groupRecipes(filtered)
    tableBody.innerHTML = grouped.map(buildRecipeHtml).join("")
    countLabel && (countLabel.textContent = `Wyników: ${grouped.length}`)
    document.dispatchEvent(new CustomEvent("contentChanged", { detail: {} }))
  }

  function updateFilterLabel(include: string[], exclude: string[], label: HTMLElement | null) {
    if (!label) return
    if (include.length === 0 && exclude.length === 0) {
      label.textContent = ""
      return
    }
    const includeText = include.length > 0 ? include.join(", ") : ""
    const excludeText = exclude.length > 0 ? "bez: " + exclude.join(", ") : ""
    label.textContent = [includeText, excludeText].filter(Boolean).join(" | ")
  }

  function setupRecipeTable() {
    const dataScript = document.getElementById("recipe-table-data")
    const tableBody = document.querySelector<HTMLElement>(".recipe-table-body")
    const tableWrap = document.querySelector<HTMLElement>(".recipe-table-wrap")
    const root = document.querySelector<HTMLElement>(".recipe-app")
    const tagButtons = document.querySelectorAll<HTMLButtonElement>(".recipe-tag-button")
    const resetBtn = document.querySelector<HTMLButtonElement>(".recipe-reset-btn")
    const filterLabel = document.querySelector<HTMLElement>(".recipe-filters-label")
    const searchInput = document.querySelector<HTMLInputElement>(".recipe-search-input")
    const countLabel = document.querySelector<HTMLElement>(".recipe-results-count")

    if (!dataScript || !tableBody || !root) {
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
    const stored = readStoredFilters()

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

    const applyFromState = () => {
      const include: string[] = []
      const exclude: string[] = []
      tagStates.forEach((state, tag) => {
        if (state === "include") include.push(tag)
        if (state === "exclude") exclude.push(tag)
      })

      writeStoredFilters(include, exclude)
      updateFilterLabel(include, exclude, filterLabel)
      const query = searchInput?.value ?? ""
      applyFilters(parsedData!.recipes, include, exclude, query, tableBody, countLabel)

      if (resetBtn) {
        resetBtn.style.display = include.length > 0 || exclude.length > 0 ? "inline-flex" : "none"
      }
    }

    const cleanupHandlers: Array<() => void> = []

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

    if (resetBtn) {
      const handler = () => {
        tagStates.clear()
        tagButtons.forEach((btn) => (btn.dataset.state = "neutral"))
        writeStoredFilters([], [])
        updateFilterLabel([], [], filterLabel)
        const query = searchInput?.value ?? ""
        applyFilters(parsedData!.recipes, [], [], query, tableBody, countLabel)
        resetBtn.style.display = "none"
      }
      resetBtn.addEventListener("click", handler)
      cleanupHandlers.push(() => resetBtn.removeEventListener("click", handler))
    }

    if (searchInput) {
      const handler = () => {
        if (tableWrap?.style.width === "") {
          const width = tableWrap.getBoundingClientRect().width
          if (width > 0) {
            tableWrap.style.width = `${width}px`
          }
        }
        const { include, exclude } = readStoredFilters()
        applyFilters(parsedData!.recipes, include, exclude, searchInput.value, tableBody, countLabel)
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
    const tableBody = document.querySelector<HTMLElement>(".recipe-table-body")
    if (!tableBody || !parsedData) return
    const { include, exclude } = readStoredFilters()
    const query = document.querySelector<HTMLInputElement>(".recipe-search-input")?.value ?? ""
    const countLabel = document.querySelector<HTMLElement>(".recipe-results-count")
    applyFilters(parsedData.recipes, include, exclude, query, tableBody, countLabel)
    updateFilterLabel(include, exclude, document.querySelector(".recipe-filters-label"))
  })
})()
