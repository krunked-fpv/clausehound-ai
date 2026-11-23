/**
 * ClauseHound Local — Application Shell & Boot Orchestrator
 * Installs Faraday Air-Gap network sandbox FIRST, initializes the tri-store
 * self-healing Vault, safely unlocks procedural WebAudio on first user gesture,
 * mounts all 5 DOM slots, handles #receipt= verification links, loads active
 * specimen (<2s), and registers the offline Service Worker.
 */

import {
  initVault,
  getVaultState,
  updateVaultState,
  resetDailyVault,
  restoreVaultSnapshot,
  subscribeVault
} from "../vault/cookie-vault.js";
import { createResetDailyManager } from "../vault/local-sync.js";
import {
  installFaradaySandbox,
  setAirGapLocked,
  getAirGapTelemetry,
  subscribeAirGap
} from "../security/faraday-airgap.js";
import {
  getSpecimenById,
  listSpecimens
} from "../engine/specimens.js";
import {
  unlockAudioContext,
  setAsmrMixLevel,
  playSealThud,
  playBrassClick
} from "../audio/faraday-audio.js";
import {
  encodeReceiptHash,
  decodeReceiptHash,
  buildReceiptDataFromAudit
} from "../share/receipt-codec.js";
import { registerFaradayServiceWorker } from "../pwa/sw-register.js";
import { mountCommandRail } from "./command-rail.js";
import { mountTelemetryStrip } from "./telemetry-strip.js";
import { mountClauseWorkbench } from "./clause-workbench.js";
import { mountSpecimenDrawer } from "./specimen-drawer.js";
import { mountVaultModal } from "./vault-modal.js";
import { mountReceiptModal } from "./receipt-modal.js";

function applyThemeToDocument(doc, theme) {
  if (!doc?.documentElement) return;
  doc.documentElement.dataset.theme = theme === "midnight" ? "midnight" : "vellum";
}

function dispatchWindowEvent(win, name, detail) {
  try {
    if (typeof win?.dispatchEvent === "function" && typeof CustomEvent === "function") {
      win.dispatchEvent(new CustomEvent(name, { detail }));
    }
  } catch {
    // ignore dispatch failure
  }
}

/**
 * Bootstraps ClauseHound Local inside the 5 explicit shell slots of `index.html`.
 * @param {object} [options={}]
 * @returns {Promise<object>}
 */
export async function bootstrapAppShell(options = {}) {
  const doc = options.document || globalThis.document;
  const win = options.window || globalThis.window;

  // 1. Install Faraday Air-Gap network sandbox FIRST (before any dynamic probe or SW)
  installFaradaySandbox({
    targetGlobal: win || globalThis,
    allowSameOriginGet: true,
    initialLocked: true
  });

  // 2. Initialize Tri-Store Self-Healing Vault
  const initialVault = await initVault();
  applyThemeToDocument(doc, initialVault.theme);
  setAirGapLocked(Boolean(initialVault.airGapLocked));
  setAsmrMixLevel(initialVault.asmrMixLevel);

  // 3. Defer WebAudio unlock safely until first user pointer or keyboard gesture
  let audioUnlockBound = false;
  const onFirstGesture = async () => {
    try {
      await unlockAudioContext();
      setAsmrMixLevel(getVaultState().asmrMixLevel);
    } catch {
      // ignore if audio unavailable
    }
    if (doc && audioUnlockBound) {
      doc.removeEventListener("pointerdown", onFirstGesture);
      doc.removeEventListener("keydown", onFirstGesture);
      audioUnlockBound = false;
    }
  };
  if (doc?.addEventListener) {
    audioUnlockBound = true;
    doc.addEventListener("pointerdown", onFirstGesture, { passive: true });
    doc.addEventListener("keydown", onFirstGesture, { passive: true });
  }

  // 4. Locate all 5 shell slots
  const railSlot = doc?.getElementById?.("command-rail-slot");
  const telemetrySlot = doc?.getElementById?.("telemetry-strip-slot");
  const workspaceSlot = doc?.getElementById?.("studio-workspace-slot");
  const overlaySlot = doc?.getElementById?.("overlay-portal-slot");
  const toastSlot = doc?.getElementById?.("toast-region-slot");

  const resetManager = createResetDailyManager({ resetDailyVault });
  let resetTimerId = null;

  let commandRail = null;
  let telemetryStrip = null;
  let workbench = null;
  let specimenDrawer = null;
  let vaultModal = null;
  let receiptModal = null;

  const showToast = (msg, kind = "brass", toastOpts) => {
    vaultModal?.showToast?.(msg, kind, toastOpts);
  };

  const syncAllUi = (vault = getVaultState()) => {
    applyThemeToDocument(doc, vault.theme);
    const airGapTelemetry = getAirGapTelemetry();
    const audit = workbench?.getAuditSnapshot?.();
    commandRail?.update?.({
      vaultState: vault,
      airGapTelemetry,
      activeDocTitle: audit?.docTitle || vault.activeSpecimenId,
      resetArmed: resetManager.isArmed()
    });
    if (audit) {
      telemetryStrip?.update?.({
        annualSavings: audit.annualSavings,
        safetyBefore: audit.safetyBefore,
        safetyAfter: audit.safetyAfter,
        activeFilter: audit.activeFilter,
        activeTone: audit.tone,
        sealed: audit.sealed,
        counts: audit.counts,
        feeCount: audit.fees.length,
        excisedFeeCount: audit.excisedFeeKeys.length,
        neutralizedCount: audit.neutralizedRuleIds.length
      });
    }
    vaultModal?.update?.(vault);
    specimenDrawer?.updateActive?.(vault.activeSpecimenId);
  };

  const openSpecimenById = (specimenId, source = "specimen") => {
    const fallbackList = listSpecimens();
    const specimen =
      getSpecimenById(specimenId) ||
      getSpecimenById("sterling-lease") ||
      fallbackList[0];

    if (!specimen) return;
    workbench?.loadDocument?.({
      id: specimen.id,
      title: specimen.title || specimen.id,
      docCategory: specimen.docCategory || "custom-agreement",
      text: specimen.text || "",
      source
    });
  };

  // 5. Mount Overlay Modals / Drawers
  vaultModal = mountVaultModal(overlaySlot, toastSlot, {
    getVaultState,
    onRestoreVault: async (snapshot) => {
      const restored = await restoreVaultSnapshot(snapshot);
      setAirGapLocked(Boolean(restored.airGapLocked));
      setAsmrMixLevel(restored.asmrMixLevel);
      openSpecimenById(restored.activeSpecimenId, "specimen");
      syncAllUi(restored);
      return restored;
    }
  });

  specimenDrawer = mountSpecimenDrawer(overlaySlot, {
    activeSpecimenId: initialVault.activeSpecimenId,
    onSelectSpecimen: async (specimenId) => {
      await updateVaultState({ activeSpecimenId: specimenId });
      openSpecimenById(specimenId, "specimen");
    },
    onLoadCustomDocument: (docPayload) => {
      workbench?.loadDocument?.(docPayload);
      showToast(`Loaded "${docPayload.title}" locally (0.0 KB uploaded).`, "emerald");
    },
    onNotify: showToast
  });

  receiptModal = mountReceiptModal(overlaySlot, toastSlot, {
    showToast,
    getTheme: () => getVaultState().theme,
    getPacketParams: () => {
      const audit = workbench?.getAuditSnapshot?.();
      if (!audit) return null;
      return {
        docTitle: audit.docTitle,
        docCategory: audit.docCategory,
        originalText: audit.text,
        redlinedText: audit.redlinedText,
        findings: audit.findings,
        neutralizedRuleIds: audit.neutralizedRuleIds,
        excisedFees: audit.excisedFees,
        tone: audit.tone,
        annualSavings: audit.annualSavings,
        riskScoreBefore: audit.riskScoreBefore,
        riskScoreAfter: audit.riskScoreAfter
      };
    },
    onOpenLiveFolio: () => {
      if (win?.history?.replaceState && win.location?.hash?.startsWith("#receipt=")) {
        try {
          win.history.replaceState(null, "", win.location.pathname + win.location.search);
        } catch {
          // ignore history failure
        }
      }
      openSpecimenById(getVaultState().activeSpecimenId, "specimen");
    }
  });

  // 6. Mount Main Desk Workbench, Telemetry Strip, and Command Rail
  workbench = mountClauseWorkbench(workspaceSlot, {
    initialVault,
    onNotify: showToast,
    onAuditUpdated: () => {
      syncAllUi(getVaultState());
    },
    onUpdateNeutralized: async (docId, nextRuleIds, stats = {}) => {
      await updateVaultState((prev) => ({
        neutralizedRuleMap: {
          ...prev.neutralizedRuleMap,
          [docId]: nextRuleIds
        },
        lifetimeTrapsNeutralized:
          prev.lifetimeTrapsNeutralized + Math.max(0, Number(stats.deltaTraps || 0)),
        lifetimeAnnualDollarsSaved:
          prev.lifetimeAnnualDollarsSaved + Math.max(0, Number(stats.deltaSavings || 0))
      }));
    },
    onUpdateExcisedFee: async (storageKey, excised, deltaSavings = 0) => {
      await updateVaultState((prev) => ({
        excisedFeeMap: {
          ...prev.excisedFeeMap,
          [storageKey]: Boolean(excised)
        },
        lifetimeAnnualDollarsSaved:
          prev.lifetimeAnnualDollarsSaved + Math.max(0, Number(deltaSavings || 0))
      }));
    },
    onBatchExciseFees: async (feeMapUpdates, deltaSavings = 0) => {
      await updateVaultState((prev) => ({
        excisedFeeMap: {
          ...prev.excisedFeeMap,
          ...feeMapUpdates
        },
        lifetimeAnnualDollarsSaved:
          prev.lifetimeAnnualDollarsSaved + Math.max(0, Number(deltaSavings || 0))
      }));
    }
  });

  telemetryStrip = mountTelemetryStrip(telemetrySlot, {
    onSelectFilter: (filterId) => {
      workbench?.setFilter?.(filterId);
    },
    onSelectTone: async (toneId) => {
      workbench?.setTone?.(toneId);
      await updateVaultState({ defaultTone: toneId });
    },
    onRedlineAll: async () => {
      await workbench?.redlineAll?.();
      showToast("Neutralized all detected clause traps in active tone.", "emerald");
    },
    onExciseAllFees: async () => {
      await workbench?.exciseAllFees?.();
    },
    onStampSeal: async () => {
      const audit = workbench?.getAuditSnapshot?.();
      if (!audit) return;
      playSealThud();
      const updated = await updateVaultState((prev) => ({
        sealStampedMap: {
          ...prev.sealStampedMap,
          [audit.documentId]: true
        }
      }));
      const receipt = buildReceiptDataFromAudit(audit, updated);
      const receiptHash = encodeReceiptHash(receipt);
      dispatchWindowEvent(win, "clausehound:seal-stamp", {
        documentId: audit.documentId,
        receiptHash,
        stamped: true,
        timestamp: new Date().toISOString()
      });
      receiptModal?.open?.(receipt, { fromHash: false });
    },
    onOpenReceiptModal: () => {
      const audit = workbench?.getAuditSnapshot?.();
      if (!audit) return;
      const receipt = buildReceiptDataFromAudit(audit, getVaultState());
      receiptModal?.open?.(receipt, { fromHash: false });
    }
  });

  commandRail = mountCommandRail(railSlot, {
    onToggleAirGap: async (nextLocked) => {
      setAirGapLocked(Boolean(nextLocked));
      await updateVaultState({ airGapLocked: Boolean(nextLocked) });
      showToast(
        nextLocked
          ? "Faraday Air-Gap LOCKED: outbound networking sealed."
          : "Faraday Air-Gap UNLOCKED: manual session active.",
        nextLocked ? "emerald" : "crimson"
      );
    },
    onOpenSpecimens: () => {
      vaultModal?.close?.();
      receiptModal?.close?.();
      specimenDrawer?.open?.();
    },
    onToggleTheme: async () => {
      const nextTheme = getVaultState().theme === "midnight" ? "vellum" : "midnight";
      applyThemeToDocument(doc, nextTheme);
      await updateVaultState({ theme: nextTheme });
    },
    onChangeAsmrLevel: async (level) => {
      await updateVaultState({ asmrMixLevel: level });
    },
    onToggleAmbient: () => {},
    onRequestReset: async () => {
      const prevSnapshot = getVaultState();
      const result = await resetManager.requestReset();
      if (result.armed) {
        if (resetTimerId) globalThis.clearTimeout?.(resetTimerId);
        resetTimerId = globalThis.setTimeout(() => {
          syncAllUi(getVaultState());
        }, 5100);
        showToast("Click Confirm Reset? within 5s to clear today's redlines.", "brass");
        syncAllUi(getVaultState());
        return;
      }
      if (result.reset) {
        if (resetTimerId) globalThis.clearTimeout?.(resetTimerId);
        syncAllUi(result.state);
        showToast("Daily desk reset cleanly.", "emerald", {
          actionLabel: "Undo",
          durationMs: 8000,
          onAction: async () => {
            playBrassClick(1);
            const restored = await restoreVaultSnapshot(prevSnapshot);
            syncAllUi(restored);
            showToast("Daily reset undone — previous redlines restored.", "emerald");
          }
        });
      }
    },
    onCancelReset: () => {
      resetManager.cancelReset();
      if (resetTimerId) globalThis.clearTimeout?.(resetTimerId);
      syncAllUi(getVaultState());
    },
    onOpenVaultModal: () => {
      specimenDrawer?.close?.();
      receiptModal?.close?.();
      vaultModal?.open?.(getVaultState());
    }
  });

  // 7. Subscribe to Vault & AirGap & CustomEvent Bus updates
  const unsubVault = subscribeVault((nextVault) => {
    workbench?.updateVault?.(nextVault);
    syncAllUi(nextVault);
  });

  const unsubAirGap = subscribeAirGap(() => {
    syncAllUi(getVaultState());
  });

  const onVaultHealed = (event) => {
    const detail = event?.detail || {};
    vaultModal?.setHealInfo?.(detail);
    showToast(
      `Self-Healing Vault recovered from ${detail.source || "backup"} (#${detail.selfHealRecoveries || 1}).`,
      "emerald"
    );
  };
  win?.addEventListener?.("clausehound:vault-healed", onVaultHealed);

  if (win?.__CLAUSEHOUND_BOOT_HEAL__?.healed) {
    vaultModal?.setHealInfo?.(win.__CLAUSEHOUND_BOOT_HEAL__);
  }

  // 8. Load active specimen immediately (< 2s)
  openSpecimenById(initialVault.activeSpecimenId, "boot");

  // 9. Handle #receipt= hash on boot & hashchange
  const checkReceiptHash = () => {
    const hash = win?.location?.hash || "";
    if (!hash.startsWith("#receipt=")) return;
    const decoded = decodeReceiptHash(hash);
    if (decoded) {
      receiptModal?.open?.(decoded, { fromHash: true });
    } else {
      showToast("Invalid or corrupted #receipt= verification token.", "crimson");
    }
  };
  if (options.autoReceipt !== false) {
    checkReceiptHash();
  }
  win?.addEventListener?.("hashchange", checkReceiptHash);

  // 10. Register offline Service Worker
  if (options.registerSw !== false) {
    registerFaradayServiceWorker().catch(() => {});
  }

  return {
    getVaultState,
    destroy() {
      if (resetTimerId) globalThis.clearTimeout?.(resetTimerId);
      resetManager.dispose();
      unsubVault?.();
      unsubAirGap?.();
      win?.removeEventListener?.("clausehound:vault-healed", onVaultHealed);
      win?.removeEventListener?.("hashchange", checkReceiptHash);
      if (doc && audioUnlockBound) {
        doc.removeEventListener("pointerdown", onFirstGesture);
        doc.removeEventListener("keydown", onFirstGesture);
      }
      commandRail?.destroy?.();
      telemetryStrip?.destroy?.();
      workbench?.destroy?.();
      specimenDrawer?.destroy?.();
      vaultModal?.destroy?.();
      receiptModal?.destroy?.();
    }
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const autoBoot = () => {
    if (window.__CLAUSEHOUND_BOOTED__) return;
    window.__CLAUSEHOUND_BOOTED__ = true;
    bootstrapAppShell().catch(() => {});
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoBoot, { once: true });
  } else {
    autoBoot();
  }
}
