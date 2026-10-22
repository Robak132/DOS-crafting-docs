import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { TagFilterTree } from "../../main/components/TagFilterTree"

test("selecting a subtype expands its parent and keeps sibling categories visible", () => {
  const html = renderToString(
    <TagFilterTree
      entries={[
        {
          tag: "Weapons",
          count: 2,
          label: "Broń",
          children: [
            { tag: "Bows", count: 1, label: "Łuki" },
            { tag: "Staves", count: 1, label: "Kostury" },
          ],
        },
        {
          tag: "Armour",
          count: 1,
          label: "Pancerze",
          children: [{ tag: "Boots", count: 1, label: "Buty" }],
        },
      ]}
      include={["Bows"]}
      exclude={[]}
      labels={{}}
      onCycle={() => {}}
    />,
  )
  for (const label of ["Łuki", "Kostury", "Pancerze"]) assert.ok(html.includes(label), label)
  assert.ok(html.includes('aria-label="Zwiń Broń" aria-expanded="true"'))
  assert.ok(html.includes('aria-label="Rozwiń Pancerze" aria-expanded="false"'))
  assert.ok(html.includes('data-state="include"'))
})

test("include and exclude states are exposed to assistive technology, not only by colour", () => {
  const html = renderToString(
    <TagFilterTree
      entries={[
        { tag: "Weapons", count: 2, label: "Broń" },
        { tag: "Armour", count: 1, label: "Pancerze" },
        { tag: "Magic", count: 1, label: "Magia" },
      ]}
      include={["Weapons"]}
      exclude={["Armour"]}
      labels={{}}
      onCycle={() => {}}
    />,
  )
  assert.match(html, /aria-pressed="true"[^>]*><span>Broń<\/span>/)
  assert.match(html, /<span>Pancerze<\/span><span class="sr-only"> \(wykluczone\)<\/span>/)
  assert.match(html, /aria-pressed="false"[^>]*><span>Magia<\/span>/)
})
