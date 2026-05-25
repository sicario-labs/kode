#!/usr/bin/env node
const { spawnSync } = require("child_process");
const { join } = require("path");

const plat = process.platform;
const ext = plat === "win32" ? ".exe" : "";
const binaryPath = join(__dirname, "bin", `kode${ext}`);

const result = spawnSync(binaryPath, process.argv.slice(2), {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
