import {
  formatEffectNote,
  catalogHasRequirements,
  groupRecipes,
  isGameTag,
  itemCraftRoleClass,
  matchesCraftingMax,
  matchesRecipeQuery,
  recipeColumnsForCatalog,
  recipeResultTags,
  recipeUsesSelector,
  tagLabel,
  visibleRecipeTags,
  type ItemCraftRole,
  type RecipeSearchScope,
} from "../recipeView"
import { formatItemQuantity } from "../recipeQuantity"
import type { RecipeItem, RecipeRow } from "../recipes"
;(() => {
  const STORAGE_INCLUDE = "wfrp_filter_include"
  const STORAGE_EXCLUDE = "wfrp_filter_exclude"
  const STORAGE_REQUIREMENTS = "wfrp_filter_requirements"
  const STORAGE_REQUIREMENTS_EXCLUDE = "wfrp_filter_requirements_exclude"
  const STORAGE_CRAFTING_MAX = "wfrp_filter_crafting_max"
  const STORAGE_SEARCH_SCOPE = "wfrp_filter_search_scope"
  const STORAGE_SELECTORS = "wfrp_filter_selectors"
  type TagState = "neutral" | "include" | "exclude"

  interface RecipeData {
    recipes: RecipeRow[]
    labels: Record<string, string>
    itemRoles?: Record<string, ItemCraftRole>
  }

  type FilterState = {
    include: string[]
    exclude: string[]
    requirements: string[]
    requirementsExclude: string[]
    craftingMax: number | null
    searchScope: RecipeSearchScope
    selectors: string[]
  }

  let parsedData: RecipeData | null = null

  function storageKey(key: string): string {
    const catalog = document.querySelector<HTMLElement>(".recipe-app")?.dataset.catalog
    return catalog === "dos2" ? `dos2_${key}` : catalog === "dos2-base" ? `dos2_base_${key}` : key
  }

  function splitCsv(value: string | null): string[] {
    return value ? value.split(",").filter(Boolean) : []
  }

  function parseCraftingMax(value: string | null): number | null {
    if (!value) return null
    const level = Number(value)
    return Number.isInteger(level) && level >= 1 && level <= 5 ? level : null
  }

  function parseSearchScope(value: string | null): RecipeSearchScope {
    return value === "ingredient" ? "ingredient" : "result"
  }

  function readStoredFilters(): FilterState {
    try {
      const supportsRequirements = document.querySelector<HTMLElement>(".recipe-app")?.dataset.catalog === "dos1"
      return {
        include: splitCsv(sessionStorage.getItem(storageKey(STORAGE_INCLUDE))).filter((tag) => !isGameTag(tag)),
        exclude: splitCsv(sessionStorage.getItem(storageKey(STORAGE_EXCLUDE))).filter((tag) => !isGameTag(tag)),
        requirements: supportsRequirements ? splitCsv(sessionStorage.getItem(storageKey(STORAGE_REQUIREMENTS))) : [],
        requirementsExclude: supportsRequirements
          ? splitCsv(sessionStorage.getItem(storageKey(STORAGE_REQUIREMENTS_EXCLUDE)))
          : [],
        craftingMax: supportsRequirements
          ? parseCraftingMax(sessionStorage.getItem(storageKey(STORAGE_CRAFTING_MAX)))
          : null,
        searchScope: parseSearchScope(sessionStorage.getItem(storageKey(STORAGE_SEARCH_SCOPE))),
        selectors: splitCsv(sessionStorage.getItem(storageKey(STORAGE_SELECTORS))),
      }
    } catch {
      return {
        include: [],
        exclude: [],
        requirements: [],
        requirementsExclude: [],
        craftingMax: null,
        searchScope: "result",
        selectors: [],
      }
    }
  }

  function writeStoredFilters(
    include: string[],
    exclude: string[],
    requirements: string[],
    requirementsExclude: string[],
    craftingMax: number | null,
    searchScope: RecipeSearchScope,
    selectors: string[],
  ) {
    if (
      include.length > 0 ||
      exclude.length > 0 ||
      requirements.length > 0 ||
      requirementsExclude.length > 0 ||
      craftingMax !== null ||
      searchScope !== "result" ||
      selectors.length > 0
    ) {
      sessionStorage.setItem(storageKey(STORAGE_INCLUDE), include.join(","))
      sessionStorage.setItem(storageKey(STORAGE_EXCLUDE), exclude.join(","))
      sessionStorage.setItem(storageKey(STORAGE_REQUIREMENTS), requirements.join(","))
      sessionStorage.setItem(storageKey(STORAGE_REQUIREMENTS_EXCLUDE), requirementsExclude.join(","))
      if (craftingMax !== null) sessionStorage.setItem(storageKey(STORAGE_CRAFTING_MAX), String(craftingMax))
      else sessionStorage.removeItem(storageKey(STORAGE_CRAFTING_MAX))
      sessionStorage.setItem(storageKey(STORAGE_SEARCH_SCOPE), searchScope)
      sessionStorage.setItem(storageKey(STORAGE_SELECTORS), selectors.join(","))
    } else {
      sessionStorage.removeItem(storageKey(STORAGE_INCLUDE))
      sessionStorage.removeItem(storageKey(STORAGE_EXCLUDE))
      sessionStorage.removeItem(storageKey(STORAGE_REQUIREMENTS))
      sessionStorage.removeItem(storageKey(STORAGE_REQUIREMENTS_EXCLUDE))
      sessionStorage.removeItem(storageKey(STORAGE_CRAFTING_MAX))
      sessionStorage.removeItem(storageKey(STORAGE_SEARCH_SCOPE))
      sessionStorage.removeItem(storageKey(STORAGE_SELECTORS))
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

  function ingredientSearchText(item: RecipeItem): string {
    const source = item.name
    if (item.selectorTag) {
      return source.replace(/^#/, "").replace(/^<|>$/g, "")
    }
    return source
  }

  function itemTitleAttr(item: RecipeItem): string {
    return item.namePl && item.namePl !== item.name ? ` title="${escapeHtml(item.namePl)}"` : ""
  }

  function itemLabelHtml(item: RecipeItem): string {
    if (item.namePl && item.namePl !== item.name) {
      return `<span class="item-lang"><span class="item-lang-en">${escapeHtml(item.name)}</span><span class="item-lang-pl">${escapeHtml(item.namePl)}</span></span>`
    }
    return `<span class="item-lang-en">${escapeHtml(item.name)}</span>`
  }

  function withQuantity(html: string, item: RecipeItem): string {
    const qty = formatItemQuantity(item.quantity)
    if (!qty) return html
    return `<span class="recipe-item-wrap">${html}<span class="recipe-item-qty"> ${escapeHtml(qty)}</span></span>`
  }

  function renderItem(item: RecipeItem, opts?: { ingredient?: boolean }): string {
    const title = itemTitleAttr(item)
    const label = itemLabelHtml(item)
    const craftClass = itemCraftRoleClass(item.slug ? parsedData?.itemRoles?.[item.slug] : undefined)
    const craftAttr = craftClass ? ` ${craftClass}` : ""
    if (item.selectorTag) {
      const text = ingredientSearchText(item)
      return withQuantity(
        `<button type="button" class="recipe-item recipe-ingredient-tag${craftAttr}" data-search-text="${escapeHtml(text)}"${title}>${label}</button>`,
        item,
      )
    }
    if (item.slug) {
      return withQuantity(
        `<a class="internal recipe-item${craftAttr}" data-slug="${escapeHtml(item.slug)}" href="${escapeHtml(buildRelativeHref(item.slug))}"${title}>${label}</a>`,
        item,
      )
    }
    if (opts?.ingredient) {
      return withQuantity(
        `<button type="button" class="recipe-item recipe-ingredient-tag${craftAttr}" data-search-text="${escapeHtml(ingredientSearchText(item))}"${title}>${label}</button>`,
        item,
      )
    }
    return withQuantity(`<span class="recipe-item${craftAttr}"${title}>${label}</span>`, item)
  }

  function showRequirementsColumn(): boolean {
    return catalogHasRequirements(document.querySelector<HTMLElement>(".recipe-app")?.dataset.catalog)
  }

  function activeColumns() {
    return recipeColumnsForCatalog(showRequirementsColumn())
  }

  function buildRecipeHtml(group: { result: RecipeItem; variants: RecipeRow[] }): string {
    const withRequirements = showRequirementsColumn()
    return group.variants
      .map((variant, index) => {
        const ingredients = `<ul class="recipe-ingredients">${variant.ingredients.map((item) => `<li>${renderItem(item, { ingredient: true })}</li>`).join("")}</ul>`
        const tags = visibleRecipeTags(recipeResultTags(variant))
          .map(
            (tag) =>
              `<button type="button" class="recipe-search-tag" data-search-tag="${escapeHtml(tag)}">${escapeHtml(tagLabel(tag, parsedData?.labels ?? {}))}</button>`,
          )
          .join("")
        const requirements = variant.requirements?.trim()
        const notes = variant.notes?.trim()
        const remarks = variant.remarks?.trim()
        const effectLabel = notes ? formatEffectNote(notes) || notes : ""
        const effectChip = notes
          ? `<button type="button" class="recipe-effect-chip" data-search-effect="${escapeHtml(notes)}" title="${escapeHtml(notes)}">${escapeHtml(effectLabel)}</button>`
          : ""
        const remarksHtml = remarks
          ? `<span class="recipe-remarks" title="${escapeHtml(remarks)}">${escapeHtml(remarks)}</span>`
          : ""
        const effectsCell =
          effectChip || remarksHtml
            ? `<div class="recipe-effect-stack">${effectChip}${remarksHtml}</div>`
            : `<span class="recipe-empty">—</span>`
        const resultCell =
          index === 0
            ? `<td class="recipe-cell result" rowspan="${group.variants.length}">${renderItem(group.result)}</td>`
            : ""
        const requirementsCell = withRequirements
          ? `<td class="recipe-cell meta">${requirements ? escapeHtml(requirements) : `<span class="recipe-empty">—</span>`}</td>`
          : ""

        const rowClass = [
          index === 0 ? "recipe-group-start" : "recipe-group-inner",
          index === group.variants.length - 1 ? "recipe-group-end" : "",
        ]
          .filter(Boolean)
          .join(" ")
        return `<tr data-recipe-id="${escapeHtml(group.result.slug ?? group.result.name)}" class="${rowClass}">
          ${resultCell}
          <td class="recipe-cell ingredients">${ingredients}</td>
          ${requirementsCell}
          <td class="recipe-cell meta effects">${effectsCell}</td>
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
    craftingMax: number | null,
    searchScope: RecipeSearchScope,
    selectors: string[],
    query: string,
    tableBody: HTMLElement,
    countLabel: HTMLElement | null,
  ) {
    const requirementSet = requirements.map((req) => req.toLowerCase())
    const requirementExcludeSet = requirementsExclude.map((req) => req.toLowerCase())

    const filtered = recipes.filter((recipe) => {
      // Filtrowanie tagów dotyczy wyłącznie wyniku craftingu, nie składników receptury.
      const candidateTags = recipeResultTags(recipe)
      const hasAllInclude = include.every((incTag) => matchesTag(candidateTags, incTag))
      const hasNoExclude = !exclude.some((excTag) => matchesTag(candidateTags, excTag))
      const reqTokens = requirementTokens(recipe.requirements ?? "")
      const matchesRequirements =
        requirementSet.length === 0 ? true : reqTokens.some((token) => requirementSet.includes(token))
      const matchesExcludedRequirements =
        requirementExcludeSet.length === 0 ? false : reqTokens.some((token) => requirementExcludeSet.includes(token))
      const matchesCraftLevel =
        craftingMax === null ? true : matchesCraftingMax(recipe.requirements ?? "", craftingMax)
      // Grupy #selector dotyczą składników — stosuj tylko w zakresie „Składnik”.
      const matchesSelectors =
        selectors.length === 0 || searchScope !== "ingredient"
          ? true
          : selectors.some((selector) => recipeUsesSelector(recipe, selector))

      if (include.length > 0 && !hasAllInclude) return false
      if (!hasNoExclude) return false
      if (!matchesRequirements) return false
      if (matchesExcludedRequirements) return false
      if (!matchesCraftLevel) return false
      if (!matchesSelectors) return false

      return matchesRecipeQuery(recipe, query, parsedData?.labels ?? {}, searchScope)
    })

    const grouped = groupRecipes(filtered)
    tableBody.innerHTML =
      grouped.length > 0
        ? grouped.map(buildRecipeHtml).join("")
        : `<tr><td colspan="${activeColumns().length}" class="recipe-empty">Brak przedmiotów pasujących do filtrów.</td></tr>`
    countLabel && (countLabel.textContent = `Przedmioty: ${grouped.length}`)
    document.dispatchEvent(new CustomEvent("contentChanged", { detail: {} }))
  }

  function updateFilterLabel(
    include: string[],
    exclude: string[],
    requirements: string[],
    requirementsExclude: string[],
    craftingMax: number | null,
    selectors: string[],
    label: HTMLElement | null,
  ) {
    if (!label) return
    if (
      include.length === 0 &&
      exclude.length === 0 &&
      requirements.length === 0 &&
      requirementsExclude.length === 0 &&
      craftingMax === null &&
      selectors.length === 0
    ) {
      label.textContent = ""
      return
    }
    const includeText = include.length > 0 ? include.join(", ") : ""
    const excludeText = exclude.length > 0 ? "bez: " + exclude.join(", ") : ""
    const craftText = craftingMax !== null ? `crafting ≤ ${craftingMax}` : ""
    const selectorText = selectors.length > 0 ? "grupa: " + selectors.map((sel) => `#${sel}`).join(", ") : ""
    const reqText =
      requirements.length > 0 ? "wym: " + requirements.map((req) => (req === "-" ? "Brak" : req)).join(", ") : ""
    const reqExcludeText =
      requirementsExclude.length > 0
        ? "bez wym: " + requirementsExclude.map((req) => (req === "-" ? "Brak" : req)).join(", ")
        : ""
    label.textContent = [includeText, excludeText, craftText, selectorText, reqText, reqExcludeText]
      .filter(Boolean)
      .join(" | ")
  }

  function setupRecipeTable() {
    const dataScript = document.getElementById("recipe-table-data")
    const tableBody = document.querySelector<HTMLElement>(".recipe-table-body")
    const root = document.querySelector<HTMLElement>(".recipe-app")
    const tagButtons = document.querySelectorAll<HTMLButtonElement>(
      ".recipe-tag-button:not(.requirement-button):not(.crafting-max-button):not(.selector-button)",
    )
    const requirementButtons = document.querySelectorAll<HTMLButtonElement>(".requirement-button")
    const craftingMaxButtons = document.querySelectorAll<HTMLButtonElement>(".crafting-max-button")
    const selectorButtons = document.querySelectorAll<HTMLButtonElement>(".selector-button")
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
    const selectorStates = new Set<string>()
    let craftingMax: number | null = null
    let searchScope: RecipeSearchScope = "result"
    const searchScopeButtons = document.querySelectorAll<HTMLButtonElement>(".recipe-search-mode-btn")
    const params = new URLSearchParams(window.location.search)
    const queryTag = params.get("tag")
    const queryText = params.get("q")
    const queryAs = params.get("as")
    const querySelector = params.get("selector")
    const queryRequirement = root.dataset.catalog === "dos1" ? params.get("requirement") : null
    const queryCraftingMax = root.dataset.catalog === "dos1" ? parseCraftingMax(params.get("craftingMax")) : null
    const hasQueryFilters = Boolean(
      queryTag || queryRequirement || queryCraftingMax !== null || queryAs || querySelector,
    )
    const stored = hasQueryFilters
      ? {
          include: queryTag ? [queryTag] : [],
          exclude: [],
          requirements: queryRequirement ? [queryRequirement] : [],
          requirementsExclude: [],
          craftingMax: queryCraftingMax,
          searchScope: parseSearchScope(queryAs ?? (queryTag ? "result" : null)),
          selectors: querySelector ? [querySelector] : [],
        }
      : readStoredFilters()
    craftingMax = stored.craftingMax
    searchScope = stored.searchScope
    stored.selectors.forEach((selector) => selectorStates.add(selector))

    const syncSearchScopeUi = () => {
      searchScopeButtons.forEach((btn) => {
        btn.dataset.state = btn.dataset.searchScope === searchScope ? "include" : "neutral"
      })
      if (searchInput) {
        const placeholder =
          searchScope === "ingredient"
            ? (searchInput.dataset.placeholderIngredient ?? searchInput.placeholder)
            : (searchInput.dataset.placeholderResult ?? searchInput.placeholder)
        searchInput.placeholder = placeholder
      }
    }
    const syncTagButtonStates = () => {
      tagButtons.forEach((btn) => {
        const tag = btn.dataset.tag
        if (!tag) return
        btn.dataset.state = tagStates.get(tag) ?? "neutral"
        if (btn.dataset.state !== "neutral") {
          const group = btn.closest<HTMLDetailsElement>(".recipe-tag-group")
          if (group) group.open = true
        }
      })
    }
    const syncSelectorButtonStates = () => {
      selectorButtons.forEach((btn) => {
        const selector = btn.dataset.selector
        if (!selector) return
        btn.dataset.state = selectorStates.has(selector) ? "include" : "neutral"
        if (btn.dataset.state === "include") {
          const group = btn.closest<HTMLDetailsElement>(".recipe-tag-group")
          if (group) group.open = true
        }
      })
    }
    syncSearchScopeUi()
    if (searchInput) {
      if (queryTag) searchInput.value = `#${queryTag}`
      else if (queryText) searchInput.value = queryText
    }

    stored.include.forEach((tag) => tagStates.set(tag, "include"))
    stored.exclude.forEach((tag) => tagStates.set(tag, "exclude"))
    syncTagButtonStates()

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

    craftingMaxButtons.forEach((btn) => {
      const level = parseCraftingMax(btn.dataset.craftingMax ?? null)
      btn.dataset.state = level !== null && level === craftingMax ? "include" : "neutral"
    })
    syncSelectorButtonStates()

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
      const selectors = [...selectorStates]

      writeStoredFilters(include, exclude, requirements, requirementsExclude, craftingMax, searchScope, selectors)
      updateFilterLabel(include, exclude, requirements, requirementsExclude, craftingMax, selectors, filterLabel)
      const query = searchInput?.value ?? ""
      applyFilters(
        parsedData!.recipes,
        include,
        exclude,
        requirements,
        requirementsExclude,
        craftingMax,
        searchScope,
        selectors,
        query,
        tableBody,
        countLabel,
      )

      if (resetBtn) {
        resetBtn.style.display =
          include.length > 0 ||
          exclude.length > 0 ||
          requirements.length > 0 ||
          requirementsExclude.length > 0 ||
          craftingMax !== null ||
          searchScope !== "result" ||
          selectors.length > 0
            ? "inline-flex"
            : "none"
      }
    }

    const cycleTagState = (tag: string) => {
      const current = tagStates.get(tag) ?? "neutral"
      const next: TagState = current === "neutral" ? "include" : current === "include" ? "exclude" : "neutral"
      if (next === "neutral") tagStates.delete(tag)
      else tagStates.set(tag, next)
      syncTagButtonStates()
      applyFromState()
    }

    const cleanupHandlers: Array<() => void> = []
    const onSearchChipClick = (event: MouseEvent) => {
      if (!searchInput || !(event.target instanceof Element)) return
      const effectBtn = event.target.closest<HTMLButtonElement>("button[data-search-effect]")
      if (effectBtn?.dataset.searchEffect) {
        searchScope = "result"
        syncSearchScopeUi()
        searchInput.value = formatEffectNote(effectBtn.dataset.searchEffect) || effectBtn.dataset.searchEffect
        applyFromState()
        return
      }
      const tagBtn = event.target.closest<HTMLButtonElement>("button[data-search-tag]")
      if (tagBtn?.dataset.searchTag) {
        searchScope = "result"
        syncSearchScopeUi()
        searchInput.value = `#${tagBtn.dataset.searchTag}`
        applyFromState()
        return
      }
      const ingredientBtn = event.target.closest<HTMLButtonElement>("button[data-search-text]")
      if (ingredientBtn?.dataset.searchText) {
        searchScope = "ingredient"
        syncSearchScopeUi()
        searchInput.value = ingredientBtn.dataset.searchText
        applyFromState()
      }
    }
    root.addEventListener("click", onSearchChipClick)
    cleanupHandlers.push(() => root.removeEventListener("click", onSearchChipClick))

    tagButtons.forEach((btn) => {
      const handler = () => {
        const tag = btn.dataset.tag
        if (!tag) return
        cycleTagState(tag)
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

    craftingMaxButtons.forEach((btn) => {
      const handler = () => {
        const level = parseCraftingMax(btn.dataset.craftingMax ?? null)
        if (level === null) return
        craftingMax = craftingMax === level ? null : level
        craftingMaxButtons.forEach((other) => {
          const otherLevel = parseCraftingMax(other.dataset.craftingMax ?? null)
          other.dataset.state = otherLevel !== null && otherLevel === craftingMax ? "include" : "neutral"
        })
        applyFromState()
      }
      btn.addEventListener("click", handler)
      cleanupHandlers.push(() => btn.removeEventListener("click", handler))
    })

    selectorButtons.forEach((btn) => {
      const handler = () => {
        const selector = btn.dataset.selector
        if (!selector) return
        if (selectorStates.has(selector)) selectorStates.delete(selector)
        else {
          selectorStates.add(selector)
          // Grupy składników filtrują po składnikach — przełącz zakres wyszukiwania.
          searchScope = "ingredient"
          syncSearchScopeUi()
        }
        syncSelectorButtonStates()
        applyFromState()
      }
      btn.addEventListener("click", handler)
      cleanupHandlers.push(() => btn.removeEventListener("click", handler))
    })

    searchScopeButtons.forEach((btn) => {
      const handler = () => {
        const scope = parseSearchScope(btn.dataset.searchScope ?? null)
        searchScope = scope
        syncSearchScopeUi()
        applyFromState()
      }
      btn.addEventListener("click", handler)
      cleanupHandlers.push(() => btn.removeEventListener("click", handler))
    })

    if (resetBtn) {
      const handler = () => {
        tagStates.clear()
        syncTagButtonStates()
        requirementStates.clear()
        requirementButtons.forEach((btn) => (btn.dataset.state = "neutral"))
        craftingMax = null
        craftingMaxButtons.forEach((btn) => (btn.dataset.state = "neutral"))
        selectorStates.clear()
        syncSelectorButtonStates()
        searchScope = "result"
        syncSearchScopeUi()
        writeStoredFilters([], [], [], [], null, "result", [])
        updateFilterLabel([], [], [], [], null, [], filterLabel)
        const query = searchInput?.value ?? ""
        applyFilters(parsedData!.recipes, [], [], [], [], null, "result", [], query, tableBody, countLabel)
        resetBtn.style.display = "none"
      }
      resetBtn.addEventListener("click", handler)
      cleanupHandlers.push(() => resetBtn.removeEventListener("click", handler))
    }

    if (searchInput) {
      const handler = () => {
        const {
          include,
          exclude,
          requirements,
          requirementsExclude,
          craftingMax: max,
          searchScope: scope,
          selectors,
        } = readStoredFilters()
        applyFilters(
          parsedData!.recipes,
          include,
          exclude,
          requirements,
          requirementsExclude,
          max,
          scope,
          selectors,
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
    const { include, exclude, requirements, requirementsExclude, craftingMax, searchScope, selectors } =
      readStoredFilters()
    const query = document.querySelector<HTMLInputElement>(".recipe-search-input")?.value ?? ""
    const countLabel = document.querySelector<HTMLElement>(".recipe-results-count")
    applyFilters(
      parsedData.recipes,
      include,
      exclude,
      requirements,
      requirementsExclude,
      craftingMax,
      searchScope,
      selectors,
      query,
      tableBody,
      countLabel,
    )
    updateFilterLabel(
      include,
      exclude,
      requirements,
      requirementsExclude,
      craftingMax,
      selectors,
      document.querySelector(".recipe-filters-label"),
    )
  })
})()
