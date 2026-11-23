/**
 * ClauseHound Local — Tri-Store Bidirectional Self-Healing Vault
 * Persists VaultState across localStorage, IndexedDB, and a compact cookie micro-vault.
 */

export const COOKIE_VAULT_NAME = "krunked-cookie-vault-v1";
export const LS_VAULT_KEY = "clausehound_vault_v1";
export const IDB_DB_NAME = "ClauseHoundVaultDB";
export const IDB_STORE_NAME = "vault";

const IDB_PRIMARY_KEY = "primary";
const COOKIE_ATTRS = "path=/; SameSite=Lax; max-age=31536000";
const MAX_COOKIE_VALUE_BYTES = 3199;

const VALID_THEMES = new Set(["vellum", "midnight"]);
const VALID_TONES = new Set(["collaborative", "bilateral", "counsel"]);
const BUILTIN_SPECIMEN_IDS = new Set([
  "sterling-lease",
  "apex-nda",
  "cobalt-saas-msa",
  "oakridge-hoa",
  "custom-draft"
]);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/**
 * Returns today's ISO calendar date ("YYYY-MM-DD").
 * @param {() => Date} [nowFn]
 * @returns {string}
 */
function getTodayIsoDate(nowFn) {
  const d = typeof nowFn === "function" ? nowFn() : new Date();
  return d.toISOString().slice(0, 10);
}

/**
 * Produces deterministic recursive canonical JSON for FNV-1a32 integrity hashing.
 * Strips top-level `checksum` before serialization.
 * @param {unknown} value
 * @param {boolean} [isRoot=false]
 * @returns {string}
 */
function canonicalizeValue(value, isRoot = false) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }
  if (Array.isArray(value)) {
    const items = value.map((entry) =>
      entry === undefined || typeof entry === "function" || typeof entry === "symbol"
        ? "null"
        : canonicalizeValue(entry, false)
    );
    return `[${items.join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value)
      .filter((k) => {
        if (isRoot && k === "checksum") return false;
        const prop = value[k];
        return prop !== undefined && typeof prop !== "function" && typeof prop !== "symbol";
      })
      .sort();
    const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalizeValue(value[k], false)}`);
    return `{${pairs.join(",")}}`;
  }
  return "null";
}

/**
 * Computes an 8-character lowercase hex FNV-1a32 checksum over canonical JSON
 * (excluding top-level `checksum`).
 * @param {Record<string, unknown>} stateWithoutChecksum
 * @returns {string}
 */
export function computeVaultChecksum(stateWithoutChecksum) {
  const input =
    stateWithoutChecksum && typeof stateWithoutChecksum === "object" ? stateWithoutChecksum : {};
  const canonical = canonicalizeValue(input, true);
  const bytes = textEncoder.encode(canonical);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function cloneRuleMap(rawMap) {
  const out = {};
  if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) return out;
  for (const [docId, rules] of Object.entries(rawMap)) {
    if (typeof docId !== "string" || !Array.isArray(rules)) continue;
    const seen = new Set();
    const cleaned = [];
    for (const ruleId of rules) {
      if (typeof ruleId === "string" && ruleId.length > 0 && !seen.has(ruleId)) {
        seen.add(ruleId);
        cleaned.push(ruleId);
      }
    }
    out[docId] = cleaned;
  }
  return out;
}

function cloneBooleanMap(rawMap) {
  const out = {};
  if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) return out;
  for (const [key, val] of Object.entries(rawMap)) {
    if (typeof key === "string" && key.length > 0 && typeof val === "boolean") {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Deep-clones a VaultState so callers cannot mutate internal controller state.
 * @param {object} state
 * @returns {object}
 */
export function cloneVaultState(state) {
  const ruleMap = {};
  for (const [docId, rules] of Object.entries(state.neutralizedRuleMap || {})) {
    ruleMap[docId] = Array.isArray(rules) ? [...rules] : [];
  }
  return {
    version: 1,
    theme: state.theme,
    asmrMixLevel: state.asmrMixLevel,
    defaultTone: state.defaultTone,
    airGapLocked: state.airGapLocked,
    activeSpecimenId: state.activeSpecimenId,
    dailyStreakDate: state.dailyStreakDate,
    lifetimeTrapsNeutralized: state.lifetimeTrapsNeutralized,
    lifetimeAnnualDollarsSaved: state.lifetimeAnnualDollarsSaved,
    selfHealRecoveries: state.selfHealRecoveries,
    neutralizedRuleMap: ruleMap,
    excisedFeeMap: { ...(state.excisedFeeMap || {}) },
    sealStampedMap: { ...(state.sealStampedMap || {}) },
    checksum: state.checksum
  };
}

/**
 * Normalizes a partial or full vault object into a complete checksummed VaultState.
 * @param {object} [raw]
 * @param {() => Date} [nowFn]
 * @returns {object}
 */
export function normalizeVaultState(raw = {}, nowFn) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const mixRaw = Number(src.asmrMixLevel);
  const asmrMixLevel = Number.isFinite(mixRaw)
    ? Math.min(1, Math.max(0, mixRaw))
    : 0.32;
  const trapsRaw = Number(src.lifetimeTrapsNeutralized);
  const dollarsRaw = Number(src.lifetimeAnnualDollarsSaved);
  const healsRaw = Number(src.selfHealRecoveries);
  const streak =
    typeof src.dailyStreakDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(src.dailyStreakDate)
      ? src.dailyStreakDate
      : getTodayIsoDate(nowFn);

  const body = {
    version: 1,
    theme: VALID_THEMES.has(src.theme) ? src.theme : "vellum",
    asmrMixLevel,
    defaultTone: VALID_TONES.has(src.defaultTone) ? src.defaultTone : "bilateral",
    airGapLocked: typeof src.airGapLocked === "boolean" ? src.airGapLocked : true,
    activeSpecimenId:
      typeof src.activeSpecimenId === "string" && src.activeSpecimenId.trim().length > 0
        ? src.activeSpecimenId
        : "sterling-lease",
    dailyStreakDate: streak,
    lifetimeTrapsNeutralized:
      Number.isFinite(trapsRaw) && trapsRaw >= 0 ? Math.floor(trapsRaw) : 0,
    lifetimeAnnualDollarsSaved:
      Number.isFinite(dollarsRaw) && dollarsRaw >= 0 ? Math.round(dollarsRaw * 100) / 100 : 0,
    selfHealRecoveries:
      Number.isFinite(healsRaw) && healsRaw >= 0 ? Math.floor(healsRaw) : 0,
    neutralizedRuleMap: cloneRuleMap(src.neutralizedRuleMap),
    excisedFeeMap: cloneBooleanMap(src.excisedFeeMap),
    sealStampedMap: cloneBooleanMap(src.sealStampedMap)
  };

  return {
    ...body,
    checksum: computeVaultChecksum(body)
  };
}

/**
 * Strictly validates an unknown candidate against the VaultState schema and FNV-1a32 checksum.
 * Returns normalized cloned VaultState or null if missing, malformed, or checksum-tampered.
 * @param {unknown} candidate
 * @returns {object | null}
 */
export function validateVaultState(candidate) {
  let obj = candidate;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  if (obj.version !== 1) return null;
  if (!VALID_THEMES.has(obj.theme)) return null;
  if (
    typeof obj.asmrMixLevel !== "number" ||
    !Number.isFinite(obj.asmrMixLevel) ||
    obj.asmrMixLevel < 0 ||
    obj.asmrMixLevel > 1
  ) {
    return null;
  }
  if (!VALID_TONES.has(obj.defaultTone)) return null;
  if (typeof obj.airGapLocked !== "boolean") return null;
  if (typeof obj.activeSpecimenId !== "string" || obj.activeSpecimenId.length === 0) return null;
  if (typeof obj.dailyStreakDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(obj.dailyStreakDate)) {
    return null;
  }
  if (
    typeof obj.lifetimeTrapsNeutralized !== "number" ||
    !Number.isFinite(obj.lifetimeTrapsNeutralized) ||
    obj.lifetimeTrapsNeutralized < 0
  ) {
    return null;
  }
  if (
    typeof obj.lifetimeAnnualDollarsSaved !== "number" ||
    !Number.isFinite(obj.lifetimeAnnualDollarsSaved) ||
    obj.lifetimeAnnualDollarsSaved < 0
  ) {
    return null;
  }
  if (
    typeof obj.selfHealRecoveries !== "number" ||
    !Number.isFinite(obj.selfHealRecoveries) ||
    obj.selfHealRecoveries < 0
  ) {
    return null;
  }
  if (
    !obj.neutralizedRuleMap ||
    typeof obj.neutralizedRuleMap !== "object" ||
    Array.isArray(obj.neutralizedRuleMap)
  ) {
    return null;
  }
  for (const arr of Object.values(obj.neutralizedRuleMap)) {
    if (!Array.isArray(arr) || !arr.every((item) => typeof item === "string")) {
      return null;
    }
  }
  if (
    !obj.excisedFeeMap ||
    typeof obj.excisedFeeMap !== "object" ||
    Array.isArray(obj.excisedFeeMap)
  ) {
    return null;
  }
  for (const val of Object.values(obj.excisedFeeMap)) {
    if (typeof val !== "boolean") return null;
  }
  if (
    !obj.sealStampedMap ||
    typeof obj.sealStampedMap !== "object" ||
    Array.isArray(obj.sealStampedMap)
  ) {
    return null;
  }
  for (const val of Object.values(obj.sealStampedMap)) {
    if (typeof val !== "boolean") return null;
  }
  if (typeof obj.checksum !== "string" || !/^[0-9a-f]{8}$/i.test(obj.checksum)) {
    return null;
  }

  const expected = computeVaultChecksum(obj);
  if (obj.checksum.toLowerCase() !== expected) {
    return null;
  }
  return cloneVaultState({ ...obj, checksum: expected });
}

function freezeVaultState(state) {
  for (const arr of Object.values(state.neutralizedRuleMap)) {
    Object.freeze(arr);
  }
  Object.freeze(state.neutralizedRuleMap);
  Object.freeze(state.excisedFeeMap);
  Object.freeze(state.sealStampedMap);
  return Object.freeze(state);
}

export const DEFAULT_VAULT_STATE = freezeVaultState(normalizeVaultState({}));

function encodeBase64Url(bytes) {
  let binary = "";
  const chunkSize = 0x4000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(str) {
  if (typeof str !== "string" || str.length === 0 || !/^[A-Za-z0-9\-_]+$/.test(str)) {
    return null;
  }
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function toShortPayload(state) {
  const ef = {};
  for (const [k, v] of Object.entries(state.excisedFeeMap)) {
    ef[k] = v ? 1 : 0;
  }
  const ss = {};
  for (const [k, v] of Object.entries(state.sealStampedMap)) {
    ss[k] = v ? 1 : 0;
  }
  return {
    v: state.version,
    t: state.theme === "midnight" ? "m" : "v",
    a: state.asmrMixLevel,
    o: state.defaultTone === "collaborative" ? "c" : state.defaultTone === "counsel" ? "n" : "b",
    g: state.airGapLocked ? 1 : 0,
    s: state.activeSpecimenId,
    d: state.dailyStreakDate,
    lt: state.lifetimeTrapsNeutralized,
    ld: state.lifetimeAnnualDollarsSaved,
    sr: state.selfHealRecoveries,
    nr: state.neutralizedRuleMap,
    ef,
    ss,
    c: state.checksum
  };
}

function serializeShortCookie(state) {
  const json = JSON.stringify(toShortPayload(state));
  return encodeBase64Url(textEncoder.encode(json));
}

function trimOldestRuleEntry(ruleMap) {
  const keys = Object.keys(ruleMap);
  if (keys.length === 0) return false;
  const customKeys = keys.filter((k) => !BUILTIN_SPECIMEN_IDS.has(k));
  const targetKey = customKeys.length > 0 ? customKeys[0] : keys[0];
  if (keys.length > 1 || customKeys.length > 0) {
    if (customKeys.length > 1 || (customKeys.length === 1 && keys.length > 1)) {
      delete ruleMap[targetKey];
      return true;
    }
  }
  const arr = ruleMap[targetKey];
  if (Array.isArray(arr) && arr.length > 1) {
    arr.shift();
    return true;
  }
  delete ruleMap[targetKey];
  return true;
}

function trimOldestBooleanEntry(mapObj) {
  const keys = Object.keys(mapObj);
  if (keys.length === 0) return false;
  const customKeys = keys.filter((k) => !BUILTIN_SPECIMEN_IDS.has(k));
  const targetKey = customKeys.length > 0 ? customKeys[0] : keys[0];
  delete mapObj[targetKey];
  return true;
}

/**
 * Encodes a VaultState into compact short-key UTF-8 Base64url representation.
 * Trims oldest custom entries in `neutralizedRuleMap` (and secondary maps if needed)
 * so encoded length remains strictly < 3200 bytes while preserving a valid checksum.
 * @param {object} state
 * @returns {string}
 */
export function encodeCookiePayload(state) {
  const working = normalizeVaultState(state);
  let encoded = serializeShortCookie(working);
  if (encoded.length <= MAX_COOKIE_VALUE_BYTES) {
    return encoded;
  }

  let mutated = false;
  while (encoded.length > MAX_COOKIE_VALUE_BYTES) {
    const trimmed =
      trimOldestRuleEntry(working.neutralizedRuleMap) ||
      trimOldestBooleanEntry(working.excisedFeeMap) ||
      trimOldestBooleanEntry(working.sealStampedMap);
    if (!trimmed) {
      if (working.activeSpecimenId.length > 48) {
        working.activeSpecimenId = working.activeSpecimenId.slice(0, 48);
      } else {
        break;
      }
    }
    mutated = true;
    working.checksum = computeVaultChecksum(working);
    encoded = serializeShortCookie(working);
  }

  if (mutated && encoded.length <= MAX_COOKIE_VALUE_BYTES) {
    return encoded;
  }
  return encoded;
}

/**
 * Decodes and checksum-verifies a compact cookie micro-vault string.
 * @param {string} encoded
 * @returns {object | null}
 */
export function decodeCookiePayload(encoded) {
  if (typeof encoded !== "string" || encoded.length === 0 || encoded.length >= 3500) {
    return null;
  }
  const bytes = decodeBase64Url(encoded);
  if (!bytes) return null;

  let parsed;
  try {
    parsed = JSON.parse(textDecoder.decode(bytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (parsed.v !== 1) return null;

  const theme = parsed.t === "m" ? "midnight" : parsed.t === "v" ? "vellum" : null;
  const defaultTone =
    parsed.o === "c"
      ? "collaborative"
      : parsed.o === "b"
        ? "bilateral"
        : parsed.o === "n"
          ? "counsel"
          : null;
  if (!theme || !defaultTone) return null;
  if (parsed.g !== 0 && parsed.g !== 1) return null;
  if (
    !parsed.ef ||
    typeof parsed.ef !== "object" ||
    Array.isArray(parsed.ef) ||
    !parsed.ss ||
    typeof parsed.ss !== "object" ||
    Array.isArray(parsed.ss)
  ) {
    return null;
  }

  const excisedFeeMap = {};
  for (const [k, val] of Object.entries(parsed.ef)) {
    if (val !== 0 && val !== 1 && typeof val !== "boolean") return null;
    excisedFeeMap[k] = Boolean(val);
  }

  const sealStampedMap = {};
  for (const [k, val] of Object.entries(parsed.ss)) {
    if (val !== 0 && val !== 1 && typeof val !== "boolean") return null;
    sealStampedMap[k] = Boolean(val);
  }

  const expanded = {
    version: 1,
    theme,
    asmrMixLevel: parsed.a,
    defaultTone,
    airGapLocked: parsed.g === 1,
    activeSpecimenId: parsed.s,
    dailyStreakDate: parsed.d,
    lifetimeTrapsNeutralized: parsed.lt,
    lifetimeAnnualDollarsSaved: parsed.ld,
    selfHealRecoveries: parsed.sr,
    neutralizedRuleMap: parsed.nr,
    excisedFeeMap,
    sealStampedMap,
    checksum: parsed.c
  };

  return validateVaultState(expanded);
}

function extractCookieByName(cookieString, name) {
  if (typeof cookieString !== "string" || cookieString.length === 0) return null;
  const parts = cookieString.split(";");
  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    if (key === name) {
      return part.slice(eqIndex + 1).trim();
    }
  }
  return null;
}

function createBrowserIdbAdapter() {
  if (typeof globalThis.indexedDB === "undefined") {
    return {
      async get() {
        return null;
      },
      async set() {}
    };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      try {
        const request = globalThis.indexedDB.open(IDB_DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
        request.onblocked = () => reject(new Error("IndexedDB open blocked"));
      } catch (err) {
        reject(err);
      }
    });
  }

  return {
    async get(key) {
      let db;
      try {
        db = await openDatabase();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE_NAME, "readonly");
          const store = tx.objectStore(IDB_STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => reject(req.error || new Error("IndexedDB get failed"));
        });
      } catch {
        return null;
      } finally {
        try {
          db?.close?.();
        } catch {
          // ignore close errors
        }
      }
    },
    async set(key, value) {
      let db;
      try {
        db = await openDatabase();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE_NAME, "readwrite");
          const store = tx.objectStore(IDB_STORE_NAME);
          const req = store.put(value, key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error || new Error("IndexedDB set failed"));
        });
      } catch {
        // graceful fallback if IndexedDB quota or private mode blocks writes
      } finally {
        try {
          db?.close?.();
        } catch {
          // ignore close errors
        }
      }
    }
  };
}

function createDefaultStorageAdapter() {
  return {
    getItem(key) {
      try {
        return globalThis.localStorage?.getItem?.(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        globalThis.localStorage?.setItem?.(key, value);
      } catch {
        // ignore storage quota errors
      }
    }
  };
}

function emitCustomEvent(dispatchFn, name, detail) {
  if (typeof dispatchFn !== "function") return;
  try {
    const event =
      typeof CustomEvent === "function"
        ? new CustomEvent(name, { detail })
        : { type: name, detail };
    dispatchFn(event);
  } catch {
    // ignore dispatch failures in restricted environments
  }
}

function selectFresherState(lsState, idbState) {
  const lsScore =
    lsState.lifetimeTrapsNeutralized + lsState.lifetimeAnnualDollarsSaved + lsState.selfHealRecoveries;
  const idbScore =
    idbState.lifetimeTrapsNeutralized +
    idbState.lifetimeAnnualDollarsSaved +
    idbState.selfHealRecoveries;
  return idbScore > lsScore ? idbState : lsState;
}

/**
 * Creates a self-healing vault controller bound to browser globals or injectable mocks.
 * @param {object} [env={}]
 */
export function createVaultController(env = {}) {
  const hasCustomStores =
    env.storage !== undefined ||
    env.idb !== undefined ||
    env.getCookie !== undefined ||
    env.setCookie !== undefined;

  const storage = env.storage ?? createDefaultStorageAdapter();
  const idb = env.idb ?? createBrowserIdbAdapter();
  const nowFn = env.now;

  const readRawCookie = () => {
    try {
      if (typeof env.getCookie === "function") {
        const res = env.getCookie(COOKIE_VAULT_NAME);
        if (typeof res !== "string" || res.length === 0) return null;
        if (res.includes("=")) {
          return extractCookieByName(res, COOKIE_VAULT_NAME);
        }
        return res;
      }
      if (typeof globalThis.document !== "undefined") {
        return extractCookieByName(globalThis.document.cookie, COOKIE_VAULT_NAME);
      }
    } catch {
      return null;
    }
    return null;
  };

  const writeCookieState = (state) => {
    const encoded = encodeCookiePayload(state);
    const cookieStr = `${COOKIE_VAULT_NAME}=${encoded}; ${COOKIE_ATTRS}`;
    try {
      if (typeof env.setCookie === "function") {
        env.setCookie(cookieStr, encoded);
        return;
      }
      if (typeof globalThis.document !== "undefined") {
        globalThis.document.cookie = cookieStr;
      }
    } catch {
      // ignore cookie write restriction
    }
  };

  const writeLsState = (state) => {
    try {
      storage?.setItem?.(LS_VAULT_KEY, JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  };

  let idbWriteChain = Promise.resolve();
  const writeIdbState = (state) => {
    const snapshot = cloneVaultState(state);
    idbWriteChain = idbWriteChain
      .then(() => idb?.set?.(IDB_PRIMARY_KEY, snapshot))
      .catch(() => {});
    return idbWriteChain;
  };

  const dispatchFn =
    typeof env.dispatchEvent === "function"
      ? env.dispatchEvent
      : (event) => {
          if (typeof globalThis.window?.dispatchEvent === "function") {
            globalThis.window.dispatchEvent(event);
          } else if (typeof globalThis.dispatchEvent === "function") {
            globalThis.dispatchEvent(event);
          }
        };

  let currentState = null;
  let bootHealConsumed = false;
  const listeners = new Set();

  const notifySubscribers = (state) => {
    const cloned = cloneVaultState(state);
    for (const listener of listeners) {
      try {
        listener(cloneVaultState(cloned));
      } catch {
        // isolate subscriber errors
      }
    }
  };

  const ensureSyncInitialState = () => {
    if (currentState) return currentState;
    const bakedRaw =
      env.bakedVault !== undefined
        ? env.bakedVault
        : hasCustomStores
          ? undefined
          : globalThis.__CLAUSEHOUND_BAKED_VAULT__;
    const bakedState = validateVaultState(bakedRaw);
    const lsState = validateVaultState(storage?.getItem?.(LS_VAULT_KEY));
    const cookieState = decodeCookiePayload(readRawCookie());
    currentState = lsState || bakedState || cookieState || normalizeVaultState({}, nowFn);
    return currentState;
  };

  async function initVault() {
    const bootHealRaw = !bootHealConsumed
      ? env.bootHeal !== undefined
        ? env.bootHeal
        : hasCustomStores
          ? undefined
          : globalThis.__CLAUSEHOUND_BOOT_HEAL__
      : null;

    if (bootHealRaw && bootHealRaw.healed === true) {
      const bootState = validateVaultState(bootHealRaw.state);
      bootHealConsumed = true;
      if (bootState) {
        currentState = bootState;
        writeLsState(bootState);
        writeCookieState(bootState);
        await writeIdbState(bootState);
        emitCustomEvent(dispatchFn, "clausehound:vault-healed", {
          source: bootHealRaw.source || "cookie",
          selfHealRecoveries: bootState.selfHealRecoveries,
          state: cloneVaultState(bootState)
        });
        notifySubscribers(bootState);
        return cloneVaultState(bootState);
      }
    }

    const bakedRaw =
      env.bakedVault !== undefined
        ? env.bakedVault
        : hasCustomStores
          ? undefined
          : globalThis.__CLAUSEHOUND_BAKED_VAULT__;
    const bakedState = validateVaultState(bakedRaw);
    const lsState = validateVaultState(storage?.getItem?.(LS_VAULT_KEY));

    let idbRaw = null;
    try {
      idbRaw = await idb?.get?.(IDB_PRIMARY_KEY);
    } catch {
      idbRaw = null;
    }
    const idbState = validateVaultState(idbRaw);
    const cookieState = decodeCookiePayload(readRawCookie());

    let resolved;
    let healSource = null;

    const applySelfHealRecovery = async (survivingState) => {
      const next = normalizeVaultState(
        {
          ...survivingState,
          selfHealRecoveries: survivingState.selfHealRecoveries + 1
        },
        nowFn
      );
      writeLsState(next);
      await writeIdbState(next);
      writeCookieState(next);
      return next;
    };

    if (bakedState && !lsState && !idbState) {
      resolved = cloneVaultState(bakedState);
      writeLsState(resolved);
      writeCookieState(resolved);
      await writeIdbState(resolved);
      healSource = "baked";
    } else if (!lsState && !idbState && cookieState) {
      resolved = await applySelfHealRecovery(cookieState);
      healSource = "cookie";
    } else if (lsState && !idbState) {
      resolved = await applySelfHealRecovery(lsState);
      healSource = "localStorage";
    } else if (!lsState && idbState) {
      resolved = await applySelfHealRecovery(idbState);
      healSource = "idb";
    } else if (lsState && idbState) {
      if (lsState.checksum !== idbState.checksum) {
        resolved = cloneVaultState(selectFresherState(lsState, idbState));
        writeLsState(resolved);
        await writeIdbState(resolved);
        writeCookieState(resolved);
      } else {
        resolved = cloneVaultState(lsState);
        if (!cookieState || cookieState.checksum !== resolved.checksum) {
          writeCookieState(resolved);
        }
      }
    } else {
      resolved = normalizeVaultState({}, nowFn);
      writeLsState(resolved);
      writeCookieState(resolved);
      await writeIdbState(resolved);
    }

    currentState = resolved;

    if (healSource) {
      emitCustomEvent(dispatchFn, "clausehound:vault-healed", {
        source: healSource,
        selfHealRecoveries: resolved.selfHealRecoveries,
        state: cloneVaultState(resolved)
      });
    }

    notifySubscribers(resolved);
    return cloneVaultState(resolved);
  }

  function getVaultState() {
    return cloneVaultState(ensureSyncInitialState());
  }

  async function updateVaultState(patch) {
    const prev = cloneVaultState(ensureSyncInitialState());
    const delta = typeof patch === "function" ? patch(cloneVaultState(prev)) : patch;
    if (!delta || typeof delta !== "object" || Array.isArray(delta)) {
      throw new TypeError("updateVaultState requires a plain patch object or updater function");
    }
    const merged = {
      ...prev,
      ...delta,
      neutralizedRuleMap:
        delta.neutralizedRuleMap !== undefined ? delta.neutralizedRuleMap : prev.neutralizedRuleMap,
      excisedFeeMap:
        delta.excisedFeeMap !== undefined ? delta.excisedFeeMap : prev.excisedFeeMap,
      sealStampedMap:
        delta.sealStampedMap !== undefined ? delta.sealStampedMap : prev.sealStampedMap
    };
    const next = normalizeVaultState(merged, nowFn);
    currentState = next;
    writeLsState(next);
    writeCookieState(next);
    notifySubscribers(next);
    await writeIdbState(next);
    return cloneVaultState(next);
  }

  async function resetDailyVault(options = {}) {
    const prev = cloneVaultState(ensureSyncInitialState());
    const includeLifetime = options?.includeLifetime === true;
    const next = normalizeVaultState(
      {
        ...prev,
        dailyStreakDate: getTodayIsoDate(nowFn),
        neutralizedRuleMap: {},
        excisedFeeMap: {},
        sealStampedMap: {},
        lifetimeTrapsNeutralized: includeLifetime ? 0 : prev.lifetimeTrapsNeutralized,
        lifetimeAnnualDollarsSaved: includeLifetime ? 0 : prev.lifetimeAnnualDollarsSaved
      },
      nowFn
    );
    currentState = next;
    writeLsState(next);
    writeCookieState(next);
    notifySubscribers(next);
    await writeIdbState(next);
    return cloneVaultState(next);
  }

  async function restoreVaultSnapshot(snapshot) {
    const validated = validateVaultState(snapshot);
    if (!validated) {
      throw new Error("Invalid or checksum-corrupted vault snapshot");
    }
    currentState = validated;
    writeLsState(validated);
    writeCookieState(validated);
    notifySubscribers(validated);
    await writeIdbState(validated);
    return cloneVaultState(validated);
  }

  function subscribeVault(fn) {
    if (typeof fn !== "function") {
      throw new TypeError("subscribeVault listener must be a function");
    }
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }

  return {
    initVault,
    getVaultState,
    updateVaultState,
    resetDailyVault,
    restoreVaultSnapshot,
    subscribeVault,
    encodeCookiePayload,
    decodeCookiePayload,
    computeVaultChecksum
  };
}

const defaultController = createVaultController();

export function initVault() {
  return defaultController.initVault();
}

export function getVaultState() {
  return defaultController.getVaultState();
}

export function updateVaultState(patch) {
  return defaultController.updateVaultState(patch);
}

export function resetDailyVault(options) {
  return defaultController.resetDailyVault(options);
}

export function restoreVaultSnapshot(snapshot) {
  return defaultController.restoreVaultSnapshot(snapshot);
}

export function subscribeVault(fn) {
  return defaultController.subscribeVault(fn);
}
