import { describe, expect, test } from "bun:test"
import { createCipher } from "../../src/blindfold/cipher"
import { parse } from "../../src/blindfold/parser"
import { SessionMap } from "../../src/blindfold/session-map"
import { obfuscateCode } from "../../src/blindfold/obfuscate"
import { BlindfoldBlocked } from "../../src/blindfold/guard"
import { BlindfoldSession } from "../../src/blindfold"

const SAMPLE = `function getUserBalance(account: AccountId): Money {
  return ledger.balanceFor(account);
}`

describe("blindfold parser (Decision 3/4)", () => {
  test("shields user symbols, keeps keywords and stdlib in the clear", () => {
    const r = parse(SAMPLE)
    expect(r.ok).toBe(true)
    const names = new Set(r.identifiers.map((i) => i.name))
    // user symbols are found
    expect(names.has("getUserBalance")).toBe(true)
    expect(names.has("account")).toBe(true)
    expect(names.has("AccountId")).toBe(true)
    expect(names.has("ledger")).toBe(true)
    expect(names.has("balanceFor")).toBe(true)
    // keywords are never identifier nodes
    expect(names.has("function")).toBe(false)
    expect(names.has("return")).toBe(false)
  })

  test("keeps well-known stdlib (console/JSON/Math) in the clear", () => {
    const r = parse(`console.log(JSON.stringify({ x: Math.max(myVar, 1) }))`)
    const names = new Set(r.identifiers.map((i) => i.name))
    expect(names.has("console")).toBe(false)
    expect(names.has("JSON")).toBe(false)
    expect(names.has("Math")).toBe(false)
    expect(names.has("log")).toBe(false) // property off stdlib root
    expect(names.has("myVar")).toBe(true) // user symbol still shielded
  })

  test("classifies parameters (p_) and types (T_)", () => {
    const r = parse(SAMPLE)
    const byName = new Map(r.identifiers.map((i) => [i.name, i.kind]))
    expect(byName.get("account")).toBe("p")
    expect(byName.get("AccountId")).toBe("T")
    expect(byName.get("getUserBalance")).toBe("sym")
  })
})

describe("blindfold cipher (Decision 2)", () => {
  test("deterministic per session and correct alias shapes", () => {
    const key = Buffer.from("0".repeat(64), "hex")
    const a = createCipher(key)
    const b = createCipher(key)
    expect(a.alias("getUserBalance", "sym")).toBe(b.alias("getUserBalance", "sym"))
    expect(a.alias("getUserBalance", "sym")).toMatch(/^sym_[0-9a-f]{4}$/)
    expect(a.alias("account", "p")).toMatch(/^p_[0-9a-f]{3}$/)
    expect(a.alias("AccountId", "T")).toMatch(/^T_[0-9a-f]{3}$/)
  })
})

describe("blindfold obfuscate + round-trip (Decision 5/13)", () => {
  test("obfuscation removes every real identifier from the wire", () => {
    const cipher = createCipher()
    const map = new SessionMap()
    const out = obfuscateCode(SAMPLE, cipher, map)
    expect(out.leaked).toBe(0)
    expect(out.shielded).toBeGreaterThan(0)
    for (const real of ["getUserBalance", "account", "AccountId", "ledger", "balanceFor", "Money"]) {
      expect(out.code).not.toContain(real)
    }
    // keywords survive
    expect(out.code).toContain("function")
    expect(out.code).toContain("return")
  })

  test("reverse restores known aliases, passes new names through", () => {
    const cipher = createCipher()
    const map = new SessionMap()
    const out = obfuscateCode(SAMPLE, cipher, map)
    const restored = map.reverse(out.code)
    expect(restored.text).toBe(SAMPLE)
    expect(restored.mapped).toBeGreaterThan(0)

    // A brand-new model-authored alias-shaped token is left untouched.
    const withNew = out.code + "\nconst sym_dead = 1"
    const r2 = map.reverse(withNew)
    expect(r2.text).toContain("sym_dead")
    expect(r2.passedThrough).toBe(1)
  })

  test("fail-closed: unparseable payload is blocked, never returned", () => {
    const cipher = createCipher()
    const map = new SessionMap()
    expect(() => obfuscateCode("function (", cipher, map)).toThrow(BlindfoldBlocked)
  })
})

describe("blindfold session markdown fences", () => {
  test("only TS/JS fences are shielded; prose untouched", () => {
    const session = new BlindfoldSession({ enabled: true })
    const text = "Here is code:\n```ts\nconst secretThing = 1\n```\nand prose with secretThing word."
    const r = session.obfuscateMarkdown(text)
    expect(r.touched).toBe(true)
    expect(r.shielded).toBeGreaterThan(0)
    // the fenced occurrence is shielded
    expect(r.text).not.toContain("const secretThing = 1")
    // prose mention of the same word outside a fence is left alone
    expect(r.text).toContain("prose with secretThing word")
  })

  test("untagged fences pass through (no spurious fail-closed)", () => {
    const session = new BlindfoldSession({ enabled: true })
    const text = "```\nnot real code <<<\n```"
    const r = session.obfuscateMarkdown(text)
    expect(r.touched).toBe(false)
    expect(r.text).toBe(text)
  })
})
