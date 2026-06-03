import path from "node:path"
import { Global } from "@kode/core/global"
import * as Log from "@kode/core/util/log"
import { BlindfoldBlocked, liveSession, type BlindfoldConfig, type BlindfoldSession } from "./index"

/**
 * Kode-side glue for Blindfold (Decision 1): the obfuscate/de-obfuscate hooks
 * that bolt onto the existing fetch/transform wrapper. The pure engine lives in
 * the rest of `blindfold/`; this file is the only part that knows about Kode
 * paths and the AI SDK prompt shape.
 */

const log = Log.create({ service: "blindfold" })

/**
 * Stable, append-only capture log path (obfuscated payloads + counts only —
 * see capture-log.ts). The read-only dashboard tails this file.
 */
export const CAPTURE_FILE = path.join(Global.Path.state, "blindfold", "capture.jsonl")

type AnyMessage = { role: string; content: unknown }

function obfuscateContent(content: unknown, session: BlindfoldSession, bump: (n: number) => void): unknown {
  if (typeof content === "string") {
    const r = session.obfuscateMarkdown(content)
    bump(r.shielded)
    return r.text
  }
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part && typeof part === "object") {
        const p = part as Record<string, unknown>
        // text / reasoning parts carry a `.text` string.
        if (typeof p.text === "string") {
          const r = session.obfuscateMarkdown(p.text)
          bump(r.shielded)
          return { ...p, text: r.text }
        }
      }
      return part
    })
  }
  return content
}

/**
 * Obfuscate an outbound AI SDK prompt in place of the raw one. No-op (returns
 * the prompt untouched) unless Blindfold is enabled. Fail-closed: a payload that
 * cannot be fully shielded throws `BlindfoldBlocked`, which aborts the request
 * before any bytes leave — the request is recorded as blocked, never sent.
 */
export function obfuscateOutbound<T>(input: { prompt: T; config?: Partial<BlindfoldConfig>; endpoint: string }): T {
  const session = liveSession(input.config, { captureFile: CAPTURE_FILE })
  if (!session) return input.prompt

  const messages = input.prompt as unknown as AnyMessage[]
  if (!Array.isArray(messages)) return input.prompt

  try {
    let shielded = 0
    const out = messages.map((msg) => ({
      ...msg,
      content: obfuscateContent(msg.content, session, (n) => (shielded += n)),
    }))
    session.recordClean({ endpoint: input.endpoint, shielded })
    return out as unknown as T
  } catch (e) {
    if (e instanceof BlindfoldBlocked) {
      session.recordBlocked({ endpoint: input.endpoint, reason: e.reason })
      log.warn("blocked outbound request (fail-closed)", { endpoint: input.endpoint, reason: e.reason })
      throw e
    }
    throw e
  }
}

/**
 * Build a stateful reverser for a streamed model response (Decision 5). Known
 * aliases are restored to real names; new model-authored names pass through.
 *
 * Streaming-safe: an alias can straddle two deltas, so we hold back any trailing
 * run of word characters until the next delta confirms the token boundary.
 */
export function makeStreamReverser(config?: Partial<BlindfoldConfig>) {
  const session = liveSession(config, { captureFile: CAPTURE_FILE })
  if (!session) return undefined

  let carry = ""
  let mapped = 0
  let passedThrough = 0

  const flushSafe = (incoming: string): string => {
    const buf = carry + incoming
    // Find the end of the last "complete" region: everything up to the final
    // run of trailing word chars (which might be a partial alias).
    const m = /[A-Za-z0-9_]+$/.exec(buf)
    const boundary = m ? m.index : buf.length
    const safe = buf.slice(0, boundary)
    carry = buf.slice(boundary)
    const r = session.deobfuscate(safe)
    mapped += r.mapped
    passedThrough += r.passedThrough
    return r.text
  }

  return {
    /** Reverse a streamed chunk of text. */
    push(delta: string): string {
      return flushSafe(delta)
    },
    /** Flush whatever is buffered at end-of-stream and record the round-trip. */
    end(endpoint: string): string {
      const r = session.deobfuscate(carry)
      carry = ""
      mapped += r.mapped
      passedThrough += r.passedThrough
      if (mapped > 0 || passedThrough > 0) session.recordRestored({ endpoint, mapped, passedThrough })
      return r.text
    },
  }
}

export const Blindfold = {
  obfuscateOutbound,
  makeStreamReverser,
  CAPTURE_FILE,
}
