/**
 * ClauseHound Local — Faraday Brass & Wax Seal Canvas Renderer
 * High-DPI ceremonial brass die seal, 1200x630 verification certificate card,
 * and self-terminating 60fps optical sweep / paper-curl tactile FX.
 */

import { encodeReceiptHash } from "../share/receipt-codec.js";

const WATERMARK_URL = "https://krunked-fpv.github.io/clausehound-ai/";
const ACTIVE_RAFS = new WeakMap();

const THEME_FALLBACKS = Object.freeze({
  vellum: Object.freeze({
    bg: "#F4EFE6",
    surface: "#FAF7F1",
    surfaceAlt: "#EFE7D6",
    ink: "#1C1917",
    inkMuted: "#575049",
    crimson: "#9E1B24",
    crimsonDeep: "#6E1017",
    emerald: "#145A43",
    brass: "#B68D40",
    brassBright: "#D9B464",
    brassDark: "#7C5B20",
    border: "#D5C8B2"
  }),
  midnight: Object.freeze({
    bg: "#0F1115",
    surface: "#161A22",
    surfaceAlt: "#1D222D",
    ink: "#F4EFE6",
    inkMuted: "#A9A194",
    crimson: "#E0525D",
    crimsonDeep: "#9E1B24",
    emerald: "#2DD4BF",
    brass: "#E5A93C",
    brassBright: "#F5CA6F",
    brassDark: "#996A1E",
    border: "#2E3545"
  })
});

function cancelCanvasRaf(canvas) {
  const prevId = ACTIVE_RAFS.get(canvas);
  if (prevId != null && typeof globalThis.cancelAnimationFrame === "function") {
    globalThis.cancelAnimationFrame(prevId);
  }
  ACTIVE_RAFS.delete(canvas);
}

function prefersReducedMotion() {
  try {
    return Boolean(globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

function resolveThemePalette(themeOption) {
  let theme = themeOption;
  if (!theme && typeof globalThis.document !== "undefined") {
    theme = globalThis.document.documentElement?.dataset?.theme;
  }
  const resolvedTheme = theme === "midnight" ? "midnight" : "vellum";
  const base = { ...THEME_FALLBACKS[resolvedTheme], name: resolvedTheme };

  if (typeof globalThis.getComputedStyle === "function" && typeof globalThis.document !== "undefined") {
    try {
      const styles = globalThis.getComputedStyle(globalThis.document.documentElement);
      const pick = (prop, fallback) => {
        const val = styles.getPropertyValue(prop)?.trim();
        return val || fallback;
      };
      base.bg = pick("--ch-bg", base.bg);
      base.surface = pick("--ch-surface", base.surface);
      base.ink = pick("--ch-ink", base.ink);
      base.inkMuted = pick("--ch-ink-muted", base.inkMuted);
      base.crimson = pick("--ch-crimson", base.crimson);
      base.emerald = pick("--ch-emerald", base.emerald);
      base.brass = pick("--ch-brass", base.brass);
      base.border = pick("--ch-border", base.border);
    } catch {
      // keep fallback tokens
    }
  }
  return base;
}

function normalizeReceipt(receiptData = {}) {
  const riskBefore = Math.max(0, Math.min(100, Number(receiptData.riskScoreBefore ?? 0) || 0));
  const riskAfter = Math.max(0, Math.min(100, Number(receiptData.riskScoreAfter ?? riskBefore) || 0));
  const safetyBefore = Math.max(0, Math.min(100, 100 - riskBefore));
  const safetyAfter = Math.max(0, Math.min(100, 100 - riskAfter));
  const annualDollarsSaved = Math.max(0, Math.round(Number(receiptData.annualDollarsSaved ?? 0) || 0));
  const trapsDetected = Math.max(0, Math.round(Number(receiptData.trapsDetected ?? 0) || 0));
  const trapsNeutralized = Math.max(0, Math.round(Number(receiptData.trapsNeutralized ?? 0) || 0));
  const airGapLocked = receiptData.airGapLocked !== false;
  const sealed = Boolean(receiptData.sealed);
  const digestNum = Number(receiptData.docDigestFnv1a ?? 0) >>> 0;
  const digestHex = digestNum.toString(16).toUpperCase().padStart(8, "0");
  const timestampSec = Number(receiptData.timestampUnixSec) || Math.floor(Date.now() / 1000);
  const tone = String(receiptData.tone || "bilateral").toUpperCase();
  const docCategory = String(receiptData.docCategory || "custom-agreement");

  return {
    ...receiptData,
    riskBefore,
    riskAfter,
    safetyBefore,
    safetyAfter,
    annualDollarsSaved,
    trapsDetected,
    trapsNeutralized,
    airGapLocked,
    sealed,
    digestHex,
    timestampSec,
    tone,
    docCategory
  };
}

function formatUsd(amount) {
  return "$" + Math.round(amount).toLocaleString("en-US");
}

function drawGearNotaryMedallion(ctx, cx, cy, radius, palette, norm, progress = 1) {
  const easeOutBack = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  const clamped = Math.max(0, Math.min(1, progress));
  const scale = clamped < 1 ? 1.24 - 0.24 * Math.min(1.06, easeOutBack(clamped)) : 1;
  const alpha = Math.min(1, clamped * 2.4);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  // Soft cast drop shadow beneath heavy brass die
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, radius * 0.045, radius * 0.96, 0, Math.PI * 2);
  ctx.fillStyle = palette.name === "midnight" ? "rgba(0,0,0,0.58)" : "rgba(28,25,23,0.22)";
  ctx.fill();
  ctx.restore();

  // Outer brass serrated gear teeth (28 teeth)
  const teeth = 28;
  const outerR = radius;
  const innerGearR = radius * 0.89;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i += 1) {
    const angle = (i * Math.PI) / teeth;
    const r = i % 2 === 0 ? outerR : innerGearR;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  const brassGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
  brassGrad.addColorStop(0, palette.brassBright);
  brassGrad.addColorStop(0.45, palette.brass);
  brassGrad.addColorStop(1, palette.brassDark);
  ctx.fillStyle = brassGrad;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, radius * 0.02);
  ctx.strokeStyle = palette.brassDark;
  ctx.stroke();

  // Concentric recessed brass ring
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.82, 0, Math.PI * 2);
  ctx.fillStyle = palette.name === "midnight" ? "#1B1610" : "#5B4218";
  ctx.fill();

  // Crimson wax medallion core
  const waxGrad = ctx.createRadialGradient(
    -radius * 0.18,
    -radius * 0.22,
    radius * 0.08,
    0,
    0,
    radius * 0.76
  );
  waxGrad.addColorStop(0, norm.sealed ? "#C82D38" : palette.crimson);
  waxGrad.addColorStop(0.65, palette.crimsonDeep);
  waxGrad.addColorStop(1, "#450A0E");

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.76, 0, Math.PI * 2);
  ctx.fillStyle = waxGrad;
  ctx.fill();

  // Embossed inner rope ring
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.65, 0, Math.PI * 2);
  ctx.setLineDash([radius * 0.045, radius * 0.03]);
  ctx.lineWidth = Math.max(1.2, radius * 0.018);
  ctx.strokeStyle = palette.brassBright;
  ctx.stroke();
  ctx.setLineDash([]);

  // Center shield / score crest
  ctx.fillStyle = "#FAF4E8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = `700 ${Math.round(radius * 0.11)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.fillStyle = palette.brassBright;
  ctx.fillText(norm.sealed ? "FARADAY SEALED" : "AUDIT PREVIEW", 0, -radius * 0.34);

  ctx.font = `700 ${Math.round(radius * 0.29)}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = "#FAF4E8";
  ctx.fillText(`${norm.safetyAfter}`, 0, -radius * 0.03);

  ctx.font = `600 ${Math.round(radius * 0.095)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.fillStyle = "#F3E5C8";
  ctx.fillText(`SAFETY (${norm.safetyBefore} -> ${norm.safetyAfter})`, 0, radius * 0.23);

  ctx.font = `600 ${Math.round(radius * 0.085)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.fillStyle = palette.brassBright;
  ctx.fillText(
    `${norm.airGapLocked ? "0.0 KB AIR-GAP" : "UNLOCKED"} • #${norm.digestHex.slice(0, 6)}`,
    0,
    radius * 0.42
  );

  ctx.restore();
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/**
 * Renders an animated weighted brass die wax seal onto the target canvas.
 * Strictly cancels any running rAF loop on completion or re-invocation.
 * @param {HTMLCanvasElement} canvas
 * @param {object} receiptData
 * @param {object} [options={}]
 */
export function renderFaradaySeal(canvas, receiptData, options = {}) {
  if (!canvas || typeof canvas.getContext !== "function") return;
  cancelCanvasRaf(canvas);

  const palette = resolveThemePalette(options.theme);
  const norm = normalizeReceipt(receiptData);
  const dpr = Math.max(1, Math.min(3, Number(options.dpr ?? globalThis.devicePixelRatio ?? 1) || 1));
  const logicalW = Number(options.width || canvas.clientWidth || canvas.width || 240) || 240;
  const logicalH = Number(options.height || canvas.clientHeight || canvas.height || 240) || 240;

  if (canvas.width !== Math.round(logicalW * dpr)) {
    canvas.width = Math.round(logicalW * dpr);
  }
  if (canvas.height !== Math.round(logicalH * dpr)) {
    canvas.height = Math.round(logicalH * dpr);
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cx = logicalW / 2;
  const cy = logicalH / 2;
  const radius = Math.min(logicalW, logicalH) * 0.41;

  const paintFrame = (progress) => {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalW, logicalH);

    // Subtle brass shockwave ring during impact phase (0.55..1.0)
    if (progress > 0.55 && progress < 1) {
      const shockT = (progress - 0.55) / 0.45;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (0.95 + shockT * 0.3), 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, 3 * (1 - shockT));
      ctx.strokeStyle = palette.brass;
      ctx.globalAlpha = (1 - shockT) * 0.55;
      ctx.stroke();
    }

    drawGearNotaryMedallion(ctx, cx, cy, radius, palette, norm, progress);
    ctx.restore();
  };

  const shouldAnimate =
    options.animate !== false &&
    typeof globalThis.requestAnimationFrame === "function" &&
    !prefersReducedMotion();

  if (!shouldAnimate) {
    paintFrame(1);
    options.onComplete?.();
    return;
  }

  const durationMs = 520;
  const startMs = typeof performance !== "undefined" ? performance.now() : Date.now();

  const step = (now) => {
    const elapsed = Math.max(0, (now || Date.now()) - startMs);
    const progress = Math.min(1, elapsed / durationMs);
    paintFrame(progress);

    if (progress < 1) {
      const rafId = globalThis.requestAnimationFrame(step);
      ACTIVE_RAFS.set(canvas, rafId);
    } else {
      ACTIVE_RAFS.delete(canvas);
      options.onComplete?.();
    }
  };

  const firstId = globalThis.requestAnimationFrame(step);
  ACTIVE_RAFS.set(canvas, firstId);
}

/**
 * Builds a high-DPI 1200x630 Vintage Faraday Brass & Cotton Vellum Audit Receipt Card.
 * @param {object} receiptData
 * @param {object} [options={}]
 * @returns {HTMLCanvasElement}
 */
export function buildVerificationCertificateCanvas(receiptData, options = {}) {
  const width = Number(options.width || 1200) || 1200;
  const height = Number(options.height || 630) || 630;
  const palette = resolveThemePalette(options.theme || "vellum");
  const norm = normalizeReceipt(receiptData);

  const canvas =
    options.canvas ||
    (typeof globalThis.document !== "undefined"
      ? globalThis.document.createElement("canvas")
      : null);

  if (!canvas || typeof canvas.getContext !== "function") {
    throw new Error("Canvas rendering context is unavailable");
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to acquire 2D canvas context");
  }

  // Base cotton vellum / anodized obsidian paper backdrop
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle archival fiber cross-hatch lines
  ctx.save();
  ctx.strokeStyle = palette.name === "midnight" ? "rgba(229,169,60,0.04)" : "rgba(28,25,23,0.035)";
  ctx.lineWidth = 1;
  for (let x = 24; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 24; y < height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // Outer brass guilloche ledger frame
  ctx.strokeStyle = palette.brass;
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.25;
  ctx.strokeRect(34, 34, width - 68, height - 68);

  // Corner brass rivets
  const corners = [
    [46, 46],
    [width - 46, 46],
    [46, height - 46],
    [width - 46, height - 46]
  ];
  for (const [rx, ry] of corners) {
    ctx.beginPath();
    ctx.arc(rx, ry, 5, 0, Math.PI * 2);
    ctx.fillStyle = palette.brass;
    ctx.fill();
  }

  // Left Folio Header
  ctx.fillStyle = palette.brass;
  ctx.font = '700 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("CLAUSEHOUND LOCAL  •  THE FARADAY BRASS DESK", 68, 64);

  ctx.fillStyle = palette.ink;
  ctx.font = '700 38px Georgia, "Times New Roman", serif';
  ctx.fillText("Bilateral Contract Audit Certificate", 68, 94);

  const docTitle = options.docTitle || `Agreement Folio (${norm.docCategory})`;
  ctx.fillStyle = palette.inkMuted;
  ctx.font = '500 20px Georgia, "Times New Roman", serif';
  ctx.fillText(String(docTitle).slice(0, 62), 68, 146);

  // Divider rule
  ctx.strokeStyle = palette.brass;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(68, 186);
  ctx.lineTo(790, 186);
  ctx.stroke();

  // 3 Primary Telemetry Cards
  const cardW = 228;
  const cardH = 152;
  const cardY = 214;
  const gap = 20;

  const cards = [
    {
      label: "SAFETY SCORE JUMP",
      value: `${norm.safetyBefore} -> ${norm.safetyAfter}`,
      sub: `Risk reduced ${norm.riskBefore} -> ${norm.riskAfter}`,
      accent: palette.emerald
    },
    {
      label: "ANNUALIZED SAVINGS",
      value: `${formatUsd(norm.annualDollarsSaved)}/yr`,
      sub: "Junk fees & traps excised",
      accent: palette.brass
    },
    {
      label: "AIR-GAP PROOF",
      value: norm.airGapLocked ? "0.0 KB" : "LOCAL",
      sub: norm.airGapLocked ? "Faraday cage verified locked" : "Manual unlock session",
      accent: norm.airGapLocked ? palette.emerald : palette.crimson
    }
  ];

  cards.forEach((card, idx) => {
    const cx = 68 + idx * (cardW + gap);
    drawRoundedRect(ctx, cx, cardY, cardW, cardH, 8);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = palette.border;
    ctx.stroke();

    // Accent bar
    ctx.fillStyle = card.accent;
    ctx.fillRect(cx + 16, cardY + 18, 36, 4);

    ctx.fillStyle = palette.inkMuted;
    ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillText(card.label, cx + 16, cardY + 34);

    ctx.fillStyle = card.accent;
    ctx.font = '700 32px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillText(card.value, cx + 16, cardY + 62);

    ctx.fillStyle = palette.inkMuted;
    ctx.font = '400 14px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(card.sub, cx + 16, cardY + 114);
  });

  // Audit ledger strip
  drawRoundedRect(ctx, 68, 392, 724, 114, 8);
  ctx.fillStyle = palette.surfaceAlt;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  const dateIso = new Date(norm.timestampSec * 1000).toISOString().slice(0, 19).replace("T", " ") + "Z";
  let receiptHash = options.receiptHash;
  if (!receiptHash) {
    try {
      receiptHash = encodeReceiptHash(norm);
    } catch {
      receiptHash = "#receipt=LOCAL";
    }
  }

  ctx.fillStyle = palette.ink;
  ctx.font = '600 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.fillText(
    `TRAPS NEUTRALIZED: ${norm.trapsNeutralized} / ${norm.trapsDetected}   •   TONE: ${norm.tone}`,
    88,
    414
  );
  ctx.fillText(
    `DOC DIGEST: 0x${norm.digestHex}   •   TIMESTAMP: ${dateIso}`,
    88,
    444
  );
  ctx.fillStyle = palette.inkMuted;
  ctx.font = '500 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.fillText(`ZERO-PII TOKEN: ${String(receiptHash).slice(0, 68)}`, 88, 474);

  // Brass Seal Medallion on Right
  drawGearNotaryMedallion(ctx, 986, 286, 146, palette, norm, 1);

  // Footer Watermark
  ctx.fillStyle = palette.inkMuted;
  ctx.font = '600 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.fillText(`VERIFIABLE ZERO-BACKEND AUDIT  •  ${WATERMARK_URL}`, 68, 546);

  ctx.textAlign = "right";
  ctx.fillStyle = palette.brass;
  ctx.fillText("100% CLIENT-SIDE FARADAY EXECUTION", width - 68, 546);

  return canvas;
}

/**
 * Exports a rendered HTMLCanvasElement to a PNG Blob.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
export async function exportSealPngBlob(canvas) {
  if (!canvas) {
    throw new TypeError("exportSealPngBlob requires a canvas element");
  }
  if (typeof canvas.toBlob === "function") {
    const blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("Canvas PNG encoding returned null"));
        }, "image/png");
      } catch (err) {
        reject(err);
      }
    });
    return blob;
  }
  if (typeof canvas.toDataURL === "function" && typeof Blob === "function") {
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1] || "";
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new Blob([bytes], { type: "image/png" });
  }
  throw new Error("Canvas PNG export APIs are unavailable");
}

/**
 * Plays a short 60fps tactile paper-curl & brass spark burst on an overlay canvas.
 * Cancels cleanly at completion so idle FPS incurs zero overhead.
 * @param {HTMLCanvasElement} canvas
 * @param {"vellum"|"midnight"} [theme="vellum"]
 * @param {() => void} [onComplete]
 */
export function renderPaperCurlBurst(canvas, theme = "vellum", onComplete) {
  if (!canvas || typeof canvas.getContext !== "function") {
    onComplete?.();
    return;
  }
  cancelCanvasRaf(canvas);

  const palette = resolveThemePalette(theme);
  const w = canvas.clientWidth || canvas.width || 420;
  const h = canvas.clientHeight || canvas.height || 180;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx || typeof globalThis.requestAnimationFrame !== "function" || prefersReducedMotion()) {
    ctx?.clearRect?.(0, 0, w, h);
    onComplete?.();
    return;
  }

  const fragments = Array.from({ length: 14 }, (_, i) => {
    const angle = (-Math.PI / 2) + ((i - 6.5) / 7) * 1.15;
    const speed = 95 + (i % 4) * 38;
    return {
      x: w * (0.2 + (i % 7) * 0.1),
      y: h * 0.55,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      rot: (i * 0.7) % Math.PI,
      vRot: (i % 2 === 0 ? 1 : -1) * 5.2,
      size: 6 + (i % 3) * 3,
      isBrass: i % 4 === 0
    };
  });

  const durationMs = 420;
  const startMs = typeof performance !== "undefined" ? performance.now() : Date.now();

  const frame = (now) => {
    const elapsed = Math.max(0, (now || Date.now()) - startMs);
    const t = Math.min(1, elapsed / durationMs);
    const dt = elapsed / 1000;

    ctx.clearRect(0, 0, w, h);

    if (t >= 1) {
      ACTIVE_RAFS.delete(canvas);
      onComplete?.();
      return;
    }

    const alpha = 1 - t * t;
    for (const frag of fragments) {
      const px = frag.x + frag.vx * dt;
      const py = frag.y + frag.vy * dt + 220 * dt * dt;
      const rot = frag.rot + frag.vRot * dt;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = frag.isBrass ? palette.brass : palette.surface;
      ctx.strokeStyle = frag.isBrass ? palette.brassDark : palette.crimson;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(-frag.size, -frag.size * 0.55, frag.size * 2, frag.size * 1.1);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const rafId = globalThis.requestAnimationFrame(frame);
    ACTIVE_RAFS.set(canvas, rafId);
  };

  const firstId = globalThis.requestAnimationFrame(frame);
  ACTIVE_RAFS.set(canvas, firstId);
}

/**
 * Plays a warm-amber 60fps optical scanner sweep over a document folio overlay canvas.
 * Strictly terminates its rAF loop upon completion.
 * @param {HTMLCanvasElement} canvas
 * @param {"vellum"|"midnight"} [theme="vellum"]
 * @param {() => void} [onComplete]
 */
export function renderOpticalSweep(canvas, theme = "vellum", onComplete) {
  if (!canvas || typeof canvas.getContext !== "function") {
    onComplete?.();
    return;
  }
  cancelCanvasRaf(canvas);

  const palette = resolveThemePalette(theme);
  const w = canvas.clientWidth || canvas.width || 600;
  const h = canvas.clientHeight || canvas.height || 520;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx || typeof globalThis.requestAnimationFrame !== "function" || prefersReducedMotion()) {
    ctx?.clearRect?.(0, 0, w, h);
    onComplete?.();
    return;
  }

  const durationMs = 640;
  const startMs = typeof performance !== "undefined" ? performance.now() : Date.now();

  const frame = (now) => {
    const elapsed = Math.max(0, (now || Date.now()) - startMs);
    const t = Math.min(1, elapsed / durationMs);

    ctx.clearRect(0, 0, w, h);

    if (t >= 1) {
      ACTIVE_RAFS.delete(canvas);
      onComplete?.();
      return;
    }

    const eased = 1 - Math.pow(1 - t, 2.2);
    const scanY = eased * h;
    const trailH = 84;

    const grad = ctx.createLinearGradient(0, Math.max(0, scanY - trailH), 0, scanY + 6);
    grad.addColorStop(0, "rgba(229, 169, 60, 0)");
    grad.addColorStop(0.78, palette.name === "midnight" ? "rgba(229, 169, 60, 0.22)" : "rgba(182, 141, 64, 0.18)");
    grad.addColorStop(0.96, palette.name === "midnight" ? "rgba(229, 169, 60, 0.72)" : "rgba(182, 141, 64, 0.55)");
    grad.addColorStop(1, "rgba(229, 169, 60, 0)");

    ctx.fillStyle = grad;
    ctx.fillRect(0, Math.max(0, scanY - trailH), w, trailH + 6);

    ctx.strokeStyle = palette.brass;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(w, scanY);
    ctx.stroke();

    // Subtle brass reticle readout tick
    ctx.fillStyle = palette.brass;
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillText(`OPTICAL AUDIT ${Math.round(t * 100)}%`, Math.max(12, w - 148), Math.max(14, scanY - 8));

    const rafId = globalThis.requestAnimationFrame(frame);
    ACTIVE_RAFS.set(canvas, rafId);
  };

  const firstId = globalThis.requestAnimationFrame(frame);
  ACTIVE_RAFS.set(canvas, firstId);
}
