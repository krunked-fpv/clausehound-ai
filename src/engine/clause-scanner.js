/**
 * ClauseHound Local — Deterministic Contract Scanner, Fee Extractor & Local Ingestors
 * Pure ES module with zero network calls and exact raw-offset preservation.
 */

import {
  CATEGORY_IDS,
  CATEGORY_METADATA,
  CLAUSE_RULES,
  DOC_CATEGORY_ENUM
} from "./clause-rules.js";

const SEVERITY_RANK = Object.freeze({
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
});

const VALID_DOC_CATEGORIES = new Set(DOC_CATEGORY_ENUM);

const NEEDS_NORMALIZATION_RX =
  /[\u200B-\u200D\uFEFF\u00AD\u2060\u2018-\u201F\u2032\u2033\u2010-\u2015\u2212\u00A0\u2000-\u200A\u202F\u205F\u3000\r]/;

const COMPILED_GLOBAL_RULES = CLAUSE_RULES.map((rule) => {
  const flags = rule.pattern.flags.includes("g")
    ? rule.pattern.flags
    : `${rule.pattern.flags}g`;
  return {
    rule,
    globalPattern: new RegExp(rule.pattern.source, flags)
  };
});

const RECURRING_FEE_RX =
  /\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:\/\s*(mo(?:nth)?|yr|year|day|wk|week)\b|(?:per\s+(month|year|day|week)\b)|\b(monthly|annually|annual|yearly|daily)\b)/gi;

const ONE_TIME_FEE_RX =
  /\b(?:non-refundable\s+(?:move-in|redecorating|application|lease\s+prep(?:aration)?|admin(?:istrative)?)|data\s+(?:export|extraction|migration)|de-?boarding|initiation|onboarding)\s+fee\s+(?:of\s+)?\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/gi;

const JUNK_FEE_INDICATOR_RX =
  /\b(?:valet\s+trash|doorstep\s+waste|smart[- ]lock|package\s+locker|technology\s+bundle|admin(?:istrative)?(?:\s+billing)?\s+fee|ledger|pest\s+control|amenity\s+surcharge|bundled\s+cable|bulk\s+(?:fiber|internet|cable)|convenience\s+fee|portal\s+fee|ach\s+fee|surcharge|aesthetic|fine|penalty|re-?letting|non-refundable|de-?boarding|extraction\s+fee|mandatory\s+parking)\b/i;

const BASE_RENT_EXCLUSION_RX =
  /\b(?:base\s+(?:monthly\s+)?rent|monthly\s+rent\s+(?:for\s+the\s+premises|is)|security\s+deposit|retainer\s+of|salary\s+of|hourly\s+rate)\b/i;

const utf8Decoder = new TextDecoder("utf-8", { fatal: false });
const utf8Encoder = new TextEncoder();

/**
 * Normalizes obfuscated zero-width chars, smart quotes, smart dashes, and non-breaking spaces
 * while recording an exact raw-character offset map.
 * @param {string} rawText
 * @returns {{ normalized: string, mapSpan: (normStart: number, normEnd: number) => [number, number] }}
 */
function normalizeWithOffsets(rawText) {
  if (!NEEDS_NORMALIZATION_RX.test(rawText)) {
    return {
      normalized: rawText,
      mapSpan: (s, e) => [s, e]
    };
  }

  const len = rawText.length;
  const rawIndexForNorm = new Int32Array(len);
  const chars = [];
  let normLen = 0;

  for (let i = 0; i < len; i += 1) {
    const code = rawText.charCodeAt(i);
    // Zero-width / soft-hyphen / word-joiner / BOM / CR before LF
    if (
      code === 0x200b ||
      code === 0x200c ||
      code === 0x200d ||
      code === 0xfeff ||
      code === 0x00ad ||
      code === 0x2060
    ) {
      continue;
    }
    if (code === 0x0d) {
      if (i + 1 < len && rawText.charCodeAt(i + 1) === 0x0a) {
        continue;
      }
      rawIndexForNorm[normLen] = i;
      chars.push("\n");
      normLen += 1;
      continue;
    }

    let mapped = rawText[i];
    if (
      code === 0x2018 ||
      code === 0x2019 ||
      code === 0x201a ||
      code === 0x201b ||
      code === 0x2032
    ) {
      mapped = "'";
    } else if (
      code === 0x201c ||
      code === 0x201d ||
      code === 0x201e ||
      code === 0x201f ||
      code === 0x2033
    ) {
      mapped = '"';
    } else if ((code >= 0x2010 && code <= 0x2015) || code === 0x2212) {
      mapped = "-";
    } else if (
      code === 0x00a0 ||
      (code >= 0x2000 && code <= 0x200a) ||
      code === 0x202f ||
      code === 0x205f ||
      code === 0x3000
    ) {
      mapped = " ";
    }

    rawIndexForNorm[normLen] = i;
    chars.push(mapped);
    normLen += 1;
  }

  const normalized = chars.join("");
  return {
    normalized,
    mapSpan(normStart, normEnd) {
      if (normLen === 0 || normStart >= normLen) {
        return [len, len];
      }
      const safeStart = Math.max(0, normStart);
      const rawStart = rawIndexForNorm[safeStart];
      if (normEnd <= safeStart) {
        return [rawStart, rawStart];
      }
      const lastNormIdx = Math.min(normLen - 1, normEnd - 1);
      const rawEnd = rawIndexForNorm[lastNormIdx] + 1;
      return [rawStart, rawEnd];
    }
  };
}

function inferDocCategory(lowerText) {
  let leaseScore = 0;
  let ndaScore = 0;
  let saasScore = 0;
  let hoaScore = 0;

  if (lowerText.includes("landlord") || lowerText.includes("resident")) leaseScore += 2;
  if (lowerText.includes("premises") || lowerText.includes("security deposit")) leaseScore += 2;
  if (lowerText.includes("contractor") || lowerText.includes("work-made-for-hire")) ndaScore += 2;
  if (lowerText.includes("confidential") || lowerText.includes("non-solicitation")) ndaScore += 1;
  if (lowerText.includes("saas") || lowerText.includes("subscription")) saasScore += 2;
  if (lowerText.includes("service level") || lowerText.includes("subprocessor")) saasScore += 2;
  if (lowerText.includes("association") || lowerText.includes("lot owner")) hoaScore += 2;
  if (lowerText.includes("architectural") || lowerText.includes("covenants")) hoaScore += 2;

  const best = Math.max(leaseScore, ndaScore, saasScore, hoaScore);
  if (best < 2) return "custom-agreement";
  if (best === leaseScore) return "residential-lease";
  if (best === ndaScore) return "nda-contractor";
  if (best === saasScore) return "saas-msa";
  return "hoa-covenants";
}

function buildExcerpt(rawText, startOffset, endOffset) {
  const preStart = Math.max(0, startOffset - 36);
  const postEnd = Math.min(rawText.length, endOffset + 36);
  const prefix = preStart > 0 ? "..." : "";
  const suffix = postEnd < rawText.length ? "..." : "";
  return `${prefix}${rawText.slice(preStart, postEnd).replace(/\s+/g, " ").trim()}${suffix}`;
}

function getContainingClauseBounds(text, startIdx, endIdx) {
  let left = startIdx;
  while (left > 0) {
    const ch = text[left - 1];
    if (ch === "\n" || ch === "." || ch === ";") break;
    left -= 1;
  }
  while (left < startIdx && /\s/.test(text[left])) {
    left += 1;
  }

  let right = endIdx;
  while (right < text.length) {
    const ch = text[right];
    if (ch === "\n") break;
    if (ch === "." || ch === ";") {
      // Avoid breaking inside decimal dollar amounts like $45.00
      const prevDigit = right > 0 && /\d/.test(text[right - 1]);
      const nextDigit = right + 1 < text.length && /\d/.test(text[right + 1]);
      if (!(ch === "." && prevDigit && nextDigit)) {
        right += 1;
        break;
      }
    }
    right += 1;
  }
  while (right > endIdx && /[ \t]/.test(text[right - 1])) {
    right -= 1;
  }
  return [left, right];
}

function slugifyLabel(label) {
  return String(label || "fee")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "fee";
}

function deriveFeeLabel(clauseText, fallbackPeriod) {
  const lower = clauseText.toLowerCase();
  if (lower.includes("valet trash")) return "Valet Trash Surcharge";
  if (lower.includes("smart-lock") || lower.includes("smart lock") || lower.includes("package locker")) {
    return "Smart-Lock & Package Bundle";
  }
  if (lower.includes("admin") && lower.includes("billing")) return "Monthly Admin Billing Fee";
  if (lower.includes("pest") && lower.includes("amenity")) return "Pest & Amenity Surcharge";
  if (lower.includes("cable") || lower.includes("fiber")) return "Bundled Cable & Fiber Fee";
  if (lower.includes("aesthetic") || lower.includes("violation")) return "Compounding Aesthetic Fine";
  if (lower.includes("de-boarding") || lower.includes("extraction")) return "Data Export / De-Boarding Fee";
  if (lower.includes("portal") || lower.includes("convenience")) return "Portal Convenience Fee";
  if (lower.includes("pest control")) return "Mandatory Pest Control Fee";
  if (lower.includes("amenity")) return "Amenity Recovery Surcharge";
  if (lower.includes("non-refundable")) return "Non-Refundable Junk Fee";
  if (lower.includes("late fee") || lower.includes("late")) return "Compounding Late Fee";
  if (lower.includes("admin")) return "Administrative Fee";
  if (lower.includes("fine")) return "Compounding Violation Fine";

  const cleaned = clauseText
    .replace(/\([^)]*\)/g, " ")
    .replace(/\$[\d,.]+(?:\s*\/\s*\w+|\s+per\s+\w+|\s+(?:monthly|annually|daily))?/gi, " ")
    .replace(/\b(?:resident|tenant|customer|every\s+lot\s+owner|lot\s+owner|owner|landlord|shall|pay|a|an|the|mandatory|non-optional|monthly|per|month|of|is|enrolled|in|assesses)\b/gi, " ")
    .replace(/[^a-zA-Z0-9&/\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length >= 4) {
    return cleaned.split(" ").slice(0, 5).join(" ");
  }
  return `Recurring ${fallbackPeriod} fee`;
}

function normalizePeriod(unitRaw) {
  const u = String(unitRaw || "").toLowerCase();
  if (u === "mo" || u === "month" || u === "monthly") return "monthly";
  if (u === "yr" || u === "year" || u === "annual" || u === "annually" || u === "yearly") {
    return "annual";
  }
  if (u === "day" || u === "daily") return "daily";
  if (u === "wk" || u === "week") return "annual";
  return "monthly";
}

function annualizeAmount(amount, period, unitRaw) {
  const u = String(unitRaw || "").toLowerCase();
  if (u === "wk" || u === "week") return Math.round(amount * 52 * 100) / 100;
  if (period === "monthly") return Math.round(amount * 12 * 100) / 100;
  if (period === "daily") return Math.round(amount * 365 * 100) / 100;
  return Math.round(amount * 100) / 100;
}

function extractFeesWithNorm(rawText, normCtx) {
  const { normalized, mapSpan } = normCtx;
  if (!normalized || !normalized.includes("$")) return [];

  const rawCandidates = [];

  RECURRING_FEE_RX.lastIndex = 0;
  let match;
  while ((match = RECURRING_FEE_RX.exec(normalized)) !== null) {
    const rawAmount = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) continue;
    const unitRaw = match[2] || match[3] || match[4] || "mo";
    const period = normalizePeriod(unitRaw);
    const annualizedDollars = annualizeAmount(rawAmount, period, unitRaw);
    rawCandidates.push({
      matchStart: match.index,
      matchEnd: match.index + match[0].length,
      rawAmount,
      period,
      annualizedDollars
    });
  }

  ONE_TIME_FEE_RX.lastIndex = 0;
  while ((match = ONE_TIME_FEE_RX.exec(normalized)) !== null) {
    const rawAmount = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) continue;
    const mStart = match.index;
    const mEnd = match.index + match[0].length;
    const overlapsExisting = rawCandidates.some(
      (c) => mStart < c.matchEnd && c.matchStart < mEnd
    );
    if (!overlapsExisting) {
      rawCandidates.push({
        matchStart: mStart,
        matchEnd: mEnd,
        rawAmount,
        period: "one-time",
        annualizedDollars: Math.round(rawAmount * 100) / 100
      });
    }
  }

  rawCandidates.sort((a, b) => a.matchStart - b.matchStart);

  const countPerClause = new Map();
  const staged = [];

  for (const cand of rawCandidates) {
    const [clauseStart, clauseEnd] = getContainingClauseBounds(
      normalized,
      cand.matchStart,
      cand.matchEnd
    );
    const clauseText = normalized.slice(clauseStart, clauseEnd);

    // Filter out ordinary base rent / security deposit / salary unless explicitly flagged as junk fee
    if (BASE_RENT_EXCLUSION_RX.test(clauseText) && !JUNK_FEE_INDICATOR_RX.test(clauseText)) {
      continue;
    }

    const clauseKey = `${clauseStart}:${clauseEnd}`;
    countPerClause.set(clauseKey, (countPerClause.get(clauseKey) || 0) + 1);
    staged.push({ ...cand, clauseStart, clauseEnd, clauseKey, clauseText });
  }

  const seenFeeKeys = new Map();
  const results = [];

  for (const item of staged) {
    const multipleInClause = (countPerClause.get(item.clauseKey) || 0) > 1;
    const spanStart = multipleInClause ? item.matchStart : item.clauseStart;
    const spanEnd = multipleInClause ? item.matchEnd : item.clauseEnd;
    const contextSnippet = multipleInClause
      ? normalized.slice(Math.max(item.clauseStart, item.matchStart - 20), Math.min(item.clauseEnd, item.matchEnd + 42))
      : item.clauseText;

    const label = deriveFeeLabel(contextSnippet, item.period);
    const baseKey = `${slugifyLabel(label)}-${Math.round(item.rawAmount)}-${item.period}`;
    const count = (seenFeeKeys.get(baseKey) || 0) + 1;
    seenFeeKeys.set(baseKey, count);
    const feeKey = count === 1 ? baseKey : `${baseKey}-${count}`;

    const [startOffset, endOffset] = mapSpan(spanStart, spanEnd);
    results.push({
      feeKey,
      label,
      rawAmount: item.rawAmount,
      period: item.period,
      annualizedDollars: item.annualizedDollars,
      startOffset,
      endOffset,
      matchText: rawText.slice(startOffset, endOffset)
    });
  }

  return results;
}

/**
 * Extracts recurring junk fees, mandatory bundles, compounding daily fines, and one-time junk fees.
 * Excludes standard base monthly rent and refundable deposits.
 * @param {string} text
 * @returns {Array<{ feeKey: string, label: string, rawAmount: number, period: "monthly"|"annual"|"daily"|"one-time", annualizedDollars: number, startOffset: number, endOffset: number, matchText: string }>}
 */
export function extractRecurringFees(text) {
  if (typeof text !== "string" || text.length === 0) return [];
  const normCtx = normalizeWithOffsets(text);
  return extractFeesWithNorm(text, normCtx);
}

/**
 * Computes a deterministic 0..100 integer risk score from active findings.
 * Higher score indicates higher unneutralized contract risk.
 * @param {Array<{ riskPoints?: number, categoryId?: string }>} findings
 * @returns {number}
 */
export function computeRiskScore(findings) {
  if (!Array.isArray(findings) || findings.length === 0) return 0;
  let weightedSum = 0;
  for (const f of findings) {
    if (!f || typeof f.riskPoints !== "number" || f.riskPoints <= 0) continue;
    const weight = CATEGORY_METADATA[f.categoryId]?.weight ?? 1.0;
    weightedSum += f.riskPoints * weight;
  }
  if (weightedSum <= 0) return 0;
  const score = Math.round(100 * (1 - Math.exp(-weightedSum / 75)));
  return Math.min(100, Math.max(0, score));
}

/**
 * Returns finding counts across all 10 locked CATEGORY_IDS.
 * @param {Array<{ categoryId?: string }>} findings
 * @returns {Record<string, number>}
 */
export function getCategoryBreakdown(findings) {
  const breakdown = {};
  for (const catId of CATEGORY_IDS) {
    breakdown[catId] = 0;
  }
  if (!Array.isArray(findings)) return breakdown;
  for (const f of findings) {
    if (f && Object.prototype.hasOwnProperty.call(breakdown, f.categoryId)) {
      breakdown[f.categoryId] += 1;
    }
  }
  return breakdown;
}

/**
 * Scans contract prose deterministically with anchor-keyword pre-filtering,
 * zero-width normalization, raw offset restoration, and overlap resolution.
 * @param {string} text
 * @param {{ documentId?: string, docCategory?: string }} [options]
 * @returns {object}
 */
export function scanDocument(text, options = {}) {
  const startedAt =
    typeof globalThis.performance?.now === "function"
      ? globalThis.performance.now()
      : Date.now();

  const rawText = typeof text === "string" ? text : "";
  const documentId =
    typeof options.documentId === "string" && options.documentId.length > 0
      ? options.documentId
      : "custom-document";

  if (rawText.length === 0) {
    const emptyCategory = VALID_DOC_CATEGORIES.has(options.docCategory)
      ? options.docCategory
      : "custom-agreement";
    return {
      documentId,
      docCategory: emptyCategory,
      findings: [],
      fees: [],
      riskScore: 0,
      categoryBreakdown: getCategoryBreakdown([]),
      scannedChars: 0,
      durationMs: 0
    };
  }

  const normCtx = normalizeWithOffsets(rawText);
  const { normalized, mapSpan } = normCtx;
  const lowerNorm = normalized.toLowerCase();

  const docCategory = VALID_DOC_CATEGORIES.has(options.docCategory)
    ? options.docCategory
    : inferDocCategory(lowerNorm);

  const candidates = [];

  for (let i = 0; i < COMPILED_GLOBAL_RULES.length; i += 1) {
    const { rule, globalPattern } = COMPILED_GLOBAL_RULES[i];

    let anchorMatched = false;
    for (let k = 0; k < rule.anchorKeywords.length; k += 1) {
      if (lowerNorm.includes(rule.anchorKeywords[k])) {
        anchorMatched = true;
        break;
      }
    }
    if (!anchorMatched) continue;

    globalPattern.lastIndex = 0;
    const match = globalPattern.exec(normalized);
    if (!match || match[0].length === 0) continue;

    const normStart = match.index;
    const normEnd = normStart + match[0].length;
    const [startOffset, endOffset] = mapSpan(normStart, normEnd);
    const docCategoryMatch =
      !rule.docCategories || rule.docCategories.includes(docCategory);

    candidates.push({
      rule,
      startOffset,
      endOffset,
      docCategoryMatch,
      severityRank: SEVERITY_RANK[rule.severity] ?? 1
    });
  }

  candidates.sort((a, b) => {
    if (b.severityRank !== a.severityRank) return b.severityRank - a.severityRank;
    if (b.docCategoryMatch !== a.docCategoryMatch) {
      return (b.docCategoryMatch ? 1 : 0) - (a.docCategoryMatch ? 1 : 0);
    }
    if (b.rule.riskPoints !== a.rule.riskPoints) return b.rule.riskPoints - a.rule.riskPoints;
    const spanDiff = (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset);
    if (spanDiff !== 0) return spanDiff;
    return a.startOffset - b.startOffset;
  });

  const accepted = [];
  const seenRuleIds = new Set();

  for (const cand of candidates) {
    if (seenRuleIds.has(cand.rule.id)) continue;
    let overlaps = false;
    for (let j = 0; j < accepted.length; j += 1) {
      const prev = accepted[j];
      if (cand.startOffset < prev.endOffset && prev.startOffset < cand.endOffset) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;
    seenRuleIds.add(cand.rule.id);
    accepted.push(cand);
  }

  accepted.sort((a, b) => a.startOffset - b.startOffset);

  const findings = accepted.map(({ rule, startOffset, endOffset }) => ({
    ruleId: rule.id,
    categoryId: rule.categoryId,
    title: rule.title,
    severity: rule.severity,
    riskPoints: rule.riskPoints,
    annualFeeEstimate: rule.annualFeeEstimate,
    matchText: rawText.slice(startOffset, endOffset),
    startOffset,
    endOffset,
    excerpt: buildExcerpt(rawText, startOffset, endOffset),
    rationale: rule.rationale,
    redlines: { ...rule.redlines }
  }));

  const fees = extractFeesWithNorm(rawText, normCtx);
  const riskScore = computeRiskScore(findings);
  const categoryBreakdown = getCategoryBreakdown(findings);
  const finishedAt =
    typeof globalThis.performance?.now === "function"
      ? globalThis.performance.now()
      : Date.now();

  return {
    documentId,
    docCategory,
    findings,
    fees,
    riskScore,
    categoryBreakdown,
    scannedChars: rawText.length,
    durationMs: Math.round((finishedAt - startedAt) * 100) / 100
  };
}

// =========================================================================
// Local Zero-Upload Document Ingestors (.docx ZIP, .pdf FlateDecode, .txt/.md)
// =========================================================================

function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return null;
}

async function inflateBytes(bytes, format) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("DecompressionStream is unavailable in this environment.");
  }
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  const writePromise = writer.write(bytes).then(() => writer.close());
  writePromise.catch(() => {});

  const reader = ds.readable.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }

  await writePromise;
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function decodeXmlEntities(xml) {
  return xml
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      const cp = parseInt(dec, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
    });
}

function parseWordXmlText(xmlText) {
  const withBreaks = xmlText
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<w:(?:br|cr)\b[^>]*\/?>/g, "\n")
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<\/w:tc>/g, " ");

  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return decodeXmlEntities(stripped)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findZipEntry(bytes, targetName) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // 1. Search backwards for End of Central Directory (0x06054b50)
  const minEocdOffset = Math.max(0, bytes.length - 65557);
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= minEocdOffset; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset >= 0) {
    const cdCount = view.getUint16(eocdOffset + 10, true);
    const cdSize = view.getUint32(eocdOffset + 12, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    if (cdOffset + cdSize <= bytes.length) {
      let ptr = cdOffset;
      for (let idx = 0; idx < cdCount && ptr + 46 <= bytes.length; idx += 1) {
        if (view.getUint32(ptr, true) !== 0x02014b50) break;
        const method = view.getUint16(ptr + 10, true);
        const compressedSize = view.getUint32(ptr + 20, true);
        const nameLen = view.getUint16(ptr + 28, true);
        const extraLen = view.getUint16(ptr + 30, true);
        const commentLen = view.getUint16(ptr + 32, true);
        const localHeaderOffset = view.getUint32(ptr + 42, true);
        const name = utf8Decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

        if (name === targetName && localHeaderOffset + 30 <= bytes.length) {
          if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) return null;
          const lfNameLen = view.getUint16(localHeaderOffset + 26, true);
          const lfExtraLen = view.getUint16(localHeaderOffset + 28, true);
          const dataStart = localHeaderOffset + 30 + lfNameLen + lfExtraLen;
          if (dataStart + compressedSize <= bytes.length) {
            return {
              method,
              compressed: bytes.subarray(dataStart, dataStart + compressedSize)
            };
          }
        }
        ptr += 46 + nameLen + extraLen + commentLen;
      }
    }
  }

  // 2. Fallback: sequential Local File Header (0x04034b50) walk for minimal ZIPs without EOCD
  let ptr = 0;
  while (ptr + 30 <= bytes.length) {
    const sig = view.getUint32(ptr, true);
    if (sig !== 0x04034b50) break;
    const method = view.getUint16(ptr + 8, true);
    const compressedSize = view.getUint32(ptr + 18, true);
    const nameLen = view.getUint16(ptr + 26, true);
    const extraLen = view.getUint16(ptr + 28, true);
    const nameStart = ptr + 30;
    const dataStart = nameStart + nameLen + extraLen;
    if (dataStart + compressedSize > bytes.length) break;
    const name = utf8Decoder.decode(bytes.subarray(nameStart, nameStart + nameLen));
    if (name === targetName) {
      return {
        method,
        compressed: bytes.subarray(dataStart, dataStart + compressedSize)
      };
    }
    ptr = dataStart + compressedSize;
  }

  return null;
}

/**
 * Extracts text locally from a .docx ZIP container (`word/document.xml`) using
 * pure-JS ZIP parsing and Web Streams `DecompressionStream("deflate-raw")`.
 * @param {ArrayBuffer | Uint8Array} arrayBuffer
 * @returns {Promise<{ ok: boolean, format: "docx", text: string, charCount: number, reason?: string, notice?: string }>}
 */
export async function extractDocxText(arrayBuffer) {
  const bytes = toUint8Array(arrayBuffer);
  if (!bytes || bytes.length < 30) {
    return {
      ok: false,
      format: "docx",
      text: "",
      charCount: 0,
      reason: "invalid-docx",
      notice: "The selected file is too small to be a valid DOCX archive."
    };
  }

  try {
    const entry = findZipEntry(bytes, "word/document.xml");
    if (!entry) {
      return {
        ok: false,
        format: "docx",
        text: "",
        charCount: 0,
        reason: "missing-document-xml",
        notice: "Could not locate word/document.xml inside this DOCX package."
      };
    }

    let xmlBytes;
    if (entry.method === 0) {
      xmlBytes = entry.compressed;
    } else if (entry.method === 8) {
      xmlBytes = await inflateBytes(entry.compressed, "deflate-raw");
    } else {
      return {
        ok: false,
        format: "docx",
        text: "",
        charCount: 0,
        reason: "unsupported-compression",
        notice: `Unsupported ZIP compression method (${entry.method}) in DOCX archive.`
      };
    }

    const xmlText = utf8Decoder.decode(xmlBytes);
    const text = parseWordXmlText(xmlText);
    if (!text) {
      return {
        ok: false,
        format: "docx",
        text: "",
        charCount: 0,
        reason: "empty-docx",
        notice: "No readable text nodes were found in word/document.xml."
      };
    }

    return {
      ok: true,
      format: "docx",
      text,
      charCount: text.length
    };
  } catch (err) {
    return {
      ok: false,
      format: "docx",
      text: "",
      charCount: 0,
      reason: "docx-parse-error",
      notice: err?.message || "Failed to parse DOCX XML stream."
    };
  }
}

function bytesToLatin1(bytes) {
  let out = "";
  const chunkSize = 0x4000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return out;
}

function decodePdfLiteralString(raw) {
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    i += 1;
    if (i >= raw.length) break;
    const esc = raw[i];
    if (esc === "n") out += "\n";
    else if (esc === "r") out += "\r";
    else if (esc === "t") out += "\t";
    else if (esc === "b") out += "\b";
    else if (esc === "f") out += "\f";
    else if (esc === "\r") {
      if (raw[i + 1] === "\n") i += 1;
    } else if (esc === "\n") {
      // Escaped line continuation
    } else if (esc >= "0" && esc <= "7") {
      let oct = esc;
      if (i + 1 < raw.length && raw[i + 1] >= "0" && raw[i + 1] <= "7") {
        oct += raw[i + 1];
        i += 1;
        if (i + 1 < raw.length && raw[i + 1] >= "0" && raw[i + 1] <= "7") {
          oct += raw[i + 1];
          i += 1;
        }
      }
      out += String.fromCharCode(parseInt(oct, 8));
    } else {
      out += esc;
    }
  }

  // Handle UTF-16BE BOM when present
  if (out.length >= 2 && out.charCodeAt(0) === 0xfe && out.charCodeAt(1) === 0xff) {
    let u16 = "";
    for (let j = 2; j + 1 < out.length; j += 2) {
      u16 += String.fromCharCode((out.charCodeAt(j) << 8) | out.charCodeAt(j + 1));
    }
    return u16;
  }
  return out;
}

function decodePdfHexString(hex) {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length < 2) return "";
  const padded = clean.length % 2 === 1 ? `${clean}0` : clean;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    bytes[i / 2] = parseInt(padded.slice(i, i + 2), 16);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let u16 = "";
    for (let j = 2; j + 1 < bytes.length; j += 2) {
      u16 += String.fromCharCode((bytes[j] << 8) | bytes[j + 1]);
    }
    return u16;
  }
  let ascii = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    if ((b >= 0x20 && b <= 0x7e) || b === 0x0a || b === 0x0d || b === 0x09) {
      ascii += String.fromCharCode(b);
    }
  }
  return ascii;
}

function extractTextFromPdfContentStream(content) {
  const tokens = [];
  let i = 0;
  const n = content.length;

  const readParenString = () => {
    i += 1; // skip '('
    let depth = 1;
    let buf = "";
    while (i < n && depth > 0) {
      const ch = content[i];
      if (ch === "\\") {
        buf += ch;
        i += 1;
        if (i < n) {
          buf += content[i];
          i += 1;
        }
        continue;
      }
      if (ch === "(") {
        depth += 1;
        buf += ch;
        i += 1;
        continue;
      }
      if (ch === ")") {
        depth -= 1;
        if (depth > 0) buf += ch;
        i += 1;
        continue;
      }
      buf += ch;
      i += 1;
    }
    return decodePdfLiteralString(buf);
  };

  while (i < n) {
    const ch = content[i];
    if (ch === "(") {
      const str = readParenString();
      let j = i;
      while (j < n && /\s/.test(content[j])) j += 1;
      const op2 = content.slice(j, j + 2);
      const op1 = content[j];
      if (op2 === "Tj" || op1 === "'" || op1 === '"') {
        if (str) tokens.push(str);
        if (op1 === "'" || op1 === '"') tokens.push("\n");
        i = j + (op2 === "Tj" ? 2 : 1);
      }
      continue;
    }

    if (ch === "[") {
      const arrayStart = i;
      i += 1;
      const parts = [];
      let closed = false;
      while (i < n) {
        const c = content[i];
        if (c === "(") {
          parts.push(readParenString());
        } else if (c === "<" && content[i + 1] !== "<") {
          const endHex = content.indexOf(">", i + 1);
          if (endHex < 0) break;
          parts.push(decodePdfHexString(content.slice(i + 1, endHex)));
          i = endHex + 1;
        } else if (c === "-" || (c >= "0" && c <= "9")) {
          let numStr = c;
          i += 1;
          while (i < n && /[0-9.]/.test(content[i])) {
            numStr += content[i];
            i += 1;
          }
          const kern = Number(numStr);
          if (Number.isFinite(kern) && kern <= -120) {
            parts.push(" ");
          }
        } else if (c === "]") {
          i += 1;
          closed = true;
          break;
        } else {
          i += 1;
        }
      }
      if (closed) {
        let j = i;
        while (j < n && /\s/.test(content[j])) j += 1;
        if (content.slice(j, j + 2) === "TJ") {
          const joined = parts.join("");
          if (joined) tokens.push(joined);
          i = j + 2;
        }
      } else {
        i = arrayStart + 1;
      }
      continue;
    }

    if (ch === "<" && content[i + 1] !== "<") {
      const endHex = content.indexOf(">", i + 1);
      if (endHex > i) {
        const str = decodePdfHexString(content.slice(i + 1, endHex));
        let j = endHex + 1;
        while (j < n && /\s/.test(content[j])) j += 1;
        if (content.slice(j, j + 2) === "Tj") {
          if (str) tokens.push(str);
          i = j + 2;
          continue;
        }
      }
    }

    if (ch === "T" && (content[i + 1] === "d" || content[i + 1] === "D" || content[i + 1] === "*")) {
      const prevOk = i === 0 || /[\s\]\)]/.test(content[i - 1]);
      const nextOk = i + 2 >= n || /\s/.test(content[i + 2]);
      if (prevOk && nextOk && tokens.length > 0 && tokens[tokens.length - 1] !== "\n") {
        tokens.push("\n");
      }
      i += 2;
      continue;
    }

    if (ch === "E" && content[i + 1] === "T") {
      const prevOk = i === 0 || /\s/.test(content[i - 1]);
      const nextOk = i + 2 >= n || /\s/.test(content[i + 2]);
      if (prevOk && nextOk && tokens.length > 0 && tokens[tokens.length - 1] !== "\n") {
        tokens.push("\n");
      }
      i += 2;
      continue;
    }

    i += 1;
  }

  return tokens.join(" ").replace(/ *\n */g, "\n").replace(/ {2,}/g, " ").trim();
}

/**
 * Extracts text locally from PDF content streams (`FlateDecode` via `DecompressionStream`
 * and raw `Tj`/`TJ` operators). Returns `reason: "scanned-image-pdf"` when no extractable
 * text streams exist.
 * @param {ArrayBuffer | Uint8Array} arrayBuffer
 * @returns {Promise<{ ok: boolean, format: "pdf", text: string, charCount: number, reason?: string, notice?: string }>}
 */
export async function extractPdfText(arrayBuffer) {
  const bytes = toUint8Array(arrayBuffer);
  if (!bytes || bytes.length < 12) {
    return {
      ok: false,
      format: "pdf",
      text: "",
      charCount: 0,
      reason: "invalid-pdf",
      notice: "The selected file is not a valid PDF document."
    };
  }

  const head = bytesToLatin1(bytes.subarray(0, Math.min(1024, bytes.length)));
  if (!head.includes("%PDF-")) {
    return {
      ok: false,
      format: "pdf",
      text: "",
      charCount: 0,
      reason: "invalid-pdf",
      notice: "Missing %PDF- header; file does not appear to be a valid PDF."
    };
  }

  const latin = bytesToLatin1(bytes);
  const segments = [];
  let cursor = 0;

  while (cursor < latin.length) {
    const streamIdx = latin.indexOf("stream", cursor);
    if (streamIdx < 0) break;

    const prevCh = streamIdx > 0 ? latin[streamIdx - 1] : "\n";
    const afterStream = latin[streamIdx + 6];
    if (!/[\s>]/.test(prevCh) || (afterStream !== "\r" && afterStream !== "\n")) {
      cursor = streamIdx + 6;
      continue;
    }

    let dataStart = streamIdx + 6;
    if (latin[dataStart] === "\r" && latin[dataStart + 1] === "\n") {
      dataStart += 2;
    } else {
      dataStart += 1;
    }

    const endStreamIdx = latin.indexOf("endstream", dataStart);
    if (endStreamIdx < 0) break;

    let dataEnd = endStreamIdx;
    if (dataEnd > dataStart && latin[dataEnd - 1] === "\n") dataEnd -= 1;
    if (dataEnd > dataStart && latin[dataEnd - 1] === "\r") dataEnd -= 1;

    const dictWindow = latin.slice(Math.max(0, streamIdx - 420), streamIdx);
    const isImageOrFont = /\/Subtype\s*\/Image\b|\/FontFile\d?\b/i.test(dictWindow);
    const isFlate = /\/FlateDecode\b|\/Fl\b/i.test(dictWindow);

    if (!isImageOrFont && dataEnd > dataStart) {
      const slice = bytes.subarray(dataStart, dataEnd);
      let decoded = "";
      if (isFlate) {
        try {
          const out = await inflateBytes(slice, "deflate");
          decoded = bytesToLatin1(out);
        } catch {
          try {
            const outRaw = await inflateBytes(slice, "deflate-raw");
            decoded = bytesToLatin1(outRaw);
          } catch {
            decoded = "";
          }
        }
      } else {
        decoded = bytesToLatin1(slice);
      }

      if (decoded && (decoded.includes("Tj") || decoded.includes("TJ") || decoded.includes("BT"))) {
        const extracted = extractTextFromPdfContentStream(decoded);
        if (extracted) segments.push(extracted);
      }
    }

    cursor = endStreamIdx + 9;
  }

  const combined = segments
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const readableChars = combined.replace(/[^A-Za-z0-9]/g, "").length;
  if (readableChars < 6) {
    return {
      ok: false,
      format: "pdf",
      text: "",
      charCount: 0,
      reason: "scanned-image-pdf",
      notice:
        "No extractable text layer was detected in this PDF (scanned image PDF). Please run local OCR or paste the contract text directly."
    };
  }

  return {
    ok: true,
    format: "pdf",
    text: combined,
    charCount: combined.length
  };
}

/**
 * Unified zero-upload document ingestor supporting File/Blob, ArrayBuffer/Uint8Array, or string
 * across `.txt`, `.md`, `.docx`, and `.pdf` formats.
 * @param {File | Blob | ArrayBuffer | Uint8Array | string} input
 * @param {string} [filename="document.txt"]
 * @returns {Promise<{ ok: boolean, title: string, format: string, text: string, charCount: number, notice?: string, reason?: string }>}
 */
export async function ingestDocumentFile(input, filename = "document.txt") {
  const effectiveName =
    (input && typeof input === "object" && typeof input.name === "string" && input.name) ||
    filename ||
    "document.txt";
  const cleanTitle =
    effectiveName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled Agreement";
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(effectiveName);
  const ext = extMatch ? extMatch[1].toLowerCase() : "txt";

  if (typeof input === "string") {
    const normalized = input.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      return {
        ok: false,
        title: cleanTitle,
        format: ext,
        text: "",
        charCount: 0,
        reason: "empty-document",
        notice: "The provided document text is empty."
      };
    }
    return {
      ok: true,
      title: cleanTitle,
      format: ext === "md" ? "md" : "txt",
      text: normalized,
      charCount: normalized.length
    };
  }

  let bytes = toUint8Array(input);
  if (!bytes && input && typeof input.arrayBuffer === "function") {
    const ab = await input.arrayBuffer();
    bytes = new Uint8Array(ab);
  }

  if (!bytes || bytes.length === 0) {
    return {
      ok: false,
      title: cleanTitle,
      format: ext,
      text: "",
      charCount: 0,
      reason: "empty-document",
      notice: "The selected file is empty or unreadable."
    };
  }

  if (ext === "docx") {
    const res = await extractDocxText(bytes);
    return { ...res, title: cleanTitle };
  }

  if (ext === "pdf") {
    const res = await extractPdfText(bytes);
    return { ...res, title: cleanTitle };
  }

  const text = utf8Decoder.decode(bytes).replace(/\r\n/g, "\n").trim();
  if (!text) {
    return {
      ok: false,
      title: cleanTitle,
      format: ext === "md" ? "md" : "txt",
      text: "",
      charCount: 0,
      reason: "empty-document",
      notice: "The selected text file contains no readable content."
    };
  }

  return {
    ok: true,
    title: cleanTitle,
    format: ext === "md" ? "md" : "txt",
    text,
    charCount: text.length
  };
}
