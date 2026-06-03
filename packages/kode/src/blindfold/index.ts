import { createCipher, type Cipher } from "./cipher"
import { SessionMap } from "./session-map"
import { CaptureLog, type CaptureRecord } from "./capture-log"
import { obfuscateCode, type ObfuscateResult } from "./obfuscate"
import { BlindfoldBlocked, type OnParseError } from "./guard"

/**
 * Blindfold — "prove the wire is clean".
 *
 * A local layer that intercepts every outbound LLM request, obfuscates the
 * customer's identifiers on the way out (Decisions 2/3/4), restores them on the
 * way back (Decision 5), and proves it visibly via the capture log / dashboard
 * (Decisions 6/7). Scope is deliberately one language (TS/JS, Decision 12),
 * identifier-only redaction, fail-closed (Decision 13), in-memory map (Decision
 * 14).
 *
 * This module is the open-core engine (Decision 18): it has zero dependencies on
 * the rest of Kode and can be split into a public package later.
 */

export { BlindfoldBlocked } from "./guard"
export type { CaptureRecord, CaptureStatus } from "./capture-log"
export type { ObfuscateResult, ShieldedToken } from "./obfuscate"

export interface BlindfoldConfig {
  enabled: boolean
  language: "typescript"
  on_parse_error: OnParseError
}

export const DEFAULT_CONFIG: BlindfoldConfig = {
  enabled: false,
  language: "typescript",
  on_parse_error: "block",
}

// Code fences whose body Blindfold treats as TS/JS and shields. Only explicitly
// tagged TS/JS fences are processed; untagged fences are often pseudo-code or
// diffs that would not parse, so they pass through rather than fail closed.
const TS_FENCE_LANGS = new Set(["ts", "tsx", "js", "jsx", "javascript", "typescript", "mjs", "cjs"])
const FENCE_RE = /```([\w-]*)\n([\s\S]*?)```/g

export interface MarkdownObfuscation {
  text: string
  shielded: number
  /** True if at least one code fence was processed. */
  touched: boolean
}

export class BlindfoldSession {
  readonly config: BlindfoldConfig
  private readonly cipher: Cipher
  private readonly map: SessionMap
  readonly log: CaptureLog

  constructor(config: Partial<BlindfoldConfig> = {}, opts: { captureFile?: string; cipher?: Cipher } = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.cipher = opts.cipher ?? createCipher()
    this.map = new SessionMap()
    this.log = new CaptureLog(opts.captureFile)
  }

  /** Obfuscate a single code payload (used by `--dry-run`). Fail-closed. */
  obfuscate(code: string, fileName = "payload.ts"): ObfuscateResult {
    return obfuscateCode(code, this.cipher, this.map, this.config.on_parse_error, fileName)
  }

  /**
   * Obfuscate every TS/JS code fence inside a markdown/text blob (used by the
   * live wrapper, which extracts code blocks from message content). Prose stays
   * untouched; only identifiers inside fenced code are shielded. Fail-closed:
   * any fence that won't parse throws `BlindfoldBlocked`, blocking the request.
   */
  obfuscateMarkdown(text: string): MarkdownObfuscation {
    let shielded = 0
    let touched = false
    const out = text.replace(FENCE_RE, (whole, lang: string, body: string) => {
      if (!TS_FENCE_LANGS.has(lang.toLowerCase())) return whole
      touched = true
      const result = this.obfuscate(body, `fence.${lang || "ts"}`)
      shielded += result.shielded
      return whole.slice(0, whole.indexOf("\n") + 1) + result.code + "```"
    })
    return { text: out, shielded, touched }
  }

  /**
   * Restore a model response (Decision 5): known aliases -> real names, new
   * model-authored names passed through untouched.
   */
  deobfuscate(text: string) {
    return this.map.reverse(text)
  }

  /** Record a successfully shielded outbound request for the dashboard. */
  recordClean(input: { endpoint: string; shielded: number; local?: string; wire?: string; tokens?: ObfuscateResult["tokens"] }) {
    return this.log.add({
      endpoint: input.endpoint,
      status: "clean",
      shielded: input.shielded,
      leaked: 0,
      local: input.local,
      wire: input.wire,
      tokens: input.tokens?.map((t) => ({ real: t.real, alias: t.alias })),
    })
  }

  /** Record a blocked (never-dispatched) request for the dashboard. */
  recordBlocked(input: { endpoint: string; reason: string }): CaptureRecord {
    return this.log.add({ endpoint: input.endpoint, status: "blocked", shielded: 0, leaked: 0, reason: input.reason })
  }

  /** Record an inbound response restoration for the dashboard. */
  recordRestored(input: { endpoint: string; mapped: number; passedThrough: number }) {
    return this.log.add({
      endpoint: input.endpoint,
      status: "restored",
      shielded: 0,
      leaked: 0,
      mapped: input.mapped,
      passedThrough: input.passedThrough,
    })
  }

  summary() {
    return this.log.summary()
  }

  entries(): CaptureRecord[] {
    return this.log.entries()
  }

  get mapSize(): number {
    return this.map.size
  }
}

// --- Live (per-process) session ------------------------------------------------
// The wrapper path shares one Blindfold session for the lifetime of the process,
// so aliases stay stable across requests and the reverse map is consistent.

let live: BlindfoldSession | undefined

/**
 * Get (or lazily create) the process-wide live session. Returns `undefined`
 * when Blindfold is disabled, so the wrapper stays a strict no-op by default.
 */
export function liveSession(
  config: Partial<BlindfoldConfig> | undefined,
  opts: { captureFile?: string } = {},
): BlindfoldSession | undefined {
  if (!config?.enabled) return undefined
  if (!live) live = new BlindfoldSession(config, opts)
  return live
}

/** Test/reset hook — drops the live session so the next call rebuilds it. */
export function __resetLiveSession() {
  live = undefined
}

export { BlindfoldBlocked as Blocked }
