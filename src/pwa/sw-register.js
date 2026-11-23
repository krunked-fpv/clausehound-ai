/**
 * ClauseHound Local — Subpath-Safe Service Worker Registration & Install Controller
 */

export const PWA_CACHE_VERSION = "clausehound-faraday-v1";

let activeRegistration = null;

function resolveNavigator(options) {
  if (options && "navigator" in options) {
    return options.navigator;
  }
  return typeof globalThis.navigator !== "undefined" ? globalThis.navigator : undefined;
}

function resolveWindow(options) {
  if (options && "window" in options) {
    return options.window;
  }
  return typeof globalThis.window !== "undefined" ? globalThis.window : undefined;
}

/**
 * Registers the relative `./sw.js` Service Worker scoped strictly to `./`.
 * Safe no-op in headless/Node or `file:` contexts.
 * @param {{ swPath?: string, scope?: string, navigator?: object, window?: object }} [options={}]
 * @returns {Promise<{ registered: boolean, scope?: string, registration?: ServiceWorkerRegistration, reason?: string }>}
 */
export async function registerFaradayServiceWorker(options = {}) {
  const nav = resolveNavigator(options);
  const win = resolveWindow(options);

  if (!nav || !("serviceWorker" in nav) || !nav.serviceWorker || typeof nav.serviceWorker.register !== "function") {
    return { registered: false, reason: "service-worker-unsupported" };
  }

  const protocol = win && win.location ? win.location.protocol : undefined;
  if (protocol && protocol !== "http:" && protocol !== "https:") {
    return { registered: false, reason: "unsupported-protocol" };
  }

  const swPath = typeof options.swPath === "string" && options.swPath.length > 0 ? options.swPath : "./sw.js";
  const scope = typeof options.scope === "string" && options.scope.length > 0 ? options.scope : "./";

  try {
    const registration = await nav.serviceWorker.register(swPath, { scope });
    activeRegistration = registration || null;
    return {
      registered: true,
      scope: (registration && registration.scope) || scope,
      registration
    };
  } catch (err) {
    return {
      registered: false,
      reason: err && err.message ? err.message : "registration-failed"
    };
  }
}

/**
 * Reports current Service Worker registration and controller readiness.
 * @param {object} [nav]
 * @returns {{ supported: boolean, registered: boolean, controllerActive: boolean, cacheVersion: string }}
 */
export function getServiceWorkerStatus(nav = resolveNavigator()) {
  const supported = Boolean(nav && "serviceWorker" in nav && nav.serviceWorker);
  const controllerActive = Boolean(supported && nav.serviceWorker.controller);
  const registered = Boolean(activeRegistration || controllerActive);
  return {
    supported,
    registered,
    controllerActive,
    cacheVersion: PWA_CACHE_VERSION
  };
}

/**
 * Deletes stale CacheStorage entries not matching `activeVersion`.
 * @param {string} [activeVersion=PWA_CACHE_VERSION]
 * @param {CacheStorage} [cacheStorage]
 * @returns {Promise<string[]>}
 */
export async function clearOldCaches(
  activeVersion = PWA_CACHE_VERSION,
  cacheStorage = typeof globalThis.caches !== "undefined" ? globalThis.caches : undefined
) {
  if (!cacheStorage || typeof cacheStorage.keys !== "function" || typeof cacheStorage.delete !== "function") {
    return [];
  }
  const keys = await cacheStorage.keys();
  const staleKeys = keys.filter((key) => key !== activeVersion);
  await Promise.all(staleKeys.map((key) => cacheStorage.delete(key)));
  return staleKeys;
}

/**
 * Tracks browser PWA `beforeinstallprompt`, `appinstalled`, and standalone display-mode.
 * @param {(status: { installAvailable: boolean, standalone: boolean, dismissed: boolean }) => void} [onChange]
 * @param {{ targetGlobal?: object, matchMedia?: Function, navigator?: object }} [env={}]
 */
export function createInstallController(onChange, env = {}) {
  const callback = typeof onChange === "function" ? onChange : null;
  const resolvedEnv = typeof onChange === "object" && onChange !== null ? onChange : env;
  const targetGlobal =
    resolvedEnv && "targetGlobal" in resolvedEnv
      ? resolvedEnv.targetGlobal
      : typeof globalThis.window !== "undefined"
        ? globalThis.window
        : undefined;
  const nav =
    resolvedEnv && "navigator" in resolvedEnv
      ? resolvedEnv.navigator
      : (targetGlobal && targetGlobal.navigator) || resolveNavigator();
  const matchMediaFn =
    resolvedEnv && typeof resolvedEnv.matchMedia === "function"
      ? resolvedEnv.matchMedia
      : targetGlobal && typeof targetGlobal.matchMedia === "function"
        ? targetGlobal.matchMedia.bind(targetGlobal)
        : null;

  let deferredPrompt = null;
  let dismissed = false;
  let installed = false;
  const subscribers = new Set();

  const mediaQuery = matchMediaFn ? matchMediaFn("(display-mode: standalone)") : null;

  function isStandalone() {
    const mediaMatch = Boolean(mediaQuery && mediaQuery.matches === true);
    const navStandalone = Boolean(nav && nav.standalone === true);
    return installed || mediaMatch || navStandalone;
  }

  function isInstallAvailable() {
    return Boolean(deferredPrompt && !dismissed && !isStandalone());
  }

  function snapshot() {
    return {
      installAvailable: isInstallAvailable(),
      standalone: isStandalone(),
      dismissed
    };
  }

  function notify() {
    const state = snapshot();
    if (callback) {
      callback(state);
    }
    for (const fn of subscribers) {
      fn(state);
    }
  }

  function handleBeforeInstallPrompt(event) {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    deferredPrompt = event || null;
    dismissed = false;
    notify();
  }

  function handleAppInstalled() {
    deferredPrompt = null;
    installed = true;
    notify();
  }

  function handleDisplayModeChange() {
    notify();
  }

  if (targetGlobal && typeof targetGlobal.addEventListener === "function") {
    targetGlobal.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    targetGlobal.addEventListener("appinstalled", handleAppInstalled);
  }
  if (mediaQuery && typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleDisplayModeChange);
  }

  async function triggerInstall() {
    if (!deferredPrompt || typeof deferredPrompt.prompt !== "function" || isStandalone()) {
      return { outcome: "unavailable", accepted: false };
    }
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    await promptEvent.prompt();
    const choice = (await promptEvent.userChoice) || { outcome: "dismissed" };
    const accepted = choice.outcome === "accepted";
    if (accepted) {
      installed = true;
    } else {
      dismissed = true;
    }
    notify();
    return {
      outcome: choice.outcome || (accepted ? "accepted" : "dismissed"),
      accepted
    };
  }

  function dismiss() {
    dismissed = true;
    deferredPrompt = null;
    notify();
  }

  function subscribe(fn) {
    if (typeof fn !== "function") {
      return () => {};
    }
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }

  function destroy() {
    if (targetGlobal && typeof targetGlobal.removeEventListener === "function") {
      targetGlobal.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      targetGlobal.removeEventListener("appinstalled", handleAppInstalled);
    }
    if (mediaQuery && typeof mediaQuery.removeEventListener === "function") {
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
    }
    subscribers.clear();
  }

  return {
    isInstallAvailable,
    isStandalone,
    triggerInstall,
    dismiss,
    subscribe,
    destroy
  };
}
