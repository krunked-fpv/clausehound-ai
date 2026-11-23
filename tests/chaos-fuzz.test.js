import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { deflateRawSync, deflateSync } from "node:zlib";

import {
  extractDocxText,
  extractPdfText,
  ingestDocumentFile,
  scanDocument
} from "../src/engine/clause-scanner.js";
import {
  createWebLlmBridge,
  detectWebGpuCapability,
  selectOptimalLocalModel
} from "../src/engine/webllm-bridge.js";
import {
  RECEIPT_BYTE_LENGTH,
  decodeReceiptBinary,
  decodeReceiptHash,
  encodeReceiptBinary,
  encodeReceiptHash
} from "../src/share/receipt-codec.js";
import {
  createAudioEngine,
  getAudioState,
  playAirGapLatch,
  playBrassClick,
  playPaperRustle,
  playPenScratch,
  playScanTick,
  playSealThud,
  playSplitFlapClick,
  setAmbientDeskEnabled,
  setAsmrMixLevel,
  unlockAudioContext
} from "../src/audio/faraday-audio.js";
import { SPECIMENS } from "../src/engine/specimens.js";
import { FaradayAirGapError } from "../src/security/faraday-airgap.js";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");

function buildMinimalZipWithCentralDir(filename, rawXmlBytes) {
  const nameBuf = Buffer.from(filename, "utf8");
  const compressed = deflateRawSync(rawXmlBytes);

  // Local file header (with flag bit 3 data descriptor behavior tested via CD sizes)
  const localHeader = Buffer.alloc(30 + nameBuf.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(rawXmlBytes.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  nameBuf.copy(localHeader, 30);

  const cdOffset = localHeader.length + compressed.length;
  const cdHeader = Buffer.alloc(46 + nameBuf.length);
  cdHeader.writeUInt32LE(0x02014b50, 0);
  cdHeader.writeUInt16LE(20, 4);
  cdHeader.writeUInt16LE(20, 6);
  cdHeader.writeUInt16LE(8, 10);
  cdHeader.writeUInt32LE(compressed.length, 20);
  cdHeader.writeUInt32LE(rawXmlBytes.length, 24);
  cdHeader.writeUInt16LE(nameBuf.length, 28);
  cdHeader.writeUInt32LE(0, 42);
  nameBuf.copy(cdHeader, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdHeader.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);

  return Buffer.concat([localHeader, compressed, cdHeader, eocd]);
}

function buildMinimalLocalOnlyZip(filename, rawXmlBytes) {
  const nameBuf = Buffer.from(filename, "utf8");
  const compressed = deflateRawSync(rawXmlBytes);
  const lh = Buffer.alloc(30 + nameBuf.length);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(8, 8);
  lh.writeUInt32LE(compressed.length, 18);
  lh.writeUInt32LE(rawXmlBytes.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26);
  nameBuf.copy(lh, 30);
  return Buffer.concat([lh, compressed]);
}

describe("Chaos, Fuzzing, Ingestion & Graceful Fallback Resilience", () => {
  test("rapid sequential specimen scans and degenerate non-string inputs produce deterministic non-overlapping results", () => {
    const baselineCounts = new Map();
    for (let round = 0; round < 6; round += 1) {
      for (const spec of SPECIMENS) {
        const res = scanDocument(spec.text, { documentId: spec.id, docCategory: spec.docCategory });
        if (!baselineCounts.has(spec.id)) {
          baselineCounts.set(spec.id, { findings: res.findings.length, riskScore: res.riskScore });
        } else {
          const prev = baselineCounts.get(spec.id);
          assert.equal(res.findings.length, prev.findings);
          assert.equal(res.riskScore, prev.riskScore);
        }
      }
    }

    for (const junkInput of ["", "   \n\t  ", null, undefined, 12345, {}, "\0\0\0\0"]) {
      const res = scanDocument(junkInput);
      assert.deepEqual(res.findings, []);
      assert.deepEqual(res.fees, []);
      assert.equal(res.riskScore, 0);
    }
  });

  test("200KB messy paste with Unicode legal punctuation (§, ¶, ©, —, smart quotes, emojis) preserves offset invariants", () => {
    const legalChunk =
      "§ 4.2 ¶ (a) © 2026 Sterling Holdings — \u201CContractor\u201D & \u2018Resident\u2019 ⚖️ 🔒\r\n" +
      "   Contractor agrees to defend, i\u200Bndemnify, and hold harmless Client against any and all claims, damages, and uncapped liabilities arising out of services.\r\n" +
      "   Resident shall pay a mandatory $45/mo Valet Trash Service Fee regardless of usage.\t\r\n";

    const messy200k = legalChunk.repeat(Math.ceil((205 * 1024) / legalChunk.length));
    assert.ok(messy200k.length >= 200 * 1024);

    const start = performance.now();
    const res = scanDocument(messy200k, { documentId: "chaos-200k" });
    const elapsed = performance.now() - start;

    assert.equal(res.scannedChars, messy200k.length);
    assert.ok(res.findings.length >= 1);
    assert.ok(res.fees.length >= 1);
    assert.ok(elapsed < 120, `200KB messy scan took ${elapsed.toFixed(2)}ms`);

    let prevEnd = 0;
    for (const f of res.findings) {
      assert.ok(f.startOffset >= prevEnd);
      assert.ok(f.endOffset > f.startOffset);
      assert.equal(messy200k.slice(f.startOffset, f.endOffset), f.matchText);
      prevEnd = f.endOffset;
    }
    for (const fee of res.fees) {
      assert.equal(messy200k.slice(fee.startOffset, fee.endOffset), fee.matchText);
    }
  });

  test("WebGPU-undefined fallback, dynamic ascending vram_required_MB sorting, and zero hardcoded vendor model names", async () => {
    const bridgeSource = fs.readFileSync(path.join(ROOT_DIR, "src/engine/webllm-bridge.js"), "utf8");
    assert.equal(/https?:\/\//i.test(bridgeSource), false, "webllm-bridge.js must not hardcode external URLs");

    const capNone = await detectWebGpuCapability(undefined);
    assert.deepEqual(capNone, {
      supported: false,
      adapterInfo: null,
      maxBufferSizeMB: 0,
      estimatedVramMB: 0
    });

    const capNoAdapter = await detectWebGpuCapability({
      gpu: { requestAdapter: async () => null }
    });
    assert.equal(capNoAdapter.supported, false);

    // Unsorted + invalid entries
    const catalog = [
      { model_id: "local-tier-xl", vram_required_MB: 8192 },
      null,
      { model_id: "", vram_required_MB: 100 },
      { model_id: "local-tier-bad", vram_required_MB: -50 },
      { model_id: "local-tier-nan", vram_required_MB: Number.NaN },
      { model_id: "local-tier-mid", vram_required_MB: 2048 },
      { model_id: "local-tier-tiny", vram_required_MB: 512, low_resource_required: true },
      { model_id: "local-tier-small", vram_required_MB: 1024 }
    ];

    const midPick = selectOptimalLocalModel(catalog, { estimatedVramMB: 3072 });
    assert.deepEqual(
      midPick.sortedCatalog.map((m) => m.vram_required_MB),
      [512, 1024, 2048, 8192]
    );
    assert.equal(midPick.recommended?.model_id, "local-tier-mid");

    const constrainedPick = selectOptimalLocalModel(catalog, { estimatedVramMB: 0 });
    assert.equal(constrainedPick.recommended?.model_id, "local-tier-tiny");
    assert.deepEqual(selectOptimalLocalModel([], { estimatedVramMB: 4096 }), {
      sortedCatalog: [],
      recommended: null
    });

    // Bridge blocks uncached download when Air-Gap is locked
    const lockedBridge = createWebLlmBridge({
      navigator: undefined,
      isAirGapLocked: () => true,
      isModelCached: async () => false,
      modelList: [{ model_id: "local-tier-tiny", vram_required_MB: 512 }]
    });
    await assert.rejects(() => lockedBridge.loadModel(), (err) => err instanceof FaradayAirGapError);

    // Bridge falls back deterministically when WebGPU is absent and Air-Gap is unlocked (or cached)
    const fallbackBridge = createWebLlmBridge({
      navigator: undefined,
      isAirGapLocked: () => false,
      modelList: [{ model_id: "local-tier-tiny", vram_required_MB: 512 }]
    });
    const loadRes = await fallbackBridge.loadModel();
    assert.equal(loadRes.loaded, false);
    assert.equal(loadRes.mode, "deterministic-fallback");
    assert.equal(loadRes.reason, "webgpu-unsupported");

    const explanation = await fallbackBridge.explainClause({ ruleId: "IN-01" }, "bilateral");
    assert.equal(explanation.mode, "deterministic-fallback");
    assert.ok(explanation.replacementText.includes("mutual"));
    await fallbackBridge.unload();
  });

  test("synthetic .docx, FlateDecode .pdf, scanned-image .pdf, and corrupt binary ingestion never throw", async () => {
    const clauseXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      "<w:document><w:body>" +
      "<w:p><w:r><w:t>Section 1 &amp; 2 &#8212; Contractor agrees to defend, indemnify, and hold harmless Client against any and all claims, damages, and uncapped liabilities arising out of services.</w:t></w:r></w:p>" +
      "</w:body></w:document>";
    const xmlBytes = Buffer.from(clauseXml, "utf8");

    // 1. Standard EOCD + Central Directory DOCX
    const docxFull = buildMinimalZipWithCentralDir("word/document.xml", xmlBytes);
    const resFull = await ingestDocumentFile(docxFull, "Master_Agreement.docx");
    assert.equal(resFull.ok, true);
    assert.equal(resFull.format, "docx");
    assert.equal(resFull.title, "Master Agreement");
    assert.ok(resFull.text.includes("Section 1 & 2 — Contractor agrees to defend"));
    assert.equal(scanDocument(resFull.text).findings[0]?.ruleId, "IN-01");

    // 2. Minimal Local-Header-Only DOCX
    const docxLocal = buildMinimalLocalOnlyZip("word/document.xml", xmlBytes);
    const resLocal = await extractDocxText(docxLocal);
    assert.equal(resLocal.ok, true);
    assert.ok(resLocal.text.includes("uncapped liabilities"));

    // 3. FlateDecode PDF with Tj and TJ kerning array
    const streamPayload = Buffer.from(
      "BT /F1 12 Tf 72 720 Td [(Contractor agrees to defend,) -200 (indemnify, and hold harmless Client against any and all claims, damages, and uncapped liabilities arising out of services.)] TJ ET",
      "latin1"
    );
    const flateStream = deflateSync(streamPayload);
    const pdfBytes = Buffer.concat([
      Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${flateStream.length} /Filter /FlateDecode >>\nstream\n`, "latin1"),
      flateStream,
      Buffer.from("\nendstream\nendobj\n%%EOF\n", "latin1")
    ]);
    const pdfRes = await ingestDocumentFile(pdfBytes, "SaaS_Order.pdf");
    assert.equal(pdfRes.ok, true);
    assert.equal(pdfRes.format, "pdf");
    assert.ok(pdfRes.text.includes("Contractor agrees to defend, indemnify"));

    // 4. Scanned Image PDF (no text layer)
    const scannedPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /XObject /Subtype /Image /Width 800 /Height 600 /Length 8 >>\nstream\n\x00\x01\x02\x03\x04\x05\x06\x07\nendstream\nendobj\n%%EOF\n",
      "latin1"
    );
    const scannedRes = await extractPdfText(scannedPdf);
    assert.equal(scannedRes.ok, false);
    assert.equal(scannedRes.reason, "scanned-image-pdf");

    // 5. Corrupt & truncated archives never throw
    for (const badBytes of [new Uint8Array(0), new Uint8Array(10), Buffer.from("PK\x03\x04garbage"), Buffer.from("%PDF-1.4\ngarbage")]) {
      const docxFail = await extractDocxText(badBytes);
      assert.equal(docxFail.ok, false);
      const pdfFail = await extractPdfText(badBytes);
      assert.equal(pdfFail.ok, false);
    }
    const emptyIngest = await ingestDocumentFile(new Uint8Array(0), "empty.docx");
    assert.equal(emptyIngest.ok, false);
  });

  test("faraday-audio operates cleanly as zero-throw no-op without AudioContext and clamps mix inputs", async () => {
    assert.equal(await unlockAudioContext(), false);
    assert.equal(getAudioState().supported, false);
    assert.equal(getAudioState().unlocked, false);

    // Fuzz all SFX & ambient methods without AudioContext
    playPaperRustle();
    playPenScratch(Number.NaN, -5);
    playBrassClick(Infinity);
    playScanTick(-999);
    playSplitFlapClick(undefined);
    playSealThud();
    playAirGapLatch(true);
    playAirGapLatch(false);
    assert.equal(setAmbientDeskEnabled(true), true);
    assert.equal(setAmbientDeskEnabled(false), false);

    // Fuzz mix clamping
    assert.equal(setAsmrMixLevel(99), 1);
    assert.equal(setAsmrMixLevel(-12), 0);
    assert.equal(setAsmrMixLevel(Number.NaN), 0);
    assert.equal(setAsmrMixLevel("0.8"), 0);
    assert.equal(setAsmrMixLevel(0.32), 0.32);

    const isolated = createAudioEngine({ AudioContext: undefined, initialMixLevel: 5 });
    assert.equal(isolated.getAudioState().supported, false);
    assert.equal(isolated.getAudioState().mixLevel, 1);
    isolated.playSealThud();
    await isolated.dispose();
  });

  test("receipt codec safely rejects malformed #receipt= strings, invalid headers, and all 296 single-bit flips", () => {
    const malformedHashes = [
      "",
      "   ",
      null,
      undefined,
      12345,
      {},
      "#receipt=",
      "#receipt=CORRUPT_PAYLOAD",
      "#receipt=!!!@@@###",
      "https://krunked-fpv.github.io/clausehound-ai/#receipt=TOO_SHORT",
      "https://krunked-fpv.github.io/clausehound-ai/?receipt=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "#receipt=" + "A".repeat(80),
      "receipt=CORRUPT"
    ];

    for (const bad of malformedHashes) {
      assert.equal(decodeReceiptHash(bad), null, `Expected null for malformed hash: ${String(bad)}`);
    }

    // Wrong lengths & bad headers
    assert.equal(decodeReceiptBinary(null), null);
    assert.equal(decodeReceiptBinary(new Uint8Array(0)), null);
    assert.equal(decodeReceiptBinary(new Uint8Array(36)), null);
    assert.equal(decodeReceiptBinary(new Uint8Array(38)), null);

    // Valid binary round-trip then exhaustively flip every single bit across all 37 bytes
    const valid = encodeReceiptBinary({
      airGapLocked: true,
      sealed: true,
      tone: "bilateral",
      docCategory: "residential-lease",
      riskScoreBefore: 99,
      riskScoreAfter: 0,
      trapsDetected: 20,
      trapsNeutralized: 20,
      annualDollarsSaved: 1860,
      timestampUnixSec: 1795422281,
      text: "Sterling Lease Baseline",
      categoryCounts: { AUTO_RENEWAL: 3, JUNK_FEES: 4, INDEMNITY: 2 }
    });
    assert.equal(valid.length, RECEIPT_BYTE_LENGTH);
    assert.ok(decodeReceiptHash(encodeReceiptHash({
      airGapLocked: true,
      sealed: true,
      tone: "bilateral",
      docCategory: "residential-lease",
      riskScoreBefore: 99,
      riskScoreAfter: 0,
      trapsDetected: 20,
      trapsNeutralized: 20,
      annualDollarsSaved: 1860,
      timestampUnixSec: 1795422281
    })));

    for (let byteIdx = 0; byteIdx < valid.length; byteIdx += 1) {
      for (let bit = 0; bit < 8; bit += 1) {
        const flipped = new Uint8Array(valid);
        flipped[byteIdx] ^= 1 << bit;
        assert.equal(
          decodeReceiptBinary(flipped),
          null,
          `Bit-flip at byte ${byteIdx} bit ${bit} unexpectedly passed validation`
        );
      }
    }
  });
});
