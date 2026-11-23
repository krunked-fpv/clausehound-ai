/**
 * ClauseHound Local — Curated Contract Specimen Folio
 * Covers all 5 DOC_CATEGORY_ENUM categories with realistic multi-article agreements.
 */

import { DOC_CATEGORY_ENUM } from "./clause-rules.js";

const VALID_DOC_CATEGORIES = new Set(DOC_CATEGORY_ENUM);

const RAW_SPECIMENS = [
  {
    id: "sterling-lease",
    title: "The Sterling Lofts Residential Lease",
    docCategory: "residential-lease",
    subtitle: "12-Month Urban Loft Lease • $1,860/yr Hidden Junk Fees & Rollover Cliff",
    parties: "Sterling Lofts Residential Holdings LLC (Landlord) & Resident",
    effectiveDate: "2026-11-01",
    summary:
      "Multi-article apartment lease embedding $155/mo ($1,860/yr) in mandatory unbundled junk fees, a narrow 60-to-65-day evergreen rollover cliff, unannounced landlord entry, one-way legal fee shifting, and automatic deposit forfeiture.",
    text: `THE STERLING LOFTS RESIDENTIAL LEASE AGREEMENT
Property: The Sterling Lofts, Unit 412B, 840 Foundry Avenue
Landlord: Sterling Lofts Residential Holdings LLC ("Landlord")
Resident: Incoming Leaseholder ("Resident")

ARTICLE 1. PREMISES AND OCCUPANCY
Landlord leases to Resident the residential dwelling unit designated above ("Premises") solely for private residential occupancy. Resident acknowledges having viewed a model unit and accepts the Premises in accordance with building community guidelines.

ARTICLE 2. INITIAL TERM AND EVERGREEN ROLLOVER CLIFF
The Initial Term of this Lease shall run for twelve (12) months commencing on the Move-In Date. Upon expiration of the Initial Term, this Lease shall automatically renew for another full 12-month fixed term unless written notice of non-renewal is delivered via certified mail strictly during the narrow window between 65 and 60 days prior to expiration. Any notice sent earlier than 65 days before expiration is deemed void if delivered before the notice window opens, and holding over even one day incurs a holdover rate of 200% of Base Rent.

ARTICLE 3. BASE RENT AND MANDATORY ANCILLARY FEE SCHEDULE
Base monthly rent for the Premises is $2,450.00 per month ("Base Rent"), due on the first day of each calendar month. In addition to Base Rent, Resident shall pay every recurring ancillary charge listed below as Additional Rent:
(a) Valet Trash Surcharge: Resident shall pay a mandatory $45/mo Valet Trash Service Fee regardless of usage or availability of building dumpsters.
(b) Resident Technology & Access Package: Resident is enrolled in a mandatory $65/mo Smart-Lock & Package Locker Technology Bundle as a condition of occupancy.
(c) Monthly Administrative Billing Fee: Landlord assesses a $18/mo Monthly Administrative Billing Fee for ledger processing and invoice generation.
(d) Pest Control and Amenity Recovery: A non-optional $27/mo Pest Control and Amenity Surcharge applies each billing cycle regardless of seasonal amenity closures.
All electronic portal payments incur an additional online portal fee unless paid by cashier's check in person during limited leasing office hours.

ARTICLE 4. SECURITY DEPOSIT AND AUTOMATIC FORFEITURE
Upon execution, Resident shall deposit $2,450.00 as a Security Deposit. Resident agrees that the entire Security Deposit shall be automatically forfeited in full upon any late payment, notice defect, or early move-out without itemized accounting or wear-and-tear reconciliation.

ARTICLE 5. RIGHT OF ENTRY AND SMART-HOME TELEMETRY
Landlord, management, or any designated contractor or showing agent may enter the Premises at any time without prior notice for routine inspections, preventative maintenance, marketing showings, or management convenience. Landlord may further inspect and retain smart-lock access logs and occupancy sensors and share with affiliates or commercial marketing partners without supplemental resident notice.

ARTICLE 6. HABITABILITY, REPAIRS, AND EXCULPATION
Resident accepts Premises "as-is" and waives all implied warranties of habitability and quiet enjoyment to the maximum extent permitted by law. Landlord shall not be liable for any damage or loss to Resident's personal property arising from plumbing leaks, burst pipes, roof leaks, or electrical failures. Resident shall indemnify and hold Landlord harmless against any common area or building injury or property damage involving Resident, Resident's guests, or delivery couriers.

ARTICLE 7. SUBLEASING, PARKING, AND AMENITIES
Subletting, subleasing, or occupant replacement is strictly prohibited under all circumstances. Landlord reserves the right to close or eliminate any amenities, fitness facilities, or rooftop spaces without rent abatement. Registered vehicles parked without visible pass placement may be towed at owner's expense without prior notice.

ARTICLE 8. DEFAULT, SELF-HELP, AND ONE-WAY LEGAL FEE SHIFT
Any failure to pay Base Rent or Additional Rent within three (3) days triggers immediate termination with zero cure period, and Landlord may accelerate all remaining rent due under the term. In any dispute arising from this Lease, Resident shall pay all Landlord's reasonable attorneys' fees and collection costs regardless of outcome, while Landlord bears no liability for Resident's legal fees. Resident knowingly waives trial by jury and waives any right to bring claims in small claims court or participate in a class action.

ARTICLE 9. NON-DISPARAGEMENT AND HOUSE RULES
House rules and community policies may be amended at any time in Landlord's sole discretion from time to time and become binding upon posting in the lobby. Resident is prohibited from posting any negative review or public criticism regarding Sterling Lofts management online or offline.

ARTICLE 10. GOVERNING LAW AND ENTIRE AGREEMENT
This Lease constitutes the complete agreement between the parties. All policies posted separately at the leasing office are incorporated herein by reference. Executed on the date below.`
  },

  {
    id: "apex-nda",
    title: "Apex Creative Studio NDA & Contractor Rider",
    docCategory: "nda-contractor",
    subtitle: "Independent Contractor & NDA Rider • Benchmark Indemnity, Toolkit Grab & Perpetual Non-Solicit",
    parties: "Apex Creative Studio Inc. (Client) & Independent Contractor (Contractor)",
    effectiveDate: "2026-11-01",
    summary:
      "Services rider containing the benchmark one-way uncapped indemnification clause, disguised work-for-hire capture of pre-existing toolkits, perpetual non-solicitation, moral rights waiver, and ex parte bondless injunctions.",
    text: `APEX CREATIVE STUDIO INC.
MUTUAL-STYLE NON-DISCLOSURE AGREEMENT & INDEPENDENT CONTRACTOR RIDER

This Non-Disclosure and Independent Contractor Services Rider ("Agreement") is entered into between Apex Creative Studio Inc. ("Client") and the undersigned specialist ("Contractor").

SECTION 1. SCOPE OF SERVICES AND ACCEPTANCE
Contractor shall perform specialized design, software engineering, and strategic advisory services set forth in applicable Statements of Work ("Services"). Final payment and acceptance of any milestone remain contingent upon Client's sole and absolute discretion, and Client may withhold final invoice settlement pending Contractor's execution of a broad general release.

SECTION 2. DISGUISED WORK-FOR-HIRE & BACKGROUND TOOLKIT ASSIGNMENT
All inventions, software modules, background tools, pre-existing code libraries, frameworks, design systems, and generalized know-how conceived, utilized, or referenced by Contractor in connection with the Services shall be deemed work-made-for-hire and become Client's sole and exclusive property, and Contractor hereby irrevocably assigns all worldwide right, title, and interest therein immediately upon creation irrespective of payment. Generalized know-how, methodologies, and architectural techniques utilized during the engagement become the exclusive property of Client, and Contractor is prohibited from reusing them.

SECTION 3. IRREVOCABLE MORAL RIGHTS WAIVER AND POWER OF ATTORNEY
Contractor irrevocably waives all moral rights, attribution rights, and rights of integrity worldwide in connection with all Deliverables and background components. Contractor further grants Client an irrevocable power of attorney and appoints Client as attorney-in-fact to execute patent and copyright assignment filings on Contractor's behalf without compensation cap.

SECTION 4. CONFIDENTIALITY AND RESIDUALS ASYMMETRY
Contractor's confidentiality obligations shall survive in perpetuity forever, even if publicly known through general industry publication. Notwithstanding the foregoing, Client and its affiliates shall remain free to exploit any residuals or concepts retained in unaided memory for any purpose without restriction or royalty.

SECTION 5. ONE-WAY UNCAPPED INDEMNIFICATION
Contractor agrees to defend, indemnify, and hold harmless Client against any and all claims, damages, and uncapped liabilities arising out of services. This indemnification obligation extends to all Client affiliates, parents, officers, successors, and assigns, covers Client's sole or partial negligence, and requires Contractor to advance all defense costs immediately upon demand even for threatened or merely alleged claims. Client retains sole control of the defense and may settle any claim at Contractor's expense without Contractor's consent.

SECTION 6. PERPETUAL NON-SOLICITATION AND NON-COMPETE RESTRAINTS
Contractor shall not, in perpetuity or for 5 years worldwide, directly or indirectly solicit, divert, or work with any current, former, or prospective client, sales pipeline contact, or employee of Client, even if responding to a general public job posting. Violation triggers liquidated penalty of $50,000 per solicitation incident, and the restricted period shall be tolled and automatically extended during any alleged breach. Contractor further agrees to work exclusively for Client during active milestones with no outside consulting and must disclose any future employer or new contracts for three (3) years post-termination.

SECTION 7. TERMINATION AND UNPAID TRANSITION
Client may terminate this Agreement immediately with zero cure period or terminate for convenience at any time, whereupon Contractor shall forfeit all unpaid invoices and earned fees for partial milestones upon termination and provide up to 60 days of transition assistance at zero additional charge.

SECTION 8. UNILATERAL EQUITABLE REMEDIES AND CAPTIVE VENUE
In the event of any threatened breach, Client may obtain ex parte temporary restraining orders and injunctive relief without posting any bond and without proving actual damages. Exclusive venue shall lie solely in Client's home jurisdiction, and Contractor waives formal service of process and consents to service of summons by ordinary email alone.`
  },

  {
    id: "cobalt-saas-msa",
    title: "CloudPulse Enterprise SaaS Vendor MSA",
    docCategory: "saas-msa",
    subtitle: "36-Month Enterprise SaaS MSA • 12% Escalator, $100 Liability Cap & URL Terms Drift",
    parties: "CloudPulse Systems Corp. (Vendor) & Enterprise Customer (Customer)",
    effectiveDate: "2026-11-01",
    summary:
      "B2B SaaS agreement locking customers into 36-month auto-renewals with a narrow 60-to-90-day cancellation cliff, silent 12% annual uplifts, $100 vendor liability cap, uncapped customer indemnity, and silent URL amendments.",
    text: `CLOUDPULSE SYSTEMS CORP.
ENTERPRISE SAAS MASTER SUBSCRIPTION AGREEMENT

This Master Subscription Agreement ("Agreement") governs Customer's access to the CloudPulse cloud analytics and workflow automation platform ("Platform") provided by CloudPulse Systems Corp. ("Vendor").

1. TERM, 36-MONTH AUTO-RENEWAL, AND CANCELLATION CLIFF
The Initial Subscription Term is thirty-six (36) months from the Order Form Effective Date. Thereafter, this Agreement shall automatically renew for successive 36-month terms. Non-renewal is valid only if Customer delivers signed written cancellation via certified mail strictly during the narrow 60-to-90-day cancellation window prior to expiration. Customer may not reduce committed seat counts upon renewal, and adding any additional seat or module shall reset the term across the entire Agreement.

2. FEES, SILENT 12% UPLIFT ESCALATOR, AND NO-SETOFF BILLING
Subscription fees are non-cancelable and non-refundable regardless of vendor breach or platform performance. Vendor may increase subscription fees automatically by 12% per year on each anniversary without advance notice or Customer approval, and may impose regulatory cost-recovery surcharges and account maintenance fees at any time. All invoices must be paid without setoff, deduction, or withholding, and Vendor may suspend all access immediately even during a billing dispute.

3. UNILATERAL URL TERMS AND SLA DRIFT
Vendor may modify this Agreement, the Service Level Agreement (SLA), and Acceptable Use Policy at any time by updating an online URL on Vendor's public website, and Customer's continued use constitutes binding acceptance of all modified terms. Vendor may remove or deprecate any features or functionality at any time without liability or refund, and may reduce uptime commitments in its sole discretion.

4. CUSTOMER CONTENT, AI MODEL TRAINING, AND TELEMETRY MONETIZATION
Customer grants Vendor a worldwide, perpetual, irrevocable license to ingest Customer Data, uploaded files, and user prompts to train, fine-tune, and improve Vendor's shared artificial intelligence and machine learning models. Vendor shall further own all generated reports and usage telemetry and may sell or commercialize aggregated telemetry to third parties without compensation to Customer.

5. ASYMMETRIC MICRO-CAP ON VENDOR LIABILITY ($100 CAP)
TO THE MAXIMUM EXTENT PERMITTED BY LAW, VENDOR'S MAXIMUM AGGREGATE LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED $100, WHILE CUSTOMER'S INDEMNIFICATION AND PAYMENT OBLIGATIONS REMAIN COMPLETELY UNCAPPED. Vendor disclaims all liability for any data breach, security incident, or acts and omissions of its third-party hosting cloud providers and subprocessors. Customer's sole and exclusive remedy for any Platform failure is to discontinue use and terminate without refund. Any claim by Customer must be brought within 60 days or be forever barred.

6. UNCAPPED CUSTOMER INDEMNIFICATION
Customer shall defend, indemnify, and hold Vendor harmless from all uncapped third-party claims, regulatory fines, and data losses arising from Customer's use of the Platform or regulatory inquiries, including indirect, consequential, and lost-profit damages, with zero cap and perpetual survival.

7. TERMINATION, DATA PURGE, AND EXIT RANSOM
Vendor may terminate for convenience upon 15 days' notice and retain all prepaid annual fees with zero refund. Upon any expiration or termination, Vendor may immediately delete and purge all Customer Data upon expiration without post-termination export, unless Customer pays a mandatory data extraction and de-boarding fee of $4,500 within five (5) business days.

8. FORCE MAJEURE, ASSIGNMENT, AND ARBITRATION
During any Force Majeure event excusing Vendor uptime, Customer's payment obligations shall not be excused. Vendor may assign this Agreement freely without consent while Customer is prohibited from assigning. All Customer claims are subject to mandatory binding arbitration with Customer waiving any class action or jury trial.`
  },

  {
    id: "oakridge-hoa",
    title: "Oakridge Estates HOA Covenants & Fines Addendum",
    docCategory: "hoa-covenants",
    subtitle: "HOA Covenants Addendum • $50/day Compounding Fines, Non-Judicial Lien & $89/mo Fiber Bundle",
    parties: "Oakridge Estates Community Association (Association) & Lot Owner (Owner)",
    effectiveDate: "2026-11-01",
    summary:
      "Homeowners association covenants addendum establishing $50/day compounding aesthetic fines without hearing, automatic non-judicial lien foreclosure, architectural committee immunity, $89/mo bundled telecom fee, and biased arbitration.",
    text: `OAKRIDGE ESTATES COMMUNITY ASSOCIATION
SUPPLEMENTAL COVENANTS, FINES, AND ASSESSMENT ADDENDUM

This Covenants, Conditions, and Restrictions Addendum ("Addendum") binds every Lot Owner ("Owner") within Oakridge Estates ("Community").

SECTION 1. MANDATORY BULK TELECOM & AMENITY BUNDLE
Every Lot Owner is charged a mandatory $89/mo bundled cable television and bulk fiber internet fee as a continuing assessment even if disconnected, unused, or replaced by an independent service provider. The Board may adjust fees at any time and levy unlimited special assessments without a member vote.

SECTION 2. ARCHITECTURAL CONTROL AND BLANKET IMMUNITY
No exterior paint, landscaping, fencing, solar panels, or EV charger installation may occur without prior written approval; the Association reserves authority to prohibit all solar panels, electric vehicle charging equipment, and yard political signs. The Architectural Review Committee and Board shall enjoy blanket liability protection and complete immunity for arbitrary denials, unreasonable delays, or property damage resulting from committee review.

SECTION 3. COMPOUNDING $50/DAY AESTHETIC VIOLATION FINES
The Board or management agent may levy compounding fines of $50/day for any subjective aesthetic, lawn, trim, or exterior appearance infraction without a formal hearing or prior cure period. The Board may enforce rules under its sole aesthetic judgment, and selective enforcement shall not constitute a waiver.

SECTION 4. AUTOMATIC NON-JUDICIAL LIEN ACCELERATION AND FORECLOSURE
Any unpaid fines, administrative charges, or bundled fees automatically accelerate the entire annual assessment budget and create an automatic continuing lien against the Owner's Lot subject to non-judicial foreclosure sale without judicial hearing. The Association further claims a contractual lien on all owner's personal property and vehicles, and may deactivate gate transponder access over any disputed fine without hearing.

SECTION 5. LOT ENTRY, TOWING, AND RETROACTIVE RENTAL BANS
Association inspectors may enter upon any private lot for unannounced inspection without homeowner consent. Vehicles parked on street margins or driveways with expired tags may be towed at owner's expense without prior notice. The Board may retroactively ban all rentals or impose a rental cap at any time without grandfathering existing Owners.

SECTION 6. GATE ALPR TELEMETRY AND RECORDS WAIVER
Smart-gate license plate cameras and security camera telemetry may be retained indefinitely and shared with commercial partners without consent. Every Owner waives any right to inspect Association financial records or attend closed executive budget sessions.

SECTION 7. MANDATORY BINDING ARBITRATION AND FEE SHIFTING
All Owner claims against the Association or its management company must be submitted to binding arbitration before an arbitrator selected solely by the Association with mandatory one-way fee shifting requiring the Owner to pay all Association legal fees and advance all arbitrator compensation. Any Owner making an unsuccessful challenge to any fine or assessment shall pay all Association legal fees regardless of good faith, and waives all right of appeal and small claims court access.`
  },

  {
    id: "custom-draft",
    title: "Custom Agreement Intake & Quick Clause Check",
    docCategory: "custom-agreement",
    subtitle: "Clean Baseline Workspace • Paste Any Contract or Upload .TXT / .MD / .DOCX / .PDF Locally",
    parties: "Party A (Drafting Party) & Party B (Reviewing Counterparty)",
    effectiveDate: "2026-11-01",
    summary:
      "Clean, balanced baseline agreement intake template ready for direct editing, copy-paste review, or local document upload inside the Faraday Air-Gap.",
    text: `CUSTOM AGREEMENT INTAKE & QUICK CLAUSE CHECK
Status: Clean Bilateral Baseline (0 Active Traps Detected)

HOW TO USE THIS WORKBENCH LOCALLY (FARADAY AIR-GAP PROTECTED)
1. Paste any residential lease, contractor NDA, SaaS order form, employment offer, or HOA addendum directly into this editor, OR drop a local .txt, .md, .docx, or text-layer .pdf file using the Specimen & File Drawer.
2. Everything executes 100% inside your browser tab with 0.0 KB outbound network transmission.
3. Click any highlighted clause in the Left Folio to inspect its legal rationale, swap between Collaborative / Bilateral / Counsel redline tones, or excise recurring junk fees for instant annualized savings telemetry.

SAMPLE BILATERAL CLAUSE BASELINE (CLEAN REFERENCE)
Section 1. Term and Renewal. This Agreement takes effect on the Effective Date for a 12-month Initial Term and converts to month-to-month thereafter, terminable by either party on 30 days' written email notice.
Section 2. Mutual Indemnification. Each party mutually indemnifies the other solely for verified third-party claims directly caused by its own gross negligence or willful misconduct, capped at fees paid in the preceding 12 months.
Section 3. Transparent Pricing. All recurring fees are explicitly itemized in the Order Schedule with zero undisclosed administrative, convenience, or junk surcharges.
Section 4. Mutual Dispute Resolution. Disputes shall proceed in a neutral local court of competent jurisdiction (including small claims court), with each party retaining full statutory remedies.`
  }
];

export const SPECIMENS = Object.freeze(
  RAW_SPECIMENS.map((spec) => Object.freeze({ ...spec }))
);

/**
 * Retrieves a specimen document by its exact id, or null if not found.
 * @param {string} id
 * @returns {object | null}
 */
export function getSpecimenById(id) {
  if (typeof id !== "string" || id.trim().length === 0) return null;
  const found = SPECIMENS.find((spec) => spec.id === id);
  return found || null;
}

/**
 * Lists curated specimens, optionally filtered by a valid DOC_CATEGORY_ENUM value.
 * @param {string} [docCategory]
 * @returns {Array<object>}
 */
export function listSpecimens(docCategory) {
  if (typeof docCategory === "string" && docCategory.length > 0) {
    if (!VALID_DOC_CATEGORIES.has(docCategory)) return [];
    return SPECIMENS.filter((spec) => spec.docCategory === docCategory);
  }
  return [...SPECIMENS];
}
