// @ts-ignore
import itemLangScript from "./scripts/itemLang.inline"
import styles from "./styles/itemLang.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const ItemLangToggle: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <button
      type="button"
      class={classNames(displayClass, "item-lang-toggle")}
      data-lang="en"
      aria-label="Item language: EN (click for PL)"
      title="EN → PL"
    >
      <span class="lang-en">EN</span>
      <span class="lang-pl">PL</span>
    </button>
  )
}

ItemLangToggle.beforeDOMLoaded = itemLangScript
ItemLangToggle.css = styles

export default (() => ItemLangToggle) satisfies QuartzComponentConstructor
