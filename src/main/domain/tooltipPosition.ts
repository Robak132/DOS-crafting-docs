/** Place the tooltip next to the pointer, flipping at screen edges. */
export function tooltipPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const gap = 16
  const margin = 8
  const left = x + gap + width <= viewportWidth - margin ? x + gap : x - width - gap
  const top = y + gap + height <= viewportHeight - margin ? y + gap : y - height - gap
  return {
    left: Math.max(margin, Math.min(left, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(top, viewportHeight - height - margin)),
  }
}
