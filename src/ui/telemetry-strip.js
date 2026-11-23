/**
 * ClauseHound Local — Mechanical Split-Flap Telemetry Strip
 * Displays cascading annualized savings odometer ($/yr Reclaimed), Safety Score gauge
 * (Before -> After), trap triage filter pills, tone selector, and bulk surgical triggers.
 */

import { TONE_OPTIONS } from "../engine/clause-rules.js";
import { playBrassClick, playSplitFlapClick } from "../audio/faraday-audio.js";

const FILTER_PILLS = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "JUNK_FEES", label: "Junk Fees" },
  { id: "IP_INDEMNITY", label: "IP & Indemnity" },
  { id: "AUTO_RENEWAL", label: "Auto-Renewal" }
];

const TONE_LABELS = {
  collaborative: "Collaborative",
  bilateral: "Firm Bilateral",
  counsel: "Ironclad Counsel"
};

function formatDigits(amount) {
  const safe = Math.max(0, Math.round(Number(amount) || 0));
  return safe.toLocaleString("en-US").padStart(4, "0");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Mounts the Telemetry Strip inside `#telemetry-strip-slot`.
 * @param {HTMLElement} container
 * @param {object} context
 * @returns {{ update: (telemetry: object) => void, destroy: () => void }}
 */
export function mountTelemetryStrip(container, context = {}) {
  if (!container) {
    return { update() {}, destroy() {} };
  }

  let state = {
    annualSavings: 0,
    safetyBefore: 100,
    safetyAfter: 100,
    activeFilter: "all",
    activeTone: "bilateral",
    sealed: false,
    counts: {
      all: 0,
      critical: 0,
      JUNK_FEES: 0,
      IP_INDEMNITY: 0,
      AUTO_RENEWAL: 0
    },
    feeCount: 0,
    excisedFeeCount: 0,
    neutralizedCount: 0
  };

  let displayedSavings = 0;
  let cascadeTimers = [];

  const clearCascade = () => {
    for (const id of cascadeTimers) {
      globalThis.clearTimeout?.(id);
    }
    cascadeTimers = [];
  };

  const renderOdometerDom = (value, flipping = false) => {
    const row = container.querySelector("[data-split-flap-row]");
    if (!row) return;
    const text = formatDigits(value);
    const digitsHtml = Array.from(text)
      .map((ch) => {
        if (ch === ",") {
          return `<span class="ch-flap-prefix" aria-hidden="true">,</span>`;
        }
        return `<span class="ch-flap-digit ${flipping ? "is-flipping" : ""}">${escapeHtml(ch)}</span>`;
      })
      .join("");
    row.innerHTML = `<span class="ch-flap-prefix">$</span>${digitsHtml}<span class="ch-flap-suffix">/yr Reclaimed</span>`;
  };

  const startSavingsCascade = (targetValue) => {
    clearCascade();
    const target = Math.max(0, Math.round(Number(targetValue) || 0));
    const start = displayedSavings;
    if (start === target) return;

    const steps = 4;
    for (let i = 1; i <= steps; i += 1) {
      const delay = i * 55;
      const timerId = globalThis.setTimeout(() => {
        const nextVal =
          i === steps ? target : Math.round(start + ((target - start) * i) / steps);
        displayedSavings = nextVal;
        renderOdometerDom(nextVal, i < steps);
        if (i === 1 || i === steps) {
          playSplitFlapClick(i);
        }
      }, delay);
      cascadeTimers.push(timerId);
    }
  };

  const handleClick = async (event) => {
    const target = event.target?.closest?.("[data-strip-action]");
    if (!target) return;
    const action = target.dataset.stripAction;

    if (action === "filter") {
      playBrassClick(0);
      await context.onSelectFilter?.(target.dataset.filterId);
      return;
    }

    if (action === "tone") {
      playBrassClick(1);
      await context.onSelectTone?.(target.dataset.toneId);
      return;
    }

    if (action === "redline-all") {
      await context.onRedlineAll?.();
      return;
    }

    if (action === "excise-fees") {
      await context.onExciseAllFees?.();
      return;
    }

    if (action === "stamp-seal") {
      await context.onStampSeal?.();
      return;
    }

    if (action === "open-receipt") {
      playBrassClick(2);
      context.onOpenReceiptModal?.();
    }
  };

  container.addEventListener("click", handleClick);

  function render() {
    const counts = state.counts || {};
    const before = Math.max(0, Math.min(100, Math.round(Number(state.safetyBefore ?? 100))));
    const after = Math.max(0, Math.min(100, Math.round(Number(state.safetyAfter ?? before))));
    const formatted = formatDigits(displayedSavings);
    const digitsHtml = Array.from(formatted)
      .map((ch) =>
        ch === ","
          ? `<span class="ch-flap-prefix" aria-hidden="true">,</span>`
          : `<span class="ch-flap-digit">${escapeHtml(ch)}</span>`
      )
      .join("");

    container.innerHTML = `
      <div class="ch-telemetry-strip">
        <div class="ch-telemetry-top">
          <div class="ch-odometer-card" aria-label="Annualized Savings Reclaimed">
            <div>
              <div class="ch-odometer-label">Annualized Savings</div>
              <div class="ch-split-flap-row" data-split-flap-row>
                <span class="ch-flap-prefix">$</span>${digitsHtml}<span class="ch-flap-suffix">/yr Reclaimed</span>
              </div>
            </div>
          </div>

          <div class="ch-safety-gauge-card" aria-label="Contract Safety Score">
            <div class="ch-gauge-header">
              <span>SAFETY SCORE (100 - RISK)</span>
              <span class="ch-gauge-score">${before} &rarr; ${after} / 100</span>
            </div>
            <div class="ch-gauge-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${after}">
              <div class="ch-gauge-fill-before" style="width: ${before}%"></div>
              <div class="ch-gauge-fill-after" style="width: ${after}%"></div>
            </div>
          </div>

          <div class="ch-telemetry-actions">
            <button type="button" class="ch-btn ch-btn-crimson" data-strip-action="redline-all">
              Redline All Traps (${counts.all || 0})
            </button>
            <button type="button" class="ch-btn ch-btn-brass-outline" data-strip-action="excise-fees">
              Excise Junk Fees (${state.feeCount || 0})
            </button>
            <button type="button" class="ch-btn ch-btn-emerald" data-strip-action="stamp-seal">
              ${state.sealed ? "Verified Seal Stamped" : "Stamp Final Seal"}
            </button>
            <button type="button" class="ch-btn ch-btn-primary" data-strip-action="open-receipt">
              Packet &amp; Share
            </button>
          </div>
        </div>

        <div class="ch-telemetry-bottom">
          <div class="ch-filter-pills" role="tablist" aria-label="Trap Triage Filter">
            ${FILTER_PILLS.map((pill) => {
              const active = state.activeFilter === pill.id;
              const count = Number(counts[pill.id] ?? 0);
              return `
                <button
                  type="button"
                  role="tab"
                  aria-selected="${active ? "true" : "false"}"
                  class="ch-pill ${active ? "is-active" : ""}"
                  data-strip-action="filter"
                  data-filter-id="${pill.id}"
                >
                  <span>${pill.label}</span>
                  <span class="ch-pill-count">${count}</span>
                </button>
              `;
            }).join("")}
          </div>

          <div class="ch-tone-pills" role="group" aria-label="Counter-Draft Tone Selector">
            ${TONE_OPTIONS.map((toneId) => {
              const active = state.activeTone === toneId;
              return `
                <button
                  type="button"
                  class="ch-pill ${active ? "is-active" : ""}"
                  data-strip-action="tone"
                  data-tone-id="${toneId}"
                  aria-pressed="${active ? "true" : "false"}"
                >${TONE_LABELS[toneId] || toneId}</button>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }

  render();

  return {
    update(nextTelemetry = {}) {
      const prevTarget = state.annualSavings;
      state = {
        ...state,
        ...nextTelemetry,
        counts: nextTelemetry.counts ?? state.counts
      };
      render();
      const nextTarget = Math.max(0, Math.round(Number(state.annualSavings) || 0));
      if (nextTarget !== prevTarget || nextTarget !== displayedSavings) {
        startSavingsCascade(nextTarget);
      }
    },
    destroy() {
      clearCascade();
      container.removeEventListener("click", handleClick);
      container.innerHTML = "";
    }
  };
}
