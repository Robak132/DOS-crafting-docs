/** Browser regression fixture: open /src/test/tooltip-benchmark.html with npm run dev. */
import { options, render } from "preact"
import { App } from "../main/App"
import { ItemTable } from "../main/components/ItemTable"
import { RecipeTable } from "../main/components/RecipeTable"
import { TooltipLayer } from "../main/components/TooltipLayer"
import { requestJson } from "../main/api"
import "../main/styles.css"
import "../main/table.css"

const counts = { app: 0, tables: 0, layer: 0 }
const previous = options.diffed
options.diffed = (vnode) => {
  previous?.(vnode)
  const type: unknown = vnode.type
  if (type === App) counts.app++
  if (type === ItemTable || type === RecipeTable) counts.tables++
  if (type === TooltipLayer) counts.layer++
}
window.history.replaceState({}, "", import.meta.env.BASE_URL + "dos2-crafting-overhaul?view=recipes")
render(<App />, document.getElementById("app")!)
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const result = document.getElementById("benchmark-result")!
const button = document.getElementById("run-benchmark") as HTMLButtonElement
button.addEventListener("click", async () => {
  button.disabled = true
  result.textContent = "Running…"
  try {
    await Promise.all([
      requestJson("manifest.json"),
      requestJson("catalog-dos2-overhaul.json"),
      requestJson("descriptions-dos2-overhaul.json"),
    ])
    for (let attempts = 0; attempts < 120 && !document.querySelector("a.recipe-item[data-slug]"); attempts++)
      await frame()
    await frame()
    await frame()
    const links = [...document.querySelectorAll<HTMLAnchorElement>("a.recipe-item[data-slug]")]
    const link = links[0]
    if (!link) throw new Error("Catalog did not load")
    link.scrollIntoView({ block: "center" })
    await frame()
    await frame()
    const rect = link.getBoundingClientRect()
    const move = (index: number) =>
      link.dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: rect.left + 2 + (index % Math.max(1, Math.floor(rect.width - 4))),
          clientY: rect.top + 2,
        }),
      )
    const started = performance.now()
    move(0)
    for (let attempts = 0; attempts < 30 && !document.querySelector(".item-preview"); attempts++) await frame()
    const openingMs = performance.now() - started
    const tooltip = document.querySelector<HTMLElement>(".item-preview")
    if (!tooltip || tooltip.style.visibility !== "visible") throw new Error("Tooltip did not become visible")
    await frame()
    await frame()
    counts.app = counts.tables = counts.layer = 0
    const samples: number[] = []
    const positions = new Set<string>()
    for (let index = 0; index < 120; index++) {
      const before = performance.now()
      move(index)
      samples.push(performance.now() - before)
      await frame()
      positions.add(tooltip.style.transform)
    }
    const pointerCounts = { ...counts }
    samples.sort((a, b) => a - b)
    if (pointerCounts.app || pointerCounts.tables || pointerCounts.layer)
      throw new Error("Pointer movement rerendered components: " + JSON.stringify(pointerCounts))
    if (positions.size < 2) throw new Error("Tooltip did not follow the pointer")
    // A different item may update tooltip content, but still must not revisit App or tables.
    const next = links.find((candidate) => candidate.dataset.slug !== link.dataset.slug)!
    const nextRect = next.getBoundingClientRect()
    next.dispatchEvent(
      new MouseEvent("mouseover", { bubbles: true, clientX: nextRect.left + 2, clientY: nextRect.top + 2 }),
    )
    await frame()
    await frame()
    if (counts.app || counts.tables) throw new Error("Changing hovered items rerendered the catalog")
    result.textContent = JSON.stringify(
      {
        status: "PASS",
        recipeLinks: links.length,
        firstTooltipMs: +openingMs.toFixed(2),
        pointerEvents: 120,
        pointerEventMedianMs: +samples[60].toFixed(3),
        pointerEventP95Ms: +samples[114].toFixed(3),
        tooltipPositions: positions.size,
        componentRendersDuringMovement: pointerCounts,
        appRendersWhenSwitchingItems: counts.app,
        tableRendersWhenSwitchingItems: counts.tables,
      },
      null,
      2,
    )
  } catch (error) {
    result.textContent = "FAIL: " + String(error)
  } finally {
    button.disabled = false
  }
})
