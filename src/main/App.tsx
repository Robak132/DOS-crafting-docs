import { TagFilterTree } from "./components/TagFilterTree"
import { applyGroupQuery } from "./domain/groupSearch"
import { itemDescriptionText, type ItemDescription } from "./components/ItemTooltip"
import { TooltipLayer } from "./components/TooltipLayer"
import { groupItemRows } from "./domain/itemGroups"
import { itemIconKey, itemDataKey } from "./domain/itemIcons"
import { ItemIcon } from "./components/ItemIcon"
import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import { ItemTable } from "./components/ItemTable"
import { RecipeTable } from "./components/RecipeTable"
import { UpgradeTable } from "./components/UpgradeTable"
import { upgradesForItem } from "./domain/upgrades"
import { displayItemName } from "./domain/itemName"
import type { CatalogManifest, CatalogData, PageSummary } from "./domain/types"
import {
  catalogItems,
  groupRecipeTags,
  groupRequirementStats,
  itemNameKeys,
  recipeResults,
  recipeRollsItem,
  recipeUsesItem,
  sortRecipes,
  tagLabel,
  type RecipeSort,
  uniqueItemEffects,
  uniqueItemRemarks,
  visibleRecipeTags,
  CRAFTING_MAX_LEVELS,
} from "./domain/recipeView"
import { parseItemQuantity } from "./domain/recipeQuantity"
import { collectRecipeStats } from "./domain/recipes"
import { isCategoryTag } from "./domain/tagTree"
import {
  emptyFilters,
  cycleFilter,
  filterRecipes,
  filterUpgrades,
  filtersToSearch,
  rememberedCatalogHref,
  restoreFilters,
  type Filters,
} from "./filters"
import {
  catalogHref,
  gameForSlug,
  games,
  itemHref as gameItemHref,
  pageGames,
  parseItemRoute,
  routeNamesGame,
  routeSlug,
  type Game,
  type View,
} from "./routing"
import { useJson } from "./api"

const stored = (key: string, fallback: string) => {
  try {
    return sessionStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
const searchScopes: Filters["scope"][] = ["result", "ingredient", "all"]
const scopeLabels: Record<Filters["scope"], { option: string; title: string; filter: string; placeholder: string }> = {
  result: { option: "Produkt", title: "Szukaj w produktach", filter: "produkt", placeholder: "Nazwa lub efekt" },
  ingredient: {
    option: "Składnik",
    title: "Szukaj w składnikach",
    filter: "składnik",
    placeholder: "Nazwa składnika lub grupy",
  },
  all: { option: "Wszystko", title: "Bez zawężenia", filter: "szukaj", placeholder: "Nazwa, efekt lub składnik" },
}

const catalogHrefWith = (game: Game, view: View, filters: Filters) =>
  `${catalogHref(game, view).split("?")[0]}?${filtersToSearch(filters, view)}`
const sortLabels: Record<RecipeSort, string> = {
  default: "Domyślnie",
  name: "Nazwa A–Z",
  level: "Wymagany poziom",
  ingredients: "Liczba składników",
}

const currentRoute = () => ({ slug: routeSlug(window.location.pathname), search: window.location.search })
function routeGame(route: ReturnType<typeof currentRoute>): Game {
  const candidate = stored("dos_active_catalog", "dos1")
  return (
    gameForSlug(route.slug) ??
    parseItemRoute(route.slug)?.game ??
    (games.some((entry) => entry.id === candidate) ? (candidate as Game) : "dos1")
  )
}
/** The address of a game's catalog or item; elsewhere (a broken link) the URL holds no filters of any game. */
const routeOwnsFilters = (slug: string) => !slug || slug === "index" || routeNamesGame(slug)
function routeFilters(route: ReturnType<typeof currentRoute>): Filters {
  return restoreFilters(routeGame(route), routeOwnsFilters(route.slug) ? route.search : "")
}
function routeView(search: string): View {
  const view = new URLSearchParams(search).get("view") ?? stored("crafting_catalog_view", "items")
  return view === "recipes" || view === "upgrades" ? view : "items"
}
function LanguageName({ page, lang }: { page: { title: string; titlePl?: string }; lang: string }) {
  return <>{lang === "pl" ? (page.titlePl ?? page.title) : page.title}</>
}
export function App() {
  const [route, setRoute] = useState(currentRoute)
  const [game, setGame] = useState<Game>(() => routeGame(currentRoute()))
  const [view, setView] = useState<View>(() => routeView(window.location.search))
  const [filters, setFilters] = useState<Filters>(() => routeFilters(currentRoute()))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [query, setQuery] = useState(filters.query)
  const [lang, setLang] = useState<"pl" | "en">(() => {
    try {
      return localStorage.getItem("item-lang") === "pl" ? "pl" : "en"
    } catch {
      return "en"
    }
  })
  const root = useRef<HTMLDivElement>(null)
  const manifest = useJson<CatalogManifest>("manifest.json")
  const catalog = useJson<CatalogData>(`catalog-${game}.json`)
  const isCatalog = !route.slug || route.slug === "index" || Boolean(gameForSlug(route.slug))
  const itemSlug = parseItemRoute(route.slug)?.item
  const page = itemSlug
    ? manifest.data?.pages.find((entry) => entry.slug === itemSlug && pageGames(entry.tags).includes(game))
    : undefined
  const isItemRoute = Boolean(page?.itemPage && !page.categoryPage)
  const unavailablePage = !isCatalog && Boolean(manifest.data) && !isItemRoute
  const descriptions = useJson<Record<string, ItemDescription>>(
    !isCatalog || view === "items" ? `descriptions-${game}.json` : null,
  )
  const detail: { data?: PageSummary; error?: string } = { data: isItemRoute ? page : undefined }
  const activeGame = games.find((entry) => entry.id === game)!
  const labels = useMemo(
    () => Object.fromEntries((catalog.data?.tags ?? []).map((entry) => [entry.tag, entry.label ?? entry.tag])),
    [catalog.data],
  )
  const sourceRows = useMemo(() => {
    const group = filters.group ? catalog.data?.groups?.[filters.group] : undefined
    return group
      ? groupItemRows(catalog.data?.recipes ?? [], group)
      : filters.group
        ? []
        : (catalog.data?.recipes ?? [])
  }, [catalog.data, filters.group])
  const grouped = useMemo(
    () => applyGroupQuery(sourceRows, catalog.data?.groups ?? {}, filters.query, filters.scope),
    [sourceRows, catalog.data, filters.query, filters.scope],
  )
  const filtered = useMemo(
    () => sortRecipes(filterRecipes(grouped.rows, { ...filters, query: grouped.query }, labels), filters.sort, lang),
    [grouped, filters, labels, lang],
  )
  // Tag counts follow the search and other narrowing, but not the tags themselves: each count says how many
  // items picking that tag would add to what is shown.
  const narrowed =
    Boolean(filters.query.trim() || filters.group || filters.selectors.length || filters.craftingMax !== null) ||
    filters.requirements.length > 0 ||
    filters.requirementsExclude.length > 0
  const liveTags = useMemo(() => {
    const tags = catalog.data?.tags ?? []
    if (!narrowed || view === "upgrades") return tags
    const rows = filterRecipes(grouped.rows, { ...filters, query: grouped.query, include: [], exclude: [] }, labels)
    const counts = new Map(collectRecipeStats(rows).tags.map((stat) => [stat.tag, stat.count]))
    return tags
      .map((stat) => ({ ...stat, count: counts.get(stat.tag) ?? 0 }))
      .filter((stat) => stat.count > 0 || filters.include.includes(stat.tag) || filters.exclude.includes(stat.tag))
  }, [catalog.data, grouped, filters, labels, narrowed, view])
  const upgrades = useMemo(() => filterUpgrades(catalog.data?.upgrades ?? [], filters), [catalog.data, filters])
  const tagGroups = useMemo(
    () => groupRecipeTags(liveTags, manifest.data?.traitGroups ?? []),
    [liveTags, manifest.data],
  )
  const currentFilters = query === filters.query ? filters : { ...filters, query }
  const applyLocation = () => {
    const next = currentRoute()
    const nextGame = routeGame(next)
    const nextFilters = routeFilters(next)
    setRoute(next)
    setGame(nextGame)
    setView(routeView(next.search))
    setFilters(nextFilters)
    setQuery(nextFilters.query)
  }
  const navigate = (url: URL) => {
    if (isCatalog && currentFilters !== filters) {
      try {
        sessionStorage.setItem(`crafting.filters.${game}`, JSON.stringify(currentFilters))
      } catch {}
    }
    window.history.pushState({}, "", url)
    applyLocation()
    window.scrollTo(0, 0)
  }
  // Ctrl+Space jumps to the search box from anywhere on the page.
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey || event.code !== "Space") return
      const input = document.getElementById("recipe-search-input")
      if (!(input instanceof HTMLInputElement)) return
      event.preventDefault()
      input.focus()
      input.select()
    }
    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [])
  useEffect(() => {
    const pop = () => applyLocation()
    window.addEventListener("popstate", pop)
    return () => window.removeEventListener("popstate", pop)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.itemLang = lang
    try {
      localStorage.setItem("item-lang", lang)
    } catch {
      /* storage optional */
    }
  }, [lang])
  useEffect(() => {
    // A broken link belongs to no game: it must not overwrite what a game remembers.
    if (!routeOwnsFilters(route.slug)) return
    try {
      sessionStorage.setItem("dos_active_catalog", game)
      sessionStorage.setItem("crafting_catalog_view", view)
      sessionStorage.setItem(`crafting.filters.${game}`, JSON.stringify(filters))
    } catch {
      /* storage optional */
    }
    if (isCatalog) {
      const url = new URL(catalogHref(game, view), window.location.origin)
      url.search = filtersToSearch(filters, view)
      window.history.replaceState({}, "", url)
    }
  }, [filters, game, view, isCatalog, route.slug])
  useEffect(() => {
    const timer = setTimeout(() => setFilters((value) => (value.query === query ? value : { ...value, query })), 150)
    return () => clearTimeout(timer)
  }, [query])
  useEffect(() => {
    document.title = isCatalog
      ? `${activeGame.label} — katalog craftingu`
      : unavailablePage
        ? "Nie znaleziono strony — Divinity"
        : `${detail.data?.title ?? "Przedmiot"} — Divinity`
  }, [activeGame.label, detail.data, isCatalog, unavailablePage])

  const changeQuery = (value: string, scope: Filters["scope"] = "result") => {
    setQuery(value)
    setFilters((state) => ({ ...state, query: value, scope }))
    if (!isCatalog)
      navigate(new URL(rememberedCatalogHref(game, view, { ...filters, query: value, scope }), window.location.origin))
  }
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const chip = event.target.closest<HTMLButtonElement>(
      "button[data-filter-tag], button[data-search-effect], button[data-search-text]",
    )
    if (chip) {
      if (chip.dataset.filterTag) cycle(chip.dataset.filterTag)
      else if (chip.dataset.searchEffect) changeQuery(chip.dataset.searchEffect)
      else if (chip.dataset.searchText) changeQuery(chip.dataset.searchText, "ingredient")
      return
    }
    const link = event.target.closest<HTMLAnchorElement>("a[href]")
    if (
      !link ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0 ||
      link.target === "_blank" ||
      link.getAttribute("href")?.startsWith("#")
    )
      return
    const url = new URL(link.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith(import.meta.env.BASE_URL)) return
    event.preventDefault()
    navigate(url)
  }
  const cycle = (tag: string, kind: "tag" | "requirement" = "tag") => {
    const next = cycleFilter(currentFilters, tag, kind)
    if (isCatalog) setFilters(next)
    else
      navigate(
        new URL(`${catalogHref(game, view).split("?")[0]}?${filtersToSearch(next, view)}`, window.location.origin),
      )
  }
  const reset = () => {
    setFilters(emptyFilters())
    setQuery("")
  }
  const filterText = [
    ...filters.include.map((tag) => tagLabel(tag, labels)),
    ...filters.exclude.map((tag) => `bez: ${tagLabel(tag, labels)}`),
    ...filters.requirements.map((value) => `wym: ${value}`),
    ...filters.requirementsExclude.map((value) => `bez wym: ${value}`),
    filters.craftingMax ? `Crafting ≤ ${filters.craftingMax}` : "",
    filters.selectors.length ? `grupa: ${filters.selectors.map((value) => `#${value}`).join(", ")}` : "",
    filters.group ? `grupa: ${displayItemName(catalog.data?.groups?.[filters.group]?.name ?? filters.group)}` : "",
    filters.query ? `${scopeLabels[filters.scope].filter}: ${filters.query}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
  const activeFilterCount =
    filters.include.length +
    filters.exclude.length +
    filters.requirements.length +
    filters.requirementsExclude.length +
    (filters.craftingMax === null ? 0 : 1)
  const itemHref = (slug: string) => gameItemHref(game, slug)
  const itemRecipes = useMemo(() => {
    if (!detail.data || !catalog.data) return { craft: [], rolled: [], used: [] }
    const parsed = parseItemQuantity(detail.data.title)
    const keys = itemNameKeys(detail.data.title, parsed.base, detail.data.slug.split("/").at(-1))
    const baseKeys = itemNameKeys(parsed.base)
    return {
      craft: catalog.data.recipes.filter(
        (row) =>
          recipeResults(row).some((product) => product.slug === itemSlug) ||
          (parsed.quantities.length > 0 &&
            Boolean(row.result.quantity) &&
            [...itemNameKeys(row.result.name, row.result.namePl)].some((key) => baseKeys.has(key))),
      ),
      rolled: catalog.data.recipes.filter((row) => recipeRollsItem(row, itemSlug, keys)),
      used: catalog.data.recipes.filter((row) => recipeUsesItem(row, itemSlug, keys)),
    }
  }, [detail.data, catalog.data, itemSlug])
  const itemUpgrades = useMemo(
    () =>
      detail.data
        ? upgradesForItem(catalog.data?.upgrades ?? [], detail.data.tags, itemSlug, catalog.data?.groups)
        : [],
    [detail.data, catalog.data, itemSlug],
  )
  const detailName =
    itemRecipes.craft.flatMap(recipeResults).find((item) => item.slug === itemSlug) ??
    itemRecipes.craft[0]?.result ??
    catalog.data?.recipes.flatMap((row) => row.result.pool ?? []).find((item) => item.slug === itemSlug) ??
    catalog.data?.recipes.flatMap((row) => row.ingredients).find((item) => item.slug === itemSlug)
  const detailDescription =
    descriptions.data?.[
      detailName ? itemDataKey(detailName) : itemIconKey(parseItemQuantity(detail.data?.title ?? "").base)
    ]

  const detailDescriptionText = itemDescriptionText(detailDescription, lang)
  // The most specific category of the item, for the breadcrumb.
  const detailCategory = detail.data ? visibleRecipeTags(detail.data.tags).find(isCategoryTag) : undefined
  const detailEffects = uniqueItemEffects(itemRecipes.craft, lang, detailName)
  const detailRemarks = uniqueItemRemarks(itemRecipes.craft)

  // One search bar for the whole site: it filters the catalog, and on an item page it opens the catalog.
  const search = (
    <form
      class="catalog-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        if (!isCatalog) changeQuery(query, filters.scope)
      }}
    >
      <label for="recipe-search-input">
        Szukaj <kbd class="shortcut">Ctrl+Spacja</kbd>
      </label>
      <div class="search-row">
        <input
          id="recipe-search-input"
          type="search"
          title='Ctrl+Spacja: przejdź do wyszukiwarki. Grupy: #NazwaGrupy albo #"Nazwa grupy"'
          aria-keyshortcuts="Control+Space"
          value={query}
          onInput={(event) => setQuery(event.currentTarget.value)}
          placeholder={
            isCatalog && view === "upgrades" ? "Efekt, przedmiot lub składnik" : scopeLabels[filters.scope].placeholder
          }
        />
        <select
          class="search-scope"
          aria-label="Zakres wyszukiwania"
          title="Zakres wyszukiwania"
          value={filters.scope}
          hidden={isCatalog && view === "upgrades"}
          onChange={(event) => {
            const scope = event.currentTarget.value as Filters["scope"]
            setFilters((state) => ({ ...state, scope }))
          }}
        >
          {searchScopes.map((scope) => (
            <option key={scope} value={scope} title={scopeLabels[scope].title}>
              {scopeLabels[scope].option}
            </option>
          ))}
        </select>
      </div>
    </form>
  )

  return (
    <div ref={root} class="app-shell" onClick={onClick}>
      <aside class="sidebar">
        <div class="sidebar-head">
          <a class="brand" href={rememberedCatalogHref(game, view, currentFilters)}>
            Divinity<span>Katalog craftingu</span>
          </a>
          <button
            class="language-toggle"
            onClick={() => setLang(lang === "pl" ? "en" : "pl")}
            aria-label={`Język przedmiotów: ${lang.toUpperCase()}`}
          >
            {lang.toUpperCase()}
          </button>
        </div>
        {search}
        <nav class="game-nav" aria-label="Tryb gry">
          {games.map((entry) => (
            <a
              key={entry.id}
              href={rememberedCatalogHref(entry.id, view, entry.id === game ? currentFilters : undefined)}
              aria-current={entry.id === game && routeOwnsFilters(route.slug) ? "page" : undefined}
            >
              {entry.label}
            </a>
          ))}
        </nav>
        <div class="filter-summary">
          <p role="status" aria-live="polite">
            {filterText || "Brak aktywnych filtrów"}
          </p>
          {filterText && <button onClick={reset}>Resetuj</button>}
        </div>
        <button
          type="button"
          class="filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls="sidebar-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {filtersOpen ? "Ukryj filtry" : "Filtry"}
          {activeFilterCount > 0 && <span class="filters-toggle-count">{activeFilterCount}</span>}
        </button>
        <div id="sidebar-filters" class="sidebar-filters" data-open={filtersOpen}>
          {game === "dos1" && catalog.data && (
            <section>
              <h3>Mój crafting</h3>
              <div class="crafting-levels">
                {CRAFTING_MAX_LEVELS.map((level) => (
                  <button
                    key={level}
                    aria-pressed={filters.craftingMax === level}
                    onClick={() =>
                      setFilters((state) => ({ ...state, craftingMax: state.craftingMax === level ? null : level }))
                    }
                  >
                    ≤ {level}
                  </button>
                ))}
              </div>
              {groupRequirementStats(catalog.data.requirements).map((group) => (
                <details key={group.label}>
                  <summary>{group.label}</summary>
                  <div class="recipe-tag-list">
                    {group.items.map((entry) => (
                      <button
                        key={entry.tag}
                        class="recipe-tag-button"
                        data-state={
                          filters.requirements.includes(entry.tag)
                            ? "include"
                            : filters.requirementsExclude.includes(entry.tag)
                              ? "exclude"
                              : "neutral"
                        }
                        onClick={() => cycle(entry.tag, "requirement")}
                        aria-pressed={filters.requirements.includes(entry.tag)}
                      >
                        {entry.tag === "-" ? "Brak wymagań" : entry.tag}
                        {filters.requirementsExclude.includes(entry.tag) && <span class="sr-only"> (wykluczone)</span>}
                        <span>({entry.count})</span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </section>
          )}
          <h3>Tagi</h3>
          {tagGroups.map((group) => (
            <details key={group.label} open={group.label === "Kategorie"}>
              <summary>{group.label}</summary>
              <TagFilterTree
                entries={group.tags}
                include={filters.include}
                exclude={filters.exclude}
                labels={labels}
                onCycle={(tag) => cycle(tag)}
              />
            </details>
          ))}
          <p class="filter-hint">
            Kliknij tag, aby uwzględnić. Kliknij ponownie, aby wykluczyć. Wybrane kategorie łączą się — wystarczy
            dopasowanie do jednej z nich. Pozostałe wybrane cechy muszą być spełnione jednocześnie.
          </p>
        </div>
      </aside>
      <main>
        <header class="main-header">
          <div>
            {isCatalog ? (
              <p class="eyebrow">{activeGame.title}</p>
            ) : isItemRoute ? (
              <nav class="breadcrumb" aria-label="Ścieżka">
                <a href={rememberedCatalogHref(game, view, currentFilters)}>{activeGame.label}</a>
                {detailCategory && (
                  <>
                    <span aria-hidden="true">›</span>
                    <a href={catalogHrefWith(game, view, { ...emptyFilters(), include: [detailCategory] })}>
                      {tagLabel(detailCategory, labels)}
                    </a>
                  </>
                )}
              </nav>
            ) : null}
            <h1>
              {isCatalog ? (
                activeGame.label
              ) : unavailablePage ? (
                "Nie znaleziono strony"
              ) : (
                <>
                  <ItemIcon icon={detailName?.icon} />
                  <LanguageName
                    page={{ title: detailName?.name ?? detail.data?.title ?? "Przedmiot", titlePl: detailName?.namePl }}
                    lang={lang}
                  />
                </>
              )}
            </h1>
          </div>
          {!isCatalog && (
            <a class="back-link" href={rememberedCatalogHref(game, view, currentFilters)}>
              ← Wróć do katalogu
            </a>
          )}
        </header>
        {(manifest.error || catalog.error) && (
          <div class="error-message" role="alert">
            {manifest.error ?? catalog.error}
            <button onClick={() => window.location.reload()}>Spróbuj ponownie</button>
          </div>
        )}
        {!catalog.data && !catalog.error && <p role="status">Wczytywanie katalogu…</p>}
        {isCatalog && catalog.data && (
          <div class="recipe-app">
            <div class="catalog-toolbar">
              <div class="recipe-view-switch" role="group" aria-label="Tryb prezentacji">
                <button class="recipe-view-btn" aria-pressed={view === "items"} onClick={() => setView("items")}>
                  Przedmioty
                </button>
                <button class="recipe-view-btn" aria-pressed={view === "recipes"} onClick={() => setView("recipes")}>
                  Receptury
                </button>
                <button class="recipe-view-btn" aria-pressed={view === "upgrades"} onClick={() => setView("upgrades")}>
                  Ulepszenia
                </button>
              </div>
              {view === "recipes" && (
                <label class="sort-select">
                  <span>Sortuj</span>
                  <select
                    value={filters.sort}
                    onChange={(event) => {
                      const sort = event.currentTarget.value as RecipeSort
                      setFilters((state) => ({ ...state, sort }))
                    }}
                  >
                    {(Object.keys(sortLabels) as RecipeSort[])
                      .filter((sort) => sort !== "level" || game === "dos1")
                      .map((sort) => (
                        <option key={sort} value={sort}>
                          {sortLabels[sort]}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <span role="status" aria-live="polite" class="result-count">
                {view === "items"
                  ? `Przedmioty: ${catalogItems(filtered).length}`
                  : view === "upgrades"
                    ? `Ulepszenia: ${upgrades.length}`
                    : `Receptury: ${filtered.length}`}
              </span>
            </div>
            {game === "dos2-overhaul" && (
              <p class="catalog-note">Przedmioty i receptury z DOS2 Definitive Edition oraz Crafting Overhaul.</p>
            )}
            {view === "upgrades" ? (
              <UpgradeTable upgrades={upgrades} labels={labels} game={game} showRequirements={game === "dos1"} />
            ) : view === "items" ? (
              <ItemTable
                recipes={filtered}
                labels={labels}
                itemHref={itemHref}
                itemRoles={manifest.data?.itemRoles?.[game]}
                descriptions={descriptions.data ?? undefined}
                lang={lang}
                pageSize={80}
              />
            ) : filtered.length ? (
              <RecipeTable
                recipes={filtered}
                catalogSlug={activeGame.slug}
                labels={labels}
                showRequirements={game === "dos1"}
                searchable
                itemRoles={manifest.data?.itemRoles?.[game]}
                pageSize={60}
              />
            ) : (
              <p class="empty-message">Brak receptur pasujących do filtrów.</p>
            )}
          </div>
        )}
        {!isCatalog && catalog.data && (
          <div class="item-detail">
            {(unavailablePage || detail.error) && (
              <div role="alert">
                <h2>Nie znaleziono strony</h2>
                <p>Sprawdź adres lub wyszukaj przedmiot w katalogu.</p>
              </div>
            )}
            {!unavailablePage && !detail.data && !detail.error && <p role="status">Wczytywanie przedmiotu…</p>}
            {isItemRoute && detail.data?.itemPage && !detail.data.categoryPage && (
              <>
                {detailDescriptionText && (
                  <section class="item-description">
                    <h2>Opis</h2>
                    <p>{detailDescriptionText}</p>
                  </section>
                )}
                <div class="detail-tags">
                  {visibleRecipeTags(detail.data.tags).map((tag) => (
                    <button key={tag} class="recipe-search-tag" data-filter-tag={tag}>
                      {tagLabel(tag, labels)}
                    </button>
                  ))}
                </div>
                {detailEffects.length > 0 && (
                  <section>
                    <h2>Efekt</h2>
                    <ul>
                      {detailEffects.map((effect) => (
                        <li key={effect}>{effect}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {detailRemarks.length > 0 && (
                  <section>
                    <h2>Uwagi</h2>
                    <ul>
                      {detailRemarks.map((remark) => (
                        <li key={remark}>{remark}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {itemRecipes.craft.length > 0 && (
                  <section>
                    <h2>Jak wytworzyć</h2>
                    <RecipeTable
                      recipes={itemRecipes.craft}
                      catalogSlug={activeGame.slug}
                      labels={labels}
                      showRequirements={game === "dos1"}
                      searchable
                      itemRoles={manifest.data?.itemRoles?.[game]}
                    />
                  </section>
                )}
                {itemRecipes.rolled.length > 0 && (
                  <section>
                    <h2>Można wylosować z</h2>
                    <RecipeTable
                      recipes={itemRecipes.rolled}
                      catalogSlug={activeGame.slug}
                      labels={labels}
                      showRequirements={game === "dos1"}
                      searchable
                      itemRoles={manifest.data?.itemRoles?.[game]}
                    />
                  </section>
                )}
                {itemUpgrades.length > 0 && (
                  <section>
                    <h2>Możliwe ulepszenia</h2>
                    <UpgradeTable
                      upgrades={itemUpgrades}
                      labels={labels}
                      game={game}
                      showRequirements={game === "dos1"}
                    />
                  </section>
                )}
                {itemRecipes.used.length > 0 && (
                  <section>
                    <h2>Do czego służy</h2>
                    <RecipeTable
                      recipes={itemRecipes.used}
                      catalogSlug={activeGame.slug}
                      labels={labels}
                      showRequirements={game === "dos1"}
                      searchable
                      itemRoles={manifest.data?.itemRoles?.[game]}
                    />
                  </section>
                )}
              </>
            )}
          </div>
        )}
        <footer>Dane z biblioteki JSON · Tłumaczenia DOS2 Definitive Edition</footer>
      </main>
      <TooltipLayer
        root={root}
        recipes={catalog.data?.recipes}
        game={game}
        lang={lang}
        routeKey={`${game}:${route.slug}:${view}`}
      />
    </div>
  )
}
