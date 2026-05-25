const { spawnSync } = require("child_process");
const { existsSync, chmodSync, mkdirSync, writeFileSync } = require("fs");
const { join } = require("path");
const https = require("https");

const pkg = require("./package.json");
const version = pkg.version;
const repo = "sicario-labs/kode";

const platformMap = {
  win32: { os: "windows", ext: ".exe" },
  darwin: { os: "darwin", ext: "" },
  linux: { os: "linux", ext: "" },
};

const archMap = {
  x64: "amd64",
  arm64: "arm64",
};

const plat = platformMap[process.platform];
const arch = archMap[process.arch];

if (!plat || !arch) {
  console.error(`Unsupported platform: ${process.platform} ${process.arch}`);
  process.exit(1);
}

const binaryName = `kode-${plat.os}-${arch}${plat.ext}`;
const url = `https://github.com/${repo}/releases/download/v${version}/${binaryName}`;
const installDir = join(__dirname, "bin");
const binaryPath = join(installDir, `kode${plat.ext}`);

if (existsSync(binaryPath)) {
  process.exit(0);
}

console.log(`Downloading Kode v${version} (${binaryName})...`);

mkdirSync(installDir, { recursive: true });

const file = require("fs").createWriteStream(binaryPath);

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Download failed (HTTP ${res.statusCode})`);
    console.error(`URL: ${url}`);
    process.exit(1);
  }
  res.pipe(file);
  file.on("finish", () => {
    file.close();
    try { chmodSync(binaryPath, 0o755); } catch {}
    console.log(`Kode v${version} installed to ${binaryPath}`);
  });
}).on("error", (err) => {
  console.error(`Download error: ${err.message}`);
  process.exit(1);
});
