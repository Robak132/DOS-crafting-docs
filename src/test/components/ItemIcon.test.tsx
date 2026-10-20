import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { ItemIcon } from "../../main/components/ItemIcon"

test("inventory images reserve space, load lazily and do not repeat the adjacent item name", () => {
  const html = renderToString(<ItemIcon icon="data/icons/example.webp" />)
  assert.ok(html.includes('src="/data/icons/example.webp"'))
  assert.match(html, / alt(?:="")?(?: |\/>)/)
  assert.ok(html.includes('width="32" height="32"'))
  assert.ok(html.includes('loading="lazy"'))
  assert.equal(renderToString(<ItemIcon />), "")
})
