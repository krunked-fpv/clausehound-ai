/**
 * ClauseHound Local — Faraday Air-Gap Runtime Network Sandbox
 * Intercepts outbound browser network primitives when locked and maintains
 * a live Interception Ledger, telemetry stream, and hardware-offline monitor.
 */

export const FARADAY_WRAPPED_APIS = Object.freeze([
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "sendBeacon"
]);

const WRAPPER_TAG = Symbol("faradayAirGapWrapper");
const MAX_LOG_ENTRIES = 1000;
const ALLOWED_LOCKED_METHODS = new Set(["GET", "HEAD"]);
const ALLOWED_LOCAL_PROTOCOLS = new Set(["data:", "blob:"]);
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const textEncoder = new TextEncoder();

/**
 * Error thrown whenever the Faraday Air-Gap blocks an outbound request or socket.
 */
export class FaradayAirGapError extends Error {
  /**
   * @param {string} [message]
   * @param {{ api?: string|null, url?: string, method?: string, reason?: string }|string} [details]
   */
  constructor(message, details = {}) {
    const info = typeof details === "string" ? { api: details } : details || {};
    const api = info.api ?? null;
    const url = typeof info.url === "string" ? info.url : "";
    const resolvedMessage =
      typeof message === "string" && message.length > 0
        ? message
        : `Faraday Air-Gap blocked ${api || "network"} request${url ? ` to ${url}` : ""}`;
    super(resolvedMessage);
    this.name = "FaradayAirGapError";
    this.code = "FARADAY_AIRGAP_BLOCKED";
    this.api = api;
    this.url = url;
    if (info.method !== undefined) {
      this.method = info.method;
    }
    if (info.reason !== undefined) {
      this.reason = info.reason;
    }
  }
}

let installed = false;
let activeTarget = null;
let airGapLocked = true;
let allowSameOriginGet = true;
let outboundBytes = 0;
let blockedCount = 0;
let logSequence = 0;

/** @type {Array<{ id: string, timestamp: string, api: string, method: string, url: string, origin: string, blocked: boolean, reason: string }>} */
const interceptionLog = [];
const subscribers = new Set();

/** @type {Array<{ obj: object, prop: string, hadOwn: boolean, ownDesc: PropertyDescriptor|undefined }>} */
let patchedProperties = [];
/** @type {Array<() => void>} */
let teardownCallbacks = [];
const xhrOpenMeta = new WeakMap();

function resolveBaseHref(target) {
  const loc = target?.location;
  const candidate =
    typeof loc?.href === "string" && loc.href.length > 0
      ? loc.href
      : typeof loc?.origin === "string" && loc.origin.length > 0 && loc.origin !== "null"
        ? loc.origin
        : "http://localhost/";
  try {
    return new URL(candidate).href;
  } catch {
    return "http://localhost/";
  }
}

function getBaseUrl(target) {
  const baseHref = resolveBaseHref(target);
  try {
    return new URL(baseHref);
  } catch {
    return new URL("http://localhost/");
  }
}

function extractRawUrl(input) {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    if (typeof input.url === "string") return input.url;
    if (typeof input.href === "string") return input.href;
  }
  return null;
}

function resolveUrlInfo(rawUrl, target) {
  const rawString = extractRawUrl(rawUrl);
  if (rawString === null) {
    return { valid: false, url: String(rawUrl ?? ""), origin: "null", parsed: null };
  }
  const baseHref = resolveBaseHref(target);
  try {
    const parsed = new URL(rawString, baseHref);
    return {
      valid: true,
      url: parsed.href,
      origin: parsed.origin,
      parsed
    };
  } catch {
    return { valid: false, url: rawString, origin: "null", parsed: null };
  }
}

function computeHardwareOffline(target) {
  const nav = target?.navigator ?? globalThis.navigator;
  return nav?.onLine === false;
}

function getLastBlockedEntry() {
  for (let i = interceptionLog.length - 1; i >= 0; i -= 1) {
    if (interceptionLog[i].blocked) {
      return interceptionLog[i];
    }
  }
  return null;
}

function buildTelemetrySnapshot() {
  const lastBlocked = getLastBlockedEntry();
  return {
    locked: airGapLocked,
    installed,
    blockedCount,
    outboundBytes,
    hardwareOffline: computeHardwareOffline(activeTarget),
    lastBlockedEvent: lastBlocked ? { ...lastBlocked } : null
  };
}

function emitAirGapEvent(target) {
  const eventTarget = target || activeTarget || globalThis;
  const telemetry = buildTelemetrySnapshot();
  const detail = {
    locked: telemetry.locked,
    blockedCount: telemetry.blockedCount,
    lastBlockedEvent: telemetry.lastBlockedEvent,
    hardwareOffline: telemetry.hardwareOffline,
    outboundBytes: telemetry.outboundBytes
  };
  const CustomEventCtor = eventTarget?.CustomEvent ?? globalThis.CustomEvent;
  const event =
    typeof CustomEventCtor === "function"
      ? new CustomEventCtor("clausehound:airgap-toggle", { detail })
      : { type: "clausehound:airgap-toggle", detail };

  if (typeof eventTarget?.dispatchEvent === "function") {
    try {
      eventTarget.dispatchEvent(event);
    } catch {
      // Ignore dispatch failures in restricted environments.
    }
  } else if (
    eventTarget === globalThis &&
    typeof globalThis.window?.dispatchEvent === "function"
  ) {
    try {
      globalThis.window.dispatchEvent(event);
    } catch {
      // Ignore dispatch failures.
    }
  }
}

function notifySubscribers() {
  if (subscribers.size === 0) return;
  const snapshot = buildTelemetrySnapshot();
  for (const listener of subscribers) {
    try {
      listener({
        ...snapshot,
        lastBlockedEvent: snapshot.lastBlockedEvent ? { ...snapshot.lastBlockedEvent } : null
      });
    } catch {
      // Isolate subscriber errors.
    }
  }
}

function recordBlockedAttempt({ api, method, url, origin, reason }) {
  logSequence += 1;
  blockedCount += 1;
  const entry = {
    id: `faraday-${logSequence}`,
    timestamp: new Date().toISOString(),
    api,
    method: String(method || "GET").toUpperCase(),
    url: String(url || ""),
    origin: String(origin || "null"),
    blocked: true,
    reason: String(reason || "airgap-locked")
  };
  if (interceptionLog.length >= MAX_LOG_ENTRIES) {
    interceptionLog.shift();
  }
  interceptionLog.push(entry);
  notifySubscribers();
  emitAirGapEvent(activeTarget);
  return entry;
}

function recordAndThrowBlocked(details) {
  const entry = recordBlockedAttempt(details);
  throw new FaradayAirGapError(
    `Faraday Air-Gap blocked ${entry.api} ${entry.method} to ${entry.url || "<empty>"} (${entry.reason})`,
    {
      api: entry.api,
      url: entry.url,
      method: entry.method,
      reason: entry.reason
    }
  );
}

function estimatePayloadBytes(body) {
  if (body === undefined || body === null) return 0;
  if (typeof body === "string") return textEncoder.encode(body).byteLength;
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body.byteLength;
  if (typeof Blob !== "undefined" && body instanceof Blob) return body.size;
  if (typeof body.size === "number" && Number.isFinite(body.size)) return Math.max(0, body.size);
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return textEncoder.encode(body.toString()).byteLength;
  }
  return 0;
}

function trackUnlockedOutbound(body) {
  const bytes = estimatePayloadBytes(body);
  if (bytes > 0) {
    outboundBytes += bytes;
    notifySubscribers();
  }
}

function isSameOriginHttpUrl(parsed, baseUrl) {
  if (!HTTP_PROTOCOLS.has(parsed.protocol) || !HTTP_PROTOCOLS.has(baseUrl.protocol)) {
    return false;
  }
  return parsed.origin !== "null" && parsed.origin === baseUrl.origin;
}

function evaluateHttpPolicy({ api, rawUrl, rawMethod, hasBody, target, allowStaticGet }) {
  const method = String(rawMethod || "GET").trim().toUpperCase() || "GET";
  const info = resolveUrlInfo(rawUrl, target);

  if (!info.valid || !info.parsed) {
    return {
      allowed: false,
      entry: {
        api,
        method,
        url: info.url,
        origin: info.origin,
        reason: "invalid-url-blocked"
      }
    };
  }

  const parsed = info.parsed;
  const baseUrl = getBaseUrl(target);
  const blockWith = (reason) => ({
    allowed: false,
    entry: {
      api,
      method,
      url: parsed.href,
      origin: parsed.origin,
      reason
    }
  });

  if (ALLOWED_LOCAL_PROTOCOLS.has(parsed.protocol)) {
    if (!ALLOWED_LOCKED_METHODS.has(method)) {
      return blockWith("non-get-method-blocked");
    }
    if (hasBody) {
      return blockWith("payload-body-blocked");
    }
    if (!allowStaticGet) {
      return blockWith("same-origin-get-disabled");
    }
    if (parsed.protocol === "blob:") {
      if (parsed.search !== "") {
        return blockWith("query-exfiltration-blocked");
      }
      const sameBlobOrigin =
        parsed.origin !== "null" &&
        HTTP_PROTOCOLS.has(baseUrl.protocol) &&
        parsed.origin === baseUrl.origin;
      if (!sameBlobOrigin) {
        return blockWith("cross-origin-blocked");
      }
    }
    return { allowed: true };
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    return blockWith("protocol-blocked");
  }

  if (!isSameOriginHttpUrl(parsed, baseUrl)) {
    return blockWith("cross-origin-blocked");
  }

  if (!ALLOWED_LOCKED_METHODS.has(method)) {
    return blockWith("non-get-method-blocked");
  }

  if (hasBody) {
    return blockWith("payload-body-blocked");
  }

  if (parsed.search !== "") {
    return blockWith("query-exfiltration-blocked");
  }

  if (!allowStaticGet) {
    return blockWith("same-origin-get-disabled");
  }

  return { allowed: true };
}

function patchProperty(obj, prop, replacement) {
  const ownDesc = Object.getOwnPropertyDescriptor(obj, prop);
  const hadOwn = ownDesc !== undefined;
  patchedProperties.push({ obj, prop, hadOwn, ownDesc });
  try {
    if (!ownDesc || ownDesc.configurable) {
      Object.defineProperty(obj, prop, {
        value: replacement,
        writable: true,
        enumerable: ownDesc ? ownDesc.enumerable : true,
        configurable: true
      });
    } else if (ownDesc.writable) {
      obj[prop] = replacement;
    }
  } catch {
    obj[prop] = replacement;
  }
}

function restorePatchedProperties() {
  for (let i = patchedProperties.length - 1; i >= 0; i -= 1) {
    const { obj, prop, hadOwn, ownDesc } = patchedProperties[i];
    try {
      if (hadOwn) {
        if (ownDesc.configurable) {
          Object.defineProperty(obj, prop, ownDesc);
        } else if (ownDesc.writable && "value" in ownDesc) {
          obj[prop] = ownDesc.value;
        }
      } else {
        delete obj[prop];
      }
    } catch {
      // Ignore host properties that reject restoration.
    }
  }
  patchedProperties = [];
}

function tagWrapper(fn) {
  try {
    Object.defineProperty(fn, WRAPPER_TAG, { value: true, configurable: true });
  } catch {
    fn[WRAPPER_TAG] = true;
  }
  return fn;
}

function extractFetchMeta(input, init) {
  const rawUrl = extractRawUrl(input);
  const rawMethod =
    init?.method ??
    (input && typeof input === "object" && typeof input.method === "string" ? input.method : "GET");
  const hasBody = init?.body !== undefined && init?.body !== null;
  return { rawUrl, rawMethod, hasBody, body: init?.body };
}

function wrapFetch(target) {
  const current = target.fetch;
  if (current && current[WRAPPER_TAG]) return;
  const origFetch = typeof current === "function" ? current : null;

  const faradayFetch = tagWrapper(async function faradayFetch(input, init) {
    const { rawUrl, rawMethod, hasBody, body } = extractFetchMeta(input, init);
    if (airGapLocked) {
      const verdict = evaluateHttpPolicy({
        api: "fetch",
        rawUrl,
        rawMethod,
        hasBody,
        target,
        allowStaticGet: allowSameOriginGet
      });
      if (!verdict.allowed) {
        recordAndThrowBlocked(verdict.entry);
      }
    } else {
      trackUnlockedOutbound(body);
    }

    if (!origFetch) {
      throw new TypeError("fetch is not available in this environment");
    }
    return origFetch.apply(target, arguments);
  });

  patchProperty(target, "fetch", faradayFetch);
}

function wrapXmlHttpRequest(target) {
  const XhrCtor = target.XMLHttpRequest;
  if (typeof XhrCtor !== "function" || !XhrCtor.prototype) return;
  const proto = XhrCtor.prototype;

  if (typeof proto.open === "function" && !proto.open[WRAPPER_TAG]) {
    const origOpen = proto.open;
    const faradayXhrOpen = tagWrapper(function faradayXhrOpen(method, url) {
      if (airGapLocked) {
        const verdict = evaluateHttpPolicy({
          api: "XMLHttpRequest",
          rawUrl: url,
          rawMethod: method,
          hasBody: false,
          target,
          allowStaticGet: allowSameOriginGet
        });
        if (!verdict.allowed) {
          recordAndThrowBlocked(verdict.entry);
        }
      }
      xhrOpenMeta.set(this, { method, url });
      return origOpen.apply(this, arguments);
    });
    patchProperty(proto, "open", faradayXhrOpen);
  }

  if (typeof proto.send === "function" && !proto.send[WRAPPER_TAG]) {
    const origSend = proto.send;
    const faradayXhrSend = tagWrapper(function faradayXhrSend(body) {
      const meta = xhrOpenMeta.get(this);
      if (airGapLocked && meta) {
        const verdict = evaluateHttpPolicy({
          api: "XMLHttpRequest",
          rawUrl: meta.url,
          rawMethod: meta.method,
          hasBody: body !== undefined && body !== null,
          target,
          allowStaticGet: allowSameOriginGet
        });
        if (!verdict.allowed) {
          recordAndThrowBlocked(verdict.entry);
        }
      } else if (!airGapLocked && meta) {
        trackUnlockedOutbound(body);
      }
      return origSend.apply(this, arguments);
    });
    patchProperty(proto, "send", faradayXhrSend);
  }
}

function wrapRealtimeConstructor(target, propName, apiName, methodLabel, reason, defaultStates) {
  const current = target[propName];
  if (current && current[WRAPPER_TAG]) return;
  const OrigCtor = typeof current === "function" ? current : null;

  const FaradayCtor = tagWrapper(function FaradaySocketWrapper(url) {
    if (!new.target) {
      throw new TypeError(`Constructor ${apiName} requires 'new'`);
    }
    const info = resolveUrlInfo(url, target);
    if (airGapLocked) {
      recordAndThrowBlocked({
        api: apiName,
        method: methodLabel,
        url: info.url,
        origin: info.origin,
        reason
      });
    }
    if (!OrigCtor) {
      throw new TypeError(`${apiName} is not available in this environment`);
    }
    return arguments.length > 1
      ? new OrigCtor(url, arguments[1])
      : new OrigCtor(url);
  });

  for (const [key, fallbackVal] of Object.entries(defaultStates)) {
    const val = OrigCtor && typeof OrigCtor[key] === "number" ? OrigCtor[key] : fallbackVal;
    try {
      Object.defineProperty(FaradayCtor, key, { value: val, enumerable: true, configurable: true });
    } catch {
      // Ignore constant assignment failure.
    }
  }
  if (OrigCtor && OrigCtor.prototype) {
    FaradayCtor.prototype = OrigCtor.prototype;
  }

  patchProperty(target, propName, FaradayCtor);
}

function wrapSendBeacon(target) {
  const nav = target.navigator;
  if (!nav || typeof nav !== "object") return;
  const current = nav.sendBeacon;
  if (current && current[WRAPPER_TAG]) return;
  const origSendBeacon = typeof current === "function" ? current : null;

  const faradaySendBeacon = tagWrapper(function faradaySendBeacon(url, data) {
    if (airGapLocked) {
      const info = resolveUrlInfo(url, target);
      recordBlockedAttempt({
        api: "sendBeacon",
        method: "BEACON",
        url: info.url,
        origin: info.origin,
        reason: "beacon-blocked"
      });
      return false;
    }
    if (!origSendBeacon) {
      return false;
    }
    const dispatched = Boolean(origSendBeacon.apply(nav, arguments));
    if (dispatched) {
      trackUnlockedOutbound(data);
    }
    return dispatched;
  });

  patchProperty(nav, "sendBeacon", faradaySendBeacon);
}

function attachEnvironmentAuditors(target) {
  if (typeof target.addEventListener === "function") {
    const onConnectivityChange = () => {
      notifySubscribers();
      emitAirGapEvent(target);
    };
    try {
      target.addEventListener("online", onConnectivityChange);
      target.addEventListener("offline", onConnectivityChange);
      teardownCallbacks.push(() => {
        try {
          target.removeEventListener("online", onConnectivityChange);
          target.removeEventListener("offline", onConnectivityChange);
        } catch {
          // Ignore listener cleanup errors.
        }
      });
    } catch {
      // Ignore event listener attachment failures.
    }
  }

  const PerfObserver = target.PerformanceObserver;
  if (typeof PerfObserver === "function") {
    try {
      const observer = new PerfObserver((list) => {
        if (!airGapLocked) return;
        const entries = typeof list?.getEntries === "function" ? list.getEntries() : [];
        const baseUrl = getBaseUrl(target);
        for (const entry of entries) {
          if (!entry || (entry.entryType && entry.entryType !== "resource")) continue;
          const info = resolveUrlInfo(entry.name, target);
          if (!info.valid || !info.parsed) continue;
          const parsed = info.parsed;
          const isExternalHttp =
            HTTP_PROTOCOLS.has(parsed.protocol) && !isSameOriginHttpUrl(parsed, baseUrl);
          const isExternalProto =
            !HTTP_PROTOCOLS.has(parsed.protocol) && !ALLOWED_LOCAL_PROTOCOLS.has(parsed.protocol);
          if (!isExternalHttp && !isExternalProto) continue;

          const lastBlocked = getLastBlockedEntry();
          if (
            lastBlocked &&
            lastBlocked.url === parsed.href &&
            lastBlocked.api !== "PerformanceObserver"
          ) {
            const deltaMs = Date.now() - Date.parse(lastBlocked.timestamp);
            if (Number.isFinite(deltaMs) && deltaMs >= 0 && deltaMs < 150) {
              continue;
            }
          }

          recordBlockedAttempt({
            api: "PerformanceObserver",
            method: entry.initiatorType ? String(entry.initiatorType).toUpperCase() : "RESOURCE",
            url: parsed.href,
            origin: parsed.origin,
            reason: "performance-observer-cross-origin"
          });
        }
      });
      observer.observe({ entryTypes: ["resource"] });
      teardownCallbacks.push(() => {
        try {
          observer.disconnect();
        } catch {
          // Ignore observer disconnect failures.
        }
      });
    } catch {
      // Gracefully skip if PerformanceObserver or resource entryTypes are unsupported.
    }
  }
}

/**
 * Installs the Faraday Air-Gap network sandbox idempotently on `targetGlobal`.
 * @param {{ targetGlobal?: object, allowSameOriginGet?: boolean, initialLocked?: boolean }} [options]
 * @returns {{ installed: boolean, uninstall: () => void }}
 */
export function installFaradaySandbox(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const target = opts.targetGlobal ?? globalThis;

  if (installed && activeTarget === target) {
    if (opts.allowSameOriginGet !== undefined) {
      allowSameOriginGet = Boolean(opts.allowSameOriginGet);
    }
    return { installed: true, uninstall: uninstallFaradaySandbox };
  }

  if (installed && activeTarget !== target) {
    uninstallFaradaySandbox();
  }

  activeTarget = target;
  allowSameOriginGet = opts.allowSameOriginGet !== undefined ? Boolean(opts.allowSameOriginGet) : true;
  airGapLocked = opts.initialLocked !== undefined ? Boolean(opts.initialLocked) : true;

  wrapFetch(target);
  wrapXmlHttpRequest(target);
  wrapRealtimeConstructor(
    target,
    "WebSocket",
    "WebSocket",
    "CONNECT",
    "realtime-socket-blocked",
    { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }
  );
  wrapRealtimeConstructor(
    target,
    "EventSource",
    "EventSource",
    "SSE",
    "sse-blocked",
    { CONNECTING: 0, OPEN: 1, CLOSED: 2 }
  );
  wrapSendBeacon(target);
  attachEnvironmentAuditors(target);

  installed = true;
  notifySubscribers();
  return { installed: true, uninstall: uninstallFaradaySandbox };
}

/**
 * Uninstalls the Faraday Air-Gap wrappers and restores exact original globals.
 */
export function uninstallFaradaySandbox() {
  for (let i = teardownCallbacks.length - 1; i >= 0; i -= 1) {
    try {
      teardownCallbacks[i]();
    } catch {
      // Ignore cleanup errors.
    }
  }
  teardownCallbacks = [];
  restorePatchedProperties();
  installed = false;
  activeTarget = null;
  notifySubscribers();
}

/**
 * Updates the runtime air-gap lock state and broadcasts changes when flipped.
 * @param {boolean} locked
 * @returns {boolean}
 */
export function setAirGapLocked(locked) {
  const nextLocked = Boolean(locked);
  const changed = nextLocked !== airGapLocked;
  airGapLocked = nextLocked;
  if (changed) {
    notifySubscribers();
    emitAirGapEvent(activeTarget || globalThis);
  }
  return airGapLocked;
}

/**
 * Returns whether the Faraday Air-Gap lock is currently engaged.
 * @returns {boolean}
 */
export function isAirGapLocked() {
  return airGapLocked;
}

/**
 * Returns a defensive copy of the live Interception Ledger entries.
 * @returns {Array<{ id: string, timestamp: string, api: string, method: string, url: string, origin: string, blocked: boolean, reason: string }>}
 */
export function getInterceptionLog() {
  return interceptionLog.map((entry) => ({ ...entry }));
}

/**
 * Clears the Interception Ledger and resets blocked/outbound telemetry counters.
 */
export function clearInterceptionLog() {
  interceptionLog.length = 0;
  blockedCount = 0;
  outboundBytes = 0;
  notifySubscribers();
}

/**
 * Returns the current Faraday Air-Gap telemetry snapshot for UI strips and audits.
 * @returns {{ locked: boolean, installed: boolean, blockedCount: number, outboundBytes: number, hardwareOffline: boolean, lastBlockedEvent: object|null }}
 */
export function getAirGapTelemetry() {
  return buildTelemetrySnapshot();
}

/**
 * Subscribes a listener to Faraday Air-Gap lock, hardware-offline, and interception updates.
 * @param {(telemetry: object) => void} fn
 * @returns {() => void}
 */
export function subscribeAirGap(fn) {
  if (typeof fn !== "function") {
    throw new TypeError("subscribeAirGap listener must be a function");
  }
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
