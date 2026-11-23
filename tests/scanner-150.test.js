import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORY_IDS,
  CATEGORY_METADATA,
  CATEGORY_RULE_TARGETS,
  CLAUSE_RULES,
  DOC_CATEGORY_ENUM,
  MIN_RULES_PER_CATEGORY,
  MIN_TOTAL_RULES,
  TONE_OPTIONS,
  getRuleCountsByCategory
} from "../src/engine/clause-rules.js";
import { SPECIMENS, getSpecimenById, listSpecimens } from "../src/engine/specimens.js";
import {
  computeRiskScore,
  extractRecurringFees,
  getCategoryBreakdown,
  scanDocument
} from "../src/engine/clause-scanner.js";
import {
  applyRedlines,
  buildRedlineDiff,
  exciseJunkFees,
  generateRedline
} from "../src/engine/redline-engine.js";

const EXPECTED_IN01_BILATERAL =
  "Indemnification shall be strictly mutual, limited to verified third-party claims caused by gross negligence or willful misconduct, capped at fees paid in the preceding 12 months, and explicitly excluding indirect, incidental, or consequential damages.";

describe("ClauseHound 152+ Clause Lexicon & Scanner", () => {
  test("lexicon meets minimum counts, unique IDs, per-category targets, and 3-tone redlines", () => {
    assert.ok(CLAUSE_RULES.length >= MIN_TOTAL_RULES, `Expected >= ${MIN_TOTAL_RULES} rules, got ${CLAUSE_RULES.length}`);
    assert.ok(CLAUSE_RULES.length >= 152);
    assert.equal(CATEGORY_IDS.length, 10);

    const seenIds = new Set();
    const counts = getRuleCountsByCategory();

    for (const catId of CATEGORY_IDS) {
      assert.ok(CATEGORY_METADATA[catId], `Missing metadata for ${catId}`);
      const target = CATEGORY_RULE_TARGETS[catId];
      assert.ok(target >= MIN_RULES_PER_CATEGORY, `Target below ${MIN_RULES_PER_CATEGORY} for ${catId}`);
      assert.ok(counts[catId] >= target, `${catId} has ${counts[catId]} rules < target ${target}`);
    }

    for (const rule of CLAUSE_RULES) {
      assert.equal(typeof rule.id, "string");
      assert.ok(rule.id.length > 0);
      assert.ok(!seenIds.has(rule.id), `Duplicate rule ID: ${rule.id}`);
      seenIds.add(rule.id);

      assert.ok(CATEGORY_IDS.includes(rule.categoryId), `Unknown categoryId on ${rule.id}`);
      assert.ok(["critical", "high", "medium", "low"].includes(rule.severity), `Invalid severity on ${rule.id}`);
      assert.ok(typeof rule.riskPoints === "number" && rule.riskPoints > 0, `Invalid riskPoints on ${rule.id}`);
      assert.ok(typeof rule.annualFeeEstimate === "number" && rule.annualFeeEstimate >= 0);
      assert.ok(Array.isArray(rule.anchorKeywords) && rule.anchorKeywords.length > 0, `Missing anchorKeywords on ${rule.id}`);
      for (const kw of rule.anchorKeywords) {
        assert.equal(kw, kw.toLowerCase(), `Anchor keyword must be lowercase on ${rule.id}: ${kw}`);
        assert.ok(kw.length > 0);
      }

      assert.ok(rule.pattern instanceof RegExp, `Rule ${rule.id} pattern must be RegExp`);
      assert.equal(rule.pattern.global, false, `Rule ${rule.id} pattern must be non-global`);
      assert.equal(rule.pattern.sticky, false, `Rule ${rule.id} pattern must be non-sticky`);

      assert.ok(typeof rule.rationale === "string" && rule.rationale.trim().length > 10, `Empty rationale on ${rule.id}`);
      for (const tone of TONE_OPTIONS) {
        assert.ok(
          typeof rule.redlines?.[tone] === "string" && rule.redlines[tone].trim().length > 10,
          `Missing or empty ${tone} redline on ${rule.id}`
        );
      }
    }
  });

  test("all regex patterns are bounded anti-ReDoS and execute safely under backtracking probes", () => {
    const catastrophicPatterns = [
      /\([^)]*[+*][^)]*\)[+*{]/,
      /\.\*/,
      /\.\+/
    ];
    const probeText =
      "Contractor hereby agrees to defend indemnify hold harmless automatically renew successive " +
      "seat floor holdover unilateral modify URL arbitration venue non-compete perpetual ".repeat(40);

    for (const rule of CLAUSE_RULES) {
      const src = rule.pattern.source;
      for (const badRx of catastrophicPatterns) {
        assert.equal(
          badRx.test(src),
          false,
          `Rule ${rule.id} contains unbounded/nested quantifier pattern ${badRx}: ${src}`
        );
      }
      const start = performance.now();
      rule.pattern.test(probeText);
      const elapsed = performance.now() - start;
      assert.ok(elapsed < 10, `Rule ${rule.id} took ${elapsed.toFixed(2)}ms on probe input`);
    }
  });

  test("IN-01 detects benchmark indemnification clause and yields exact bilateral redline", () => {
    const benchmark =
      "Contractor agrees to defend, indemnify, and hold harmless Client against any and all claims, damages, and uncapped liabilities arising out of services.";

    const scan = scanDocument(benchmark, { documentId: "bench-in01", docCategory: "nda-contractor" });
    const in01 = scan.findings.find((f) => f.ruleId === "IN-01");
    assert.ok(in01, "Expected IN-01 finding to match benchmark clause");
    assert.equal(in01.categoryId, "INDEMNITY");
    assert.equal(benchmark.slice(in01.startOffset, in01.endOffset), in01.matchText);
    assert.equal(in01.redlines.bilateral, EXPECTED_IN01_BILATERAL);

    const redline = generateRedline(in01, "bilateral");
    assert.equal(redline.ruleId, "IN-01");
    assert.equal(redline.tone, "bilateral");
    assert.equal(redline.replacementText, EXPECTED_IN01_BILATERAL);

    const applied = applyRedlines(benchmark, scan.findings, ["IN-01"], "bilateral");
    assert.equal(applied.appliedCount, 1);
    assert.equal(applied.redlinedText, EXPECTED_IN01_BILATERAL);
    assert.equal(applied.riskScoreAfter, 0);

    const diff = buildRedlineDiff(benchmark, applied.redlinedText);
    const rebuiltOriginal = diff.filter((d) => d.type !== "added").map((d) => d.value).join("");
    const rebuiltRedlined = diff.filter((d) => d.type !== "removed").map((d) => d.value).join("");
    assert.equal(rebuiltOriginal, benchmark);
    assert.equal(rebuiltRedlined, applied.redlinedText);
  });

  test("all 5 specimens cover DOC_CATEGORY_ENUM and scan accurately with valid spans", () => {
    assert.ok(SPECIMENS.length >= 5);
    const categoriesCovered = new Set(SPECIMENS.map((s) => s.docCategory));
    for (const cat of DOC_CATEGORY_ENUM) {
      assert.ok(categoriesCovered.has(cat), `Missing specimen for ${cat}`);
      assert.ok(listSpecimens(cat).length >= 1);
    }

    assert.equal(getSpecimenById("sterling-lease")?.docCategory, "residential-lease");
    assert.equal(getSpecimenById("non-existent-id"), null);

    for (const specimen of SPECIMENS) {
      const result = scanDocument(specimen.text, {
        documentId: specimen.id,
        docCategory: specimen.docCategory
      });
      assert.equal(result.documentId, specimen.id);
      assert.equal(result.docCategory, specimen.docCategory);
      assert.equal(result.scannedChars, specimen.text.length);

      let prevEnd = 0;
      for (const f of result.findings) {
        assert.ok(f.startOffset >= prevEnd, `Overlapping or unsorted finding in ${specimen.id}: ${f.ruleId}`);
        assert.ok(f.endOffset > f.startOffset);
        assert.equal(specimen.text.slice(f.startOffset, f.endOffset), f.matchText);
        prevEnd = f.endOffset;
      }

      const breakdown = getCategoryBreakdown(result.findings);
      const breakdownTotal = Object.values(breakdown).reduce((a, b) => a + b, 0);
      assert.equal(breakdownTotal, result.findings.length);
      assert.equal(result.riskScore, computeRiskScore(result.findings));

      if (specimen.id === "custom-draft") {
        assert.equal(result.findings.length, 0);
        assert.equal(result.fees.length, 0);
        assert.equal(result.riskScore, 0);
      } else {
        assert.ok(result.findings.length >= 10, `${specimen.id} expected >= 10 findings, got ${result.findings.length}`);
        assert.ok(result.riskScore >= 80, `${specimen.id} expected high riskScore, got ${result.riskScore}`);
      }
    }
  });

  test("sterling-lease extracts >= $1,860/yr junk fees while excluding base monthly rent", () => {
    const sterling = getSpecimenById("sterling-lease");
    assert.ok(sterling);

    const scan = scanDocument(sterling.text, {
      documentId: sterling.id,
      docCategory: sterling.docCategory
    });
    const fees = extractRecurringFees(sterling.text);
    assert.deepEqual(fees, scan.fees);

    const totalAnnual = fees.reduce((sum, fee) => sum + fee.annualizedDollars, 0);
    assert.ok(totalAnnual >= 1860, `Expected >= 1860 annualized junk fees, got ${totalAnnual}`);

    const amounts = fees.map((f) => f.rawAmount);
    assert.ok(amounts.includes(45), "Missing $45/mo Valet Trash");
    assert.ok(amounts.includes(65), "Missing $65/mo Smart-Lock & Package");
    assert.ok(amounts.includes(18), "Missing $18/mo Admin Billing");
    assert.ok(amounts.includes(27), "Missing $27/mo Pest & Amenity");
    assert.ok(!amounts.includes(2450), "Base rent / security deposit ($2,450) must be excluded");

    const excised = exciseJunkFees(
      sterling.text,
      fees.map((f) => f.feeKey),
      fees
    );
    assert.equal(excised.excisedCount, fees.length);
    assert.ok(excised.annualDollarsSaved >= 1860);
    assert.ok(excised.cleanedText.includes("[EXCISED FEE:"));
  });

  test("oakridge-hoa extracts $50/day fine and $89/mo telecom bundle", () => {
    const hoa = getSpecimenById("oakridge-hoa");
    assert.ok(hoa);

    const scan = scanDocument(hoa.text, {
      documentId: hoa.id,
      docCategory: hoa.docCategory
    });

    const dailyFine = scan.fees.find((f) => f.rawAmount === 50 && f.period === "daily");
    const monthlyFiber = scan.fees.find((f) => f.rawAmount === 89 && f.period === "monthly");

    assert.ok(dailyFine, "Expected $50/day compounding fine extraction");
    assert.equal(dailyFine.annualizedDollars, 18250);
    assert.ok(monthlyFiber, "Expected $89/mo bundled telecom fee extraction");
    assert.equal(monthlyFiber.annualizedDollars, 1068);

    for (const fee of scan.fees) {
      assert.equal(hoa.text.slice(fee.startOffset, fee.endOffset), fee.matchText);
    }
  });

  test("performance: 25KB contract scans < 30ms and 100KB adversarial ReDoS input scans < 60ms", () => {
    const combined = SPECIMENS.slice(0, 4).map((s) => s.text).join("\n\n");
    let contract25k = "";
    while (contract25k.length < 25 * 1024) {
      contract25k += `${combined}\n\n`;
    }
    contract25k = contract25k.slice(0, 26000);

    // Warm one short call to avoid unrelated JIT overhead skewing steady-state budget
    scanDocument("Clean baseline sentence.");

    const t0 = performance.now();
    const res25 = scanDocument(contract25k, { documentId: "perf-25k" });
    const dt25 = performance.now() - t0;
    assert.ok(res25.findings.length > 0);
    assert.ok(dt25 < 30, `25KB contract scan took ${dt25.toFixed(2)}ms (limit < 30ms)`);

    const adversarialChunk =
      "Contractor hereby agrees to defend, indemnify, hold harmless, automatically renew, " +
      "successive holdover unilateral modification URL binding arbitration fee shifting " +
      "perpetual non-compete without cure period liquidated penalty ";
    const redos100k = adversarialChunk.repeat(Math.ceil((102 * 1024) / adversarialChunk.length));
    assert.ok(redos100k.length >= 100 * 1024);

    const t1 = performance.now();
    const res100 = scanDocument(redos100k, { documentId: "perf-100k" });
    const dt100 = performance.now() - t1;
    assert.equal(res100.scannedChars, redos100k.length);
    assert.ok(dt100 < 60, `100KB adversarial scan took ${dt100.toFixed(2)}ms (limit < 60ms)`);
  });

  test("adversarial obfuscation (zero-width, smart quotes, em-dash, NBSP) preserves exact raw offsets", () => {
    const prefix = "PREAMBLE — Section 1.\n";
    const obfuscatedClause =
      "Contractor agrees to defend, i\u200Bnd\u200Cem\u200Dn\uFEFFi\u00ADfy, and hold harmless " +
      "\u201CClient\u201D \u2014 against any\u00A0and all claims, damages, and uncapped liabilities arising out of services.";
    const obfuscatedFee =
      " Resident shall pay a mandatory $45\u00A0/\u200Bmo Valet\u200B Trash Service Fee regardless of usage.";
    const rawText = `${prefix}${obfuscatedClause}\n${obfuscatedFee}`;

    const scan = scanDocument(rawText, { documentId: "obf-test", docCategory: "nda-contractor" });
    const in01 = scan.findings.find((f) => f.ruleId === "IN-01");
    assert.ok(in01, "Obfuscated IN-01 clause must still be detected");
    assert.equal(rawText.slice(in01.startOffset, in01.endOffset), in01.matchText);
    assert.ok(in01.matchText.includes("i\u200Bnd\u200Cem\u200Dn\uFEFFi\u00ADfy"));
    assert.ok(in01.matchText.includes("\u201CClient\u201D \u2014"));

    const fee = scan.fees.find((f) => f.rawAmount === 45 && f.period === "monthly");
    assert.ok(fee, "Obfuscated $45/mo fee must still be extracted");
    assert.equal(rawText.slice(fee.startOffset, fee.endOffset), fee.matchText);

    const applied = applyRedlines(rawText, scan.findings, ["IN-01"], "bilateral");
    assert.equal(applied.appliedCount, 1);
    assert.ok(applied.redlinedText.startsWith(prefix));
    assert.ok(applied.redlinedText.includes(EXPECTED_IN01_BILATERAL));
    assert.ok(applied.redlinedText.endsWith(obfuscatedFee));
  });
});
