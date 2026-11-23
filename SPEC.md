# ClauseHound Local — Locked Engineering Specification (Gate 1)

All constants, schemas, events, binary layouts, and ES module export signatures in this specification are **locked** prior to Gate 2 implementation.

---

## 1. Locked Global Constants

```js
export const PWA_CACHE_VERSION = "clausehound-faraday-v1";
export const COOKIE_VAULT_NAME = "krunked-cookie-vault-v1"; // path=/; SameSite=Lax; max-age=31536000; strictly < 3500 bytes encoded
export const LS_VAULT_KEY = "clausehound_vault_v1";
export const IDB_DB_NAME = "ClauseHoundVaultDB";
export const IDB_STORE_NAME = "vault"; // record key: 'primary'

export const TONE_OPTIONS = ["collaborative", "bilateral", "counsel"];

export const CATEGORY_IDS = [
  "AUTO_RENEWAL",
  "INDEMNITY",
  "IP_GRAB",
  "JUNK_FEES",
  "LIABILITY_CAP",
  "UNILATERAL_MOD",
  "ARBITRATION_VENUE",
  "NON_COMPETE",
  "TERMINATION_CURE",
  "HOA_LIEN_DATA"
];

export const DOC_CATEGORY_ENUM = [
  "residential-lease",
  "nda-contractor",
  "saas-msa",
  "hoa-covenants",
  "custom-agreement"
];
```

### Cookie Size Constraint
- `COOKIE_VAULT_NAME` attributes: `path=/; SameSite=Lax; max-age=31536000`.
- Total encoded cookie payload MUST remain strictly `< 3500` bytes; `encodeCookiePayload(state)` trims oldest custom entries in `neutralizedRuleMap` (and secondary fallback maps if needed) until the Base64url value is strictly `< 3200` bytes.

---

## 2. PWA Pre-Cache Asset Manifest (`PRECACHE_ASSETS`)

`sw.js` MUST precache every relative path below resolved against `self.registration.scope` under cache name `PWA_CACHE_VERSION` (`"clausehound-faraday-v1"`):

```js
export const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./src/ui/desk-theme.css",
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
```

---

## 3. Window `CustomEvent` Bus

All cross-module UI/domain notifications dispatch on `window` using `CustomEvent(name, { detail })`:

| Event Name | `detail` Payload Contract | Emitter(s) |
|---|---|---|
| `"clausehound:scan"` | `{ documentId: string, docCategory: DocCategory, text: string, findings: Finding[], summary: ScanSummary, source: "manual" \| "specimen" \| "boot" }` | `clause-workbench.js`, `specimen-drawer.js`, `app-shell.js` |
| `"clausehound:redline"` | `{ documentId: string, ruleId: string, categoryId: CategoryId, tone: ToneOption, neutralized: boolean, annualSavingsDelta: number }` | `clause-workbench.js` |
| `"clausehound:excise-fee"` | `{ documentId: string, feeKey: string, annualDollarsSaved: number, excised: boolean }` | `clause-workbench.js` |
| `"clausehound:seal-stamp"` | `{ documentId: string, receiptHash: string, stamped: boolean, timestamp: string }` | `clause-workbench.js`, `receipt-modal.js` |
| `"clausehound:airgap-toggle"` | `{ locked: boolean, blockedCount: number, lastBlockedEvent?: AirGapLogEntry }` | `faraday-airgap.js`, `command-rail.js` |
| `"clausehound:vault-healed"` | `{ source: "cookie" \| "idb" \| "localStorage" \| "baked", selfHealRecoveries: number, state: VaultState }` | `cookie-vault.js`, `app-shell.js` |

---

## 4. Vault State Schema & Cryptographic Checksum

### 4.1 Schema Definition

```ts
export interface VaultState {
  version: 1;
  theme: "vellum" | "midnight";                 // default: "vellum"
  asmrMixLevel: number;                         // default: 0.32 (clamped 0..1)
  defaultTone: "collaborative" | "bilateral" | "counsel"; // default: "bilateral"
  airGapLocked: boolean;                        // default: true
  activeSpecimenId: string;                     // default: "sterling-lease"
  dailyStreakDate: string;                      // "YYYY-MM-DD"
  lifetimeTrapsNeutralized: number;             // default: 0, non-negative integer
  lifetimeAnnualDollarsSaved: number;           // default: 0, non-negative number
  selfHealRecoveries: number;                   // default: 0, non-negative integer
  neutralizedRuleMap: Record<string, string[]>; // default: {}
  excisedFeeMap: Record<string, boolean>;       // default: {}
  sealStampedMap: Record<string, boolean>;      // default: {}
  checksum: string;                             // 8-char lowercase hex FNV-1a32
}
```

### 4.2 Canonical JSON & FNV-1a32 Checksum

1. Strip top-level `checksum` from the state object.
2. Recursively serialize objects with keys sorted lexicographically (`Array.prototype.sort()`), arrays in element order, skipping `undefined` object properties (canonical JSON).
3. Encode canonical JSON string to UTF-8 bytes.
4. Compute 32-bit FNV-1a:
   - Initial hash: `0x811c9dc5`
   - Prime: `0x01000193`
   - Per byte `b`: `hash = Math.imul((hash ^ b) >>> 0, 0x01000193) >>> 0`
5. Format as 8-character lowercase hexadecimal: `(hash >>> 0).toString(16).padStart(8, "0")`.

### 4.3 Compact Short-Key Cookie Payload

Both `index.html` `<head>` synchronous bootstrap and `src/vault/cookie-vault.js` share this exact wire mapping:

| VaultState Field | Short Key | Encoding |
|---|---|---|
| `version` | `v` | integer `1` |
| `theme` | `t` | `"v"` (`"vellum"`) or `"m"` (`"midnight"`) |
| `asmrMixLevel` | `a` | number (`0..1`) |
| `defaultTone` | `o` | `"c"` (`"collaborative"`), `"b"` (`"bilateral"`), `"n"` (`"counsel"`) |
| `airGapLocked` | `g` | `1` (`true`) or `0` (`false`) |
| `activeSpecimenId` | `s` | string |
| `dailyStreakDate` | `d` | `"YYYY-MM-DD"` |
| `lifetimeTrapsNeutralized` | `lt` | number |
| `lifetimeAnnualDollarsSaved` | `ld` | number |
| `selfHealRecoveries` | `sr` | number |
| `neutralizedRuleMap` | `nr` | `Record<string, string[]>` |
| `excisedFeeMap` | `ef` | `Record<string, 1 \| 0>` (or boolean) |
| `sealStampedMap` | `ss` | `Record<string, 1 \| 0>` (or boolean) |
| `checksum` | `c` | 8-char lowercase hex string |

Serialized JSON -> UTF-8 bytes -> Base64url (`+` -> `-`, `/` -> `_`, no `=` padding). If `encoded.length >= 3200`, oldest custom entries in `neutralizedRuleMap` (followed by oldest map entries as safety fallback) are trimmed and `checksum` (`c`) is recomputed over the trimmed snapshot before encoding so decoded cookie payloads always remain checksum-valid.

### 4.4 Tri-Store Bidirectional Healing Rules

1. `window.__CLAUSEHOUND_BAKED_VAULT__` (if present and valid) seeds missing primary storage first.
2. If **both** `localStorage` (`LS_VAULT_KEY`) and `IndexedDB` (`ClauseHoundVaultDB` / `vault` / `'primary'`) are empty or corrupt while `krunked-cookie-vault-v1` decodes validly:
   - Restore both stores from cookie, increment `selfHealRecoveries`, recompute `checksum`, refresh cookie, and dispatch `"clausehound:vault-healed"` (`detail: { source: "cookie", selfHealRecoveries, state }`).
   - When the synchronous `<head>` script performs the initial `localStorage` heal before module load (`window.__CLAUSEHOUND_BOOT_HEAL__`), `initVault()` syncs `IndexedDB` and emits `"clausehound:vault-healed"` without double-incrementing `selfHealRecoveries`.
3. If **only one** of `localStorage` or `IndexedDB` is missing/corrupt while the other is valid:
   - Heal the missing store from the surviving primary store, increment `selfHealRecoveries`, refresh cookie, and dispatch `"clausehound:vault-healed"` (`detail: { source: "localStorage" | "idb", selfHealRecoveries, state }`).
4. If `krunked-cookie-vault-v1` is missing/corrupt while primary storage (`localStorage` and/or `IndexedDB`) is valid:
   - Regenerate `krunked-cookie-vault-v1` synchronously with `path=/; SameSite=Lax; max-age=31536000`.

---

## 5. Locked ES Module Export Signatures

### 5.1 `src/vault/*`

#### `src/vault/cookie-vault.js`
- `export const COOKIE_VAULT_NAME = "krunked-cookie-vault-v1"`
- `export const LS_VAULT_KEY = "clausehound_vault_v1"`
- `export const IDB_DB_NAME = "ClauseHoundVaultDB"`
- `export const IDB_STORE_NAME = "vault"`
- `export const DEFAULT_VAULT_STATE` (frozen `VaultState`)
- `export function computeVaultChecksum(stateWithoutChecksum): string`
- `export function encodeCookiePayload(state): string`
- `export function decodeCookiePayload(encoded): VaultState | null`
- `export function createVaultController(env?): VaultController`
  - `env?: { storage?, getCookie?, setCookie?, idb?, dispatchEvent?, bakedVault?, bootHeal?, now? }`
  - Returns `{ initVault, getVaultState, updateVaultState, resetDailyVault, restoreVaultSnapshot, subscribeVault, encodeCookiePayload, decodeCookiePayload, computeVaultChecksum }`
- `export function initVault(): Promise<VaultState>`
- `export function getVaultState(): VaultState`
- `export function updateVaultState(patch: Partial<VaultState> | ((prev: VaultState) => Partial<VaultState>)): Promise<VaultState>`
- `export function resetDailyVault(options?: { includeLifetime?: boolean }): Promise<VaultState>`
- `export function restoreVaultSnapshot(snapshot: VaultState): Promise<VaultState>`
- `export function subscribeVault(fn: (state: VaultState) => void): () => void`

#### `src/vault/local-sync.js`
- `export function exportPortableJson(state): string`
- `export function importPortableJson(rawJson, options?): VaultState` (validates schema, recalculates and verifies FNV-1a32 checksum, throws `Error` on schema or checksum mismatch)
- `export async function buildHtmlBakeSnapshot(state, options?): Promise<string>`
  - Embeds `window.__CLAUSEHOUND_BAKED_VAULT__` inside `<script id="clausehound-baked-vault">`, escaping `<`, `>`, `&`, `\u2028`, `\u2029` as `\u003c`, `\u003e`, `\u0026`, `\u2028`, `\u2029`.
  - In browser when same-origin fetch works, inlines `./src/ui/desk-theme.css` and builds a `<script type="importmap">` mapping `data:text/javascript;base64,...` entries for `./src/**` modules; falls back cleanly to standalone archival HTML snapshot in Node/non-DOM environments.
- `export function triggerFileDownload(filename, content, mimeType?): boolean`
- `export function createResetDailyManager(vaultController): { armReset, cancelReset, isArmed, confirmReset, requestReset, dispose }`

---

### 5.2 `src/engine/*`

#### `src/engine/clause-rules.js`
- Re-exports `CATEGORY_IDS`, `TONE_OPTIONS`, `DOC_CATEGORY_ENUM`.
- `export const MIN_TOTAL_RULES = 152`
- `export const MIN_RULES_PER_CATEGORY = 15`
- `export const CATEGORY_RULE_TARGETS: Record<CategoryId, number>` — exact per-category minimum rule counts summing to `>= 152` (`>= 15` per category):
  - `AUTO_RENEWAL`: `16`
  - `INDEMNITY`: `16`
  - `IP_GRAB`: `15`
  - `JUNK_FEES`: `15`
  - `LIABILITY_CAP`: `15`
  - `UNILATERAL_MOD`: `15`
  - `ARBITRATION_VENUE`: `15`
  - `NON_COMPETE`: `15`
  - `TERMINATION_CURE`: `15`
  - `HOA_LIEN_DATA`: `15`
  - **Total Minimum**: `152` verified rules across 10 categories.
- `export const CATEGORY_METADATA: Record<CategoryId, { id, label, weight, summary }>`
- `export const CLAUSE_RULES: ClauseRule[]`
  - Each `ClauseRule`: `{ id: string, categoryId: CategoryId, title: string, severity: "critical" | "high" | "medium" | "low", riskPoints: number, annualFeeEstimate: number, docCategories?: DocCategory[], pattern: RegExp, rationale: string, redlines: { collaborative: string, bilateral: string, counsel: string } }`
- `export function getRuleCountsByCategory(): Record<CategoryId, number>`

#### `src/engine/specimens.js`
- `export const SPECIMENS: SpecimenDocument[]` (at least 5 curated realistic agreements covering every entry of `DOC_CATEGORY_ENUM`, with `id: "sterling-lease"` as default specimen)
- `export function getSpecimenById(id: string): SpecimenDocument | null`
- `export function listSpecimens(docCategory?: DocCategory): SpecimenDocument[]`

#### `src/engine/clause-scanner.js`
- `export function scanDocument(text: string, options?: { documentId?: string, docCategory?: DocCategory }): ScanResult`
  - `ScanResult`: `{ documentId, docCategory, findings: Finding[], fees: ExtractedFee[], riskScore: number, categoryBreakdown: Record<CategoryId, number>, scannedChars: number }`
  - `Finding`: `{ ruleId, categoryId, title, severity, riskPoints, annualFeeEstimate, matchText, startOffset, endOffset, excerpt, rationale, redlines }`
- `export function computeRiskScore(findings: Finding[]): number` (`0..100`)
- `export function extractRecurringFees(text: string): ExtractedFee[]` (`{ feeKey, label, rawAmount, period: "monthly" | "annual" | "one-time", annualizedDollars, startOffset, endOffset }`)
- `export function getCategoryBreakdown(findings: Finding[]): Record<CategoryId, number>`

#### `src/engine/redline-engine.js`
- `export function generateRedline(finding: Finding, tone?: ToneOption): { ruleId, tone, replacementText, rationale }`
- `export function applyRedlines(text: string, findings: Finding[], neutralizedRuleIds: string[] | Set<string>, tone?: ToneOption): { redlinedText: string, appliedCount: number, riskScoreAfter: number }`
- `export function exciseJunkFees(text: string, excisedFeeKeys: string[] | Set<string>, fees?: ExtractedFee[]): { cleanedText: string, excisedCount: number, annualDollarsSaved: number }`
- `export function buildRedlineDiff(originalText: string, redlinedText: string): DiffSegment[]`

#### `src/engine/webllm-bridge.js`
- **Zero hardcoded vendor model names or external URLs**.
- `export async function detectWebGpuCapability(nav?): Promise<{ supported: boolean, adapterInfo?: Record<string, unknown>, maxBufferSizeMB: number, estimatedVramMB: number }>`
- `export function selectOptimalLocalModel(modelList: Array<{ model_id: string, vram_required_MB: number, low_resource_required?: boolean }>, capability: { estimatedVramMB: number }): { sortedCatalog: Array<object>, recommended: object | null }`
  - **Dynamic Runtime Sorting Rule**: Sorts runtime-discovered `model_list` entries strictly by numeric `vram_required_MB` ascending (`a.vram_required_MB - b.vram_required_MB`), selecting the highest-tier entry whose `vram_required_MB <= capability.estimatedVramMB` (or smallest `vram_required_MB` entry as constrained fallback).
- `export function createWebLlmBridge(env?): { probe, loadModel, explainClause, unload, getStatus }`
  - Must check `isAirGapLocked()` before any network-backed runtime fetch; throws `FaradayAirGapError` if `airGapLocked === true` and model artifacts are not already locally cached.

---

### 5.3 `src/security/*`

#### `src/security/faraday-airgap.js`
- `export const FARADAY_WRAPPED_APIS = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon"]`
- `export class FaradayAirGapError extends Error`
- `export function installFaradaySandbox(options?: { targetGlobal?: object, allowSameOriginGet?: boolean, initialLocked?: boolean }): { installed: boolean, uninstall: () => void }`
  - **Wrapper Rules**:
    1. Wraps `fetch`, `XMLHttpRequest.prototype.open`, `WebSocket`, `EventSource`, and `navigator.sendBeacon` idempotently, preserving original references for clean teardown.
    2. Normalizes request target URL against `targetGlobal.location?.href`.
    3. When `airGapLocked === true`:
       - `WebSocket`, `EventSource`, and `navigator.sendBeacon`: unconditionally blocked (`FaradayAirGapError` thrown for `WebSocket`/`EventSource`; `false` returned for `sendBeacon`).
       - `fetch` / `XMLHttpRequest`: any cross-origin request, non-`http(s)` external socket, or non-`GET`/`HEAD` request is unconditionally blocked with `FaradayAirGapError`. Same-origin `./` `GET`/`HEAD` requests pass only when `allowSameOriginGet !== false`.
    4. Every blocked call appends `{ id, timestamp, api, method, url, origin, blocked: true, reason }` to the Interception Ledger and dispatches `"clausehound:airgap-toggle"`.
- `export function setAirGapLocked(locked: boolean): boolean`
- `export function isAirGapLocked(): boolean`
- `export function getInterceptionLog(): AirGapLogEntry[]`
- `export function clearInterceptionLog(): void`
- `export function uninstallFaradaySandbox(): void`

---

### 5.4 `src/audio/*`

#### `src/audio/faraday-audio.js`
- `export function createAudioEngine(env?): AudioEngine`
- `export function unlockAudioContext(): Promise<boolean>`
- `export function setAsmrMixLevel(level: number): number`
- `export function playPaperRustle(): void`
- `export function playPenScratch(): void`
- `export function playBrassClick(): void`
- `export function playSealThud(): void`
- `export function playAirGapLatch(locked: boolean): void`
- `export function setAmbientDeskEnabled(enabled: boolean): boolean`
- `export function getAudioState(): { supported: boolean, unlocked: boolean, mixLevel: number, ambientEnabled: boolean }`

---

### 5.5 `src/share/*`

#### `src/share/receipt-codec.js`
- `export const RECEIPT_BYTE_LENGTH = 37`
- `export const RECEIPT_HASH_PREFIX = "#receipt="`

#### Exact 37-Byte `#receipt=` Binary Layout (`Uint8Array(37)`)

| Byte Offset | Size | Type / Endianness | Field Name | Encoding / Semantics |
|---|---|---|---|---|
| `0` | 1B | `uint8` | `magic` | Fixed `0x43` (`'C'`) |
| `1` | 1B | `uint8` | `schemaVersion` | Fixed `0x01` |
| `2` | 1B | `uint8` bitfield | `flags` | `bit 0`: `airGapLocked`; `bit 1`: `sealed`; `bits 2..3`: `toneIndex` (`0..2` in `TONE_OPTIONS`); `bits 4..6`: `docCategoryIndex` (`0..4` in `DOC_CATEGORY_ENUM`); `bit 7`: `0` |
| `3` | 1B | `uint8` | `riskScoreBefore` | Clamped `0..100` |
| `4` | 1B | `uint8` | `riskScoreAfter` | Clamped `0..100` |
| `5..6` | 2B | `uint16` BE | `trapsDetected` | Clamped `0..65535` |
| `7..8` | 2B | `uint16` BE | `trapsNeutralized` | Clamped `0..65535` |
| `9..12` | 4B | `uint32` BE | `annualDollarsSaved` | Clamped `0..4294967295` |
| `13..16` | 4B | `uint32` BE | `timestampUnixSec` | Unix epoch seconds (`uint32`) |
| `17..20` | 4B | `uint32` BE | `docDigestFnv1a` | FNV-1a32 digest of scanned text |
| `21..22` | 2B | `uint16` BE | `categoryMask` | 10-bit mask (`1 << i` for `CATEGORY_IDS[i]`) |
| `23..32` | 10B | `10 x uint8` | `categoryCounts` | Findings count per `CATEGORY_IDS[0..9]` (`0..255`) |
| `33..36` | 4B | `uint32` BE | `integrityTrailer` | FNV-1a32 hash over bytes `0..32` |

- `export function encodeReceiptBinary(receiptData): Uint8Array` (always length `37`)
- `export function decodeReceiptBinary(bytes: Uint8Array): ReceiptData | null` (validates length `37`, `magic === 0x43`, `schemaVersion === 0x01`, `toneIndex < 3`, `docCategoryIndex < 5`, and FNV-1a32 trailer over bytes `0..32`)
- `export function encodeReceiptHash(receiptData): string` (returns `"#receipt=" + base64url(encodeReceiptBinary(receiptData))`)
- `export function decodeReceiptHash(hashString: string): ReceiptData | null`
- `export function buildReceiptDataFromAudit(auditResult, vaultState): ReceiptData`

---

### 5.6 `src/canvas/*`

#### `src/canvas/seal-renderer.js`
- `export function renderFaradaySeal(canvas: HTMLCanvasElement, receiptData: ReceiptData, options?: { theme?: "vellum" | "midnight", dpr?: number }): void`
- `export function buildVerificationCertificateCanvas(receiptData: ReceiptData, options?: { width?: number, height?: number, theme?: "vellum" | "midnight" }): HTMLCanvasElement`
- `export async function exportSealPngBlob(canvas: HTMLCanvasElement): Promise<Blob>`

---

### 5.7 `src/pwa/*` & Root PWA Files

#### `src/pwa/sw-register.js`
- Re-exports `PWA_CACHE_VERSION` (`"clausehound-faraday-v1"`).
- `export async function registerFaradayServiceWorker(options?: { swPath?: string, scope?: string }): Promise<{ registered: boolean, scope?: string, registration?: ServiceWorkerRegistration, reason?: string }>`
- `export function getServiceWorkerStatus(): { supported: boolean, registered: boolean, controllerActive: boolean, cacheVersion: string }`
- `export async function clearOldCaches(activeVersion?: string): Promise<string[]>`

#### Root PWA Files
- `manifest.json`: relative `"start_url": "./"`, `"scope": "./"`, `"display": "standalone"`, `"background_color": "#0F1115"`, `"theme_color": "#0F1115"`, icons referencing `./assets/icons/icon-192.png` and `./assets/icons/icon-512.png`.
- `sw.js`: imports or embeds `PWA_CACHE_VERSION` and `PRECACHE_ASSETS`, resolves relative URLs against `self.registration.scope`, serves cache-first for precached static assets, and purges stale caches on `activate`.

---

### 5.8 `src/ui/*`

- `src/ui/desk-theme.css`: CSS custom property palette for `:root[data-theme="vellum"]` ("Archival Cotton Vellum") and `:root[data-theme="midnight"]` ("Midnight Faraday Brass"), responsive grid/flex desk layout styling `#app-desk-root` slots, zero external `@import` or external URLs.
- `src/ui/app-shell.js`: `export async function bootstrapAppShell(options?)`, mounts slots, initializes vault (`initVault()`), installs Faraday Air-Gap (`installFaradaySandbox()`), wires all `clausehound:*` `CustomEvent` handlers, registers Service Worker (`registerFaradayServiceWorker()`), auto-executes initial scan on active specimen.
- `src/ui/command-rail.js`: `export function mountCommandRail(container, context): { update(state), destroy() }`
- `src/ui/telemetry-strip.js`: `export function mountTelemetryStrip(container, context): { update(telemetry), destroy() }`
- `src/ui/clause-workbench.js`: `export function mountClauseWorkbench(container, context): { loadDocument(doc), updateVault(state), destroy() }`
- `src/ui/specimen-drawer.js`: `export function mountSpecimenDrawer(container, context): { updateActive(specimenId), open(), close(), destroy() }`
- `src/ui/vault-modal.js`: `export function mountVaultModal(portalContainer, toastContainer, context): { open(), close(), showToast(message, kind?), destroy() }`
- `src/ui/receipt-modal.js`: `export function mountReceiptModal(portalContainer, toastContainer, context): { open(receiptData), close(), destroy() }`
