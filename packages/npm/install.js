const { spawnSync } = require("child_process");
const { existsSync, chmodSync, mkdirSync, createWriteStream } = require("fs");
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
const installDir = join(__dirname, "bin");
const binaryPath = join(installDir, `kode${plat.ext}`);

if (existsSync(binaryPath)) {
  process.exit(0);
}

mkDir(installDir);

console.log(`Downloading Kode v${version} (${binaryName})...`);

// Try versioned URL first, fall back to API-resolved latest URL
const versionedURL = `https://github.com/${repo}/releases/download/v${version}/${binaryName}`;
const latestURL = `https://api.github.com/repos/${repo}/releases/latest`;

download(versionedURL).catch(() => {
  // Fallback: resolve latest release asset URL via API
  return resolveLatestAsset(binaryName).then(download);
}).then(() => {
  try { chmodSync(binaryPath, 0o755); } catch {}
  console.log(`Kode v${version} installed to ${binaryPath}`);
}).catch((err) => {
  console.error(`Download failed: ${err.message}`);
  console.error(`Tried:\n  ${versionedURL}\n  (latest release via API)`);
  process.exit(1);
});

function mkDir(dir) {
  try { mkdirSync(dir, { recursive: true }); } catch {}
}

function download(url) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(binaryPath);
    https.get(url, { headers: { "User-Agent": "kode-installer" } }, (res) => {
      // Follow redirects manually (GitHub CDN may return 302)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        download(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => {
      file.close();
      reject(err);
    });
  });
}

function resolveLatestAsset(assetName) {
  return new Promise((resolve, reject) => {
    https.get(latestURL, { headers: { "User-Agent": "kode-installer", "Accept": "application/json" } }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          const release = JSON.parse(body);
          if (!release.assets) {
            reject(new Error("no assets in latest release"));
            return;
          }
          const asset = release.assets.find(a => a.name === assetName);
          if (!asset) {
            reject(new Error(`asset ${assetName} not found in latest release`));
            return;
          }
          resolve(asset.browser_download_url);
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}
