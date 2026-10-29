import { defineConfig, type Plugin } from "vite"
import preact from "@preact/preset-vite"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { generateData } from "./scripts/generate-data"
import type { CatalogManifest } from "./src/main/domain/types"
import { games, itemPath, pageGames } from "./src/main/routing"

export default defineConfig(({ command }) => {
  const basePath = (process.env.VITE_BASE_PATH ?? "").split("/").filter(Boolean).join("/")
  const base = basePath ? `/${basePath}/` : "/"
  // The dev server keeps generated data in a temporary folder outside the repository.
  let generatedDir = ""
  let manifest: CatalogManifest
  let outDir = "dist"
  const dataPlugin: Plugin = {
    name: "crafting-data",
    configResolved(config) {
      outDir = config.build.outDir
    },
    async configureServer(server) {
      generatedDir = await fs.mkdtemp(path.join(os.tmpdir(), "dos-crafting-dev-"))
      manifest = await generateData(generatedDir)
      server.middlewares.use(async (request, response, next) => {
        let url: URL
        let pathname: string
        try {
          url = new URL(request.url ?? "/", "http://localhost")
          pathname = decodeURIComponent(url.pathname)
        } catch {
          return next() // malformed %-escape: let Vite answer instead of an unhandled rejection
        }
        if (url.searchParams.has("import")) return next()
        const local = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, "")
        if (!local.startsWith("data/")) return next()
        const filename = path.resolve(generatedDir, local)
        if (!filename.startsWith(generatedDir + path.sep)) return next()
        try {
          response.setHeader(
            "Content-Type",
            filename.endsWith(".webp") ? "image/webp" : "application/json; charset=utf-8",
          )
          response.setHeader("Cache-Control", "no-cache")
          response.end(await fs.readFile(filename))
        } catch {
          response.statusCode = 404
          response.end("Nie znaleziono danych")
        }
      })
      server.watcher.add(["data", "assets/item-icons"])
      let timer: ReturnType<typeof setTimeout> | undefined
      let queue = Promise.resolve()
      const regenerate = (filename: string) => {
        const local = path.relative(process.cwd(), filename)
        if (!local.startsWith("data/") && !local.startsWith("assets/item-icons/")) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          queue = queue
            .then(async () => {
              manifest = await generateData(generatedDir)
              server.ws.send({ type: "full-reload" })
            })
            .catch((error) => server.config.logger.error(String(error)))
        }, 150)
      }
      server.watcher.on("add", regenerate).on("change", regenerate).on("unlink", regenerate)
      server.httpServer?.once("close", () => {
        clearTimeout(timer)
        void fs.rm(generatedDir, { recursive: true, force: true })
        server.watcher.off("add", regenerate).off("change", regenerate).off("unlink", regenerate)
      })
    },
    async closeBundle() {
      if (command !== "build") return
      manifest = await generateData(outDir)
      const html = await fs.readFile(path.join(outDir, "index.html"), "utf8")
      // One folder per game: <catalog>.html is the catalog, <catalog>/<item>.html its item pages.
      const slugs = new Set([
        ...games.map((game) => game.slug),
        ...manifest.pages.flatMap((page) => pageGames(page.tags).map((game) => itemPath(game, page.slug))),
      ])
      await Promise.all(games.map((game) => fs.mkdir(path.join(outDir, game.slug), { recursive: true })))
      await Promise.all(
        // GitHub Pages serves /slug from slug.html; 404.html covers every other address.
        [...slugs].map((slug) => fs.writeFile(path.join(outDir, slug + ".html"), html)),
      )
      await fs.writeFile(path.join(outDir, "404.html"), html)
      await fs.writeFile(path.join(outDir, ".nojekyll"), "")
      console.log(`GitHub Pages: gotowe strony dla ${slugs.size} adresów; base=${base}`)
    },
  }
  return {
    base,
    publicDir: false,
    plugins: [preact(), dataPlugin],
    build: { outDir: "dist" },
    server: {
      host: "127.0.0.1",
      port: 5173,
      watch: { ignored: ["**/dist/**", "**/.pak-work/**"] },
    },
  }
})
