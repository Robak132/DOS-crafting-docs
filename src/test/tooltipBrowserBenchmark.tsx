/** Browser regression fixture: open /src/test/tooltip-benchmark.html with npm run dev. */
import { options, render } from "preact"
import { App } from "../main/App"
import { ItemCatalog } from "../main/components/ItemCatalog"
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
  if (type === ItemCatalog || type === RecipeTable) counts.tables++
  if (type === TooltipLayer) counts.layer++
}
window.history.replaceState({}, "", import.meta.env.BASE_URL + "dos2-crafting-overhaul?view=items")
render(<App />, document.getElementById("app")!)
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
/** Waits frame by frame until `done` holds or the frames run out; each frame depends on the last. */
const waitFor = async (done: () => boolean, frames: number): Promise<void> => {
  if (done() || frames <= 0) return
  await frame()
  return waitFor(done, frames - 1)
}
/** Runs `step` once per frame, `count` times in order. */
const eachFrame = async (count: number, step: (index: number) => void, index = 0): Promise<void> => {
  if (index >= count) return
  step(index)
  await frame()
  return eachFrame(count, step, index + 1)
}
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
    await waitFor(() => !!document.querySelector("a.recipe-item[data-slug]"), 120)
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
    await waitFor(() => !!document.querySelector(".item-preview"), 30)
    const openingMs = performance.now() - started
    const tooltip = document.querySelector<HTMLElement>(".item-preview")
    if (tooltip?.style.visibility !== "visible") throw new Error("Tooltip did not become visible")
    await frame()
    await frame()
    counts.app = counts.tables = counts.layer = 0
    const samples: number[] = []
    const positions = new Set<string>()
    await eachFrame(120, (index) => {
      // The previous move's position is in place once its frame has run.
      if (index > 0) positions.add(tooltip.style.transform)
      const before = performance.now()
      move(index)
      samples.push(performance.now() - before)
    })
    positions.add(tooltip.style.transform)
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
