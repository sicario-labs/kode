/**
 * Blindfold session map — in-memory, ephemeral (Decision 14).
 *
 * This is the crown jewel: the only artifact that holds BOTH the real names and
 * their aliases. The whole pitch hinges on the answer to "where is the mapping
 * stored?" being "nowhere — it lives in memory for the session and is discarded
 * on exit." So this map:
 *  - is never written to disk,
 *  - is the single source of truth for reversing the model's response,
 *  - is cleared on process exit.
 *
 * The reverse pass implements Decision 5: aliases present in the map are
 * restored to the real name; genuinely new identifiers the model invented (not
 * in the map) are passed through untouched.
 */

export interface ReverseResult {
  text: string
  /** Count of alias occurrences mapped back to real names. */
  mapped: number
  /** Count of alias-shaped tokens that were NOT in the map (new, kept as-is). */
  passedThrough: number
}

// Matches the on-the-wire alias shapes produced by the cipher: sym_xxxx / p_xxx / T_xxx.
const ALIAS_RE = /\b(?:sym|p|T)_[0-9a-f]{3,}\b/g

export class SessionMap {
  private readonly realToAlias = new Map<string, string>()
  private readonly aliasToReal = new Map<string, string>()
  private disposed = false

  constructor() {
    // Defence in depth: ensure the map is gone the moment the process ends.
    const clear = () => this.clear()
    process.once("exit", clear)
    process.once("SIGINT", clear)
    process.once("SIGTERM", clear)
  }

  /** Record (or look up) the alias for a real name. Idempotent and stable. */
  record(real: string, alias: string): void {
    if (this.disposed) throw new Error("SessionMap used after disposal")
    if (!this.realToAlias.has(real)) this.realToAlias.set(real, alias)
    if (!this.aliasToReal.has(alias)) this.aliasToReal.set(alias, real)
  }

  aliasFor(real: string): string | undefined {
    return this.realToAlias.get(real)
  }

  realFor(alias: string): string | undefined {
    return this.aliasToReal.get(alias)
  }

  get size(): number {
    return this.realToAlias.size
  }

  /**
   * Reverse a model response: restore every known alias, leave unknown
   * alias-shaped tokens untouched (Decision 5 — reverse known, pass new
   * through).
   */
  reverse(text: string): ReverseResult {
    let mapped = 0
    let passedThrough = 0
    const out = text.replace(ALIAS_RE, (token) => {
      const real = this.aliasToReal.get(token)
      if (real !== undefined) {
        mapped++
        return real
      }
      passedThrough++
      return token
    })
    return { text: out, mapped, passedThrough }
  }

  /** Wipe the map. Called on exit; also exposed for tests. */
  clear(): void {
    this.realToAlias.clear()
    this.aliasToReal.clear()
    this.disposed = true
  }
}
