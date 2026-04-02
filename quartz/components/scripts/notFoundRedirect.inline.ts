const STORAGE_KEYS = ["wfrp_filter_include", "wfrp_filter_exclude"]
const HOME_LINK_SELECTOR = "a[data-notfound-home]"

function clearFilters(): void {
  try {
    for (const key of STORAGE_KEYS) {
      sessionStorage.removeItem(key)
    }
  } catch {}
}

function handleClick(event: MouseEvent): void {
  if (document.body?.dataset?.slug !== "404") return
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }

  const target = event.target as Element | null
  const link = target?.closest(HOME_LINK_SELECTOR)
  if (!link) return

  clearFilters()
}

document.addEventListener("click", handleClick, true)
