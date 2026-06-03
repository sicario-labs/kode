import fs from "node:fs"
import { Effect } from "effect"
import { effectCmd, fail } from "../effect-cmd"
import { Config } from "@/config/config"
import { BlindfoldSession, BlindfoldBlocked, type BlindfoldConfig } from "@/blindfold"
import { CAPTURE_FILE } from "@/blindfold/wrapper"
import { renderDashboard, type DiffData } from "@/blindfold/dashboard"
import type { CaptureRecord } from "@/blindfold/capture-log"

// ANSI helpers (no dependency; the CLI already prints raw ANSI elsewhere).
const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

const DEFAULTS: BlindfoldConfig = { enabled: false, language: "typescript", on_parse_error: "block" }

function resolveConfig(raw: Config.Info["blindfold"]): BlindfoldConfig {
  return {
    enabled: raw?.enabled ?? DEFAULTS.enabled,
    language: raw?.language ?? DEFAULTS.language,
    on_parse_error: raw?.on_parse_error ?? DEFAULTS.on_parse_error,
  }
}

function readPersisted(file: string): CaptureRecord[] {
  try {
    const text = fs.readFileSync(file, "utf8")
    return text
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as CaptureRecord)
  } catch {
    return []
  }
}

export const BlindfoldCommand = effectCmd({
  command: "blindfold [file]",
  describe: "shield identifiers from cloud LLMs — dry-run a file or serve the watch-the-wire dashboard",
  builder: (yargs) =>
    yargs
      .positional("file", { describe: "TypeScript/JavaScript file to dry-run", type: "string" })
      .option("dry-run", {
        describe: "print the exact before/after that would leave the wire (sends nothing)",
        type: "boolean",
        default: false,
      })
      .option("dashboard", {
        describe: "serve the read-only watch-the-wire dashboard on localhost",
        type: "boolean",
        default: false,
      })
      .option("port", { describe: "dashboard port", type: "number", default: 7878 }),
  handler: Effect.fn("Cli.blindfold")(function* (args) {
    const config = yield* Config.Service
    const cfg = yield* config.get()
    const blindfold = resolveConfig(cfg.blindfold)

    if (args.dashboard) {
      yield* serveDashboard(blindfold, args.port as number)
      return
    }

    const file = args.file as string | undefined
    if (!file) return yield* fail("usage: kode blindfold --dry-run <file>  |  kode blindfold --dashboard")

    yield* dryRun(file, blindfold)
  }),
})

const dryRun = Effect.fn("Cli.blindfold.dryRun")(function* (file: string, config: BlindfoldConfig) {
  let code: string
  try {
    code = fs.readFileSync(file, "utf8")
  } catch {
    return yield* fail(`cannot read file: ${file}`)
  }

  const session = new BlindfoldSession({ ...config, enabled: true })

  let result
  try {
    result = session.obfuscate(code, file)
  } catch (e) {
    if (e instanceof BlindfoldBlocked) {
      process.stdout.write(`\n${c.red("✕ BLOCKED")} · ${c.bold(file)} — ${e.reason}\n`)
      for (const d of e.details.slice(0, 5)) process.stdout.write(c.dim(`    ${d}\n`))
      process.stdout.write(c.dim("\n  Fail-closed (Decision 13): a payload that won't fully parse is never sent.\n\n"))
      return yield* fail("blocked", 1)
    }
    throw e
  }

  // Header line mirroring the spec preview.
  process.stdout.write(`\n${c.green("$")} kode blindfold --dry-run ${file}\n`)
  process.stdout.write(c.dim(`  parsed 1 file · tree-sitter/AST(ts) ✓\n`))
  process.stdout.write(`  ${c.green(`+ ${result.shielded} symbols shielded`)}  ${c.dim("(HMAC)")}\n`)
  process.stdout.write(c.dim(`  keywords/stdlib untouched\n`))
  process.stdout.write(`  ${c.green(`→ ${result.leaked} identifiers would leak`)}\n\n`)

  // Side-by-side (stacked) before/after — the visceral "watch the wire" moment.
  process.stdout.write(c.dim("  ── YOUR CODE (stays local) ───────────────────────\n"))
  process.stdout.write(indent(code) + "\n")
  process.stdout.write(c.green("  ── WHAT LEFT THE WIRE ─────────────────────────────\n"))
  process.stdout.write(indent(result.code) + "\n\n")
})

function indent(s: string): string {
  return s
    .split("\n")
    .map((l) => "    " + l)
    .join("\n")
}

const serveDashboard = Effect.fn("Cli.blindfold.dashboard")(function* (config: BlindfoldConfig, port: number) {
  const render = () => {
    const entries = readPersisted(CAPTURE_FILE)
    const session = new BlindfoldSession()
    // Reuse the summary aggregation by replaying counts from persisted records.
    const summary = { requests: 0, shielded: 0, leaked: 0, blocked: 0 }
    for (const r of entries) {
      if (r.status === "clean") {
        summary.requests++
        summary.shielded += r.shielded
        summary.leaked += r.leaked
      } else if (r.status === "blocked") summary.blocked++
    }
    void session
    const diff: DiffData | undefined = (() => {
      const latest = [...entries].reverse().find((e) => e.status === "clean" && e.wire)
      if (!latest?.wire) return undefined
      return { endpoint: latest.endpoint, wire: latest.wire }
    })()
    return renderDashboard({
      language: config.language,
      port,
      summary,
      entries: [...entries].reverse(),
      diff,
    })
  }

  try {
    Bun.serve({
      port,
      hostname: "127.0.0.1",
      fetch() {
        return new Response(render(), { headers: { "content-type": "text/html; charset=utf-8" } })
      },
    })
  } catch (e) {
    return yield* fail(`could not start dashboard: ${String(e)}`)
  }

  process.stdout.write(`\n${c.green("🛡 Blindfold")} dashboard · ${c.blue(`http://localhost:${port}`)}\n`)
  process.stdout.write(c.dim(`  read-only · serving ${CAPTURE_FILE}\n`))
  process.stdout.write(c.dim("  press Ctrl-C to stop\n\n"))

  // Keep the process alive while the server runs.
  yield* Effect.never
})
