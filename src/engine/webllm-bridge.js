/**
 * ClauseHound Local — Faraday-Guarded WebGPU Local Inference Bridge
 * Dynamically sorts runtime-discovered local model catalogs strictly by VRAM ascending
 * and guarantees 100% deterministic parity fallback with zero hardcoded model names or URLs.
 */

import { isAirGapLocked, FaradayAirGapError } from "../security/faraday-airgap.js";
import { generateRedline } from "./redline-engine.js";

function createAirGapBlockedError(message, modelId) {
  const target = modelId || "local-webgpu-cache";
  const err = new FaradayAirGapError(message, { api: "webllm", url: target });
  if (typeof err.api !== "string" || err.api === "unknown") {
    err.api = "webllm";
  }
  if (typeof err.url !== "string" || err.url.length === 0) {
    err.url = target;
  }
  return err;
}

/**
 * Probes browser WebGPU hardware availability and conservative usable VRAM budget.
 * Never throws in headless, Node, or non-WebGPU browsers.
 * @param {object} [nav]
 * @returns {Promise<{ supported: boolean, adapterInfo: Record<string, unknown> | null, maxBufferSizeMB: number, estimatedVramMB: number }>}
 */
export async function detectWebGpuCapability(nav = globalThis.navigator) {
  const fallback = {
    supported: false,
    adapterInfo: null,
    maxBufferSizeMB: 0,
    estimatedVramMB: 0
  };

  try {
    if (!nav || !nav.gpu || typeof nav.gpu.requestAdapter !== "function") {
      return fallback;
    }

    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
      return fallback;
    }

    let adapterInfo = null;
    if (adapter.info && typeof adapter.info === "object") {
      adapterInfo = { ...adapter.info };
    } else if (typeof adapter.requestAdapterInfo === "function") {
      try {
        const info = await adapter.requestAdapterInfo();
        if (info && typeof info === "object") {
          adapterInfo = { ...info };
        }
      } catch {
        adapterInfo = null;
      }
    }

    const maxBufferBytes = Number(adapter.limits?.maxBufferSize) || 0;
    const maxBufferSizeMB =
      maxBufferBytes > 0 ? Math.floor(maxBufferBytes / (1024 * 1024)) : 0;

    let estimatedVramMB = maxBufferSizeMB;
    if (Number.isFinite(Number(adapterInfo?.estimatedVramMB)) && Number(adapterInfo.estimatedVramMB) > 0) {
      estimatedVramMB = Math.floor(Number(adapterInfo.estimatedVramMB));
    } else if (Number.isFinite(Number(nav.deviceMemory)) && Number(nav.deviceMemory) > 0) {
      const memEstimate = Math.floor(Number(nav.deviceMemory) * 512);
      estimatedVramMB = maxBufferSizeMB > 0 ? Math.max(maxBufferSizeMB, Math.min(memEstimate, maxBufferSizeMB * 4)) : memEstimate;
    }

    return {
      supported: true,
      adapterInfo,
      maxBufferSizeMB,
      estimatedVramMB
    };
  } catch {
    return fallback;
  }
}

/**
 * Sorts a runtime-discovered model catalog strictly ascending by numeric `vram_required_MB`
 * and selects the highest-tier entry fitting within `capability.estimatedVramMB`
 * (or the smallest `vram_required_MB` entry as constrained fallback).
 * @param {Array<{ model_id: string, vram_required_MB: number, low_resource_required?: boolean }>} modelList
 * @param {{ estimatedVramMB?: number }} capability
 * @returns {{ sortedCatalog: Array<object>, recommended: object | null }}
 */
export function selectOptimalLocalModel(modelList, capability = { estimatedVramMB: 0 }) {
  if (!Array.isArray(modelList) || modelList.length === 0) {
    return { sortedCatalog: [], recommended: null };
  }

  const valid = modelList
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.model_id === "string" &&
        entry.model_id.trim().length > 0 &&
        typeof entry.vram_required_MB === "number" &&
        Number.isFinite(entry.vram_required_MB) &&
        entry.vram_required_MB >= 0
    )
    .map((entry) => ({ ...entry }));

  if (valid.length === 0) {
    return { sortedCatalog: [], recommended: null };
  }

  valid.sort((a, b) => {
    if (a.vram_required_MB !== b.vram_required_MB) {
      return a.vram_required_MB - b.vram_required_MB;
    }
    const lowA = a.low_resource_required ? 1 : 0;
    const lowB = b.low_resource_required ? 1 : 0;
    if (lowB !== lowA) return lowB - lowA;
    return a.model_id.localeCompare(b.model_id);
  });

  const budget =
    typeof capability?.estimatedVramMB === "number" && Number.isFinite(capability.estimatedVramMB)
      ? capability.estimatedVramMB
      : 0;

  let recommended = valid[0];
  for (let i = 0; i < valid.length; i += 1) {
    if (valid[i].vram_required_MB <= budget) {
      recommended = valid[i];
    } else {
      break;
    }
  }

  return {
    sortedCatalog: valid,
    recommended
  };
}

/**
 * Creates a Faraday-guarded local inference controller with deterministic fallback parity.
 * @param {object} [env]
 * @returns {{ probe: Function, loadModel: Function, explainClause: Function, unload: Function, getStatus: Function }}
 */
export function createWebLlmBridge(env = {}) {
  const nav = Object.prototype.hasOwnProperty.call(env, "navigator")
    ? env.navigator
    : globalThis.navigator;
  const checkAirGapLocked =
    typeof env.isAirGapLocked === "function" ? env.isAirGapLocked : isAirGapLocked;
  const getModelList =
    typeof env.getModelList === "function"
      ? env.getModelList
      : () => (Array.isArray(env.modelList) ? env.modelList : []);
  const runtimeLoader = typeof env.runtimeLoader === "function" ? env.runtimeLoader : null;

  let status = "idle";
  let capability = {
    supported: false,
    adapterInfo: null,
    maxBufferSizeMB: 0,
    estimatedVramMB: 0
  };
  let activeModel = null;
  let activeEngine = null;
  let cachedFlag = false;
  let lastError = null;

  async function checkModelCached(modelId) {
    if (!modelId) return false;
    if (typeof env.isModelCached === "function") {
      return Boolean(await env.isModelCached(modelId));
    }
    try {
      const cacheStorage = env.caches || globalThis.caches;
      if (!cacheStorage || typeof cacheStorage.keys !== "function") {
        return false;
      }
      const names = await cacheStorage.keys();
      for (const name of names) {
        const cache = await cacheStorage.open(name);
        const entries = await cache.keys();
        if (entries.some((req) => String(req?.url || req).includes(modelId))) {
          return true;
        }
      }
    } catch {
      return false;
    }
    return false;
  }

  async function probe(overrideList) {
    capability = await detectWebGpuCapability(nav);
    const catalogSource = Array.isArray(overrideList) ? overrideList : await getModelList();
    const { sortedCatalog, recommended } = selectOptimalLocalModel(catalogSource, capability);
    const airGapLocked = Boolean(checkAirGapLocked());
    if (!capability.supported) {
      status = "fallback";
    } else if (activeEngine) {
      status = "ready";
    }
    return {
      capability: { ...capability },
      sortedCatalog,
      recommended,
      airGapLocked
    };
  }

  async function loadModel(options = {}) {
    lastError = null;
    const probeResult = await probe(options.modelList);
    const requestedId = typeof options.modelId === "string" ? options.modelId : "";
    const targetModel = requestedId
      ? probeResult.sortedCatalog.find((m) => m.model_id === requestedId) || {
          model_id: requestedId,
          vram_required_MB: 0
        }
      : probeResult.recommended;

    const targetId = targetModel?.model_id || "";
    cachedFlag = await checkModelCached(targetId);
    const locked = Boolean(checkAirGapLocked());

    // Strict Faraday rule: never permit uncached artifact downloads while air-gap is locked
    if (locked && !cachedFlag) {
      status = "blocked";
      const err = createAirGapBlockedError(
        "Faraday Air-Gap is locked and local WebGPU model weights are not cached. Unlock temporarily to cache weights or use deterministic local counsel.",
        targetId
      );
      lastError = err.message;
      throw err;
    }

    if (!probeResult.capability.supported || !runtimeLoader || !targetModel) {
      status = "fallback";
      activeModel = targetModel;
      activeEngine = null;
      return {
        loaded: false,
        mode: "deterministic-fallback",
        model: targetModel,
        reason: !probeResult.capability.supported
          ? "webgpu-unsupported"
          : !runtimeLoader
            ? "runtime-skipped"
            : "empty-catalog"
      };
    }

    status = "loading";
    try {
      activeEngine = await runtimeLoader(targetModel, options.onProgress);
      activeModel = targetModel;
      cachedFlag = true;
      status = activeEngine ? "ready" : "fallback";
      return {
        loaded: Boolean(activeEngine),
        mode: activeEngine ? "webgpu" : "deterministic-fallback",
        model: targetModel
      };
    } catch (err) {
      activeEngine = null;
      status = "fallback";
      lastError = err?.message || "Local WebGPU runtime initialization skipped.";
      return {
        loaded: false,
        mode: "deterministic-fallback",
        model: targetModel,
        reason: lastError
      };
    }
  }

  async function explainClause(finding, tone = "bilateral", options = {}) {
    const baseline = generateRedline(finding, tone, options.context);
    const useLocalModel = options.useLocalModel !== false;

    if (activeEngine && useLocalModel) {
      try {
        if (typeof activeEngine.explain === "function") {
          const out = await activeEngine.explain({
            finding,
            tone: baseline.tone,
            baseline
          });
          if (out && typeof out.replacementText === "string") {
            return {
              mode: "webgpu",
              ruleId: baseline.ruleId,
              tone: baseline.tone,
              summary: out.summary || baseline.rationale,
              replacementText: out.replacementText,
              rationale: out.rationale || baseline.rationale,
              modelId: activeModel?.model_id || null
            };
          }
        } else if (typeof activeEngine.chat?.completions?.create === "function") {
          const prompt = `Explain and provide a ${baseline.tone} counter-clause for: ${finding?.matchText || baseline.ruleId}`;
          const completion = await activeEngine.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1
          });
          const content = completion?.choices?.[0]?.message?.content;
          if (typeof content === "string" && content.trim().length > 0) {
            return {
              mode: "webgpu",
              ruleId: baseline.ruleId,
              tone: baseline.tone,
              summary: content.trim(),
              replacementText: baseline.replacementText,
              rationale: baseline.rationale,
              modelId: activeModel?.model_id || null
            };
          }
        }
      } catch (err) {
        lastError = err?.message || null;
      }
    }

    return {
      mode: "deterministic-fallback",
      ruleId: baseline.ruleId,
      tone: baseline.tone,
      summary: baseline.rationale,
      replacementText: baseline.replacementText,
      rationale: baseline.rationale,
      cachedOnly: true
    };
  }

  async function unload() {
    if (activeEngine && typeof activeEngine.unload === "function") {
      try {
        await activeEngine.unload();
      } catch {
        // Ignore teardown noise
      }
    }
    activeEngine = null;
    activeModel = null;
    cachedFlag = false;
    status = capability.supported ? "idle" : "fallback";
  }

  function getStatus() {
    return {
      supported: capability.supported,
      capability: { ...capability },
      status,
      activeModel: activeModel ? { ...activeModel } : null,
      cached: cachedFlag,
      airGapLocked: Boolean(checkAirGapLocked()),
      lastError
    };
  }

  return {
    probe,
    loadModel,
    explainClause,
    unload,
    getStatus
  };
}
