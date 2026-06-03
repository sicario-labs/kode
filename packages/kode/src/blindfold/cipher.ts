import { createHmac, randomBytes } from "node:crypto"

/**
 * Blindfold cipher — keyed HMAC pseudonyms (Decision 2).
 *
 * A real identifier becomes a stable, short, semantically-empty alias:
 *
 *   getUserBalance  ->  sym_a91f
 *   account         ->  p_7c2
 *   AccountId       ->  T_4d1
 *
 * Properties that matter for the "prove the wire is clean" thesis:
 *  - Deterministic within a session: the same name maps to the same alias every
 *    time, so the model stays coherent across a multi-turn conversation.
 *  - Collision-resistant: HMAC-SHA256 truncated to enough bytes that same-kind
 *    collisions are vanishingly unlikely within a session.
 *  - Reversible only via the in-memory session map — the alias itself leaks
 *    structure (it's an identifier of some kind) but never semantics.
 *
 * The secret key is generated fresh at session startup and never persisted, so
 * even the aliases are not predictable across sessions.
 */

/** Kind of identifier, which selects the alias prefix shown on the wire. */
export type SymbolKind = "sym" | "p" | "T"

/** Hex length per kind. Mirrors the visual contract in the spec preview. */
const HEX_LEN: Record<SymbolKind, number> = {
  sym: 4, // functions / variables / members  -> sym_a91f
  p: 3, //   parameters                       -> p_7c2
  T: 3, //   types / interfaces / type params  -> T_4d1
}

export interface Cipher {
  /** Map a real identifier of the given kind to its on-the-wire alias. */
  alias(name: string, kind: SymbolKind): string
  /** The raw session key (hex). Never logged, never persisted. */
  readonly keyId: string
}

/**
 * Create a cipher bound to a freshly generated session key. Pass an explicit
 * key only for deterministic tests.
 */
export function createCipher(key?: Buffer): Cipher {
  const secret = key ?? randomBytes(32)
  // A short, non-sensitive fingerprint of the key so a session can be referenced
  // in logs without exposing the key or any mapping.
  const keyId = createHmac("sha256", secret).update("blindfold-key-id").digest("hex").slice(0, 8)

  return {
    keyId,
    alias(name, kind) {
      const digest = createHmac("sha256", secret).update(`${kind}:${name}`).digest("hex")
      return `${kind}_${digest.slice(0, HEX_LEN[kind])}`
    },
  }
}
