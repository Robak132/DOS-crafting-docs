import { useEffect, useRef, useState } from "preact/hooks"

/**
 * Long lists render a page at a time: more rows are added when the end of the list comes near,
 * so the first screen shows at once. Without a page size every row renders, as on generated pages.
 */
export function useIncremental<T>(list: readonly T[], pageSize?: number) {
  const [limit, setLimit] = useState(pageSize ?? Infinity)
  const sentinel = useRef<HTMLDivElement>(null)
  // A new list (other filters) starts again from the top.
  useEffect(() => setLimit(pageSize ?? Infinity), [list, pageSize])
  useEffect(() => {
    const node = sentinel.current
    if (!pageSize || limit >= list.length || !node || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setLimit((value) => value + pageSize)
      },
      { rootMargin: "1200px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [limit, list, pageSize])
  return {
    visible: list.length > limit ? list.slice(0, limit) : list,
    hidden: Math.max(0, list.length - limit),
    sentinel,
    showAll: () => setLimit(Infinity),
  }
}
