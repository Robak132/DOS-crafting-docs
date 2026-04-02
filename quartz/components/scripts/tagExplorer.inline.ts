(() => {
  type TagStateValue = "neutral" | "include" | "exclude"

  const STORAGE_INCLUDE = "wfrp_filter_include"
  const STORAGE_EXCLUDE = "wfrp_filter_exclude"

  function getNextState(currentState: string): TagStateValue {
    switch (currentState) {
      case "neutral":
        return "include"
      case "include":
        return "exclude"
      case "exclude":
        return "neutral"
      default:
        return "neutral"
    }
  }

  function isFilterPagePath(): boolean {
    const slug = document.body?.dataset?.slug
    if (slug) return slug === "index"
    const pathname = globalThis.location.pathname
    return pathname === "/" || pathname.endsWith("/index.html")
  }

  function splitCsv(value: string | null): string[] {
    return value ? value.split(",").filter(Boolean) : []
  }

  function readStoredFilters(): { include: string[]; exclude: string[] } {
    try {
      const include = splitCsv(sessionStorage.getItem(STORAGE_INCLUDE))
      const exclude = splitCsv(sessionStorage.getItem(STORAGE_EXCLUDE))
      return { include, exclude }
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

  function getBasePath(): string {
    const rawBase = document.body?.dataset?.baseUrl ?? ""
    const trimmed = rawBase.replace(/^\/+|\/+$/g, "")
    return trimmed ? `/${trimmed}/` : "/"
  }

  function navigateTo(url: URL) {
    const spaNavigate = (globalThis as any).spaNavigate as ((url: URL) => Promise<void>) | undefined
    if (typeof spaNavigate === "function") {
      void spaNavigate(url)
      return
    }
    globalThis.location.assign(url)
  }

  function setupTagExplorer() {
    const toggle = document.querySelector(".tag-explorer-toggle")
    const content = document.getElementById("tag-explorer-content")
    const tagButtons = document.querySelectorAll<HTMLButtonElement>(".tag-button")
    const resetBtn = document.querySelector<HTMLButtonElement>(".reset-filters-btn")
    const filtersLabel = document.querySelector<HTMLElement>(".filters-label")
    const explorerRoot = document.querySelector<HTMLElement>(".tag-explorer")

    const previousCleanup = (explorerRoot as any)?.tagExplorerCleanup
    if (typeof previousCleanup === "function") {
      previousCleanup()
    }
    if (explorerRoot) {
      explorerRoot.dataset.initialized = "true"
    }

    if (!tagButtons || tagButtons.length === 0) {
      return
    }

    const tagStates = new Map<string, TagStateValue>()
    const isFilterPage = isFilterPagePath()
    const stored = readStoredFilters()
    const urlIncludeTags = stored.include
    const urlExcludeTags = stored.exclude

    tagButtons.forEach((btn) => {
      btn.dataset.state = "neutral"
      const btnTag = btn.dataset.tag

      if (isFilterPage && btnTag) {
        if (urlIncludeTags.includes(btnTag)) {
          btn.dataset.state = "include"
          tagStates.set(btnTag, "include")
        } else if (urlExcludeTags.includes(btnTag)) {
          btn.dataset.state = "exclude"
          tagStates.set(btnTag, "exclude")
        }
      }
    })

    function getTagsFromState() {
      const include: string[] = []
      const exclude: string[] = []
      tagStates.forEach((state, tag) => {
        if (state === "include") include.push(tag)
        if (state === "exclude") exclude.push(tag)
      })
      return { include, exclude }
    }

    function updateFilterUI() {
      const { include, exclude } = getTagsFromState()
      const hasFilters = include.length > 0 || exclude.length > 0

      if (resetBtn) {
        resetBtn.style.display = hasFilters ? "inline-block" : "none"
      }

      if (filtersLabel) {
        if (hasFilters) {
          const includeText = include.length > 0 ? include.join(", ") : ""
          const excludeText = exclude.length > 0 ? "bez: " + exclude.join(", ") : ""
          filtersLabel.textContent = [includeText, excludeText].filter(Boolean).join(" | ")
        } else {
          filtersLabel.textContent = ""
        }
      }
    }

    function updateFilters() {
      const { include, exclude } = getTagsFromState()
      const hasFilters = include.length > 0 || exclude.length > 0

      writeStoredFilters(include, exclude)

      if (isFilterPage) {
        document.dispatchEvent(new CustomEvent("filterChanged", { detail: {} }))
        return
      }

      if (hasFilters) {
        const basePath = getBasePath()
        const targetUrl = new URL(basePath, globalThis.location.origin)
        navigateTo(targetUrl)
      }
    }

    updateFilterUI()

    let toggleHandler: (() => void) | null = null
    if (toggle && content) {
      toggleHandler = () => {
        const expanded = toggle.getAttribute("aria-expanded") === "true"
        toggle.setAttribute("aria-expanded", String(!expanded))
        content.classList.toggle("collapsed", expanded)
        toggle.querySelector(".fold")?.classList.toggle("collapsed", expanded)
      }
      toggle.addEventListener("click", toggleHandler)
    }

    const buttonClickHandlers = new Map<HTMLButtonElement, () => void>()
    tagButtons.forEach((btn) => {
      const handler = () => {
        const tag = btn.dataset.tag
        if (!tag) return

        const currentState = btn.dataset.state || "neutral"
        const nextState = getNextState(currentState)

        btn.dataset.state = nextState

        if (nextState === "neutral") {
          tagStates.delete(tag)
        } else {
          tagStates.set(tag, nextState)
        }

        updateFilterUI()
        updateFilters()
      }
      btn.addEventListener("click", handler)
      buttonClickHandlers.set(btn, handler)
    })

    let resetHandler: (() => void) | null = null
    if (resetBtn) {
      resetHandler = () => {
        tagStates.clear()
        tagButtons.forEach((btn) => {
          btn.dataset.state = "neutral"
        })
        updateFilterUI()
        writeStoredFilters([], [])

        if (isFilterPage) {
          globalThis.history.replaceState({}, "", globalThis.location.pathname)
          document.dispatchEvent(new CustomEvent("filterChanged", { detail: {} }))
        }
      }
      resetBtn.addEventListener("click", resetHandler)
    }

    const tagLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const link = target?.closest("a.tag-link") as HTMLAnchorElement | null
      const tag = link?.dataset?.tagFilter
      if (!tag) return
      writeStoredFilters([tag], [])
    }
    document.addEventListener("click", tagLinkClick)
    ;(globalThis as any).addCleanup?.(() => document.removeEventListener("click", tagLinkClick))

    const pageTitleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const link = target?.closest(".page-title a") as HTMLAnchorElement | null
      if (!link) return
      writeStoredFilters([], [])
    }
    document.addEventListener("click", pageTitleClick)
    ;(globalThis as any).addCleanup?.(() => document.removeEventListener("click", pageTitleClick))

    function cleanup() {
      if (toggle && toggleHandler) {
        toggle.removeEventListener("click", toggleHandler)
      }
      buttonClickHandlers.forEach((handler, btn) => {
        btn.removeEventListener("click", handler)
      })
      buttonClickHandlers.clear()
      if (resetBtn && resetHandler) {
        resetBtn.removeEventListener("click", resetHandler)
      }
      document.removeEventListener("click", pageTitleClick)
      tagStates.clear()
      if (explorerRoot) {
        delete (explorerRoot as any).tagExplorerCleanup
        delete explorerRoot.dataset.initialized
      }
    }

    if (explorerRoot) {
      ;(explorerRoot as any).tagExplorerCleanup = cleanup
    }

    ;(globalThis as any).addCleanup?.(cleanup)
  }

  document.addEventListener("nav", () => {
    setupTagExplorer()
  })

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setupTagExplorer()
  }
})()
