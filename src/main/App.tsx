import { TagFilterTree } from "./components/TagFilterTree"
import { itemDescriptionText, type ItemDescription } from "./components/ItemTooltip"
import { TooltipLayer } from "./components/TooltipLayer"
import { ItemIcon } from "./components/ItemIcon"
import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import { ItemCatalog } from "./components/ItemCatalog"
import { RecipeTable } from "./components/RecipeTable"
import { UpgradeTable } from "./components/UpgradeTable"
import { Catalog } from "./domain/catalog"
import { GroupSearch } from "./domain/groupSearch"
import type { Lang } from "./domain/item"
import { effectBullets, ItemList, ItemRecipes } from "./domain/itemList"
import { RecipeOrder } from "./domain/recipeOrder"
import { RecipeStats } from "./domain/recipeStats"
import { CRAFTING_MAX_LEVELS } from "./domain/requirements"
import { tagHierarchy } from "./domain/tagHierarchy"
import { TagLabels } from "./domain/tagLabels"
import { TagSidebar } from "./domain/tagSidebar"
import { TextKey } from "./domain/textKey"
import { SuggestionIndex } from "./domain/searchSuggestions"
import type { CatalogData, CatalogManifest, PageSummary } from "./domain/types"
import { SearchBox } from "./components/SearchBox"
import {
  emptyFilters,
  cycleFilter,
  filterRecipes,
  filtersToSearch,
  rememberedCatalogHref,
  restoreFilters,
  type Filters,
} from "./filters"
import {
  catalogHref,
  gameForSlug,
  games,
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
function storedLang(): Lang {
  try {
    return localStorage.getItem("item-lang") === "pl" ? "pl" : "en"
  } catch {
    return "en"
  }
}
function routeView(search: string): View {
  const view = new URLSearchParams(search).get("view") ?? stored("crafting_catalog_view", "items")
  return view === "items" ? view : "items"
}
function LanguageName({ page, lang }: Readonly<{ page: { title: string; titlePl?: string }; lang: string }>) {
  return <>{lang === "pl" ? (page.titlePl ?? page.title) : page.title}</>
}
function ItemHeading({
  unavailable,
  item,
  title,
  lang,
}: Readonly<{
  unavailable: boolean
  item?: { name: string; namePl?: string; icon?: string }
  title?: string
  lang: string
}>) {
  if (unavailable) return <>Nie znaleziono strony</>
  return (
    <>
      <ItemIcon icon={item?.icon} />
      <LanguageName page={{ title: item?.name ?? title ?? "Przedmiot", titlePl: item?.namePl }} lang={lang} />
    </>
  )
}
function pageTitle(gameLabel: string, isCatalog: boolean, unavailable: boolean, itemTitle?: string) {
  if (isCatalog) return `${gameLabel} — katalog craftingu`
  if (unavailable) return "Nie znaleziono strony — Divinity"
  return `${itemTitle ?? "Przedmiot"} — Divinity`
}
/** The same-site address a plain left click on a link opens, or undefined when the browser should handle it. */
function internalLink(event: MouseEvent, target: Element): URL | undefined {
  const link = target.closest<HTMLAnchorElement>("a[href]")
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return undefined
  if (link.target === "_blank" || link.getAttribute("href")?.startsWith("#")) return undefined
  const url = new URL(link.href)
  const sameSite = url.origin === window.location.origin && url.pathname.startsWith(import.meta.env.BASE_URL)
  return sameSite ? url : undefined
}
/** The active filters as one line of text for the sidebar. */
function filterSummary(filters: Filters, labels: TagLabels) {
  return [
    ...filters.include.map((tag) => labels.label(tag)),
    ...filters.exclude.map((tag) => `bez: ${labels.label(tag)}`),
    ...filters.requirements.map((value) => `wym: ${value}`),
    ...filters.requirementsExclude.map((value) => `bez wym: ${value}`),
    filters.craftingMax ? `Crafting ≤ ${filters.craftingMax}` : "",
    filters.query ? `${scopeLabels[filters.scope].filter}: ${filters.query}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
}
/** Whether anything but the tags narrows the catalog. */
function isNarrowed(filters: Filters) {
  return (
    Boolean(filters.query.trim() || filters.craftingMax !== null) ||
    filters.requirements.length > 0 ||
    filters.requirementsExclude.length > 0
  )
}
function countFilters(filters: Filters) {
  const level = filters.craftingMax === null ? 0 : 1
  return (
    filters.include.length +
    filters.exclude.length +
    filters.requirements.length +
    filters.requirementsExclude.length +
    level
  )
}
function requirementState(filters: Filters, tag: string) {
  if (filters.requirements.includes(tag)) return "include"
  return filters.requirementsExclude.includes(tag) ? "exclude" : "neutral"
}
function resultCount(items: number, recipes: number) {
  return `Przedmioty: ${items} · receptury: ${recipes}`
}
export function App() {
  const [route, setRoute] = useState(currentRoute)
  const [game, setGame] = useState<Game>(() => routeGame(currentRoute()))
  const [view, setView] = useState<View>(() => routeView(window.location.search))
  const [filters, setFilters] = useState<Filters>(() => routeFilters(currentRoute()))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [query, setQuery] = useState(filters.query)
  const [lang, setLang] = useState(storedLang)
  const root = useRef<HTMLDivElement>(null)
  const manifest = useJson<CatalogManifest>("manifest.json")
  const catalogFile = useJson<CatalogData>(`catalog-${game}.json`)
  const catalog = useMemo(() => (catalogFile.data ? new Catalog(catalogFile.data) : undefined), [catalogFile.data])
  const isCatalog = !route.slug || route.slug === "index" || Boolean(gameForSlug(route.slug))
  const itemSlug = parseItemRoute(route.slug)?.item
  const page = itemSlug
    ? manifest.data?.pages.find((entry) => entry.slug === itemSlug && pageGames(entry.tags).includes(game))
    : undefined
  const isItemRoute = Boolean(page)
  const unavailablePage = !isCatalog && Boolean(manifest.data) && !isItemRoute
  const descriptions = useJson<Record<string, ItemDescription>>(
    !isCatalog || view === "items" ? `descriptions-${game}.json` : null,
  )
  const detail: { data?: PageSummary } = { data: page }
  const activeGame = games.find((entry) => entry.id === game)!
  const labels = useMemo(() => catalog?.tagLabels() ?? new TagLabels(), [catalog])
  const grouped = useMemo(
    () =>
      // The item list also shows items no recipe makes; the recipe list shows crafts only.
      new GroupSearch(catalog?.groups ?? {}, (view === "items" ? catalog?.itemRows() : catalog?.recipes) ?? []).apply(
        filters.query,
        filters.scope,
      ),
    [catalog, filters.query, filters.scope, view],
  )
  const filtered = useMemo(
    () =>
      new RecipeOrder(filters.sort, lang).apply(
        filterRecipes(grouped.rows, { ...filters, query: grouped.query }, labels),
      ),
    [grouped, filters, labels, lang],
  )
  // Tag counts follow the search and other narrowing, but not the tags themselves: each count says how many
  // items picking that tag would add to what is shown.
  const narrowed = isNarrowed(filters)
  const liveTags = useMemo(() => {
    const tags = (view === "items" ? catalog?.itemTags : undefined) ?? catalog?.tags ?? []
    if (!narrowed) return tags
    const rows = filterRecipes(grouped.rows, { ...filters, query: grouped.query, include: [], exclude: [] }, labels)
    const counts = new Map(new RecipeStats(rows).tags().map((stat) => [stat.tag, stat.count]))
    return tags
      .map((stat) => ({ ...stat, count: counts.get(stat.tag) ?? 0 }))
      .filter((stat) => stat.count > 0 || filters.include.includes(stat.tag) || filters.exclude.includes(stat.tag))
  }, [catalog, grouped, filters, labels, narrowed, view])
  const itemRows = useMemo(() => new ItemList(filtered).rows(lang), [filtered, lang])
  const tagGroups = useMemo(
    () => new TagSidebar(manifest.data?.traitGroups).sections(liveTags),
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
    window.history.pushState({ fromApp: true }, "", url)
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
    document.title = pageTitle(activeGame.label, isCatalog, unavailablePage, detail.data?.title)
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
    const url = internalLink(event, event.target)
    if (!url) return
    event.preventDefault()
    navigate(url)
  }
  // Chips and links anywhere in the app share one delegated listener that always sees the latest state.
  const clickHandler = useRef(onClick)
  clickHandler.current = onClick
  useEffect(() => {
    const element = root.current
    if (!element) return
    const listener = (event: MouseEvent) => clickHandler.current(event)
    element.addEventListener("click", listener)
    return () => element.removeEventListener("click", listener)
  }, [])
  const cycle = (tag: string, kind: "tag" | "requirement" = "tag") => {
    const next = cycleFilter(currentFilters, tag, kind)
    if (isCatalog) setFilters(next)
    else navigate(new URL(catalogHrefWith(game, view, next), window.location.origin))
  }
  const reset = () => {
    setFilters(emptyFilters())
    setQuery("")
  }
  const filterText = filterSummary(filters, labels)
  const activeFilterCount = countFilters(filters)
  const itemRecipes = useMemo(() => {
    if (!detail.data || !catalog) return { craft: [], rolled: [], used: [], upgrades: [] }
    const { slug, title } = detail.data
    return {
      craft: catalog.recipesMaking(slug),
      rolled: catalog.recipesRolling(slug, title),
      used: catalog.recipesUsing(slug, title),
      upgrades: catalog.upgradesUsing(slug, title),
    }
  }, [detail.data, catalog])
  const itemUpgrades = useMemo(
    () => (detail.data && catalog ? catalog.upgradesFor(detail.data.tags, detail.data.slug) : []),
    [detail.data, catalog],
  )
  const detailName = detail.data && catalog?.findItem(detail.data.slug)
  const detailDescription = descriptions.data?.[detailName?.resourceKey ?? TextKey.item(detail.data?.title ?? "")]

  const detailDescriptionText = itemDescriptionText(detailDescription, lang)
  // The most specific category of the item, for the breadcrumb.
  const detailCategory = detail.data ? tagHierarchy.mainCategory(TagSidebar.visibleTags(detail.data.tags)) : undefined
  const craftNotes = new ItemRecipes(itemRecipes.craft, detailName)
  const detailEffects = effectBullets(craftNotes.effects(lang))
  const detailRemarks = craftNotes.remarks()

  const suggestionIndex = useMemo(() => {
    if (!catalog) return undefined
    const items = [
      ...catalog.recipes.flatMap((row) => [...row.obtainableItems(), ...row.ingredients]),
      ...(catalog.upgrades ?? []).flatMap((upgrade) => upgrade.ingredients),
    ]
    return new SuggestionIndex(items, catalog.groups)
  }, [catalog])
  // One search bar for the whole site: it filters the catalog, and on an item page it opens the catalog.
  const search = (
    <SearchBox
      query={query}
      lang={lang}
      suggestions={suggestionIndex}
      placeholder={scopeLabels[filters.scope].placeholder}
      onInput={(value) => {
        // On an item page typing opens the catalog with the search.
        if (!isCatalog && value.trim()) changeQuery(value, filters.scope)
        else setQuery(value)
      }}
      onSubmit={(value) => changeQuery(value, filters.scope)}
    >
      <select
        class="search-scope"
        aria-label="Zakres wyszukiwania"
        title="Zakres wyszukiwania"
        value={filters.scope}
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
    </SearchBox>
  )

  return (
    <div ref={root} class="app-shell">
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
        {/* An item page is no list to filter: the filters show only with the catalog. */}
        {isCatalog && (
          <>
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
              {game === "dos1" && catalog && (
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
                  {TagSidebar.requirementGroups(catalog.requirements).map((group) => (
                    <details key={group.label}>
                      <summary>{group.label}</summary>
                      <div class="recipe-tag-list">
                        {group.items.map((entry) => (
                          <button
                            key={entry.tag}
                            class="recipe-tag-button"
                            data-state={requirementState(filters, entry.tag)}
                            onClick={() => cycle(entry.tag, "requirement")}
                            aria-pressed={filters.requirements.includes(entry.tag)}
                          >
                            {entry.tag === "-" ? "Brak wymagań" : entry.tag}
                            {filters.requirementsExclude.includes(entry.tag) && (
                              <span class="sr-only"> (wykluczone)</span>
                            )}
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
          </>
        )}
      </aside>
      <main>
        <header class="main-header">
          <div>
            {isCatalog && <p class="eyebrow">{activeGame.title}</p>}
            {!isCatalog && isItemRoute && (
              <nav class="breadcrumb" aria-label="Ścieżka">
                <a href={rememberedCatalogHref(game, view, currentFilters)}>{activeGame.label}</a>
                {detailCategory && (
                  <>
                    <span aria-hidden="true">›</span>
                    <a href={catalogHrefWith(game, view, { ...emptyFilters(), include: [detailCategory] })}>
                      {labels.label(detailCategory)}
                    </a>
                  </>
                )}
              </nav>
            )}
            <h1>
              {isCatalog ? (
                activeGame.label
              ) : (
                <ItemHeading unavailable={unavailablePage} item={detailName} title={detail.data?.title} lang={lang} />
              )}
            </h1>
          </div>
          {!isCatalog && (
            <a
              class="back-button"
              href={rememberedCatalogHref(game, view, currentFilters)}
              onClick={(event) => {
                // Opened from the catalog: going back keeps its scroll position and filters.
                if (!(window.history.state as { fromApp?: boolean } | null)?.fromApp) return
                event.preventDefault()
                event.stopPropagation()
                window.history.back()
              }}
            >
              ← Wróć
            </a>
          )}
        </header>
        {(manifest.error || catalogFile.error) && (
          <div class="error-message" role="alert">
            {manifest.error ?? catalogFile.error}
            <button onClick={() => window.location.reload()}>Spróbuj ponownie</button>
          </div>
        )}
        {!catalog && !catalogFile.error && <output class="loading">Wczytywanie katalogu…</output>}
        {isCatalog && catalog && (
          <div class="recipe-app">
            <div class="catalog-toolbar">
              <output aria-live="polite" class="result-count">
                {resultCount(itemRows.length, filtered.filter((row) => !row.isListing).length)}
              </output>
            </div>
            {game === "dos2-overhaul" && (
              <p class="catalog-note">Przedmioty i receptury z DOS2 Definitive Edition oraz Crafting Overhaul.</p>
            )}
            {view === "items" && (
              <ItemCatalog
                rows={itemRows}
                labels={labels}
                catalogSlug={activeGame.slug}
                lang={lang}
                showRequirements={game === "dos1"}
                itemRoles={manifest.data?.itemRoles?.[game]}
                descriptions={descriptions.data ?? undefined}
                upgrades={catalog.upgrades}
                groups={catalog.groups}
                pageSize={40}
              />
            )}
          </div>
        )}
        {!isCatalog && catalog && (
          <div class="item-detail">
            {unavailablePage && (
              <div role="alert">
                <h2>Nie znaleziono strony</h2>
                <p>Sprawdź adres lub wyszukaj przedmiot w katalogu.</p>
              </div>
            )}
            {!unavailablePage && !detail.data && <output class="loading">Wczytywanie przedmiotu…</output>}
            {detail.data && (
              <>
                {detailDescriptionText && (
                  <section class="item-description">
                    <h2>Opis</h2>
                    <p>{detailDescriptionText}</p>
                  </section>
                )}
                <div class="detail-tags">
                  {TagSidebar.visibleTags(detail.data.tags).map((tag) => (
                    <button key={tag} class="recipe-search-tag" data-filter-tag={tag}>
                      {labels.label(tag)}
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
                      showTargets={false}
                    />
                  </section>
                )}
                {(itemRecipes.used.length > 0 || itemRecipes.upgrades.length > 0) && (
                  <section>
                    <h2>Do czego służy</h2>
                    {itemRecipes.used.length > 0 && (
                      <RecipeTable
                        recipes={itemRecipes.used}
                        catalogSlug={activeGame.slug}
                        labels={labels}
                        showRequirements={game === "dos1"}
                        searchable
                        itemRoles={manifest.data?.itemRoles?.[game]}
                      />
                    )}
                    {itemRecipes.upgrades.length > 0 && (
                      <>
                        <h3>W ulepszeniach</h3>
                        <UpgradeTable
                          upgrades={itemRecipes.upgrades}
                          labels={labels}
                          game={game}
                          showRequirements={game === "dos1"}
                        />
                      </>
                    )}
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
        recipes={catalog?.recipes}
        game={game}
        lang={lang}
        routeKey={`${game}:${route.slug}:${view}`}
      />
    </div>
  )
}
