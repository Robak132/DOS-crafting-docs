import path from "path"
import { glob as tinyglob } from "tinyglobby"
import { FilePath } from "./path"
import { createGitIgnoredFilter } from "./gitignore"

export function toPosixPath(fp: string): string {
  return fp.split(path.sep).join("/")
}

export async function glob(
  pattern: string,
  cwd: string,
  ignorePatterns: string[],
): Promise<FilePath[]> {
  const gitIgnored = await createGitIgnoredFilter(cwd)
  const fps = (
    await tinyglob(pattern, {
      cwd,
      ignore: ignorePatterns,
      onlyFiles: true,
    })
  )
    .map(toPosixPath)
    .filter((fp) => !gitIgnored(fp))
  return fps as FilePath[]
}
