import type { ItemCraftRole } from "../recipeView"

const ROLE_CLASSES = ["item-craft-dead", "item-craft-mid", "item-craft-end"] as const

let rolesPromise: Promise<Record<string, ItemCraftRole>> | null = null

function itemRolesUrl(): string {
  for (const script of Array.from(document.querySelectorAll("script"))) {
    const match = script.textContent?.match(/fetch\("([^"]*static\/contentIndex\.json)"\)/)
    if (match) return match[1].replace("contentIndex.json", "itemRoles.json")
  }
  return "static/itemRoles.json"
}

function loadRoles(): Promise<Record<string, ItemCraftRole>> {
  if (!rolesPromise) {
    rolesPromise = fetch(itemRolesUrl())
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}))
  }
  return rolesPromise
}

function applyRoleClass(el: Element, role: ItemCraftRole | undefined) {
  for (const cls of ROLE_CLASSES) el.classList.remove(cls)
  if (role) el.classList.add(`item-craft-${role}`)
}

function slugFromAnchor(anchor: HTMLElement): string | null {
  const dataSlug = anchor.getAttribute("data-slug")
  if (dataSlug) return dataSlug
  const href = anchor.getAttribute("href")
  if (!href || href.startsWith("#") || href.startsWith("mailto:")) return null
  try {
    const path = decodeURIComponent(new URL(href, window.location.href).pathname)
      .replace(/\/$/, "")
      .replace(/^\//, "")
    return path || null
  } catch {
    return null
  }
}

function tintLinks(roles: Record<string, ItemCraftRole>) {
  document.querySelectorAll<HTMLElement>("a.internal").forEach((anchor) => {
    if (anchor.classList.contains("tag-link") || anchor.classList.contains("recipe-effect-chip")) return
    const slug = slugFromAnchor(anchor)
    applyRoleClass(anchor, slug ? roles[slug] : undefined)
  })
}

document.addEventListener("nav", () => {
  void loadRoles().then((roles) => {
    tintLinks(roles)
    const tableBody = document.querySelector(".recipe-table-body")
    if (!tableBody) return
    const observer = new MutationObserver(() => tintLinks(roles))
    observer.observe(tableBody, { childList: true, subtree: true })
    window.addCleanup(() => observer.disconnect())
  })
})
