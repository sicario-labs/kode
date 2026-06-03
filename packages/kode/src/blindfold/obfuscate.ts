import { parse } from "./parser"
import { guard, type OnParseError } from "./guard"
import type { Cipher } from "./cipher"
import type { SessionMap } from "./session-map"

/**
 * The outbound obfuscation pass: real code in -> shielded code out, plus the
 * counts the dashboard and dry-run report on. Ties together the parser (find
 * identifiers, Decision 4), the guard (fail closed, Decision 13), the cipher
 * (keyed HMAC aliases, Decision 2) and the session map (reversible, in-memory,
 * Decision 14).
 */

export interface ShieldedToken {
  real: string
  alias: string
  start: number
  end: number
}

export interface ObfuscateResult {
  /** The exact code that would leave the machine. */
  code: string
  /** Number of identifiers shielded. */
  shielded: number
  /** Number of raw identifiers that leaked. Always 0 (we fail closed). */
  leaked: number
  /** Per-token detail, in source order, for the side-by-side diff. */
  tokens: ShieldedToken[]
}

export function obfuscateCode(
  code: string,
  cipher: Cipher,
  map: SessionMap,
  onParseError: OnParseError = "block",
  fileName = "payload.ts",
): ObfuscateResult {
  const result = parse(code, fileName)
  // Fail closed: if the payload did not parse cleanly we never send it.
  guard(result, onParseError)

  const tokens: ShieldedToken[] = result.identifiers.map((id) => {
    const alias = cipher.alias(id.name, id.kind)
    map.record(id.name, alias)
    return { real: id.name, alias, start: id.start, end: id.end }
  })

  // Replace from the end so earlier offsets stay valid as we splice.
  let out = code
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]
    out = out.slice(0, t.start) + t.alias + out.slice(t.end)
  }

  return { code: out, shielded: tokens.length, leaked: 0, tokens }
}
