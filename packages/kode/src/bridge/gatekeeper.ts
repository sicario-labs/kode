import { spawn } from "child_process"
import { accessSync } from "fs"
import { writeFile, unlink } from "fs/promises"
import { resolve } from "path"
import { tmpdir } from "os"

export interface FileToVerify {
  path: string
  content: string
}

export interface VerifyResult {
  status: "PASS" | "FAIL"
  failed_files: Record<string, string>
}

export type AskHandler = (message: string, details: string) => Promise<"retry" | "force" | "abort">

export type ProgressEvent =
  | { phase: "gate"; gate: string }
  | { phase: "verify"; step: string }
  | { phase: "complete" }

export type ProgressCallback = (event: ProgressEvent) => void

export function resolveKodeBinary(): string {
  const envBin = process.env.KODE_BIN
  if (envBin) {
    const resolved = resolve(envBin)
    try {
      accessSync(resolved)
      return resolved
    } catch {
      throw new Error(`KODE_BIN is set but binary not found at: ${resolved}`)
    }
  }

  const cwd = process.cwd()
  const names = process.platform === "win32" ? ["kode.exe", "kode"] : ["kode", "kode.exe"]
  const candidates: string[] = []
  for (const name of names) {
    candidates.push(
      resolve(cwd, "bin", name),
      resolve(cwd, "..", "..", "..", "bin", name),
      resolve(cwd, "..", "..", "..", "..", "..", "bin", name),
      resolve(cwd, "node_modules", ".bin", name),
    )
  }
  for (const candidate of candidates) {
    try {
      accessSync(candidate)
      return candidate
    } catch {}
  }
  throw new Error(
    `Kode verification binary not found. Searched:\n${candidates.join("\n")}\nSet KODE_BIN to the absolute path of the kode binary.`
  )
}

export class VerificationGatekeeper {
  private binaryPath: string
  private askHandler: AskHandler
  private progressHandler: ProgressCallback | null
  private env?: Record<string, string | undefined>

  constructor(binaryPath?: string, askHandler?: AskHandler, env?: Record<string, string | undefined>) {
    this.binaryPath = binaryPath ?? resolveKodeBinary()
    this.askHandler = askHandler ?? globalAskHandler ?? defaultAskHandler
    this.progressHandler = null
    this.env = env
  }

  onProgress(cb: ProgressCallback): void {
    this.progressHandler = cb
  }

  async verify(files: FileToVerify[], blockArchitecture = false): Promise<VerifyResult> {
    const input = {
      files: Object.fromEntries(files.map((f) => [f.path, f.content])),
      block_architecture: blockArchitecture,
      architecture_rules: [],
    }

    const tmpFile = resolve(tmpdir(), `kode-verify-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
    await writeFile(tmpFile, JSON.stringify(input))

    try {
      const stdout = await new Promise<string>((resolvePromise, reject) => {
        const spawnEnv = this.env ? { ...process.env, ...this.env } : process.env
        const proc = spawn(this.binaryPath, ["verify", "--input", tmpFile, "--project-dir", process.cwd()], {
          timeout: 30000,
          stdio: ["ignore", "pipe", "pipe"],
          env: spawnEnv,
        })

        let stdoutBuf = ""

        proc.stdout!.on("data", (d: Buffer) => {
          stdoutBuf += d.toString()
        })

        proc.stderr!.on("data", (d: Buffer) => {
          const lines = d.toString().split("\n").filter((l) => l.trim())
          for (const line of lines) {
            const match = line.match(/^KODE_GATE: (\w+)/)
            if (match && this.progressHandler) {
              this.progressHandler({ phase: "gate", gate: match[1] })
            }
          }
        })

        proc.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "ENOENT") {
            reject(new Error(`kode binary not found at ${this.binaryPath}`))
          } else {
            reject(err)
          }
        })

        proc.on("close", (code) => {
          if (this.progressHandler) {
            this.progressHandler({ phase: "complete" })
          }
          resolvePromise(stdoutBuf)
        })
      })

      return JSON.parse(stdout) as VerifyResult
    } finally {
      try {
        await unlink(tmpFile)
      } catch {
        // temp file cleanup is best-effort
      }
    }
  }

  async verifyWithEscalation(
    files: FileToVerify[],
    maxAutoRetries = 2,
    blockArchitecture = false,
  ): Promise<{ approved: boolean; result: VerifyResult }> {
    // Round 1-2: auto-retry (Go engine handles the internal self-correction)
    let result = await this.verify(files, blockArchitecture)
    for (let attempt = 1; attempt <= maxAutoRetries && result.status === "FAIL"; attempt++) {
      result = await this.verify(files, blockArchitecture)
    }

    // Round 3+: human escalation
    if (result.status === "FAIL") {
      const details = Object.entries(result.failed_files)
        .map(([path, reason]) => `${path}: ${reason}`)
        .join("\n")

      const choice = await this.askHandler(
        "Verification blocked",
        `The following files failed verification:\n${details}\n\nRetry with AI correction, force apply anyway, or abort?`,
      )

      if (choice === "retry") {
        return this.verifyWithEscalation(files, 0, blockArchitecture)
      }
      if (choice === "force") {
        return { approved: true, result }
      }
      return { approved: false, result }
    }

    return { approved: true, result }
  }
}

async function defaultAskHandler(message: string, details: string): Promise<"retry" | "force" | "abort"> {
  console.error(`\n[Kode Gatekeeper] ${message}`)
  console.error(details)
  console.error("[Kode Gatekeeper] Auto-aborting (no TUI ask handler configured)")
  return "abort"
}

let globalAskHandler: AskHandler | undefined

export function setAskHandler(handler: AskHandler): void {
  globalAskHandler = handler
}

export function getAskHandler(): AskHandler | undefined {
  return globalAskHandler
}
