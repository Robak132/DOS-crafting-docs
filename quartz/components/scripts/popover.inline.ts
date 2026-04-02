import { computePosition, flip, inline, shift } from "@floating-ui/dom"
import { normalizeRelativeURLs } from "../../util/path"
import { fetchCanonical } from "./util"

const p = new DOMParser()
const POPOVER_LOCK_DELAY_MS = 1000
const POPOVER_HIDE_GRACE_MS = 120
let dismissHandlersRegistered = false

type PopoverState = {
  sourceLink: HTMLAnchorElement | null
  lockTimer?: number
  hideTimer?: number
  chargeAnimationFrame?: number
}

const popoverStates = new WeakMap<HTMLElement, PopoverState>()

function getPopoverState(popoverElement: HTMLElement): PopoverState {
  const state = popoverStates.get(popoverElement)
  if (state) return state
  const newState: PopoverState = { sourceLink: null }
  popoverStates.set(popoverElement, newState)
  return newState
}

function clearTimers(popoverElement: HTMLElement) {
  const state = getPopoverState(popoverElement)
  if (state.lockTimer !== undefined) {
    window.clearTimeout(state.lockTimer)
    state.lockTimer = undefined
  }
  if (state.hideTimer !== undefined) {
    window.clearTimeout(state.hideTimer)
    state.hideTimer = undefined
  }
  if (state.chargeAnimationFrame !== undefined) {
    window.cancelAnimationFrame(state.chargeAnimationFrame)
    state.chargeAnimationFrame = undefined
  }
}

function getChildPopovers(parentPopover: HTMLElement): HTMLElement[] {
  const allPopoverElements = [...document.querySelectorAll(".popover")]
  return allPopoverElements.filter(
    (popoverElement) =>
      popoverElement instanceof HTMLElement &&
      popoverElement.dataset.parentPopoverId === parentPopover.id,
  ) as HTMLElement[]
}

function popoverOrDescendantHovered(popoverElement: HTMLElement): boolean {
  if (popoverElement.matches(":hover")) return true
  return getChildPopovers(popoverElement).some((child) => popoverOrDescendantHovered(child))
}

function unlinkPopoverFromLinks(popoverId: string) {
  const links = [...document.querySelectorAll("a.internal")] as HTMLAnchorElement[]
  for (const link of links) {
    if (link.dataset.activePopoverId === popoverId) {
      delete link.dataset.activePopoverId
    }
  }
}

function clearPopover(popoverElement: HTMLElement) {
  const childPopovers = getChildPopovers(popoverElement)
  childPopovers.forEach((child) => clearPopover(child))

  clearTimers(popoverElement)
  popoverElement.classList.remove("active-popover")
  popoverElement.dataset.locked = "false"
  popoverElement.dataset.locking = "false"
  popoverElement.style.removeProperty("--lock-progress")
  const state = getPopoverState(popoverElement)
  state.sourceLink = null
  unlinkPopoverFromLinks(popoverElement.id)
}

function clearAllPopovers() {
  const allPopoverElements = [...document.querySelectorAll(".popover")]
  allPopoverElements.forEach((popoverElement) => {
    if (popoverElement instanceof HTMLElement) {
      clearPopover(popoverElement)
    }
  })
}

function registerGlobalDismissHandlers() {
  if (dismissHandlersRegistered) return
  dismissHandlersRegistered = true
  window.addEventListener("scroll", clearAllPopovers, { passive: true })
  window.addEventListener("resize", clearAllPopovers, { passive: true })
}

function startLockChargeAnimation(popoverElement: HTMLElement) {
  const state = getPopoverState(popoverElement)
  const startedAt = window.performance.now()
  popoverElement.style.setProperty("--lock-progress", "0")

  const tick = (now: number) => {
    if (!popoverElement.classList.contains("active-popover")) return
    const progress = Math.min((now - startedAt) / POPOVER_LOCK_DELAY_MS, 1)
    popoverElement.style.setProperty("--lock-progress", progress.toString())

    if (progress < 1) {
      state.chargeAnimationFrame = window.requestAnimationFrame(tick)
    } else {
      state.chargeAnimationFrame = undefined
    }
  }

  state.chargeAnimationFrame = window.requestAnimationFrame(tick)
}

function scheduleHideIfNotHovered(popoverElement: HTMLElement) {
  const state = getPopoverState(popoverElement)
  if (state.hideTimer !== undefined) {
    window.clearTimeout(state.hideTimer)
  }
  state.hideTimer = window.setTimeout(() => {
    if (!popoverElement.classList.contains("active-popover")) return
    const linkIsHovered = state.sourceLink?.matches(":hover") ?? false
    const popoverIsHovered = popoverOrDescendantHovered(popoverElement)
    if (!linkIsHovered && !popoverIsHovered) {
      clearPopover(popoverElement)
    }
  }, POPOVER_HIDE_GRACE_MS)
}

function registerPopoverHoverHandlers(popoverElement: HTMLElement) {
  if (popoverElement.dataset.hoverHandlersRegistered === "true") return
  popoverElement.dataset.hoverHandlersRegistered = "true"
  popoverElement.addEventListener("mouseenter", () => {
    const isLocked = popoverElement.dataset.locked === "true"
    if (!isLocked) {
      clearPopover(popoverElement)
      return
    }

    const state = getPopoverState(popoverElement)
    if (state.hideTimer !== undefined) {
      window.clearTimeout(state.hideTimer)
      state.hideTimer = undefined
    }
  })
  popoverElement.addEventListener("mouseleave", () => {
    const isLocked = popoverElement.dataset.locked === "true"
    if (isLocked) {
      scheduleHideIfNotHovered(popoverElement)
    } else {
      clearPopover(popoverElement)
    }
  })
}

async function mouseEnterHandler(
  this: HTMLAnchorElement,
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  const link = this
  if (link.dataset.noPopover === "true") {
    return
  }
  const parentPopoverCandidate = link.closest(".popover")
  const parentPopover =
    parentPopoverCandidate instanceof HTMLElement &&
    parentPopoverCandidate.dataset.locked === "true"
      ? parentPopoverCandidate
      : null

  async function setPosition(popoverElement: HTMLElement) {
    const { x, y } = await computePosition(link, popoverElement, {
      strategy: "fixed",
      middleware: [inline({ x: clientX, y: clientY }), shift(), flip()],
    })
    Object.assign(popoverElement.style, {
      transform: `translate(${x.toFixed()}px, ${y.toFixed()}px)`,
    })
  }

  function showPopover(popoverElement: HTMLElement) {
    if (!parentPopover) {
      clearAllPopovers()
    }

    clearTimers(popoverElement)
    const state = getPopoverState(popoverElement)
    state.sourceLink = link
    link.dataset.activePopoverId = popoverElement.id
    popoverElement.dataset.locked = "false"
    popoverElement.dataset.locking = "true"
    if (parentPopover) {
      popoverElement.dataset.parentPopoverId = parentPopover.id
    } else {
      delete popoverElement.dataset.parentPopoverId
    }
    registerPopoverHoverHandlers(popoverElement)
    popoverElement.classList.add("active-popover")
    setPosition(popoverElement as HTMLElement)
    // Popover content can contain internal links; register handlers so nested popovers work.
    registerPopoverHandlers()
    startLockChargeAnimation(popoverElement)
    state.lockTimer = window.setTimeout(() => {
      if (popoverElement.classList.contains("active-popover")) {
        popoverElement.dataset.locked = "true"
        popoverElement.dataset.locking = "false"
      }
    }, POPOVER_LOCK_DELAY_MS)

    if (hash !== "") {
      const targetAnchor = `#popover-internal-${hash.slice(1)}`
      const heading = popoverInner.querySelector(targetAnchor) as HTMLElement | null
      if (heading) {
        // leave ~12px of buffer when scrolling to a heading
        popoverInner.scroll({ top: heading.offsetTop - 12, behavior: "instant" })
      }
    }
  }

  const targetUrl = new URL(link.href)
  const hash = decodeURIComponent(targetUrl.hash)
  targetUrl.hash = ""
  targetUrl.search = ""
  const popoverId = `popover-${targetUrl.pathname}`
  const prevPopoverElement = document.getElementById(popoverId)
  const hasAlreadyBeenFetched = () => !!document.getElementById(popoverId)

  // dont refetch if there's already a popover
  if (hasAlreadyBeenFetched()) {
    showPopover(prevPopoverElement as HTMLElement)
    return
  }

  const response = await fetchCanonical(targetUrl).catch((err) => {
    console.error(err)
  })

  // bailout if another popover exists
  if (hasAlreadyBeenFetched()) {
    showPopover(document.getElementById(popoverId) as HTMLElement)
    return
  }

  if (!response) return
  const [contentType] = response.headers.get("Content-Type")!.split(";")
  const [contentTypeCategory, typeInfo] = contentType.split("/")

  const popoverElement = document.createElement("div")
  popoverElement.id = popoverId
  popoverElement.classList.add("popover")
  const popoverInner = document.createElement("div")
  popoverInner.classList.add("popover-inner")
  popoverInner.dataset.contentType = contentType ?? undefined
  popoverElement.appendChild(popoverInner)

  switch (contentTypeCategory) {
    case "image":
      const img = document.createElement("img")
      img.src = targetUrl.toString()
      img.alt = targetUrl.pathname

      popoverInner.appendChild(img)
      break
    case "application":
      switch (typeInfo) {
        case "pdf":
          const pdf = document.createElement("iframe")
          pdf.src = targetUrl.toString()
          popoverInner.appendChild(pdf)
          break
        default:
          break
      }
      break
    default:
      const contents = await response.text()
      const html = p.parseFromString(contents, "text/html")
      normalizeRelativeURLs(html, targetUrl)
      // prepend all IDs inside popovers to prevent duplicates
      html.querySelectorAll("[id]").forEach((el) => {
        const targetID = `popover-internal-${el.id}`
        el.id = targetID
      })
      const elts = [...html.getElementsByClassName("popover-hint")]
      if (elts.length === 0) return

      elts.forEach((elt) => popoverInner.appendChild(elt))
  }

  document.body.appendChild(popoverElement)
  showPopover(popoverElement)
}

function onLinkMouseLeave(this: HTMLAnchorElement) {
  const link = this
  const popoverId = link.dataset.activePopoverId
  if (!popoverId) return
  const popoverElement = document.getElementById(popoverId)
  if (!(popoverElement instanceof HTMLElement)) return
  const isLocked = popoverElement.dataset.locked === "true"
  if (!isLocked) {
    clearPopover(popoverElement)
    return
  }

  scheduleHideIfNotHovered(popoverElement)
}

function registerPopoverHandlers() {
  registerGlobalDismissHandlers()
  const links = [...document.querySelectorAll("a.internal")] as HTMLAnchorElement[]
  for (const link of links) {
    // Skip if already has popover handler
    if (link.dataset.popoverRegistered === "true") continue
    link.dataset.popoverRegistered = "true"

    link.addEventListener("mouseenter", mouseEnterHandler)
    link.addEventListener("mouseleave", onLinkMouseLeave)
    window.addCleanup(() => {
      link.removeEventListener("mouseenter", mouseEnterHandler)
      link.removeEventListener("mouseleave", onLinkMouseLeave)
      delete link.dataset.popoverRegistered
    })
  }
}

document.addEventListener("nav", registerPopoverHandlers)

// Listen for dynamic content changes (e.g., from TagExplorer)
document.addEventListener("contentChanged", registerPopoverHandlers)
