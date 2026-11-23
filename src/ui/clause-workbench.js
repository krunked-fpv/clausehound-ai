/**
 * ClauseHound Local — Synchronized Split-Screen Clause Workbench
 * Left Pane: Cotton Vellum Document Folio with 60fps warm-amber optical scan sweep,
 * interactive trap spans, crimson capillary bezier strikethroughs, paper-curl FX,
 * drag-and-drop local ingestion, and inline paste/edit mode.
 * Center Gutter: Spatial Risk Heatmap minimap with clickable viewport lens.
 * Right Pane: Bilateral Counter-Draft Surgery Deck, Junk-Fee Scalpel, inline draft editor,
 * tone swapping, and opt-in Local WebGPU Counsel diagnostic drawer.
 */

import {
  CATEGORY_METADATA,
  TONE_OPTIONS
} from "../engine/clause-rules.js";
import {
  scanDocument,
  computeRiskScore,
  ingestDocumentFile
} from "../engine/clause-scanner.js";
import {
  generateRedline,
  applyRedlines,
  exciseJunkFees,
  buildRedlineDiff
} from "../engine/redline-engine.js";
import {
  detectWebGpuCapability,
  selectOptimalLocalModel,
  createWebLlmBridge
} from "../engine/webllm-bridge.js";
import {
  isAirGapLocked,
  FaradayAirGapError
} from "../security/faraday-airgap.js";
import {
  playPaperRustle,
  playPenScratch,
  playBrassClick,
  playScanTick
} from "../audio/faraday-audio.js";
import {
  renderOpticalSweep,
  renderPaperCurlBurst
} from "../canvas/seal-renderer.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function feeStorageKey(docId, feeKey) {
  return `${docId}::${feeKey}`;
}

function isFeeExcised(excisedFeeMap, docId, feeKey) {
  if (!excisedFeeMap) return false;
  return Boolean(excisedFeeMap[feeStorageKey(docId, feeKey)] || excisedFeeMap[feeKey]);
}

function matchesFilter(finding, filterId) {
  if (!filterId || filterId === "all") return true;
  if (filterId === "critical") return finding.severity === "critical";
  if (filterId === "IP_INDEMNITY") {
    return finding.categoryId === "IP_GRAB" || finding.categoryId === "INDEMNITY";
  }
  return finding.categoryId === filterId;
}

function spansOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

async function ingestDroppedFile(file) {
  try {
    const res = await ingestDocumentFile(file, file.name);
    if (res && typeof res === "object") return res;
  } catch {
    // fallback below
  }
  const lower = String(file.name || "").toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return ingestDocumentFile(await file.text(), file.name);
  }
  return ingestDocumentFile(await file.arrayBuffer(), file.name);
}

/**
 * Mounts the Synchronized Split-Screen Clause Workbench inside `#studio-workspace-slot`.
 * @param {HTMLElement} container
 * @param {object} context
 * @returns {object}
 */
export function mountClauseWorkbench(container, context = {}) {
  if (!container) {
    return { loadDocument() {}, updateVault() {}, destroy() {} };
  }

  let vaultState = context.initialVault || {
    theme: "vellum",
    defaultTone: "bilateral",
    neutralizedRuleMap: {},
    excisedFeeMap: {},
    sealStampedMap: {}
  };

  let activeDoc = {
    id: "sterling-lease",
    title: "The Sterling Lofts Residential Lease",
    docCategory: "residential-lease",
    text: ""
  };

  let scanResult = {
    documentId: "sterling-lease",
    docCategory: "residential-lease",
    findings: [],
    fees: [],
    riskScore: 0,
    categoryBreakdown: {},
    scannedChars: 0
  };

  let activeFilter = "all";
  let activeTone = vaultState.defaultTone || "bilateral";
  let activeRuleId = null;
  let mobilePane = "folio"; // "folio" | "surgery" | "heatmap"
  let editFolioMode = false;
  let editingDraftRuleId = null;
  const customDraftMap = new Map(); // `${docId}::${ruleId}` -> text
  let webGpuOpen = false;
  let webGpuStatus = {
    probing: false,
    result: null,
    explanation: "",
    error: ""
  };

  let scanTickTimers = [];
  const webLlmBridge = createWebLlmBridge();

  const clearScanTicks = () => {
    for (const id of scanTickTimers) {
      globalThis.clearTimeout?.(id);
    }
    scanTickTimers = [];
  };

  const dispatchBusEvent = (name, detail) => {
    try {
      if (typeof globalThis.window?.dispatchEvent === "function" && typeof CustomEvent === "function") {
        globalThis.window.dispatchEvent(new CustomEvent(name, { detail }));
      }
    } catch {
      // ignore in restricted environments
    }
  };

  const getNeutralizedSet = () => {
    const arr = vaultState.neutralizedRuleMap?.[activeDoc.id] || [];
    return new Set(Array.isArray(arr) ? arr : []);
  };

  const getExcisedFeeKeys = () => {
    const keys = [];
    for (const fee of scanResult.fees || []) {
      if (isFeeExcised(vaultState.excisedFeeMap, activeDoc.id, fee.feeKey)) {
        keys.push(fee.feeKey);
      }
    }
    return keys;
  };

  const computeAuditSnapshot = () => {
    const neutralizedSet = getNeutralizedSet();
    const excisedKeys = getExcisedFeeKeys();
    const fees = scanResult.fees || [];
    const findings = scanResult.findings || [];

    const redlineOutcome = applyRedlines(activeDoc.text, findings, neutralizedSet, activeTone);
    const feeOutcome = exciseJunkFees(activeDoc.text, excisedKeys, fees);

    const excisedSpans = fees.filter((f) => excisedKeys.includes(f.feeKey));
    let nonOverlappingRuleSavings = 0;
    for (const finding of findings) {
      if (!neutralizedSet.has(finding.ruleId)) continue;
      const overlapsExcised = excisedSpans.some((fee) =>
        spansOverlap(finding.startOffset, finding.endOffset, fee.startOffset, fee.endOffset)
      );
      if (!overlapsExcised) {
        nonOverlappingRuleSavings += Number(finding.annualFeeEstimate || 0) || 0;
      }
    }

    const annualSavings = Math.round((Number(feeOutcome.annualDollarsSaved || 0) + nonOverlappingRuleSavings) * 100) / 100;
    const riskScoreBefore = Number(scanResult.riskScore ?? computeRiskScore(findings)) || 0;
    const riskScoreAfter = Number(redlineOutcome.riskScoreAfter ?? riskScoreBefore) || 0;

    const counts = {
      all: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      JUNK_FEES: findings.filter((f) => f.categoryId === "JUNK_FEES").length,
      IP_INDEMNITY: findings.filter((f) => f.categoryId === "IP_GRAB" || f.categoryId === "INDEMNITY").length,
      AUTO_RENEWAL: findings.filter((f) => f.categoryId === "AUTO_RENEWAL").length
    };

    const neutralizedIds = Array.from(neutralizedSet);

    return {
      documentId: activeDoc.id,
      docTitle: activeDoc.title,
      docCategory: scanResult.docCategory || activeDoc.docCategory,
      text: activeDoc.text,
      redlinedText: redlineOutcome.redlinedText,
      findings,
      fees,
      excisedFeeKeys: excisedKeys,
      excisedFees: excisedSpans,
      neutralizedRuleIds: neutralizedIds,
      tone: activeTone,
      activeFilter,
      riskScoreBefore,
      riskScoreAfter,
      safetyBefore: Math.max(0, 100 - riskScoreBefore),
      safetyAfter: Math.max(0, 100 - riskScoreAfter),
      annualSavings,
      annualDollarsSaved: annualSavings,
      trapsDetected: findings.length,
      trapsNeutralized: neutralizedIds.length,
      counts,
      sealed: Boolean(vaultState.sealStampedMap?.[activeDoc.id]),
      categoryBreakdown: scanResult.categoryBreakdown || {}
    };
  };

  const notifyAuditChange = () => {
    context.onAuditUpdated?.(computeAuditSnapshot());
  };

  const triggerOpticalSweepFx = () => {
    clearScanTicks();
    const sweepCanvas = container.querySelector("[data-fx-sweep]");
    if (sweepCanvas) {
      renderOpticalSweep(sweepCanvas, vaultState.theme || "vellum");
    }
    [80, 220, 360, 500].forEach((ms, idx) => {
      const id = globalThis.setTimeout(() => {
        playScanTick(0.2 + idx * 0.22);
      }, ms);
      scanTickTimers.push(id);
    });
  };

  const triggerPaperCurlFx = () => {
    const burstCanvas = container.querySelector("[data-fx-burst]");
    if (burstCanvas) {
      renderPaperCurlBurst(burstCanvas, vaultState.theme || "vellum");
    }
  };

  const runScan = (doc, source = "manual", playSweep = true) => {
    activeDoc = {
      id: doc.id || `doc-${Date.now().toString(36)}`,
      title: doc.title || "Untitled Agreement",
      docCategory: doc.docCategory || "custom-agreement",
      text: String(doc.text || "")
    };
    scanResult = scanDocument(activeDoc.text, {
      documentId: activeDoc.id,
      docCategory: activeDoc.docCategory
    });

    if (!activeRuleId || !scanResult.findings.some((f) => f.ruleId === activeRuleId)) {
      activeRuleId = scanResult.findings[0]?.ruleId || null;
    }

    dispatchBusEvent("clausehound:scan", {
      documentId: activeDoc.id,
      docCategory: scanResult.docCategory,
      text: activeDoc.text,
      findings: scanResult.findings,
      summary: {
        riskScore: scanResult.riskScore,
        findingCount: scanResult.findings.length,
        feeCount: scanResult.fees.length
      },
      source
    });

    render();
    notifyAuditChange();
    if (playSweep) {
      triggerOpticalSweepFx();
    }
  };

  const toggleRuleNeutralized = async (ruleId) => {
    const finding = scanResult.findings.find((f) => f.ruleId === ruleId);
    if (!finding) return;
    const currentSet = getNeutralizedSet();
    const willNeutralize = !currentSet.has(ruleId);
    if (willNeutralize) currentSet.add(ruleId);
    else currentSet.delete(ruleId);

    const nextIds = Array.from(currentSet);
    playPenScratch(220, 1.0);
    triggerPaperCurlFx();

    await context.onUpdateNeutralized?.(activeDoc.id, nextIds, {
      deltaTraps: willNeutralize ? 1 : 0,
      deltaSavings: willNeutralize ? Number(finding.annualFeeEstimate || 0) : 0
    });

    dispatchBusEvent("clausehound:redline", {
      documentId: activeDoc.id,
      ruleId,
      categoryId: finding.categoryId,
      tone: activeTone,
      neutralized: willNeutralize,
      annualSavingsDelta: willNeutralize ? Number(finding.annualFeeEstimate || 0) : -Number(finding.annualFeeEstimate || 0)
    });
  };

  const toggleFeeExcised = async (feeKey) => {
    const fee = (scanResult.fees || []).find((f) => f.feeKey === feeKey);
    if (!fee) return;
    const currentlyExcised = isFeeExcised(vaultState.excisedFeeMap, activeDoc.id, feeKey);
    const nextExcised = !currentlyExcised;

    playPenScratch(180, 1.1);
    triggerPaperCurlFx();

    await context.onUpdateExcisedFee?.(
      feeStorageKey(activeDoc.id, feeKey),
      nextExcised,
      nextExcised ? Number(fee.annualizedDollars || 0) : 0
    );

    dispatchBusEvent("clausehound:excise-fee", {
      documentId: activeDoc.id,
      feeKey,
      annualDollarsSaved: Number(fee.annualizedDollars || 0),
      excised: nextExcised
    });
  };

  const focusRule = (ruleId, scrollTarget) => {
    activeRuleId = ruleId;
    render();
    const safeId = typeof globalThis.CSS?.escape === "function" ? globalThis.CSS.escape(ruleId) : String(ruleId).replace(/"/g, '\\"');
    if (scrollTarget === "folio") {
      const span = container.querySelector(`[data-folio-rule-id="${safeId}"]`);
      span?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    } else if (scrollTarget === "card") {
      const card = container.querySelector(`[data-card-rule-id="${safeId}"]`);
      card?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }
  };

  const buildHighlightedFolioHtml = () => {
    const text = activeDoc.text || "";
    if (!text) return "<p>No agreement text loaded.</p>";

    const neutralizedSet = getNeutralizedSet();
    const spans = [];

    const sortedFindings = [...(scanResult.findings || [])].sort(
      (a, b) => a.startOffset - b.startOffset
    );
    for (const f of sortedFindings) {
      if (
        typeof f.startOffset === "number" &&
        typeof f.endOffset === "number" &&
        f.endOffset > f.startOffset &&
        f.startOffset >= 0 &&
        f.endOffset <= text.length
      ) {
        const overlapsExisting = spans.some((s) =>
          spansOverlap(s.start, s.end, f.startOffset, f.endOffset)
        );
        if (!overlapsExisting) {
          spans.push({
            kind: "finding",
            start: f.startOffset,
            end: f.endOffset,
            data: f
          });
        }
      }
    }

    for (const fee of scanResult.fees || []) {
      if (
        typeof fee.startOffset === "number" &&
        typeof fee.endOffset === "number" &&
        fee.endOffset > fee.startOffset &&
        fee.startOffset >= 0 &&
        fee.endOffset <= text.length
      ) {
        const overlapsExisting = spans.some((s) =>
          spansOverlap(s.start, s.end, fee.startOffset, fee.endOffset)
        );
        if (!overlapsExisting) {
          spans.push({
            kind: "fee",
            start: fee.startOffset,
            end: fee.endOffset,
            data: fee
          });
        }
      }
    }

    spans.sort((a, b) => a.start - b.start);

    let html = "";
    let cursor = 0;

    for (const span of spans) {
      if (span.start > cursor) {
        html += escapeHtml(text.slice(cursor, span.start));
      }
      const chunk = escapeHtml(text.slice(span.start, span.end));
      if (span.kind === "finding") {
        const f = span.data;
        const isNeut = neutralizedSet.has(f.ruleId);
        const isActive = f.ruleId === activeRuleId;
        html += `<mark class="ch-trap-span ${isNeut ? "is-neutralized" : ""} ${isActive ? "is-active" : ""}" data-folio-rule-id="${escapeHtml(f.ruleId)}" data-severity="${escapeHtml(f.severity)}" tabindex="0" title="${escapeHtml(f.title)}">${chunk}${
          isNeut
            ? `<svg class="ch-capillary-strike" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true"><path d="M 2 6 Q 60 2, 110 5 T 198 4" /></svg>`
            : ""
        }</mark>`;
      } else {
        const fee = span.data;
        const excised = isFeeExcised(vaultState.excisedFeeMap, activeDoc.id, fee.feeKey);
        html += `<mark class="ch-fee-span ${excised ? "is-excised" : ""}" data-folio-fee-key="${escapeHtml(fee.feeKey)}" title="Recurring fee: ${escapeHtml(fee.label || "")}">${chunk}</mark>`;
      }
      cursor = span.end;
    }

    if (cursor < text.length) {
      html += escapeHtml(text.slice(cursor));
    }

    return html;
  };

  const syncHeatmapLens = () => {
    const viewport = container.querySelector("[data-folio-viewport]");
    const lens = container.querySelector("[data-heatmap-lens]");
    if (!viewport || !lens) return;
    const total = Math.max(1, viewport.scrollHeight);
    const ratioTop = Math.min(0.88, Math.max(0, viewport.scrollTop / total));
    const ratioHeight = Math.max(12, Math.min(80, (viewport.clientHeight / total) * 100));
    lens.style.top = `${ratioTop * 100}%`;
    lens.style.height = `${ratioHeight}%`;
  };

  const runWebGpuCounselProbe = async () => {
    webGpuStatus = { probing: true, result: null, explanation: "", error: "" };
    render();
    try {
      const cap = await detectWebGpuCapability();
      const probeRes = await webLlmBridge.probe();
      const catalog = Array.isArray(probeRes?.models) ? probeRes.models : [];
      const selection = catalog.length > 0 ? selectOptimalLocalModel(catalog, cap) : null;
      const targetFinding =
        scanResult.findings.find((f) => f.ruleId === activeRuleId) || scanResult.findings[0];

      let explanationText = "";
      if (targetFinding) {
        try {
          const res = await webLlmBridge.explainClause(targetFinding, activeTone);
          explanationText =
            typeof res === "string"
              ? res
              : res?.explanation || res?.summary || generateRedline(targetFinding, activeTone).rationale;
        } catch (err) {
          if (err instanceof FaradayAirGapError || isAirGapLocked()) {
            explanationText = `Faraday Air-Gap Locked: blocked uncached model fetch cleanly. Deterministic fallback counsel: ${generateRedline(targetFinding, activeTone).rationale}`;
          } else {
            explanationText = generateRedline(targetFinding, activeTone).rationale;
          }
        }
      }

      webGpuStatus = {
        probing: false,
        result: { cap, probeRes, selection },
        explanation: explanationText,
        error: ""
      };
    } catch (err) {
      webGpuStatus = {
        probing: false,
        result: null,
        explanation: "",
        error: err?.message || "WebGPU probe unavailable on this device."
      };
    }
    render();
  };

  const handleClick = async (event) => {
    const mobileTab = event.target?.closest?.("[data-mobile-pane]");
    if (mobileTab) {
      playBrassClick(0);
      mobilePane = mobileTab.dataset.mobilePane;
      render();
      return;
    }

    const folioSpan = event.target?.closest?.("[data-folio-rule-id]");
    if (folioSpan) {
      playBrassClick(1);
      if (typeof globalThis.window !== "undefined" && globalThis.window.innerWidth <= 900) {
        mobilePane = "surgery";
      }
      focusRule(folioSpan.dataset.folioRuleId, "card");
      return;
    }

    const gutter = event.target?.closest?.("[data-heatmap-gutter]");
    if (gutter) {
      const rect = gutter.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
      const viewport = container.querySelector("[data-folio-viewport]");
      if (viewport) {
        viewport.scrollTo({
          top: ratio * Math.max(0, viewport.scrollHeight - viewport.clientHeight),
          behavior: "smooth"
        });
      }
      return;
    }

    const btn = event.target?.closest?.("[data-wb-action]");
    if (!btn) return;
    const action = btn.dataset.wbAction;

    if (action === "toggle-edit-folio") {
      playBrassClick(0);
      editFolioMode = !editFolioMode;
      render();
      return;
    }

    if (action === "apply-folio-edit") {
      const editor = container.querySelector('[data-wb-field="folio-editor"]');
      const nextText = editor?.value ?? activeDoc.text;
      editFolioMode = false;
      playPaperRustle();
      runScan({ ...activeDoc, text: nextText, id: activeDoc.id || "custom-draft" }, "manual", true);
      return;
    }

    if (action === "rescan-folio") {
      playBrassClick(1);
      runScan(activeDoc, "manual", true);
      return;
    }

    if (action === "neutralize-rule") {
      await toggleRuleNeutralized(btn.dataset.ruleId);
      return;
    }

    if (action === "locate-rule") {
      playBrassClick(0);
      if (typeof globalThis.window !== "undefined" && globalThis.window.innerWidth <= 900) {
        mobilePane = "folio";
      }
      focusRule(btn.dataset.ruleId, "folio");
      return;
    }

    if (action === "edit-draft") {
      playBrassClick(1);
      const rid = btn.dataset.ruleId;
      editingDraftRuleId = editingDraftRuleId === rid ? null : rid;
      render();
      return;
    }

    if (action === "save-draft") {
      const rid = btn.dataset.ruleId;
      const ta = container.querySelector(`[data-draft-editor="${rid}"]`);
      if (ta) {
        customDraftMap.set(`${activeDoc.id}::${rid}`, ta.value);
      }
      editingDraftRuleId = null;
      playPenScratch(140, 0.9);
      render();
      notifyAuditChange();
      return;
    }

    if (action === "excise-fee") {
      await toggleFeeExcised(btn.dataset.feeKey);
      return;
    }

    if (action === "toggle-webgpu") {
      playBrassClick(2);
      webGpuOpen = !webGpuOpen;
      render();
      return;
    }

    if (action === "probe-webgpu") {
      playBrassClick(3);
      await runWebGpuCounselProbe();
    }
  };

  const handleScroll = (event) => {
    if (event.target?.matches?.("[data-folio-viewport]")) {
      syncHeatmapLens();
    }
  };

  const handleDragOver = (event) => {
    const dropZone = event.target?.closest?.("[data-folio-viewport]");
    if (!dropZone) return;
    event.preventDefault();
    dropZone.classList.add("is-drop-active");
  };

  const handleDragLeave = (event) => {
    const dropZone = event.target?.closest?.("[data-folio-viewport]");
    if (!dropZone) return;
    dropZone.classList.remove("is-drop-active");
  };

  const handleDrop = async (event) => {
    const dropZone = event.target?.closest?.("[data-folio-viewport]");
    if (!dropZone) return;
    event.preventDefault();
    dropZone.classList.remove("is-drop-active");

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      try {
        const res = await ingestDroppedFile(file);
        if (!res || res.ok === false) {
          context.onNotify?.(res?.notice || `Could not read "${file.name}".`, "crimson");
          return;
        }
        playPaperRustle();
        runScan(
          {
            id: `drop-${Date.now().toString(36)}`,
            title: res.title || file.name,
            docCategory: "custom-agreement",
            text: res.text || ""
          },
          "manual",
          true
        );
      } catch (err) {
        context.onNotify?.(err?.message || "Failed to read dropped document.", "crimson");
      }
      return;
    }

    const droppedText = event.dataTransfer?.getData?.("text/plain");
    if (droppedText && droppedText.trim().length > 10) {
      playPaperRustle();
      runScan(
        {
          id: `drop-${Date.now().toString(36)}`,
          title: "Dropped Agreement Excerpt",
          docCategory: "custom-agreement",
          text: droppedText
        },
        "manual",
        true
      );
    }
  };

  container.addEventListener("click", handleClick);
  container.addEventListener("scroll", handleScroll, true);
  container.addEventListener("dragover", handleDragOver);
  container.addEventListener("dragleave", handleDragLeave);
  container.addEventListener("drop", handleDrop);

  function render() {
    const neutralizedSet = getNeutralizedSet();
    const findings = scanResult.findings || [];
    const fees = scanResult.fees || [];
    const filteredFindings = findings.filter((f) => matchesFilter(f, activeFilter));
    const docLen = Math.max(1, activeDoc.text.length);

    const redlinedPreview = applyRedlines(activeDoc.text, findings, neutralizedSet, activeTone);
    const diffSegments = buildRedlineDiff(activeDoc.text, redlinedPreview.redlinedText);
    const diffChangeCount = Array.isArray(diffSegments)
      ? diffSegments.filter((seg) => seg && seg.type && seg.type !== "equal" && seg.type !== "unchanged").length
      : neutralizedSet.size;

    container.innerHTML = `
      <div class="ch-mobile-pane-tabs" role="tablist" aria-label="Workspace View Switcher">
        <button type="button" role="tab" aria-selected="${mobilePane === "folio" ? "true" : "false"}" class="ch-pill ${mobilePane === "folio" ? "is-active" : ""}" data-mobile-pane="folio">
          Original Folio
        </button>
        <button type="button" role="tab" aria-selected="${mobilePane === "surgery" ? "true" : "false"}" class="ch-pill ${mobilePane === "surgery" ? "is-active" : ""}" data-mobile-pane="surgery">
          Surgery Deck (${filteredFindings.length})
        </button>
        <button type="button" role="tab" aria-selected="${mobilePane === "heatmap" ? "true" : "false"}" class="ch-pill ${mobilePane === "heatmap" ? "is-active" : ""}" data-mobile-pane="heatmap">
          Risk Map
        </button>
      </div>

      <div class="ch-workbench-grid">
        <!-- Left Pane: Cotton Vellum Document Folio -->
        <section class="ch-pane" data-mobile-hidden="${mobilePane !== "folio" ? "true" : "false"}" aria-label="Original Agreement Folio">
          <div class="ch-pane-header">
            <div>
              <h2 class="ch-pane-title">${escapeHtml(activeDoc.title)}</h2>
              <span class="ch-pane-meta">${escapeHtml(scanResult.docCategory)} • ${docLen.toLocaleString("en-US")} chars • Drop file or paste</span>
            </div>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
              <button type="button" class="ch-btn ch-btn-sm" data-wb-action="toggle-edit-folio">
                ${editFolioMode ? "Cancel Edit" : "Paste / Edit Text"}
              </button>
              <button type="button" class="ch-btn ch-btn-sm ch-btn-brass-outline" data-wb-action="rescan-folio">
                Re-Scan
              </button>
            </div>
          </div>

          <div class="ch-folio-viewport" data-folio-viewport>
            <div class="ch-fx-overlay">
              <canvas class="ch-fx-canvas" data-fx-sweep width="600" height="440"></canvas>
              <canvas class="ch-fx-canvas" data-fx-burst width="600" height="440"></canvas>
            </div>

            ${
              editFolioMode
                ? `<div style="display:flex;flex-direction:column;gap:0.6rem;">
                    <textarea class="ch-paste-editor" data-wb-field="folio-editor">${escapeHtml(activeDoc.text)}</textarea>
                    <button type="button" class="ch-btn ch-btn-primary" data-wb-action="apply-folio-edit">
                      Scan Updated Agreement
                    </button>
                  </div>`
                : `<div class="ch-folio-prose">${buildHighlightedFolioHtml()}</div>`
            }
          </div>
        </section>

        <!-- Center Gutter: Spatial Risk Heatmap Minimap -->
        <div
          class="ch-heatmap-gutter"
          data-heatmap-gutter
          data-mobile-hidden="${mobilePane !== "heatmap" ? "true" : "false"}"
          role="navigation"
          aria-label="Document Risk Heatmap Minimap"
          title="Click anywhere to jump to clause region"
        >
          ${findings
            .map((f) => {
              const topPct = Math.max(0, Math.min(97, (f.startOffset / docLen) * 100));
              const hPct = Math.max(1.8, Math.min(12, ((f.endOffset - f.startOffset) / docLen) * 100));
              const isNeut = neutralizedSet.has(f.ruleId);
              return `<div class="ch-heatmap-band ${isNeut ? "is-neutralized" : ""}" data-severity="${escapeHtml(f.severity)}" style="top:${topPct.toFixed(2)}%;height:${hPct.toFixed(2)}%;"></div>`;
            })
            .join("")}
          <div class="ch-heatmap-lens" data-heatmap-lens></div>
        </div>

        <!-- Right Pane: Bilateral Counter-Draft Surgery Deck -->
        <section class="ch-pane" data-mobile-hidden="${mobilePane !== "surgery" ? "true" : "false"}" aria-label="Bilateral Counter-Draft Surgery Deck">
          <div class="ch-pane-header">
            <div>
              <h2 class="ch-pane-title">Bilateral Counter-Draft Surgery</h2>
              <span class="ch-pane-meta">${neutralizedSet.size}/${findings.length} traps neutralized • ${diffChangeCount} diff segments • Tone: ${escapeHtml(activeTone)}</span>
            </div>
          </div>

          <div class="ch-surgery-body">
            ${
              fees.length > 0
                ? `<div class="ch-fee-deck">
                    <div class="ch-section-bar">
                      <span>Recurring Junk-Fee Scalpel (${fees.length})</span>
                      <span>Annualized Impact</span>
                    </div>
                    ${fees
                      .map((fee) => {
                        const excised = isFeeExcised(vaultState.excisedFeeMap, activeDoc.id, fee.feeKey);
                        return `
                          <div class="ch-fee-row ${excised ? "is-excised" : ""}">
                            <div>
                              <strong>${escapeHtml(fee.label || fee.matchText || "Recurring Fee")}</strong>
                              <div class="ch-pane-meta">${escapeHtml(fee.rawAmount || "")} (${escapeHtml(fee.period || "monthly")})</div>
                            </div>
                            <div style="display:flex;align-items:center;gap:0.55rem;">
                              <span class="ch-fee-amount">$${Math.round(Number(fee.annualizedDollars || 0)).toLocaleString("en-US")}/yr</span>
                              <button type="button" class="ch-btn ch-btn-sm ${excised ? "ch-btn-emerald" : "ch-btn-crimson"}" data-wb-action="excise-fee" data-fee-key="${escapeHtml(fee.feeKey)}">
                                ${excised ? "Restore Fee" : "Excise Fee"}
                              </button>
                            </div>
                          </div>
                        `;
                      })
                      .join("")}
                  </div>`
                : ""
            }

            <div class="ch-section-bar">
              <span>Flagged Predatory Clauses (${filteredFindings.length})</span>
              <span>${escapeHtml(activeFilter.toUpperCase())}</span>
            </div>

            ${
              filteredFindings.length === 0
                ? `<div class="ch-finding-excerpt">No clauses match the active triage filter. Switch to "All" or paste new contract prose.</div>`
                : filteredFindings
                    .map((finding) => {
                      const isNeut = neutralizedSet.has(finding.ruleId);
                      const isActive = finding.ruleId === activeRuleId;
                      const isEditing = editingDraftRuleId === finding.ruleId;
                      const catMeta = CATEGORY_METADATA?.[finding.categoryId] || { label: finding.categoryId };
                      const generated = generateRedline(finding, activeTone, { docTitle: activeDoc.title });
                      const customText = customDraftMap.get(`${activeDoc.id}::${finding.ruleId}`);
                      const draftText = customText !== undefined ? customText : generated.replacementText;

                      return `
                        <article class="ch-finding-card ${isNeut ? "is-neutralized" : ""} ${isActive ? "is-active" : ""}" data-card-rule-id="${escapeHtml(finding.ruleId)}" data-severity="${escapeHtml(finding.severity)}">
                          <div class="ch-finding-head">
                            <span class="ch-badge ${isNeut ? "ch-badge-emerald" : finding.severity === "critical" ? "ch-badge-critical" : ""}">
                              ${isNeut ? "NEUTRALIZED" : escapeHtml(finding.severity)} • ${escapeHtml(catMeta.label || finding.categoryId)}
                            </span>
                            <span class="ch-pane-meta">${escapeHtml(finding.ruleId)}${finding.annualFeeEstimate > 0 ? ` • ~$${Math.round(finding.annualFeeEstimate).toLocaleString("en-US")}/yr` : ""}</span>
                          </div>

                          <h3 class="ch-finding-title">${escapeHtml(finding.title)}</h3>
                          <p class="ch-finding-excerpt">“${escapeHtml(finding.excerpt || finding.matchText || "")}”</p>
                          <div style="font-size:0.84rem;color:var(--ch-ink-muted);">${escapeHtml(generated.rationale || finding.rationale || "")}</div>

                          ${
                            isEditing
                              ? `<textarea class="ch-counter-edit-textarea" data-draft-editor="${escapeHtml(finding.ruleId)}">${escapeHtml(draftText)}</textarea>
                                 <div class="ch-finding-actions">
                                   <button type="button" class="ch-btn ch-btn-sm ch-btn-primary" data-wb-action="save-draft" data-rule-id="${escapeHtml(finding.ruleId)}">Save Custom Edit</button>
                                 </div>`
                              : `<div class="ch-counter-draft-box">
                                   <strong style="font-family:var(--ch-font-mono);font-size:0.74rem;text-transform:uppercase;color:var(--ch-emerald);">Bilateral Counter-Draft (${escapeHtml(activeTone)})</strong>
                                   <div style="margin-top:0.2rem;">${escapeHtml(draftText)}</div>
                                 </div>`
                          }

                          <div class="ch-finding-actions">
                            <button type="button" class="ch-btn ch-btn-sm ${isNeut ? "ch-btn-emerald" : "ch-btn-crimson"}" data-wb-action="neutralize-rule" data-rule-id="${escapeHtml(finding.ruleId)}">
                              ${isNeut ? "Restore Clause" : "Neutralize Trap"}
                            </button>
                            <button type="button" class="ch-btn ch-btn-sm" data-wb-action="edit-draft" data-rule-id="${escapeHtml(finding.ruleId)}">
                              ${isEditing ? "Cancel Edit" : "Inline Edit"}
                            </button>
                            <button type="button" class="ch-btn ch-btn-sm" data-wb-action="locate-rule" data-rule-id="${escapeHtml(finding.ruleId)}">
                              Locate
                            </button>
                          </div>
                        </article>
                      `;
                    })
                    .join("")
            }

            <!-- Opt-In Local WebGPU Counsel Panel -->
            <div class="ch-webgpu-panel">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
                <strong>Local WebGPU Counsel (Opt-In)</strong>
                <button type="button" class="ch-btn ch-btn-sm" data-wb-action="toggle-webgpu" aria-expanded="${webGpuOpen ? "true" : "false"}">
                  ${webGpuOpen ? "Hide Counsel" : "Expand Counsel"}
                </button>
              </div>
              ${
                webGpuOpen
                  ? `<div style="display:flex;flex-direction:column;gap:0.5rem;">
                      <div class="ch-pane-meta">Probes local WebGPU hardware capacity &amp; runtime-sorted local weights only when explicitly triggered.</div>
                      <button type="button" class="ch-btn ch-btn-sm ch-btn-brass-outline" data-wb-action="probe-webgpu" ${webGpuStatus.probing ? "disabled" : ""}>
                        ${webGpuStatus.probing ? "Probing Local WebGPU..." : "Probe WebGPU & Explain Active Trap"}
                      </button>
                      ${
                        webGpuStatus.result
                          ? `<div class="ch-webgpu-output">WebGPU Supported: ${webGpuStatus.result.cap.supported ? "YES" : "NO (Deterministic Fallback Active)"} | Estimated VRAM: ${webGpuStatus.result.cap.estimatedVramMB} MB${
                              webGpuStatus.result.selection?.recommended
                                ? ` | Optimal Local Entry: ${webGpuStatus.result.selection.recommended.model_id}`
                                : ""
                            }\n\n${webGpuStatus.explanation}</div>`
                          : webGpuStatus.error
                            ? `<div class="ch-webgpu-output">${escapeHtml(webGpuStatus.error)}</div>`
                            : ""
                      }
                    </div>`
                  : ""
              }
            </div>
          </div>
        </section>
      </div>
    `;

    syncHeatmapLens();
  }

  render();

  return {
    loadDocument(doc) {
      editFolioMode = false;
      editingDraftRuleId = null;
      runScan(doc, doc?.source || "specimen", true);
    },
    updateVault(nextVault) {
      if (!nextVault) return;
      vaultState = nextVault;
      if (TONE_OPTIONS.includes(nextVault.defaultTone)) {
        activeTone = nextVault.defaultTone;
      }
      render();
      notifyAuditChange();
    },
    setFilter(filterId) {
      activeFilter = filterId || "all";
      render();
      notifyAuditChange();
    },
    setTone(toneId) {
      if (TONE_OPTIONS.includes(toneId)) {
        activeTone = toneId;
        render();
        notifyAuditChange();
      }
    },
    async redlineAll() {
      const current = getNeutralizedSet();
      let newTraps = 0;
      let newSavings = 0;
      for (const f of scanResult.findings || []) {
        if (!current.has(f.ruleId)) {
          current.add(f.ruleId);
          newTraps += 1;
          newSavings += Number(f.annualFeeEstimate || 0) || 0;
        }
      }
      playPenScratch(260, 1.15);
      triggerPaperCurlFx();
      await context.onUpdateNeutralized?.(activeDoc.id, Array.from(current), {
        deltaTraps: newTraps,
        deltaSavings: newSavings
      });
      dispatchBusEvent("clausehound:redline", {
        documentId: activeDoc.id,
        ruleId: "*",
        categoryId: "ALL",
        tone: activeTone,
        neutralized: true,
        annualSavingsDelta: newSavings
      });
    },
    async exciseAllFees() {
      const fees = scanResult.fees || [];
      const updates = {};
      let deltaSavings = 0;
      for (const fee of fees) {
        if (!isFeeExcised(vaultState.excisedFeeMap, activeDoc.id, fee.feeKey)) {
          updates[feeStorageKey(activeDoc.id, fee.feeKey)] = true;
          deltaSavings += Number(fee.annualizedDollars || 0) || 0;
        }
      }
      if (Object.keys(updates).length === 0) {
        context.onNotify?.("All detected recurring fees are already excised.", "emerald");
        return;
      }
      playPenScratch(220, 1.1);
      triggerPaperCurlFx();
      await context.onBatchExciseFees?.(updates, deltaSavings);
      dispatchBusEvent("clausehound:excise-fee", {
        documentId: activeDoc.id,
        feeKey: "*",
        annualDollarsSaved: deltaSavings,
        excised: true
      });
    },
    getAuditSnapshot() {
      return computeAuditSnapshot();
    },
    destroy() {
      clearScanTicks();
      container.removeEventListener("click", handleClick);
      container.removeEventListener("scroll", handleScroll, true);
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("dragleave", handleDragLeave);
      container.removeEventListener("drop", handleDrop);
      container.innerHTML = "";
    }
  };
}
