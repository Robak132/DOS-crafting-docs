const STORAGE_KEY = "item-lang"
type ItemLang = "en" | "pl"

const readLang = (): ItemLang => {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === "pl" ? "pl" : "en"
}

const applyLang = (lang: ItemLang) => {
  document.documentElement.setAttribute("data-item-lang", lang)
  localStorage.setItem(STORAGE_KEY, lang)
}

applyLang(readLang())

document.addEventListener("nav", () => {
  const syncButtons = () => {
    const lang = readLang()
    document.querySelectorAll<HTMLElement>(".item-lang-toggle").forEach((btn) => {
      btn.dataset.lang = lang
      btn.setAttribute("aria-label", lang === "pl" ? "Język przedmiotów: PL (kliknij dla EN)" : "Item language: EN (click for PL)")
      btn.title = lang === "pl" ? "PL → EN" : "EN → PL"
    })
  }

  const switchLang = () => {
    applyLang(readLang() === "pl" ? "en" : "pl")
    syncButtons()
  }

  document.querySelectorAll<HTMLElement>(".item-lang-toggle").forEach((btn) => {
    btn.addEventListener("click", switchLang)
    window.addCleanup(() => btn.removeEventListener("click", switchLang))
  })
  syncButtons()
})
