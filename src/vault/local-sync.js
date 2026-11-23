/**
 * ClauseHound Local — Portable JSON Sync, XSS-Safe HTML Bake Snapshot, & Daily Reset Manager
 */

import {
  cloneVaultState,
  computeVaultChecksum,
  normalizeVaultState,
  validateVaultState
} from "./cookie-vault.js";

const DEFAULT_BAKE_MODULES = [
  "./src/vault/cookie-vault.js",
  "./src/vault/local-sync.js",
  "./src/security/faraday-airgap.js",
  "./src/engine/clause-rules.js",
  "./src/engine/specimens.js",
  "./src/engine/clause-scanner.js",
  "./src/engine/redline-engine.js",
  "./src/engine/webllm-bridge.js",
  "./src/audio/faraday-audio.js",
  "./src/share/receipt-codec.js",
  "./src/canvas/seal-renderer.js",
  "./src/pwa/sw-register.js",
  "./src/ui/app-shell.js",
  "./src/ui/command-rail.js",
  "./src/ui/telemetry-strip.js",
  "./src/ui/clause-workbench.js",
  "./src/ui/specimen-drawer.js",
  "./src/ui/vault-modal.js",
  "./src/ui/receipt-modal.js"
];

const textEncoder = new TextEncoder();

function serializeScriptPayload(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function encodeUtf8ToBase64(text) {
  const bytes = textEncoder.encode(text);
  let binary = "";
  const chunkSize = 0x2000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function resolveRelativeModulePath(fromModule, specifier) {
  if (typeof specifier !== "string" || (!specifier.startsWith("./") && !specifier.startsWith("../"))) {
    return null;
  }
  const baseParts = fromModule.replace(/^\.\//, "").split("/");
  baseParts.pop();
  for (const seg of specifier.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (baseParts.length > 0) baseParts.pop();
    } else {
      baseParts.push(seg);
    }
  }
  return baseParts.join("/");
}

function rewriteModuleImports(sourceText, modulePath) {
  const bareFor = (specifier) => {
    const resolved = resolveRelativeModulePath(modulePath, specifier);
    return resolved ? `clausehound/${resolved}` : specifier;
  };

  return sourceText
    .replace(
      /(\b(?:import|export)\b[^"'`]*?\bfrom\s*)(["'])(\.\.?\/[^"']+)\2/g,
      (_m, prefix, quote, spec) => `${prefix}${quote}${bareFor(spec)}${quote}`
    )
    .replace(
      /(\bimport\s*\(\s*)(["'])(\.\.?\/[^"']+)\2(\s*\))/g,
      (_m, prefix, quote, spec, suffix) => `${prefix}${quote}${bareFor(spec)}${quote}${suffix}`
    );
}

function canAttemptSameOriginFetch(options) {
  if (options.offlineFallback === true || options.fetchImpl === null) return false;
  if (typeof options.fetchImpl === "function") return true;
  if (typeof globalThis.window === "undefined" || typeof globalThis.fetch !== "function") {
    return false;
  }
  const protocol = globalThis.location?.protocol || "";
  return protocol === "http:" || protocol === "https:";
}

async function fetchText(fetcher, url) {
  const response = await fetcher(url);
  if (!response || !response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return response.text();
}

function buildInlineInteractiveHtml(baseHtml, cssText, importMap, normalizedState) {
  const bakedScript = `  <script id="clausehound-baked-vault">\n    window.__CLAUSEHOUND_BAKED_VAULT__ = ${serializeScriptPayload(normalizedState)};\n  </script>`;
  const importMapScript = `  <script type="importmap">${serializeScriptPayload({ imports: importMap })}</script>`;
  const safeCss = String(cssText).replace(/<\/style/gi, "\\3c/style");
  const inlineStyle = `  <style id="clausehound-inlined-theme">\n${safeCss}\n  </style>`;

  let doc = baseHtml;
  doc = doc.replace(/<head([^>]*)>/i, `<head$1>\n${bakedScript}`);
  doc = doc.replace(/<link\b[^>]*href=["']\.\/src\/ui\/desk-theme\.css["'][^>]*>/i, inlineStyle);
  doc = doc.replace(/<link\b[^>]*rel=["'](?:manifest|icon|apple-touch-icon)["'][^>]*>\s*/gi, "");
  doc = doc.replace(
    /<script\b[^>]*type=["']module["'][^>]*src=["']\.\/src\/ui\/app-shell\.js["'][^>]*>\s*<\/script>/i,
    `${importMapScript}\n  <script type="module">import "clausehound/src/ui/app-shell.js";</script>`
  );
  return doc;
}

function buildArchivalSnapshotHtml(state) {
  const bakedScript = `<script id="clausehound-baked-vault">window.__CLAUSEHOUND_BAKED_VAULT__ = ${serializeScriptPayload(state)};</script>`;
  const docCount = Object.keys(state.neutralizedRuleMap).length;
  const totalNeutralizedInMap = Object.values(state.neutralizedRuleMap).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );
  const excisedCount = Object.values(state.excisedFeeMap).filter(Boolean).length;
  const sealCount = Object.values(state.sealStampedMap).filter(Boolean).length;

  return `<!doctype html>
<html lang="en" data-theme="${escapeHtml(state.theme)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0F1115">
  <title>ClauseHound Local — Baked Vault Snapshot</title>
  ${bakedScript}
  <script>
    (() => {
      const baked = window.__CLAUSEHOUND_BAKED_VAULT__;
      if (baked && (baked.theme === "vellum" || baked.theme === "midnight")) {
        document.documentElement.dataset.theme = baked.theme;
      }
    })();
  </script>
  <style>
    :root[data-theme="vellum"] {
      --bg: #f4efe4;
      --surface: #fbf8f1;
      --ink: #1e1b18;
      --muted: #5f564b;
      --brass: #9a7428;
      --border: #d9ceb8;
    }
    :root[data-theme="midnight"] {
      --bg: #0f1115;
      --surface: #171b22;
      --ink: #ebe4d5;
      --muted: #a69d8b;
      --brass: #d4aa52;
      --border: #2e3440;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem 1rem;
      background: var(--bg);
      color: var(--ink);
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.5;
    }
    .folio {
      max-width: 720px;
      margin: 0 auto;
      padding: 1.75rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-top: 4px solid var(--brass);
      border-radius: 6px;
    }
    h1 {
      margin: 0 0 0.35rem;
      font-size: 1.45rem;
      letter-spacing: 0.02em;
    }
    .subtitle {
      margin: 0 0 1.25rem;
      color: var(--muted);
      font-size: 0.92rem;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 0.75rem 1.25rem;
      margin: 0;
    }
    dt {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    dd {
      margin: 0.15rem 0 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.95rem;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <main class="folio" aria-label="Baked Vault Snapshot">
    <h1>ClauseHound Local — Archival Baked Vault</h1>
    <p class="subtitle">Self-contained offline snapshot carrying checksum-verified Faraday vault telemetry.</p>
    <dl>
      <div><dt>Active Theme</dt><dd>${escapeHtml(state.theme)}</dd></div>
      <div><dt>Default Tone</dt><dd>${escapeHtml(state.defaultTone)}</dd></div>
      <div><dt>Active Specimen</dt><dd>${escapeHtml(state.activeSpecimenId)}</dd></div>
      <div><dt>Daily Streak Date</dt><dd>${escapeHtml(state.dailyStreakDate)}</dd></div>
      <div><dt>Faraday Air-Gap</dt><dd>${state.airGapLocked ? "LOCKED" : "UNLOCKED"}</dd></div>
      <div><dt>Lifetime Traps Neutralized</dt><dd>${escapeHtml(state.lifetimeTrapsNeutralized)}</dd></div>
      <div><dt>Lifetime Annual Dollars Saved</dt><dd>$${escapeHtml(state.lifetimeAnnualDollarsSaved)}</dd></div>
      <div><dt>Self-Heal Recoveries</dt><dd>${escapeHtml(state.selfHealRecoveries)}</dd></div>
      <div><dt>Tracked Documents / Rules</dt><dd>${escapeHtml(docCount)} docs / ${escapeHtml(totalNeutralizedInMap)} rules</dd></div>
      <div><dt>Excised Fees / Sealed Docs</dt><dd>${escapeHtml(excisedCount)} fees / ${escapeHtml(sealCount)} seals</dd></div>
      <div><dt>FNV-1a32 Checksum</dt><dd>${escapeHtml(state.checksum)}</dd></div>
    </dl>
  </main>
</body>
</html>`;
}

/**
 * Exports a VaultState object as deterministic, checksum-verified JSON text.
 * @param {object} state
 * @returns {string}
 */
export function exportPortableJson(state) {
  const normalized = normalizeVaultState(state);
  return JSON.stringify(normalized, null, 2);
}

/**
 * Parses, schema-validates, and FNV-1a32 checksum-verifies an imported JSON vault string.
 * Supports either a direct VaultState object or `{ vault: VaultState }`.
 * @param {string} rawJson
 * @param {object} [options={}]
 * @returns {object}
 */
export function importPortableJson(rawJson, options = {}) {
  if (typeof rawJson !== "string" || rawJson.trim().length === 0) {
    throw new Error("Portable vault JSON must be a non-empty string");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(`Invalid portable vault JSON: ${err.message}`);
  }

  const candidate =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.vault
      ? parsed.vault
      : parsed;

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Portable vault payload must be a JSON object");
  }

  if (options.recalculateChecksum === true && candidate.checksum === undefined) {
    const normalized = normalizeVaultState(candidate);
    const validated = validateVaultState(normalized);
    if (!validated) {
      throw new Error("Portable vault schema validation failed");
    }
    return cloneVaultState(validated);
  }

  const validated = validateVaultState(candidate);
  if (!validated) {
    const recomputed = normalizeVaultState(candidate);
    if (
      typeof candidate.checksum === "string" &&
      candidate.checksum.toLowerCase() !== computeVaultChecksum(recomputed)
    ) {
      throw new Error("Portable vault checksum mismatch");
    }
    throw new Error("Portable vault failed schema or checksum validation");
  }

  return cloneVaultState(validated);
}

/**
 * Builds a self-contained offline HTML bake snapshot embedding `window.__CLAUSEHOUND_BAKED_VAULT__`.
 * Escapes `<`, `>`, `&`, `\u2028`, and `\u2029` inside `<script id="clausehound-baked-vault">`
 * so `</script>` injection is impossible.
 * In browser environments when same-origin fetch works, inlines `./src/ui/desk-theme.css`
 * and a `data:text/javascript;base64,...` importmap for local `./src/**` modules.
 * Falls back cleanly to a standalone archival snapshot in Node/non-DOM environments.
 * @param {object} state
 * @param {object} [options={}]
 * @returns {Promise<string>}
 */
export async function buildHtmlBakeSnapshot(state, options = {}) {
  const normalized = normalizeVaultState(state);

  if (canAttemptSameOriginFetch(options)) {
    const fetcher = options.fetchImpl || globalThis.fetch.bind(globalThis);
    const modules = Array.isArray(options.modules) ? options.modules : DEFAULT_BAKE_MODULES;
    try {
      const [baseHtml, cssText] = await Promise.all([
        options.baseHtml ? Promise.resolve(options.baseHtml) : fetchText(fetcher, "./index.html"),
        options.cssText
          ? Promise.resolve(options.cssText)
          : fetchText(fetcher, "./src/ui/desk-theme.css")
      ]);

      const importMap = {};
      await Promise.all(
        modules.map(async (modPath) => {
          const source = await fetchText(fetcher, modPath);
          const cleanPath = modPath.replace(/^\.\//, "");
          const rewritten = rewriteModuleImports(source, cleanPath);
          const dataUri = `data:text/javascript;base64,${encodeUtf8ToBase64(rewritten)}`;
          importMap[`clausehound/${cleanPath}`] = dataUri;
          importMap[modPath] = dataUri;
        })
      );

      return buildInlineInteractiveHtml(baseHtml, cssText, importMap, normalized);
    } catch {
      // Fall through cleanly to archival snapshot when offline or partial bundle
    }
  }

  return buildArchivalSnapshotHtml(normalized);
}

/**
 * Triggers a client-side file download via Blob URL without blocking dialogs.
 * Returns false gracefully in non-DOM environments.
 * @param {string} filename
 * @param {string} content
 * @param {string} [mimeType="application/json"]
 * @returns {boolean}
 */
export function triggerFileDownload(filename, content, mimeType = "application/json") {
  if (
    typeof globalThis.document === "undefined" ||
    typeof globalThis.Blob !== "function" ||
    typeof globalThis.URL?.createObjectURL !== "function"
  ) {
    return false;
  }

  const safeName =
    typeof filename === "string" && filename.trim().length > 0
      ? filename.trim()
      : "clausehound-vault.json";
  const blob = new globalThis.Blob([content], { type: mimeType });
  const objectUrl = globalThis.URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = safeName;
  anchor.style.display = "none";

  const parent = globalThis.document.body || globalThis.document.documentElement;
  parent?.appendChild?.(anchor);
  anchor.click();
  parent?.removeChild?.(anchor);

  globalThis.setTimeout?.(() => {
    try {
      globalThis.URL.revokeObjectURL(objectUrl);
    } catch {
      // ignore revoke errors
    }
  }, 1500);

  return true;
}

/**
 * Creates a non-blocking two-step reset manager (zero native blocking dialogs).
 * @param {object} vaultController
 * @param {object} [options={}]
 */
export function createResetDailyManager(vaultController, options = {}) {
  if (!vaultController || typeof vaultController.resetDailyVault !== "function") {
    throw new TypeError("createResetDailyManager requires a valid vaultController");
  }

  const armWindowMs =
    typeof options.armWindowMs === "number" && options.armWindowMs > 0
      ? options.armWindowMs
      : 5000;

  let armedUntil = 0;
  let timerId = null;

  const clearTimer = () => {
    if (timerId !== null) {
      globalThis.clearTimeout?.(timerId);
      timerId = null;
    }
  };

  function isArmed() {
    if (armedUntil === 0) return false;
    if (Date.now() > armedUntil) {
      armedUntil = 0;
      clearTimer();
      return false;
    }
    return true;
  }

  function armReset() {
    clearTimer();
    armedUntil = Date.now() + armWindowMs;
    timerId =
      globalThis.setTimeout?.(() => {
        armedUntil = 0;
        timerId = null;
      }, armWindowMs) ?? null;
    return { armed: true, expiresAt: armedUntil };
  }

  function cancelReset() {
    clearTimer();
    armedUntil = 0;
    return { armed: false };
  }

  async function confirmReset(resetOptions = {}) {
    if (!resetOptions?.force && !isArmed()) {
      throw new Error("Daily reset is not armed; call armReset() before confirmReset()");
    }
    cancelReset();
    const state = await vaultController.resetDailyVault(resetOptions);
    return { reset: true, state };
  }

  async function requestReset(resetOptions = {}) {
    if (!isArmed()) {
      const armState = armReset();
      return { ...armState, reset: false };
    }
    const result = await confirmReset(resetOptions);
    return { armed: false, ...result };
  }

  function dispose() {
    cancelReset();
  }

  return {
    armReset,
    cancelReset,
    isArmed,
    confirmReset,
    requestReset,
    dispose
  };
}
