/**
 * ClauseHound Local — Vault Local Sync Modal & Non-Blocking Toast Manager
 * Handles JSON export/import, XSS-safe single-file HTML-Bake snapshot download,
 * Faraday Interception Ledger inspection, self-heal telemetry badge, and toast alerts.
 */

import {
  exportPortableJson,
  importPortableJson,
  buildHtmlBakeSnapshot,
  triggerFileDownload
} from "../vault/local-sync.js";
import {
  getInterceptionLog,
  clearInterceptionLog,
  getAirGapTelemetry
} from "../security/faraday-airgap.js";
import { playBrassClick, playPaperRustle } from "../audio/faraday-audio.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Mounts the Vault Local Sync Modal and non-blocking Toast Manager.
 * @param {HTMLElement} portalContainer
 * @param {HTMLElement} toastContainer
 * @param {object} context
 * @returns {{ open: (state?: object) => void, close: () => void, showToast: (message: string, kind?: string, options?: object) => void, update: (state: object) => void, destroy: () => void }}
 */
export function mountVaultModal(portalContainer, toastContainer, context = {}) {
  let isOpen = false;
  let currentVault = context.getVaultState?.() || {};
  let inlineError = "";
  let lastHealInfo = null;
  const activeToastTimers = new Set();

  const layer = portalContainer?.ownerDocument?.createElement("div");
  if (layer && portalContainer) {
    layer.className = "ch-vault-modal-layer";
    portalContainer.appendChild(layer);
  }

  function showToast(message, kind = "brass", options = {}) {
    if (!toastContainer) return;
    const doc = toastContainer.ownerDocument;
    const toast = doc.createElement("div");
    toast.className = `ch-toast ${kind === "emerald" ? "is-emerald" : kind === "crimson" ? "is-crimson" : ""}`;
    toast.setAttribute("role", "status");

    const textSpan = doc.createElement("span");
    textSpan.textContent = String(message || "");
    toast.appendChild(textSpan);

    const dismiss = () => {
      toast.remove();
    };

    if (options.actionLabel && typeof options.onAction === "function") {
      const actionBtn = doc.createElement("button");
      actionBtn.type = "button";
      actionBtn.className = "ch-btn ch-btn-sm ch-btn-primary";
      actionBtn.textContent = options.actionLabel;
      actionBtn.addEventListener("click", async () => {
        await options.onAction();
        dismiss();
      });
      toast.appendChild(actionBtn);
    }

    const closeBtn = doc.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ch-btn ch-btn-sm";
    closeBtn.setAttribute("aria-label", "Dismiss notification");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", dismiss);
    toast.appendChild(closeBtn);

    toastContainer.appendChild(toast);
    const timeoutMs = Number(options.durationMs ?? 5200);
    if (timeoutMs > 0) {
      const timerId = globalThis.setTimeout(() => {
        activeToastTimers.delete(timerId);
        dismiss();
      }, timeoutMs);
      activeToastTimers.add(timerId);
    }
  }

  const handleKeyDown = (event) => {
    if (isOpen && event.key === "Escape") {
      close();
    }
  };

  const handleClick = async (event) => {
    if (!layer) return;
    if (event.target === layer.querySelector(".ch-modal-backdrop")) {
      close();
      return;
    }

    const btn = event.target?.closest?.("[data-vault-action]");
    if (!btn) return;
    const action = btn.dataset.vaultAction;

    if (action === "close") {
      playBrassClick(0);
      close();
      return;
    }

    if (action === "export-json") {
      playPaperRustle();
      const state = context.getVaultState?.() || currentVault;
      const jsonText = exportPortableJson(state);
      const ok = triggerFileDownload("clausehound-vault.json", jsonText, "application/json");
      if (ok) {
        showToast("Exported checksum-verified JSON vault.", "emerald");
      } else {
        inlineError = "File download API unavailable in this environment.";
        render();
      }
      return;
    }

    if (action === "bake-html") {
      playPaperRustle();
      try {
        const state = context.getVaultState?.() || currentVault;
        const htmlText = await buildHtmlBakeSnapshot(state);
        const ok = triggerFileDownload("clausehound-baked-desk.html", htmlText, "text/html");
        if (ok) {
          showToast("Downloaded self-contained offline HTML-Baked Desk snapshot.", "emerald");
        }
      } catch (err) {
        inlineError = err?.message || "Failed to generate HTML-Bake snapshot.";
        render();
      }
      return;
    }

    if (action === "clear-ledger") {
      playBrassClick(1);
      clearInterceptionLog();
      showToast("Cleared Faraday interception ledger.", "brass");
      render();
    }
  };

  const handleChange = async (event) => {
    const fileInput = event.target?.closest?.('[data-vault-field="import-json"]');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];

    try {
      const rawText = await file.text();
      const parsed = importPortableJson(rawText);
      const restored = await context.onRestoreVault?.(parsed);
      currentVault = restored || parsed;
      inlineError = "";
      playBrassClick(2);
      showToast("Vault imported and verified via FNV-1a32 checksum.", "emerald");
      render();
    } catch (err) {
      inlineError = err?.message || "Invalid or checksum-corrupted vault JSON.";
      showToast(inlineError, "crimson");
      render();
    }
  };

  portalContainer?.ownerDocument?.addEventListener("keydown", handleKeyDown);
  layer?.addEventListener("click", handleClick);
  layer?.addEventListener("change", handleChange);

  function render() {
    if (!layer) return;
    if (!isOpen) {
      layer.innerHTML = "";
      return;
    }

    const vault = context.getVaultState?.() || currentVault || {};
    const telemetry = getAirGapTelemetry();
    const log = getInterceptionLog();
    const selfHeals = Number(vault.selfHealRecoveries ?? 0) || 0;

    layer.innerHTML = `
      <div class="ch-modal-backdrop" role="presentation">
        <section class="ch-modal-panel" role="dialog" aria-modal="true" aria-label="Local Vault Sync & Faraday Ledger">
          <div class="ch-modal-header">
            <h2 class="ch-modal-title">Local Vault Sync &amp; Faraday Security Ledger</h2>
            <button type="button" class="ch-btn ch-btn-sm" data-vault-action="close">Close</button>
          </div>

          <div class="ch-modal-body">
            <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;justify-content:space-between;">
              <div>
                <strong>Tri-Store Integrity</strong>
                <div class="ch-pane-meta">Checksum: ${escapeHtml(vault.checksum || "pending")} • Streak: ${escapeHtml(vault.dailyStreakDate || "today")}</div>
              </div>
              <span class="ch-badge ${selfHeals > 0 ? "ch-badge-emerald" : ""}">
                Self-Heal Recoveries: ${selfHeals}${lastHealInfo ? ` (Last: ${escapeHtml(lastHealInfo.source)})` : ""}
              </span>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.6rem;">
              <button type="button" class="ch-btn ch-btn-primary" data-vault-action="export-json">
                Export Portable JSON
              </button>

              <label class="ch-btn ch-btn-brass-outline" style="justify-content:center;">
                <span>Import Portable JSON</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  data-vault-field="import-json"
                  style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;"
                >
              </label>

              <button type="button" class="ch-btn ch-btn-emerald" data-vault-action="bake-html">
                Download Offline HTML-Bake
              </button>
            </div>

            ${
              inlineError
                ? `<div class="ch-finding-excerpt" style="border-color:var(--ch-crimson);color:var(--ch-crimson);">${escapeHtml(inlineError)}</div>`
                : ""
            }

            <div>
              <div class="ch-section-bar">
                <span>Faraday Interception Ledger (${log.length} entries • ${telemetry.outboundBytes || 0} B leaked)</span>
                <button type="button" class="ch-btn ch-btn-sm" data-vault-action="clear-ledger">Clear Ledger</button>
              </div>
              <div class="ch-ledger-list" style="margin-top:0.5rem;">
                ${
                  log.length === 0
                    ? `<div class="ch-ledger-item">Zero outbound leaks recorded. Faraday cage locked: ${telemetry.locked ? "YES" : "NO"}.</div>`
                    : log
                        .slice()
                        .reverse()
                        .map(
                          (entry) => `
                            <div class="ch-ledger-item">
                              <strong>[${escapeHtml(entry.api)}] ${escapeHtml(entry.method || "BLOCKED")}</strong>
                              <span>${escapeHtml(entry.url || "")}</span>
                              <div class="ch-pane-meta">${escapeHtml(entry.timestamp || "")} • ${escapeHtml(entry.reason || "Blocked by Faraday Air-Gap")}</div>
                            </div>
                          `
                        )
                        .join("")
                }
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function open(stateOverride) {
    if (stateOverride) currentVault = stateOverride;
    inlineError = "";
    isOpen = true;
    playPaperRustle();
    render();
  }

  function close() {
    isOpen = false;
    render();
  }

  return {
    open,
    close,
    showToast,
    setHealInfo(info) {
      lastHealInfo = info || null;
      if (isOpen) render();
    },
    update(nextState) {
      if (nextState) currentVault = nextState;
      if (isOpen) render();
    },
    destroy() {
      for (const id of activeToastTimers) {
        globalThis.clearTimeout?.(id);
      }
      activeToastTimers.clear();
      portalContainer?.ownerDocument?.removeEventListener("keydown", handleKeyDown);
      layer?.removeEventListener("click", handleClick);
      layer?.removeEventListener("change", handleChange);
      layer?.remove();
    }
  };
}
