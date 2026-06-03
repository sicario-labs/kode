import fs from "node:fs"
import path from "node:path"

/**
 * Blindfold capture log — what feeds the "watch the wire" dashboard (Decision
 * 6/7).
 *
 * Two tiers, by design, to honour Decision 14 (nothing sensitive at rest):
 *  - On disk: an append-only JSONL of ALREADY-OBFUSCATED payloads plus
 *    per-request counts. No real identifier ever touches disk.
 *  - In memory: richer records that also carry the real (local) code so the
 *    live dashboard can render the side-by-side. These live only as long as the
 *    process — same lifetime as the reverse map.
 */

export type CaptureStatus = "clean" | "blocked" | "restored"

/** The full in-memory record used to render the live dashboard. */
export interface CaptureRecord {
  id: number
  ts: number
  endpoint: string
  status: CaptureStatus
  shielded: number
  leaked: number
  /** For restored (inbound) records: aliases mapped back. */
  mapped?: number
  /** For restored (inbound) records: new model names passed through. */
  passedThrough?: number
  /** Block reason, when status === "blocked". */
  reason?: string
  /** The real code that stayed local (in-memory only, never persisted). */
  local?: string
  /** The exact obfuscated bytes that left the wire. */
  wire?: string
  /** Token map for the diff: real -> alias. In-memory only. */
  tokens?: { real: string; alias: string }[]
}

/** The sanitized shape written to disk — obfuscated payload + counts only. */
interface PersistedRecord {
  id: number
  ts: number
  endpoint: string
  status: CaptureStatus
  shielded: number
  leaked: number
  mapped?: number
  passedThrough?: number
  reason?: string
  wire?: string
}

export class CaptureLog {
  private readonly records: CaptureRecord[] = []
  private nextId = 1
  private readonly file?: string

  /**
   * @param file Optional path for the append-only on-disk (obfuscated-only)
   *   log. When omitted, only the in-memory tier is kept (used by `--dry-run`,
   *   which persists nothing).
   */
  constructor(file?: string) {
    this.file = file
    if (file) fs.mkdirSync(path.dirname(file), { recursive: true })
  }

  add(record: Omit<CaptureRecord, "id" | "ts">, now: number = Date.now()): CaptureRecord {
    const full: CaptureRecord = { ...record, id: this.nextId++, ts: now }
    this.records.push(full)
    this.persist(full)
    return full
  }

  private persist(full: CaptureRecord): void {
    if (!this.file) return
    // Strip everything that could reveal a real identifier before it hits disk.
    const safe: PersistedRecord = {
      id: full.id,
      ts: full.ts,
      endpoint: full.endpoint,
      status: full.status,
      shielded: full.shielded,
      leaked: full.leaked,
      mapped: full.mapped,
      passedThrough: full.passedThrough,
      reason: full.reason,
      wire: full.wire,
    }
    try {
      fs.appendFileSync(this.file, JSON.stringify(safe) + "\n")
    } catch {
      // The capture log is observability, never in the data path — a write
      // failure must not affect whether a request is sent.
    }
  }

  /** All in-memory records, newest first. */
  entries(): CaptureRecord[] {
    return [...this.records].reverse()
  }

  /** Aggregate headline numbers (Decision 9). */
  summary() {
    let requests = 0
    let shielded = 0
    let leaked = 0
    let blocked = 0
    for (const r of this.records) {
      if (r.status === "clean") {
        requests++
        shielded += r.shielded
        leaked += r.leaked
      } else if (r.status === "blocked") {
        blocked++
      }
    }
    return { requests, shielded, leaked, blocked }
  }
}
