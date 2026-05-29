import { spawn } from "child_process"
import { resolveKodeBinary } from "./gatekeeper"

export interface SubagentConfig {
  task: string
  projectDir: string
  model?: string
}

export interface SubagentResult {
  agentType: "researcher" | "test-oracle"
  status: "running" | "complete" | "failed"
  output: string
  error?: string
}

export type SubagentProgressEvent =
  | { phase: "decomposing"; task: string }
  | { phase: "agent_started"; agentType: string; description: string }
  | { phase: "agent_complete"; agentType: string; summary: string }
  | { phase: "agent_failed"; agentType: string; error: string }
  | { phase: "synthesizing"; message: string }
  | { phase: "complete"; result: string }
  | { phase: "error"; message: string }

export type SubagentProgressCallback = (event: SubagentProgressEvent) => void

export async function runOrchestrator(
  config: SubagentConfig,
  onProgress?: SubagentProgressCallback,
): Promise<string> {
  const binary = resolveKodeBinary()

  const args = [
    "run",
    config.task,
    "--project-dir", config.projectDir,
    "--orchestrate",
  ]

  if (config.model) {
    args.push("--model", config.model)
  }

  onProgress?.({ phase: "decomposing", task: config.task })

  return new Promise<string>((resolvePromise, reject) => {
    const proc = spawn(binary, args, {
      timeout: 600_000,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: config.projectDir,
    })

    let stdoutBuf = ""

    proc.stdout!.on("data", (d: Buffer) => {
      stdoutBuf += d.toString()
    })

    proc.stderr!.on("data", (d: Buffer) => {
      const lines = d.toString().split("\n").filter((l) => l.trim())
      for (const line of lines) {
        const agentStart = line.match(/^Agent: (\w+) — (.+)/)
        if (agentStart && onProgress) {
          onProgress({
            phase: "agent_started",
            agentType: agentStart[1],
            description: agentStart[2],
          })
          continue
        }

        const agentDone = line.match(/^Done: (\w+) — (.+)/)
        if (agentDone && onProgress) {
          onProgress({
            phase: "agent_complete",
            agentType: agentDone[1],
            summary: agentDone[2],
          })
          continue
        }

        const agentFail = line.match(/^Failed: (\w+) — (.+)/)
        if (agentFail && onProgress) {
          onProgress({
            phase: "agent_failed",
            agentType: agentFail[1],
            error: agentFail[2],
          })
          continue
        }

        const synthMatch = line.match(/^Synthesize:/)
        if (synthMatch && onProgress) {
          onProgress({
            phase: "synthesizing",
            message: line.slice(synthMatch[0].length).trim(),
          })
          continue
        }
      }
    })

    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(new Error(`kode binary not found at ${binary}`))
      } else {
        reject(err)
      }
    })

    proc.on("close", (code) => {
      if (code !== 0 && !stdoutBuf) {
        onProgress?.({ phase: "error", message: `Process exited with code ${code}` })
        reject(new Error(`Subagent orchestration exited with code ${code}`))
        return
      }

      try {
        const parsed = JSON.parse(stdoutBuf)
        const result = parsed.result ?? stdoutBuf
        onProgress?.({ phase: "complete", result })
        resolvePromise(result)
      } catch {
        if (stdoutBuf.trim()) {
          onProgress?.({ phase: "complete", result: stdoutBuf })
          resolvePromise(stdoutBuf)
        } else {
          const msg = `No output from orchestrator (exit code ${code})`
          onProgress?.({ phase: "error", message: msg })
          reject(new Error(msg))
        }
      }
    })
  })
}
