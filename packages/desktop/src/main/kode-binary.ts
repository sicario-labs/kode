import { app } from "electron"
import { resolve } from "node:path"
import { accessSync } from "node:fs"

export function resolveDesktopKodeBinary(): string {
  const envBin = process.env.KODE_BIN
  if (envBin) {
    try {
      accessSync(envBin)
      return envBin
    } catch {}
  }

  // Packaged app path on macOS: resolve(app.getAppPath(), "..", "..", "bin", "kode")
  // Packaged app path on Windows/Linux: resolve(app.getAppPath(), "..", "bin", "kode.exe")
  // For dev: look in workspace root bin/
  const appPath = app.getAppPath()
  const names = process.platform === "win32" ? ["kode.exe", "kode"] : ["kode", "kode.exe"]
  const candidates: string[] = []
  for (const name of names) {
    candidates.push(
      resolve(appPath, "..", "bin", name),
      resolve(appPath, "..", "..", "bin", name),
      resolve(appPath, "..", "..", "..", "bin", name),
      resolve(appPath, "..", "..", "..", "..", "bin", name),
      resolve(appPath, "..", "..", "..", "..", "..", "bin", name),
    )
  }

  for (const candidate of candidates) {
    try {
      accessSync(candidate)
      return candidate
    } catch {}
  }
  return envBin || ""
}
