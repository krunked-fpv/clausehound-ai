/**
 * ClauseHound Local — Deterministic Predatory Clause Lexicon (160 Rules / 10 Categories)
 * Pure ES module with zero DOM/network dependencies and strict anti-ReDoS bounded patterns.
 */

export const CATEGORY_IDS = Object.freeze([
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

export const TONE_OPTIONS = Object.freeze(["collaborative", "bilateral", "counsel"]);

export const DOC_CATEGORY_ENUM = Object.freeze([
  "residential-lease",
  "nda-contractor",
  "saas-msa",
  "hoa-covenants",
  "custom-agreement"
]);

export const MIN_TOTAL_RULES = 152;
export const MIN_RULES_PER_CATEGORY = 15;

export const CATEGORY_RULE_TARGETS = Object.freeze({
  AUTO_RENEWAL: 16,
  INDEMNITY: 16,
  IP_GRAB: 15,
  JUNK_FEES: 15,
  LIABILITY_CAP: 15,
  UNILATERAL_MOD: 15,
  ARBITRATION_VENUE: 15,
  NON_COMPETE: 15,
  TERMINATION_CURE: 15,
  HOA_LIEN_DATA: 15
});

export const CATEGORY_METADATA = Object.freeze({
  AUTO_RENEWAL: Object.freeze({
    id: "AUTO_RENEWAL",
    label: "Auto-Renewal & Evergreen Traps",
    weight: 1.15,
    summary: "Multi-year lock-ins, narrow cancellation windows, and silent price escalators."
  }),
  INDEMNITY: Object.freeze({
    id: "INDEMNITY",
    label: "One-Way Indemnification",
    weight: 1.3,
    summary: "Uncapped hold-harmless clauses shifting drafter negligence and defense costs onto you."
  }),
  IP_GRAB: Object.freeze({
    id: "IP_GRAB",
    label: "IP & Background Toolkit Grabs",
    weight: 1.25,
    summary: "Disguised work-for-hire assignments capturing pre-existing libraries, tools, and moral rights."
  }),
  JUNK_FEES: Object.freeze({
    id: "JUNK_FEES",
    label: "Recurring Junk Fees & Surcharges",
    weight: 1.2,
    summary: "Mandatory valet, smart-lock, billing, amenity, and bulk bundle surcharges."
  }),
  LIABILITY_CAP: Object.freeze({
    id: "LIABILITY_CAP",
    label: "Asymmetric Liability Caps",
    weight: 1.25,
    summary: "Micro-caps protecting the drafter while leaving counterparty obligations uncapped."
  }),
  UNILATERAL_MOD: Object.freeze({
    id: "UNILATERAL_MOD",
    label: "Unilateral Terms & URL Drift",
    weight: 1.1,
    summary: "Silent amendment via online URLs, unannounced entry rights, and retroactive policy shifts."
  }),
  ARBITRATION_VENUE: Object.freeze({
    id: "ARBITRATION_VENUE",
    label: "Forced Arbitration & Fee Shifting",
    weight: 1.15,
    summary: "One-way attorney fee shifts, bondless injunctions, class waivers, and captive venues."
  }),
  NON_COMPETE: Object.freeze({
    id: "NON_COMPETE",
    label: "Overbroad Non-Compete & Non-Solicit",
    weight: 1.15,
    summary: "Perpetual worldwide client non-solicits, industry restraints, and broad gag clauses."
  }),
  TERMINATION_CURE: Object.freeze({
    id: "TERMINATION_CURE",
    label: "Termination & Cure Asymmetry",
    weight: 1.1,
    summary: "Zero cure periods, automatic deposit forfeiture, acceleration penalties, and exit ransoms."
  }),
  HOA_LIEN_DATA: Object.freeze({
    id: "HOA_LIEN_DATA",
    label: "HOA Liens, Fines & Data Monetization",
    weight: 1.1,
    summary: "Compounding daily fines, non-judicial foreclosure liens, committee immunity, and telemetry resale."
  })
});

const DEFAULT_DOCS = Object.freeze([...DOC_CATEGORY_ENUM]);

function defineRule({
  id,
  categoryId,
  title,
  severity,
  riskPoints,
  annualFeeEstimate = 0,
  docCategories = DEFAULT_DOCS,
  anchorKeywords,
  pattern,
  rationale,
  redlines
}) {
  return Object.freeze({
    id,
    categoryId,
    title,
    severity,
    riskPoints,
    annualFeeEstimate,
    docCategories: Object.freeze([...docCategories]),
    anchorKeywords: Object.freeze(anchorKeywords.map((kw) => kw.toLowerCase())),
    pattern,
    rationale,
    redlines: Object.freeze({
      collaborative: redlines.collaborative,
      bilateral: redlines.bilateral,
      counsel: redlines.counsel
    })
  });
}

const RAW_RULES = [
  // =========================================================================
  // 1. AUTO_RENEWAL (AR-01 .. AR-16)
  // =========================================================================
  defineRule({
    id: "AR-01",
    categoryId: "AUTO_RENEWAL",
    title: "Multi-Year Automatic Renewal Lock-In",
    severity: "critical",
    riskPoints: 22,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["successive", "auto-renew", "automatically renew"],
    pattern: /\b(?:this\s+agreement\s+)?(?:automatically\s+renew(?:s)?|auto-renew(?:s|al)?)\b[^.;\n]{0,95}\b(?:successive\s+(?:12|24|36|48|60)[- ]month|(?:two|three|four|five)[- ]year)\b[^.;\n]{0,115}\.?/i,
    rationale: "Locks the customer into multi-year commitments automatically instead of converting to flexible annual or month-to-month renewal.",
    redlines: {
      collaborative: "Upon expiration of the Initial Term, this Agreement may renew for successive 12-month periods unless either party gives at least 30 days' prior written notice of non-renewal.",
      bilateral: "This Agreement shall not automatically renew for multi-year terms; any renewal beyond the Initial Term requires mutual written execution or converts to a month-to-month term terminable on 30 days' notice.",
      counsel: "Automatic renewal is deleted in its entirety. Expiration of the Initial Term terminates all recurring fee obligations unless expressly extended via a bilateral signed Order Form."
    }
  }),
  defineRule({
    id: "AR-02",
    categoryId: "AUTO_RENEWAL",
    title: "Narrow Evergreen Cancellation Window Cliff",
    severity: "high",
    riskPoints: 18,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "saas-msa", "custom-agreement"],
    anchorKeywords: ["window between", "between 60", "between 90", "strictly between", "cancellation window", "opt-out window"],
    pattern: /\b(?:(?:unless|except|only\s+during)[^.;\n]{0,80})?(?:strictly\s+)?(?:during\s+the\s+[^.;\n]{0,35})?(?:(?:window\s+)?between\s+\d{2,3}\s+(?:days?\s+)?(?:and|to|-)\s+\d{2,3}\s+days?|\d{2,3}-to-\d{2,3}[- ]day\s+(?:cancellation|opt-out|notice)\s+window)\b[^.;\n]{0,100}\.?/i,
    rationale: "Creates a trapdoor cancellation window where notices sent either too early or too late are rejected, forcing an unwanted renewal term.",
    redlines: {
      collaborative: "Either party may elect not to renew by providing written notice at any time at least 30 days prior to the expiration of the current term.",
      bilateral: "Non-renewal notice shall be valid whenever delivered in writing (including email) at least 30 days prior to term expiration, without early-notice disqualification or narrow filing windows.",
      counsel: "All narrow notice-window restrictions are void. Notice of non-renewal delivered at any time prior to the final 15 days of the term is effective immediately upon dispatch."
    }
  }),
  defineRule({
    id: "AR-03",
    categoryId: "AUTO_RENEWAL",
    title: "Silent Automatic Annual Price Escalator",
    severity: "critical",
    riskPoints: 20,
    annualFeeEstimate: 1200,
    docCategories: ["saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["increase", "uplift", "escalat"],
    pattern: /\b(?:(?:vendor|provider|landlord)\s+may\s+)?(?:increase|uplift|escalat(?:e|ion))[^.;\n]{0,70}\b(?:automatically\s+)?(?:by\s+)?(?:\d{1,2}(?:\.\d+)?%|ten|twelve|fifteen\s+percent)\s+(?:per\s+year|annually|on\s+each\s+anniversary|upon\s+renewal)\b[^.;\n]{0,95}\.?/i,
    rationale: "Allows the vendor to compound fees automatically each year without prior notice, consent, or benchmarking.",
    redlines: {
      collaborative: "Any renewal price adjustment shall be capped at 3% annually with at least 60 days' advance written notice prior to the opt-out deadline.",
      bilateral: "Annual fee escalations are removed; pricing remains fixed during the term and any renewal increase shall not exceed the lesser of CPI or 3% with 60 days' written notice and an unpenalized opt-out right.",
      counsel: "Unilateral and automatic price escalators are deleted. Fees are strictly locked for the Initial Term and any renewal term unless modified by a mutually executed amendment."
    }
  }),
  defineRule({
    id: "AR-04",
    categoryId: "AUTO_RENEWAL",
    title: "Lease Evergreen 12-Month Rollover Cliff",
    severity: "high",
    riskPoints: 17,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease"],
    anchorKeywords: ["roll over", "rollover", "renew for another", "another full 12-month"],
    pattern: /\b(?:roll\s*over|automatically\s+renew|renew\s+for\s+another)\b[^.;\n]{0,85}\b(?:12[- ]month|one[- ]year|full\s+year)\b[^.;\n]{0,90}\.?/i,
    rationale: "Forces a residential tenant into another full-year fixed lease rather than standard month-to-month continuation.",
    redlines: {
      collaborative: "At the end of the initial lease term, tenancy shall convert to month-to-month terminable by either party upon 30 days' written notice.",
      bilateral: "Fixed-term automatic rollover is eliminated; upon expiration of the initial lease term, this Lease continues month-to-month at the existing base rent unless a new fixed term is signed.",
      counsel: "Automatic 12-month lease rollover is deleted. Following the Initial Term, Resident may occupy on a statutory month-to-month basis terminable on 30 days' written notice without penalty."
    }
  }),
  defineRule({
    id: "AR-05",
    categoryId: "AUTO_RENEWAL",
    title: "Certified-Mail-Only Cancellation Friction",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "saas-msa", "custom-agreement"],
    anchorKeywords: ["certified mail", "registered mail", "notarized"],
    pattern: /\b(?:cancellation|termination|non-renewal)\s+(?:notice\s+)?(?:must|shall)\s+be\s+(?:sent|delivered)[^.;\n]{0,65}\b(?:certified\s+mail|registered\s+mail|return\s+receipt|notarized)\b[^.;\n]{0,80}\.?/i,
    rationale: "Creates artificial procedural hurdles designed to invalidate timely email or portal cancellation notices.",
    redlines: {
      collaborative: "Notice of cancellation or non-renewal may be sent via email to the billing contact or through the account portal in addition to physical mail.",
      bilateral: "Written notices, including non-renewal and termination notices, are effective when sent via email with delivery confirmation, account portal submission, or standard mail.",
      counsel: "Paper-only and certified-mail notice mandates are struck. Electronic notice to the counterparty's designated email address constitutes complete and binding written notice."
    }
  }),
  defineRule({
    id: "AR-06",
    categoryId: "AUTO_RENEWAL",
    title: "CPI Plus Percentage Compounding Uplift",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 750,
    docCategories: ["saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["cpi plus", "consumer price index plus", "greater of cpi"],
    pattern: /\b(?:cpi\s+plus|consumer\s+price\s+index\s+plus|greater\s+of\s+cpi)[^.;\n]{0,95}\.?/i,
    rationale: "Doubles inflation exposure by stacking an arbitrary fixed surcharge on top of CPI increases.",
    redlines: {
      collaborative: "Any annual adjustment shall track CPI alone, capped at 3% per year, with 60 days' prior written notice.",
      bilateral: "Renewal fee increases are limited strictly to actual published CPI-U not to exceed 3% annually, eliminating additive margin surcharges.",
      counsel: "Compounding CPI-plus pricing formulas are deleted; renewal fees may not increase absent mutual written agreement."
    }
  }),
  defineRule({
    id: "AR-07",
    categoryId: "AUTO_RENEWAL",
    title: "Silent Trial-to-Annual Paid Conversion",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 600,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["trial period", "evaluation period", "free trial"],
    pattern: /\b(?:trial\s+period|free\s+trial|evaluation\s+period)\b[^.;\n]{0,80}\b(?:automatically\s+convert|billed\s+for\s+a\s+full\s+annual|charged\s+automatically)\b[^.;\n]{0,90}\.?/i,
    rationale: "Converts an evaluation period into a non-refundable annual billing commitment without affirmative opt-in.",
    redlines: {
      collaborative: "Before converting from an evaluation period to a paid subscription, Vendor will request affirmative billing confirmation via email.",
      bilateral: "Trial or evaluation access expires automatically at the end of the trial period and shall not convert to a paid annual term without Customer's explicit written opt-in.",
      counsel: "Negative-option trial conversion is void. Paid billing commences solely upon signed execution of a commercial Order Form following trial conclusion."
    }
  }),
  defineRule({
    id: "AR-08",
    categoryId: "AUTO_RENEWAL",
    title: "Locked Minimum Seat Floor Across Renewals",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 500,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["seat", "licenses", "minimum commitment"],
    pattern: /\b(?:minimum\s+(?:seat|license|user)\s+(?:count|commitment|floor)|may\s+not\s+reduce\s+(?:seats|licenses|users))\b[^.;\n]{0,95}\.?/i,
    rationale: "Prevents downsizing unused seats or licenses even at renewal checkpoints.",
    redlines: {
      collaborative: "Customer may adjust committed seat counts up or down prior to each annual renewal with 15 days' notice.",
      bilateral: "Minimum seat floors apply only to the Initial Term; Customer may reduce seat quantities freely prior to any renewal period without penalty.",
      counsel: "Seat-count lockouts across renewals are deleted. Customer shall pay solely for active provisioned licenses as adjusted prior to any billing cycle."
    }
  }),
  defineRule({
    id: "AR-09",
    categoryId: "AUTO_RENEWAL",
    title: "Holdover Double-Rent / 200% Rate Penalty",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 2400,
    docCategories: ["residential-lease", "saas-msa"],
    anchorKeywords: ["holdover", "hold over", "200%", "double the"],
    pattern: /\b(?:holdover|hold\s+over)\b[^.;\n]{0,75}\b(?:150%|200%|double|twice\s+the)\b[^.;\n]{0,80}\.?/i,
    rationale: "Imposes punitive 150%-200% rates if a move-out or contract migration runs even one day past expiration.",
    redlines: {
      collaborative: "Any brief holdover consented to or during active transition shall be billed on a prorated daily basis at 110% of the prior base rate.",
      bilateral: "Holdover occupancy or transition use up to 30 days shall be billed pro rata at the existing base rate; any surcharge above 115% applies only after 15 days' written demand to vacate.",
      counsel: "Punitive holdover multipliers are struck. Any post-expiration transition period is billed strictly pro rata at 100% of the immediately preceding monthly base fee."
    }
  }),
  defineRule({
    id: "AR-10",
    categoryId: "AUTO_RENEWAL",
    title: "Renewal Triggered by Key or Equipment Return Delay",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 900,
    docCategories: ["residential-lease", "custom-agreement"],
    anchorKeywords: ["return of keys", "return all equipment", "failure to return"],
    pattern: /\b(?:failure\s+to\s+return|until\s+all\s+keys|return\s+of\s+keys|return\s+all\s+equipment)\b[^.;\n]{0,80}\b(?:renew|extend|full\s+(?:month|term)|continue\s+to\s+accrue)\b[^.;\n]{0,80}\.?/i,
    rationale: "Extends full-term liability over minor logistical delays in returning keys, badges, or hardware.",
    redlines: {
      collaborative: "Delayed return of keys or hardware incurs only actual replacement cost rather than extending the lease or service term.",
      bilateral: "Notice of termination ends recurring term charges on the termination date; unreturned keys or hardware are addressed solely via documented replacement-cost deduction.",
      counsel: "Term extension conditioned on physical key or equipment return is deleted; liability is capped strictly at verified replacement value."
    }
  }),
  defineRule({
    id: "AR-11",
    categoryId: "AUTO_RENEWAL",
    title: "Early Notice Disqualification Trap",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "saas-msa", "custom-agreement"],
    anchorKeywords: ["too early", "prior to the window", "deemed void if delivered"],
    pattern: /\b(?:notice\s+(?:sent|delivered|given)\s+(?:earlier|more\s+than)\s+\d+\s+days|too\s+early|deemed\s+(?:void|invalid)\s+if\s+delivered\s+before)\b[^.;\n]{0,90}\.?/i,
    rationale: "Invalidates proactive cancellation notices submitted months in advance, forcing the customer to remember a tiny calendar slot.",
    redlines: {
      collaborative: "Early non-renewal notices received ahead of the standard notice deadline shall be honored as valid for the upcoming term end.",
      bilateral: "Any non-renewal notice delivered at least 30 days before term end—regardless of how early it is sent—is unconditionally valid and binding.",
      counsel: "Early-notice disqualification is void. Notice of non-renewal may be delivered at any time from Effective Date through 15 days prior to expiration."
    }
  }),
  defineRule({
    id: "AR-12",
    categoryId: "AUTO_RENEWAL",
    title: "Automatic Tier Upgrade on Temporary Usage Spike",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 840,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["automatically upgrade", "next tier", "overage"],
    pattern: /\b(?:automatically\s+upgrade|auto-upgrade|elevated\s+to\s+the\s+next\s+tier)\b[^.;\n]{0,95}\.?/i,
    rationale: "Permanently locks the subscriber into a higher billing tier after a single transient usage spike.",
    redlines: {
      collaborative: "Temporary usage overages will trigger a notification alert and prorated single-month overage billing rather than a permanent tier upgrade.",
      bilateral: "Usage exceeding plan thresholds shall trigger 5 business days' advance notice and apply solely as a metered single-period overage unless Customer approves a permanent tier upgrade.",
      counsel: "Automatic tier upgrades are deleted. Customer shall incur zero permanent subscription elevation without an executed Change Order."
    }
  }),
  defineRule({
    id: "AR-13",
    categoryId: "AUTO_RENEWAL",
    title: "Promotional Rate Snap-Back to Rack List Price",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 960,
    docCategories: ["saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["list price", "standard published rate", "promotional discount"],
    pattern: /\b(?:promotional\s+discount|introductory\s+rate)\b[^.;\n]{0,75}\b(?:revert|snap\s+back|standard\s+published\s+rate|then-current\s+list\s+price)\b[^.;\n]{0,85}\.?/i,
    rationale: "Causes sharp unexpected renewal shock by resetting negotiated discounts back to arbitrary rack pricing.",
    redlines: {
      collaborative: "Any transition off an introductory rate shall be disclosed in writing 60 days prior to renewal with an option to renew at no more than a 5% adjustment.",
      bilateral: "Negotiated discount percentages carry forward into renewal terms unless Vendor gives 60 days' prior written notice and Customer affirmatively accepts revised pricing.",
      counsel: "Unilateral revocation of negotiated pricing upon renewal is deleted; baseline unit rates remain protected under the capped renewal adjustment."
    }
  }),
  defineRule({
    id: "AR-14",
    categoryId: "AUTO_RENEWAL",
    title: "Perpetual Term Requiring Mutual Consent to Exit",
    severity: "critical",
    riskPoints: 21,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa", "custom-agreement"],
    anchorKeywords: ["perpetual", "indefinite term", "until mutually terminated"],
    pattern: /\b(?:continue\s+in\s+perpetuity|indefinite\s+term|remain\s+in\s+effect\s+indefinitely|until\s+mutually\s+terminated)\b[^.;\n]{0,95}\.?/i,
    rationale: "Creates an indefinite obligation that one party cannot exit unilaterally without counterparty permission.",
    redlines: {
      collaborative: "Either party may terminate this Agreement for convenience upon 30 days' prior written notice.",
      bilateral: "This Agreement has a finite 12-month term and may be terminated by either party at any time upon 30 days' prior written notice without penalty.",
      counsel: "Perpetual and mutual-consent termination lock-ins are deleted. Either party may terminate unilaterally on 30 days' written notice."
    }
  }),
  defineRule({
    id: "AR-15",
    categoryId: "AUTO_RENEWAL",
    title: "Co-Terminous Add-On Renewal Reset Trap",
    severity: "medium",
    riskPoints: 10,
    annualFeeEstimate: 450,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["extend the entire", "reset the term", "co-terminous"],
    pattern: /\b(?:adding\s+(?:a\s+)?(?:seat|module|add-on)|purchasing\s+additional)\b[^.;\n]{0,75}\b(?:reset\s+the\s+(?:initial\s+)?term|extend\s+the\s+entire\s+agreement)\b[^.;\n]{0,80}\.?/i,
    rationale: "Silently restarts the full multi-year contract clock across all base licenses whenever one minor add-on is purchased.",
    redlines: {
      collaborative: "Additional add-on modules will co-terminate with the existing primary Order Form without extending the master term.",
      bilateral: "Supplemental seats or add-ons shall be prorated and co-terminous with the existing subscription end date and shall never extend or reset the underlying Agreement term.",
      counsel: "Term-reset triggers tied to incremental purchases are deleted. All add-ons co-terminate strictly with the primary term."
    }
  }),
  defineRule({
    id: "AR-16",
    categoryId: "AUTO_RENEWAL",
    title: "Waiver of Advance Renewal Reminder Notice",
    severity: "medium",
    riskPoints: 9,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["no obligation to remind", "waives any reminder", "without prior renewal notice"],
    pattern: /\b(?:no\s+obligation\s+to\s+(?:send\s+)?(?:a\s+)?remind|waives?\s+any\s+(?:statutory\s+)?renewal\s+notice|without\s+prior\s+renewal\s+notice)\b[^.;\n]{0,90}\.?/i,
    rationale: "Strips away advance reminder notices designed to prevent accidental rollover traps.",
    redlines: {
      collaborative: "Provider agrees to send a courtesy email reminder at least 45 days before any automatic renewal window closes.",
      bilateral: "No renewal shall take effect unless the billing party sends written renewal notice at least 45 days—and no more than 90 days—prior to the opt-out deadline.",
      counsel: "Waivers of statutory and contractual renewal reminders are void; advance written notice at least 45 days before renewal is an express condition precedent to any renewal."
    }
  }),

  // =========================================================================
  // 2. INDEMNITY (IN-01 .. IN-16) — IN-01 IS BENCHMARK RULE
  // =========================================================================
  defineRule({
    id: "IN-01",
    categoryId: "INDEMNITY",
    title: "One-Way Uncapped Defend & Hold Harmless Indemnity",
    severity: "critical",
    riskPoints: 25,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["indemnify", "hold harmless", "uncapped liabilities"],
    pattern: /\b(?:(?:contractor|vendor|provider|consultant|company|customer|client|tenant|lessee|supplier|developer|licensee|recipient|party)\s+(?:hereby\s+)?(?:agrees?|covenants?|shall|will)\s+(?:to\s+)?(?:defend,?\s+)?(?:and\s+)?)?indemnify\b(?:\s*,?\s*and\s+hold\s+harmless)?[^.;\n]{0,100}(?:any\s+and\s+all|all\s+claims|uncapped|liabilit)[^.;\n]{0,110}\.?/i,
    rationale: "Shifts unlimited, uncapped third-party and consequential liability onto one party regardless of fault, negligence, or fee proportionality.",
    redlines: {
      collaborative: "Each party shall mutually indemnify the other for third-party claims directly resulting from its own gross negligence or willful misconduct, subject to the contractual liability cap.",
      bilateral: "Indemnification shall be strictly mutual, limited to verified third-party claims caused by gross negligence or willful misconduct, capped at fees paid in the preceding 12 months, and explicitly excluding indirect, incidental, or consequential damages.",
      counsel: "One-way uncapped indemnification is rejected. Mutual indemnification applies strictly to final non-appealable third-party judgments arising from a party's willful misconduct or gross negligence, capped at 12 months' fees and excluding all consequential damages."
    }
  }),
  defineRule({
    id: "IN-02",
    categoryId: "INDEMNITY",
    title: "Indemnification Covering Drafter's Own Negligence",
    severity: "critical",
    riskPoints: 24,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "nda-contractor", "saas-msa", "custom-agreement"],
    anchorKeywords: ["sole negligence", "own negligence", "even if caused by"],
    pattern: /\b(?:indemnify|hold\s+harmless)[^.;\n]{0,95}\b(?:even\s+if\s+caused\s+by|regardless\s+of\s+fault|own\s+negligence|sole\s+or\s+partial\s+negligence)\b[^.;\n]{0,95}\.?/i,
    rationale: "Forces you to insure the drafter against their own mistakes and negligent conduct.",
    redlines: {
      collaborative: "Neither party is obligated to indemnify the other to the extent a claim arises from the indemnified party's own negligence or misconduct.",
      bilateral: "Indemnification obligations strictly exclude any claims, losses, or damages attributable in whole or in part to the negligence, breach, or willful misconduct of the indemnified party.",
      counsel: "Indemnity for the indemnified party's own negligence is void. Fault shall be allocated strictly on comparative fault principles."
    }
  }),
  defineRule({
    id: "IN-03",
    categoryId: "INDEMNITY",
    title: "Mandatory Advance Duty to Defend Prior to Fault",
    severity: "high",
    riskPoints: 18,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa", "custom-agreement"],
    anchorKeywords: ["duty to defend", "defend upon demand", "advance defense costs"],
    pattern: /\b(?:duty\s+to\s+defend|defend\s+(?:immediately\s+)?upon\s+demand|advance\s+(?:all\s+)?defense\s+costs)\b[^.;\n]{0,100}\.?/i,
    rationale: "Requires paying the counterparty's legal defense bills upfront based merely on allegations before liability is proven.",
    redlines: {
      collaborative: "Indemnification covers reasonable defense costs only for verified covered claims after prompt written notice and good-faith coordination.",
      bilateral: "Reimbursement of reasonable defense fees applies solely upon final judgment or approved settlement of a verified third-party claim attributable to the indemnifying party.",
      counsel: "Pre-adjudication duty to defend and defense-cost advancement are deleted; indemnity applies strictly to actual adjudicated damages."
    }
  }),
  defineRule({
    id: "IN-04",
    categoryId: "INDEMNITY",
    title: "Uncapped Customer Indemnity for Data & Regulatory Fines",
    severity: "critical",
    riskPoints: 22,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["regulatory fines", "data losses", "customer shall defend"],
    pattern: /\b(?:customer|subscriber|user)\s+(?:shall|agrees\s+to)\s+(?:defend,?\s+)?indemnify[^.;\n]{0,95}\b(?:regulatory\s+fines|data\s+loss(?:es)?|uncapped\s+third-party)\b[^.;\n]{0,95}\.?/i,
    rationale: "Makes the customer pay unlimited regulatory fines even when vendor security controls or platform architecture contributed to the incident.",
    redlines: {
      collaborative: "Each party indemnifies the other for regulatory penalties caused solely by its own statutory violation, capped under the Agreement's mutual liability ceiling.",
      bilateral: "Customer indemnifies Vendor solely for third-party claims arising from unlawful Customer-uploaded content, while Vendor reciprocally indemnifies Customer for platform security breaches and statutory violations, each capped at 12 months' fees.",
      counsel: "One-way customer data and regulatory indemnity is rejected. Vendor retains full responsibility for platform security, SOC-aligned controls, and regulatory compliance within its infrastructure."
    }
  }),
  defineRule({
    id: "IN-05",
    categoryId: "INDEMNITY",
    title: "Tenant Indemnity for Common-Area or Third-Party Injury",
    severity: "high",
    riskPoints: 18,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease"],
    anchorKeywords: ["common area", "building", "hold landlord harmless"],
    pattern: /\b(?:resident|tenant)\s+(?:shall|agrees\s+to)\s+(?:indemnify|hold\s+(?:landlord|owner)\s+harmless)[^.;\n]{0,95}\b(?:common\s+area|premises|injury|property\s+damage)\b[^.;\n]{0,95}\.?/i,
    rationale: "Shifts landlord premises liability for slips, structural defects, or common-area hazards onto the residential tenant.",
    redlines: {
      collaborative: "Resident's responsibility is limited to damages inside the leased unit caused directly by Resident's own negligence.",
      bilateral: "Resident indemnifies Landlord solely for bodily injury or property damage inside the Premises caused directly by Resident's negligence, excluding common areas and structural conditions maintained by Landlord.",
      counsel: "Broad tenant premises indemnification is deleted. Landlord retains statutory liability for all common areas, building systems, and landlord maintenance duties."
    }
  }),
  defineRule({
    id: "IN-06",
    categoryId: "INDEMNITY",
    title: "Unilateral IP Infringement Indemnity Without Reciprocity",
    severity: "high",
    riskPoints: 17,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa"],
    anchorKeywords: ["intellectual property infringement", "patent", "copyright claim"],
    pattern: /\b(?:indemnify|defend)[^.;\n]{0,80}\b(?:intellectual\s+property\s+infringement|patent|copyright\s+claim)\b[^.;\n]{0,80}(?:without\s+limitation|at\s+(?:contractor|customer)'s\s+sole\s+expense)\b[^.;\n]{0,80}\.?/i,
    rationale: "Forces a contractor or customer to carry unbounded IP litigation risk without mutual vendor infringement protection.",
    redlines: {
      collaborative: "IP infringement indemnification applies mutually: Vendor covers platform IP claims and Customer/Contractor covers materials it independently supplies.",
      bilateral: "IP indemnification is strictly reciprocal, limited to actual third-party infringement claims based on materials provided solely by the indemnifying party, and excludes client-mandated specifications.",
      counsel: "One-sided IP infringement indemnity is struck; Provider disclaims liability for specifications, open-source components mandated by Client, or unauthorized modifications."
    }
  }),
  defineRule({
    id: "IN-07",
    categoryId: "INDEMNITY",
    title: "Indemnity Extending to Unknown Assignees & Affiliates",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa", "residential-lease", "hoa-covenants"],
    anchorKeywords: ["affiliates", "successors", "assigns", "officers"],
    pattern: /\b(?:indemnify|hold\s+harmless)[^.;\n]{0,55}\b(?:and\s+(?:its|their)\s+(?:past,?\s+present,?\s+and\s+future\s+)?(?:affiliates|parents|subsidiaries|successors|assigns|lenders))\b[^.;\n]{0,95}\.?/i,
    rationale: "Expands indemnification beneficiaries to unknown corporate parents, lenders, and future assignees.",
    redlines: {
      collaborative: "Indemnification runs strictly to the named contracting party and its direct officers and employees.",
      bilateral: "Indemnification obligations are limited solely to the named counterparty entity and its direct employees acting within the scope of this Agreement.",
      counsel: "Extension of indemnification rights to remote affiliates, lenders, and unconsented assignees is deleted."
    }
  }),
  defineRule({
    id: "IN-08",
    categoryId: "INDEMNITY",
    title: "Strict Vicarious Liability for Guests or Subcontractors",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "nda-contractor", "hoa-covenants"],
    anchorKeywords: ["guests", "invitees", "delivery drivers", "strictly liable"],
    pattern: /\b(?:strictly\s+liable|unconditionally\s+indemnify)[^.;\n]{0,85}\b(?:guests|invitees|visitors|subcontractors|delivery)\b[^.;\n]{0,85}\.?/i,
    rationale: "Imposes strict liability for acts of third parties beyond your reasonable control.",
    redlines: {
      collaborative: "Responsibility for guests or approved subcontractors applies only where you negligently authorized unsafe conduct.",
      bilateral: "Each party is liable only for intentional or negligent acts of its authorized personnel or invited guests while under its direct supervision.",
      counsel: "Strict vicarious liability for uninvited persons, delivery couriers, or independent third parties is deleted."
    }
  }),
  defineRule({
    id: "IN-09",
    categoryId: "INDEMNITY",
    title: "Unilateral Settlement Control at Indemnitor's Expense",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa", "custom-agreement"],
    anchorKeywords: ["sole control of the defense", "settle any claim", "without consent"],
    pattern: /\b(?:sole\s+control\s+of\s+(?:the\s+)?defense|settle\s+any\s+claim[^.;\n]{0,60}without\s+(?:the\s+other\s+party's\s+)?consent)\b[^.;\n]{0,90}\.?/i,
    rationale: "Allows the counterparty to admit fault or sign an expensive settlement using your money without your approval.",
    redlines: {
      collaborative: "Neither party will settle an indemnified claim in a manner admitting fault or creating financial obligation without the indemnifying party's prior written consent.",
      bilateral: "The indemnifying party controls defense of covered claims with counsel reasonably acceptable to the indemnified party, and no settlement imposing admission of fault or payment may occur without mutual consent.",
      counsel: "Unilateral settlement authority is deleted. No settlement binds the indemnifying party absent prior signed written authorization."
    }
  }),
  defineRule({
    id: "IN-10",
    categoryId: "INDEMNITY",
    title: "Perpetual Post-Termination Indemnity Survival",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa", "custom-agreement"],
    anchorKeywords: ["survive indefinitely", "survive in perpetuity", "indemnification obligations shall survive"],
    pattern: /\b(?:indemnif(?:y|ication)[^.;\n]{0,75}\bsurvive\s+(?:indefinitely|in\s+perpetuity|forever))\b[^.;\n]{0,80}\.?/i,
    rationale: "Keeps open-ended financial indemnification exposure alive forever after the contract ends.",
    redlines: {
      collaborative: "Indemnification obligations shall survive termination for a reasonable period of 12 months for claims arising during the term.",
      bilateral: "Indemnification obligations survive expiration or termination strictly for 12 months (or the minimum applicable statutory limitations period if shorter) solely for events occurring during the term.",
      counsel: "Perpetual indemnity survival is struck; all indemnification claims must be noticed in writing within 12 months of contract expiration or be permanently barred."
    }
  }),
  defineRule({
    id: "IN-11",
    categoryId: "INDEMNITY",
    title: "Tax & Worker Misclassification Indemnity Shift",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor"],
    anchorKeywords: ["misclassification", "payroll taxes", "employment taxes"],
    pattern: /\b(?:contractor|consultant)\s+(?:shall|agrees\s+to)\s+(?:indemnify|reimburse)[^.;\n]{0,85}\b(?:misclassification|payroll\s+taxes|employment\s+taxes|withholding\s+penalties)\b[^.;\n]{0,85}\.?/i,
    rationale: "Forces an individual contractor to reimburse corporate client penalties if a regulator decides the client misclassified them.",
    redlines: {
      collaborative: "Each party remains responsible for its own tax filings based on independent contractor classification established under law.",
      bilateral: "Contractor is responsible for income and self-employment taxes on fees received, while Client remains solely responsible for statutory employer penalties resulting from Client's own classification or control practices.",
      counsel: "Misclassification indemnity shifting statutory employer penalties onto Contractor is void and unenforceable."
    }
  }),
  defineRule({
    id: "IN-12",
    categoryId: "INDEMNITY",
    title: "Waiver of Comparative Fault & Contribution Rights",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["comparative fault", "right of contribution", "joint and several"],
    pattern: /\b(?:waives?\s+(?:any\s+)?(?:right\s+of\s+)?(?:contribution|comparative\s+fault)|joint\s+and\s+severally\s+indemnify)\b[^.;\n]{0,90}\.?/i,
    rationale: "Bars you from seeking fair apportionment when multiple parties contributed to a loss.",
    redlines: {
      collaborative: "Liability and indemnification among parties shall reflect each party's proportionate share of responsibility.",
      bilateral: "All indemnification and contribution claims are governed strictly by proportionate comparative fault; joint and several indemnity shifting is deleted.",
      counsel: "Waivers of comparative fault and contribution are void. Each party bears liability strictly in proportion to its adjudicated fault percentage."
    }
  }),
  defineRule({
    id: "IN-13",
    categoryId: "INDEMNITY",
    title: "Indemnity Triggered by Mere Allegations or Threats",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa", "custom-agreement"],
    anchorKeywords: ["threatened", "alleged", "merely alleged"],
    pattern: /\b(?:indemnify|hold\s+harmless)[^.;\n]{0,85}\b(?:threatened|merely\s+alleged|alleged\s+(?:or\s+actual\s+)?(?:claim|breach|infringement))\b[^.;\n]{0,85}\.?/i,
    rationale: "Triggers full indemnification payments based on unsubstantiated demands or frivolous threats.",
    redlines: {
      collaborative: "Indemnification applies to actual third-party legal proceedings resulting in verified loss or court-approved settlement.",
      bilateral: "Indemnification covers only formal third-party lawsuits or binding regulatory orders resulting in verified liability, excluding unsubstantiated threats or unproven allegations.",
      counsel: "Alleged and threatened claim triggers are deleted; liability attaches exclusively upon final adjudication of a valid covered third-party claim."
    }
  }),
  defineRule({
    id: "IN-14",
    categoryId: "INDEMNITY",
    title: "Environmental & Pre-Existing Condition Tenant Indemnity",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "hoa-covenants"],
    anchorKeywords: ["hazardous", "environmental", "mold", "pre-existing"],
    pattern: /\b(?:resident|tenant|owner)\s+(?:shall|agrees\s+to)\s+(?:indemnify|release|waive)[^.;\n]{0,85}\b(?:mold|asbestos|lead|hazardous\s+substance|environmental)\b[^.;\n]{0,85}\.?/i,
    rationale: "Makes a resident waive claims or indemnify the landlord for pre-existing environmental hazards like mold or lead.",
    redlines: {
      collaborative: "Resident is not responsible for pre-existing environmental or moisture conditions not caused by Resident's misconduct.",
      bilateral: "Resident bears zero indemnification or release responsibility for pre-existing hazardous materials, structural mold, or building code issues predating occupancy.",
      counsel: "Environmental hazard waivers and tenant indemnities are deleted; Landlord bears sole statutory remediation and liability duties."
    }
  }),
  defineRule({
    id: "IN-15",
    categoryId: "INDEMNITY",
    title: "Indemnification for Consequential & Special Damages",
    severity: "critical",
    riskPoints: 20,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa", "custom-agreement"],
    anchorKeywords: ["consequential", "lost profits", "punitive damages"],
    pattern: /\b(?:indemnify|reimburse)[^.;\n]{0,85}\b(?:consequential|indirect|lost\s+profits|punitive|special\s+damages)\b[^.;\n]{0,85}\.?/i,
    rationale: "Pulls astronomical lost-profit and indirect damages back into indemnity even if limited elsewhere in the contract.",
    redlines: {
      collaborative: "Indemnification recoveries are subject to the Agreement's exclusion of indirect and consequential damages.",
      bilateral: "Under no circumstances shall either party's indemnification obligations include indirect, incidental, consequential, special, or lost-profit damages.",
      counsel: "All consequential, punitive, and lost-profit components within indemnification are strictly excluded and subject to the bilateral limitation of liability."
    }
  }),
  defineRule({
    id: "IN-16",
    categoryId: "INDEMNITY",
    title: "Technical Forfeiture of Mutual Indemnity on Delayed Notice",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "nda-contractor"],
    anchorKeywords: ["strictly within", "forfeit", "voids all indemnification"],
    pattern: /\b(?:written\s+notice\s+strictly\s+within\s+\d+\s+(?:hours|days)|forfeit\s+(?:all\s+)?indemnification|voids?\s+all\s+indemnification)\b[^.;\n]{0,85}\.?/i,
    rationale: "Strips away protection over a 48-hour or 5-day notice technicality even when no prejudice occurred.",
    redlines: {
      collaborative: "Failure to give immediate notice relieves indemnification only to the extent the delay materially prejudiced the defense.",
      bilateral: "Notice of an indemnified claim shall be given promptly in writing; delayed notice excuses indemnification solely to the extent the indemnifying party proves material prejudice.",
      counsel: "Strict technical forfeiture of indemnity for notice timing is deleted; notice delay limits relief strictly to proven material prejudice."
    }
  }),

  // =========================================================================
  // 3. IP_GRAB (IP-01 .. IP-16)
  // =========================================================================
  defineRule({
    id: "IP-01",
    categoryId: "IP_GRAB",
    title: "Disguised Work-for-Hire Pre-Existing Toolkit Grab",
    severity: "critical",
    riskPoints: 24,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["pre-existing", "background tools", "work-made-for-hire", "work made for hire"],
    pattern: /\b(?:all\s+(?:inventions|background\s+tools|pre-existing\s+(?:code|libraries|toolkits?))|work[- ]made[- ]for[- ]hire)[^.;\n]{0,115}\b(?:client's\s+sole|sole\s+(?:and\s+exclusive\s+)?(?:work[- ]made[- ]for[- ]hire\s+)?property|irrevocably\s+assigns?)\b[^.;\n]{0,95}\.?/i,
    rationale: "Captures your pre-existing code libraries, reusable frameworks, and career toolkit simply because you used them while delivering services.",
    redlines: {
      collaborative: "Deliverables created exclusively for Client are owned by Client upon full payment, while Contractor retains ownership of all pre-existing tools and reusable libraries.",
      bilateral: "Work-made-for-hire applies strictly to custom Deliverables created exclusively for Client upon full payment. Contractor retains sole ownership of all Pre-Existing IP, background frameworks, and reusable libraries, granting Client a non-exclusive license to embed them within the Deliverables.",
      counsel: "All pre-existing code, libraries, developer tools, generalized know-how, and non-project inventions remain Contractor's exclusive IP. Client receives solely a paid-up, non-exclusive license to background components strictly as incorporated in paid Deliverables."
    }
  }),
  defineRule({
    id: "IP-02",
    categoryId: "IP_GRAB",
    title: "Irrevocable Moral Rights & Attribution Waiver",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["moral rights", "attribution rights", "rights of integrity"],
    pattern: /\b(?:irrevocably\s+waives?|waives?\s+all)\b[^.;\n]{0,65}\b(?:moral\s+rights|attribution\s+rights|rights\s+of\s+integrity)\b[^.;\n]{0,85}\.?/i,
    rationale: "Extinguishes credit, attribution, and integrity rights globally, even allowing distortion of your creative work.",
    redlines: {
      collaborative: "Contractor waives moral rights solely to the extent necessary for Client's ordinary commercial use of the final Deliverables, preserving portfolio attribution.",
      bilateral: "Any moral rights waiver applies solely to custom Deliverables as permitted by law and reserves Contractor's non-confidential portfolio attribution right.",
      counsel: "Blanket worldwide moral rights waiver is deleted. Any statutory waiver is limited strictly to paid custom Deliverables and preserves truthful authorship credit."
    }
  }),
  defineRule({
    id: "IP-03",
    categoryId: "IP_GRAB",
    title: "Off-Hours & Personal Side-Project IP Assignment",
    severity: "critical",
    riskPoints: 22,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["off-hours", "outside business hours", "conceived during the term"],
    pattern: /\b(?:all\s+(?:ideas|inventions|works|discoveries)\s+conceived\s+during\s+the\s+term|off-hours|outside\s+business\s+hours)\b[^.;\n]{0,95}\b(?:assigned|owned\s+by|property\s+of)\b[^.;\n]{0,75}\.?/i,
    rationale: "Claims ownership over personal projects built on your own time and equipment during the contract term.",
    redlines: {
      collaborative: "IP assignment applies solely to deliverables specified in a signed Statement of Work.",
      bilateral: "Assignment covers strictly Deliverables funded under an executed Statement of Work and excludes any works developed independently on Contractor's own time and resources.",
      counsel: "Assignment of off-hours, non-SOW, or unrelated inventions is void. Ownership transfers solely for bespoke SOW Deliverables after full payment."
    }
  }),
  defineRule({
    id: "IP-04",
    categoryId: "IP_GRAB",
    title: "Feedback & Suggestions Unencumbered Ownership Grab",
    severity: "medium",
    riskPoints: 10,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "nda-contractor"],
    anchorKeywords: ["feedback", "suggestions", "feature requests"],
    pattern: /\b(?:feedback|suggestions|enhancement\s+requests?)\b[^.;\n]{0,85}\b(?:sole\s+property|irrevocable,?\s+perpetual,?\s+royalty-free\s+(?:ownership|assignment))\b[^.;\n]{0,85}\.?/i,
    rationale: "Converts customer workflows and proprietary domain feedback into vendor-owned IP with zero attribution or protection.",
    redlines: {
      collaborative: "Vendor may use de-identified product feedback to improve the service without claiming ownership of Customer Confidential Information.",
      bilateral: "Customer grants Vendor a non-exclusive license to use voluntary product feedback solely to improve the platform, provided it excludes Customer Confidential Information and Customer IP.",
      counsel: "Transfer of ownership over Feedback is deleted; Vendor receives only a revocable, non-exclusive license to anonymized usability suggestions without attributing Customer."
    }
  }),
  defineRule({
    id: "IP-05",
    categoryId: "IP_GRAB",
    title: "Customer Content AI/ML Model Training Rights",
    severity: "critical",
    riskPoints: 23,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["train", "machine learning", "ai models", "foundation models"],
    pattern: /\b(?:train|fine-tune|develop|improve)\b[^.;\n]{0,70}\b(?:machine\s+learning|artificial\s+intelligence|ai\s+models?|algorithms?)\b[^.;\n]{0,70}\b(?:customer\s+(?:data|content|inputs)|uploaded\s+files)\b[^.;\n]{0,80}\.?/i,
    rationale: "Allows a SaaS vendor to ingest your confidential contracts, data, or trade secrets into shared AI model training weights.",
    redlines: {
      collaborative: "Vendor will not use Customer Data or uploaded files to train generalized or third-party AI models without explicit opt-in.",
      bilateral: "Vendor is strictly prohibited from using Customer Content, prompts, outputs, or confidential files to train, fine-tune, or evaluate any shared or third-party machine learning models.",
      counsel: "AI training rights over Customer Data are strictly forbidden. Zero Customer Content may enter training pipelines, telemetry corpora, or model weights."
    }
  }),
  defineRule({
    id: "IP-06",
    categoryId: "IP_GRAB",
    title: "Unlimited Power of Attorney for IP Filings",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor"],
    anchorKeywords: ["power of attorney", "attorney-in-fact", "execute patent"],
    pattern: /\b(?:irrevocable\s+)?(?:power\s+of\s+attorney|attorney-in-fact)\b[^.;\n]{0,95}\b(?:patent|copyright|assignment|execute\s+documents?)\b[^.;\n]{0,85}\.?/i,
    rationale: "Grants the client blanket authority to sign legal instruments in your name without scope limits.",
    redlines: {
      collaborative: "Contractor will reasonably cooperate at Client's expense to execute assignments strictly for paid SOW Deliverables.",
      bilateral: "Power of attorney is replaced by a commitment to execute reasonable assignment documents at Client's sole expense solely for paid custom Deliverables after 15 days' written request.",
      counsel: "Irrevocable power of attorney is deleted in its entirety. Contractor executes only specific reviewed assignments for compensated Deliverables at Client's expense."
    }
  }),
  defineRule({
    id: "IP-07",
    categoryId: "IP_GRAB",
    title: "Unaided-Memory Residuals Exploitation Clause",
    severity: "high",
    riskPoints: 17,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa"],
    anchorKeywords: ["residuals", "unaided memory", "retained in memory"],
    pattern: /\b(?:residuals|unaided\s+memory|retained\s+in\s+(?:the\s+)?memory)\b[^.;\n]{0,95}\b(?:free\s+to\s+use|exploit|any\s+purpose|without\s+restriction)\b[^.;\n]{0,85}\.?/i,
    rationale: "Allows the recipient to memorize your trade secrets and commercialize competing products under a 'residuals' loophole.",
    redlines: {
      collaborative: "Confidential Information remains protected even if remembered informally; residual knowledge does not license proprietary trade secrets.",
      bilateral: "Residuals clauses are deleted; neither party may use or commercialize the other's Confidential Information retained in unaided memory.",
      counsel: "Any residual-knowledge exception to confidentiality is deleted in full and confers zero license under trade secret, copyright, or patent law."
    }
  }),
  defineRule({
    id: "IP-08",
    categoryId: "IP_GRAB",
    title: "Perpetual Unconsented Logo & Publicity License",
    severity: "low",
    riskPoints: 7,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "nda-contractor"],
    anchorKeywords: ["trademarks", "logo", "marketing materials", "case study"],
    pattern: /\b(?:display|use)\s+(?:customer|contractor)'?s?\s+(?:name,?\s+)?(?:trademarks?|logos?)\b[^.;\n]{0,85}\b(?:marketing|publicity|case\s+studies?|perpetual)\b[^.;\n]{0,80}\.?/i,
    rationale: "Permits permanent marketing use of your brand name and logos even after termination or dispute.",
    redlines: {
      collaborative: "Either party may list the other as a customer or partner only with prior written email approval, revocable at any time.",
      bilateral: "Publicity or trademark use requires prior written consent per instance and terminates automatically upon written revocation.",
      counsel: "Unconsented logo and publicity licenses are deleted; zero reference to the counterparty's name or marks is permitted without written sign-off."
    }
  }),
  defineRule({
    id: "IP-09",
    categoryId: "IP_GRAB",
    title: "IP Ownership Transfer Prior to Full Payment",
    severity: "high",
    riskPoints: 18,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["upon creation", "irrespective of payment", "before payment"],
    pattern: /\b(?:assigns?|transfers?\s+(?:all\s+)?ownership|vests?\s+(?:immediately\s+)?upon\s+creation)[^.;\n]{0,85}\b(?:irrespective\s+of\s+payment|prior\s+to\s+payment|whether\s+or\s+not\s+paid)\b[^.;\n]{0,80}\.?/i,
    rationale: "Surrenders full intellectual property title before invoices are paid, stripping leverage if the client stiffs you.",
    redlines: {
      collaborative: "Ownership of custom Deliverables transfers to Client upon receipt of full payment for the applicable milestone.",
      bilateral: "All assignment and license rights in Deliverables are strictly conditioned upon Client's full and final payment of all undisputed invoices due.",
      counsel: "IP title vests in Contractor until cleared payment in full is received; zero license or assignment takes effect prior to payment."
    }
  }),
  defineRule({
    id: "IP-10",
    categoryId: "IP_GRAB",
    title: "Blanket Ban on Standard Open-Source Libraries",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa"],
    anchorKeywords: ["open-source", "open source", "third-party code"],
    pattern: /\b(?:warrants?\s+that\s+zero\s+open[- ]source|no\s+open[- ]source|prohibited\s+from\s+including\s+any\s+third-party\s+(?:library|code))\b[^.;\n]{0,95}\.?/i,
    rationale: "Creates an impossible technical warranty banning standard permissive open-source packages (MIT/Apache) used in modern software.",
    redlines: {
      collaborative: "Contractor may incorporate standard permissive open-source components (MIT, BSD, Apache 2.0) documented upon delivery.",
      bilateral: "Permissive open-source software (MIT, BSD, Apache 2.0) is permitted with standard attribution schedules; only copyleft licenses requiring proprietary disclosure require prior written approval.",
      counsel: "Blanket prohibitions on permissive open-source dependencies are replaced with mutual approval solely for strong-copyleft licenses."
    }
  }),
  defineRule({
    id: "IP-11",
    categoryId: "IP_GRAB",
    title: "Exclusive Claim Over Generalized Industry Know-How",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor"],
    anchorKeywords: ["know-how", "generalized", "methodologies", "techniques"],
    pattern: /\b(?:generalized\s+know-how|techniques|methodologies|skills)\b[^.;\n]{0,85}\b(?:exclusive\s+property|prohibited\s+from\s+reusing|owned\s+by\s+client)\b[^.;\n]{0,80}\.?/i,
    rationale: "Prevents a specialist from practicing standard architectural patterns or professional craft in future engagements.",
    redlines: {
      collaborative: "Contractor retains full freedom to reuse general industry techniques, skills, and non-confidential architectural knowledge.",
      bilateral: "Nothing herein restricts Contractor from using general skills, architectural patterns, methodologies, or non-confidential industry know-how in future engagements.",
      counsel: "Restrictions on generalized professional know-how and methodology reuse are deleted as an unenforceable restraint of trade."
    }
  }),
  defineRule({
    id: "IP-12",
    categoryId: "IP_GRAB",
    title: "Vendor Ownership of Customer Outputs & Reports",
    severity: "high",
    riskPoints: 17,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["outputs", "generated reports", "platform analytics"],
    pattern: /\b(?:vendor|provider)\s+(?:shall\s+)?own(?:s|ership)\s+(?:all\s+)?(?:outputs|generated\s+reports|exports|derivative\s+analyses)\b[^.;\n]{0,85}\.?/i,
    rationale: "Lets the software vendor claim ownership over reports and documents you generate inside their tool.",
    redlines: {
      collaborative: "Customer owns all data inputs and all generated outputs, reports, and exports produced by Customer.",
      bilateral: "Customer retains 100% ownership and exclusive rights over all Customer Inputs, custom configurations, and generated Outputs.",
      counsel: "Vendor claim of title to Customer Outputs or derivative analyses is deleted; Customer owns all Outputs exclusively."
    }
  }),
  defineRule({
    id: "IP-13",
    categoryId: "IP_GRAB",
    title: "Waiver of Statutory Invention Exclusion Notices",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["labor code", "statutory invention", "waives statutory exclusion"],
    pattern: /\b(?:waives?\s+(?:any\s+)?(?:statutory\s+)?(?:invention\s+exclusion|labor\s+code\s+2870)|regardless\s+of\s+statutory\s+exemption)\b[^.;\n]{0,85}\.?/i,
    rationale: "Attempts to override statutory worker/contractor protections shielding personal off-hours inventions.",
    redlines: {
      collaborative: "Nothing in this Agreement assigns inventions exempt under applicable state statutory invention laws.",
      bilateral: "This Agreement excludes all inventions qualifying under statutory employee/contractor invention protections (such as CA Labor Code § 2870 and equivalent laws).",
      counsel: "Purported waivers of statutory invention exclusions are struck and declared void."
    }
  }),
  defineRule({
    id: "IP-14",
    categoryId: "IP_GRAB",
    title: "Unconditional Source Repository Surrender on Minor Dispute",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["source code", "repositories", "surrender"],
    pattern: /\b(?:surrender|deliver\s+all\s+source\s+code|turn\s+over\s+all\s+repositories)\b[^.;\n]{0,80}\b(?:any\s+dispute|immediately\s+upon\s+demand|termination\s+for\s+any\s+reason)\b[^.;\n]{0,80}\.?/i,
    rationale: "Forces handover of private repositories and uncompensated work-in-progress during an unresolved payment dispute.",
    redlines: {
      collaborative: "Paid Deliverables will be exported to Client cleanly at contract conclusion once undisputed invoices are settled.",
      bilateral: "Delivery of custom Deliverable source code occurs strictly for paid milestones and excludes proprietary Contractor repositories and unpaid work-in-progress.",
      counsel: "Unconditional repository surrender on dispute is deleted; unreleased work-in-progress remains Contractor's exclusive property absent full payment."
    }
  }),
  defineRule({
    id: "IP-15",
    categoryId: "IP_GRAB",
    title: "Joint IP With Unrestricted Third-Party Sublicensing",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa"],
    anchorKeywords: ["jointly owned", "joint ip", "sublicense without accounting"],
    pattern: /\b(?:jointly\s+owned|joint\s+ip)\b[^.;\n]{0,80}\b(?:without\s+accounting|unrestricted\s+sublicense|sublicense\s+to\s+competitors)\b[^.;\n]{0,80}\.?/i,
    rationale: "Allows the counterparty to freely license or sell shared innovations to your direct competitors without accounting or consent.",
    redlines: {
      collaborative: "Each party owns its independently developed IP cleanly; any jointly created asset requires mutual written approval before third-party licensing.",
      bilateral: "Joint IP creation is avoided in favor of clear sole ownership; any expressly designated Joint IP may not be licensed to third parties without mutual written consent.",
      counsel: "Unrestricted sublicensing of Joint IP without accounting is deleted."
    }
  }),
  defineRule({
    id: "IP-16",
    categoryId: "IP_GRAB",
    title: "Unrestricted Monetization of Aggregated Account Telemetry",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "hoa-covenants"],
    anchorKeywords: ["aggregated data", "telemetry", "sell", "monetize", "benchmark"],
    pattern: /\b(?:aggregated|de-identified|usage\s+telemetry)\b[^.;\n]{0,85}\b(?:sell|monetize|commercialize|perpetual\s+ownership|distribute\s+to\s+third\s+parties)\b[^.;\n]{0,85}\.?/i,
    rationale: "Permits commercial resale of behavioral telemetry extracted from your confidential usage patterns.",
    redlines: {
      collaborative: "Vendor may collect anonymized operational metrics solely for system reliability and security, never for external sale.",
      bilateral: "Operational telemetry may be used solely to maintain security and performance for Customer and shall never be sold, brokered, or disclosed in any manner identifying Customer or its industry niche.",
      counsel: "Commercial monetization, sale, or external distribution of Customer usage telemetry is strictly prohibited."
    }
  }),

  // =========================================================================
  // 4. JUNK_FEES (JF-01 .. JF-16)
  // =========================================================================
  defineRule({
    id: "JF-01",
    categoryId: "JUNK_FEES",
    title: "Mandatory Valet Trash Junk Surcharge",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 540,
    docCategories: ["residential-lease", "hoa-covenants"],
    anchorKeywords: ["valet trash", "trash service fee", "doorstep waste"],
    pattern: /(?:(?:\b(?:resident|tenant|landlord|owner)\b[^.;\n]{0,45})?(?:\bmandatory\s+)?(?:\$\s?\d+(?:\.\d{1,2})?\s*\/\s*mo(?:nth)?[^.;\n]{0,45})?)?\b(?:valet\s+trash|doorstep\s+waste)\b[^.;\n]{0,95}\.?/i,
    rationale: "Forces tenants to pay an unbundled monthly concierge trash surcharge even when municipal or dumpster disposal is already included.",
    redlines: {
      collaborative: "Valet trash service shall be offered strictly as an optional add-on that Resident may opt into or cancel at any time.",
      bilateral: "Mandatory valet trash surcharges are excised; Resident may use standard building refuse facilities at zero additional monthly charge.",
      counsel: "Mandatory valet trash fee ($45/mo or similar) is deleted in full; Resident bears zero liability for unrequested doorstep waste bundles."
    }
  }),
  defineRule({
    id: "JF-02",
    categoryId: "JUNK_FEES",
    title: "Mandatory Smart-Lock / Package Locker Tech Bundle",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 780,
    docCategories: ["residential-lease", "hoa-covenants"],
    anchorKeywords: ["smart-lock", "smart lock", "package locker", "technology bundle"],
    pattern: /(?:(?:\b(?:resident|tenant|landlord|owner)\b[^.;\n]{0,45})?(?:\bmandatory\s+)?(?:\$\s?\d+(?:\.\d{1,2})?\s*\/\s*mo(?:nth)?[^.;\n]{0,45})?)?\b(?:smart[- ]lock|package\s+locker|technology\s+bundle|resident\s+tech\s+package)\b[^.;\n]{0,95}\.?/i,
    rationale: "Disguises landlord building hardware costs (keyless locks and parcel lockers) as an involuntary recurring monthly tenant subscription.",
    redlines: {
      collaborative: "Smart-lock access and package locker access are standard building infrastructure included within Base Rent without separate surcharge.",
      bilateral: "The mandatory Smart-Lock & Package Locker Technology Bundle fee is excised; electronic entry and mailroom access are included at $0/mo within Base Rent.",
      counsel: "Unbundled building-access and smart-lock technology surcharges are deleted; Landlord may not condition habitability or entry on recurring tech fees."
    }
  }),
  defineRule({
    id: "JF-03",
    categoryId: "JUNK_FEES",
    title: "Monthly Administrative & Ledger Billing Fee",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 216,
    docCategories: ["residential-lease", "saas-msa", "hoa-covenants", "custom-agreement"],
    anchorKeywords: ["administrative billing fee", "ledger processing", "monthly admin", "billing fee"],
    pattern: /(?:(?:\b(?:resident|tenant|landlord|vendor|association)\b[^.;\n]{0,45})?(?:\$\s?\d+(?:\.\d{1,2})?\s*\/\s*mo(?:nth)?[^.;\n]{0,45})?)?\b(?:monthly\s+admin(?:istrative)?(?:\s+billing)?\s+fee|administrative\s+billing\s+fee|ledger\s+processing)\b[^.;\n]{0,90}\.?/i,
    rationale: "Charges the customer an extra recurring fee merely for the privilege of receiving an invoice or having their payment recorded.",
    redlines: {
      collaborative: "Routine invoicing and ledger administration are normal operating overhead and will not be billed separately.",
      bilateral: "All monthly administrative, invoicing, and ledger-processing fees are excised in full.",
      counsel: "Administrative billing junk fees are deleted; zero surcharge may be levied for issuing invoices or maintaining payment ledgers."
    }
  }),
  defineRule({
    id: "JF-04",
    categoryId: "JUNK_FEES",
    title: "Non-Optional Pest Control & Amenity Surcharge",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 324,
    docCategories: ["residential-lease", "hoa-covenants"],
    anchorKeywords: ["pest control", "amenity surcharge", "pest/amenity"],
    pattern: /\b(?:a\s+)?(?:non-optional|mandatory)[^.;\n]{0,45}(?:\$\s?\d+(?:\.\d{1,2})?\s*\/\s*mo(?:nth)?[^.;\n]{0,35})?(?:pest\s+control|amenity\s+surcharge|pest\s+and\s+amenity)[^.;\n]{0,90}\.?/i,
    rationale: "Shifts statutory landlord habitability duties (pest control) and fixed shared amenities into a recurring hidden rent hike.",
    redlines: {
      collaborative: "Routine pest prevention and shared building amenities are included in Base Rent without an extra monthly surcharge.",
      bilateral: "Non-optional pest control and amenity surcharges are excised; routine pest control remains Landlord's maintenance obligation included in Base Rent.",
      counsel: "Mandatory pest control and amenity recovery fees are deleted as impermissible unbundling of statutory habitability duties."
    }
  }),
  defineRule({
    id: "JF-05",
    categoryId: "JUNK_FEES",
    title: "Mandatory Bulk Cable / Fiber Internet Bundle Fee",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 1068,
    docCategories: ["hoa-covenants", "residential-lease"],
    anchorKeywords: ["bundled cable", "bulk fiber", "cable/fiber", "bulk internet"],
    pattern: /(?:(?:\b(?:every\s+lot\s+owner|lot\s+owner|resident|owner)\b[^.;\n]{0,45})?(?:\bmandatory\s+)?(?:\$\s?\d+(?:\.\d{1,2})?\s*\/\s*mo(?:nth)?[^.;\n]{0,45})?)?\b(?:bundled\s+cable|bulk\s+(?:fiber|internet|cable)|cable\s+television\s+and\s+bulk\s+fiber)\b[^.;\n]{0,95}\.?/i,
    rationale: "Forces residents or homeowners to subsidize a captive telecom bulk contract even if unused or disconnected.",
    redlines: {
      collaborative: "Telecommunications, cable, and fiber internet services shall be strictly opt-in for owners or residents who choose to subscribe.",
      bilateral: "Mandatory bundled cable and bulk fiber fees are excised; owners and tenants retain unrestricted freedom to select or decline broadband providers without fee.",
      counsel: "Forced bulk telecom assessments are deleted; no resident or lot owner shall be billed for unsubscribed telecommunications services."
    }
  }),
  defineRule({
    id: "JF-06",
    categoryId: "JUNK_FEES",
    title: "Online Portal & ACH Payment Convenience Fee",
    severity: "medium",
    riskPoints: 10,
    annualFeeEstimate: 180,
    docCategories: ["residential-lease", "hoa-covenants", "saas-msa"],
    anchorKeywords: ["convenience fee", "portal fee", "ach fee", "payment processing fee"],
    pattern: /\b(?:online\s+portal\s+fee|payment\s+convenience\s+fee|ach\s+(?:convenience\s+)?fee|electronic\s+payment\s+surcharge)\b[^.;\n]{0,90}\.?/i,
    rationale: "Penalizes tenants or customers for paying electronically with no free payment channel.",
    redlines: {
      collaborative: "At least one electronic ACH/portal payment method shall be available at $0 convenience fee.",
      bilateral: "Portal and ACH payment convenience fees are deleted; electronic bank transfers and checks incur zero processing fees.",
      counsel: "All electronic payment portal and ACH surcharges are struck; at least one fee-free electronic and physical payment channel must be maintained."
    }
  }),
  defineRule({
    id: "JF-07",
    categoryId: "JUNK_FEES",
    title: "Opaque RUBS Ratio Utility Allocation Markup",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 480,
    docCategories: ["residential-lease", "hoa-covenants"],
    anchorKeywords: ["rubs", "ratio utility", "sub-meter", "allocated by landlord"],
    pattern: /\b(?:rubs|ratio\s+utility\s+billing|allocated\s+at\s+landlord'?s?\s+discretion|common\s+utility\s+split\s+without\s+sub-?meter)\b[^.;\n]{0,90}\.?/i,
    rationale: "Allows the landlord to bill arbitrary estimated common utility percentages without transparent sub-meters or invoice verification.",
    redlines: {
      collaborative: "Utility allocations shall be backed by actual utility bills made available for inspection upon request, with zero administrative markup.",
      bilateral: "RUBS utility estimates are replaced by direct sub-metered billing or transparent pro-rata actual utility cost pass-through with invoice audit rights and zero markup.",
      counsel: "Opaque ratio utility billing (RUBS) is deleted; Resident pays solely for individually sub-metered consumption at direct utility tariff rates."
    }
  }),
  defineRule({
    id: "JF-08",
    categoryId: "JUNK_FEES",
    title: "Non-Refundable Move-In / Redecorating / Lease Prep Fee",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 350,
    docCategories: ["residential-lease"],
    anchorKeywords: ["non-refundable move-in", "redecorating fee", "lease preparation fee"],
    pattern: /\b(?:non-refundable\s+(?:move-in|redecorating|cleaning|lease\s+preparation|admin)\s+fee)\b[^.;\n]{0,90}\.?/i,
    rationale: "Extracts an upfront non-refundable junk charge that duplicates the security deposit.",
    redlines: {
      collaborative: "All refundable move-in deposits are governed by standard itemized wear-and-tear accounting upon move-out.",
      bilateral: "Non-refundable lease preparation, redecorating, and move-in fees are excised; only the itemized refundable security deposit applies.",
      counsel: "Non-refundable turnover and lease-preparation fees are deleted as disguised non-refundable security charges."
    }
  }),
  defineRule({
    id: "JF-09",
    categoryId: "JUNK_FEES",
    title: "Compounding Daily Late Fee Escalator",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 600,
    docCategories: ["residential-lease", "hoa-covenants", "saas-msa"],
    anchorKeywords: ["per day late", "daily late fee", "compounding late"],
    pattern: /(?:\b(?:late\s+fee\s+of\s+\$\s?\d+[^.;\n]{0,45}per\s+day|compounding\s+late\s+fee)|\$\s?\d+\s+per\s+day\s+(?:late|until\s+paid))[^.;\n]{0,80}\.?/i,
    rationale: "Multiplies a minor payment delay into hundreds of dollars in cascading daily penalties.",
    redlines: {
      collaborative: "A modest one-time late fee capped at 5% of unpaid base charges applies only after a 5-day grace period.",
      bilateral: "Compounding daily late fees are deleted; late payments following a 5-business-day grace period incur at most a single flat cap of 5% or $50, whichever is less.",
      counsel: "Daily compounding late penalties are struck as unenforceable liquidated penalties; late charges are strictly capped at statutory minimums after a 5-day grace period."
    }
  }),
  defineRule({
    id: "JF-10",
    categoryId: "JUNK_FEES",
    title: "Forced Master Renter Insurance Admin Markup",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 240,
    docCategories: ["residential-lease"],
    anchorKeywords: ["master policy", "insurance admin", "forced-place"],
    pattern: /\b(?:forced[- ]place|master\s+liability\s+policy|renter'?s?\s+insurance\s+program)[^.;\n]{0,80}\b(?:\$\s?\d+|administrative\s+fee|non-compliance\s+fee)\b[^.;\n]{0,80}\.?/i,
    rationale: "Auto-enrolls tenants into an overpriced master insurance policy with hidden landlord kickbacks or admin fees.",
    redlines: {
      collaborative: "Resident may maintain standard personal renter's insurance from any licensed carrier without administrative fee.",
      bilateral: "Resident satisfies insurance requirements by providing proof of coverage from any licensed carrier of Resident's choice with zero program or admin surcharge.",
      counsel: "Forced-place insurance enrollment and master-policy administrative markups are deleted."
    }
  }),
  defineRule({
    id: "JF-11",
    categoryId: "JUNK_FEES",
    title: "Uncapped Regulatory Cost-Recovery Surcharge",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 420,
    docCategories: ["saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["cost-recovery", "regulatory surcharge", "compliance surcharge"],
    pattern: /\b(?:regulatory\s+(?:cost[- ]recovery|compliance)\s+surcharge|pass\s+through\s+any\s+regulatory\s+costs?)\b[^.;\n]{0,85}\.?/i,
    rationale: "Allows the vendor to invent arbitrary future 'regulatory recovery' line items outside agreed pricing.",
    redlines: {
      collaborative: "Agreed pricing includes all vendor compliance and regulatory overhead except standard statutory sales taxes.",
      bilateral: "Only direct, itemized transaction taxes imposed by law on Customer purchases may be passed through; general compliance or cost-recovery surcharges are excised.",
      counsel: "All discretionary regulatory and cost-recovery surcharges are deleted; Customer owes exclusively stated contract fees plus statutory sales/use taxes."
    }
  }),
  defineRule({
    id: "JF-12",
    categoryId: "JUNK_FEES",
    title: "Double Early Lease-Break & Re-Letting Fee",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 1200,
    docCategories: ["residential-lease"],
    anchorKeywords: ["re-letting fee", "reletting fee", "early termination fee"],
    pattern: /\b(?:re-?letting\s+fee|early\s+termination\s+fee)\b[^.;\n]{0,75}\b(?:in\s+addition\s+to\s+all\s+remaining\s+rent|plus\s+future\s+rent)\b[^.;\n]{0,80}\.?/i,
    rationale: "Double-dips by charging both a multi-month re-letting fee AND full remaining rent without mitigation credit.",
    redlines: {
      collaborative: "Early termination settles via a single clear buyout capped at one month's base rent or actual re-rental vacancy cost, whichever is less.",
      bilateral: "Landlord bears an affirmative duty to mitigate damages by re-renting promptly; no re-letting surcharge may stack on top of remaining rent obligations.",
      counsel: "Stacked re-letting penalties plus accelerated rent are void; total early-exit liability may not exceed verified unmitigated actual loss capped at one month's rent."
    }
  }),
  defineRule({
    id: "JF-13",
    categoryId: "JUNK_FEES",
    title: "Unbundled Mandatory Parking / Common Facility Fee",
    severity: "medium",
    riskPoints: 10,
    annualFeeEstimate: 600,
    docCategories: ["residential-lease", "hoa-covenants"],
    anchorKeywords: ["mandatory parking", "common facility fee", "amenity access fee"],
    pattern: /\b(?:mandatory\s+(?:parking|garage|common\s+facility|clubhouse)\s+fee)\b[^.;\n]{0,85}\b(?:regardless\s+of\s+vehicle|even\s+if\s+unused)\b[^.;\n]{0,80}\.?/i,
    rationale: "Charges residents for parking or facility passes even when they own no car or opt out.",
    redlines: {
      collaborative: "Parking and optional facility passes apply solely if voluntarily requested in writing.",
      bilateral: "Mandatory unused parking or facility fees are excised; parking charges apply strictly to reserved spaces elected by Resident.",
      counsel: "Compulsory unbundled parking and facility fees are deleted in full."
    }
  }),
  defineRule({
    id: "JF-14",
    categoryId: "JUNK_FEES",
    title: "Excessive Lockout, Key Replacement & Inspection Fee",
    severity: "medium",
    riskPoints: 9,
    annualFeeEstimate: 150,
    docCategories: ["residential-lease", "hoa-covenants"],
    anchorKeywords: ["lockout fee", "key replacement", "inspection fee"],
    pattern: /\b(?:lockout\s+fee|key\s+replacement\s+fee|periodic\s+inspection\s+fee)\b[^.;\n]{0,65}\b\$\s?(?:[1-9]\d{2,}|[7-9]\d)\b[^.;\n]{0,75}\.?/i,
    rationale: "Imposes inflated $75-$300 penalties for simple fob duplicates or routine landlord property inspections.",
    redlines: {
      collaborative: "Key or fob replacement is billed strictly at documented vendor hardware cost, with zero fee for routine inspections.",
      bilateral: "Inspection fees are deleted; key or fob replacement charges are limited to verified actual vendor replacement cost.",
      counsel: "Arbitrary inspection and punitive lockout charges are deleted; only verified actual third-party locksmith or hardware cost applies."
    }
  }),
  defineRule({
    id: "JF-15",
    categoryId: "JUNK_FEES",
    title: "Non-Refundable SaaS Maintenance & Paper Fee",
    severity: "low",
    riskPoints: 7,
    annualFeeEstimate: 180,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["paper invoice fee", "account maintenance fee", "platform support surcharge"],
    pattern: /\b(?:paper\s+(?:statement|invoice)\s+fee|account\s+maintenance\s+fee|platform\s+support\s+surcharge)\b[^.;\n]{0,85}\.?/i,
    rationale: "Adds silent recurring surcharges for basic customer support or billing statements.",
    redlines: {
      collaborative: "Standard billing and account maintenance are included in the subscription fee at zero additional cost.",
      bilateral: "Account maintenance, paper statement, and baseline support surcharges are excised; all listed services are included in the base fee.",
      counsel: "Hidden maintenance and statement surcharges are deleted in full."
    }
  }),
  defineRule({
    id: "JF-16",
    categoryId: "JUNK_FEES",
    title: "Credit Card Minimum & Surcharge Above Network Cost",
    severity: "low",
    riskPoints: 6,
    annualFeeEstimate: 120,
    docCategories: ["saas-msa", "custom-agreement", "residential-lease"],
    anchorKeywords: ["credit card surcharge", "4% processing", "5% card fee"],
    pattern: /\b(?:credit\s+card\s+(?:surcharge|processing\s+fee)\s+of\s+(?:[4-9]|\d{2})%|4%\s+processing|5%\s+card\s+fee)\b[^.;\n]{0,75}\.?/i,
    rationale: "Marks up card processing above actual interchange rates as an extra revenue stream.",
    redlines: {
      collaborative: "ACH payments incur zero fee, and any card surcharge shall never exceed actual verified merchant processing cost.",
      bilateral: "Excessive card surcharges are deleted; ACH/wire incurs zero fee and any card fee cannot exceed actual merchant cost or statutory cap.",
      counsel: "Inflated card surcharges are deleted and replaced with fee-free ACH/electronic settlement."
    }
  }),

  // =========================================================================
  // 5. LIABILITY_CAP (LC-01 .. LC-16)
  // =========================================================================
  defineRule({
    id: "LC-01",
    categoryId: "LIABILITY_CAP",
    title: "Asymmetric Micro-Dollar Liability Cap ($100 / $500)",
    severity: "critical",
    riskPoints: 24,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "nda-contractor", "custom-agreement"],
    anchorKeywords: ["not exceed $", "exceed $100", "capped at $", "completely uncapped"],
    pattern: /\b(?:vendor|provider|company)?'?s?\s*(?:maximum\s+aggregate\s+liability|aggregate\s+liability|liability[^.;\n]{0,45}shall\s+not\s+exceed)\b[^.;\n]{0,60}(?:\$\s?(?:1|5|10|50|100|250|500)\b|\bone\s+hundred\s+dollars\b)[^.;\n]{0,115}\.?/i,
    rationale: "Caps vendor liability at an illusory pocket-change sum like $100 even on high-value enterprise contracts, while customer exposure remains unbounded.",
    redlines: {
      collaborative: "Each party's aggregate liability shall be capped symmetrically at total fees paid or payable under this Agreement over the preceding 12 months.",
      bilateral: "Liability caps are strictly mutual and equal to the greater of 12 months' fees paid/payable or $50,000, with symmetric carve-outs for gross negligence, willful misconduct, and confidentiality/data security breaches.",
      counsel: "Nominal micro-caps ($100) are rejected. Both parties' aggregate liability is set symmetrically at 2x annual contract value (or $100,000 minimum), with super-caps for data breach and IP infringement."
    }
  }),
  defineRule({
    id: "LC-02",
    categoryId: "LIABILITY_CAP",
    title: "One-Month Fee Liability Ceiling",
    severity: "high",
    riskPoints: 18,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["preceding 1 month", "last 30 days", "one month's fees"],
    pattern: /\b(?:aggregate\s+liability[^.;\n]{0,65}(?:one|1)\s+month'?s?\s+fees|fees\s+paid\s+in\s+the\s+(?:preceding|last)\s+(?:30\s+days|1\s+month))\b[^.;\n]{0,80}\.?/i,
    rationale: "Limits total recovery to a single month's subscription fee, rendering contractual warranties nearly worthless.",
    redlines: {
      collaborative: "Mutual liability cap shall equal 12 months of fees paid or payable under the Agreement.",
      bilateral: "Both parties' liability cap is adjusted to a balanced 12 months' fees trailing the event giving rise to the claim.",
      counsel: "One-month liability ceiling is struck and replaced with a mutual 12-to-24 month fee cap plus enhanced coverage for data breaches."
    }
  }),
  defineRule({
    id: "LC-03",
    categoryId: "LIABILITY_CAP",
    title: "One-Sided Cap Leaving Signer Obligations Uncapped",
    severity: "critical",
    riskPoints: 22,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "nda-contractor", "custom-agreement"],
    anchorKeywords: ["customer's", "obligations remain", "completely uncapped", "unlimited liability"],
    pattern: /\b(?:while|whereas)\s+(?:customer|client|contractor|resident)'?s?\s+(?:indemnification|payment|confidentiality)?\s*obligations?\s+remain\s+(?:completely\s+)?uncapped\b[^.;\n]{0,85}\.?/i,
    rationale: "Applies strict dollar caps only to the drafter while leaving the signer exposed to unlimited liability.",
    redlines: {
      collaborative: "All limitations of liability and damage exclusions shall apply symmetrically to both parties.",
      bilateral: "Limitations of liability apply equally and bilaterally to both Vendor and Customer, excluding only undisputed fee payment obligations for delivered services.",
      counsel: "Asymmetric liability exemptions are deleted; every cap and consequential damages waiver applies identically to both parties."
    }
  }),
  defineRule({
    id: "LC-04",
    categoryId: "LIABILITY_CAP",
    title: "Zero Liability / Total Disclaimer of Direct Damages",
    severity: "critical",
    riskPoints: 23,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "hoa-covenants"],
    anchorKeywords: ["zero liability", "no liability whatsoever", "under no circumstances liable"],
    pattern: /\b(?:shall\s+have\s+zero\s+liability|no\s+liability\s+whatsoever|under\s+no\s+circumstances\s+be\s+liable\s+for\s+any\s+(?:direct|actual)\s+damages)\b[^.;\n]{0,90}\.?/i,
    rationale: "Eliminates all legal accountability even for direct financial losses caused by the drafter's breach.",
    redlines: {
      collaborative: "Each party remains accountable for direct damages caused by its material breach, subject to a reasonable mutual liability cap.",
      bilateral: "Total disclaimers of direct damages are deleted; each party is liable for direct damages arising from breach up to a mutual 12-month fee cap.",
      counsel: "Blanket zero-liability immunity is void as unconscionable and replaced with full accountability for direct breach damages."
    }
  }),
  defineRule({
    id: "LC-05",
    categoryId: "LIABILITY_CAP",
    title: "Data Breach & Security Failure Excluded From Super-Cap",
    severity: "high",
    riskPoints: 18,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["data breach", "security incident", "unauthorized access"],
    pattern: /\b(?:vendor\s+disclaims\s+all\s+liability\s+for|not\s+liable\s+for\s+any)\s+(?:data\s+breach|security\s+incident|unauthorized\s+access)\b[^.;\n]{0,85}\.?/i,
    rationale: "Shields the SaaS vendor from responsibility when their negligence exposes your private customer records.",
    redlines: {
      collaborative: "Vendor maintains commercially reasonable security controls and carries heightened responsibility for breaches caused by Vendor security failures.",
      bilateral: "Data breaches and security incidents resulting from Vendor's failure to maintain industry-standard safeguards are subject to an enhanced mutual super-cap of 2x annual fees.",
      counsel: "Disclaimers for Vendor data breaches are deleted; Vendor bears full statutory notification, remediation, and super-cap damages up to 3x contract value."
    }
  }),
  defineRule({
    id: "LC-06",
    categoryId: "LIABILITY_CAP",
    title: "Consequential Waiver Shielding Willful Misconduct",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "nda-contractor", "custom-agreement"],
    anchorKeywords: ["even if intentional", "regardless of gross negligence", "willful misconduct"],
    pattern: /\b(?:exclude\s+all\s+(?:indirect|consequential)\s+damages)[^.;\n]{0,65}\b(?:even\s+if\s+intentional|including\s+(?:gross\s+negligence|willful\s+misconduct))\b[^.;\n]{0,75}\.?/i,
    rationale: "Attempts to insulate deliberate sabotage or gross recklessness under a standard consequential-damages waiver.",
    redlines: {
      collaborative: "Consequential damage waivers exclude intentional misconduct, fraud, and gross negligence.",
      bilateral: "Neither party waives consequential or direct damages arising from fraud, gross negligence, willful misconduct, or unauthorized IP/confidentiality misappropriation.",
      counsel: "Liability exclusions shall under no circumstances shield fraud, intentional breach, gross negligence, or statutory violations."
    }
  }),
  defineRule({
    id: "LC-07",
    categoryId: "LIABILITY_CAP",
    title: "Landlord Exculpation From Structural or Plumbing Damage",
    severity: "high",
    riskPoints: 17,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease"],
    anchorKeywords: ["roof leak", "plumbing", "burst pipe", "not liable for damage to resident"],
    pattern: /\b(?:landlord\s+shall\s+not\s+be\s+liable\s+for\s+any\s+(?:damage|loss)[^.;\n]{0,75}(?:plumbing|roof\s+leak|burst\s+pipe|electrical|mold))\b[^.;\n]{0,80}\.?/i,
    rationale: "Relieves the landlord of accountability when deferred building maintenance floods or destroys a tenant's belongings.",
    redlines: {
      collaborative: "Landlord remains responsible for property damage resulting from Landlord's negligent failure to maintain building plumbing, roof, or electrical systems.",
      bilateral: "Landlord exculpation does not apply to losses caused by Landlord's negligence, delayed repair after notice, or breach of statutory habitability duties.",
      counsel: "Landlord structural and plumbing negligence exculpation clauses are struck as void against public policy."
    }
  }),
  defineRule({
    id: "LC-08",
    categoryId: "LIABILITY_CAP",
    title: "One-Way Liquidated Damages Penalty Against Signer",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 1500,
    docCategories: ["nda-contractor", "saas-msa", "residential-lease"],
    anchorKeywords: ["liquidated damages", "automatic penalty"],
    pattern: /\b(?:contractor|customer|resident)\s+shall\s+pay\s+liquidated\s+damages\s+of\s+\$\s?[\d,]+\b[^.;\n]{0,85}\.?/i,
    rationale: "Forces an arbitrary pre-set financial penalty for minor technical defaults without proving actual harm.",
    redlines: {
      collaborative: "Remedies for any verified breach shall be limited to documented actual damages rather than fixed liquidated penalties.",
      bilateral: "Fixed liquidated damage penalties are deleted; recovery is limited to actual, verified direct damages subject to the Agreement's liability limitations.",
      counsel: "Punitive liquidated damages provisions are struck in their entirety; claimant must prove actual mitigated direct loss."
    }
  }),
  defineRule({
    id: "LC-09",
    categoryId: "LIABILITY_CAP",
    title: "Abbreviated 30-to-90-Day Claim Filing Bar",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "nda-contractor", "custom-agreement"],
    anchorKeywords: ["forever barred", "statute of limitations", "within 30 days", "within 60 days"],
    pattern: /\b(?:any\s+(?:claim|action)\s+(?:must|shall)\s+be\s+(?:brought|filed)\s+within\s+(?:30|60|90)\s+days|forever\s+barred\s+after\s+(?:30|60|90)\s+days)\b[^.;\n]{0,80}\.?/i,
    rationale: "Artificially slashes statutory claim deadlines down to 30-90 days, cutting off claims before latent defects surface.",
    redlines: {
      collaborative: "Claims may be brought within the standard statutory period or at least 2 years after discovery.",
      bilateral: "Contractual shortening of the statute of limitations is deleted; claims are governed by applicable statutory limitation periods (minimum 2 years from discovery).",
      counsel: "Abbreviated claim-filing bars (30-90 days) are void; applicable statutory limitations govern all claims."
    }
  }),
  defineRule({
    id: "LC-10",
    categoryId: "LIABILITY_CAP",
    title: "Lifetime Aggregate Cap Tied to Setup Fee",
    severity: "high",
    riskPoints: 17,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["lifetime aggregate", "initial setup fee", "onboarding fee"],
    pattern: /\b(?:lifetime\s+aggregate\s+liability|total\s+cumulative\s+liability[^.;\n]{0,55}initial\s+(?:setup|onboarding)\s+fee)\b[^.;\n]{0,80}\.?/i,
    rationale: "Locks lifetime recovery across multi-year contracts down to a tiny initial setup charge.",
    redlines: {
      collaborative: "Liability cap resets annually at 12 months of recurring subscription fees paid.",
      bilateral: "Cumulative liability cap applies on a rolling 12-month basis equal to total fees paid or payable in the preceding year.",
      counsel: "Setup-fee lifetime cap is rejected and replaced with a rolling annual 12-month fee cap per contract year."
    }
  }),
  defineRule({
    id: "LC-11",
    categoryId: "LIABILITY_CAP",
    title: "Sole Remedy Illusory Cancellation Without Refund",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa"],
    anchorKeywords: ["sole and exclusive remedy", "without refund", "discontinue use"],
    pattern: /\b(?:sole\s+and\s+exclusive\s+remedy[^.;\n]{0,65}(?:stop\s+using|discontinue\s+use|terminate\s+without\s+refund))\b[^.;\n]{0,80}\.?/i,
    rationale: "Says your only recourse when the software stops working completely is to walk away while forfeiting prepaid fees.",
    redlines: {
      collaborative: "If material SLA or warranty failures remain uncured after 15 days, Customer may terminate and receive a pro-rata refund of prepaid unused fees.",
      bilateral: "Exclusive remedies for uncured SLA outages or material breach include mandatory service credits and the right to terminate with a full pro-rata refund of unearned prepaid fees.",
      counsel: "Termination-without-refund sole remedies are deleted; Vendor owes full pro-rata refunds plus actual direct cover damages upon uncured failure."
    }
  }),
  defineRule({
    id: "LC-12",
    categoryId: "LIABILITY_CAP",
    title: "Complete Immunity for Vendor Subprocessors & Cloud Hosts",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa"],
    anchorKeywords: ["subprocessors", "third-party hosting", "cloud provider"],
    pattern: /\b(?:no\s+liability|disclaims?\s+all\s+responsibility)\s+for\s+(?:acts,?\s+omissions,?\s+or\s+failures\s+of\s+)?(?:its\s+)?(?:subprocessors?|third-party\s+hosting|cloud\s+providers?)\b[^.;\n]{0,80}\.?/i,
    rationale: "Allows a SaaS vendor to outsource core infrastructure and disclaim responsibility when their chosen subprocessor loses your data.",
    redlines: {
      collaborative: "Vendor remains responsible for the performance and security compliance of its subprocessors to the same extent as Vendor itself.",
      bilateral: "Vendor is directly liable for the acts, omissions, security failures, and breaches of its subprocessors and hosting providers as if performed by Vendor.",
      counsel: "Subprocessor immunity is deleted; Vendor guarantees full pass-through liability for every downstream subprocessor handling Customer Data."
    }
  }),
  defineRule({
    id: "LC-13",
    categoryId: "LIABILITY_CAP",
    title: "One-Way Force Majeure Requiring Ongoing Payment",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["force majeure", "payment obligations shall not be excused"],
    pattern: /\b(?:force\s+majeure[^.;\n]{0,75}(?:payment\s+obligations?\s+(?:are|shall)\s+not\s+(?:be\s+)?excused|must\s+continue\s+paying))\b[^.;\n]{0,80}\.?/i,
    rationale: "Lets the vendor suspend delivery indefinitely during an outage while requiring you to keep paying full invoices.",
    redlines: {
      collaborative: "During any force majeure disruption lasting over 15 days, recurring fees are equitably abated and Customer may terminate without penalty after 30 days.",
      bilateral: "Force majeure suspends corresponding payment obligations for undelivered services; if disruption exceeds 30 consecutive days, either party may terminate with a pro-rata refund.",
      counsel: "One-way payment continuity during force majeure outage is deleted; fees abate immediately during service suspension."
    }
  }),
  defineRule({
    id: "LC-14",
    categoryId: "LIABILITY_CAP",
    title: "Disclaimer of Quiet Enjoyment or Core Habitability",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "hoa-covenants"],
    anchorKeywords: ["as-is", "quiet enjoyment", "habitability"],
    pattern: /\b(?:accepts?\s+premises\s+"?as[- ]is"?|waives?\s+(?:all\s+)?(?:implied\s+)?warranties?\s+of\s+(?:habitability|quiet\s+enjoyment))\b[^.;\n]{0,80}\.?/i,
    rationale: "Attempts to waive legally mandated residential habitability and peaceful occupancy rights.",
    redlines: {
      collaborative: "Premises are delivered in clean, safe, code-compliant condition with full statutory habitability and quiet enjoyment warranties.",
      bilateral: "As-is acceptance is strictly limited to cosmetic condition noted at move-in and never waives statutory implied warranties of habitability or quiet enjoyment.",
      counsel: "Purported waivers of implied habitability and quiet enjoyment are void and severed."
    }
  }),
  defineRule({
    id: "LC-15",
    categoryId: "LIABILITY_CAP",
    title: "Waiver of Right to Offset or Dispute Invoices",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["without setoff", "without deduction", "waives any right of offset"],
    pattern: /\b(?:paid\s+without\s+(?:setoff|deduction|counterclaim)|waives?\s+any\s+right\s+of\s+(?:offset|setoff|withholding))\b[^.;\n]{0,80}\.?/i,
    rationale: "Forces automatic payment even of blatantly erroneous or disputed overbillings.",
    redlines: {
      collaborative: "Customer may withhold payment solely of specific line items disputed in good faith while paying undisputed amounts on time.",
      bilateral: "Neither party waives the right to withhold payment of portions disputed in good faith with written notice prior to the due date, without penalty or suspension.",
      counsel: "No-setoff and dispute-pay bans are deleted; disputed charges remain suspended pending documented reconciliation."
    }
  }),
  defineRule({
    id: "LC-16",
    categoryId: "LIABILITY_CAP",
    title: "Blanket Exclusion of Statutory & Equitable Remedies",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "hoa-covenants"],
    anchorKeywords: ["waives all statutory remedies", "waives restitution", "waives equitable relief"],
    pattern: /\b(?:waives?\s+(?:all\s+)?(?:statutory\s+remedies|restitution|rescission|equitable\s+relief))\b[^.;\n]{0,80}\.?/i,
    rationale: "Strips away consumer protection statutes, rescission rights, and restitution even in cases of misrepresentation.",
    redlines: {
      collaborative: "Each party retains all statutory and equitable remedies available under applicable law.",
      bilateral: "Nothing herein waives non-waivable statutory remedies, restitution, or equitable relief for material breach or misrepresentation.",
      counsel: "Waivers of statutory remedies, rescission, and restitution are struck as void."
    }
  }),

  // =========================================================================
  // 6. UNILATERAL_MOD (UM-01 .. UM-16)
  // =========================================================================
  defineRule({
    id: "UM-01",
    categoryId: "UNILATERAL_MOD",
    title: "Silent Amendment via Online URL / Terms Drift",
    severity: "critical",
    riskPoints: 21,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["online url", "updating an online", "continued use constitutes", "post revised terms"],
    pattern: /\b(?:(?:vendor|provider|company)\s+may\s+)?(?:modify|amend|update)\s+(?:this\s+agreement|the\s+terms|sla)[^.;\n]{0,105}\b(?:updating\s+(?:an\s+)?online\s+url|posting\s+(?:to\s+)?(?:its\s+)?website|continued\s+use\s+constitutes)\b[^.;\n]{0,95}\.?/i,
    rationale: "Allows the vendor to rewrite your signed contract overnight on a webpage and treat ordinary login as binding acceptance.",
    redlines: {
      collaborative: "Material modifications to these Terms require at least 30 days' direct email notice and will not materially diminish core rights during an active paid term.",
      bilateral: "No amendment via website URL update is binding upon Customer; modifications require a mutually signed written amendment, and existing executed terms govern throughout the active term.",
      counsel: "Unilateral URL terms amendment and deemed acceptance by continued use are deleted in full. This Agreement may be modified solely via an instrument signed by authorized officers of both parties."
    }
  }),
  defineRule({
    id: "UM-02",
    categoryId: "UNILATERAL_MOD",
    title: "Unilateral Landlord Entry Without Prior Notice",
    severity: "critical",
    riskPoints: 20,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease"],
    anchorKeywords: ["enter the premises", "without prior notice", "at any time without notice"],
    pattern: /\b(?:landlord|management|agent)\s+may\s+enter\s+(?:the\s+)?premises[^.;\n]{0,65}\b(?:at\s+any\s+time\s+)?without\s+(?:prior\s+)?notice\b[^.;\n]{0,80}\.?/i,
    rationale: "Violates tenant privacy and statutory notice rules by authorizing unannounced entry for showings or convenience.",
    redlines: {
      collaborative: "Except in genuine physical emergencies, Landlord will provide at least 24 hours' advance written notice before entering during normal daytime hours.",
      bilateral: "Unannounced entry is deleted; Landlord may enter solely with at least 24 hours' advance written notice during reasonable daytime hours, except in imminent emergencies threatening life or property.",
      counsel: "Entry without prior written notice is prohibited except in documented imminent physical emergencies; non-emergency access requires 48 hours' prior written notice and Resident scheduling."
    }
  }),
  defineRule({
    id: "UM-03",
    categoryId: "UNILATERAL_MOD",
    title: "Unilateral House Rules & Policy Rewrite by Posting",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "hoa-covenants", "saas-msa"],
    anchorKeywords: ["house rules", "handbook", "sole discretion from time to time"],
    pattern: /\b(?:house\s+rules|community\s+policies|acceptable\s+use\s+policy|handbook)\b[^.;\n]{0,75}\b(?:amended\s+at\s+any\s+time|sole\s+discretion\s+from\s+time\s+to\s+time|binding\s+upon\s+posting)\b[^.;\n]{0,80}\.?/i,
    rationale: "Lets management invent new prohibitions or fees unilaterally through updated house-rule postings.",
    redlines: {
      collaborative: "Reasonable operational rules require 30 days' advance written notice and cannot conflict with core contract rights or add new fees.",
      bilateral: "Policy updates may not create new financial charges, shorten cure rights, or materially restrict core rights granted under the executed Agreement.",
      counsel: "Unilateral rule-making binding upon posting is deleted; no amended rule increases obligations or impairs contract rights absent signed consent."
    }
  }),
  defineRule({
    id: "UM-04",
    categoryId: "UNILATERAL_MOD",
    title: "Mid-Term Unilateral Pricing or Fee Schedule Changes",
    severity: "critical",
    riskPoints: 20,
    annualFeeEstimate: 1000,
    docCategories: ["saas-msa", "residential-lease", "hoa-covenants"],
    anchorKeywords: ["adjust fees at any time", "change pricing", "mid-term fee"],
    pattern: /\b(?:adjust|modify|increase)\s+(?:any\s+)?(?:fees|rates|pricing|charges)\s+at\s+any\s+time\b[^.;\n]{0,85}\.?/i,
    rationale: "Nullifies price certainty by letting the counterparty hike rates mid-term whenever they want.",
    redlines: {
      collaborative: "All contracted prices remain fixed throughout the active committed term.",
      bilateral: "Contracted fees and rate schedules are strictly locked throughout the current term and cannot be increased mid-term.",
      counsel: "Unilateral mid-term fee adjustment authority is void; fees remain fixed for the entire duration of the executed term."
    }
  }),
  defineRule({
    id: "UM-05",
    categoryId: "UNILATERAL_MOD",
    title: "Unilateral Feature Deprecation or Scope Reduction",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["deprecate", "remove features", "discontinue any feature"],
    pattern: /\b(?:remove|discontinue|deprecate)\s+(?:any\s+)?(?:features?|functionality|services?)\s+(?:at\s+any\s+time\s+)?without\s+(?:liability|notice|refund)\b[^.;\n]{0,80}\.?/i,
    rationale: "Allows the vendor to strip out the key capabilities you bought while keeping your full annual subscription payment.",
    redlines: {
      collaborative: "Vendor will not materially reduce core functionality during a paid term without offering a substantially equivalent feature or pro-rata refund.",
      bilateral: "Vendor may not materially degrade or remove core functionality during an active term; if a material degradation occurs, Customer may terminate and receive a pro-rata refund of prepaid fees.",
      counsel: "Unilateral feature removal without refund is deleted; core contracted capabilities are guaranteed for the full paid term."
    }
  }),
  defineRule({
    id: "UM-06",
    categoryId: "UNILATERAL_MOD",
    title: "Deemed Binding Acceptance via Silence or Passive Login",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "hoa-covenants", "custom-agreement"],
    anchorKeywords: ["deemed accepted", "silence constitutes", "passive login"],
    pattern: /\b(?:deemed\s+(?:to\s+have\s+)?accepted|silence\s+constitutes\s+consent|clicking\s+through|logging\s+in\s+constitutes)\b[^.;\n]{0,85}\.?/i,
    rationale: "Treats normal employee clicks or unresponded notices as binding contract signatures.",
    redlines: {
      collaborative: "Contract amendments take effect only through explicit written acknowledgment by an authorized representative.",
      bilateral: "Clickwrap banners, silence, and routine employee logins do not amend this executed Agreement; changes require written acceptance by an authorized signatory.",
      counsel: "Deemed acceptance via silence or portal click-through is null and void."
    }
  }),
  defineRule({
    id: "UM-07",
    categoryId: "UNILATERAL_MOD",
    title: "Asymmetric Unilateral Assignment to Unknown Successors",
    severity: "medium",
    riskPoints: 10,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "nda-contractor", "custom-agreement"],
    anchorKeywords: ["assign without consent", "may assign freely", "customer may not assign"],
    pattern: /\b(?:may\s+assign\s+(?:this\s+agreement\s+)?(?:freely|without\s+consent))[^.;\n]{0,75}\b(?:while|whereas)?\s*(?:customer|contractor|resident)?\s*(?:may\s+not\s+assign|prohibited\s+from\s+assigning)\b[^.;\n]{0,75}\.?/i,
    rationale: "Lets the drafter sell your contract to an unknown buyer or competitor while forbidding you from assigning even during a corporate reorganization.",
    redlines: {
      collaborative: "Assignment permissions shall apply mutually, allowing either party to assign in connection with a merger or acquisition with notice.",
      bilateral: "Assignment rights are mutual: either party may assign to an affiliate or acquirer of substantially all assets upon written notice, provided the assignee assumes all obligations.",
      counsel: "Asymmetric assignment restrictions are replaced with mutual M&A/affiliate assignment rights and consent requirements for transfers to direct competitors."
    }
  }),
  defineRule({
    id: "UM-08",
    categoryId: "UNILATERAL_MOD",
    title: "Prohibition on Tenant Sublease or Roommate Replacement",
    severity: "medium",
    riskPoints: 10,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease"],
    anchorKeywords: ["sublet", "sublease", "strictly prohibited"],
    pattern: /\b(?:subletting|subleasing|occupant\s+replacement)\s+(?:is\s+)?(?:strictly\s+prohibited|banned\s+under\s+all\s+circumstances)\b[^.;\n]{0,80}\.?/i,
    rationale: "Bars reasonable roommate replacement or assignment if you relocate, trapping you in double rent.",
    redlines: {
      collaborative: "Resident may sublease or assign to a qualified applicant meeting standard objective screening criteria, with Landlord consent not unreasonably withheld.",
      bilateral: "Subleasing or assignment to an applicant satisfying Landlord's published objective tenant screening criteria shall not be unreasonably withheld or conditioned on punitive fees.",
      counsel: "Absolute bans on subleasing or assignment are deleted; Landlord may not unreasonably withhold approval of qualified replacement tenants."
    }
  }),
  defineRule({
    id: "UM-09",
    categoryId: "UNILATERAL_MOD",
    title: "Unilateral Relocation of Unit, Workspace, or Data Region",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "saas-msa"],
    anchorKeywords: ["relocate", "substitute another unit", "change data region"],
    pattern: /\b(?:unilaterally\s+relocate|substitute\s+(?:a\s+)?different\s+(?:unit|apartment|space)|move\s+customer\s+data\s+to\s+any\s+(?:region|jurisdiction))\b[^.;\n]{0,80}\.?/i,
    rationale: "Permits moving your leased unit or relocating regulated cloud data across foreign jurisdictions without permission.",
    redlines: {
      collaborative: "Relocation of leased premises or primary data hosting regions requires the tenant's or customer's prior written consent.",
      bilateral: "Neither leased premises nor designated data residency regions may be changed unilaterally without prior written consent.",
      counsel: "Unilateral unit substitution and cross-border data relocation rights are deleted."
    }
  }),
  defineRule({
    id: "UM-10",
    categoryId: "UNILATERAL_MOD",
    title: "Silent Privacy & Third-Party Data Sharing Drift",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "hoa-covenants"],
    anchorKeywords: ["privacy policy", "share resident data", "marketing partners"],
    pattern: /\b(?:privacy\s+policy\s+(?:may\s+be\s+)?modified\s+at\s+any\s+time|share\s+(?:customer|resident)\s+(?:data|information)\s+with\s+(?:third-party\s+)?marketing\s+partners)\b[^.;\n]{0,80}\.?/i,
    rationale: "Permits retroactive dilution of data privacy protections or selling contact profiles to third-party brokers.",
    redlines: {
      collaborative: "Personal data and confidential files shall never be sold or shared with third-party marketing partners.",
      bilateral: "Data handling commitments executed at signing remain locked; zero personal or business data may be shared with third-party advertisers or data brokers.",
      counsel: "Unilateral privacy policy weakening and marketing data-sharing clauses are deleted."
    }
  }),
  defineRule({
    id: "UM-11",
    categoryId: "UNILATERAL_MOD",
    title: "Unilateral SLA Uptime Reduction Mid-Term",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa"],
    anchorKeywords: ["modify the sla", "reduce uptime", "service level"],
    pattern: /\b(?:modify\s+(?:the\s+)?(?:sla|service\s+level)|reduce\s+uptime\s+commitments?)\s+(?:at\s+any\s+time|in\s+its\s+sole\s+discretion)\b[^.;\n]{0,80}\.?/i,
    rationale: "Allows the vendor to silently lower uptime targets (e.g., from 99.9% to 95%) after you signed.",
    redlines: {
      collaborative: "Service Level Agreement uptime targets shall not be reduced below baseline commitments during an active term.",
      bilateral: "Vendor guarantees that SLA uptime thresholds and response times will not be materially reduced during any active subscription term.",
      counsel: "Unilateral SLA downgrades are void; SLA thresholds remain contractually fixed at signing baselines."
    }
  }),
  defineRule({
    id: "UM-12",
    categoryId: "UNILATERAL_MOD",
    title: "Closure of Contracted Amenities Without Rent Abatement",
    severity: "medium",
    riskPoints: 10,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "hoa-covenants"],
    anchorKeywords: ["close amenities", "suspend parking", "without rent abatement"],
    pattern: /\b(?:close|eliminate|suspend)\s+(?:any\s+)?(?:amenities|facilities|parking|pool|gym)[^.;\n]{0,65}\b(?:without\s+(?:rent\s+)?abatement|without\s+reduction\s+in\s+(?:rent|dues))\b[^.;\n]{0,75}\.?/i,
    rationale: "Allows removing promised building amenities indefinitely while still collecting full rent or HOA fees.",
    redlines: {
      collaborative: "Prolonged closure of core promised amenities exceeding 30 days entitles residents to an equitable rent credit or penalty-free opt-out of related fees.",
      bilateral: "Unscheduled closure of major promised amenities exceeding 30 consecutive days requires a proportionate rent/fee abatement for affected residents.",
      counsel: "No-abatement amenity removal clauses are deleted; prolonged deprivation entitles Resident to proportional fee reduction."
    }
  }),
  defineRule({
    id: "UM-13",
    categoryId: "UNILATERAL_MOD",
    title: "Continuous Unconsented Credit & Background Re-Screening",
    severity: "medium",
    riskPoints: 10,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "nda-contractor"],
    anchorKeywords: ["re-screen", "pull credit reports", "periodic background"],
    pattern: /\b(?:pull\s+credit\s+reports?|conduct\s+periodic\s+background\s+(?:checks|re-?screening))\s+(?:at\s+any\s+time|without\s+further\s+notice)\b[^.;\n]{0,80}\.?/i,
    rationale: "Authorizes recurring credit inquiries and background harvesting without event-specific consent.",
    redlines: {
      collaborative: "Credit or background checks occur strictly once upon initial application with explicit written authorization.",
      bilateral: "Standing authority for ongoing credit pulls or periodic background checks without fresh written consent is deleted.",
      counsel: "Continuous post-signing credit and background surveillance authorization is void."
    }
  }),
  defineRule({
    id: "UM-14",
    categoryId: "UNILATERAL_MOD",
    title: "Drafter Sole Discretion Over 'Satisfaction' & 'Cause'",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["sole satisfaction", "sole and absolute discretion", "deems unsatisfactory"],
    pattern: /\b(?:sole\s+and\s+(?:absolute\s+)?discretion|client'?s?\s+sole\s+satisfaction|deems?\s+unsatisfactory\s+without\s+explanation)\b[^.;\n]{0,85}\.?/i,
    rationale: "Permits arbitrary rejection of completed work and withholding of milestone payments based on subjective whims.",
    redlines: {
      collaborative: "Acceptance shall be measured objectively against the written specifications in the Statement of Work, with 10 business days to review.",
      bilateral: "Subjective 'sole satisfaction' tests are replaced with objective conformity to documented SOW specifications; acceptance is deemed granted if no specific written defect list is delivered within 10 business days.",
      counsel: "Arbitrary sole-discretion acceptance and payment withholding clauses are struck in favor of objective SOW acceptance criteria."
    }
  }),
  defineRule({
    id: "UM-15",
    categoryId: "UNILATERAL_MOD",
    title: "Unattached External Policies Incorporated by Reference",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "hoa-covenants"],
    anchorKeywords: ["incorporated herein by reference", "unattached schedules", "policies posted separately"],
    pattern: /\b(?:all\s+(?:policies|schedules|addenda)\s+(?:posted\s+separately|on\s+file\s+at\s+office)\s+are\s+incorporated\s+herein\s+by\s+reference)\b[^.;\n]{0,80}\.?/i,
    rationale: "Binds you to secret or unattached documents you have never seen or signed.",
    redlines: {
      collaborative: "Only schedules and exhibits physically or electronically attached to this Agreement at signing are binding.",
      bilateral: "Only documents explicitly attached as Exhibits at execution form part of this Agreement; unattached external policies are non-binding.",
      counsel: "Incorporation by reference of unattached or mutable external schedules is deleted."
    }
  }),
  defineRule({
    id: "UM-16",
    categoryId: "UNILATERAL_MOD",
    title: "Immediate Service Kill-Switch During Billing Dispute",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["suspend access immediately", "during any billing dispute", "lockout account"],
    pattern: /\b(?:suspend\s+(?:all\s+)?(?:access|services?)\s+immediately|lock\s+out\s+(?:customer|account))[^.;\n]{0,65}\b(?:even\s+during\s+a\s+dispute|without\s+prior\s+notice)\b[^.;\n]{0,75}\.?/i,
    rationale: "Gives the vendor a hostage kill-switch over mission-critical business systems over an invoice discrepancy.",
    redlines: {
      collaborative: "Vendor will not suspend access during a good-faith billing dispute and will provide 15 business days' notice before suspending for undisputed late invoices.",
      bilateral: "Suspension for non-payment applies solely to undisputed overdue balances after 15 business days' written notice and never applies while a good-faith dispute is active.",
      counsel: "Summary service suspension and dispute-hostage kill-switches are prohibited."
    }
  }),

  // =========================================================================
  // 7. ARBITRATION_VENUE (AV-01 .. AV-16)
  // =========================================================================
  defineRule({
    id: "AV-01",
    categoryId: "ARBITRATION_VENUE",
    title: "Forced Binding Arbitration With One-Way Fee Shifting",
    severity: "critical",
    riskPoints: 21,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants", "saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["binding arbitration", "association-selected", "one-way fee shifting"],
    pattern: /\b(?:submitted\s+to\s+binding\s+arbitration|mandatory\s+binding\s+arbitration)[^.;\n]{0,115}\b(?:one-way\s+fee\s+shifting|association-selected|drafter-selected|all\s+arbitration\s+costs)\b[^.;\n]{0,80}\.?/i,
    rationale: "Strips jury and court access while stacking biased forum selection and one-way legal fee exposure against the weaker party.",
    redlines: {
      collaborative: "Disputes shall be resolved in a neutral local court of competent jurisdiction or mutually agreed mediation, with each party bearing its own costs unless ordered otherwise.",
      bilateral: "Mandatory arbitration with one-way fee shifting is deleted; disputes shall proceed before a neutral court in the defendant's or property's local county (including small claims), with mutual prevailing-party fee recovery only.",
      counsel: "Forced arbitration and one-way fee shifting are struck in full. Either party retains full judicial, jury, and small-claims access in a neutral local forum."
    }
  }),
  defineRule({
    id: "AV-02",
    categoryId: "ARBITRATION_VENUE",
    title: "Landlord / Drafter-Only Legal Fee Shift",
    severity: "critical",
    riskPoints: 20,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "hoa-covenants", "custom-agreement"],
    anchorKeywords: ["attorneys' fees", "attorney fees", "regardless of outcome"],
    pattern: /\b(?:resident|tenant|customer|owner)\s+shall\s+pay\s+(?:all\s+)?(?:landlord|vendor|association)'?s?\s+(?:reasonable\s+)?attorneys?'?\s+fees[^.;\n]{0,85}\b(?:regardless\s+of\s+outcome|while\s+(?:landlord|vendor)\s+bears\s+no\s+liability)\b[^.;\n]{0,75}\.?/i,
    rationale: "Forces you to pay the drafter's lawyers even if you win in court, while blocking your fee recovery when they break the contract.",
    redlines: {
      collaborative: "In any formal proceeding, only the prevailing party as determined by the court may recover reasonable attorneys' fees.",
      bilateral: "One-way legal fee shifting is converted to a strictly bilateral prevailing-party standard: whichever party substantially prevails in final judgment recovers reasonable attorneys' fees and costs.",
      counsel: "Asymmetric and outcome-independent attorney fee shifts are void and converted to mandatory reciprocal prevailing-party fee recovery."
    }
  }),
  defineRule({
    id: "AV-03",
    categoryId: "ARBITRATION_VENUE",
    title: "Unilateral Ex Parte Injunctive Relief Without Bond",
    severity: "high",
    riskPoints: 17,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa", "custom-agreement"],
    anchorKeywords: ["injunctive relief", "without posting", "ex parte"],
    pattern: /\b(?:ex\s+parte\s+)?(?:temporary\s+restraining\s+orders?|injunctive\s+relief)\s+(?:without\s+posting\s+(?:any\s+)?bond|without\s+bond|without\s+proving\s+actual\s+damages)\b[^.;\n]{0,85}\.?/i,
    rationale: "Lets one party freeze your livelihood or business without posting a security bond to protect you if their injunction turns out to be wrongful.",
    redlines: {
      collaborative: "Either party may seek equitable relief on a mutual basis from a court of competent jurisdiction under standard procedural rules.",
      bilateral: "Equitable and injunctive remedies apply strictly mutually upon notice and hearing, subject to standard statutory bond and irreparable-harm proof requirements.",
      counsel: "Ex parte and bondless unilateral injunctive waivers are deleted; equitable relief is strictly mutual and conditioned on statutory bond and verified evidentiary hearing."
    }
  }),
  defineRule({
    id: "AV-04",
    categoryId: "ARBITRATION_VENUE",
    title: "Mandatory Class Action & Collective Proceeding Waiver",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "hoa-covenants"],
    anchorKeywords: ["class action", "collective action", "representative proceeding"],
    pattern: /\b(?:waives?\s+(?:any\s+)?(?:right\s+to\s+participate\s+in\s+(?:a\s+)?)?(?:class\s+action|collective\s+(?:action|arbitration)|representative\s+proceeding))\b[^.;\n]{0,85}\.?/i,
    rationale: "Prevents harmed consumers or tenants from pooling resources against systemic junk fees or unlawful practices.",
    redlines: {
      collaborative: "Dispute resolution provisions do not restrict collective or representative claims permitted under applicable law.",
      bilateral: "Class, collective, and representative action waivers are deleted to the maximum extent permitted by applicable public policy.",
      counsel: "Class and collective action waivers are struck in full."
    }
  }),
  defineRule({
    id: "AV-05",
    categoryId: "ARBITRATION_VENUE",
    title: "Inconvenient Distant Exclusive Forum Lock",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "nda-contractor", "custom-agreement"],
    anchorKeywords: ["exclusive venue", "exclusive jurisdiction", "irrevocably submits"],
    pattern: /\b(?:exclusive\s+(?:venue|jurisdiction)\s+shall\s+lie\s+solely\s+in|irrevocably\s+submits\s+to\s+the\s+exclusive\s+(?:courts|venue))\b[^.;\n]{0,95}\.?/i,
    rationale: "Forces out-of-state defendants to litigate minor disputes thousands of miles from home at prohibitive travel cost.",
    redlines: {
      collaborative: "Disputes may be heard in a mutually convenient neutral venue or in the defendant's local jurisdiction.",
      bilateral: "Exclusive venue shall lie in the jurisdiction where the property is located or where the defendant maintains its principal place of business or residence.",
      counsel: "Distant unilateral venue locks are replaced with home-forum / property-location venue rules."
    }
  }),
  defineRule({
    id: "AV-06",
    categoryId: "ARBITRATION_VENUE",
    title: "Asymmetric Court Carve-Out for Drafter Claims Only",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "hoa-covenants"],
    anchorKeywords: ["carve-out", "drafter may bring suit", "eviction or collection in court"],
    pattern: /\b(?:vendor|landlord|association)\s+may\s+(?:nonetheless\s+)?(?:sue|bring\s+(?:collection|eviction|court)\s+actions?)\s+in\s+court\s+while\s+(?:customer|resident|owner)\b[^.;\n]{0,85}\.?/i,
    rationale: "Forces you into private arbitration for all your claims while letting the drafter take you to court for collections.",
    redlines: {
      collaborative: "Any judicial or arbitration process selected shall apply identically to claims brought by either party.",
      bilateral: "Asymmetric arbitration carve-outs are deleted; all dispute resolution forums and small-claims exceptions apply identically to both parties.",
      counsel: "One-sided litigation carve-outs are void as lacking mutuality; both parties share identical judicial rights."
    }
  }),
  defineRule({
    id: "AV-07",
    categoryId: "ARBITRATION_VENUE",
    title: "Waiver of Jury Trial & Discovery Rights",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "saas-msa", "hoa-covenants"],
    anchorKeywords: ["waives trial by jury", "jury trial", "waives discovery"],
    pattern: /\b(?:knowingly\s+and\s+irrevocably\s+waives?\s+(?:any\s+right\s+to\s+)?(?:a\s+)?(?:trial\s+by\s+jury|jury\s+trial|pre-trial\s+discovery))\b[^.;\n]{0,85}\.?/i,
    rationale: "Strips constitutional jury rights and the discovery tools needed to uncover internal misconduct.",
    redlines: {
      collaborative: "Both parties retain standard statutory rights to discovery and judicial fact-finding.",
      bilateral: "Jury trial and discovery waivers are deleted; standard rules of civil procedure govern any formal proceeding.",
      counsel: "Waivers of trial by jury and civil discovery are struck in full."
    }
  }),
  defineRule({
    id: "AV-08",
    categoryId: "ARBITRATION_VENUE",
    title: "Drafter-Picked Arbitrator or Captive Forum",
    severity: "critical",
    riskPoints: 20,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants", "nda-contractor", "custom-agreement"],
    anchorKeywords: ["solely appointed", "arbitrator selected by", "captive forum"],
    pattern: /\b(?:arbitrator\s+(?:shall\s+be\s+)?(?:selected|appointed)\s+solely\s+by|captive\s+arbitration\s+panel)\b[^.;\n]{0,85}\.?/i,
    rationale: "Lets your adversary hand-pick the judge who decides your case.",
    redlines: {
      collaborative: "Any neutral mediator or arbitrator must be mutually selected by both parties from a nationally recognized independent roster.",
      bilateral: "Unilateral arbitrator selection is deleted; any arbitrator or mediator must be independent and jointly chosen by mutual written agreement.",
      counsel: "Captive or drafter-appointed arbitrator provisions are void; any dispute proceeds in public court unless both parties agree post-dispute on a neutral independent arbitrator."
    }
  }),
  defineRule({
    id: "AV-09",
    categoryId: "ARBITRATION_VENUE",
    title: "Punitive Pre-Suit Administrative Exhaustion Hurdle",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants", "saas-msa"],
    anchorKeywords: ["condition precedent to filing", "90-day committee review", "administrative exhaustion"],
    pattern: /\b(?:condition\s+precedent\s+to\s+(?:any\s+)?(?:suit|claim)|must\s+first\s+exhaust\s+internal\s+board\s+appeals?)\b[^.;\n]{0,85}\.?/i,
    rationale: "Delays urgent legal remedies behind months of internal committee stonewalling.",
    redlines: {
      collaborative: "Parties agree to a brief 15-day good-faith executive or manager conference before formal filing, except for urgent equitable relief.",
      bilateral: "Pre-suit informal negotiation is limited to 15 days from written notice and never delays urgent injunctive or small-claims filings.",
      counsel: "Mandatory prolonged internal exhaustion barriers are deleted."
    }
  }),
  defineRule({
    id: "AV-10",
    categoryId: "ARBITRATION_VENUE",
    title: "Upfront Arbitration Fee & Travel Shift onto Signer",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "hoa-covenants", "nda-contractor"],
    anchorKeywords: ["arbitration filing fees", "advance all arbitrator", "loser pays all arbitration"],
    pattern: /\b(?:resident|owner|contractor|customer)\s+(?:must|shall)\s+(?:advance|pay\s+all)\s+(?:arbitration\s+filing\s+fees|arbitrator\s+compensation)\b[^.;\n]{0,85}\.?/i,
    rationale: "Deters valid small claims by making the individual advance thousands of dollars in arbitrator hourly retainers.",
    redlines: {
      collaborative: "Filing fees above standard local court filing fees shall be borne by the party demanding arbitration.",
      bilateral: "Individual claimants pay no more than the equivalent local court filing fee; any excess administrative or arbitrator fees are paid by the drafter.",
      counsel: "Shifting of private arbitration administration fees onto an individual resident or contractor is void."
    }
  }),
  defineRule({
    id: "AV-11",
    categoryId: "ARBITRATION_VENUE",
    title: "Strict Confidentiality Gag Over Arbitration Outcomes",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "nda-contractor", "hoa-covenants"],
    anchorKeywords: ["award shall remain strictly confidential", "prohibited from disclosing any award"],
    pattern: /\b(?:arbitration\s+proceedings?\s+and\s+(?:any\s+)?award\s+shall\s+remain\s+strictly\s+confidential|prohibited\s+from\s+disclosing\s+any\s+(?:award|dispute))\b[^.;\n]{0,85}\.?/i,
    rationale: "Hides systemic abuse or fraud from regulators, neighbors, and other affected customers.",
    redlines: {
      collaborative: "Dispute confidentiality applies only to non-public trade secrets and permits disclosures required by law, regulators, or advisors.",
      bilateral: "Confidentiality in dispute proceedings protects only bona fide trade secrets and never bars statutory, regulatory, tax, or legal-advisor disclosures.",
      counsel: "Blanket dispute and award gag orders are deleted."
    }
  }),
  defineRule({
    id: "AV-12",
    categoryId: "ARBITRATION_VENUE",
    title: "Waiver of Statutory Small Claims Court Access",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "saas-msa", "hoa-covenants"],
    anchorKeywords: ["small claims", "waives small claims"],
    pattern: /\b(?:waives?\s+(?:any\s+)?right\s+to\s+(?:file|bring\s+claims)\s+in\s+small\s+claims\s+court|small\s+claims\s+court\s+is\s+excluded)\b[^.;\n]{0,80}\.?/i,
    rationale: "Takes away fast, low-cost small claims court remedies for deposit or fee disputes.",
    redlines: {
      collaborative: "Either party may bring eligible claims in local small claims court at any time.",
      bilateral: "Both parties unconditionally retain the right to bring any qualifying claim in local small claims court.",
      counsel: "Exclusions of small claims court jurisdiction are void and severed."
    }
  }),
  defineRule({
    id: "AV-13",
    categoryId: "ARBITRATION_VENUE",
    title: "Confession of Judgment / Cognovit Authorization",
    severity: "critical",
    riskPoints: 25,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "custom-agreement"],
    anchorKeywords: ["confession of judgment", "cognovit", "enter judgment without hearing"],
    pattern: /\b(?:confession\s+of\s+judgment|cognovit|authorizes?\s+(?:any\s+)?attorney\s+to\s+appear\s+and\s+confess\s+judgment)\b[^.;\n]{0,90}\.?/i,
    rationale: "Authorizes the counterparty's lawyer to obtain a court money judgment against you secretly without notice or trial.",
    redlines: {
      collaborative: "Any legal judgment requires standard due process, service, and judicial hearing.",
      bilateral: "Confession of judgment and cognovit authorizations are deleted in their entirety as void.",
      counsel: "Warrants of attorney and confession-of-judgment clauses are strictly deleted as void against public policy."
    }
  }),
  defineRule({
    id: "AV-14",
    categoryId: "ARBITRATION_VENUE",
    title: "Waiver of Formal Service of Process",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "saas-msa", "custom-agreement"],
    anchorKeywords: ["waives service of process", "email service of summons", "default judgment without service"],
    pattern: /\b(?:waives?\s+(?:formal\s+)?service\s+of\s+process|consents?\s+to\s+service\s+of\s+summons\s+by\s+(?:ordinary\s+)?email\s+alone)\b[^.;\n]{0,85}\.?/i,
    rationale: "Risks unnoticed default judgments from a missed spam email instead of verified statutory service.",
    redlines: {
      collaborative: "Formal legal process must be served in accordance with applicable statutory rules of civil procedure.",
      bilateral: "Waivers of formal service of process are deleted; legal summonses must follow applicable court service rules.",
      counsel: "Extrajudicial waivers of statutory service of process are void."
    }
  }),
  defineRule({
    id: "AV-15",
    categoryId: "ARBITRATION_VENUE",
    title: "Waiver of Appeal Rights & Statutory Treble Damages",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants", "residential-lease", "saas-msa"],
    anchorKeywords: ["waives all right of appeal", "waives statutory treble", "punitive damages waiver"],
    pattern: /\b(?:waives?\s+(?:all\s+)?right\s+of\s+appeal|waives?\s+(?:any\s+)?statutory\s+(?:treble|double|exemplary)\s+damages)\b[^.;\n]{0,80}\.?/i,
    rationale: "Shields bad-faith violations from statutory multiplier penalties designed to deter abuse.",
    redlines: {
      collaborative: "Standard appellate review and statutory protections provided by law remain intact.",
      bilateral: "Waivers of statutory damages and appellate review rights are deleted.",
      counsel: "Attempted waivers of statutory punitive/treble damages and appeal rights are void."
    }
  }),
  defineRule({
    id: "AV-16",
    categoryId: "ARBITRATION_VENUE",
    title: "Fee-Shifting Penalty for Challenging Any Fine or Rule",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants", "residential-lease"],
    anchorKeywords: ["challenging a fine", "unsuccessful challenge", "pays association legal fees"],
    pattern: /\b(?:challenging\s+(?:any\s+)?(?:fine|rule|assessment)|unsuccessful\s+(?:appeal|challenge))[^.;\n]{0,75}\b(?:pay\s+(?:all\s+)?(?:association|landlord)'?s?\s+legal\s+fees)\b[^.;\n]{0,80}\.?/i,
    rationale: "Intimidates homeowners or residents from questioning questionable fines by threatening thousands in legal bills.",
    redlines: {
      collaborative: "Each party bears its own costs during internal administrative appeals or good-faith fine disputes.",
      bilateral: "Zero fee shifting applies to good-faith internal appeals or fine challenges; prevailing-party fee recovery applies strictly in formal judicial proceedings.",
      counsel: "Punitive fee-shifting provisions triggered by administrative fine appeals are deleted."
    }
  }),

  // =========================================================================
  // 8. NON_COMPETE (NC-01 .. NC-16)
  // =========================================================================
  defineRule({
    id: "NC-01",
    categoryId: "NON_COMPETE",
    title: "Perpetual or Multi-Year Worldwide Client Non-Solicit",
    severity: "critical",
    riskPoints: 22,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["solicit", "in perpetuity", "prospective client", "for 5 years"],
    pattern: /\b(?:shall\s+not|agrees\s+not\s+to)\s*,?\s*(?:in\s+perpetuity|for\s+(?:three|four|five|[3-9]|10)\s+years?)[^.;\n]{0,85}\b(?:solicit|work\s+with|divert)[^.;\n]{0,75}\b(?:client|customer|employee)\b[^.;\n]{0,80}\.?/i,
    rationale: "Blocks an independent contractor from working with broad networks of past, prospective, or peripheral contacts for years or forever.",
    redlines: {
      collaborative: "For 12 months post-engagement, Contractor will not actively solicit specific Client personnel directly assigned to the engagement.",
      bilateral: "Non-solicitation is strictly mutual, expires 12 months post-termination, applies solely to active Client accounts personally serviced by Contractor under an SOW, and excludes general job postings or unsolicited inbound inquiries.",
      counsel: "Perpetual and multi-year non-solicitation restraints covering prospective clients or broad industry contacts are deleted as unenforceable restraints of trade."
    }
  }),
  defineRule({
    id: "NC-02",
    categoryId: "NON_COMPETE",
    title: "Broad Post-Contract Industry Non-Compete Ban",
    severity: "critical",
    riskPoints: 24,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["competing business", "compete with", "similar services"],
    pattern: /\b(?:shall\s+not|prohibited\s+from)\b[^.;\n]{0,55}\b(?:engage\s+in|work\s+for|provide\s+similar\s+services\s+to|compete\s+with)[^.;\n]{0,75}\b(?:competing\s+business|same\s+industry|competitor)\b[^.;\n]{0,80}\.?/i,
    rationale: "Prevents an independent specialist from earning a living in their own profession after the contract finishes.",
    redlines: {
      collaborative: "Contractor remains completely free to serve other clients in the same industry provided Client Confidential Information is protected.",
      bilateral: "Post-termination non-compete restraints are deleted; Contractor may freely serve industry clients so long as Client Confidential Information is never disclosed.",
      counsel: "Post-contract non-compete covenants are void and deleted in their entirety."
    }
  }),
  defineRule({
    id: "NC-03",
    categoryId: "NON_COMPETE",
    title: "Non-Solicit Covering Unidentified 'Prospective' Clients",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor"],
    anchorKeywords: ["prospective client", "potential customer", "pipeline"],
    pattern: /\b(?:solicit|accept\s+business\s+from|work\s+with)[^.;\n]{0,70}\b(?:any\s+(?:current,?\s+former,?\s+or\s+)?prospective\s+client|potential\s+customer|sales\s+pipeline)\b[^.;\n]{0,80}\.?/i,
    rationale: "Makes you liable for accidentally pitching a prospect that the client secretly listed in an internal CRM.",
    redlines: {
      collaborative: "Any non-solicit covers solely active Client contacts explicitly introduced to Contractor in writing under this Agreement.",
      bilateral: "Non-solicitation excludes 'prospective', former, or unintroduced entities and applies strictly to named active accounts materially serviced by Contractor.",
      counsel: "References to 'prospective' or 'potential' clients are deleted as vague and unenforceable."
    }
  }),
  defineRule({
    id: "NC-04",
    categoryId: "NON_COMPETE",
    title: "Perpetual Non-Circumvention Commission Tail",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["non-circumvention", "circumvent", "commission tail"],
    pattern: /\b(?:non-circumvention|shall\s+not\s+circumvent)[^.;\n]{0,80}\b(?:perpetual|indefinite|5\s+years|liquidated\s+commission)\b[^.;\n]{0,80}\.?/i,
    rationale: "Creates permanent finder-fee claims over counterparties you already knew or meet independently years later.",
    redlines: {
      collaborative: "Non-circumvention applies solely to introductions newly made in writing under this Agreement for 12 months.",
      bilateral: "Non-circumvention expires 12 months after the relevant introduction, applies solely to parties not already in Contractor's pre-existing network, and excludes ordinary market transactions.",
      counsel: "Perpetual non-circumvention and indefinite commission tails are deleted."
    }
  }),
  defineRule({
    id: "NC-05",
    categoryId: "NON_COMPETE",
    title: "Overbroad Non-Disparagement Gag Blocking Honest Reviews",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "saas-msa", "nda-contractor", "hoa-covenants"],
    anchorKeywords: ["non-disparagement", "disparage", "negative review", "public criticism"],
    pattern: /\b(?:non-disparagement|shall\s+not\s+disparage|prohibited\s+from\s+posting\s+(?:any\s+)?negative\s+review|public\s+criticism)\b[^.;\n]{0,90}\.?/i,
    rationale: "Violates consumer review protections and tries to silence truthful experiences, reviews, or regulatory complaints.",
    redlines: {
      collaborative: "Neither party will make knowingly false defamatory statements of fact, without restricting truthful reviews or lawful disclosures.",
      bilateral: "Any non-disparagement clause applies mutually solely to knowingly false statements of fact and expressly protects truthful consumer reviews (CRFA), whistleblower disclosures, and regulatory reports.",
      counsel: "Gag orders barring truthful reviews, public criticism, or regulatory complaints are void under federal Consumer Review Fairness laws and deleted."
    }
  }),
  defineRule({
    id: "NC-06",
    categoryId: "NON_COMPETE",
    title: "Restriction on Working With Ecosystem Partners & Vendors",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa"],
    anchorKeywords: ["ecosystem partners", "subcontractors or vendors", "engage any vendor"],
    pattern: /\b(?:prohibited\s+from\s+engaging|shall\s+not\s+(?:contract|work)\s+with)\s+(?:any\s+)?(?:vendor|partner|supplier)\s+of\s+(?:client|company)\b[^.;\n]{0,80}\.?/i,
    rationale: "Prevents you from hiring common cloud providers, designers, or commercial vendors used in your market.",
    redlines: {
      collaborative: "Nothing restricts either party from working with shared commercial vendors or public ecosystem partners.",
      bilateral: "Restrictions on engaging shared vendors, suppliers, or third-party platforms are deleted.",
      counsel: "Vendor and ecosystem partner boycotts/exclusivities are deleted."
    }
  }),
  defineRule({
    id: "NC-07",
    categoryId: "NON_COMPETE",
    title: "Perpetual Confidentiality Over Non-Trade-Secret Info",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa", "custom-agreement"],
    anchorKeywords: ["confidentiality obligations shall last forever", "perpetual confidentiality", "even if publicly known"],
    pattern: /\b(?:confidentiality\s+obligations?\s+(?:shall\s+)?(?:survive\s+in\s+perpetuity|last\s+forever)|confidential\s+even\s+if\s+publicly\s+known)\b[^.;\n]{0,85}\.?/i,
    rationale: "Treats stale, non-secret, or public information as perpetual NDA liability forever.",
    redlines: {
      collaborative: "Non-trade-secret confidentiality expires after 3 years; verified trade secrets remain protected as long as they qualify under law.",
      bilateral: "Confidentiality obligations survive for 3 years post-termination (and for statutory trade secrets so long as protected by law), excluding public, independently developed, or lawfully obtained information.",
      counsel: "Perpetual NDA survival for general information is reduced to a 3-year survival cap with standard public-domain carve-outs."
    }
  }),
  defineRule({
    id: "NC-08",
    categoryId: "NON_COMPETE",
    title: "Automatic Tolling Extension of Restricted Period",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor"],
    anchorKeywords: ["tolled", "automatically extended during any alleged"],
    pattern: /\b(?:restricted\s+period\s+shall\s+be\s+tolled|automatically\s+extended\s+during\s+(?:any\s+)?(?:alleged\s+)?breach)\b[^.;\n]{0,85}\.?/i,
    rationale: "Unfairly extends restriction clocks indefinitely based on mere unproven accusations.",
    redlines: {
      collaborative: "Any fixed restriction period runs strictly from the contract end date without automatic tolling.",
      bilateral: "Automatic tolling provisions are deleted; restriction dates are fixed and calendar-certain.",
      counsel: "Tolling extensions triggered by unproven allegations are struck."
    }
  }),
  defineRule({
    id: "NC-09",
    categoryId: "NON_COMPETE",
    title: "Full-Time Exclusivity on Independent Contractor",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor"],
    anchorKeywords: ["exclusively for client", "prohibited from taking other clients", "moonlighting"],
    pattern: /\b(?:work\s+exclusively\s+for\s+client|prohibited\s+from\s+(?:taking|serving)\s+(?:any\s+)?other\s+clients|no\s+outside\s+consulting)\b[^.;\n]{0,85}\.?/i,
    rationale: "Demands exclusive captive availability without providing employee salary or benefits.",
    redlines: {
      collaborative: "Contractor operates as a non-exclusive independent business free to serve other non-conflicting clients.",
      bilateral: "This engagement is strictly non-exclusive; Contractor may freely perform services for other clients simultaneously so long as agreed milestones are met.",
      counsel: "Exclusivity restrictions on an independent contractor are deleted in full."
    }
  }),
  defineRule({
    id: "NC-10",
    categoryId: "NON_COMPETE",
    title: "Punitive Per-Incident Solicitation Penalty ($25k-$100k)",
    severity: "critical",
    riskPoints: 19,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor"],
    anchorKeywords: ["per solicitation", "per violation", "liquidated penalty of $"],
    pattern: /\b(?:liquidated\s+(?:penalty|damages)\s+of\s+\$\s?(?:10|25|50|100),?000\s+per\s+(?:violation|solicitation|incident))\b[^.;\n]{0,80}\.?/i,
    rationale: "Attaches massive $25,000-$100,000 automatic penalties for incidental emails or routine networking.",
    redlines: {
      collaborative: "Any verified breach is addressed through actual proven damages rather than fixed per-incident penalties.",
      bilateral: "Fixed per-incident solicitation penalties are deleted; recovery requires proof of actual direct pecuniary harm.",
      counsel: "Punitive fixed-dollar solicitation penalties are struck as unenforceable."
    }
  }),
  defineRule({
    id: "NC-11",
    categoryId: "NON_COMPETE",
    title: "Non-Compete Binding Affiliates & Family Members",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["family members", "relatives", "affiliates are bound"],
    pattern: /\b(?:restrictions?\s+(?:also\s+)?bind\s+all\s+(?:family\s+members|relatives|spouses|subcontractors\s+and\s+affiliates))\b[^.;\n]{0,80}\.?/i,
    rationale: "Purports to bind non-signatory family members and unrelated affiliates who never signed the contract.",
    redlines: {
      collaborative: "Obligations under this Agreement bind solely the executing contracting party.",
      bilateral: "Restrictive covenants bind solely the named contracting signatory and never extend to family members or independent third parties.",
      counsel: "Purported restrictions on non-signatory family members and independent affiliates are void."
    }
  }),
  defineRule({
    id: "NC-12",
    categoryId: "NON_COMPETE",
    title: "Overreaching Blue-Pencil Reformation Waiver",
    severity: "low",
    riskPoints: 8,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor"],
    anchorKeywords: ["blue-pencil", "reformed to the maximum extent"],
    pattern: /\b(?:blue-?pencil|judicially\s+reformed\s+to\s+the\s+maximum\s+extent\s+enforceable)\b[^.;\n]{0,85}\.?/i,
    rationale: "Encourages drafting wildly unlawful restrictions on the bet that a court will trim them back later.",
    redlines: {
      collaborative: "All provisions are drafted narrowly to be fully reasonable and lawful as written.",
      bilateral: "Overbroad restraints are severed rather than judicially expanded or rewritten beyond explicit narrow scope.",
      counsel: "Blue-pencil reformation incentives for overbroad restraints are deleted; any unlawful restraint is void in full."
    }
  }),
  defineRule({
    id: "NC-13",
    categoryId: "NON_COMPETE",
    title: "Ban on Hiring Respondents to Public Job Postings",
    severity: "medium",
    riskPoints: 10,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa"],
    anchorKeywords: ["public job posting", "general recruitment", "even if unsolicited"],
    pattern: /\b(?:prohibited\s+from\s+hiring[^.;\n]{0,75}(?:public\s+job\s+posting|general\s+advertisement|even\s+if\s+unsolicited))\b[^.;\n]{0,80}\.?/i,
    rationale: "Penalizes your company if someone from the counterparty applies independently to an ordinary public job listing.",
    redlines: {
      collaborative: "General public job postings and unsolicited inbound applicants are expressly exempt from any non-solicitation clause.",
      bilateral: "Any employee non-solicitation excludes general bona fide advertisements, public job listings, and unsolicited inbound candidates.",
      counsel: "Bans on hiring respondents to public job postings or unsolicited applicants are deleted."
    }
  }),
  defineRule({
    id: "NC-14",
    categoryId: "NON_COMPETE",
    title: "Post-Termination Customer Transition Blackout",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa"],
    anchorKeywords: ["cease communicating", "freeze out", "blackout period"],
    pattern: /\b(?:cease\s+all\s+communications?\s+with\s+mutual|blackout\s+period\s+of\s+\d+\s+months)\b[^.;\n]{0,80}\.?/i,
    rationale: "Prohibits answering routine inquiries or providing support references to former contacts.",
    redlines: {
      collaborative: "Both parties may respond truthfully to unsolicited client inquiries after termination.",
      bilateral: "Nothing bars truthful responses to unsolicited third-party inquiries or independent public communications.",
      counsel: "Post-termination communication blackout restrictions are deleted."
    }
  }),
  defineRule({
    id: "NC-15",
    categoryId: "NON_COMPETE",
    title: "Unlimited Worldwide Geographic Restraint",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor"],
    anchorKeywords: ["worldwide", "anywhere in the world", "entire universe"],
    pattern: /\b(?:restraint|covenant|non-compete|non-solicit)[^.;\n]{0,75}\b(?:worldwide|anywhere\s+in\s+the\s+world|anywhere\s+client\s+does\s+business)\b[^.;\n]{0,75}\.?/i,
    rationale: "Applies a geographic restraint globally across markets where neither party even operates together.",
    redlines: {
      collaborative: "Any narrow customer-specific restriction is limited to direct accounts served during the engagement.",
      bilateral: "Worldwide and unbounded geographic restrictions are deleted; obligations follow named accounts only.",
      counsel: "Global geographic restraints are struck as facially overbroad and void."
    }
  }),
  defineRule({
    id: "NC-16",
    categoryId: "NON_COMPETE",
    title: "Mandatory Disclosure of Future Clients or Employers",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor"],
    anchorKeywords: ["disclose any future employer", "notify client of new contracts"],
    pattern: /\b(?:must\s+disclose\s+(?:any\s+)?(?:future\s+employer|new\s+clients)|notify\s+client\s+in\s+writing\s+before\s+accepting\s+new\s+work)\b[^.;\n]{0,80}\.?/i,
    rationale: "Requires reporting your new jobs or private clients to a former client for years after leaving.",
    redlines: {
      collaborative: "Contractor has no duty to disclose future employers, prospects, or third-party engagements.",
      bilateral: "Post-termination notice of future employers or clients is deleted in its entirety.",
      counsel: "Mandatory reporting of future clients or employment is struck as an invasive restraint."
    }
  }),

  // =========================================================================
  // 9. TERMINATION_CURE (TC-01 .. TC-16)
  // =========================================================================
  defineRule({
    id: "TC-01",
    categoryId: "TERMINATION_CURE",
    title: "Automatic Security Deposit Forfeiture Without Accounting",
    severity: "critical",
    riskPoints: 21,
    annualFeeEstimate: 1500,
    docCategories: ["residential-lease"],
    anchorKeywords: ["security deposit", "forfeited in full", "without itemized"],
    pattern: /\b(?:security\s+deposit\s+(?:shall\s+be\s+)?(?:automatically\s+)?forfeited\s+in\s+full|forfeit(?:s|ed)?\s+(?:the\s+entire\s+)?security\s+deposit)[^.;\n]{0,95}\b(?:without\s+itemized|late\s+payment|notice\s+defect|early\s+move-out)\b[^.;\n]{0,75}\.?/i,
    rationale: "Confiscates your entire refundable security deposit automatically over technical delays without an itemized damage ledger.",
    redlines: {
      collaborative: "Security deposit deductions are strictly limited to documented unpaid rent or verified damage beyond normal wear and tear, with an itemized statement within statutory deadlines.",
      bilateral: "Automatic deposit forfeiture is void; Landlord must return the full security deposit within the statutory timeframe (maximum 21-30 days) accompanied by an itemized receipt-backed accounting of lawful deductions only.",
      counsel: "Automatic security deposit forfeiture is illegal and deleted. Deposit funds remain Resident's property subject solely to receipted, non-wear-and-tear statutory deductions."
    }
  }),
  defineRule({
    id: "TC-02",
    categoryId: "TERMINATION_CURE",
    title: "Zero Cure Period / Hair-Trigger Immediate Termination",
    severity: "high",
    riskPoints: 17,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "nda-contractor", "residential-lease", "custom-agreement"],
    anchorKeywords: ["without cure period", "zero cure", "immediate termination without notice"],
    pattern: /\b(?:immediate\s+termination\s+without\s+(?:notice|cure)|terminate\s+immediately\s+with\s+zero\s+cure\s+period|no\s+right\s+to\s+cure)\b[^.;\n]{0,85}\.?/i,
    rationale: "Lets the counterparty terminate for any trivial slip without giving you a standard 15-to-30-day notice-and-cure opportunity.",
    redlines: {
      collaborative: "Either party shall receive written notice specifying any material breach and at least 30 days (10 business days for payment) to cure.",
      bilateral: "Termination for cause requires detailed written notice and a mutual 30-day cure period (10 business days for undisputed payment defaults) before becoming effective.",
      counsel: "Hair-trigger zero-cure termination is deleted; termination requires verified material breach remaining uncured after 30 days' written notice."
    }
  }),
  defineRule({
    id: "TC-03",
    categoryId: "TERMINATION_CURE",
    title: "Drafter Termination for Convenience Keeping Prepaid Fees",
    severity: "critical",
    riskPoints: 20,
    annualFeeEstimate: 1200,
    docCategories: ["saas-msa", "nda-contractor", "custom-agreement"],
    anchorKeywords: ["terminate for convenience", "without refund of prepaid", "retain all prepaid"],
    pattern: /\b(?:terminate\s+for\s+convenience|terminate\s+without\s+cause)[^.;\n]{0,85}\b(?:without\s+refund|retain\s+all\s+prepaid|zero\s+refund)\b[^.;\n]{0,75}\.?/i,
    rationale: "Permits the vendor to cancel your service unilaterally mid-year for no reason while pocketing your entire prepaid annual fee.",
    redlines: {
      collaborative: "If Vendor terminates for convenience, Vendor will promptly refund all unearned prepaid fees on a pro-rata basis.",
      bilateral: "Neither party may terminate for convenience without refunding unearned fees; any convenience termination by Provider triggers an immediate 100% pro-rata refund of unused prepaid fees plus transition support.",
      counsel: "No-refund termination for convenience is deleted; convenience termination by Provider is barred or requires full pro-rata refund plus migration damages."
    }
  }),
  defineRule({
    id: "TC-04",
    categoryId: "TERMINATION_CURE",
    title: "Full Accelerated Balance Due Upon Early Exit",
    severity: "critical",
    riskPoints: 21,
    annualFeeEstimate: 2400,
    docCategories: ["saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["accelerate", "entire remaining balance", "immediately due and payable"],
    pattern: /\b(?:accelerate\s+all\s+remaining|entire\s+remaining\s+(?:contract\s+)?balance\s+shall\s+become\s+immediately\s+due|100%\s+of\s+unpaid\s+future\s+fees)\b[^.;\n]{0,85}\.?/i,
    rationale: "Demands immediate lump-sum payment of years of unearned future fees upon any breach or exit.",
    redlines: {
      collaborative: "In the event of early termination for cause by Customer, zero future unearned fees are owed and prepaid fees are refunded pro rata.",
      bilateral: "Fee acceleration is deleted for Customer termination due to Provider breach; otherwise, Provider must mitigate damages and reduce any balance to present value of verified net loss.",
      counsel: "Unconditional acceleration of future unearned fees is struck as an unenforceable penalty."
    }
  }),
  defineRule({
    id: "TC-05",
    categoryId: "TERMINATION_CURE",
    title: "Customer Barred From Terminating Even on Material Breach",
    severity: "critical",
    riskPoints: 20,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["customer may not terminate", "waives right to terminate", "non-cancelable regardless"],
    pattern: /\b(?:customer\s+may\s+not\s+terminate|non-cancelable\s+(?:and\s+)?non-refundable\s+regardless\s+of\s+(?:breach|performance))\b[^.;\n]{0,85}\.?/i,
    rationale: "Traps you in a non-cancelable subscription even if the vendor stops delivering the service entirely.",
    redlines: {
      collaborative: "Customer retains the explicit right to terminate for uncured material breach or sustained SLA failure and receive a pro-rata refund.",
      bilateral: "Non-cancelable provisions apply solely absent Vendor breach; Customer may always terminate upon Vendor's uncured material breach with a full pro-rata refund of prepaid fees.",
      counsel: "Absolute bans on Customer termination for Vendor breach are void and deleted."
    }
  }),
  defineRule({
    id: "TC-06",
    categoryId: "TERMINATION_CURE",
    title: "Immediate Data Deletion / Export Lockout at Expiration",
    severity: "critical",
    riskPoints: 20,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["immediately delete", "purge all customer data", "upon expiration without export"],
    pattern: /\b(?:immediately\s+(?:delete|purge|destroy)\s+all\s+(?:customer\s+)?data\s+upon\s+(?:termination|expiration)|no\s+post-termination\s+export)\b[^.;\n]{0,85}\.?/i,
    rationale: "Threatens irreversible destruction of your company records the instant a subscription ends.",
    redlines: {
      collaborative: "Vendor will preserve Customer Data in read-only exportable format for at least 60 days following termination.",
      bilateral: "Upon any termination or expiration, Vendor shall maintain Customer Data securely for a 60-day transition window and provide free self-service export in standard machine-readable formats (CSV/JSON) before certified deletion.",
      counsel: "Immediate post-termination data deletion is prohibited; Vendor guarantees a mandatory 60-to-90-day export window at zero charge."
    }
  }),
  defineRule({
    id: "TC-07",
    categoryId: "TERMINATION_CURE",
    title: "Prohibitive De-Boarding / Data Export Ransom Fee",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 1500,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["export fee", "de-boarding fee", "data extraction fee"],
    pattern: /\b(?:data\s+(?:export|extraction|migration)\s+fee|de-?boarding\s+fee)\b[^.;\n]{0,85}\.?/i,
    rationale: "Charges a ransom fee to let you retrieve your own uploaded business records when leaving.",
    redlines: {
      collaborative: "Standard data export in CSV, JSON, or SQL format at contract end is provided free of charge.",
      bilateral: "All de-boarding and data extraction ransom fees are deleted; Customer may export 100% of Customer Data at zero additional fee during the term and 60-day transition window.",
      counsel: "Data export and de-boarding exit fees are deleted in full."
    }
  }),
  defineRule({
    id: "TC-08",
    categoryId: "TERMINATION_CURE",
    title: "Self-Help Lockout / Utility Shutoff Without Court Order",
    severity: "critical",
    riskPoints: 25,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease"],
    anchorKeywords: ["change the locks", "shut off utilities", "self-help eviction"],
    pattern: /\b(?:change\s+(?:the\s+)?locks|shut\s+off\s+utilities|self-help\s+(?:eviction|repossession)|remove\s+resident'?s?\s+belongings\s+without\s+court)\b[^.;\n]{0,85}\.?/i,
    rationale: "Authorizes illegal self-help lockouts or utility shutoffs bypassing statutory eviction proceedings.",
    redlines: {
      collaborative: "Possession recovery may proceed exclusively through lawful judicial eviction procedures.",
      bilateral: "Self-help lockouts, utility shutoffs, and extra-judicial property seizure are strictly prohibited and deleted.",
      counsel: "Unlawful self-help eviction, lockouts, and utility terminations are void as contrary to statutory law."
    }
  }),
  defineRule({
    id: "TC-09",
    categoryId: "TERMINATION_CURE",
    title: "Abandonment Presumption After 48-72 Hour Travel",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease"],
    anchorKeywords: ["deemed abandoned", "absent for more than"],
    pattern: /\b(?:deemed\s+abandoned|presumed\s+abandoned)\s+if\s+resident\s+is\s+absent\s+for\s+(?:more\s+than\s+)?(?:24|48|72)\s+hours\b[^.;\n]{0,80}\.?/i,
    rationale: "Treats a normal weekend trip as lease abandonment authorizing disposal of your belongings.",
    redlines: {
      collaborative: "Abandonment applies only when rent is unpaid AND clear objective evidence shows permanent vacating after statutory notice.",
      bilateral: "Short absences are never abandonment; abandonment requires both unpaid rent beyond the grace period and written verification or statutory waiting period.",
      counsel: "Short-absence abandonment presumptions (24-72 hours) are deleted as invalid."
    }
  }),
  defineRule({
    id: "TC-10",
    categoryId: "TERMINATION_CURE",
    title: "Asymmetric Cure Windows (60 Days vs 48 Hours)",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "nda-contractor"],
    anchorKeywords: ["48 hours", "72 hours", "vendor shall have 60 days"],
    pattern: /\b(?:(?:vendor|landlord|client)\s+shall\s+have\s+(?:45|60|90)\s+days\s+to\s+cure[^.;\n]{0,65}(?:24|48|72)\s+hours)\b[^.;\n]{0,75}\.?/i,
    rationale: "Gives the drafter 60 days to fix its breaches while declaring you in default after 48 hours.",
    redlines: {
      collaborative: "Cure periods apply symmetrically: 30 days for material operational breaches and 10 business days for undisputed payment issues.",
      bilateral: "Both parties receive identical mutual cure windows of 30 days for operational breaches (10 business days for monetary defaults).",
      counsel: "Asymmetric cure windows are replaced with strictly equal 30-day mutual cure rights."
    }
  }),
  defineRule({
    id: "TC-11",
    categoryId: "TERMINATION_CURE",
    title: "Forfeiture of Earned Milestone Fees on Termination",
    severity: "high",
    riskPoints: 18,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["forfeit all unpaid invoices", "earned fees upon termination"],
    pattern: /\b(?:forfeit\s+(?:all\s+)?(?:unpaid\s+invoices|earned\s+fees)|zero\s+compensation\s+for\s+(?:work\s+performed|partial\s+milestones)\s+upon\s+termination)\b[^.;\n]{0,80}\.?/i,
    rationale: "Allows a client to terminate near completion and refuse payment for weeks of delivered work.",
    redlines: {
      collaborative: "Upon any termination, Client shall pay Contractor pro rata for all verified work performed through the effective termination date.",
      bilateral: "Upon termination for any reason, Client shall promptly settle all earned milestones and pro-rata hours worked prior to termination notice.",
      counsel: "Forfeiture of earned compensation upon termination is void; all delivered services must be paid in full within 15 days."
    }
  }),
  defineRule({
    id: "TC-12",
    categoryId: "TERMINATION_CURE",
    title: "Unpaid Mandatory Post-Termination Transition Labor",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "saas-msa"],
    anchorKeywords: ["transition assistance", "at zero additional charge", "unpaid transition"],
    pattern: /\b(?:provide\s+(?:up\s+to\s+\d+\s+days\s+of\s+)?transition\s+assistance\s+(?:at\s+)?(?:zero\s+additional\s+(?:charge|cost)|free\s+of\s+charge))\b[^.;\n]{0,80}\.?/i,
    rationale: "Conscripts free labor for 30-90 days after terminating your contract.",
    redlines: {
      collaborative: "Reasonable transition assistance requested post-termination shall be billed at Contractor's standard hourly rate.",
      bilateral: "Any post-termination transition assistance beyond basic file handover shall be compensated at Contractor's agreed hourly rates.",
      counsel: "Unpaid post-termination transition labor mandates are deleted."
    }
  }),
  defineRule({
    id: "TC-13",
    categoryId: "TERMINATION_CURE",
    title: "Cross-Default Trap Across Separate Contracts",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "residential-lease", "custom-agreement"],
    anchorKeywords: ["cross-default", "any other agreement"],
    pattern: /\b(?:breach\s+of\s+any\s+other\s+agreement\s+shall\s+constitute\s+(?:an\s+immediate\s+)?default\s+hereunder|cross-default)\b[^.;\n]{0,80}\.?/i,
    rationale: "Allows an unrelated dispute on another contract or facility to trigger termination and acceleration here.",
    redlines: {
      collaborative: "Each agreement stands independently and defaults are evaluated solely under that specific agreement.",
      bilateral: "Cross-default triggers across unrelated agreements are deleted; defaults apply strictly to the specific breached contract.",
      counsel: "Cross-default clauses are struck in full."
    }
  }),
  defineRule({
    id: "TC-14",
    categoryId: "TERMINATION_CURE",
    title: "Termination Triggered by Subjective 'Insecurity'",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["saas-msa", "custom-agreement"],
    anchorKeywords: ["deems itself insecure", "subjective insecurity", "credit downgrade"],
    pattern: /\b(?:deems\s+itself\s+insecure|subjective\s+insecurity|any\s+perceived\s+credit\s+downgrade)\b[^.;\n]{0,80}\.?/i,
    rationale: "Allows abrupt cancellation or collateral demands based on vague rumors rather than actual non-payment.",
    redlines: {
      collaborative: "Termination for financial distress applies solely in the event of actual uncured payment default or formal insolvency proceedings.",
      bilateral: "Subjective insecurity termination triggers are deleted; termination requires uncured payment default or formal bankruptcy filing.",
      counsel: "Insecurity-clause default triggers are deleted in full."
    }
  }),
  defineRule({
    id: "TC-15",
    categoryId: "TERMINATION_CURE",
    title: "Waiver of Constructive Eviction Habitability Exit",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease"],
    anchorKeywords: ["constructive eviction", "uninhabitable"],
    pattern: /\b(?:waives?\s+(?:any\s+)?claim\s+of\s+constructive\s+eviction|must\s+continue\s+paying\s+rent\s+even\s+if\s+uninhabitable)\b[^.;\n]{0,80}\.?/i,
    rationale: "Attempts to keep collecting rent even if the apartment lacks heat, water, or becomes legally uninhabitable.",
    redlines: {
      collaborative: "If the Premises become materially uninhabitable due to no fault of Resident, rent abates and Resident may terminate without penalty.",
      bilateral: "Statutory constructive eviction and casualty rent abatement rights are preserved in full.",
      counsel: "Waivers of constructive eviction and habitability abatement are void."
    }
  }),
  defineRule({
    id: "TC-16",
    categoryId: "TERMINATION_CURE",
    title: "Holdback of Earned Retainer Pending Broad Release",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["nda-contractor", "custom-agreement"],
    anchorKeywords: ["general release", "condition of final payment", "withhold final invoice"],
    pattern: /\b(?:withhold\s+final\s+(?:payment|invoice)|conditioned\s+upon\s+(?:executing|signing)\s+a\s+(?:broad\s+)?general\s+release)\b[^.;\n]{0,80}\.?/i,
    rationale: "Forces you to sign away unrelated legal claims just to collect your earned final paycheck or retainer.",
    redlines: {
      collaborative: "Undisputed earned compensation is payable on schedule without conditioning payment on a general waiver of rights.",
      bilateral: "Final earned fees may never be withheld or conditioned upon signing a general release of claims.",
      counsel: "Coerced general-release conditions on earned compensation are void and unenforceable."
    }
  }),

  // =========================================================================
  // 10. HOA_LIEN_DATA (HL-01 .. HL-16)
  // =========================================================================
  defineRule({
    id: "HL-01",
    categoryId: "HOA_LIEN_DATA",
    title: "Compounding Daily Aesthetic Fines Without Hearing",
    severity: "critical",
    riskPoints: 21,
    annualFeeEstimate: 18250,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["compounding fines", "aesthetic", "without a formal hearing", "$50/day"],
    pattern: /\b(?:compounding\s+fines?\s+of\s+\$\s?\d+\s*\/\s*day|fines?\s+of\s+\$\s?\d+\s*\/\s*day[^.;\n]{0,75}(?:aesthetic|landscaping|without\s+(?:a\s+)?(?:formal\s+)?hearing))\b[^.;\n]{0,85}\.?/i,
    rationale: "Allows the HOA board to compound $50+/day subjective fines into thousands of dollars without due-process notice or an impartial hearing.",
    redlines: {
      collaborative: "Before any fine is assessed, the Owner receives written notice, a 30-day cure period, and an opportunity for an impartial hearing, with fines capped at $25 per violation.",
      bilateral: "Compounding daily fines without hearing are deleted; enforcement requires written specificity, a 30-day cure window, and an impartial hearing, with total fines per violation capped at $100.",
      counsel: "Arbitrary compounding daily aesthetic fines without statutory due-process hearing are void and deleted."
    }
  }),
  defineRule({
    id: "HL-02",
    categoryId: "HOA_LIEN_DATA",
    title: "Automatic Non-Judicial Lien Acceleration & Foreclosure",
    severity: "critical",
    riskPoints: 25,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["non-judicial foreclosure", "continuing lien", "accelerate the entire annual"],
    pattern: /\b(?:accelerate\s+the\s+entire\s+annual|automatic\s+continuing\s+lien|non-judicial\s+foreclosure\s+sale)\b[^.;\n]{0,95}\.?/i,
    rationale: "Turns small disputed HOA fines into an immediate full-year acceleration and threat of losing your home without judicial oversight.",
    redlines: {
      collaborative: "Minor disputed fines may never trigger assessment acceleration or foreclosure; liens require formal judicial review and substantial overdue assessment thresholds.",
      bilateral: "Non-judicial foreclosure and annual assessment acceleration for fines are deleted; aesthetic fines may never support foreclosure, and assessment liens require statutory notice and judicial foreclosure.",
      counsel: "Non-judicial lien foreclosure and acceleration of unaccrued assessments for fines are strictly prohibited and void."
    }
  }),
  defineRule({
    id: "HL-03",
    categoryId: "HOA_LIEN_DATA",
    title: "Architectural Committee Blanket Liability Immunity",
    severity: "high",
    riskPoints: 17,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["architectural review committee", "complete immunity", "arbitrary denials"],
    pattern: /\b(?:(?:the\s+)?architectural\s+(?:review\s+)?committee|arc\s+and\s+board)[^.;\n]{0,85}\b(?:zero\s+liability|blanket\s+liability|complete\s+immunity|arbitrary\s+denials)\b[^.;\n]{0,90}\.?/i,
    rationale: "Insulates the architectural committee from all accountability even when they stall permits indefinitely or act in bad faith.",
    redlines: {
      collaborative: "Architectural applications shall be reviewed reasonably in good faith within 30 days, with written objective criteria for any modification request.",
      bilateral: "Committee immunity for bad-faith delays or arbitrary denials is deleted; complete applications not rejected in writing with objective covenant citations within 30 days are deemed approved.",
      counsel: "Blanket Architectural Committee immunity for arbitrary, bad-faith, or discriminatory action is void."
    }
  }),
  defineRule({
    id: "HL-04",
    categoryId: "HOA_LIEN_DATA",
    title: "Selective / Arbitrary Aesthetic Enforcement Waiver",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["selective enforcement", "sole aesthetic judgment", "waive non-enforcement"],
    pattern: /\b(?:sole\s+aesthetic\s+judgment|selective\s+enforcement\s+shall\s+not\s+constitute\s+a\s+waiver|enforce\s+selectively)\b[^.;\n]{0,80}\.?/i,
    rationale: "Permits targeting individual homeowners over subjective complaints that neighbors routinely get away with.",
    redlines: {
      collaborative: "Architectural and community rules shall be enforced uniformly and based on published written guidelines.",
      bilateral: "Enforcement must be uniform, non-discriminatory, and anchored strictly to objective written standards rather than subjective aesthetic taste.",
      counsel: "Authorizations for selective enforcement and subjective aesthetic taste penalties are deleted."
    }
  }),
  defineRule({
    id: "HL-05",
    categoryId: "HOA_LIEN_DATA",
    title: "Retroactive HOA Rental / Leasing Cap or Ban",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["rental cap", "prohibit leasing", "ban all rentals"],
    pattern: /\b(?:board\s+may\s+(?:retroactively\s+)?(?:ban\s+all\s+rentals|prohibit\s+leasing|impose\s+a\s+rental\s+cap))\b[^.;\n]{0,80}\.?/i,
    rationale: "Lets the board revoke an existing homeowner's right to lease their property without grandfathering or owner supermajority vote.",
    redlines: {
      collaborative: "Any new rental restriction applies prospectively only and requires an affirmative recorded vote of two-thirds of all lot owners.",
      bilateral: "Board-enacted retroactive leasing bans are deleted; existing owners are grandfathered against future rental restrictions absent a supermajority covenant amendment.",
      counsel: "Unilateral retroactive rental bans are void; leasing rights vest at deed acquisition."
    }
  }),
  defineRule({
    id: "HL-06",
    categoryId: "HOA_LIEN_DATA",
    title: "Smart-Gate / ALPR Camera Telemetry Resale",
    severity: "high",
    riskPoints: 17,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants", "residential-lease"],
    anchorKeywords: ["license plate", "alpr", "smart-gate", "camera telemetry"],
    pattern: /\b(?:license\s+plate|alpr|smart-gate|security\s+camera\s+telemetry)\b[^.;\n]{0,80}\b(?:monetize|commercial\s+partners|share\s+without\s+consent|third-party\s+brokers)\b[^.;\n]{0,80}\.?/i,
    rationale: "Allows residential gate cameras and license plate readers to log resident movements and sell location profiles externally.",
    redlines: {
      collaborative: "Gate and camera logs are used solely for physical safety, retained temporarily (30 days max), and never sold or shared commercially.",
      bilateral: "Commercial sharing or monetization of license-plate, gate-entry, or resident movement logs is strictly prohibited; logs auto-purge within 30 days absent an active safety incident.",
      counsel: "External sharing, data brokerage, or non-security use of resident gate/ALPR telemetry is strictly banned."
    }
  }),
  defineRule({
    id: "HL-07",
    categoryId: "HOA_LIEN_DATA",
    title: "Blanket Ban on Solar Panels, EV Chargers, or Signage",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["solar panels", "ev charger", "political sign", "prohibit solar"],
    pattern: /\b(?:prohibit\s+(?:all\s+)?(?:solar\s+panels|ev\s+chargers?|electric\s+vehicle\s+charging|political\s+signs?))\b[^.;\n]{0,80}\.?/i,
    rationale: "Attempts to block homeowner solar, EV infrastructure, and statutory free-expression signage protected by state statutes.",
    redlines: {
      collaborative: "Reasonable placement guidelines apply only where permitted by law and may never prohibit or materially raise the cost of solar or EV installations.",
      bilateral: "Bans on solar equipment, EV charging, or statutorily protected signage are deleted in compliance with solar-access and homeowner rights statutes.",
      counsel: "Unlawful bans on solar, EV charging, and protected civic signage are void."
    }
  }),
  defineRule({
    id: "HL-08",
    categoryId: "HOA_LIEN_DATA",
    title: "Perpetual Developer / Declarant Control Without Turnover",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["declarant", "developer veto", "perpetual control"],
    pattern: /\b(?:declarant|developer)\s+(?:retains?\s+)?(?:perpetual\s+(?:control|veto)|indefinite\s+majority\s+voting\s+power)\b[^.;\n]{0,80}\.?/i,
    rationale: "Keeps the developer permanently in control of dues and contracts long after residents buy the community.",
    redlines: {
      collaborative: "Developer control transitions democratically to elected homeowner board members at the statutory sales threshold.",
      bilateral: "Perpetual Declarant veto and control are deleted; governance transitions to elected Lot Owners upon statutory turnover.",
      counsel: "Indefinite developer board control and unilateral veto rights are void."
    }
  }),
  defineRule({
    id: "HL-09",
    categoryId: "HOA_LIEN_DATA",
    title: "Uncapped Special Assessment Without Member Quorum",
    severity: "high",
    riskPoints: 17,
    annualFeeEstimate: 1200,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["special assessment", "without member vote", "uncapped special"],
    pattern: /\b(?:board\s+may\s+levy\s+(?:unlimited|uncapped)\s+special\s+assessments?\s+without\s+(?:a\s+)?(?:member|owner)\s+vote)\b[^.;\n]{0,80}\.?/i,
    rationale: "Lets a small board impose multi-thousand-dollar surprise special assessments overnight with zero homeowner vote.",
    redlines: {
      collaborative: "Any non-emergency special assessment exceeding 5% of the annual budget requires an affirmative majority vote of Lot Owners.",
      bilateral: "Unilateral uncapped special assessments are deleted; special assessments above 5% of annual budget require homeowner quorum and majority approval except for documented life-safety emergencies.",
      counsel: "Board authority to levy uncapped special assessments without homeowner ratification is struck."
    }
  }),
  defineRule({
    id: "HL-10",
    categoryId: "HOA_LIEN_DATA",
    title: "Landlord / HOA Lien on Personal Property & Vehicles",
    severity: "high",
    riskPoints: 16,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "hoa-covenants"],
    anchorKeywords: ["lien on all personal property", "household goods", "seize vehicles"],
    pattern: /\b(?:contractual\s+lien\s+on\s+(?:all\s+)?(?:resident|owner)'?s?\s+personal\s+property|seize\s+(?:household\s+goods|vehicles)\s+for\s+unpaid)\b[^.;\n]{0,80}\.?/i,
    rationale: "Grants a sweeping seizure lien over furniture, computers, and personal belongings for disputed rent or HOA charges.",
    redlines: {
      collaborative: "No contractual security lien attaches to personal household belongings, tools of trade, or vehicles.",
      bilateral: "Contractual liens on personal property, electronics, household furnishings, and vehicles are deleted in full.",
      counsel: "Personal property distress and seizure liens are void and severed."
    }
  }),
  defineRule({
    id: "HL-11",
    categoryId: "HOA_LIEN_DATA",
    title: "Unannounced Towing on Assigned Resident Spaces",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 300,
    docCategories: ["hoa-covenants", "residential-lease"],
    anchorKeywords: ["tow without notice", "booting", "towed at owner's expense without warning"],
    pattern: /\b(?:tow(?:ed)?\s+at\s+(?:owner|resident)'?s?\s+expense\s+without\s+(?:prior\s+)?(?:notice|warning)|immediate\s+booting\s+without\s+notice)\b[^.;\n]{0,80}\.?/i,
    rationale: "Exposes registered resident cars to predatory $350+ towing over faded stickers or temporary registration lapses.",
    redlines: {
      collaborative: "Except for blocked fire lanes or unauthorized spaces, a 48-hour written tag notice precedes any towing of a registered resident vehicle.",
      bilateral: "Registered vehicles parked in assigned spaces shall receive at least 48 hours' written notice prior to any towing, except when blocking emergency access.",
      counsel: "No-notice predatory towing and booting of resident vehicles in assigned spaces is prohibited."
    }
  }),
  defineRule({
    id: "HL-12",
    categoryId: "HOA_LIEN_DATA",
    title: "Smart-Home Utility & Behavioral Data Brokerage",
    severity: "high",
    riskPoints: 15,
    annualFeeEstimate: 0,
    docCategories: ["residential-lease", "hoa-covenants"],
    anchorKeywords: ["smart thermostat", "smart-lock access logs", "sell behavioral"],
    pattern: /\b(?:smart[- ]lock\s+access\s+logs|smart\s+thermostat|occupancy\s+sensors?)[^.;\n]{0,75}\b(?:share\s+with\s+affiliates|commercial\s+marketing|monetize)\b[^.;\n]{0,80}\.?/i,
    rationale: "Turns smart apartment locks and thermostats into household surveillance streams monetized by third parties.",
    redlines: {
      collaborative: "Smart-home device telemetry remains private to the resident and is never shared externally or used for non-maintenance monitoring.",
      bilateral: "Access logs and smart-home sensor data are strictly private, encrypted locally or access-restricted solely to emergency maintenance, and never monetized.",
      counsel: "Commercialization or surveillance sharing of smart-lock and occupancy sensor telemetry is prohibited."
    }
  }),
  defineRule({
    id: "HL-13",
    categoryId: "HOA_LIEN_DATA",
    title: "Arbitrary Capital Contribution / Transfer Flip Fee",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["transfer fee", "capital contribution fee", "1% of sale price"],
    pattern: /\b(?:resale\s+transfer\s+fee|working\s+capital\s+contribution\s+of\s+(?:1%|2%|\$\s?[\d,]+))\b[^.;\n]{0,80}\.?/i,
    rationale: "Extracts an undisclosed percentage or multi-thousand-dollar toll every time a homeowner sells or refinances.",
    redlines: {
      collaborative: "Administrative resale document fees are capped at actual clerical cost not to exceed $150.",
      bilateral: "Percentage-based resale transfer taxes and excessive working-capital flip fees are deleted; administrative transfer fees are capped at verified clerical costs (max $150).",
      counsel: "Private percentage resale transfer fees and unbudgeted capital flip tolls are void."
    }
  }),
  defineRule({
    id: "HL-14",
    categoryId: "HOA_LIEN_DATA",
    title: "Unlimited Board Entry Onto Private Residential Lots",
    severity: "high",
    riskPoints: 14,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["enter any private lot", "without homeowner consent", "unannounced lot inspection"],
    pattern: /\b(?:enter\s+(?:upon\s+)?any\s+(?:private\s+)?lot[^.;\n]{0,65}(?:without\s+(?:owner|homeowner)\s+consent|unannounced\s+inspection))\b[^.;\n]{0,80}\.?/i,
    rationale: "Lets board members or vendors trespass onto private fenced yards without advance notice or consent.",
    redlines: {
      collaborative: "Non-emergency exterior maintenance inspections require 48 hours' advance written notice to the Lot Owner.",
      bilateral: "Entry onto private fenced lots requires 48 hours' advance written notice and owner coordination except for imminent life-safety emergencies.",
      counsel: "Unannounced entry onto private residential lots without consent is deleted."
    }
  }),
  defineRule({
    id: "HL-15",
    categoryId: "HOA_LIEN_DATA",
    title: "Deprivation of Gate / Amenity Access Over Fine Dispute",
    severity: "medium",
    riskPoints: 12,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["deactivate gate", "revoke gate access", "suspend utility or gate"],
    pattern: /\b(?:deactivate\s+(?:gate|transponder|fob)\s+access|suspend\s+(?:keyfob|gate)\s+entry)\s+(?:over\s+any\s+disputed\s+fine|without\s+hearing)\b[^.;\n]{0,80}\.?/i,
    rationale: "Locks homeowners out of their own driveway gate or neighborhood facilities to coerce payment of disputed fines.",
    redlines: {
      collaborative: "Vehicular and pedestrian access to a Lot Owner's residence may never be deactivated or obstructed over fine or billing disputes.",
      bilateral: "Residential gate transponders and ingress/egress access shall never be deactivated during any dispute.",
      counsel: "Deactivation of residential access fobs or entry gates as debt-collection leverage is strictly prohibited."
    }
  }),
  defineRule({
    id: "HL-16",
    categoryId: "HOA_LIEN_DATA",
    title: "Waiver of HOA Financial Records & Open-Meeting Rights",
    severity: "medium",
    riskPoints: 11,
    annualFeeEstimate: 0,
    docCategories: ["hoa-covenants"],
    anchorKeywords: ["waives inspection of financial", "closed executive session", "records inspection"],
    pattern: /\b(?:waives?\s+(?:any\s+)?right\s+to\s+inspect\s+(?:association\s+)?financial\s+records|board\s+budgets?\s+remain\s+confidential)\b[^.;\n]{0,80}\.?/i,
    rationale: "Blocks homeowners from auditing how their dues are spent or questioning self-dealing vendor contracts.",
    redlines: {
      collaborative: "Lot Owners retain full statutory rights to inspect Association financial records, vendor bids, and meeting minutes.",
      bilateral: "Owner rights to inspect Association financial ledgers, reserve studies, and open-meeting minutes are preserved in full.",
      counsel: "Restrictions or waivers impairing statutory HOA financial transparency and records inspection are void."
    }
  })
];

export const CLAUSE_RULES = Object.freeze(RAW_RULES);

/**
 * Returns the exact number of rules registered per locked CategoryId.
 * @returns {Record<string, number>}
 */
export function getRuleCountsByCategory() {
  const counts = {};
  for (const catId of CATEGORY_IDS) {
    counts[catId] = 0;
  }
  for (const rule of CLAUSE_RULES) {
    if (Object.prototype.hasOwnProperty.call(counts, rule.categoryId)) {
      counts[rule.categoryId] += 1;
    }
  }
  return counts;
}
