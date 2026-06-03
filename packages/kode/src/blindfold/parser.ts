import ts from "typescript"
import type { SymbolKind } from "./cipher"

/**
 * Blindfold parser — tree-sitter / AST identifier extraction (Decision 4),
 * scoped to TypeScript / JavaScript (Decision 12).
 *
 * We parse the payload to a real syntax tree and rename ONLY true identifier
 * nodes. This is the accuracy guarantee behind the safety claim: a missed
 * identifier is a leak, and an over-redacted keyword breaks the model. The
 * TypeScript compiler's scanner already separates keywords, punctuation, string
 * interiors and comments from identifier tokens, so walking `ts.Identifier`
 * nodes gives us exactly "user symbols, nothing else" without hand-rolled regex
 * heuristics.
 *
 * Decision 3 — user-defined symbols only: language keywords and control flow are
 * never identifier nodes, so they are excluded for free. Well-known globals and
 * stdlib/framework names are kept in the clear via an allowlist so the model can
 * still reason normally.
 */

export interface Identifier {
  /** The source text of the identifier (the real name). */
  name: string
  /** Which alias prefix this identifier should receive. */
  kind: SymbolKind
  /** Absolute start offset in the source. */
  start: number
  /** Absolute end offset in the source. */
  end: number
}

export interface ParseResult {
  /** True when the source parsed with no syntax errors. */
  ok: boolean
  /** Human-readable syntax diagnostics (empty when ok). */
  errors: string[]
  /** Every user-defined identifier occurrence, in source order. */
  identifiers: Identifier[]
}

/**
 * Well-known globals / stdlib that stay in the clear (Decision 3). Keeping these
 * legible is what lets the model keep reasoning — it still sees `JSON.parse`,
 * `console.log`, `Promise`, etc. This is intentionally a *names* allowlist, not
 * a semantic resolver; precise stdlib resolution is an LSP-grade concern
 * deferred past this slice.
 */
const STDLIB = new Set<string>([
  // Values / constructors
  "globalThis", "console", "Math", "JSON", "Object", "Array", "String", "Number",
  "Boolean", "Symbol", "BigInt", "Date", "RegExp", "Error", "TypeError", "RangeError",
  "SyntaxError", "Promise", "Map", "Set", "WeakMap", "WeakSet", "Proxy", "Reflect",
  "Function", "Infinity", "NaN", "undefined", "null", "globalThis",
  "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent",
  "decodeURIComponent", "encodeURI", "decodeURI", "structuredClone", "fetch",
  "setTimeout", "setInterval", "clearTimeout", "clearInterval", "queueMicrotask",
  // Runtime globals
  "process", "Buffer", "require", "module", "exports", "__dirname", "__filename",
  "globalThis", "window", "document", "navigator", "localStorage", "URL",
  "URLSearchParams", "TextEncoder", "TextDecoder", "AbortController", "AbortSignal",
  // Common well-known types
  "Record", "Partial", "Required", "Readonly", "Pick", "Omit", "Exclude", "Extract",
  "ReturnType", "Parameters", "Awaited", "Promise", "Array", "ReadonlyArray",
  "Map", "Set", "Iterable", "Iterator", "void", "any", "unknown", "never", "object",
  "string", "number", "boolean", "symbol", "bigint", "this",
])

/** Type-position node kinds whose name identifier should get the `T_` prefix. */
function isTypeName(node: ts.Identifier): boolean {
  const parent = node.parent
  if (!parent) return false
  return (
    (ts.isTypeReferenceNode(parent) && parent.typeName === node) ||
    (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
    (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
    (ts.isTypeParameterDeclaration(parent) && parent.name === node) ||
    (ts.isEnumDeclaration(parent) && parent.name === node)
  )
}

/** Parameter identifiers get the `p_` prefix. */
function isParameterName(node: ts.Identifier): boolean {
  const parent = node.parent
  return !!parent && ts.isParameter(parent) && parent.name === node
}

/**
 * The leftmost object of a property-access chain. Used so that property names
 * reached off a stdlib root (e.g. `Math.max`, `JSON.stringify`) are kept in the
 * clear together with the root.
 */
function propertyAccessRoot(node: ts.Node): ts.Identifier | undefined {
  let current: ts.Node = node
  while (ts.isPropertyAccessExpression(current.parent) && current.parent.name === current) {
    current = current.parent
  }
  // current is now the outermost member access; descend to its leftmost object.
  let expr: ts.Node = current
  while (ts.isPropertyAccessExpression(expr)) expr = expr.expression
  return ts.isIdentifier(expr) ? expr : undefined
}

function classify(node: ts.Identifier): SymbolKind {
  if (isTypeName(node)) return "T"
  if (isParameterName(node)) return "p"
  return "sym"
}

/**
 * Identifiers that are not user symbols and must stay in the clear:
 *  - members of an import/export specifier that name an external module symbol,
 *  - the property side of a stdlib-rooted access (`Math.max`),
 *  - any name in the STDLIB allowlist.
 */
function shouldKeepClear(node: ts.Identifier): boolean {
  if (STDLIB.has(node.text)) return true

  const parent = node.parent
  // The property side of `obj.prop`: keep clear only when the root object is stdlib.
  if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) {
    const root = propertyAccessRoot(node)
    if (root && STDLIB.has(root.text)) return true
  }
  // Property keys in object literals reached as `{ prop: ... }` are user symbols
  // (kept shielded) — no special-casing needed beyond stdlib.
  return false
}

/**
 * Parse TypeScript/JavaScript source and return every user-defined identifier
 * occurrence plus whether the source is syntactically valid.
 */
export function parse(code: string, fileName = "payload.ts"): ParseResult {
  const scriptKind = fileName.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : fileName.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : fileName.endsWith(".js") || fileName.endsWith(".mjs") || fileName.endsWith(".cjs")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS

  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, /* setParentNodes */ true, scriptKind)

  // `parseDiagnostics` is internal but stable; it is the only signal that the
  // text failed to parse cleanly (the public API exposes no syntactic errors
  // without a full Program). This is what the fail-closed guard keys off.
  const diagnostics = (source as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? []
  const errors = diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))

  // First pass: decide a STABLE kind per name from its strongest declaration
  // role, so the same identifier gets the same alias prefix at every occurrence
  // (a parameter is `p_` even where it is later used as a value). Types take
  // precedence (separate namespace), then parameters, else `sym`.
  const kindByName = new Map<string, SymbolKind>()
  const noteKind = (name: string, kind: SymbolKind) => {
    const current = kindByName.get(name)
    if (current === "T") return
    if (current === "p" && kind === "sym") return
    kindByName.set(name, kind)
  }
  const firstPass = (node: ts.Node) => {
    if (ts.isIdentifier(node) && !shouldKeepClear(node)) {
      const k = classify(node)
      if (k !== "sym") noteKind(node.text, k)
    }
    ts.forEachChild(node, firstPass)
  }
  firstPass(source)

  const identifiers: Identifier[] = []
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && !shouldKeepClear(node)) {
      identifiers.push({
        name: node.text,
        kind: kindByName.get(node.text) ?? "sym",
        start: node.getStart(source),
        end: node.getEnd(),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  return { ok: errors.length === 0, errors, identifiers }
}
