import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  COOKIE_VAULT_NAME,
  DEFAULT_VAULT_STATE,
  IDB_DB_NAME,
  IDB_STORE_NAME,
  LS_VAULT_KEY,
  computeVaultChecksum,
  createVaultController,
  decodeCookiePayload,
  encodeCookiePayload
} from "../src/vault/cookie-vault.js";
import {
  buildHtmlBakeSnapshot,
  createResetDailyManager,
  exportPortableJson,
  importPortableJson
} from "../src/vault/local-sync.js";
import {
  RECEIPT_BYTE_LENGTH,
  RECEIPT_HASH_PREFIX,
  buildReceiptDataFromAudit,
  decodeReceiptBinary,
  decodeReceiptHash,
  encodeReceiptBinary,
  encodeReceiptHash
} from "../src/share/receipt-codec.js";

function createSyntheticVaultEnv() {
  const lsMap = new Map();
  let idbPrimary = null;
  let cookieHeader = "";
  const healedEvents = [];

  return {
    lsMap,
    get idbPrimary() {
      return idbPrimary;
    },
    set idbPrimary(v) {
      idbPrimary = v;
    },
    get cookieHeader() {
      return cookieHeader;
    },
    set cookieHeader(v) {
      cookieHeader = v;
    },
    healedEvents,
    env: {
      storage: {
        getItem(key) {
          return lsMap.has(key) ? lsMap.get(key) : null;
        },
        setItem(key, val) {
          lsMap.set(key, String(val));
        }
      },
      idb: {
        async get(key) {
          return key === "primary" && idbPrimary ? structuredClone(idbPrimary) : null;
        },
        async set(key, val) {
          if (key === "primary") {
            idbPrimary = structuredClone(val);
          }
        }
      },
      getCookie() {
        return cookieHeader;
      },
      setCookie(fullHeader) {
        cookieHeader = fullHeader;
      },
      dispatchEvent(event) {
        if (event?.type === "clausehound:vault-healed") {
          healedEvents.push(event.detail);
        }
      }
    }
  };
}

function extractCookieToken(cookieHeader, name = COOKIE_VAULT_NAME) {
  const parts = String(cookieHeader || "").split(";");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      return part.slice(eq + 1).trim();
    }
  }
  return "";
}

function computeFnv1a32(bytes) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    hash = Math.imul((hash ^ bytes[i]) >>> 0, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

describe("Tri-Store Self-Healing Vault, Sync & Zero-PII Receipt Codec", () => {
  test("locked constants and canonical FNV-1a32 checksum stability", () => {
    assert.equal(COOKIE_VAULT_NAME, "krunked-cookie-vault-v1");
    assert.equal(LS_VAULT_KEY, "clausehound_vault_v1");
    assert.equal(IDB_DB_NAME, "ClauseHoundVaultDB");
    assert.equal(IDB_STORE_NAME, "vault");
    assert.equal(DEFAULT_VAULT_STATE.version, 1);
    assert.match(DEFAULT_VAULT_STATE.checksum, /^[0-9a-f]{8}$/);
    assert.equal(computeVaultChecksum(DEFAULT_VAULT_STATE), DEFAULT_VAULT_STATE.checksum);
  });

  test("double-wipe (LS + IDB wiped/corrupted while cookie survives) restores state and increments selfHealRecoveries", async () => {
    const store = createSyntheticVaultEnv();
    const ctrl1 = createVaultController(store.env);
    await ctrl1.initVault();

    await ctrl1.updateVaultState({
      theme: "midnight",
      defaultTone: "counsel",
      asmrMixLevel: 0.85,
      airGapLocked: false,
      activeSpecimenId: "cobalt-saas-msa",
      lifetimeTrapsNeutralized: 11,
      lifetimeAnnualDollarsSaved: 4500,
      neutralizedRuleMap: {
        "cobalt-saas-msa": ["AR-01", "LC-01", "IN-01"]
      },
      excisedFeeMap: { "cobalt-saas-msa::de-boarding": true },
      sealStampedMap: { "cobalt-saas-msa": true }
    });

    assert.ok(store.cookieHeader.includes(`${COOKIE_VAULT_NAME}=`));
    assert.ok(store.cookieHeader.includes("path=/; SameSite=Lax; max-age=31536000"));

    // Wipe LocalStorage + corrupt IndexedDB while cookie survives
    store.lsMap.clear();
    store.idbPrimary = { version: 1, theme: "midnight", checksum: "deadbeef" };
    store.healedEvents.length = 0;

    const ctrl2 = createVaultController(store.env);
    const healed = await ctrl2.initVault();

    assert.equal(healed.theme, "midnight");
    assert.equal(healed.defaultTone, "counsel");
    assert.equal(healed.asmrMixLevel, 0.85);
    assert.equal(healed.airGapLocked, false);
    assert.equal(healed.activeSpecimenId, "cobalt-saas-msa");
    assert.equal(healed.lifetimeTrapsNeutralized, 11);
    assert.equal(healed.lifetimeAnnualDollarsSaved, 4500);
    assert.deepEqual(healed.neutralizedRuleMap["cobalt-saas-msa"], ["AR-01", "LC-01", "IN-01"]);
    assert.equal(healed.selfHealRecoveries, 1);
    assert.equal(healed.checksum, computeVaultChecksum(healed));

    // Verify both LS and IDB were repopulated with checksum-valid healed state
    assert.equal(JSON.parse(store.lsMap.get(LS_VAULT_KEY)).selfHealRecoveries, 1);
    assert.equal(store.idbPrimary.selfHealRecoveries, 1);
    assert.equal(store.healedEvents.length, 1);
    assert.equal(store.healedEvents[0].source, "cookie");
    assert.equal(store.healedEvents[0].selfHealRecoveries, 1);
  });

  test("wiping cookie while primary store survives regenerates cookie strictly < 3500 bytes even with bloated neutralizedRuleMap", async () => {
    const store = createSyntheticVaultEnv();
    const ctrl1 = createVaultController(store.env);
    await ctrl1.initVault();

    const bloatedRules = {};
    for (let i = 0; i < 90; i += 1) {
      bloatedRules[`custom-contract-${String(i).padStart(3, "0")}-${"x".repeat(20)}`] = [
        "AR-01",
        "IN-01",
        "LC-01",
        "IP-01",
        "JF-01"
      ];
    }
    bloatedRules["sterling-lease"] = Array.from({ length: 120 }, (_, idx) => `RULE-${idx}`);

    const bloatedFees = {};
    for (let i = 0; i < 40; i += 1) {
      bloatedFees[`custom-fee-key-${i}-${"y".repeat(15)}`] = true;
    }

    await ctrl1.updateVaultState({
      theme: "midnight",
      lifetimeTrapsNeutralized: 42,
      neutralizedRuleMap: bloatedRules,
      excisedFeeMap: bloatedFees
    });

    // Wipe cookie completely while LS and IDB survive with the bloated state
    store.cookieHeader = "";
    assert.equal(store.cookieHeader, "");

    const ctrl2 = createVaultController(store.env);
    const recovered = await ctrl2.initVault();

    // Primary stores preserve the full bloated state intact
    assert.equal(Object.keys(recovered.neutralizedRuleMap).length, 91);
    assert.equal(recovered.lifetimeTrapsNeutralized, 42);

    // Regenerated cookie header and encoded value obey strict byte caps
    const cookieBytes = new TextEncoder().encode(store.cookieHeader).byteLength;
    const token = extractCookieToken(store.cookieHeader);
    assert.ok(token.length > 0, "Expected cookie to be regenerated");
    assert.ok(cookieBytes < 3500, `Cookie header length ${cookieBytes} must be < 3500 bytes`);
    assert.ok(token.length < 3200, `Encoded cookie payload ${token.length} must be < 3200 bytes`);

    const decodedCookie = decodeCookiePayload(token);
    assert.ok(decodedCookie, "Trimmed cookie payload must decode with valid FNV-1a32 checksum");
    assert.equal(decodedCookie.theme, "midnight");
    assert.equal(decodedCookie.lifetimeTrapsNeutralized, 42);
    assert.equal(decodedCookie.checksum, computeVaultChecksum(decodedCookie));

    // Direct encodeCookiePayload check with huge map
    const directEncoded = encodeCookiePayload({
      neutralizedRuleMap: bloatedRules,
      excisedFeeMap: bloatedFees
    });
    assert.ok(directEncoded.length < 3200);
    assert.ok(decodeCookiePayload(directEncoded));
  });

  test("bootHeal handoff syncs IndexedDB without double-incrementing selfHealRecoveries", async () => {
    const store = createSyntheticVaultEnv();
    const preHealed = {
      ...DEFAULT_VAULT_STATE,
      theme: "midnight",
      selfHealRecoveries: 1,
      neutralizedRuleMap: { "sterling-lease": ["AR-04"] },
      excisedFeeMap: {},
      sealStampedMap: {}
    };
    preHealed.checksum = computeVaultChecksum(preHealed);

    store.env.bootHeal = { healed: true, source: "cookie", state: preHealed };
    const ctrl = createVaultController(store.env);
    const resolved = await ctrl.initVault();

    assert.equal(resolved.selfHealRecoveries, 1);
    assert.equal(store.idbPrimary.selfHealRecoveries, 1);
    assert.equal(store.healedEvents.length, 1);
    assert.equal(store.healedEvents[0].source, "cookie");
  });

  test("SPEC §4.4(3): single-store heal (only LS or only IDB wiped) must restore store and increment selfHealRecoveries", async () => {
    // Case A: Wipe only IndexedDB while LocalStorage survives
    const storeA = createSyntheticVaultEnv();
    const ctrlA1 = createVaultController(storeA.env);
    await ctrlA1.initVault();
    await ctrlA1.updateVaultState({ theme: "midnight", lifetimeTrapsNeutralized: 3 });

    storeA.idbPrimary = null;
    storeA.healedEvents.length = 0;
    const ctrlA2 = createVaultController(storeA.env);
    const healedFromLs = await ctrlA2.initVault();
    assert.equal(healedFromLs.theme, "midnight");
    assert.equal(storeA.healedEvents[0]?.source, "localStorage");
    assert.equal(storeA.idbPrimary?.theme, "midnight");

    // Case B: Wipe only LocalStorage while IndexedDB survives
    const storeB = createSyntheticVaultEnv();
    const ctrlB1 = createVaultController(storeB.env);
    await ctrlB1.initVault();
    await ctrlB1.updateVaultState({ theme: "midnight", lifetimeTrapsNeutralized: 3 });

    storeB.lsMap.clear();
    storeB.healedEvents.length = 0;
    const ctrlB2 = createVaultController(storeB.env);
    const healedFromIdb = await ctrlB2.initVault();
    assert.equal(healedFromIdb.theme, "midnight");
    assert.equal(storeB.healedEvents[0]?.source, "idb");
    assert.ok(storeB.lsMap.has(LS_VAULT_KEY));

    assert.deepEqual(
      [healedFromLs.selfHealRecoveries, healedFromIdb.selfHealRecoveries],
      [1, 1],
      "SPEC.md §4.4(3) bug in src/vault/cookie-vault.js:812-825: neither single-store heal branch (lsState && !idbState nor !lsState && idbState) increments selfHealRecoveries"
    );
  });

  test("exportPortableJson / importPortableJson validates checksums and rejects tampering", async () => {
    const store = createSyntheticVaultEnv();
    const ctrl = createVaultController(store.env);
    const state = await ctrl.initVault();
    const updated = await ctrl.updateVaultState({
      theme: "midnight",
      lifetimeAnnualDollarsSaved: 1860,
      neutralizedRuleMap: { "sterling-lease": ["AR-04", "JF-01"] }
    });

    const jsonText = exportPortableJson(updated);
    const imported = importPortableJson(jsonText);
    assert.deepEqual(imported, updated);

    // Tamper value without updating checksum
    const tampered = JSON.parse(jsonText);
    tampered.lifetimeAnnualDollarsSaved = 999999;
    assert.throws(
      () => importPortableJson(JSON.stringify(tampered)),
      /checksum/i
    );

    // Tamper checksum directly
    const badChecksum = JSON.parse(jsonText);
    badChecksum.checksum = "00000000";
    assert.throws(() => importPortableJson(JSON.stringify(badChecksum)), /checksum/i);

    // Invalid schema values even with matching checksum
    const badSchema = { ...state, theme: "neon-invalid", asmrMixLevel: 5 };
    badSchema.checksum = computeVaultChecksum(badSchema);
    assert.throws(() => importPortableJson(JSON.stringify(badSchema)));
    assert.throws(() => importPortableJson("{not-json"));
    assert.throws(() => importPortableJson(""));
  });

  test("buildHtmlBakeSnapshot neutralizes </script><script>alert(1)</script> XSS payloads in archival & inline modes", async () => {
    const xssPayload = "</script><script>alert(1)</script><img src=x onerror=alert(2)>";
    const maliciousState = {
      ...DEFAULT_VAULT_STATE,
      activeSpecimenId: xssPayload,
      neutralizedRuleMap: {
        [xssPayload]: ["IN-01", "</script><script>alert(3)</script>"]
      },
      excisedFeeMap: {
        [`fee-${xssPayload}`]: true
      },
      sealStampedMap: {
        [xssPayload]: true
      }
    };

    const archivalHtml = await buildHtmlBakeSnapshot(maliciousState, { offlineFallback: true });
    assert.equal(archivalHtml.includes("</script><script>alert("), false);
    assert.equal(archivalHtml.includes("<img src=x onerror="), false);
    assert.ok(archivalHtml.includes('id="clausehound-baked-vault"'));
    assert.ok(archivalHtml.includes("\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e"));
    assert.ok(archivalHtml.includes("&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;"));

    // Also verify inline importmap HTML bake path with mocked same-origin fetcher
    const mockHtml =
      '<!doctype html><html><head><link rel="stylesheet" href="./src/ui/desk-theme.css"></head>' +
      '<body><script type="module" src="./src/ui/app-shell.js"></script></body></html>';
    const inlineHtml = await buildHtmlBakeSnapshot(maliciousState, {
      baseHtml: mockHtml,
      cssText: "body { color: #000; } </style><script>alert(9)</script>",
      modules: ["./src/vault/cookie-vault.js"],
      fetchImpl: async () => ({
        ok: true,
        text: async () => "export const X = 1;"
      })
    });
    assert.equal(inlineHtml.includes("</script><script>alert("), false);
    assert.equal(inlineHtml.includes("</style><script>alert(9)"), false);
    assert.ok(inlineHtml.includes('type="importmap"'));
    assert.ok(inlineHtml.includes("\\u003c/script\\u003e\\u003cscript\\u003ealert(1)"));

    // Non-blocking reset manager sanity check
    const mgr = createResetDailyManager(ctrlPlaceholder());
    assert.equal(mgr.isArmed(), false);
    mgr.armReset();
    assert.equal(mgr.isArmed(), true);
    mgr.cancelReset();
    assert.equal(mgr.isArmed(), false);
    mgr.dispose();

    function ctrlPlaceholder() {
      return { resetDailyVault: async () => DEFAULT_VAULT_STATE };
    }
  });

  test("Adversarial PII Leak Challenge: 37-byte receipt codec & #receipt= hash never leak secret prose or party names", () => {
    const toxicAudit = {
      documentId: "SECRET_ACME_NDA_JOHN_DOE_SSN_123-45-6789",
      docTitle: "CONFIDENTIAL Jane Doe Executive Offer",
      docCategory: "nda-contractor",
      parties: "Acme Secret Holdings LLC & John Doe",
      text: "CONFIDENTIAL SECRET_TOKEN_ALPHA: John Doe (SSN 123-45-6789) agrees to defend, indemnify, and pay $999999 to Acme Secret Holdings.",
      riskScoreBefore: 88,
      riskScoreAfter: 12,
      trapsDetected: 5,
      trapsNeutralized: 4,
      annualDollarsSaved: 1860,
      timestampUnixSec: 1795422281,
      findings: [
        {
          ruleId: "IN-01",
          categoryId: "INDEMNITY",
          matchText: "SECRET_TOKEN_ALPHA John Doe",
          rationale: "SECRET_RATIONALE_LEAK"
        },
        {
          ruleId: "IP-01",
          categoryId: "IP_GRAB",
          matchText: "Acme Secret Holdings",
          rationale: "PII_PROBE"
        }
      ]
    };

    const toxicVault = {
      ...DEFAULT_VAULT_STATE,
      defaultTone: "counsel",
      airGapLocked: true,
      activeSpecimenId: "SECRET_SPECIMEN_JOHN_DOE",
      neutralizedRuleMap: {
        [toxicAudit.documentId]: ["IN-01", "IP-01"]
      },
      sealStampedMap: {
        [toxicAudit.documentId]: true
      }
    };

    const receiptData = buildReceiptDataFromAudit(toxicAudit, toxicVault);
    const binary = encodeReceiptBinary(receiptData);
    assert.ok(binary instanceof Uint8Array);
    assert.equal(binary.length, RECEIPT_BYTE_LENGTH);
    assert.equal(binary.length, 37);
    assert.equal(binary[0], 0x43);
    assert.equal(binary[1], 0x01);
    assert.equal(binary[2] & 0x80, 0);

    // Verify FNV-1a32 integrity trailer over bytes 0..32
    const expectedTrailer = computeFnv1a32(binary.subarray(0, 33));
    const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
    assert.equal(view.getUint32(33, false), expectedTrailer);

    const hash = encodeReceiptHash(receiptData);
    assert.ok(hash.startsWith(RECEIPT_HASH_PREFIX));
    const decoded = decodeReceiptHash(hash);
    assert.ok(decoded);
    assert.equal(decoded.riskScoreBefore, 88);
    assert.equal(decoded.riskScoreAfter, 12);
    assert.equal(decoded.trapsDetected, 5);
    assert.equal(decoded.trapsNeutralized, 4);
    assert.equal(decoded.annualDollarsSaved, 1860);
    assert.equal(decoded.tone, "counsel");
    assert.equal(decoded.docCategory, "nda-contractor");
    assert.equal(decoded.sealed, true);
    assert.equal(decoded.airGapLocked, true);

    // Zero PII / zero secret prose in both hash and decoded object
    const serializedDecoded = JSON.stringify(decoded);
    const forbiddenFragments = [
      "SECRET",
      "ACME",
      "Acme",
      "JOHN",
      "John",
      "DOE",
      "Doe",
      "Jane",
      "123-45-6789",
      "ALPHA",
      "SSN",
      "CONFIDENTIAL",
      "999999",
      "RATIONALE",
      "PII_PROBE"
    ];
    for (const frag of forbiddenFragments) {
      assert.equal(hash.includes(frag), false, `Receipt hash leaked secret fragment: ${frag}`);
      assert.equal(serializedDecoded.includes(frag), false, `Decoded receipt leaked secret fragment: ${frag}`);
      const b64Frag = Buffer.from(frag, "utf8").toString("base64url").slice(0, 6);
      if (b64Frag.length >= 6) {
        assert.equal(hash.includes(b64Frag), false, `Receipt hash leaked base64 fragment for: ${frag}`);
      }
    }

    // Tampering any byte invalidates FNV-1a32 trailer
    const corrupted = new Uint8Array(binary);
    corrupted[10] ^= 0x01;
    assert.equal(decodeReceiptBinary(corrupted), null);
  });
});
