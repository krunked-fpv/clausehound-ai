# ClauseHound Local — Faraday Brass Desk Architecture

## 1. System Topology

ClauseHound Local is a **zero-backend, offline-first static web workbench** engineered for local contract inspection, predatory clause neutralization, recurring junk-fee excision, and portable cryptographic-style audit receipts. Every computation executes directly inside the client browser tab using standard ES Modules (`type="module"`), with zero build-step bundler dependencies and zero remote API calls.

```text
+-----------------------------------------------------------------------------------+
| index.html (Synchronous <head> Boot Guard + Theme Application + DOM Slots)        |
+-----------------------------------------------------------------------------------+
        |                                     |                              |
        v                                     v                              v
+------------------+               +--------------------+         +------------------+
| Tri-Store Vault  |               | Faraday Air-Gap    |         | Static PWA Shell |
| LS + IDB +       |               | Runtime Network    |         | ./sw.js +        |
| Cookie MicroVault|               | Sandbox Wrapper    |         | ./manifest.json  |
+------------------+               +--------------------+         +------------------+
        |                                     |                              |
        +-----------------------+-------------+------------------------------+
                                |
                                v
+-----------------------------------------------------------------------------------+
| Domain Layer (Pure Deterministic Engines + Procedural Synthesizers + Binary Share)|
|  - src/engine/clause-rules.js (152+ patterns across 10 CATEGORY_IDS)              |
|  - src/engine/specimens.js (5 DOC_CATEGORY_ENUM specimens)                        |
|  - src/engine/clause-scanner.js + redline-engine.js (3-tone rewrites + fee math)  |
|  - src/engine/webllm-bridge.js (Optional WebGPU local LLM sorted by VRAM)         |
|  - src/audio/faraday-audio.js (0 KB procedural WebAudio Foley + ambient mixer)    |
|  - src/share/receipt-codec.js (37-byte #receipt= Base64url verifier)              |
|  - src/canvas/seal-renderer.js (High-DPI Canvas brass/wax notary seal)            |
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

1. **Zero Server-Side Processing**: Contract drafts, uploaded files, redlines, fee calculations, and audit telemetry never leave the user's device. There is no application server, telemetry endpoint, analytics beacon, or external CDN dependency.
2. **Zero External Assets**: All stylesheets, JavaScript modules, PWA manifests, icons, and optional WebAudio acoustics are self-contained or procedurally generated. System serif, sans-serif, and monospace font stacks replace external font hosts.
3. **Tri-Store Persistence & Self-Healing**:
   - **Primary Store A (`localStorage`)**: Key `clausehound_vault_v1` stores canonical `VaultState` JSON for synchronous first-paint access.
   - **Primary Store B (`IndexedDB`)**: Database `ClauseHoundVaultDB`, object store `vault`, record key `'primary'` provides durable asynchronous persistence resilient to partial storage clears.
   - **Micro-Backup Store (`document.cookie`)**: Cookie `krunked-cookie-vault-v1` (`path=/; SameSite=Lax; max-age=31536000`) stores a compact short-key Base64url + FNV-1a32 integrity payload strictly under 3500 bytes (trimmed cleanly below 3200 bytes encoded value). If both `localStorage` and `IndexedDB` are cleared while the cookie survives, boot recovery restores both stores and increments `selfHealRecoveries`.
4. **Portable Backup & Offline HTML Bake**:
   - Users export/import checksum-verified `.json` vault files or bake a self-contained offline `.html` snapshot embedding `window.__CLAUSEHOUND_BAKED_VAULT__` with strict Unicode escaping (`\u003c`, `\u003e`, `\u0026`, `\u2028`, `\u2029`) preventing `<script>` injection.
5. **Non-Blocking Interface Contract**:
   - Native blocking browser modal prompts are strictly prohibited across the entire codebase. Confirmations (including daily desk reset) and notifications render exclusively inside `#overlay-portal-slot` and `#toast-region-slot`.

---

## 3. Faraday Air-Gap Network Sandbox Lifecycle

ClauseHound enforces a **locked-by-default** runtime network boundary (`airGapLocked: true` in `VaultState`):

1. **Pre-Module Installation**: `src/security/faraday-airgap.js` installs immediately during `app-shell.js` startup before any optional local inference bridge or dynamic component runs.
2. **Wrapped Primitives**:
   - `window.fetch`
   - `XMLHttpRequest.prototype.open`
   - `window.WebSocket`
   - `window.EventSource`
   - `navigator.sendBeacon`
3. **Locked Enforcement (`airGapLocked === true`)**:
   - Any cross-origin HTTP/HTTPS call, any non-GET/HEAD mutation call, any `WebSocket`, any `EventSource`, and any `navigator.sendBeacon` call is blocked immediately.
   - Blocked calls throw `FaradayAirGapError` (or return `false` for `sendBeacon`), record a structured entry in the live Interception Ledger, and broadcast `"clausehound:airgap-toggle"` so the Command Rail badge and Telemetry Strip reflect blocked attempts in real time.
   - Same-origin `./` read-only static asset fetches (`GET`/`HEAD`) may be permitted only when `allowSameOriginGet` is enabled (required for `buildHtmlBakeSnapshot` and local PWA caching), and can be disabled in strict zero-IO verification mode.
4. **Controlled Unlock & Re-Lock**:
   - Disengaging the Faraday Air-Gap requires explicit user action via the Command Rail lock toggle, updating `airGapLocked: false` in the vault and emitting `"clausehound:airgap-toggle"`.
   - Only while unlocked may `src/engine/webllm-bridge.js` initialize an optional local WebGPU runtime cache; once cached, the user can immediately re-engage `airGapLocked: true` for isolated local inference.

---

## 4. ES Module Dependency DAG

Dependencies flow strictly downward from Layer 3 (UI) to Layer 0 (Core Constants/Contracts). Cycles and upward imports from domain engines into UI modules are forbidden.

```text
Layer 0 (Locked Contracts & Constants)
  `-- SPEC.md constants mirrored in vault, engine, security, pwa

Layer 1 (Zero-Internal-Dependency Primitives)
  +-- src/vault/cookie-vault.js
  +-- src/security/faraday-airgap.js
  +-- src/engine/clause-rules.js
  +-- src/engine/specimens.js
  +-- src/audio/faraday-audio.js
  +-- src/share/receipt-codec.js
  `-- src/pwa/sw-register.js

Layer 2 (Domain Services)
  +-- src/vault/local-sync.js          --> cookie-vault.js
  +-- src/engine/clause-scanner.js     --> clause-rules.js
  +-- src/engine/redline-engine.js     --> clause-rules.js, clause-scanner.js
  +-- src/engine/webllm-bridge.js      --> faraday-airgap.js
  `-- src/canvas/seal-renderer.js      --> receipt-codec.js

Layer 3 (UI Modules & Shell Orchestration)
  +-- src/ui/command-rail.js           --> faraday-audio.js
  +-- src/ui/telemetry-strip.js        --> (pure DOM + CustomEvents)
  +-- src/ui/specimen-drawer.js        --> specimens.js
  +-- src/ui/clause-workbench.js       --> clause-scanner.js, redline-engine.js, faraday-audio.js
  +-- src/ui/vault-modal.js            --> local-sync.js, faraday-audio.js
  +-- src/ui/receipt-modal.js          --> receipt-codec.js, seal-renderer.js, faraday-audio.js
  `-- src/ui/app-shell.js              --> cookie-vault.js, faraday-airgap.js, sw-register.js,
                                           webllm-bridge.js, specimens.js, all src/ui/* panels
```

Cross-cutting coordination across decoupled modules uses the `window` `CustomEvent` bus (`clausehound:*`) and `subscribeVault(fn)`.

---

## 5. Dual-Theme Rendering Pipeline

ClauseHound renders two museum-grade desk aesthetics driven by `document.documentElement.dataset.theme`:

1. **Archival Cotton Vellum (`"vellum"`, default)**:
   - Warm cotton folio ground, pressed rag-paper panel elevation, iron-gall charcoal typography, brushed antique brass borders, crimson redline highlights, and oxidized sage neutralized markers.
2. **Midnight Faraday Brass (`"midnight"`)**:
   - Obsidian shielding chamber ground (`#0F1115`), dark slate drafting surfaces, warm brushed brass hairlines, amber telemetry readouts, and high-contrast ivory text matching `<meta name="theme-color" content="#0F1115">`.

**Zero-FOUC Synchronous Paint Pipeline**:
- Before `desk-theme.css` completes first paint, the synchronous `<head>` bootstrap script in `index.html` resolves `window.__CLAUSEHOUND_BAKED_VAULT__`, `localStorage`, and `krunked-cookie-vault-v1`, heals `localStorage` from the cookie if needed, and assigns `document.documentElement.dataset.theme` synchronously.
- `src/canvas/seal-renderer.js` reads resolved CSS custom properties via `getComputedStyle(document.documentElement)` so rendered brass/wax certificates always harmonize with the active theme.

---

## 6. 0 KB Procedural WebAudio Signal Chain

`src/audio/faraday-audio.js` synthesizes all desk acoustics mathematically at runtime with **0 KB of audio files**:

```text
[White/Pink Noise Buffer] ---> [BiquadFilterNode] ---> [ADSR GainNode] --+
  (paperRustle, penScratch, sealThud)                                    |
                                                                         +--> [sfxBus] ----+
[OscillatorNode Pair] -------> [Envelope GainNode] ----------------------+                 |
  (brassClick, airgapLatch)                                                                +--> [masterGain] --> [DynamicsCompressorNode] --> [Destination]
                                                                                           |   (asmrMixLevel)
[Low-Level Clockwork / Faraday Room Tone Oscillator + Filtered Noise] ------> [ambientBus]-+
```

- `AudioContext` instantiates lazily only after a verified user gesture.
- `masterGain` tracks `VaultState.asmrMixLevel` (default `0.32`, clamped `[0.0, 1.0]`).
- `DynamicsCompressorNode` prevents clipping during rapid multi-clause redlines or seal stamps.

---

## 7. Subpath-Safe Static GitHub Pages Architecture

Primary deployment target: `https://krunked-fpv.github.io/clausehound-ai/`

Deploying under a repository subpath (`/clausehound-ai/`) breaks root-anchored `/...` paths. ClauseHound guarantees subpath portability across `/clausehound-ai/`, root `/`, and local static servers via:

1. **Strictly Relative `./` References**: Every `<link>`, `<script>`, `manifest.json` field (`"start_url": "./"`, `"scope": "./"`, icon `src`), ES module relative import (`../` / `./`), and Service Worker precache entry uses relative paths with zero leading slashes.
2. **Root-Level `./sw.js` Registration**: Placing `sw.js` at repository root and registering `./sw.js` with `{ scope: "./" }` binds the Service Worker scope cleanly to `/clausehound-ai/` without requiring custom `Service-Worker-Allowed` HTTP headers.
3. **Scope-Resolved Cache Keys**: Inside `sw.js`, precache asset paths resolve via `new URL(relPath, self.registration.scope).href`, and cache versioning binds strictly to `PWA_CACHE_VERSION = "clausehound-faraday-v1"`.
4. **Origin-Safe Cookie Persistence**: `COOKIE_VAULT_NAME = "krunked-cookie-vault-v1"` uses `path=/; SameSite=Lax; max-age=31536000`, remaining readable under both `/` and `/clausehound-ai/` on the hosting domain.
