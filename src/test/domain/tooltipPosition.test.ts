import assert from "node:assert/strict"
import { test } from "node:test"
import { tooltipPosition } from "../../main/domain/tooltipPosition"

test("tooltip follows pointer coordinates with a small gap", () => {
  assert.deepEqual(tooltipPosition(100, 120, 440, 300, 1280, 800), { left: 116, top: 136 })
  assert.deepEqual(tooltipPosition(200, 160, 440, 300, 1280, 800), { left: 216, top: 176 })
})

test("tooltip flips beside the pointer at right and bottom edges", () => {
  assert.deepEqual(tooltipPosition(1200, 750, 440, 300, 1280, 800), { left: 744, top: 434 })
  assert.deepEqual(tooltipPosition(1200, 100, 440, 300, 1280, 800), { left: 744, top: 116 })
})

test("tooltip stays within the viewport when there is no room on either side", () => {
  assert.deepEqual(tooltipPosition(200, 200, 440, 450, 480, 500), { left: 8, top: 8 })
})
