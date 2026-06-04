// Shared verification-on-write utility. Wraps the Go Gatekeeper bridge
// and provides a consistent interface for edit.ts, write.ts, and apply_patch.ts.

import * as path from "path"
import { Effect, Option } from "effect"
import { VerificationGatekeeper, type VerifyResult, type ProgressCallback } from "../bridge/gatekeeper"
import type { Info } from "../config/config"
import * as Log from "@kode/core/util/log"

const log = Log.create({ service: "verify-gate" })

const CODE_EXTENSIONS = new Set([
  ".go", ".ts", ".tsx", ".js", ".jsx",
  ".py", ".rs", ".java", ".c", ".cpp",
  ".h", ".hpp", ".cs", ".rb", ".swift",
  ".kt", ".scala", ".zig",
])

export interface VerifyFile {
  path: string
  content: string
}

export interface VerifyConfig {
  enabled?: boolean
  block_architecture?: boolean
  auto_retry?: number
}

export interface VerifyOutcome {
  /** Whether the files were approved (pass or force) */
  approved: boolean
  /** Whether verification was skipped entirely */
  skipped: boolean
  /** Raw verdict from the Go engine, if verification ran */
  result?: VerifyResult
  /** Human-readable badge text for tool output */
  badge: string
  /** Detailed failure lines for tool error output */
  failureDetails?: string
}

function isCodeFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return CODE_EXTENSIONS.has(ext)
}

function extractVerifyConfig(config?: Info): VerifyConfig {
  return {
    enabled: config?.verify?.enabled,
    block_architecture: config?.verify?.block_architecture ?? false,
    auto_retry: config?.verify?.auto_retry ?? 2,
  }
}

/**
 * Run verification-on-write for a set of files.
 *
 * Filters to code files only, spawns the Go Gatekeeper subprocess,
 * and returns a structured outcome. If verification is disabled or
 * no code files are present, returns a "skipped" outcome.
 */
import { Auth } from "../auth"

export function verifyFiles(
  files: VerifyFile[],
  config?: Info,
  onProgress?: ProgressCallback,
): Effect.Effect<VerifyOutcome, never, never> {
  return Effect.gen(function* () {
    const vc = extractVerifyConfig(config)

    // Skip if explicitly disabled
    if (vc.enabled === false) {
      return { approved: true, skipped: true, badge: "" }
    }

    // Filter to code files only
    const codeFiles = files.filter((f) => isCodeFile(f.path) && f.content.length > 0)
    if (codeFiles.length === 0) {
      return { approved: true, skipped: true, badge: "" }
    }

    const authSvcOption = yield* Effect.serviceOption(Auth.Service)
    const auths = Option.isSome(authSvcOption)
      ? yield* authSvcOption.value.all().pipe(Effect.catch(() => Effect.succeed({})))
      : ({} as any)
    const spawnEnv: Record<string, string> = {}
    
    // Copy all KODE_* environment variables from the process env
    for (const [key, val] of Object.entries(process.env)) {
      if (key.startsWith("KODE_") && val !== undefined) {
        spawnEnv[key] = val
      }
    }

    if (auths["openai"]?.type === "api") spawnEnv["OPENAI_API_KEY"] = auths["openai"].key
    if (auths["anthropic"]?.type === "api") spawnEnv["ANTHROPIC_API_KEY"] = auths["anthropic"].key
    if (auths["kode"]?.type === "api") {
      spawnEnv["KODE_PRO_API_KEY"] = auths["kode"].key
      spawnEnv["KODE_LLM_API_KEY"] = auths["kode"].key
    }
    if (auths["llmgateway"]?.type === "api") {
      spawnEnv["KODE_PRO_API_KEY"] = auths["llmgateway"].key
      spawnEnv["KODE_LLM_API_KEY"] = auths["llmgateway"].key
    }

    // If a gateway key is set, explicitly default the endpoint and model
    // to bypass the direct-DeepSeek bypass logic in the Go config loader
    if (spawnEnv["KODE_PRO_API_KEY"] || spawnEnv["KODE_LLM_API_KEY"]) {
      if (!spawnEnv["KODE_LLM_ENDPOINT"]) {
        spawnEnv["KODE_LLM_ENDPOINT"] = "https://api.trykode.xyz/v1"
      }
      if (!spawnEnv["KODE_LLM_MODEL"]) {
        spawnEnv["KODE_LLM_MODEL"] = "deepseek-v4-flash"
      }
    }

    log.info("Spawning verification gatekeeper", {
      endpoint: spawnEnv["KODE_LLM_ENDPOINT"] || "public-fallback",
      model: spawnEnv["KODE_LLM_MODEL"] || "public-fallback",
      hasProKey: Boolean(spawnEnv["KODE_PRO_API_KEY"]),
      hasLlmKey: Boolean(spawnEnv["KODE_LLM_API_KEY"]),
    })
    
    let gatekeeper: VerificationGatekeeper
    try {
      gatekeeper = new VerificationGatekeeper(undefined, undefined, spawnEnv)
    } catch {
      log.info("Verify binary not found; skipping verification")
      return { approved: true, skipped: true, badge: " [verify skipped]" }
    }
    if (onProgress) {
      gatekeeper.onProgress(onProgress)
    }

    const { approved, result } = yield* Effect.promise(() =>
      gatekeeper.verifyWithEscalation(
        codeFiles,
        vc.auto_retry ?? 2,
        vc.block_architecture ?? false,
      ),
    ).pipe(
      Effect.catch((error: any) => {
        const message = error instanceof Error ? error.message : String(error)
        return Effect.succeed({
          approved: false,
          result: {
            status: "FAIL" as const,
            failed_files: { "_verification_binary": message },
          },
        })
      }),
    )

    if (approved && result.status === "PASS") {
      return {
        approved: true,
        skipped: false,
        result,
        badge: " [✓ verified]",
      }
    }

    if (approved && result.status === "FAIL") {
      // Force-applied despite failures
      return {
        approved: true,
        skipped: false,
        result,
        badge: " [⚠ forced]",
      }
    }

    // Verification blocked
    const lines: string[] = []
    for (const [filePath, reason] of Object.entries(result.failed_files)) {
      lines.push(`  ✗ ${path.basename(filePath)}`)
      lines.push(`      ${reason}`)
    }
    const failureDetails = lines.join("\n")

    return {
      approved: false,
      skipped: false,
      result,
      badge: ` [✗ ${Object.keys(result.failed_files).length} gate(s) failed]`,
      failureDetails,
    }
  })
}

/**
 * Verify a single file. Convenience wrapper for the common case
 * in edit.ts and write.ts where only one file is being modified.
 */
export function verifySingleFile(
  filePath: string,
  content: string,
  config?: Info,
  onProgress?: ProgressCallback,
): Effect.Effect<VerifyOutcome, never, never> {
  return verifyFiles([{ path: filePath, content }], config, onProgress)
}
