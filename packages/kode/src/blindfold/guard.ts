import type { ParseResult } from "./parser"

/**
 * Blindfold guard — fail-closed (Decision 13).
 *
 * This is the single most important behavioural default in the product: if
 * Blindfold cannot FULLY obfuscate a payload, the request does not leave. A
 * blocked request is an annoyance; a leaked one ends the deal. Partial
 * redaction is still leakage and is rejected here.
 *
 * The wrapper catches `BlindfoldBlocked` and converts it into a non-dispatched,
 * logged request that surfaces in the dashboard as "BLOCKED · parse failed".
 */

export type OnParseError = "block"

export class BlindfoldBlocked extends Error {
  readonly reason: string
  readonly details: string[]
  constructor(reason: string, details: string[] = []) {
    super(`Blindfold blocked request: ${reason}`)
    this.name = "BlindfoldBlocked"
    this.reason = reason
    this.details = details
  }
}

/**
 * Enforce the fail-closed contract against a parse result. Throws
 * `BlindfoldBlocked` when the payload did not parse cleanly and the policy is to
 * block (the only supported policy in this slice).
 */
export function guard(parse: ParseResult, onParseError: OnParseError = "block"): void {
  if (parse.ok) return
  // on_parse_error: block — never send a payload we could not fully shield.
  // (Block is the only supported policy in this slice; the parameter pins the
  // contract so a fail-open mode can never be added without a deliberate change.)
  if (onParseError === "block") throw new BlindfoldBlocked("parse failed", parse.errors)
}
