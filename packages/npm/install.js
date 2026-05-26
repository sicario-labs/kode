const { execFile, spawnSync } = require("child_process");
const { existsSync, chmodSync, mkdirSync, createWriteStream, readFileSync } = require("fs");
const { join } = require("path");
const os = require("os");
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
const installDir = join(__dirname, "bin");
const binaryPath = join(installDir, `kode${plat.ext}`);
const tuiDir = join(os.homedir(), ".kode", "tui");

const versionedURL = (name) => `https://github.com/${repo}/releases/download/v${version}/${name}`;

let exitCode = 0;

main().catch((err) => {
  console.error(err.message);
  exitCode = 1;
}).finally(() => process.exit(exitCode));

async function main() {
  // Step 1: Download Go binary
  if (!existsSync(binaryPath)) {
    mkdirSync(installDir, { recursive: true });
    console.log(`Downloading Kode v${version} (${binaryName})...`);
    try {
      await download(versionedURL(binaryName), binaryPath);
      try { chmodSync(binaryPath, 0o755); } catch {}
      console.log(`Kode binary installed to ${binaryPath}`);
    } catch (err) {
      console.error(`Binary download failed: ${err.message}`);
      exitCode = 1;
    }
  }

  // Step 2: Download and extract TUI bundle to ~/.kode/tui/
  const versionFile = join(tuiDir, ".kode-version");
  let installedVersion = "";
  try { installedVersion = readFileSync(versionFile, "utf8").trim(); } catch {}
  if (installedVersion !== version) {
    const bundleName = "tui-bundle.tar.gz";
    console.log(`Downloading TUI bundle (~52 MB)...`);
    const bundlePath = join(os.tmpdir(), bundleName);
    try {
      await download(versionedURL(bundleName), bundlePath);
      mkdirSync(tuiDir, { recursive: true });
      await extractTar(bundlePath, join(tuiDir, ".."));
      console.log(`TUI extracted to ${tuiDir}`);
    } catch (err) {
      console.error(`TUI download/extract failed: ${err.message}`);
    } finally {
      try { require("fs").unlinkSync(bundlePath); } catch {}
    }
  }

  // Step 3: Pre-install TUI dependencies with bun
  if (existsSync(join(tuiDir, "package.json")) && !existsSync(join(tuiDir, "node_modules"))) {
    const bun = findBun();
    if (bun) {
      console.log(`Installing TUI dependencies (bun install)...`);
      try {
        await runCommand(bun, ["install"], tuiDir);
      } catch (err) {
        console.error(`bun install failed: ${err.message}`);
      }
    }
  }
}

// --- helpers ---

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const req = https.get(url, { headers: { "User-Agent": "kode-installer" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close((err) => err ? reject(err) : resolve()));
    });
    req.on("error", (err) => { file.close(); reject(err); });
  });
}

function extractTar(src, dest) {
  return new Promise((resolve, reject) => {
    // Use system tar command (available on Windows 10 17063+, macOS, Linux)
    execFile("tar", ["-xzf", src, "-C", dest], (err) => {
      err ? reject(err) : resolve();
    });
  });
}

function findBun() {
  const paths = ["bun", "bun.exe"];
  for (const p of paths) {
    const result = spawnSync(p, ["--version"], { stdio: "ignore" });
    if (result.status === 0) return p;
  }
  // Check common install locations
  const extra = [
    join(os.homedir(), ".bun", "bin", "bun" + (process.platform === "win32" ? ".exe" : "")),
    join(process.env.LOCALAPPDATA || "", "bun", "bin", "bun.exe"),
  ];
  for (const p of extra) {
    if (existsSync(p)) return p;
  }
  return null;
}

function runCommand(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = require("child_process").spawn(cmd, args, { cwd, stdio: "inherit" });
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`exit code ${code}`)));
    child.on("error", reject);
  });
}
