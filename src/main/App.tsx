import type { ItemDescription } from "./components/ItemTooltip"
import { TooltipLayer } from "./components/TooltipLayer"
import { itemIconKey } from "./domain/itemIcons"
import { ItemIcon } from "./components/ItemIcon"
import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import { ItemTable } from "./components/ItemTable"
import { RecipeTable } from "./components/RecipeTable"
import type { CatalogManifest, CatalogData, PageDetail } from "./domain/types"
import {
  catalogItems,
  formatEffectNote,
  groupCatalogByTags,
  groupRecipeTags,
  groupRequirementStats,
  itemNameKeys,
  recipeUsesItem,
  tagLabel,
  uniqueItemEffects,
  uniqueItemRemarks,
  visibleRecipeTags,
  CRAFTING_MAX_LEVELS,
} from "./domain/recipeView"
import { parseItemQuantity } from "./domain/recipeQuantity"
import { emptyFilters, filterRecipes, filtersToSearch, restoreFilters, type Filters } from "./filters"
import { catalogHref, gameForSlug, games, pageHref, routeSlug, type Game, type View } from "./routing"
import { useJson } from "./api"

const stored = (key: string, fallback: string) => {
  try {
    return sessionStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
const currentRoute = () => ({ slug: routeSlug(window.location.pathname), search: window.location.search })
function routeGame(route: ReturnType<typeof currentRoute>): Game {
  const candidate = new URLSearchParams(route.search).get("catalog") ?? stored("dos_active_catalog", "dos1")
  return gameForSlug(route.slug) ?? (games.some((entry) => entry.id === candidate) ? (candidate as Game) : "dos1")
}
function routeView(search: string): View {
  return (new URLSearchParams(search).get("view") ?? stored("crafting_catalog_view", "items")) === "recipes"
    ? "recipes"
    : "items"
}
function LanguageName({ page, lang }: { page: { title: string; titlePl?: string }; lang: string }) {
  return <>{lang === "pl" ? (page.titlePl ?? page.title) : page.title}</>
}
export function App() {
  const [route, setRoute] = useState(currentRoute)
  const [game, setGame] = useState<Game>(() => routeGame(currentRoute()))
  const [view, setView] = useState<View>(() => routeView(window.location.search))
  const [filters, setFilters] = useState<Filters>(() =>
    restoreFilters(routeGame(currentRoute()), window.location.search),
  )
  const [query, setQuery] = useState(filters.query)
  const [lang, setLang] = useState<"pl" | "en">(() => {
    try {
      return localStorage.getItem("item-lang") === "pl" ? "pl" : "en"
    } catch {
      return "en"
    }
  })
  const [pageQuery, setPageQuery] = useState("")
  const root = useRef<HTMLDivElement>(null)
  const manifest = useJson<CatalogManifest>("manifest.json")
  const catalog = useJson<CatalogData>(`catalog-${game}.json`)
  const isCatalog = !route.slug || route.slug === "index" || Boolean(gameForSlug(route.slug))
  const descriptions = useJson<Record<string, ItemDescription>>(!isCatalog ? `descriptions-${game}.json` : null)
  const canonicalSlug = manifest.data?.aliases[route.slug] ?? route.slug
  const detail = useJson<PageDetail>(isCatalog ? null : `pages/${canonicalSlug}.json`)
  const activeGame = games.find((entry) => entry.id === game)!
  const labels = useMemo(
    () => Object.fromEntries((catalog.data?.tags ?? []).map((entry) => [entry.tag, entry.label ?? entry.tag])),
    [catalog.data],
  )
  const filtered = useMemo(
    () => filterRecipes(catalog.data?.recipes ?? [], filters, labels),
    [catalog.data, filters, labels],
  )
  const tagGroups = useMemo(
    () => groupRecipeTags(catalog.data?.tags ?? [], manifest.data?.traitGroups ?? []),
    [catalog.data, manifest.data],
  )
  const itemNames = useMemo(() => {
    const index = new Map<string, { name: string; namePl?: string; icon?: string }>()
    for (const row of catalog.data?.recipes ?? []) {
      for (const item of [row.result, ...row.ingredients]) {
        if (item.slug && !index.has(item.slug)) index.set(item.slug, item)
      }
    }
    return index
  }, [catalog.data])
  const localizedPage = (page: { slug: string; title: string; titlePl?: string }) => {
    const name = itemNames.get(page.slug)
    return { title: name?.name ?? page.title, titlePl: name?.namePl ?? (game === "dos1" ? page.titlePl : undefined) }
  }
  const pageMatches = useMemo(
    () =>
      pageQuery.trim()
        ? (manifest.data?.pages ?? [])
            .filter((page) =>
              `${page.title} ${page.titlePl ?? ""}`.toLocaleLowerCase().includes(pageQuery.toLocaleLowerCase()),
            )
            .slice(0, 10)
        : [],
    [manifest.data, pageQuery],
  )
  const navigate = (url: URL) => {
    window.history.pushState({}, "", url)
    const next = currentRoute()
    const nextGame = routeGame(next)
    const nextFilters = restoreFilters(nextGame, next.search)
    setGame(nextGame)
    setView(routeView(next.search))
    setFilters(nextFilters)
    setQuery(nextFilters.query)
    setRoute(next)
    setPageQuery("")
    window.scrollTo(0, 0)
  }
  useEffect(() => {
    const pop = () => {
      const next = currentRoute()
      const nextGame = routeGame(next)
      const nextFilters = restoreFilters(nextGame, next.search)
      setRoute(next)
      setGame(nextGame)
      setView(routeView(next.search))
      setFilters(nextFilters)
      setQuery(nextFilters.query)
    }
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
  }, [filters, game, view, isCatalog])
  useEffect(() => {
    const timer = setTimeout(() => setFilters((value) => (value.query === query ? value : { ...value, query })), 150)
    return () => clearTimeout(timer)
  }, [query])
  useEffect(() => {
    document.title = isCatalog
      ? `${activeGame.label} — katalog craftingu`
      : `${detail.data?.title ?? "Przedmiot"} — Divinity`
  }, [activeGame.label, detail.data, isCatalog])

  const changeQuery = (value: string, scope: Filters["scope"] = "result") => {
    setQuery(value)
    setFilters((state) => ({ ...state, query: value, scope }))
    if (!isCatalog)
      navigate(
        new URL(`${catalogHref(game, "recipes")}&q=${encodeURIComponent(value)}&as=${scope}`, window.location.origin),
      )
  }
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const chip = event.target.closest<HTMLButtonElement>(
      "button[data-search-tag], button[data-search-effect], button[data-search-text]",
    )
    if (chip) {
      if (chip.dataset.searchTag) changeQuery(`#${chip.dataset.searchTag}`)
      else if (chip.dataset.searchEffect) changeQuery(formatEffectNote(chip.dataset.searchEffect))
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
    const yes = kind === "tag" ? "include" : "requirements"
    const no = kind === "tag" ? "exclude" : "requirementsExclude"
    const included = filters[yes].includes(tag),
      excluded = filters[no].includes(tag)
    let positive = filters[yes].filter((value) => value !== tag)
    const negative = filters[no].filter((value) => value !== tag)
    if (!included && !excluded) {
      if (kind === "tag" && tag.startsWith("Typ/")) positive = positive.filter((value) => !value.startsWith("Typ/"))
      positive.push(tag)
    } else if (included) negative.push(tag)
    const next = { ...filters, [yes]: positive, [no]: negative }
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
    filters.query ? `${filters.scope === "ingredient" ? "składnik" : "szukaj"}: ${filters.query}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
  const itemHref = (slug: string) => `${pageHref(slug)}?catalog=${game}`
  const itemRecipes = useMemo(() => {
    if (!detail.data || !catalog.data) return { craft: [], used: [] }
    const parsed = parseItemQuantity(detail.data.title)
    const keys = itemNameKeys(detail.data.title, parsed.base, detail.data.slug.split("/").at(-1))
    const baseKeys = itemNameKeys(parsed.base)
    return {
      craft: catalog.data.recipes.filter(
        (row) =>
          row.result.slug === canonicalSlug ||
          (parsed.quantities.length > 0 &&
            Boolean(row.result.quantity) &&
            [...itemNameKeys(row.result.name, row.result.namePl)].some((key) => baseKeys.has(key))),
      ),
      used: catalog.data.recipes.filter((row) => recipeUsesItem(row, canonicalSlug, keys)),
    }
  }, [detail.data, catalog.data, canonicalSlug])
  const detailName =
    itemRecipes.craft[0]?.result ??
    catalog.data?.recipes.flatMap((row) => row.ingredients).find((item) => item.slug === canonicalSlug)
  const detailDescription =
    descriptions.data?.[itemIconKey(parseItemQuantity(detailName?.name ?? detail.data?.title ?? "").base)]

  return (
    <div ref={root} class="app-shell" onClick={onClick}>
      <aside class="sidebar">
        <a class="brand" href={catalogHref(game, view)}>
          Divinity<span>Katalog craftingu</span>
        </a>
        <div class="sidebar-tools">
          <label class="sr-only" for="page-search">
            Szukaj strony
          </label>
          <input
            id="page-search"
            type="search"
            placeholder="Szukaj strony…"
            value={pageQuery}
            onInput={(event) => setPageQuery(event.currentTarget.value)}
          />
          <button
            class="language-toggle"
            onClick={() => setLang(lang === "pl" ? "en" : "pl")}
            aria-label={`Język przedmiotów: ${lang.toUpperCase()}`}
          >
            {lang.toUpperCase()}
          </button>
        </div>
        {pageMatches.length > 0 && (
          <ul class="page-search-results">
            {pageMatches.map((page) => (
              <li key={page.slug}>
                <a href={itemHref(page.slug)}>
                  <LanguageName page={localizedPage(page)} lang={lang} />
                </a>
              </li>
            ))}
          </ul>
        )}
        <nav class="game-nav" aria-label="Tryb gry">
          {games.map((entry) => (
            <a key={entry.id} href={catalogHref(entry.id, view)} aria-current={entry.id === game ? "page" : undefined}>
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
                    >
                      {entry.tag === "-" ? "Brak wymagań" : entry.tag}
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
            <div class="recipe-tag-list">
              {group.tags.map((entry) => (
                <button
                  key={entry.tag}
                  type="button"
                  class="recipe-tag-button"
                  data-state={
                    filters.include.includes(entry.tag)
                      ? "include"
                      : filters.exclude.includes(entry.tag)
                        ? "exclude"
                        : "neutral"
                  }
                  onClick={() => cycle(entry.tag)}
                >
                  <span>{entry.label?.replaceAll("-", " ") ?? tagLabel(entry.tag, labels)}</span>
                  <span class="recipe-tag-count">({entry.count})</span>
                </button>
              ))}
            </div>
          </details>
        ))}
        <p class="filter-hint">Kliknij tag, aby uwzględnić. Kliknij ponownie, aby wykluczyć.</p>
      </aside>
      <main>
        <header class="main-header">
          <div>
            <p class="eyebrow">DIVINITY: ORIGINAL SIN</p>
            <h1>
              {isCatalog ? (
                activeGame.label
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
            <a class="back-link" href={catalogHref(game, view)}>
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
              </div>
              <span role="status" aria-live="polite" class="result-count">
                {view === "items" ? `Przedmioty: ${catalogItems(filtered).length}` : `Receptury: ${filtered.length}`}
              </span>
              <div class="catalog-search">
                <div class="search-scope" role="group" aria-label="Zakres wyszukiwania">
                  <button
                    aria-pressed={filters.scope === "result"}
                    onClick={() => setFilters((state) => ({ ...state, scope: "result" }))}
                  >
                    Wynik
                  </button>
                  <button
                    aria-pressed={filters.scope === "ingredient"}
                    onClick={() => setFilters((state) => ({ ...state, scope: "ingredient" }))}
                  >
                    Składnik
                  </button>
                </div>
                <label for="recipe-search-input">Szukaj</label>
                <input
                  id="recipe-search-input"
                  type="search"
                  value={query}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                  placeholder={filters.scope === "ingredient" ? "Nazwa składnika lub #grupa" : "Nazwa, efekt lub #tag"}
                />
              </div>
            </div>
            {game === "dos2-overhaul" && (
              <p class="catalog-note">Przedmioty i receptury z DOS2 Definitive Edition oraz Crafting Overhaul.</p>
            )}
            {view === "items" ? (
              <ItemTable recipes={filtered} labels={labels} itemHref={itemHref} itemRoles={manifest.data?.itemRoles} />
            ) : (
              <RecipeSections recipes={filtered} game={game} labels={labels} roles={manifest.data?.itemRoles} />
            )}
          </div>
        )}
        {!isCatalog && catalog.data && (
          <div class="item-detail">
            {detail.error && (
              <div role="alert">
                <h2>Nie znaleziono strony</h2>
                <p>Sprawdź adres lub wyszukaj przedmiot w katalogu.</p>
              </div>
            )}
            {!detail.data && !detail.error && <p role="status">Wczytywanie przedmiotu…</p>}
            {detail.data && (
              <>
                {detail.data.itemPage && (
                  <section class="item-description">
                    <h2>Opis</h2>
                    {detailDescription ? (
                      <p>{lang === "pl" ? detailDescription.pl || detailDescription.en : detailDescription.en}</p>
                    ) : descriptions.error ? (
                      <p class="muted">Nie udało się wczytać opisu przedmiotu.</p>
                    ) : !descriptions.data ? (
                      <p class="muted" role="status">
                        Wczytywanie opisu…
                      </p>
                    ) : (
                      <p class="muted">Brak opisu w danych gry.</p>
                    )}
                  </section>
                )}
                <div class="detail-tags">
                  {visibleRecipeTags(detail.data.tags).map((tag) => (
                    <button key={tag} class="recipe-search-tag" data-search-tag={tag}>
                      {tagLabel(tag, labels)}
                    </button>
                  ))}
                </div>
                {detail.data.itemPage ? (
                  <>
                    <section>
                      <h2>Efekt</h2>
                      {uniqueItemEffects(itemRecipes.craft).length ? (
                        <ul>
                          {uniqueItemEffects(itemRecipes.craft).map((effect) => (
                            <li key={effect}>{effect}</li>
                          ))}
                        </ul>
                      ) : (
                        <p class="muted">Brak opisu efektu w danych receptur.</p>
                      )}
                    </section>
                    {uniqueItemRemarks(itemRecipes.craft).length > 0 && (
                      <section>
                        <h2>Uwagi</h2>
                        <ul>
                          {uniqueItemRemarks(itemRecipes.craft).map((remark) => (
                            <li key={remark}>{remark}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                    <section>
                      <h2>Jak wytworzyć</h2>
                      {itemRecipes.craft.length ? (
                        <RecipeTable
                          recipes={itemRecipes.craft}
                          slug={canonicalSlug}
                          catalogSlug={activeGame.slug}
                          labels={labels}
                          showRequirements={game === "dos1"}
                          searchable
                          itemRoles={manifest.data?.itemRoles}
                        />
                      ) : (
                        <p class="muted">Brak receptur w wybranym trybie gry.</p>
                      )}
                    </section>
                    <section>
                      <h2>Do czego służy</h2>
                      {itemRecipes.used.length ? (
                        <RecipeTable
                          recipes={itemRecipes.used}
                          slug={canonicalSlug}
                          catalogSlug={activeGame.slug}
                          labels={labels}
                          showRequirements={game === "dos1"}
                          searchable
                          itemRoles={manifest.data?.itemRoles}
                        />
                      ) : (
                        <p class="muted">Brak użyć jako składnik w wybranym trybie gry.</p>
                      )}
                    </section>
                  </>
                ) : (
                  <div
                    class="markdown"
                    dangerouslySetInnerHTML={{
                      __html: detail.data.html.replaceAll("__APP_BASE__/", import.meta.env.BASE_URL),
                    }}
                  />
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
function RecipeSections({
  recipes,
  game,
  labels,
  roles,
}: {
  recipes: CatalogData["recipes"]
  game: Game
  labels: Record<string, string>
  roles?: CatalogManifest["itemRoles"]
}) {
  const sections = useMemo(() => groupCatalogByTags(recipes, "recipes", labels), [recipes, labels])
  return sections.length ? (
    <div class="recipe-sections">
      {sections.map((section) => (
        <section key={section.tag}>
          <h2>{section.label}</h2>
          <RecipeTable
            recipes={section.recipes}
            slug=""
            catalogSlug={games.find((entry) => entry.id === game)!.slug}
            labels={labels}
            showRequirements={game === "dos1"}
            searchable
            itemRoles={roles}
          />
        </section>
      ))}
    </div>
  ) : (
    <p class="empty-message">Brak receptur pasujących do filtrów.</p>
  )
}
