// @ts-ignore
import clipboardScript from "./scripts/clipboard.inline"
// @ts-ignore
import notFoundRedirectScript from "./scripts/notFoundRedirect.inline"
// @ts-ignore
import itemRoleTintScript from "./scripts/itemRoleTint.inline"
import clipboardStyle from "./styles/clipboard.scss"
import itemCraftRoleStyle from "./styles/itemCraftRole.scss"
import { concatenateResources } from "../util/resources"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const Body: QuartzComponent = ({ children }: QuartzComponentProps) => {
  return <div id="quartz-body">{children}</div>
}

Body.afterDOMLoaded = concatenateResources(clipboardScript, notFoundRedirectScript, itemRoleTintScript)
Body.css = concatenateResources(clipboardStyle, itemCraftRoleStyle)

export default (() => Body) satisfies QuartzComponentConstructor
