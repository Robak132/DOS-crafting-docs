import { randomUUID } from "node:crypto"
import { defineConfig, type Plugin } from "vite"
import preact from "@preact/preset-vite"
import fs from "node:fs/promises"
import path from "node:path"
import { generateData } from "./scripts/generate-data"
import type { CatalogManifest } from "./src/main/domain/types"

export default defineConfig(({ command }) => {
  const base = `/${(process.env.VITE_BASE_PATH ?? "").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/")
  const generatedDir = path.resolve(".generated", command === "build" ? "build" : `dev-${randomUUID()}`)
  let manifest: CatalogManifest
  let outDir = "dist"
  const dataPlugin: Plugin = {
    name: "crafting-data",
    configResolved(config) {
      outDir = config.build.outDir
    },
    async buildStart() {
      if (command === "build") manifest = await generateData(generatedDir)
    },
    async configureServer(server) {
      manifest = await generateData(generatedDir)
      server.middlewares.use(async (request, response, next) => {
        let pathname: string
        try {
          pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname)
        } catch {
          return next() // malformed %-escape: let Vite answer instead of an unhandled rejection
        }
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
        // Each dev session writes to its own .generated/dev-<uuid>; do not leave them behind.
        void fs.rm(generatedDir, { recursive: true, force: true })
        server.watcher.off("add", regenerate).off("change", regenerate).off("unlink", regenerate)
      })
    },
    async closeBundle() {
      if (command !== "build") return
      await fs.cp(path.join(generatedDir, "data"), path.join(outDir, "data"), { recursive: true })
      const html = await fs.readFile(path.join(outDir, "index.html"), "utf8")
      const slugs = new Set([
        "receptury",
        "DOS2",
        "dos2-crafting-overhaul",
        ...manifest.pages.map((page) => page.slug),
        ...Object.keys(manifest.redirects),
      ])
      await Promise.all(
        [...slugs]
          .filter((slug) => slug !== "index")
          .map(async (slug) => {
            for (const filename of [path.join(outDir, slug + ".html"), path.join(outDir, slug, "index.html")]) {
              await fs.mkdir(path.dirname(filename), { recursive: true })
              await fs.writeFile(filename, html)
            }
          }),
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
      watch: { ignored: ["**/.generated/**", "**/dist/**", "**/.pak-work/**"] },
    },
  }
})
