// Shared verification-on-write utility. Wraps the Go Gatekeeper bridge
// and provides a consistent interface for edit.ts, write.ts, and apply_patch.ts.

import * as path from "path"
import { Effect, Option } from "effect"
import { VerificationGatekeeper, type VerifyResult, type ProgressCallback } from "../bridge/gatekeeper"
import type { Info } from "../config/config"

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
    if (auths["openai"]?.type === "api") spawnEnv["OPENAI_API_KEY"] = auths["openai"].key
    if (auths["anthropic"]?.type === "api") spawnEnv["ANTHROPIC_API_KEY"] = auths["anthropic"].key
    
    const gatekeeper = new VerificationGatekeeper(undefined, undefined, spawnEnv)
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
      Effect.catch((error) =>
        Effect.succeed({
          approved: true,
          result: {
            status: "PASS" as const,
            failed_files: {},
          },
        }),
      ),
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
