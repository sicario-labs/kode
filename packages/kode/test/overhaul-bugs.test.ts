import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import { join } from "path";
import { resolveKodeBinary } from "../src/bridge/gatekeeper";

describe("Kode Overhaul Bug Condition Exploration Tests", () => {
  // B1: findKodeBinary() contains no kode-ai fallback paths
  test("B1: findKodeBinary contains no kode-ai fallback paths", () => {
    const tuiGoPath = join(import.meta.dir, "../../../cmd/kode/tui.go");
    const tuiGoContent = fs.readFileSync(tuiGoPath, "utf-8");
    const hasOpencodeAi = tuiGoContent.includes("opencode-ai");
    expect(hasOpencodeAi).toBe(false);
  });

  // B3: go.mod module declaration equals "github.com/sicario-labs/kode"
  test("B3: go.mod module declaration equals github.com/sicario-labs/kode", () => {
    const goModPath = join(import.meta.dir, "../../../go.mod");
    const goModContent = fs.readFileSync(goModPath, "utf-8");
    const firstLine = goModContent.split("\n")[0].trim();
    expect(firstLine).toBe("module github.com/sicario-labs/kode");
  });

  // B4: resolveKodeBinary() with no KODE_BIN env var and no binary on disk throws
  test("B4: resolveKodeBinary with no KODE_BIN set and no binary present throws", () => {
    // Ensure KODE_BIN is not set
    const oldEnv = process.env.KODE_BIN;
    delete process.env.KODE_BIN;
    
    const originalCwd = process.cwd;
    // Return a deeply nested nonexistent directory so going up 5 levels doesn't reach the root or real bin
    process.cwd = () => "C:\\nonexistent\\a\\b\\c\\d\\e\\f\\g\\h\\i\\j";
    
    try {
      expect(() => {
        resolveKodeBinary();
      }).toThrow();
    } finally {
      process.cwd = originalCwd;
      if (oldEnv) {
        process.env.KODE_BIN = oldEnv;
      }
    }
  });

  // B7: Desktop sidecar prepareSidecarEnv() sets KODE_BIN
  test("B7: Desktop sidecar prepareSidecarEnv sets KODE_BIN", () => {
    const sidecarPath = join(import.meta.dir, "../../../packages/desktop/src/main/sidecar.ts");
    const sidecarContent = fs.readFileSync(sidecarPath, "utf-8");
    const setsKodeBin = sidecarContent.includes("KODE_BIN");
    expect(setsKodeBin).toBe(true);
  });
});
