/**
 * ClauseHound Local — Zero-PII 37-Byte Receipt Codec & Negotiation Packet Exporter
 *
 * Strictly Layer 1 (zero internal or external imports).
 * Serializes audit telemetry into a fixed 37-byte big-endian binary structure
 * protected by an FNV-1a32 integrity trailer over bytes 0..32.
 */

export const RECEIPT_BYTE_LENGTH = 37;
export const RECEIPT_HASH_PREFIX = "#receipt=";

const RECEIPT_MAGIC = 0x43; // 'C'
const RECEIPT_SCHEMA_VERSION = 0x01;

const TONE_OPTIONS = Object.freeze(["collaborative", "bilateral", "counsel"]);

const TONE_LABELS = Object.freeze({
  collaborative: "Collaborative",
  bilateral: "Firm Bilateral",
  counsel: "Ironclad Counsel"
});

const CATEGORY_IDS = Object.freeze([
  "AUTO_RENEWAL",
  "INDEMNITY",
  "IP_GRAB",
  "JUNK_FEES",
  "LIABILITY_CAP",
  "UNILATERAL_MOD",
  "ARBITRATION_VENUE",
  "NON_COMPETE",
  "TERMINATION_CURE",
  "HOA_LIEN_DATA"
]);

const CATEGORY_LABELS = Object.freeze({
  AUTO_RENEWAL: "Auto-Renewal & Evergreen Lock",
  INDEMNITY: "One-Sided Indemnification",
  IP_GRAB: "IP & Pre-Existing Toolkit Grab",
  JUNK_FEES: "Junk & Hidden Recurring Fees",
  LIABILITY_CAP: "Asymmetric Liability Cap",
  UNILATERAL_MOD: "Unilateral Modification",
  ARBITRATION_VENUE: "Forced Arbitration & Venue",
  NON_COMPETE: "Restrictive Covenant / Non-Compete",
  TERMINATION_CURE: "Termination & Cure Window",
  HOA_LIEN_DATA: "HOA Lien / Fine & Data Harvest"
});

const DOC_CATEGORY_ENUM = Object.freeze([
  "residential-lease",
  "nda-contractor",
  "saas-msa",
  "hoa-covenants",
  "custom-agreement"
]);

const DOC_CATEGORY_LABELS = Object.freeze({
  "residential-lease": "Residential Lease",
  "nda-contractor": "NDA & Contractor Agreement",
  "saas-msa": "SaaS Master Services Agreement",
  "hoa-covenants": "HOA Covenants & Addenda",
  "custom-agreement": "Custom Agreement"
});

const SPECIMEN_CATEGORY_MAP = Object.freeze({
  "sterling-lease": "residential-lease",
  "apex-nda": "nda-contractor",
  "cobalt-saas-msa": "saas-msa",
  "oakridge-hoa": "hoa-covenants",
  "custom-draft": "custom-agreement"
});

const textEncoder = new TextEncoder();

/**
 * Computes an unsigned 32-bit FNV-1a hash over raw bytes.
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function fnv1a32Bytes(bytes) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    hash = Math.imul((hash ^ bytes[i]) >>> 0, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Computes an unsigned 32-bit FNV-1a hash over UTF-8 encoded text.
 * @param {string} text
 * @returns {number}
 */
function fnv1a32Text(text) {
  if (typeof text !== "string" || text.length === 0) return 0;
  return fnv1a32Bytes(textEncoder.encode(text));
}

function clampUint(value, min, max, fallback = min) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.round(num);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function resolveToneIndex(toneOrIndex) {
  if (typeof toneOrIndex === "string") {
    const idx = TONE_OPTIONS.indexOf(toneOrIndex);
    if (idx !== -1) return idx;
  }
  if (typeof toneOrIndex === "number" && Number.isInteger(toneOrIndex)) {
    if (toneOrIndex >= 0 && toneOrIndex < TONE_OPTIONS.length) {
      return toneOrIndex;
    }
  }
  return 1; // default "bilateral"
}

function resolveDocCategoryIndex(categoryOrIndex, documentId) {
  if (typeof categoryOrIndex === "string") {
    const idx = DOC_CATEGORY_ENUM.indexOf(categoryOrIndex);
    if (idx !== -1) return idx;
  }
  if (typeof categoryOrIndex === "number" && Number.isInteger(categoryOrIndex)) {
    if (categoryOrIndex >= 0 && categoryOrIndex < DOC_CATEGORY_ENUM.length) {
      return categoryOrIndex;
    }
  }
  if (typeof documentId === "string" && SPECIMEN_CATEGORY_MAP[documentId]) {
    return DOC_CATEGORY_ENUM.indexOf(SPECIMEN_CATEGORY_MAP[documentId]);
  }
  return 4; // default "custom-agreement"
}

function parseTimestampUnixSec(receiptData) {
  if (typeof receiptData?.timestampUnixSec === "number" && Number.isFinite(receiptData.timestampUnixSec)) {
    return clampUint(receiptData.timestampUnixSec, 0, 0xffffffff, 0) >>> 0;
  }
  const ts = receiptData?.timestamp;
  if (typeof ts === "number" && Number.isFinite(ts)) {
    const sec = ts > 1e12 ? Math.floor(ts / 1000) : Math.floor(ts);
    return clampUint(sec, 0, 0xffffffff, 0) >>> 0;
  }
  if (typeof ts === "string" && ts.length > 0) {
    const parsed = Date.parse(ts);
    if (Number.isFinite(parsed)) {
      return clampUint(Math.floor(parsed / 1000), 0, 0xffffffff, 0) >>> 0;
    }
  }
  return clampUint(Math.floor(Date.now() / 1000), 0, 0xffffffff, 0) >>> 0;
}

function extractCategoryVector(rawCounts, findings) {
  const counts = new Array(CATEGORY_IDS.length).fill(0);
  if (Array.isArray(rawCounts)) {
    for (let i = 0; i < CATEGORY_IDS.length; i += 1) {
      counts[i] = clampUint(rawCounts[i], 0, 255, 0);
    }
    return counts;
  }
  if (rawCounts && typeof rawCounts === "object") {
    for (let i = 0; i < CATEGORY_IDS.length; i += 1) {
      counts[i] = clampUint(rawCounts[CATEGORY_IDS[i]], 0, 255, 0);
    }
    return counts;
  }
  if (Array.isArray(findings)) {
    for (const finding of findings) {
      const idx = CATEGORY_IDS.indexOf(finding?.categoryId);
      if (idx !== -1 && counts[idx] < 255) {
        counts[idx] += 1;
      }
    }
  }
  return counts;
}

function buildCategoryCountsMap(countsArray) {
  const map = {};
  for (let i = 0; i < CATEGORY_IDS.length; i += 1) {
    map[CATEGORY_IDS[i]] = countsArray[i];
  }
  return map;
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === "function") {
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(bytes).toString("base64url");
}

function decodeBase64Url(token) {
  if (typeof token !== "string" || token.length === 0) return null;
  if (!/^[A-Za-z0-9\-_]+={0,2}$/.test(token)) return null;
  if (token.includes("=") && token.length % 4 !== 0) return null;
  const unpadded = token.replace(/=+$/, "");
  if (unpadded.length === 0 || unpadded.length % 4 === 1) return null;

  let bytes;
  try {
    if (typeof atob === "function") {
      const padded =
        unpadded.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - (unpadded.length % 4)) % 4);
      const binary = atob(padded);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
    } else {
      bytes = new Uint8Array(Buffer.from(unpadded, "base64url"));
    }
  } catch {
    return null;
  }

  // Reject non-canonical trailing padding bits in the final Base64url sextet.
  if (encodeBase64Url(bytes) !== unpadded) {
    return null;
  }
  return bytes;
}

function extractReceiptToken(hashString) {
  if (typeof hashString !== "string") return null;
  const trimmed = hashString.trim();
  if (trimmed.length === 0) return null;

  const hashIdx = trimmed.indexOf("#");
  if (hashIdx !== -1) {
    const fragment = trimmed.slice(hashIdx + 1);
    const match = fragment.match(/(?:^|&)receipt=([^&\s#]+)/);
    return match ? match[1] : null;
  }

  if (trimmed.startsWith("receipt=")) {
    const match = trimmed.match(/^receipt=([^&\s#]+)/);
    return match ? match[1] : null;
  }

  // Full URLs or query strings without a #receipt= fragment must not be parsed as raw tokens.
  if (/[/:?#=&\s]/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function formatCurrency(value) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  return `$${amount.toLocaleString("en-US")}`;
}

function toIdSet(ruleIds) {
  if (ruleIds instanceof Set) return ruleIds;
  if (Array.isArray(ruleIds)) {
    return new Set(ruleIds.filter((id) => typeof id === "string" && id.length > 0));
  }
  return null;
}

function selectFindings(findings, neutralizedRuleIds) {
  const allFindings = Array.isArray(findings) ? findings : [];
  const idSet = toIdSet(neutralizedRuleIds);
  if (!idSet) return allFindings;
  return allFindings.filter((f) => idSet.has(f?.ruleId ?? f?.id));
}

function normalizeExcisedFees(excisedFees) {
  if (!excisedFees) return [];
  if (Array.isArray(excisedFees)) {
    return excisedFees
      .map((entry) => {
        if (typeof entry === "string" && entry.trim().length > 0) {
          return { label: entry.trim(), rawAmount: "", period: "recurring", annualizedDollars: 0 };
        }
        if (entry && typeof entry === "object") {
          const label = entry.label || entry.feeKey || "Recurring Surcharge";
          return {
            label: String(label),
            rawAmount: entry.rawAmount ? String(entry.rawAmount) : "",
            period: entry.period ? String(entry.period) : "monthly",
            annualizedDollars: Math.max(0, Number(entry.annualizedDollars) || 0)
          };
        }
        return null;
      })
      .filter(Boolean);
  }
  if (excisedFees instanceof Set) {
    return Array.from(excisedFees)
      .filter((k) => typeof k === "string" && k.length > 0)
      .map((k) => ({ label: k, rawAmount: "", period: "recurring", annualizedDollars: 0 }));
  }
  if (typeof excisedFees === "object") {
    return Object.entries(excisedFees)
      .filter(([, active]) => Boolean(active))
      .map(([k]) => ({ label: k, rawAmount: "", period: "recurring", annualizedDollars: 0 }));
  }
  return [];
}

function resolveFindingReplacement(finding, tone) {
  const redlines = finding?.redlines;
  if (redlines && typeof redlines === "object") {
    return redlines[tone] || redlines.bilateral || redlines.collaborative || redlines.counsel || "";
  }
  return typeof finding?.replacementText === "string" ? finding.replacementText : "";
}

function computeAnnualSavings(explicitSavings, selectedFindings, normalizedFees) {
  if (typeof explicitSavings === "number" && Number.isFinite(explicitSavings) && explicitSavings >= 0) {
    return Math.round(explicitSavings);
  }
  let total = 0;
  for (const fee of normalizedFees) {
    total += fee.annualizedDollars;
  }
  if (total === 0) {
    for (const finding of selectedFindings) {
      const est = Number(finding?.annualFeeEstimate);
      if (Number.isFinite(est) && est > 0) {
        total += est;
      }
    }
  }
  return Math.round(total);
}

/**
 * Encodes a ReceiptData payload into the exact 37-byte Zero-PII binary layout.
 * Raw contract prose and party strings are never serialized; only fixed
 * numeric metrics, enum indices, 10-bit category flags, and digests enter.
 *
 * @param {object} [receiptData]
 * @returns {Uint8Array}
 */
export function encodeReceiptBinary(receiptData = {}) {
  const src = receiptData && typeof receiptData === "object" ? receiptData : {};
  const bytes = new Uint8Array(RECEIPT_BYTE_LENGTH);
  const view = new DataView(bytes.buffer);

  const airGapLocked = src.airGapLocked === undefined ? true : Boolean(src.airGapLocked);
  const sealed = Boolean(src.sealed);
  const toneIndex = resolveToneIndex(src.tone ?? src.toneIndex);
  const docCategoryIndex = resolveDocCategoryIndex(src.docCategory ?? src.docCategoryIndex, src.documentId);

  const flags =
    (airGapLocked ? 0x01 : 0) |
    (sealed ? 0x02 : 0) |
    ((toneIndex & 0x03) << 2) |
    ((docCategoryIndex & 0x07) << 4);

  const riskScoreBefore = clampUint(src.riskScoreBefore ?? src.riskScore, 0, 100, 0);
  const riskScoreAfter = clampUint(src.riskScoreAfter, 0, 100, riskScoreBefore);
  const trapsDetected = clampUint(src.trapsDetected, 0, 0xffff, 0);
  const trapsNeutralized = clampUint(src.trapsNeutralized, 0, 0xffff, 0);
  const annualDollarsSaved = clampUint(src.annualDollarsSaved ?? src.annualSavings, 0, 0xffffffff, 0) >>> 0;
  const timestampUnixSec = parseTimestampUnixSec(src);

  let docDigestFnv1a = 0;
  if (typeof src.docDigestFnv1a === "number" && Number.isFinite(src.docDigestFnv1a)) {
    docDigestFnv1a = src.docDigestFnv1a >>> 0;
  } else if (typeof src.text === "string") {
    docDigestFnv1a = fnv1a32Text(src.text);
  } else if (typeof src.scannedText === "string") {
    docDigestFnv1a = fnv1a32Text(src.scannedText);
  }

  const categoryVector = extractCategoryVector(src.categoryCounts ?? src.categoryBreakdown, src.findings);
  let categoryMask =
    typeof src.categoryMask === "number" && Number.isFinite(src.categoryMask)
      ? src.categoryMask & 0x03ff
      : 0;
  for (let i = 0; i < CATEGORY_IDS.length; i += 1) {
    if (categoryVector[i] > 0) {
      categoryMask |= 1 << i;
    }
  }
  categoryMask &= 0x03ff;

  bytes[0] = RECEIPT_MAGIC;
  bytes[1] = RECEIPT_SCHEMA_VERSION;
  bytes[2] = flags;
  bytes[3] = riskScoreBefore;
  bytes[4] = riskScoreAfter;
  view.setUint16(5, trapsDetected, false);
  view.setUint16(7, trapsNeutralized, false);
  view.setUint32(9, annualDollarsSaved, false);
  view.setUint32(13, timestampUnixSec, false);
  view.setUint32(17, docDigestFnv1a, false);
  view.setUint16(21, categoryMask, false);
  for (let i = 0; i < CATEGORY_IDS.length; i += 1) {
    bytes[23 + i] = categoryVector[i];
  }

  const trailer = fnv1a32Bytes(bytes.subarray(0, 33));
  view.setUint32(33, trailer, false);
  return bytes;
}

/**
 * Decodes and verifies a 37-byte receipt buffer.
 * Returns null on invalid length, header mismatch, invalid enum indices,
 * reserved bit tampering, or FNV-1a32 trailer verification failure.
 *
 * @param {Uint8Array} bytes
 * @returns {object | null}
 */
export function decodeReceiptBinary(bytes) {
  const isUint8 =
    bytes instanceof Uint8Array || Object.prototype.toString.call(bytes) === "[object Uint8Array]";
  if (!isUint8 || bytes.length !== RECEIPT_BYTE_LENGTH) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = bytes[0];
  const schemaVersion = bytes[1];
  if (magic !== RECEIPT_MAGIC || schemaVersion !== RECEIPT_SCHEMA_VERSION) {
    return null;
  }

  const flags = bytes[2];
  if ((flags & 0x80) !== 0) {
    return null;
  }

  const toneIndex = (flags >> 2) & 0x03;
  const docCategoryIndex = (flags >> 4) & 0x07;
  if (toneIndex >= TONE_OPTIONS.length || docCategoryIndex >= DOC_CATEGORY_ENUM.length) {
    return null;
  }

  const riskScoreBefore = bytes[3];
  const riskScoreAfter = bytes[4];
  if (riskScoreBefore > 100 || riskScoreAfter > 100) {
    return null;
  }

  const categoryMask = view.getUint16(21, false);
  if ((categoryMask & ~0x03ff) !== 0) {
    return null;
  }

  const expectedTrailer = fnv1a32Bytes(bytes.subarray(0, 33));
  const actualTrailer = view.getUint32(33, false);
  if (actualTrailer !== expectedTrailer) {
    return null;
  }

  const countsVector = new Array(CATEGORY_IDS.length);
  for (let i = 0; i < CATEGORY_IDS.length; i += 1) {
    countsVector[i] = bytes[23 + i];
  }

  return {
    magic,
    schemaVersion,
    airGapLocked: (flags & 0x01) !== 0,
    sealed: (flags & 0x02) !== 0,
    toneIndex,
    tone: TONE_OPTIONS[toneIndex],
    docCategoryIndex,
    docCategory: DOC_CATEGORY_ENUM[docCategoryIndex],
    riskScoreBefore,
    riskScoreAfter,
    trapsDetected: view.getUint16(5, false),
    trapsNeutralized: view.getUint16(7, false),
    annualDollarsSaved: view.getUint32(9, false),
    timestampUnixSec: view.getUint32(13, false),
    docDigestFnv1a: view.getUint32(17, false),
    categoryMask,
    categoryCounts: buildCategoryCountsMap(countsVector),
    integrityTrailer: actualTrailer
  };
}

/**
 * Encodes a ReceiptData payload as `#receipt=<base64url(37 bytes)>`.
 *
 * @param {object} receiptData
 * @returns {string}
 */
export function encodeReceiptHash(receiptData) {
  return RECEIPT_HASH_PREFIX + encodeBase64Url(encodeReceiptBinary(receiptData));
}

/**
 * Decodes a full URL, `#receipt=...` hash fragment, or raw Base64url receipt token.
 * Returns null safely on any malformed or tampered input.
 *
 * @param {string} hashString
 * @returns {object | null}
 */
export function decodeReceiptHash(hashString) {
  const token = extractReceiptToken(hashString);
  if (!token) return null;
  const bytes = decodeBase64Url(token);
  if (!bytes) return null;
  return decodeReceiptBinary(bytes);
}

/**
 * Projects an audit result and VaultState into a strictly whitelisted,
 * zero-PII canonical ReceiptData object ready for hashing or Canvas rendering.
 *
 * @param {object} [auditResult]
 * @param {object} [vaultState]
 * @returns {object}
 */
export function buildReceiptDataFromAudit(auditResult = {}, vaultState = {}) {
  const audit = auditResult && typeof auditResult === "object" ? auditResult : {};
  const vault = vaultState && typeof vaultState === "object" ? vaultState : {};

  const docId =
    typeof audit.documentId === "string" && audit.documentId.length > 0
      ? audit.documentId
      : typeof vault.activeSpecimenId === "string"
        ? vault.activeSpecimenId
        : "";

  const findings = Array.isArray(audit.findings) ? audit.findings : [];
  const neutralizedSet =
    toIdSet(audit.neutralizedRuleIds) ||
    (docId && toIdSet(vault.neutralizedRuleMap?.[docId])) ||
    new Set();

  const categoryCountsRaw =
    audit.categoryCounts ?? audit.categoryBreakdown ?? audit.summary?.categoryBreakdown;
  const categoryVector = extractCategoryVector(categoryCountsRaw, findings);
  const categoryCounts = buildCategoryCountsMap(categoryVector);
  let categoryMask = 0;
  for (let i = 0; i < CATEGORY_IDS.length; i += 1) {
    if (categoryVector[i] > 0) {
      categoryMask |= 1 << i;
    }
  }

  const trapsDetected = clampUint(
    audit.trapsDetected ??
      (findings.length > 0
        ? findings.length
        : categoryVector.reduce((acc, n) => acc + n, 0)),
    0,
    0xffff,
    0
  );

  let trapsNeutralized = 0;
  if (typeof audit.trapsNeutralized === "number" && Number.isFinite(audit.trapsNeutralized)) {
    trapsNeutralized = clampUint(audit.trapsNeutralized, 0, 0xffff, 0);
  } else if (typeof audit.appliedCount === "number" && Number.isFinite(audit.appliedCount)) {
    trapsNeutralized = clampUint(audit.appliedCount, 0, 0xffff, 0);
  } else if (findings.length > 0) {
    let count = 0;
    for (const f of findings) {
      if (neutralizedSet.has(f?.ruleId ?? f?.id)) count += 1;
    }
    trapsNeutralized = clampUint(count, 0, 0xffff, 0);
  } else {
    trapsNeutralized = clampUint(neutralizedSet.size, 0, 0xffff, 0);
  }

  const fallbackRiskBefore = findings.reduce(
    (sum, f) => sum + Math.max(0, Number(f?.riskPoints) || 0),
    0
  );
  const riskScoreBefore = clampUint(
    audit.riskScoreBefore ?? audit.riskScore ?? audit.summary?.riskScore ?? fallbackRiskBefore,
    0,
    100,
    0
  );

  let riskScoreAfter = riskScoreBefore;
  if (typeof audit.riskScoreAfter === "number" && Number.isFinite(audit.riskScoreAfter)) {
    riskScoreAfter = clampUint(audit.riskScoreAfter, 0, 100, riskScoreBefore);
  } else if (typeof audit.afterRiskScore === "number" && Number.isFinite(audit.afterRiskScore)) {
    riskScoreAfter = clampUint(audit.afterRiskScore, 0, 100, riskScoreBefore);
  } else if (findings.length > 0 && neutralizedSet.size > 0) {
    const remainingRisk = findings.reduce(
      (sum, f) =>
        neutralizedSet.has(f?.ruleId ?? f?.id) ? sum : sum + Math.max(0, Number(f?.riskPoints) || 0),
      0
    );
    riskScoreAfter = clampUint(remainingRisk, 0, 100, riskScoreBefore);
  }

  let annualDollarsSaved = 0;
  if (typeof audit.annualDollarsSaved === "number" && Number.isFinite(audit.annualDollarsSaved)) {
    annualDollarsSaved = audit.annualDollarsSaved;
  } else if (typeof audit.annualSavings === "number" && Number.isFinite(audit.annualSavings)) {
    annualDollarsSaved = audit.annualSavings;
  } else {
    const excisedMap = vault.excisedFeeMap && typeof vault.excisedFeeMap === "object" ? vault.excisedFeeMap : {};
    const excisedSet = toIdSet(audit.excisedFeeKeys);
    const fees = Array.isArray(audit.fees) ? audit.fees : [];
    for (const fee of fees) {
      const key = fee?.feeKey;
      if ((excisedSet && excisedSet.has(key)) || (key && excisedMap[key])) {
        annualDollarsSaved += Math.max(0, Number(fee?.annualizedDollars) || 0);
      }
    }
    for (const f of findings) {
      if (neutralizedSet.has(f?.ruleId ?? f?.id)) {
        annualDollarsSaved += Math.max(0, Number(f?.annualFeeEstimate) || 0);
      }
    }
  }

  let docDigestFnv1a = 0;
  if (typeof audit.docDigestFnv1a === "number" && Number.isFinite(audit.docDigestFnv1a)) {
    docDigestFnv1a = audit.docDigestFnv1a >>> 0;
  } else {
    const rawText =
      audit.text ?? audit.originalText ?? audit.documentText ?? audit.scannedText ?? "";
    if (typeof rawText === "string" && rawText.length > 0) {
      docDigestFnv1a = fnv1a32Text(rawText);
    }
  }

  const airGapLocked =
    typeof audit.airGapLocked === "boolean"
      ? audit.airGapLocked
      : typeof vault.airGapLocked === "boolean"
        ? vault.airGapLocked
        : true;

  const sealed =
    typeof audit.sealed === "boolean"
      ? audit.sealed
      : Boolean(docId && vault.sealStampedMap?.[docId]);

  const toneIndex = resolveToneIndex(audit.tone ?? audit.toneIndex ?? vault.defaultTone);
  const docCategoryIndex = resolveDocCategoryIndex(
    audit.docCategory ?? audit.docCategoryIndex,
    docId
  );

  // Round-trip through binary codec to guarantee strict whitelist zero-PII shape.
  const binary = encodeReceiptBinary({
    airGapLocked,
    sealed,
    toneIndex,
    docCategoryIndex,
    riskScoreBefore,
    riskScoreAfter,
    trapsDetected,
    trapsNeutralized,
    annualDollarsSaved: clampUint(annualDollarsSaved, 0, 0xffffffff, 0),
    timestampUnixSec: parseTimestampUnixSec(audit),
    docDigestFnv1a,
    categoryMask,
    categoryCounts
  });
  return decodeReceiptBinary(binary);
}

/**
 * Generates an executive-grade, polite numbered counterparty negotiation email
 * calibrated to the selected tone and neutralized clauses / excised fees.
 *
 * @param {object} [params]
 * @returns {{ subject: string, body: string, clauseCount: number, annualSavings: number }}
 */
export function composeNegotiationEmail({
  docTitle = "Proposed Agreement",
  docCategory = "custom-agreement",
  tone = "bilateral",
  findings = [],
  neutralizedRuleIds,
  excisedFees = [],
  annualSavings
} = {}) {
  const activeTone = TONE_OPTIONS[resolveToneIndex(tone)];
  const title =
    typeof docTitle === "string" && docTitle.trim().length > 0
      ? docTitle.trim()
      : "Proposed Agreement";
  const categoryKey = DOC_CATEGORY_ENUM[resolveDocCategoryIndex(docCategory)];
  const categoryLabel = DOC_CATEGORY_LABELS[categoryKey];

  const selectedFindings = selectFindings(findings, neutralizedRuleIds);
  const normalizedFees = normalizeExcisedFees(excisedFees);
  const totalSavings = computeAnnualSavings(annualSavings, selectedFindings, normalizedFees);
  const clauseCount = selectedFindings.length + normalizedFees.length;

  const itemSummary = `${clauseCount} ${clauseCount === 1 ? "Revision" : "Revisions"}`;
  let subject;
  let opening;
  let closing;

  if (activeTone === "collaborative") {
    subject = `Proposed Mutual Adjustments — ${title} (${itemSummary})`;
    opening =
      `Thank you for sharing the draft ${categoryLabel} ("${title}"). ` +
      `We appreciate the partnership and are eager to finalize promptly. ` +
      `To keep terms balanced for both parties, we respectfully propose the following targeted updates:`;
    closing =
      "We hope these practical adjustments work well for your team. " +
      "Please share an updated execution draft or let us know a good time to align on any remaining details.";
  } else if (activeTone === "counsel") {
    subject = `Formal Redline Revisions Required — ${title} (${itemSummary})`;
    opening =
      `Following legal and commercial review of the proposed ${categoryLabel} ("${title}"), ` +
      `execution is conditioned upon incorporating the numbered revisions set forth below ` +
      `to establish symmetric risk allocation, clear statutory notice windows, and transparent pricing:`;
    closing =
      "Kindly confirm acceptance of each numbered revision or circulate a clean redlined counterpart reflecting these updates for final review.";
  } else {
    subject = `Counter-Proposal & Redline Summary — ${title} (${itemSummary})`;
    opening =
      `Thank you for sending over the ${categoryLabel} ("${title}"). ` +
      `We are prepared to move forward upon addressing the ${clauseCount} bilateral items outlined below ` +
      `so risk, termination rights, and fee commitments remain fair and predictable on both sides:`;
    closing =
      "Please confirm if these bilateral updates are acceptable so we can incorporate them and proceed directly to signature.";
  }

  const lines = ["Dear Counterparty Team,", "", opening, ""];

  if (clauseCount === 0) {
    lines.push(
      "No outstanding clause revisions or recurring add-on fee objections are currently flagged for modification."
    );
    lines.push("");
  } else {
    let itemNumber = 1;
    for (const finding of selectedFindings) {
      const findingTitle = finding?.title || finding?.ruleId || `Clause Item ${itemNumber}`;
      const catLabel = CATEGORY_LABELS[finding?.categoryId] || finding?.categoryId || "Contract Provision";
      const replacement = resolveFindingReplacement(finding, activeTone);
      lines.push(`${itemNumber}. ${findingTitle} [${catLabel}]`);
      if (finding?.rationale) {
        lines.push(`   Issue: ${finding.rationale}`);
      }
      if (replacement) {
        lines.push(`   Proposed Language: "${replacement}"`);
      }
      lines.push("");
      itemNumber += 1;
    }

    for (const fee of normalizedFees) {
      const amountDesc = fee.rawAmount ? ` (${fee.rawAmount})` : "";
      const annualDesc =
        fee.annualizedDollars > 0 ? ` — ${formatCurrency(fee.annualizedDollars)}/yr` : "";
      lines.push(`${itemNumber}. Recurring Fee Removal: ${fee.label}${amountDesc}${annualDesc}`);
      lines.push(
        "   Proposed Adjustment: Remove this mandatory add-on surcharge or confirm in writing that all base services are included in the stated headline rate with zero ancillary billing fees."
      );
      lines.push("");
      itemNumber += 1;
    }
  }

  if (totalSavings > 0) {
    lines.push(
      `Commercial Summary: Removing the flagged ancillary charges reduces total annualized commitment by ${formatCurrency(totalSavings)}/yr.`
    );
    lines.push("");
  }

  lines.push(closing, "", "Best regards,");

  return {
    subject,
    body: lines.join("\n"),
    clauseCount,
    annualSavings: totalSavings
  };
}

function preparePacketContext(params) {
  const {
    docTitle = "Proposed Agreement",
    originalText = "",
    redlinedText = "",
    findings = [],
    neutralizedRuleIds,
    tone = "bilateral",
    annualSavings = 0,
    riskScoreBefore = 0,
    riskScoreAfter
  } = params && typeof params === "object" ? params : {};

  const activeTone = TONE_OPTIONS[resolveToneIndex(tone)];
  const title =
    typeof docTitle === "string" && docTitle.trim().length > 0
      ? docTitle.trim()
      : "Proposed Agreement";
  const allFindings = Array.isArray(findings) ? findings : [];
  const neutralizedSet = toIdSet(neutralizedRuleIds) || new Set();
  const normalizedFindings = allFindings.map((finding, index) => {
    const ruleId = finding?.ruleId ?? finding?.id ?? `CLAUSE-${index + 1}`;
    return {
      ruleId,
      status: neutralizedSet.has(ruleId) ? "NEUTRALIZED" : "OPEN",
      title: finding?.title || ruleId,
      categoryLabel: CATEGORY_LABELS[finding?.categoryId] || finding?.categoryId || "General",
      severity: String(finding?.severity || "medium").toUpperCase(),
      rationale: finding?.rationale || "",
      excerpt: finding?.excerpt || finding?.matchText || "",
      replacement: resolveFindingReplacement(finding, activeTone)
    };
  });

  const beforeRisk = clampUint(riskScoreBefore, 0, 100, 0);
  const afterRisk = clampUint(riskScoreAfter, 0, 100, beforeRisk);

  return {
    activeTone,
    toneLabel: TONE_LABELS[activeTone],
    title,
    findings: normalizedFindings,
    neutralizedCount: normalizedFindings.filter((item) => item.status === "NEUTRALIZED").length,
    beforeRisk,
    afterRisk,
    beforeSafety: 100 - beforeRisk,
    afterSafety: 100 - afterRisk,
    savingsFormatted: formatCurrency(annualSavings),
    originalText: typeof originalText === "string" ? originalText.trimEnd() : "",
    redlinedText: typeof redlinedText === "string" ? redlinedText.trimEnd() : ""
  };
}

/**
 * Exports a clean Markdown audit & counter-draft packet suitable for offline review.
 *
 * @param {object} [params]
 * @returns {string}
 */
export function exportMarkdownPacket(params = {}) {
  const ctx = preparePacketContext(params);
  const lines = [
    "# ClauseHound Local — Audit & Counter-Draft Packet",
    "",
    `- **Document:** ${ctx.title}`,
    `- **Counter-Draft Tone:** ${ctx.toneLabel} (\`${ctx.activeTone}\`)`,
    `- **Safety Score:** ${ctx.beforeSafety}/100 -> ${ctx.afterSafety}/100 (Risk: ${ctx.beforeRisk} -> ${ctx.afterRisk})`,
    `- **Traps Detected:** ${ctx.findings.length}`,
    `- **Traps Neutralized:** ${ctx.neutralizedCount}`,
    `- **Estimated Annual Savings:** ${ctx.savingsFormatted}/yr`,
    "- **Privacy Boundary:** Local Zero-Backend Processing (0.0 KB Outbound)",
    "",
    "## Numbered Findings & Bilateral Redlines",
    ""
  ];

  if (ctx.findings.length === 0) {
    lines.push("_No trap clauses detected in this document._", "");
  } else {
    ctx.findings.forEach((item, index) => {
      lines.push(`### ${index + 1}. [${item.status}] ${item.title} (\`${item.ruleId}\`)`);
      lines.push(`- **Category:** ${item.categoryLabel}`);
      lines.push(`- **Severity:** ${item.severity}`);
      if (item.rationale) {
        lines.push(`- **Rationale:** ${item.rationale}`);
      }
      if (item.excerpt) {
        lines.push(`- **Flagged Excerpt:** > ${item.excerpt}`);
      }
      if (item.replacement) {
        lines.push(`- **Proposed Redline (${ctx.toneLabel}):** ${item.replacement}`);
      }
      lines.push("");
    });
  }

  if (ctx.redlinedText.length > 0) {
    lines.push("## Counter-Draft Text (Redlined)", "", "```text", ctx.redlinedText, "```", "");
  }

  if (ctx.originalText.length > 0) {
    lines.push("## Original Baseline Text", "", "```text", ctx.originalText, "```", "");
  }

  return lines.join("\n");
}

/**
 * Exports a clean plain-text audit & counter-draft packet suitable for .txt downloads.
 *
 * @param {object} [params]
 * @returns {string}
 */
export function exportPlaintextPacket(params = {}) {
  const ctx = preparePacketContext(params);
  const divider = "========================================================================";
  const subDivider = "------------------------------------------------------------------------";

  const lines = [
    divider,
    "CLAUSEHOUND LOCAL — CONTRACT AUDIT & COUNTER-DRAFT PACKET",
    divider,
    `Document:           ${ctx.title}`,
    `Counter-Draft Tone: ${ctx.toneLabel} (${ctx.activeTone})`,
    `Safety Score:       ${ctx.beforeSafety}/100 -> ${ctx.afterSafety}/100 (Risk: ${ctx.beforeRisk} -> ${ctx.afterRisk})`,
    `Traps Detected:     ${ctx.findings.length}`,
    `Traps Neutralized:  ${ctx.neutralizedCount}`,
    `Annual Savings:     ${ctx.savingsFormatted}/yr`,
    "Privacy Boundary:   Zero-Backend Local Audit (0.0 KB Outbound)",
    "",
    "1. NUMBERED FINDINGS & REDLINES",
    subDivider
  ];

  if (ctx.findings.length === 0) {
    lines.push("No trap clauses detected in this document.", "");
  } else {
    ctx.findings.forEach((item, index) => {
      lines.push(`${index + 1}. [${item.status}] ${item.title} (${item.ruleId})`);
      lines.push(`   Category: ${item.categoryLabel} | Severity: ${item.severity}`);
      if (item.rationale) {
        lines.push(`   Rationale: ${item.rationale}`);
      }
      if (item.excerpt) {
        lines.push(`   Flagged Text: "${item.excerpt}"`);
      }
      if (item.replacement) {
        lines.push(`   Proposed Redline: "${item.replacement}"`);
      }
      lines.push("");
    });
  }

  if (ctx.redlinedText.length > 0) {
    lines.push("2. COUNTER-DRAFT TEXT (REDLINED)", subDivider, ctx.redlinedText, "");
  }

  if (ctx.originalText.length > 0) {
    lines.push("3. ORIGINAL BASELINE TEXT", subDivider, ctx.originalText, "");
  }

  return lines.join("\n");
}
