import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { TagFilterTree } from "../../main/components/TagFilterTree"

test("selecting a subtype expands its parent and keeps sibling categories visible", () => {
  const html = renderToString(
    <TagFilterTree
      entries={[
        {
          tag: "Typ/Bron",
          count: 2,
          label: "Broń",
          children: [
            { tag: "Typ/Bron/Luki", count: 1, label: "Łuki" },
            { tag: "Typ/Bron/Kostury", count: 1, label: "Kostury" },
          ],
        },
        {
          tag: "Typ/Pancerz",
          count: 1,
          label: "Pancerze",
          children: [{ tag: "Typ/Pancerz/Buty", count: 1, label: "Buty" }],
        },
      ]}
      include={["Typ/Bron/Luki"]}
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
