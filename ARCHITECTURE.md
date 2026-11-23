# ClauseHound Local — Faraday Brass Desk Architecture

## 1. System Topology

ClauseHound Local is a **zero-backend, offline-first static web workbench** engineered for local contract inspection, predatory clause neutralization, recurring junk-fee excision, and portable cryptographic-style audit receipts. Every computation executes directly inside the client browser tab using standard ES Modules (`type="module"`), with zero build-step bundler dependencies and zero remote API calls.

```text
+-----------------------------------------------------------------------------------+
| index.html (Synchronous <head> Boot Guard + Theme Application + 5 DOM Slots)      |
+-----------------------------------------------------------------------------------+
        |                                     |                              |
        v                                     v                              v
+------------------+               +--------------------+         +------------------+
| Tri-Store Vault  |               | Faraday Air-Gap    |         | Static PWA Shell |
| LS + IDB +       |               | 5-API Network      |         | ./sw.js (26) +   |
| Cookie MicroVault|               | Sandbox + Ledger   |         | ./manifest.json  |
+------------------+               +--------------------+         +------------------+
        |                                     |                              |
        +-----------------------+-------------+------------------------------+
                                |
                                v
+-----------------------------------------------------------------------------------+
| Domain Layer (Pure Deterministic Engines + Procedural Synthesizers + Binary Share)|
|  - src/engine/clause-rules.js (160 rules across 10 CATEGORY_IDS; 16/category)     |
|  - src/engine/specimens.js (5 DOC_CATEGORY_ENUM agreements)                       |
|  - src/engine/clause-scanner.js + redline-engine.js (.txt/.md/.docx/.pdf + 3-tone)|
|  - src/engine/webllm-bridge.js (Optional WebGPU local LLM sorted by VRAM)         |
|  - src/audio/faraday-audio.js (0 KB procedural WebAudio Foley + ambient mixer)    |
|  - src/share/receipt-codec.js (37-byte #receipt= verifier + email/packet export)  |
|  - src/canvas/seal-renderer.js (High-DPI notary seal, 1200x630 card + 60fps FX)   |
+-----------------------------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------------------------+
| Reactive UI Layer (Event Bus + Vault Subscriptions -> 5 Explicit Shell Slots)     |
|  #command-rail-slot | #telemetry-strip-slot | #studio-workspace-slot              |
|  #overlay-portal-slot (non-blocking modals) | #toast-region-slot (aria-live)      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Zero-Backend Trust Model

1. **Zero Server-Side Processing**: Contract drafts, uploaded files (`.txt`, `.md`, `.docx` via pure-JS ZIP + `DecompressionStream("deflate-raw")`, and `.pdf` via `FlateDecode` + `Tj`/`TJ` extraction with graceful `scanned-image-pdf` fallback), redlines, fee calculations, and audit telemetry never leave the user's device. There is no application server, telemetry endpoint, analytics beacon, or external CDN dependency.
2. **Zero External Assets**: All stylesheets, JavaScript modules, PWA manifests, binary PNG icons (`192x192`, `512x512`, `180x180`), and WebAudio acoustics are self-contained or procedurally generated. System serif, sans-serif, and monospace font stacks replace external font hosts.
3. **Tri-Store Persistence & Bidirectional Self-Healing**:
   - **Primary Store A (`localStorage`)**: Key `clausehound_vault_v1` stores canonical `VaultState` JSON for synchronous first-paint access.
   - **Primary Store B (`IndexedDB`)**: Database `ClauseHoundVaultDB`, object store `vault`, record key `'primary'` provides durable asynchronous persistence resilient to partial storage clears.
   - **Micro-Backup Store (`document.cookie`)**: Cookie `krunked-cookie-vault-v1` (`path=/; SameSite=Lax; max-age=31536000`) stores a compact short-key Base64url + FNV-1a32 integrity payload strictly under `3500` bytes (trimmed cleanly below `3200` bytes encoded value). Both double-wipe recovery from cookie and single-store recovery (missing `localStorage` or missing `IndexedDB`) restore the wiped store(s), increment `selfHealRecoveries`, refresh all three stores, and emit `"clausehound:vault-healed"`.
4. **Portable Backup & Offline HTML Bake**:
   - Users export/import checksum-verified `.json` vault files or bake a self-contained offline `.html` snapshot embedding `window.__CLAUSEHOUND_BAKED_VAULT__` with strict Unicode escaping (`\u003c`, `\u003e`, `\u0026`, `\u2028`, `\u2029`) preventing `<script>` injection, along with inlined CSS and a `<script type="importmap">` of `data:text/javascript;base64,...` modules in browser environments.
5. **Non-Blocking Interface Contract**:
   - Native blocking browser modal prompts (`alert()`, `confirm()`, `prompt()`) are strictly prohibited across the entire codebase. Confirmations (including two-step daily desk reset) and notifications render exclusively inside `#overlay-portal-slot` and `#toast-region-slot`.

---

## 3. Faraday Air-Gap Network Sandbox Lifecycle

ClauseHound enforces a **locked-by-default** runtime network boundary (`airGapLocked: true` in `VaultState`):

1. **Pre-Module Installation**: `src/security/faraday-airgap.js` (`installFaradaySandbox`) installs first during `bootstrapAppShell()` in `app-shell.js` before vault initialization, specimen scan, or Service Worker registration runs.
2. **Wrapped Primitives**:
   - `window.fetch`
   - `XMLHttpRequest.prototype.open` (with `send` guard)
   - `window.WebSocket`
   - `window.EventSource`
   - `navigator.sendBeacon`
3. **Locked Enforcement (`airGapLocked === true`)**:
   - Any cross-origin HTTP/HTTPS call, protocol-relative `//host` URL, non-GET/HEAD mutation call, query-string exfiltration (`url.search !== ""`), `WebSocket`, `EventSource`, or `navigator.sendBeacon` call is blocked immediately with `0` outbound bytes.
   - Blocked calls throw `FaradayAirGapError` (or return `false` for `sendBeacon`), append a structured entry to the live Interception Ledger, notify `subscribeAirGap` listeners (`getAirGapTelemetry`), and broadcast `"clausehound:airgap-toggle"` so the Command Rail badge and Telemetry Strip reflect blocked attempts in real time.
   - Query-free same-origin `./` read-only static asset fetches (`GET`/`HEAD`, plus local `data:` / same-origin `blob:`) pass only when `allowSameOriginGet` is enabled (required for `buildHtmlBakeSnapshot` and local PWA caching), and can be disabled in strict zero-IO verification mode (`allowSameOriginGet: false`).
   - `PerformanceObserver` (`entryTypes: ["resource"]`) and `online`/`offline` listeners track `hardwareOffline` (`TRUE HARDWARE AIR-GAP VERIFIED`).
4. **Controlled Unlock & Re-Lock**:
   - Disengaging the Faraday Air-Gap requires explicit user action via the Command Rail lock toggle, updating `airGapLocked: false` in the vault and emitting `"clausehound:airgap-toggle"`.
   - Only while unlocked may `src/engine/webllm-bridge.js` load uncached remote WebGPU artifacts; when WebGPU is unavailable or locked before weights are cached, `explainClause` falls back deterministically to `generateRedline` parity.

---

## 4. ES Module Dependency DAG

Dependencies flow strictly downward without cycles from Layer 3 (UI) to Layer 0 (Locked Contracts).

```text
Layer 0 (Locked Contracts & Constants)
  `-- SPEC.md constants mirrored in cookie-vault.js, clause-rules.js, faraday-airgap.js,
      receipt-codec.js, sw-register.js, sw.js, index.html

Layer 1 (Zero-Internal-Dependency Primitives)
  +-- src/vault/cookie-vault.js
  +-- src/security/faraday-airgap.js
  +-- src/engine/clause-rules.js
  +-- src/audio/faraday-audio.js
  +-- src/share/receipt-codec.js
  `-- src/pwa/sw-register.js

Layer 2 (Domain Services — Strict Acyclic Order)
  +-- src/vault/local-sync.js          --> cookie-vault.js
  +-- src/engine/specimens.js          --> clause-rules.js
  +-- src/engine/clause-scanner.js     --> clause-rules.js
  +-- src/engine/redline-engine.js     --> clause-rules.js, clause-scanner.js
  +-- src/engine/webllm-bridge.js      --> faraday-airgap.js, redline-engine.js
  `-- src/canvas/seal-renderer.js      --> receipt-codec.js

Layer 3 (UI Modules & Shell Orchestration)
  +-- src/ui/command-rail.js           --> faraday-audio.js, sw-register.js
  +-- src/ui/telemetry-strip.js        --> clause-rules.js, faraday-audio.js
  +-- src/ui/specimen-drawer.js        --> specimens.js, clause-scanner.js, faraday-audio.js
  +-- src/ui/clause-workbench.js       --> clause-rules.js, clause-scanner.js, redline-engine.js,
  |                                        webllm-bridge.js, faraday-airgap.js, faraday-audio.js,
  |                                        seal-renderer.js
  +-- src/ui/vault-modal.js            --> local-sync.js, faraday-airgap.js, faraday-audio.js
  +-- src/ui/receipt-modal.js          --> receipt-codec.js, seal-renderer.js, local-sync.js,
  |                                        faraday-audio.js
  `-- src/ui/app-shell.js              --> cookie-vault.js, local-sync.js, faraday-airgap.js,
                                           specimens.js, faraday-audio.js, receipt-codec.js,
                                           sw-register.js, all src/ui/* panels
```

Cross-cutting coordination across decoupled modules uses the `window` `CustomEvent` bus (`clausehound:*`) and `subscribeVault(fn)` / `subscribeAirGap(fn)`.

---

## 5. Dual-Theme Rendering Pipeline

ClauseHound renders two desk aesthetics driven by `document.documentElement.dataset.theme`:

1. **Archival Cotton Vellum (`"vellum"`, default)**:
   - Warm cotton folio ground (`#F4EFE6`), pressed rag-paper panel elevation, iron-gall charcoal typography (`#1C1917`), brushed antique brass borders (`#B68D40`), crimson redline highlights (`#9E1B24`), and emerald neutralized markers (`#145A43`).
2. **Midnight Faraday Brass (`"midnight"`)**:
   - Anodized obsidian chamber ground (`#0F1115`), dark slate drafting surfaces, warm brushed brass hairlines, tungsten amber readouts (`#E5A93C`), and phosphor-emerald telemetry (`#2DD4BF`) matching `<meta name="theme-color" content="#0F1115">`.

**Zero-FOUC Synchronous Paint Pipeline**:
- Before `desk-theme.css` completes first paint, the synchronous `<head>` bootstrap script in `index.html` resolves `window.__CLAUSEHOUND_BAKED_VAULT__`, `localStorage`, and `krunked-cookie-vault-v1`, heals `localStorage` from the cookie if needed (`window.__CLAUSEHOUND_BOOT_HEAL__`), and assigns `document.documentElement.dataset.theme` synchronously.
- `src/canvas/seal-renderer.js` reads resolved CSS custom properties via `getComputedStyle(document.documentElement)` so rendered brass/wax seals and `1200x630` verification certificates harmonize with the active theme, and cancels every `requestAnimationFrame` loop upon animation completion.

---

## 6. 0 KB Procedural WebAudio Signal Chain

`src/audio/faraday-audio.js` synthesizes all desk acoustics mathematically at runtime with **0 KB of audio files**:

```text
[White / Pink / Velvet Noise Buffers] --> [BiquadFilterNode] --> [ADSR GainNode] --+
  (paperRustle, penScratch, sealThud)                                              |
                                                                                   +--> [sfxBus] ----+
[OscillatorNode / Damped Modal Resonators] --> [Envelope GainNode] ----------------+                 |
  (brassClick, scanTick, splitFlapClick, sealThud bell, airgapLatch)                                 +--> [masterGain] --> [DynamicsCompressorNode] --> [Destination]
                                                                                                     |   (asmrMixLevel)
[Low-Level Faraday Room Tone Oscillator + Filtered Noise] -----------------------------> [ambientBus]-+
```

- `AudioContext` instantiates lazily only inside `unlockAudioContext()` after a verified user gesture (zero autoplay warnings) and degrades to a zero-throw no-op when `AudioContext` is absent.
- `masterGain` tracks `VaultState.asmrMixLevel` (default `MIX_PRESETS.whisper = 0.32`, clamped `[0.0, 1.0]`).
- `DynamicsCompressorNode` prevents clipping during rapid multi-clause redlines, split-flap odometer cascades, or seal stamps.

---

## 7. Subpath-Safe Static GitHub Pages Architecture

Primary deployment target: `https://krunked-fpv.github.io/clausehound-ai/`

Deploying under a repository subpath (`/clausehound-ai/`) breaks root-anchored `/...` paths. ClauseHound guarantees subpath portability across `/clausehound-ai/`, root `/`, and local static servers via:

1. **Strictly Relative `./` References**: Every `<link>`, `<script>`, `manifest.json` field (`"start_url": "./"`, `"scope": "./"`, icon `src`), ES module relative import (`../` / `./`), and all `26` Service Worker precache entries use relative paths with zero leading slashes.
2. **Root-Level `./sw.js` Registration**: Placing `sw.js` at repository root and registering `./sw.js` with `{ scope: "./" }` binds the Service Worker scope cleanly to `/clausehound-ai/` without custom `Service-Worker-Allowed` HTTP headers.
3. **Scope-Resolved Cache Keys**: Inside `sw.js`, precache asset paths resolve via `new URL(relPath, self.registration.scope).href`, and cache versioning binds strictly to `PWA_CACHE_VERSION = "clausehound-faraday-v1"`.
4. **Origin-Safe Cookie Persistence & Static CI**: `COOKIE_VAULT_NAME = "krunked-cookie-vault-v1"` uses `path=/; SameSite=Lax; max-age=31536000`, remaining readable under both `/` and `/clausehound-ai/`. `.github/workflows/deploy-pages.yml` stages only static runtime assets (`index.html`, `manifest.json`, `sw.js`, `assets/`, `src/`).
