/**
 * ClauseHound Local — Sticky Faraday Command Rail
 * Houses brand crest, Faraday Air-Gap physical shutter toggle + oscilloscope telemetry,
 * hardware-offline verification badge, theme switcher, ASMR preset mixer, two-step
 * non-blocking Reset Daily control, Local Sync trigger, and conditional PWA install button.
 */

import {
  MIX_PRESETS,
  setAsmrMixLevel,
  playBrassClick,
  playAirGapLatch,
  setAmbientDeskEnabled,
  getAudioState
} from "../audio/faraday-audio.js";
import { createInstallController } from "../pwa/sw-register.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getActivePresetName(mixLevel) {
  const num = Number(mixLevel);
  if (Math.abs(num - MIX_PRESETS.silent) < 0.03) return "silent";
  if (Math.abs(num - MIX_PRESETS.whisper) < 0.04) return "whisper";
  if (Math.abs(num - MIX_PRESETS.studio) < 0.04) return "studio";
  return "custom";
}

/**
 * Mounts the top Command Rail inside `#command-rail-slot`.
 * @param {HTMLElement} container
 * @param {object} context
 * @returns {{ update: (state: object) => void, destroy: () => void }}
 */
export function mountCommandRail(container, context = {}) {
  if (!container) {
    return { update() {}, destroy() {} };
  }

  let currentState = {
    vaultState: {
      theme: "vellum",
      asmrMixLevel: MIX_PRESETS.whisper,
      airGapLocked: true
    },
    airGapTelemetry: {
      locked: true,
      blockedCount: 0,
      outboundBytes: 0,
      hardwareOffline: false
    },
    activeDocTitle: "The Sterling Lofts Residential Lease",
    resetArmed: false
  };

  let installAvailable = false;
  let installStandalone = false;
  let unsubInstall = null;
  let installController = null;

  try {
    const handleInstallChange = (status) => {
      installAvailable = Boolean(status?.installAvailable ?? installController?.isInstallAvailable?.());
      installStandalone = Boolean(status?.standalone ?? installController?.isStandalone?.());
      render();
    };
    installController = createInstallController();
    if (typeof installController?.subscribe === "function") {
      unsubInstall = installController.subscribe(handleInstallChange);
    } else {
      installController = createInstallController(handleInstallChange);
    }
    installAvailable = Boolean(installController?.isInstallAvailable?.());
    installStandalone = Boolean(installController?.isStandalone?.());
  } catch {
    installController = null;
  }

  const handleClick = async (event) => {
    const btn = event.target?.closest?.("[data-rail-action]");
    if (!btn) return;
    const action = btn.dataset.railAction;

    if (action === "toggle-airgap") {
      const nextLocked = !(currentState.airGapTelemetry?.locked ?? currentState.vaultState?.airGapLocked ?? true);
      playAirGapLatch(nextLocked);
      await context.onToggleAirGap?.(nextLocked);
      return;
    }

    if (action === "open-specimens") {
      playBrassClick(0);
      context.onOpenSpecimens?.();
      return;
    }

    if (action === "toggle-theme") {
      playBrassClick(1);
      await context.onToggleTheme?.();
      return;
    }

    if (action === "asmr-preset") {
      const presetKey = btn.dataset.preset;
      const level = MIX_PRESETS[presetKey];
      if (typeof level === "number") {
        setAsmrMixLevel(level);
        playBrassClick(2);
        await context.onChangeAsmrLevel?.(level);
      }
      return;
    }

    if (action === "toggle-ambient") {
      const audioState = getAudioState();
      const nextEnabled = !audioState.ambientEnabled;
      setAmbientDeskEnabled(nextEnabled);
      playBrassClick(3);
      context.onToggleAmbient?.(nextEnabled);
      render();
      return;
    }

    if (action === "reset-daily") {
      playBrassClick(4);
      await context.onRequestReset?.();
      return;
    }

    if (action === "cancel-reset") {
      playBrassClick(0);
      context.onCancelReset?.();
      return;
    }

    if (action === "open-vault") {
      playBrassClick(1);
      context.onOpenVaultModal?.();
      return;
    }

    if (action === "install-pwa") {
      playBrassClick(2);
      try {
        await installController?.triggerInstall?.();
      } catch {
        // ignore dismissed prompt
      }
      installAvailable = Boolean(installController?.isInstallAvailable?.());
      installStandalone = Boolean(installController?.isStandalone?.());
      render();
    }
  };

  const handleInput = async (event) => {
    const slider = event.target?.closest?.('[data-rail-input="asmr-slider"]');
    if (!slider) return;
    const val = Math.max(0, Math.min(1, Number(slider.value)));
    setAsmrMixLevel(val);
    await context.onChangeAsmrLevel?.(val);
  };

  container.addEventListener("click", handleClick);
  container.addEventListener("input", handleInput);

  function render() {
    const vault = currentState.vaultState || {};
    const telemetry = currentState.airGapTelemetry || {};
    const locked = telemetry.locked ?? vault.airGapLocked ?? true;
    const blockedCount = Number(telemetry.blockedCount ?? 0) || 0;
    const outboundKb = ((Number(telemetry.outboundBytes ?? 0) || 0) / 1024).toFixed(1);
    const hardwareOffline = Boolean(telemetry.hardwareOffline);
    const theme = vault.theme === "midnight" ? "midnight" : "vellum";
    const mixLevel = Number.isFinite(Number(vault.asmrMixLevel))
      ? Number(vault.asmrMixLevel)
      : MIX_PRESETS.whisper;
    const activePreset = getActivePresetName(mixLevel);
    const audioState = getAudioState();
    const showInstall = installAvailable && !installStandalone;

    container.innerHTML = `
      <nav class="ch-command-rail" aria-label="Faraday Desk Command Rail">
        <div class="ch-brand-group">
          <div class="ch-brand-crest" aria-hidden="true">CH</div>
          <div class="ch-brand-titles">
            <h1 class="ch-brand-title">ClauseHound Local</h1>
            <p class="ch-brand-sub">${escapeHtml(currentState.activeDocTitle || "Faraday Brass Desk")}</p>
          </div>
        </div>

        <div class="ch-rail-airgap-cluster">
          <button
            type="button"
            class="ch-shutter-toggle ${locked ? "" : "is-unlocked"}"
            data-rail-action="toggle-airgap"
            aria-pressed="${locked ? "true" : "false"}"
            title="Toggle Faraday Network Air-Gap Shutter"
          >
            <span class="ch-shutter-led" aria-hidden="true"></span>
            <span>AIR-GAP: ${locked ? "LOCKED" : "UNLOCKED"}</span>
          </button>

          <div
            class="ch-oscilloscope-chip ${blockedCount > 0 ? "has-blocked" : ""}"
            title="Live Faraday Outbound Oscilloscope"
          >
            <svg class="ch-oscilloscope-wave" viewBox="0 0 60 18" aria-hidden="true">
              <line x1="0" y1="9" x2="60" y2="9" stroke="currentColor" stroke-width="1.6" />
              ${blockedCount > 0 ? '<polyline points="20,9 24,3 28,15 32,9" fill="none" stroke="#E5A93C" stroke-width="1.5" />' : ""}
            </svg>
            <span>${outboundKb} KB Outbound${blockedCount > 0 ? ` • ${blockedCount} Blocked` : ""}</span>
          </div>

          ${
            hardwareOffline
              ? `<span class="ch-hardware-offline-badge">TRUE HARDWARE AIR-GAP VERIFIED (OFFLINE)</span>`
              : ""
          }
        </div>

        <div class="ch-rail-actions">
          <button type="button" class="ch-btn ch-btn-sm" data-rail-action="open-specimens">
            Specimens &amp; Upload
          </button>

          <button
            type="button"
            class="ch-btn ch-btn-sm"
            data-rail-action="toggle-theme"
            aria-pressed="${theme === "midnight" ? "true" : "false"}"
          >
            ${theme === "midnight" ? "Theme: Midnight" : "Theme: Vellum"}
          </button>

          <div class="ch-asmr-group" role="group" aria-label="ASMR Desk Mixer">
            <div class="ch-asmr-presets">
              <button
                type="button"
                class="ch-preset-btn ${activePreset === "silent" ? "is-active" : ""}"
                data-rail-action="asmr-preset"
                data-preset="silent"
              >Silent</button>
              <button
                type="button"
                class="ch-preset-btn ${activePreset === "whisper" ? "is-active" : ""}"
                data-rail-action="asmr-preset"
                data-preset="whisper"
              >Whisper</button>
              <button
                type="button"
                class="ch-preset-btn ${activePreset === "studio" ? "is-active" : ""}"
                data-rail-action="asmr-preset"
                data-preset="studio"
              >Studio</button>
            </div>
            <input
              type="range"
              class="ch-asmr-slider"
              min="0"
              max="1"
              step="0.01"
              value="${mixLevel.toFixed(2)}"
              aria-label="ASMR Mix Volume"
              data-rail-input="asmr-slider"
            >
            <button
              type="button"
              class="ch-preset-btn ${audioState.ambientEnabled ? "is-active" : ""}"
              data-rail-action="toggle-ambient"
              aria-pressed="${audioState.ambientEnabled ? "true" : "false"}"
              title="Toggle subtle Faraday ambient desk tone"
            >Tone</button>
          </div>

          ${
            currentState.resetArmed
              ? `<button type="button" class="ch-btn ch-btn-sm ch-reset-armed" data-rail-action="reset-daily">Confirm Reset?</button>
                 <button type="button" class="ch-btn ch-btn-sm" data-rail-action="cancel-reset">Cancel</button>`
              : `<button type="button" class="ch-btn ch-btn-sm" data-rail-action="reset-daily">🔄 Reset Daily</button>`
          }

          <button type="button" class="ch-btn ch-btn-sm ch-btn-brass-outline" data-rail-action="open-vault">
            💾 Local Sync
          </button>

          ${
            showInstall
              ? `<button type="button" class="ch-btn ch-btn-sm ch-btn-primary" data-rail-action="install-pwa">Install Desk</button>`
              : ""
          }
        </div>
      </nav>
    `;
  }

  render();

  return {
    update(nextState = {}) {
      currentState = {
        ...currentState,
        ...nextState,
        vaultState: nextState.vaultState ?? currentState.vaultState,
        airGapTelemetry: nextState.airGapTelemetry ?? currentState.airGapTelemetry
      };
      render();
    },
    destroy() {
      container.removeEventListener("click", handleClick);
      container.removeEventListener("input", handleInput);
      try {
        unsubInstall?.();
        installController?.dispose?.();
      } catch {
        // ignore unsubscribe cleanup
      }
      container.innerHTML = "";
    }
  };
}
