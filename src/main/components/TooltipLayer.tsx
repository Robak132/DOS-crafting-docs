import type { RefObject } from "preact"
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks"
import type { RecipeItem, RecipeRow } from "../domain/recipes"
import { buildTooltipIndex } from "../domain/tooltipIndex"
import { itemDataKey } from "../domain/itemIcons"
import { tooltipPosition } from "../domain/tooltipPosition"
import { useJson } from "../api"
import { ItemTooltip, type ItemDescription } from "./ItemTooltip"

const noRecipes: RecipeRow[] = []
type ActiveTooltip = { item: RecipeItem; recipes: RecipeRow[] }

/** Owns hover state independently of App; pointer updates only move this DOM element. */
export function TooltipLayer({
  root,
  recipes,
  game,
  lang,
  routeKey,
}: {
  root: RefObject<HTMLDivElement | null>
  recipes?: RecipeRow[]
  game: string
  lang: "pl" | "en"
  routeKey: string
}) {
  const index = useMemo(() => buildTooltipIndex(recipes ?? noRecipes), [recipes])
  // Fetch alongside the catalog, rather than waiting for the first hover.
  const descriptions = useJson<Record<string, ItemDescription>>(`descriptions-${game}.json`)
  const [active, setActive] = useState<ActiveTooltip | null>(null)
  const surface = useRef<HTMLDivElement>(null)
  const activeLink = useRef<HTMLElement | null>(null)
  const activeItem = useRef<RecipeItem | null>(null)
  const pointer = useRef<{ x: number; y: number; anchor?: HTMLElement }>({ x: 0, y: 0 })
  const size = useRef({ width: 0, height: 0 })
  const frame = useRef<number | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const place = useCallback(() => {
    const element = surface.current
    if (!element) return
    const point = pointer.current
    const anchor = point.anchor?.getBoundingClientRect()
    const position = tooltipPosition(
      anchor?.left ?? point.x,
      anchor?.bottom ?? point.y,
      size.current.width,
      size.current.height,
      window.innerWidth,
      window.innerHeight,
    )
    element.style.transform = `translate3d(${position.left}px, ${position.top}px, 0)`
    element.style.visibility = "visible"
  }, [])
  const schedule = useCallback(() => {
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      place()
    })
  }, [place])

  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const keep = () => {
      clearTimeout(hideTimer.current)
      hideTimer.current = undefined
    }
    const dismiss = () => {
      keep()
      activeLink.current = null
      activeItem.current = null
      setActive(null)
    }
    const hide = () => {
      if (activeItem.current && hideTimer.current === undefined) hideTimer.current = setTimeout(dismiss, 180)
    }
    const show = (event: MouseEvent | FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest(".item-preview")) {
        keep()
        return
      }
      const link = target?.closest<HTMLElement>(".recipe-item")
      if (!link) {
        hide()
        return
      }
      keep()
      // No DOM text queries, name normalization or recipe lookups on moves within the same item.
      if (link !== activeLink.current) {
        const name = (link.querySelector(".item-lang-en") ?? link.querySelector(".item-lang"))?.textContent ?? ""
        const item = index.find(link.dataset.slug ?? "", name)
        if (!item) {
          hide()
          return
        }
        activeLink.current = link
        activeItem.current = item
        setActive({ item, recipes: index.recipesFor(item) })
      }
      if (event instanceof MouseEvent) pointer.current = { x: event.clientX, y: event.clientY }
      else pointer.current = { x: 0, y: 0, anchor: link }
      schedule()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss()
    }
    const scroll = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".item-preview")) return
      if (pointer.current.anchor) schedule()
      else dismiss()
    }
    dismiss()
    element.addEventListener("mouseover", show)
    element.addEventListener("mousemove", show, { passive: true })
    element.addEventListener("mouseleave", hide)
    element.addEventListener("focusin", show)
    element.addEventListener("focusout", hide)
    window.addEventListener("keydown", escape)
    window.addEventListener("resize", schedule)
    window.addEventListener("scroll", scroll, true)
    return () => {
      keep()
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      element.removeEventListener("mouseover", show)
      element.removeEventListener("mousemove", show)
      element.removeEventListener("mouseleave", hide)
      element.removeEventListener("focusin", show)
      element.removeEventListener("focusout", hide)
      window.removeEventListener("keydown", escape)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("scroll", scroll, true)
    }
  }, [index, root, routeKey, schedule])

  useLayoutEffect(() => {
    const element = surface.current
    if (!element) return
    const measure = () => {
      size.current = { width: element.offsetWidth, height: element.offsetHeight }
      place()
    }
    // Measure when content changes, never on each pointer event.
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [active, descriptions.data, descriptions.error, lang, place])

  return active ? (
    <ItemTooltip
      elementRef={surface}
      item={active.item}
      recipes={active.recipes}
      lang={lang}
      description={descriptions.data?.[itemDataKey(active.item)]}
    />
  ) : null
}
