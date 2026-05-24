import { execFile } from "child_process"
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

function resolveKodeBinary(): string {
  const envBin = process.env.KODE_BIN
  if (envBin) return resolve(envBin)

  const cwd = process.cwd()
  const candidates = [
    resolve(cwd, "bin", "kode.exe"),
    resolve(cwd, "..", "..", "..", "bin", "kode.exe"),
    resolve(cwd, "..", "..", "..", "..", "..", "bin", "kode.exe"),
  ]
  for (const candidate of candidates) {
    try {
      accessSync(candidate)
      return candidate
    } catch {}
  }
  return candidates[0]
}

export class VerificationGatekeeper {
  private binaryPath: string
  private askHandler: AskHandler

  constructor(binaryPath?: string, askHandler?: AskHandler) {
    this.binaryPath = binaryPath ?? resolveKodeBinary()
    this.askHandler = askHandler ?? defaultAskHandler
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
      const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
        execFile(
          this.binaryPath,
          ["verify", "--input", tmpFile, "--project-dir", process.cwd()],
          { timeout: 30000 },
          (err, stdout, stderr) => {
            if (err && (err as NodeJS.ErrnoException).code === "ENOENT") {
              reject(new Error(`kode binary not found at ${this.binaryPath}`))
              return
            }
            resolvePromise({ stdout: stdout ?? "", stderr: stderr ?? "" })
          },
        )
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
