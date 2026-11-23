/**
 * ClauseHound Local — Multi-Tone Redline Engine, Fee Excision & Diff Builder
 * Pure ES module providing deterministic bilateral counter-drafting and diffing.
 */

import { CLAUSE_RULES, TONE_OPTIONS } from "./clause-rules.js";
import { computeRiskScore, extractRecurringFees } from "./clause-scanner.js";

const VALID_TONES = new Set(TONE_OPTIONS);
const RULE_BY_ID = new Map(CLAUSE_RULES.map((rule) => [rule.id, rule]));

function resolveTone(tone) {
  return VALID_TONES.has(tone) ? tone : "bilateral";
}

function toIdSet(ids) {
  const out = new Set();
  if (!ids) return out;
  if (ids instanceof Set || Array.isArray(ids)) {
    for (const id of ids) {
      if (typeof id === "string" && id.length > 0) out.add(id);
    }
  }
  return out;
}

function extractContextHints(matchText, context = {}) {
  const source = typeof matchText === "string" ? matchText : "";
  const amountMatch = /\$\s?\d[\d,]*(?:\.\d{1,2})?(?:\s*\/\s*(?:mo|yr|day))?/i.exec(source);
  const daysMatch = /\b(\d{1,3})\s*(?:calendar\s+|business\s+)?days?\b/i.exec(source);

  return {
    partyA: typeof context.partyA === "string" && context.partyA ? context.partyA : "",
    partyB: typeof context.partyB === "string" && context.partyB ? context.partyB : "",
    detectedAmount:
      typeof context.detectedAmount === "string" && context.detectedAmount
        ? context.detectedAmount
        : amountMatch
          ? amountMatch[0]
          : "",
    detectedDays:
      typeof context.detectedDays === "string" && context.detectedDays
        ? context.detectedDays
        : daysMatch
          ? daysMatch[1]
          : ""
  };
}

function interpolateTemplate(template, hints) {
  let result = String(template || "");
  if (result.includes("{{")) {
    result = result
      .replace(/\{\{partyA\}\}/g, hints.partyA || "Drafting Party")
      .replace(/\{\{partyB\}\}/g, hints.partyB || "Counterparty")
      .replace(/\{\{detectedAmount\}\}/g, hints.detectedAmount || "$0")
      .replace(/\{\{amount\}\}/g, hints.detectedAmount || "$0")
      .replace(/\{\{detectedDays\}\}/g, hints.detectedDays || "30")
      .replace(/\{\{days\}\}/g, hints.detectedDays || "30");
  }
  if (hints.detectedAmount && result.includes("($45/mo or similar)")) {
    result = result.replace("($45/mo or similar)", `(${hints.detectedAmount})`);
  }
  return result;
}

/**
 * Generates a calibrated redline counter-clause for a finding in the chosen negotiation tone.
 * Preserves locked benchmark texts verbatim when no template tokens are present.
 * @param {object} finding
 * @param {"collaborative"|"bilateral"|"counsel"} [tone="bilateral"]
 * @param {object} [context]
 * @returns {{ ruleId: string, tone: string, replacementText: string, rationale: string }}
 */
export function generateRedline(finding, tone = "bilateral", context = {}) {
  const resolvedTone = resolveTone(tone);
  const ruleId = typeof finding?.ruleId === "string" ? finding.ruleId : "";
  const fallbackRule = ruleId ? RULE_BY_ID.get(ruleId) : null;

  const redlinePool = finding?.redlines || fallbackRule?.redlines || {};
  const template =
    redlinePool[resolvedTone] ||
    redlinePool.bilateral ||
    redlinePool.collaborative ||
    redlinePool.counsel ||
    "";

  const hints = extractContextHints(finding?.matchText, context);
  const replacementText = interpolateTemplate(template, hints);
  const rationale =
    typeof finding?.rationale === "string" && finding.rationale.length > 0
      ? finding.rationale
      : fallbackRule?.rationale || "";

  return {
    ruleId,
    tone: resolvedTone,
    replacementText,
    rationale
  };
}

/**
 * Applies neutralized redline replacements over non-overlapping finding spans in a single pass
 * and recalculates the residual contract riskScoreAfter (0..100).
 * @param {string} text
 * @param {Array<object>} findings
 * @param {string[] | Set<string>} neutralizedRuleIds
 * @param {"collaborative"|"bilateral"|"counsel"} [tone="bilateral"]
 * @returns {{ redlinedText: string, appliedCount: number, riskScoreAfter: number }}
 */
export function applyRedlines(text, findings, neutralizedRuleIds, tone = "bilateral") {
  const rawText = typeof text === "string" ? text : "";
  const resolvedTone = resolveTone(tone);
  const findingList = Array.isArray(findings) ? findings : [];
  const neutralizedSet = toIdSet(neutralizedRuleIds);

  if (rawText.length === 0 || findingList.length === 0 || neutralizedSet.size === 0) {
    return {
      redlinedText: rawText,
      appliedCount: 0,
      riskScoreAfter: computeRiskScore(
        findingList.filter((f) => f && !neutralizedSet.has(f.ruleId))
      )
    };
  }

  const targeted = findingList
    .filter(
      (f) =>
        f &&
        neutralizedSet.has(f.ruleId) &&
        Number.isInteger(f.startOffset) &&
        Number.isInteger(f.endOffset) &&
        f.startOffset >= 0 &&
        f.endOffset <= rawText.length &&
        f.endOffset > f.startOffset
    )
    .sort((a, b) => a.startOffset - b.startOffset);

  const chunks = [];
  let cursor = 0;
  let appliedCount = 0;

  for (const finding of targeted) {
    if (finding.startOffset < cursor) continue;
    const { replacementText } = generateRedline(finding, resolvedTone);
    if (!replacementText) continue;

    chunks.push(rawText.slice(cursor, finding.startOffset));
    chunks.push(replacementText);
    cursor = finding.endOffset;
    appliedCount += 1;
  }

  chunks.push(rawText.slice(cursor));

  const remainingFindings = findingList.filter((f) => f && !neutralizedSet.has(f.ruleId));
  return {
    redlinedText: chunks.join(""),
    appliedCount,
    riskScoreAfter: computeRiskScore(remainingFindings)
  };
}

/**
 * Excises selected recurring junk fees from contract text and calculates total annualized savings.
 * @param {string} text
 * @param {string[] | Set<string>} excisedFeeKeys
 * @param {Array<object>} [fees]
 * @returns {{ cleanedText: string, excisedCount: number, annualDollarsSaved: number }}
 */
export function exciseJunkFees(text, excisedFeeKeys, fees) {
  const rawText = typeof text === "string" ? text : "";
  const keySet = toIdSet(excisedFeeKeys);
  const feeList = Array.isArray(fees) ? fees : extractRecurringFees(rawText);

  if (keySet.size === 0 || feeList.length === 0) {
    return {
      cleanedText: rawText,
      excisedCount: 0,
      annualDollarsSaved: 0
    };
  }

  const selected = feeList
    .filter((f) => f && keySet.has(f.feeKey))
    .sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0));

  if (selected.length === 0) {
    return {
      cleanedText: rawText,
      excisedCount: 0,
      annualDollarsSaved: 0
    };
  }

  let annualSum = 0;
  for (const fee of selected) {
    annualSum += Number(fee.annualizedDollars) || 0;
  }

  const chunks = [];
  let cursor = 0;
  let excisedCount = 0;

  // Verify whether cached fee offsets still match the current text verbatim
  const offsetsAlign = selected.every(
    (f) =>
      Number.isInteger(f.startOffset) &&
      Number.isInteger(f.endOffset) &&
      f.startOffset >= 0 &&
      f.endOffset <= rawText.length &&
      (!f.matchText || rawText.slice(f.startOffset, f.endOffset) === f.matchText)
  );

  if (offsetsAlign) {
    for (const fee of selected) {
      if (fee.startOffset < cursor) continue;
      const savedRounded = Math.round(Number(fee.annualizedDollars) || 0);
      const marker = `[EXCISED FEE: ${fee.label} — $${savedRounded.toLocaleString("en-US")}/yr saved]`;
      chunks.push(rawText.slice(cursor, fee.startOffset));
      chunks.push(marker);
      cursor = fee.endOffset;
      excisedCount += 1;
    }
    chunks.push(rawText.slice(cursor));
    return {
      cleanedText: chunks.join(""),
      excisedCount,
      annualDollarsSaved: Math.round(annualSum * 100) / 100
    };
  }

  // Fallback when text was previously modified (e.g., partial redlines applied first)
  let updatedText = rawText;
  for (const fee of selected) {
    const savedRounded = Math.round(Number(fee.annualizedDollars) || 0);
    const marker = `[EXCISED FEE: ${fee.label} — $${savedRounded.toLocaleString("en-US")}/yr saved]`;
    if (fee.matchText && updatedText.includes(fee.matchText)) {
      updatedText = updatedText.replace(fee.matchText, marker);
    }
    excisedCount += 1;
  }

  return {
    cleanedText: updatedText,
    excisedCount,
    annualDollarsSaved: Math.round(annualSum * 100) / 100
  };
}

function splitPreservingNewlines(text) {
  if (!text) return [];
  const lines = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") {
      lines.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) {
    lines.push(text.slice(start));
  }
  return lines;
}

function computeLcsOps(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ type: "unchanged", value: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "removed", value: a[i] });
      i += 1;
    } else {
      ops.push({ type: "added", value: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    ops.push({ type: "removed", value: a[i] });
    i += 1;
  }
  while (j < n) {
    ops.push({ type: "added", value: b[j] });
    j += 1;
  }
  return ops;
}

function pushMerged(out, type, value) {
  if (!value) return;
  const last = out[out.length - 1];
  if (last && last.type === type) {
    last.value += value;
  } else {
    out.push({ type, value });
  }
}

/**
 * Produces a deterministic segment diff between originalText and redlinedText.
 * Preserves exact mathematical reconstruction for both original and redlined strings.
 * @param {string} originalText
 * @param {string} redlinedText
 * @returns {Array<{ type: "unchanged" | "removed" | "added", value: string }>}
 */
export function buildRedlineDiff(originalText, redlinedText) {
  const aText = typeof originalText === "string" ? originalText : "";
  const bText = typeof redlinedText === "string" ? redlinedText : "";

  if (aText === bText) {
    return aText ? [{ type: "unchanged", value: aText }] : [];
  }

  const aLines = splitPreservingNewlines(aText);
  const bLines = splitPreservingNewlines(bText);

  // Guard huge inputs against O(N^2) DP by refining only changed outer bounds
  let prefixCount = 0;
  while (
    prefixCount < aLines.length &&
    prefixCount < bLines.length &&
    aLines[prefixCount] === bLines[prefixCount]
  ) {
    prefixCount += 1;
  }

  let aEnd = aLines.length;
  let bEnd = bLines.length;
  while (aEnd > prefixCount && bEnd > prefixCount && aLines[aEnd - 1] === bLines[bEnd - 1]) {
    aEnd -= 1;
    bEnd -= 1;
  }

  const segments = [];
  if (prefixCount > 0) {
    pushMerged(segments, "unchanged", aLines.slice(0, prefixCount).join(""));
  }

  const midA = aLines.slice(prefixCount, aEnd);
  const midB = bLines.slice(prefixCount, bEnd);

  if (midA.length * midB.length <= 250000) {
    const rawOps = computeLcsOps(midA, midB);
    // Merge consecutive blocks first, then refine single-line replacement pairs via common prefix/suffix
    const grouped = [];
    for (const op of rawOps) {
      pushMerged(grouped, op.type, op.value);
    }

    for (let k = 0; k < grouped.length; k += 1) {
      const cur = grouped[k];
      const next = grouped[k + 1];
      if (cur && next && cur.type === "removed" && next.type === "added") {
        const s1 = cur.value;
        const s2 = next.value;
        let p = 0;
        while (p < s1.length && p < s2.length && s1[p] === s2[p]) p += 1;
        // Snap common prefix back to word boundary for cleaner readability
        while (p > 0 && p < s1.length && /[A-Za-z0-9]/.test(s1[p - 1]) && /[A-Za-z0-9]/.test(s1[p])) {
          p -= 1;
        }
        let s = 0;
        while (
          s1.length - s > p &&
          s2.length - s > p &&
          s1[s1.length - 1 - s] === s2[s2.length - 1 - s]
        ) {
          s += 1;
        }
        while (
          s > 0 &&
          /[A-Za-z0-9]/.test(s1[s1.length - s]) &&
          /[A-Za-z0-9]/.test(s1[s1.length - s - 1])
        ) {
          s -= 1;
        }

        if (p > 0 || s > 0) {
          pushMerged(segments, "unchanged", s1.slice(0, p));
          pushMerged(segments, "removed", s1.slice(p, s1.length - s));
          pushMerged(segments, "added", s2.slice(p, s2.length - s));
          pushMerged(segments, "unchanged", s1.slice(s1.length - s));
          k += 1;
          continue;
        }
      }
      pushMerged(segments, cur.type, cur.value);
    }
  } else {
    pushMerged(segments, "removed", midA.join(""));
    pushMerged(segments, "added", midB.join(""));
  }

  if (aEnd < aLines.length) {
    pushMerged(segments, "unchanged", aLines.slice(aEnd).join(""));
  }

  return segments;
}
