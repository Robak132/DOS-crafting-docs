(() => {
  const STORAGE_INCLUDE = "wfrp_filter_include"
  const STORAGE_EXCLUDE = "wfrp_filter_exclude"

  interface FileData {
    slug: string
    title: string
    tags: string[]
    matchTags?: string[]
  }

  interface ParsedData {
    files: FileData[]
  }

  type FilterState = { include: string[]; exclude: string[] }

  let parsedData: ParsedData | null = null

  function isFilterPage(): boolean {
    const slug = document.body?.dataset?.slug
    if (slug) return slug === "index"
    const pathname = globalThis.location.pathname
    return pathname === "/" || pathname.endsWith("/index.html")
  }

  function splitCsv(value: string | null): string[] {
    return value ? value.split(",").filter(Boolean) : []
  }

  function readStoredFilters(): FilterState {
    try {
      const include = splitCsv(sessionStorage.getItem(STORAGE_INCLUDE))
      const exclude = splitCsv(sessionStorage.getItem(STORAGE_EXCLUDE))
      return { include, exclude }
    } catch {
      return { include: [], exclude: [] }
    }
  }

  function readFiltersFromUrl(): FilterState {
    const urlParams = new URLSearchParams(globalThis.location.search)
    return {
      include: splitCsv(urlParams.get("include")),
      exclude: splitCsv(urlParams.get("exclude")),
    }
  }

  function readFiltersFromUrlOrStorage(): FilterState {
    const fromUrl = readFiltersFromUrl()
    if (fromUrl.include.length > 0 || fromUrl.exclude.length > 0) {
      return fromUrl
    }
    return readStoredFilters()
  }

  function buildRelativeHref(slug: string): string {
    const normalized = slug.replace(/^\/+/, "")
    if (!normalized || normalized === "index") return "./"
    return `./${normalized}`
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  }

  function buildTagHref(tag: string): string {
    return `./?include=${encodeURIComponent(tag)}`
  }

  function buildResultsHtml(files: FileData[]): string {
    return files
      .map((file) => {
        const href = buildRelativeHref(file.slug || "")
        const tagsHtml = file.tags
          .map((tag) => {
            const safeTag = escapeHtml(tag)
            return `<li><a href="${buildTagHref(tag)}" class="internal tag-link" data-no-popover="true">${safeTag}</a></li>`
          })
          .join("")

        return `<li class="filtered-page-item"><a href="${href}" class="internal filtered-page-title" data-slug="${escapeHtml(file.slug || "")}">${escapeHtml(file.title)}</a><ul class="tags filtered-page-tags">${tagsHtml}</ul></li>`
      })
      .join("")
  }

  function applyFilterResults(
    files: FileData[],
    include: string[],
    exclude: string[],
    pagesList: HTMLElement,
  ) {
    const matchesTag = (tags: string[], target: string) =>
      tags.some((tag) => tag === target || tag.startsWith(target + "/"))

    const filtered =
      include.length === 0 && exclude.length === 0
        ? [...files]
        : files.filter((file) => {
            const candidateTags =
              file.matchTags && Array.isArray(file.matchTags) && file.matchTags.length > 0
                ? file.matchTags
                : file.tags
            if (!candidateTags || !Array.isArray(candidateTags)) return false

            const hasAllInclude = include.every((incTag) => matchesTag(candidateTags, incTag))
            const hasNoExclude = !exclude.some((excTag) => matchesTag(candidateTags, excTag))

            return (include.length > 0 ? hasAllInclude : true) && hasNoExclude
          })

    const collator = new Intl.Collator("pl", { sensitivity: "base", numeric: true })
    filtered.sort((a, b) => collator.compare(a.title, b.title))

    pagesList.innerHTML = buildResultsHtml(filtered)

    document.dispatchEvent(new CustomEvent("contentChanged", { detail: {} }))
  }

  function setupFilteredContent() {
    if (!isFilterPage()) {
      return
    }

    const dataScript = document.getElementById("filtered-tag-data")
    const container = document.getElementById("filtered-content-container")
    const pagesList = container?.querySelector(".filtered-pages-list") as HTMLElement | null

    if (!dataScript || !container || !pagesList) {
      return
    }

    try {
      parsedData = JSON.parse(dataScript.textContent || "{}")
    } catch (e) {
      console.error("FilteredTagContent: failed to parse data", e)
      return
    }

    if (!parsedData || !Array.isArray(parsedData.files)) {
      return
    }

    const { include, exclude } = readFiltersFromUrlOrStorage()
    applyFilterResults(parsedData.files, include, exclude, pagesList)
  }

  function refreshFilteredContentFromState() {
    if (!isFilterPage() || !parsedData) {
      return
    }

    const container = document.getElementById("filtered-content-container")
    const pagesList = container?.querySelector(".filtered-pages-list") as HTMLElement | null

    if (!pagesList) {
      return
    }

    const { include, exclude } = readFiltersFromUrlOrStorage()
    applyFilterResults(parsedData.files, include, exclude, pagesList)
  }

  document.addEventListener("nav", () => {
    setTimeout(() => {
      setupFilteredContent()
    }, 10)
  })

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(() => {
      setupFilteredContent()
    }, 10)
  }

  document.addEventListener("filterChanged", () => {
    refreshFilteredContentFromState()
  })
})()
