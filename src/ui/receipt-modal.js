/**
 * ClauseHound Local — Zero-PII Verification Receipt & Redline Packet Overlay
 * Handles #receipt= boot/share inspection, animated wax-seal stamp canvas,
 * 1200x630 PNG Verification Certificate preview & export, counterparty negotiation
 * email composer, and Markdown/Plaintext/Print redline packet exports.
 */

import {
  encodeReceiptHash,
  composeNegotiationEmail,
  exportMarkdownPacket,
  exportPlaintextPacket
} from "../share/receipt-codec.js";
import {
  renderFaradaySeal,
  buildVerificationCertificateCanvas,
  exportSealPngBlob
} from "../canvas/seal-renderer.js";
import { triggerFileDownload } from "../vault/local-sync.js";
import { playSealThud, playBrassClick, playPaperRustle } from "../audio/faraday-audio.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadBlob(blob, filename) {
  if (
    typeof globalThis.document === "undefined" ||
    typeof globalThis.URL?.createObjectURL !== "function"
  ) {
    return false;
  }
  const objectUrl = globalThis.URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  const parent = globalThis.document.body || globalThis.document.documentElement;
  parent?.appendChild?.(anchor);
  anchor.click();
  parent?.removeChild?.(anchor);
  globalThis.setTimeout?.(() => {
    try {
      globalThis.URL.revokeObjectURL(objectUrl);
    } catch {
      // ignore cleanup errors
    }
  }, 1500);
  return true;
}

async function copyText(text) {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  if (typeof globalThis.document !== "undefined") {
    const ta = globalThis.document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "readonly");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    globalThis.document.body?.appendChild?.(ta);
    ta.select();
    const ok = Boolean(globalThis.document.execCommand?.("copy"));
    ta.remove();
    return ok;
  }
  return false;
}

/**
 * Mounts the Receipt & Packet Export Modal.
 * @param {HTMLElement} portalContainer
 * @param {HTMLElement} toastContainer
 * @param {object} context
 * @returns {{ open: (receiptData?: object, openOptions?: object) => void, close: () => void, destroy: () => void }}
 */
export function mountReceiptModal(portalContainer, toastContainer, context = {}) {
  const layer = portalContainer?.ownerDocument?.createElement("div");
  if (layer && portalContainer) {
    layer.className = "ch-receipt-modal-layer";
    portalContainer.appendChild(layer);
  }

  let isOpen = false;
  let currentReceipt = null;
  let openedFromHash = false;
  let certCanvas = null;

  const notify = (msg, kind = "emerald") => {
    if (typeof context.showToast === "function") {
      context.showToast(msg, kind);
    } else if (toastContainer) {
      const div = toastContainer.ownerDocument.createElement("div");
      div.className = `ch-toast is-${kind}`;
      div.textContent = msg;
      toastContainer.appendChild(div);
      globalThis.setTimeout?.(() => div.remove(), 4000);
    }
  };

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

    const btn = event.target?.closest?.("[data-receipt-action]");
    if (!btn) return;
    const action = btn.dataset.receiptAction;

    if (action === "close") {
      playBrassClick(0);
      close();
      return;
    }

    if (action === "open-live-folio") {
      playPaperRustle();
      close();
      context.onOpenLiveFolio?.();
      return;
    }

    if (action === "copy-hash-link") {
      playBrassClick(1);
      const hash = encodeReceiptHash(currentReceipt || {});
      const base =
        typeof globalThis.location !== "undefined"
          ? `${globalThis.location.origin}${globalThis.location.pathname}`
          : "";
      const fullLink = base ? `${base}${hash}` : hash;
      const ok = await copyText(fullLink);
      notify(ok ? "Copied zero-PII #receipt= link to clipboard." : "Unable to copy share link.", ok ? "emerald" : "crimson");
      return;
    }

    if (action === "copy-email") {
      playBrassClick(2);
      const emailBox = layer.querySelector('[data-receipt-field="email-body"]');
      const ok = await copyText(emailBox?.value || "");
      notify(ok ? "Copied negotiation email draft." : "Copy failed.", ok ? "emerald" : "crimson");
      return;
    }

    if (action === "download-png") {
      playSealThud();
      if (!certCanvas) {
        certCanvas = buildVerificationCertificateCanvas(currentReceipt || {}, {
          theme: context.getTheme?.() || "vellum",
          docTitle: context.getPacketParams?.()?.docTitle
        });
      }
      try {
        const blob = await exportSealPngBlob(certCanvas);
        downloadBlob(blob, "clausehound-verification-card.png");
        notify("Downloaded 1200x630 Faraday Verification Card PNG.", "emerald");
      } catch (err) {
        notify(err?.message || "PNG export failed.", "crimson");
      }
      return;
    }

    if (action === "export-md") {
      playPaperRustle();
      const params = context.getPacketParams?.();
      if (!params) return;
      const md = exportMarkdownPacket(params);
      triggerFileDownload("clausehound-redline-packet.md", md, "text/markdown");
      notify("Exported Markdown Redline Packet.", "emerald");
      return;
    }

    if (action === "export-txt") {
      playPaperRustle();
      const params = context.getPacketParams?.();
      if (!params) return;
      const txt = exportPlaintextPacket(params);
      triggerFileDownload("clausehound-redline-packet.txt", txt, "text/plain");
      notify("Exported Plaintext Redline Packet.", "emerald");
      return;
    }

    if (action === "print-packet") {
      playBrassClick(3);
      close();
      globalThis.window?.print?.();
    }
  };

  portalContainer?.ownerDocument?.addEventListener("keydown", handleKeyDown);
  layer?.addEventListener("click", handleClick);

  function render() {
    if (!layer) return;
    if (!isOpen || !currentReceipt) {
      layer.innerHTML = "";
      return;
    }

    const theme = context.getTheme?.() || "vellum";
    const packetParams = context.getPacketParams?.();
    const receiptHash = encodeReceiptHash(currentReceipt);
    const safetyBefore = Math.max(0, 100 - (Number(currentReceipt.riskScoreBefore ?? 0) || 0));
    const safetyAfter = Math.max(0, 100 - (Number(currentReceipt.riskScoreAfter ?? 0) || 0));
    const annualSaved = Math.max(0, Math.round(Number(currentReceipt.annualDollarsSaved ?? 0) || 0));

    const emailDraft =
      !openedFromHash && packetParams
        ? composeNegotiationEmail({
            docTitle: packetParams.docTitle,
            docCategory: packetParams.docCategory,
            tone: packetParams.tone,
            findings: packetParams.findings,
            neutralizedRuleIds: packetParams.neutralizedRuleIds,
            excisedFees: packetParams.excisedFees,
            annualSavings: packetParams.annualSavings
          })
        : null;

    layer.innerHTML = `
      <div class="ch-modal-backdrop" role="presentation">
        <section class="ch-modal-panel is-wide" role="dialog" aria-modal="true" aria-label="Faraday Audit Verification Card & Redline Packet">
          <div class="ch-modal-header">
            <h2 class="ch-modal-title">${openedFromHash ? "Verified #receipt= Audit Card (Zero-PII)" : "Faraday Audit Receipt & Redline Packet"}</h2>
            <button type="button" class="ch-btn ch-btn-sm" data-receipt-action="close">Close</button>
          </div>

          <div class="ch-modal-body">
            ${
              openedFromHash
                ? `<div class="ch-counter-draft-box" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.65rem;">
                    <span>Decoded strictly from 37-byte zero-PII URL token. No contract prose or party names transmitted.</span>
                    <button type="button" class="ch-btn ch-btn-primary" data-receipt-action="open-live-folio">
                      Open Live Specimen Folio
                    </button>
                  </div>`
                : ""
            }

            <div class="ch-receipt-hero">
              <canvas class="ch-seal-canvas" data-seal-canvas width="220" height="220"></canvas>

              <div style="display:flex;flex-direction:column;gap:0.55rem;">
                <div class="ch-section-bar">
                  <span>37-Byte Cryptographic Proof</span>
                  <span>${currentReceipt.airGapLocked !== false ? "0.0 KB AIR-GAP" : "LOCAL SESSION"}</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.5rem;">
                  <div class="ch-finding-excerpt"><strong>Safety Jump</strong><br>${safetyBefore} &rarr; ${safetyAfter} / 100</div>
                  <div class="ch-finding-excerpt"><strong>Annual Savings</strong><br>$${annualSaved.toLocaleString("en-US")}/yr</div>
                  <div class="ch-finding-excerpt"><strong>Traps Neutralized</strong><br>${currentReceipt.trapsNeutralized ?? 0} / ${currentReceipt.trapsDetected ?? 0}</div>
                </div>
                <div class="ch-pane-meta" style="word-break:break-all;">${escapeHtml(receiptHash)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:0.45rem;">
                  <button type="button" class="ch-btn ch-btn-primary" data-receipt-action="copy-hash-link">
                    Copy Zero-PII #receipt= Link
                  </button>
                  <button type="button" class="ch-btn ch-btn-brass-outline" data-receipt-action="download-png">
                    Download 1200x630 PNG Card
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div class="ch-section-bar">
                <span>1200x630 Embossed Audit Certificate Preview</span>
                <span>Watermark Verified</span>
              </div>
              <div data-cert-slot style="margin-top:0.55rem;"></div>
            </div>

            ${
              emailDraft
                ? `<div>
                    <div class="ch-section-bar">
                      <span>Counterparty Negotiation Email (${escapeHtml(emailDraft.subject)})</span>
                      <button type="button" class="ch-btn ch-btn-sm ch-btn-emerald" data-receipt-action="copy-email">Copy Email</button>
                    </div>
                    <textarea class="ch-counter-edit-textarea" style="min-height:170px;margin-top:0.5rem;" data-receipt-field="email-body">${escapeHtml(emailDraft.body)}</textarea>
                  </div>`
                : ""
            }

            ${
              !openedFromHash
                ? `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
                    <button type="button" class="ch-btn" data-receipt-action="export-md">Export .md Packet</button>
                    <button type="button" class="ch-btn" data-receipt-action="export-txt">Export .txt Packet</button>
                    <button type="button" class="ch-btn ch-btn-brass-outline" data-receipt-action="print-packet">Print Redline Packet</button>
                  </div>`
                : ""
            }
          </div>
        </section>
      </div>
    `;

    const sealCanvas = layer.querySelector("[data-seal-canvas]");
    if (sealCanvas) {
      renderFaradaySeal(sealCanvas, currentReceipt, { theme, animate: true });
    }

    const certSlot = layer.querySelector("[data-cert-slot]");
    if (certSlot) {
      try {
        certCanvas = buildVerificationCertificateCanvas(currentReceipt, {
          theme,
          docTitle: packetParams?.docTitle,
          receiptHash
        });
        certCanvas.className = "ch-cert-preview";
        certSlot.appendChild(certCanvas);
      } catch {
        certSlot.textContent = "Certificate preview unavailable.";
      }
    }
  }

  function open(receiptData, openOptions = {}) {
    currentReceipt = receiptData || {};
    openedFromHash = Boolean(openOptions.fromHash);
    isOpen = true;
    playSealThud();
    render();
  }

  function close() {
    isOpen = false;
    render();
  }

  return {
    open,
    close,
    destroy() {
      portalContainer?.ownerDocument?.removeEventListener("keydown", handleKeyDown);
      layer?.removeEventListener("click", handleClick);
      layer?.remove();
    }
  };
}
