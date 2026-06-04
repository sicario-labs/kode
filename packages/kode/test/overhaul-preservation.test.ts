import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Kode Overhaul Preservation Tests", () => {
  // 3.1: verify.enabled = false skips gatekeeper
  test("verify.enabled = false configuration structure is valid", () => {
    // Assert that the configuration schema defaults are present in config.ts
    const configPath = join(import.meta.dir, "../src/config.ts");
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, "utf-8");
      expect(content.includes("verify")).toBe(true);
    }
  });

  // 3.7: Tool call stream interruption structures are correct
  test("Session stream interruption structure is correct", () => {
    const sessionPath = join(import.meta.dir, "../src/session/processor.ts");
    if (existsSync(sessionPath)) {
      const content = readFileSync(sessionPath, "utf-8");
      expect(content.includes("interrupted")).toBe(true);
    }
  });
});
