document.addEventListener("nav", () => {
  const filters = document.querySelector<HTMLDetailsElement>(".recipe-sidebar-filters")
  if (!filters) return
  const mobile = window.matchMedia("(max-width: 800px)")
  const update = () => {
    filters.open = !mobile.matches
  }
  update()
  mobile.addEventListener("change", update)
  window.addCleanup(() => mobile.removeEventListener("change", update))
})
