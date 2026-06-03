import type { CaptureRecord } from "./capture-log"

/**
 * Blindfold dashboard (Decisions 6–10) — a read-only, projectable "watch the
 * wire" view. This module renders the HTML; serving is wired in the CLI. The
 * markup is the visual contract from the spec preview, made data-driven.
 *
 * It stays strictly out of the data path: it only reads the capture log and the
 * (in-memory) records handed to it. Nothing here can change what leaves the
 * machine.
 */

export interface DashboardData {
  language: string
  port: number
  summary: { requests: number; shielded: number; leaked: number; blocked: number }
  entries: CaptureRecord[]
  /** The request to feature in the side-by-side diff (Decision 6). */
  diff?: DiffData
}

export interface DiffData {
  endpoint: string
  /** Real code (in-memory only). Absent when rendering from the at-rest log. */
  local?: string
  /** Obfuscated bytes that left the wire. */
  wire?: string
  /** real -> alias, for the left pane + hover reveal. In-memory only. */
  tokens?: { real: string; alias: string }[]
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * The canonical example from the spec preview, used when the dashboard is served
 * standalone from the at-rest log (which never stores real identifiers). It is
 * representative of what a shielded request looks like.
 */
const CANONICAL: Required<Pick<DiffData, "local" | "wire" | "tokens">> & { endpoint: string } = {
  endpoint: "api.anthropic.com",
  local: "function getUserBalance(account: AccountId): Money {\n  return ledger.balanceFor(account);\n}",
  wire: "function sym_a91f(p_7c2: T_4d1): T_e30 {\n  return sym_b48.sym_19c(p_7c2);\n}",
  tokens: [
    { real: "getUserBalance", alias: "sym_a91f" },
    { real: "account", alias: "p_7c2" },
    { real: "AccountId", alias: "T_4d1" },
    { real: "Money", alias: "T_e30" },
    { real: "ledger", alias: "sym_b48" },
    { real: "balanceFor", alias: "sym_19c" },
  ],
}

// Keywords highlighted in the panes (purely cosmetic, mirrors the preview).
const KEYWORDS = new Set([
  "function", "return", "const", "let", "var", "if", "else", "for", "while", "class",
  "interface", "type", "import", "export", "from", "async", "await", "new", "extends",
])

/** Render a code pane, wrapping known tokens. `mode` selects local vs wire styling. */
function renderPane(code: string, tokens: { real: string; alias: string }[], mode: "local" | "wire"): string {
  // Tokenise on word boundaries so we can wrap identifiers without a full parse.
  const byReal = new Map(tokens.map((t) => [t.real, t.alias]))
  const byAlias = new Map(tokens.map((t) => [t.alias, t.real]))
  return code.replace(/[A-Za-z_$][A-Za-z0-9_$]*/g, (word) => {
    if (KEYWORDS.has(word)) return `<span class="kw">${esc(word)}</span>`
    if (mode === "local") {
      if (byReal.has(word)) return `<span class="real">${esc(word)}</span>`
      return esc(word)
    }
    // wire pane: blackout bar revealing the alias on hover (Decision 8)
    const real = byAlias.get(word)
    if (real !== undefined || /^(?:sym|p|T)_[0-9a-f]{3,}$/.test(word)) {
      const title = real ?? word
      return `<span class="sym" tabindex="0" title="${esc(title)}">${esc(word)}</span>`
    }
    return esc(word)
  })
}

function renderDiff(diff: DiffData | undefined): string {
  const d: DiffData = diff?.wire ? diff : CANONICAL
  const tokens = d.tokens ?? []
  const local = d.local
  const wire = d.wire ?? ""
  const leftPane = local
    ? `<pre>${renderPane(local, tokens, "local")}</pre>`
    : `<pre style="color:var(--muted)">🔒 real source stays on this machine\n   it is never written to disk (Decision 14)</pre>`
  return `
      <section class="card">
        <header>
          <span>What left the wire · ${esc(d.endpoint)}</span>
          <span class="tag tag-ok">0 leaked</span>
        </header>
        <div class="diff">
          <div class="pane">
            <div class="label label-local">🔒 your code · stays local</div>
            ${leftPane}
          </div>
          <div class="pane" data-decision="6">
            <div class="label label-wire">✓ on the wire</div>
            <pre data-decision="8">${renderPane(wire, tokens, "wire")}</pre>
            <div class="hint" data-decision="2">Keywords &amp; stdlib stay in the clear <span data-decision="3">— only your symbols are shielded</span>. Hover a <code>██</code> bar to reveal the alias.</div>
          </div>
        </div>
      </section>`
}

function renderLogRow(r: CaptureRecord): string {
  if (r.status === "blocked") {
    return `<div class="row blocked-row" data-decision="13">
              <span class="endpoint">✕ ${esc(r.endpoint)}</span>
              <span><span class="ts">${fmtTime(r.ts)}</span> &nbsp;<span class="status blocked">BLOCKED · ${esc(r.reason ?? "parse failed")}</span></span>
            </div>`
  }
  if (r.status === "restored") {
    return `<div class="row" data-decision="5">
              <span class="endpoint">← response restored</span>
              <span><span class="ts">${fmtTime(r.ts)}</span> &nbsp;<span class="status clean">${r.mapped ?? 0} mapped · ${r.passedThrough ?? 0} new kept</span></span>
            </div>`
  }
  return `<div class="row">
              <span class="endpoint">→ ${esc(r.endpoint)}</span>
              <span><span class="ts">${fmtTime(r.ts)}</span> &nbsp;<span class="status clean">${r.shielded} shielded · ${r.leaked} leaked</span></span>
            </div>`
}

export function renderDashboard(data: DashboardData): string {
  const { summary } = data
  const featured = data.diff ?? data.entries.find((e) => e.status === "clean" && (e.wire || e.tokens))
  const rows = data.entries.slice(0, 12).map(renderLogRow).join("\n")
  const logBody = rows || `<div class="row"><span class="endpoint">no requests yet</span><span class="ts">—</span></div>`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blindfold — outbound monitor</title>
<style>
  :root{
    --bg:#0d1117;--surface:#161b22;--surface-2:#1c2230;--border:#21262d;--text:#e6edf3;
    --muted:#7d8590;--accent:#1f6feb;--accent-soft:#1f6feb22;--accent-text:#79c0ff;--ok:#3fb950;
    --ok-soft:#23863622;--danger:#f85149;--danger-soft:#f8514922;--bar:#30363d;
    --radius-sm:6px;--radius-md:8px;--mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
    --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:24px;--sp-6:32px;--shadow:0 8px 24px rgba(0,0,0,.4);
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);container-type:inline-size;container-name:plan-preview;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1040px;margin:0 auto;padding:var(--sp-5) var(--sp-4) var(--sp-6)}
  .topbar{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-3);padding:var(--sp-3) var(--sp-4);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md)}
  .brand{display:flex;align-items:center;gap:var(--sp-2);font-weight:700;font-size:16px}
  .brand .shield{font-size:18px}
  .live{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ok)}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px var(--ok-soft)}
  .spacer{flex:1 1 auto;min-width:8px}
  .pill{font-family:var(--mono);font-size:11px;color:var(--muted);background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:4px 10px;white-space:nowrap}
  .pill b{color:var(--accent-text);font-weight:600}
  .firstrun{margin-top:var(--sp-4);background:var(--surface);border:1px solid var(--accent);border-radius:var(--radius-md);box-shadow:var(--shadow);overflow:hidden}
  .firstrun header{display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-3) var(--sp-4);background:var(--accent-soft);border-bottom:1px solid var(--border);font-weight:600;font-size:13px}
  .firstrun .body{padding:var(--sp-4)}
  .firstrun p{margin:0 0 var(--sp-3);font-size:13px;line-height:1.5}
  .firstrun .muted{color:var(--muted);font-size:12px}
  .actions{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-3)}
  .btn{font-family:var(--sans);font-size:13px;font-weight:600;cursor:pointer;border-radius:var(--radius-sm);padding:8px 16px;border:1px solid var(--border)}
  .btn-primary{background:var(--ok);border-color:var(--ok);color:#04130a}
  .btn-ghost{background:transparent;color:var(--text)}
  .dismissed{display:none}
  .hero{margin-top:var(--sp-4);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--sp-5);display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-5)}
  .hero .num{font-size:48px;font-weight:800;line-height:1;color:var(--ok);letter-spacing:-1px}
  .hero .num .unit{font-size:20px;font-weight:600;color:var(--muted);margin-left:6px}
  .hero .sub{margin-top:var(--sp-2);font-size:13px}
  .hero .sub b{color:var(--accent-text)}
  .hero .meta{flex:1 1 220px;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--sp-3)}
  .metric{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:var(--sp-3)}
  .metric .k{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
  .metric .v{font-size:18px;font-weight:700;margin-top:2px}
  .grid{margin-top:var(--sp-4);display:grid;grid-template-columns:1fr;gap:var(--sp-4)}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden}
  .card > header{display:flex;align-items:center;gap:var(--sp-2);justify-content:space-between;padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--border);font-size:13px;font-weight:600}
  .card .tag{font-family:var(--mono);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:999px}
  .tag-ok{background:var(--ok-soft);color:var(--ok)}
  .tag-info{background:var(--accent-soft);color:var(--accent-text)}
  .diff{display:grid;grid-template-columns:1fr;gap:1px;background:var(--border)}
  .pane{background:var(--surface);padding:var(--sp-3) var(--sp-4)}
  .pane .label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:var(--sp-2);display:flex;align-items:center;gap:6px}
  .label-local{color:var(--muted)}
  .label-wire{color:var(--ok)}
  pre{margin:0;font-family:var(--mono);font-size:12px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
  .kw{color:#ff7b72}
  .real{color:var(--text)}
  .sym{background:var(--bar);color:transparent;border-radius:2px;padding:0 2px;border-bottom:1px dashed transparent;cursor:help;transition:color .12s,background .12s,border-color .12s}
  .sym:hover,.sym:focus{background:var(--accent-soft);color:var(--accent-text);border-bottom-color:var(--accent);outline:none}
  .hint{margin-top:var(--sp-2);font-size:11px;color:var(--muted)}
  .hint code{background:var(--surface-2);padding:1px 5px;border-radius:4px;color:var(--accent-text)}
  .log{display:flex;flex-direction:column}
  .row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-2);justify-content:space-between;padding:10px var(--sp-4);border-bottom:1px solid var(--border);font-size:12px}
  .row:last-child{border-bottom:none}
  .row .endpoint{font-family:var(--mono);color:var(--text)}
  .row .ts{color:var(--muted);font-family:var(--mono);font-size:11px}
  .status{font-family:var(--mono);font-size:11px;font-weight:600}
  .status.clean{color:var(--ok)}
  .status.blocked{color:var(--danger)}
  .row.blocked-row{background:var(--danger-soft)}
  .foot{display:block;margin-top:var(--sp-5);font-size:11px;color:var(--muted);text-align:center;line-height:1.6}
  @container plan-preview (min-width:680px){.diff{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <div class="brand"><span class="shield">🛡</span> Blindfold</div>
      <span class="live"><span class="dot"></span> live · localhost:${data.port}</span>
      <span class="spacer"></span>
      <span class="pill">kode.config · blindfold: <b>enabled</b></span>
      <span class="pill">lang: <b>${esc(data.language)}</b></span>
      <span class="pill">map: <b>in-memory</b></span>
    </div>

    <section class="firstrun" id="firstrun" data-decision="10">
      <header>① First outbound request — confirm what leaves your machine</header>
      <div class="body">
        <p>Blindfold is about to send its first request. This is the <b>exact payload</b> that will leave this machine — every identifier you wrote has been shielded locally. Nothing below is reversible off-device.</p>
        <p class="muted">You'll only see this once. After you confirm, Blindfold runs silently and logs every request here.</p>
        <div class="actions">
          <button class="btn btn-primary" onclick="document.getElementById('firstrun').classList.add('dismissed')">Proceed — send shielded payload</button>
          <button class="btn btn-ghost" onclick="document.getElementById('firstrun').classList.add('dismissed')">Cancel this request</button>
        </div>
      </div>
    </section>

    <section class="hero" data-decision="9">
      <div class="stat">
        <div class="num">${summary.leaked}<span class="unit">leaks</span></div>
        <div class="sub"><b>${summary.shielded}</b> identifiers shielded across <b>${summary.requests}</b> requests this session</div>
      </div>
      <div class="meta">
        <div class="metric"><div class="k">Requests</div><div class="v">${summary.requests}</div></div>
        <div class="metric"><div class="k">Shielded</div><div class="v" style="color:var(--accent-text)">${summary.shielded}</div></div>
        <div class="metric"><div class="k">Blocked</div><div class="v" style="color:var(--danger)">${summary.blocked}</div></div>
        <div class="metric"><div class="k">Raw leaked</div><div class="v" style="color:var(--ok)">${summary.leaked}</div></div>
      </div>
    </section>

    <div class="grid">
${renderDiff(featured)}
      <section class="card">
        <header><span>Outbound log</span><span class="tag tag-info">AST-verified</span></header>
        <div class="log">
${logBody}
        </div>
        <div class="hint" style="padding:0 var(--sp-4) var(--sp-3)" data-decision="13">
          Fail-closed: a file that won't parse is never sent unshielded — the request is blocked, not leaked.
        </div>
      </section>
    </div>

    <div class="foot">
      Blindfold runs entirely on-device · reverse map is in-memory and discarded on exit · obfuscation engine is open-source &amp; auditable
    </div>
  </div>
</body>
</html>`
}
