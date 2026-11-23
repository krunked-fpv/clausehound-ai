/**
 * ClauseHound Local — Curated Specimens Drawer & Local File / Paste Intake
 * Provides one-click access to the 5 realistic specimen agreements, local zero-upload
 * file ingestion (.txt, .md, .docx, .pdf), and direct agreement paste analysis.
 */

import { listSpecimens } from "../engine/specimens.js";
import { ingestDocumentFile } from "../engine/clause-scanner.js";
import { playPaperRustle, playBrassClick } from "../audio/faraday-audio.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function readLocalDocumentSafely(file) {
  try {
    const firstTry = await ingestDocumentFile(file, file.name);
    if (firstTry && typeof firstTry === "object") {
      return firstTry;
    }
  } catch {
    // fallback below
  }

  const lower = String(file.name || "").toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    const text = await file.text();
    return ingestDocumentFile(text, file.name);
  }
  const buffer = await file.arrayBuffer();
  return ingestDocumentFile(buffer, file.name);
}

/**
 * Mounts the Specimen & Intake Drawer inside the portal container.
 * @param {HTMLElement} container
 * @param {object} context
 * @returns {{ updateActive: (specimenId: string) => void, open: () => void, close: () => void, destroy: () => void }}
 */
export function mountSpecimenDrawer(container, context = {}) {
  if (!container) {
    return { updateActive() {}, open() {}, close() {}, destroy() {} };
  }

  const layer = container.ownerDocument.createElement("div");
  layer.className = "ch-specimen-drawer-layer";
  container.appendChild(layer);

  let isOpen = false;
  let activeSpecimenId = context.activeSpecimenId || "sterling-lease";
  let statusNotice = "";
  let statusKind = "";

  const handleKeyDown = (event) => {
    if (isOpen && event.key === "Escape") {
      close();
    }
  };

  const handleClick = (event) => {
    if (event.target === layer.querySelector(".ch-drawer-backdrop")) {
      close();
      return;
    }

    const actionEl = event.target?.closest?.("[data-drawer-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.drawerAction;

    if (action === "close") {
      playBrassClick(0);
      close();
      return;
    }

    if (action === "select-specimen") {
      const specimenId = actionEl.dataset.specimenId;
      if (specimenId) {
        activeSpecimenId = specimenId;
        playPaperRustle();
        context.onSelectSpecimen?.(specimenId);
        close();
      }
      return;
    }

    if (action === "analyze-paste") {
      const titleInput = layer.querySelector('[data-drawer-field="paste-title"]');
      const textInput = layer.querySelector('[data-drawer-field="paste-text"]');
      const title = titleInput?.value?.trim() || "Pasted Custom Agreement";
      const text = textInput?.value || "";
      if (text.trim().length < 12) {
        statusNotice = "Paste at least a short clause or agreement paragraph to inspect.";
        statusKind = "error";
        render();
        return;
      }
      playPaperRustle();
      context.onLoadCustomDocument?.({
        id: `custom-${Date.now().toString(36)}`,
        title,
        docCategory: "custom-agreement",
        text,
        source: "manual"
      });
      close();
    }
  };

  const handleChange = async (event) => {
    const fileInput = event.target?.closest?.('[data-drawer-field="file-input"]');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];

    try {
      const result = await readLocalDocumentSafely(file);
      if (!result || result.ok === false) {
        statusNotice =
          result?.notice ||
          `Unable to extract selectable text from "${file.name}" (${result?.reason || "unsupported format"}).`;
        statusKind = "error";
        context.onNotify?.(statusNotice, "crimson");
        render();
        return;
      }

      playPaperRustle();
      context.onLoadCustomDocument?.({
        id: `file-${Date.now().toString(36)}`,
        title: result.title || file.name,
        docCategory: "custom-agreement",
        text: result.text || "",
        source: "manual"
      });
      close();
    } catch (err) {
      statusNotice = err?.message || `Failed to ingest local file "${file.name}".`;
      statusKind = "error";
      render();
    }
  };

  container.ownerDocument.addEventListener("keydown", handleKeyDown);
  layer.addEventListener("click", handleClick);
  layer.addEventListener("change", handleChange);

  function render() {
    if (!isOpen) {
      layer.innerHTML = "";
      return;
    }

    const specimens = listSpecimens();

    layer.innerHTML = `
      <div class="ch-drawer-backdrop" role="presentation">
        <aside class="ch-drawer-panel" role="dialog" aria-modal="true" aria-label="Specimen Library & Local File Intake">
          <div class="ch-modal-header">
            <h2 class="ch-modal-title">Specimens &amp; Local Intake</h2>
            <button type="button" class="ch-btn ch-btn-sm" data-drawer-action="close">Close</button>
          </div>

          <div class="ch-modal-body">
            <div>
              <div class="ch-section-bar">
                <span>5 Curated Specimen Folios</span>
                <span>Offline Ready</span>
              </div>
              <div class="ch-specimen-list" style="margin-top: 0.55rem;">
                ${specimens
                  .map((spec) => {
                    const isActive = spec.id === activeSpecimenId;
                    return `
                      <button
                        type="button"
                        class="ch-specimen-card ${isActive ? "is-active" : ""}"
                        data-drawer-action="select-specimen"
                        data-specimen-id="${escapeHtml(spec.id)}"
                      >
                        <strong>${escapeHtml(spec.title || spec.id)}</strong>
                        <span class="ch-pane-meta">${escapeHtml(spec.docCategory || "custom-agreement")} • ${(spec.text || "").length.toLocaleString("en-US")} chars</span>
                        ${
                          spec.summary || spec.description
                            ? `<span style="font-size:0.83rem;color:var(--ch-ink-muted);">${escapeHtml(spec.summary || spec.description)}</span>`
                            : ""
                        }
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </div>

            <div>
              <div class="ch-section-bar">
                <span>Zero-Upload Local File Picker</span>
                <span>.txt • .md • .docx • .pdf</span>
              </div>
              <label class="ch-btn ch-btn-brass-outline" style="margin-top:0.55rem;width:100%;justify-content:center;">
                <span>Choose Local Contract File</span>
                <input
                  type="file"
                  accept=".txt,.md,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  data-drawer-field="file-input"
                  style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;"
                >
              </label>
            </div>

            ${
              statusNotice
                ? `<div class="ch-finding-excerpt" style="border-color:var(--ch-crimson);color:var(--ch-crimson);">${escapeHtml(statusNotice)}</div>`
                : ""
            }

            <div>
              <div class="ch-section-bar">
                <span>Paste Agreement Text</span>
                <span>100% On-Device</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.55rem;">
                <input
                  type="text"
                  class="ch-counter-edit-textarea"
                  style="min-height:44px;"
                  placeholder="Agreement Title (e.g., Vendor MSA)"
                  value="Pasted Custom Agreement"
                  data-drawer-field="paste-title"
                >
                <textarea
                  class="ch-counter-edit-textarea"
                  style="min-height:140px;"
                  placeholder="Paste contract clauses here for immediate local scan..."
                  data-drawer-field="paste-text"
                ></textarea>
                <button type="button" class="ch-btn ch-btn-primary" data-drawer-action="analyze-paste">
                  Analyze Pasted Agreement
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    `;
  }

  function open() {
    isOpen = true;
    statusNotice = "";
    statusKind = "";
    playPaperRustle();
    render();
  }

  function close() {
    isOpen = false;
    render();
  }

  return {
    updateActive(specimenId) {
      if (typeof specimenId === "string" && specimenId.length > 0) {
        activeSpecimenId = specimenId;
        if (isOpen) render();
      }
    },
    open,
    close,
    destroy() {
      container.ownerDocument.removeEventListener("keydown", handleKeyDown);
      layer.removeEventListener("click", handleClick);
      layer.removeEventListener("change", handleChange);
      layer.remove();
    }
  };
}
