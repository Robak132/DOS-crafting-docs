import fs from "fs"
import path from "path"
import ignore from "ignore"

export type PathFilter = (filePath: string) => boolean

/** Matcher oparty o lokalne `.gitignore` — bez globby/braces. */
export async function createGitIgnoredFilter(cwd: string = process.cwd()): Promise<PathFilter> {
  const ig = ignore()
  try {
    ig.add(await fs.promises.readFile(path.join(cwd, ".gitignore"), "utf8"))
  } catch {
    // brak .gitignore
  }
  return (filePath: string) => {
    const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//, "")
    if (!normalized || normalized === ".") return false
    return ig.ignores(normalized)
  }
}
