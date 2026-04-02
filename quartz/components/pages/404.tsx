import { i18n } from "../../i18n"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

const NotFound: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
  function resolveBasePath(baseUrl?: string): string {
    const raw = (baseUrl ?? "").trim()
    const trimmed = raw.replace(/^\/+|\/+$/g, "")
    if (!trimmed) return "/"
    if (/[.:]/.test(trimmed)) {
      const url = new URL(`https://${trimmed}`)
      const pathname = url.pathname.replace(/\/+$/g, "")
      return pathname || "/"
    }
    return `/${trimmed}`
  }

  const baseDir = resolveBasePath(cfg.baseUrl)
  const redirectTarget = (baseDir.endsWith("/") ? baseDir : `${baseDir}/`).split("?")[0].split("#")[0]

  return (
    <article class="popover-hint">
      <h1>404</h1>
      <p>{i18n(cfg.locale).pages.error.notFound}</p>
      <a href={redirectTarget} data-notfound-home>
        {i18n(cfg.locale).pages.error.home}
      </a>
      <script>{`try{sessionStorage.removeItem("wfrp_filter_include");sessionStorage.removeItem("wfrp_filter_exclude");}catch{};window.location.replace(${JSON.stringify(redirectTarget)});`}</script>
    </article>
  )
}

export default (() => NotFound) satisfies QuartzComponentConstructor
