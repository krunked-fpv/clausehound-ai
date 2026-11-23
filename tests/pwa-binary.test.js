import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

import {
  PWA_CACHE_VERSION,
  clearOldCaches,
  createInstallController,
  getServiceWorkerStatus,
  registerFaradayServiceWorker
} from "../src/pwa/sw-register.js";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");

function walkFiles(dir, predicate = () => true) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, predicate));
    } else if (predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

describe("PWA Binary Icons, Subpath Manifest, Service Worker & Static Hygiene", () => {
  test("PNG icons possess exact 8-byte magic header, valid IHDR CRC, and exact pixel dimensions", () => {
    const expectedMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const targets = [
      { relPath: "assets/icons/icon-192.png", width: 192, height: 192 },
      { relPath: "assets/icons/icon-512.png", width: 512, height: 512 },
      { relPath: "assets/icons/apple-touch-icon.png", width: 180, height: 180 }
    ];

    for (const item of targets) {
      const absPath = path.join(ROOT_DIR, item.relPath);
      assert.ok(fs.existsSync(absPath), `Missing icon file: ${item.relPath}`);
      const buf = fs.readFileSync(absPath);
      assert.ok(buf.length > 64, `Icon ${item.relPath} unexpectedly small`);

      const magic = [...buf.subarray(0, 8)];
      assert.deepEqual(magic, expectedMagic, `Invalid PNG magic header on ${item.relPath}`);

      const ihdrLength = buf.readUInt32BE(8);
      const ihdrType = buf.subarray(12, 16).toString("ascii");
      assert.equal(ihdrLength, 13, `IHDR chunk length must be 13 on ${item.relPath}`);
      assert.equal(ihdrType, "IHDR", `First chunk must be IHDR on ${item.relPath}`);

      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      assert.equal(width, item.width, `Width mismatch on ${item.relPath}`);
      assert.equal(height, item.height, `Height mismatch on ${item.relPath}`);

      const expectedCrc = zlib.crc32(buf.subarray(12, 29)) >>> 0;
      const actualCrc = buf.readUInt32BE(29);
      assert.equal(actualCrc, expectedCrc, `IHDR CRC mismatch on ${item.relPath}`);
      assert.ok(buf.subarray(buf.length - 12).includes(Buffer.from("IEND")), `Missing IEND trailer on ${item.relPath}`);
    }
  });

  test("manifest.json enforces subpath-safe ./ URLs, standalone display, #0F1115 obsidian palette, and existing icons", () => {
    const manifestPath = path.join(ROOT_DIR, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    assert.equal(manifest.start_url, "./");
    assert.equal(manifest.scope, "./");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.background_color, "#0F1115");
    assert.equal(manifest.theme_color, "#0F1115");
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);

    const sizes = new Set();
    for (const icon of manifest.icons) {
      assert.ok(icon.src.startsWith("./"), `Icon src must be relative ./: ${icon.src}`);
      assert.equal(icon.type, "image/png");
      const diskPath = path.join(ROOT_DIR, icon.src);
      assert.ok(fs.existsSync(diskPath), `Manifest icon missing on disk: ${icon.src}`);
      sizes.add(icon.sizes);
    }
    assert.ok(sizes.has("192x192"));
    assert.ok(sizes.has("512x512"));
  });

  test("sw.js passes node --check, locks PWA_CACHE_VERSION, and 100% of PRECACHE_ASSETS exist on disk", async () => {
    const swPath = path.join(ROOT_DIR, "sw.js");
    const swRegPath = path.join(ROOT_DIR, "src/pwa/sw-register.js");

    execFileSync(process.execPath, ["--check", swPath], { stdio: "pipe" });
    execFileSync(process.execPath, ["--check", swRegPath], { stdio: "pipe" });

    assert.equal(PWA_CACHE_VERSION, "clausehound-faraday-v1");

    const swText = fs.readFileSync(swPath, "utf8");
    const versionMatch = swText.match(/const PWA_CACHE_VERSION = "([^"]+)";/);
    assert.ok(versionMatch, "PWA_CACHE_VERSION missing in sw.js");
    assert.equal(versionMatch[1], "clausehound-faraday-v1");

    const assetsMatch = swText.match(/const PRECACHE_ASSETS = (\[[\s\S]*?\]);/);
    assert.ok(assetsMatch, "PRECACHE_ASSETS array missing in sw.js");
    const precacheAssets = JSON.parse(assetsMatch[1]);
    assert.ok(precacheAssets.length >= 26);

    const precacheSet = new Set(precacheAssets);
    for (const relAsset of precacheAssets) {
      assert.ok(relAsset.startsWith("./"), `PRECACHE_ASSETS entry must be relative ./: ${relAsset}`);
      const resolvedOnDisk = relAsset === "./" ? path.join(ROOT_DIR, "index.html") : path.join(ROOT_DIR, relAsset);
      assert.ok(fs.existsSync(resolvedOnDisk), `Precache asset missing on disk: ${relAsset}`);
    }

    // Ensure every JS & CSS file in src/ is included in PRECACHE_ASSETS
    const srcAssets = walkFiles(path.join(ROOT_DIR, "src"), (p) => p.endsWith(".js") || p.endsWith(".css"));
    for (const absSrc of srcAssets) {
      const rel = `./${path.relative(ROOT_DIR, absSrc).replace(/\\/g, "/")}`;
      assert.ok(precacheSet.has(rel), `Source asset omitted from sw.js PRECACHE_ASSETS: ${rel}`);
    }

    // Verify sw.js install/activate/fetch lifecycle inside isolated VM under subpath scope
    const listeners = {};
    const store = new Map();
    const cacheApi = {
      async open(name) {
        if (!store.has(name)) store.set(name, new Map());
        const map = store.get(name);
        return {
          async addAll(urls) {
            for (const u of urls) map.set(u, { url: u, status: 200 });
          },
          async match(req) {
            const key = typeof req === "string" ? req : req.url;
            return map.get(key) || null;
          },
          async put(req, res) {
            const key = typeof req === "string" ? req : req.url;
            map.set(key, res);
          }
        };
      },
      async keys() {
        return [...store.keys()];
      },
      async delete(name) {
        return store.delete(name);
      },
      async match(req) {
        const key = typeof req === "string" ? req : req.url;
        for (const map of store.values()) {
          if (map.has(key)) return map.get(key);
        }
        return null;
      }
    };
    store.set("stale-v0", new Map());

    const selfMock = {
      registration: { scope: "https://krunked-fpv.github.io/clausehound-ai/" },
      location: { origin: "https://krunked-fpv.github.io", href: "https://krunked-fpv.github.io/clausehound-ai/sw.js" },
      navigator: { onLine: false },
      clients: { async claim() {} },
      async skipWaiting() {},
      addEventListener(type, fn) {
        listeners[type] = fn;
      }
    };

    vm.runInNewContext(swText, {
      self: selfMock,
      caches: cacheApi,
      URL,
      Response: class MockResponse {
        constructor(body, init) {
          this.body = body;
          this.status = init?.status || 200;
        }
      },
      fetch: async () => {
        throw new Error("Offline test must not call fetch");
      }
    });

    const waitTasks = [];
    listeners.install({ waitUntil: (p) => waitTasks.push(p) });
    await Promise.all(waitTasks.splice(0));

    const activeCache = store.get(PWA_CACHE_VERSION);
    assert.ok(activeCache.has("https://krunked-fpv.github.io/clausehound-ai/index.html"));
    assert.ok(activeCache.has("https://krunked-fpv.github.io/clausehound-ai/src/ui/app-shell.js"));

    listeners.activate({ waitUntil: (p) => waitTasks.push(p) });
    await Promise.all(waitTasks.splice(0));
    assert.equal(store.has("stale-v0"), false);

    let responded = null;
    listeners.fetch({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://krunked-fpv.github.io/clausehound-ai/index.html"
      },
      respondWith(p) {
        responded = p;
      }
    });
    const res = await responded;
    assert.equal(res.status, 200);
  });

  test("sw-register.js supports subpath registration, stale cache cleanup, and install controller", async () => {
    const noSw = await registerFaradayServiceWorker({ navigator: {}, window: { location: { protocol: "https:" } } });
    assert.equal(noSw.registered, false);
    assert.equal(noSw.reason, "service-worker-unsupported");

    const fileProto = await registerFaradayServiceWorker({
      navigator: { serviceWorker: { async register() {} } },
      window: { location: { protocol: "file:" } }
    });
    assert.equal(fileProto.registered, false);
    assert.equal(fileProto.reason, "unsupported-protocol");

    let recordedCall = null;
    const navMock = {
      serviceWorker: {
        controller: null,
        async register(swPath, opts) {
          recordedCall = { swPath, opts };
          return { scope: "https://krunked-fpv.github.io/clausehound-ai/" };
        }
      }
    };
    const ok = await registerFaradayServiceWorker({
      navigator: navMock,
      window: { location: { protocol: "https:" } }
    });
    assert.equal(ok.registered, true);
    assert.deepEqual(recordedCall, { swPath: "./sw.js", opts: { scope: "./" } });
    assert.equal(getServiceWorkerStatus(navMock).cacheVersion, PWA_CACHE_VERSION);

    const cacheKeys = new Set(["old-v0", PWA_CACHE_VERSION, "temp-v1"]);
    const deleted = await clearOldCaches(PWA_CACHE_VERSION, {
      async keys() {
        return [...cacheKeys];
      },
      async delete(k) {
        return cacheKeys.delete(k);
      }
    });
    assert.deepEqual(deleted.sort(), ["old-v0", "temp-v1"]);
    assert.equal(cacheKeys.has(PWA_CACHE_VERSION), true);

    const bus = new EventTarget();
    const ctrl = createInstallController(null, {
      targetGlobal: bus,
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
      navigator: {}
    });
    assert.equal(ctrl.isInstallAvailable(), false);
    const promptEvt = new Event("beforeinstallprompt");
    promptEvt.preventDefault = () => {};
    promptEvt.prompt = async () => {};
    promptEvt.userChoice = Promise.resolve({ outcome: "accepted" });
    bus.dispatchEvent(promptEvt);
    assert.equal(ctrl.isInstallAvailable(), true);
    const choice = await ctrl.triggerInstall();
    assert.equal(choice.accepted, true);
    assert.equal(ctrl.isStandalone(), true);
    ctrl.destroy();
  });

  test("static hygiene: zero vendor model names, zero window.alert/confirm/prompt, zero root-absolute URLs across src/ and index.html", () => {
    const vendorTerms = [
      "gemini",
      "claude",
      "opus",
      "sonnet",
      "haiku",
      "gpt-3",
      "gpt-4",
      "gpt-5",
      "openai",
      "anthropic",
      "llama",
      "qwen",
      "mistral",
      "phi-3",
      "gemma",
      "deepseek"
    ];

    const filesToAudit = [
      path.join(ROOT_DIR, "index.html"),
      path.join(ROOT_DIR, "manifest.json"),
      path.join(ROOT_DIR, "sw.js"),
      ...walkFiles(path.join(ROOT_DIR, "src"), (p) => p.endsWith(".js") || p.endsWith(".css"))
    ];

    for (const filePath of filesToAudit) {
      const content = fs.readFileSync(filePath, "utf8");
      const lower = content.toLowerCase();
      const rel = path.relative(ROOT_DIR, filePath);

      for (const term of vendorTerms) {
        assert.equal(lower.includes(term), false, `Vendor model term "${term}" found in ${rel}`);
      }

      // Check window.alert/confirm/prompt, globalThis.alert/confirm/prompt, or bare dialog calls
      const dialogMatch = content.match(/(?:window\.|globalThis\.|(?<![.\w]))(?:alert|confirm|prompt)\s*\(/g);
      assert.equal(dialogMatch, null, `Blocking native dialog call found in ${rel}: ${dialogMatch}`);
    }

    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, "index.html"), "utf8");
    assert.equal(/(?:href|src)=["']\/(?!\/)/.test(indexHtml), false, "Root-absolute / path found in index.html");
    assert.ok(indexHtml.includes('content="#0F1115"'));
    assert.ok(indexHtml.includes('href="./manifest.json"'));
    assert.ok(indexHtml.includes('href="./src/ui/desk-theme.css"'));
    assert.ok(indexHtml.includes('src="./src/ui/app-shell.js"'));
  });
});
