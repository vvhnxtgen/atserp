/* Printable documents — letterhead, TRF, quotation, tax invoice and internal PO.
   Rendered into a new window and printed (Save as PDF). Styles are ported 1:1
   from the single-file HTML version so documents look identical. */
import { fmtD, inWords, inr } from './format';
import { LOGO_B64 } from './logo';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = (s) => esc(s).replace(/\n/g, '<br>');

export const PD_CSS = `
:root{--disp:'Bebas Neue','Arial Narrow',sans-serif;--cond:'Barlow Condensed',sans-serif;--body:'Barlow',system-ui,sans-serif;
--navy-900:#0A2240;--navy-800:#0E2B50;--gold:#C9A227;--gold-deep:#A8871F}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff}
.pdoc{font-family:var(--body);color:#1A2740;font-size:12.5px;line-height:1.45;max-width:820px;margin:0 auto;padding:18px}
.pd-head{display:flex;align-items:center;gap:16px;border-bottom:3px solid var(--navy-900);padding-bottom:12px;position:relative}
.pd-head::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:2px;background:var(--gold)}
.pd-logo{width:92px;height:auto;flex:none}
.pd-name{font-family:var(--disp);font-size:29px;letter-spacing:.04em;color:var(--navy-900);line-height:1}
.pd-tag{font-family:var(--cond);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-deep);margin-top:4px}
.pd-addr{margin-left:auto;text-align:right;font-size:10.5px;color:#54637E;line-height:1.5;max-width:250px}
.pd-title{font-family:var(--disp);text-align:center;font-size:21px;letter-spacing:.14em;color:var(--navy-900);margin:16px 0 4px;text-transform:uppercase}
.pd-sub{text-align:center;font-family:var(--cond);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#7A889F;margin-bottom:14px}
.pd-meta{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:12px}
.pd-meta table td{padding:2px 10px 2px 0;font-size:12px;vertical-align:top}
.pd-meta table td:first-child{font-family:var(--cond);font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#54637E;font-size:11px;white-space:nowrap}
.pd-box{border:1px solid #B9C4D6;border-radius:6px;padding:10px 12px;margin-bottom:12px}
.pd-box h5{font-family:var(--cond);font-weight:600;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--navy-800);margin-bottom:6px;border-bottom:1px solid #E3E9F2;padding-bottom:4px}
.pd-tbl{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
.pd-tbl th{background:var(--navy-900);color:#fff;font-family:var(--cond);font-weight:600;letter-spacing:.09em;text-transform:uppercase;font-size:10.5px;padding:7px 9px;text-align:left;border:1px solid var(--navy-900)}
.pd-tbl td{border:1px solid #B9C4D6;padding:7px 9px;vertical-align:top}
.pd-tbl .r{text-align:right;white-space:nowrap}
.pd-tot td{font-weight:600}
.pd-grand td{background:#F3E9C8;font-weight:700;font-size:13px;border-color:#B9C4D6}
.pd-words{font-size:11.5px;font-style:italic;color:#37455E;margin:6px 0 14px}
.pd-sign{display:flex;justify-content:space-between;gap:30px;margin-top:44px}
.pd-sign div{flex:1;text-align:center;font-size:11.5px}
.pd-sign div span{display:block;border-top:1px solid #7A889F;padding-top:6px;font-family:var(--cond);letter-spacing:.1em;text-transform:uppercase;font-size:10.5px;color:#54637E;margin-top:34px}
.pd-foot{margin-top:22px;border-top:1px solid #C7D1E0;padding-top:8px;font-size:9.8px;color:#7A889F;text-align:center;line-height:1.5}
.pd-note{font-size:11px;color:#54637E;margin-top:8px}
.pd-note b{color:var(--navy-800)}
.pd-badge{display:inline-block;border:1.5px solid var(--gold-deep);color:var(--gold-deep);font-family:var(--cond);font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-size:10px;padding:2px 9px;border-radius:99px}
/* ---- Official ATS form styling (blue, matches printed QF formats) ---- */
.tf{color:#2E3192;font-size:12px;line-height:1.4;font-family:var(--body)}
.tf-frame{border:2.6px solid #2E3192;border-radius:16px;padding:12px 15px}
.tf-title{text-align:center;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:19.5px;letter-spacing:.045em;margin:0 0 6px}
.tf-title u{text-underline-offset:4px;text-decoration-thickness:2.2px}
.tf-head{display:flex;align-items:center;margin-bottom:2px}
.tf-code{font-weight:700;font-size:11.5px;width:32%}
.tf-logo{height:44px;width:auto;display:block;margin:0 auto}
.tf-headr{width:32%}
.tf-row2{display:flex;align-items:baseline;margin:7px 0 6px}
.tf-row2>div{width:33.33%}
.tf-red{color:#D21F26;font-weight:800;font-size:15.5px;letter-spacing:.04em}
.tf-sec{font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:14.5px;text-align:center;letter-spacing:.03em}
.tf table{width:100%;border-collapse:collapse}
.tf th,.tf td{border:1.7px solid #2E3192;padding:5px 8px;font-size:11.8px;vertical-align:top;color:#2E3192}
.tf th{font-family:Arial,Helvetica,sans-serif;font-weight:700;text-align:center;padding:6px 6px}
.tf td.c{text-align:center}
.tf-notes{font-size:11.2px;font-weight:600;margin-top:7px;text-align:justify;line-height:1.45}
.tf-notes u{font-weight:800;text-underline-offset:2px}
.tf-line{display:inline-block;border-bottom:1.7px solid #2E3192;min-width:150px;height:14px;vertical-align:bottom;padding:0 5px;font-weight:700;text-align:center}
.tf-sig{font-weight:800;font-size:12.4px;font-family:Arial,Helvetica,sans-serif;margin-top:9px}
.tf-mt{margin-top:8px}
/* ---- Official Delivery Challan / Gate Pass (ATS/QF/7.1/C/DCF) ---- */
.dc{color:#111;font-size:12.2px;line-height:1.45;font-family:var(--body)}
.dc-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px}
.dc-code{font-weight:700;font-size:12px;padding-top:8px}
.dc-logo{height:42px;width:auto}
.dc-box{border:2px solid #111}
.dc-box>div{border-bottom:1.8px solid #111}
.dc-box>div:last-child{border-bottom:none}
.dc-sec{padding:6px 10px}
.dc-title{text-align:center;font-weight:800;font-size:14.5px;letter-spacing:.02em;text-decoration:underline;text-underline-offset:3px}
.dc-co{text-align:center;font-weight:800;font-size:19px;margin-top:1px}
.dc-c{text-align:center;font-size:12px}
.dc-grid{display:flex}
.dc-grid>.l{width:55%;border-right:1.8px solid #111;padding:6px 10px}
.dc-grid>.r{width:45%;padding:6px 10px}
.dc-kv{display:flex;align-items:flex-end;margin:4px 0}
.dc-kv .k{flex:none;font-weight:600}
.dc-dot{flex:1;border-bottom:1.4px dotted #555;min-height:16px;padding:0 5px;font-weight:600}
.dc table{width:100%;border-collapse:collapse}
.dc th,.dc td{border:1.6px solid #111;padding:5px 8px;vertical-align:top;font-size:12px}
.dc th{text-align:center;font-weight:700}
.dc td.c{text-align:center}
.dc-sig{display:flex;justify-content:space-between;font-weight:700;padding:0 10px 10px}
@page{size:A4;margin:12mm}
@media print{.pdoc{padding:0;max-width:none}}
`;

const LOGO_IMG = `<img class="pd-logo" src="${LOGO_B64}" alt="">`;

const letterhead = (S) => `<div class="pd-head">${LOGO_IMG}<div><div class="pd-name">${esc((S.name || '').toUpperCase())}</div><div class="pd-tag">${esc(S.tag || '')}</div></div><div class="pd-addr">${nl(S.addr || '')}${S.phone ? '<br>Ph: ' + esc(S.phone) : ''}${S.email ? '<br>' + esc(S.email) : ''}${S.gstin ? '<br>GSTIN: ' + esc(S.gstin) : ''}</div></div>`;

const foot = (S, extra) => `<div class="pd-foot">${esc(S.name || '')} — ${esc(S.tag || '')}${extra ? '<br>' + extra : ''}<br>System-generated document · Generated on ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>`;

/* ------------------- TRF — official ATS/QF/7.1/A/TRF format ---- */
export function buildTrfDoc(t, S) {
  const tests = t.tests || [];
  const testRows = tests.map((x, i) =>
    `<tr><td class="c">${i + 1}</td><td>${esc(t.sample_desc)}</td><td class="c">${esc(t.sample_part || '')}</td><td>${esc(x.test)}</td><td>${esc([x.std, x.spec].filter(Boolean).join(' — '))}${x.dur ? `<br><i>Duration: ${esc(x.dur)}</i>` : ''}</td><td class="c">${esc(t.sample_qty || '')}</td></tr>`).join('');
  const padRows = Array.from({ length: Math.max(0, 5 - tests.length) })
    .map(() => '<tr style="height:52px"><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
  const wits = t.witnesses || [];
  const witRows = wits.map((w, i) =>
    `<tr><td class="c">${i + 1}</td><td>${esc(w.name)}</td><td>${esc(w.designation || '')}</td><td>${esc(w.organization || '')}</td></tr>`).join('');
  const witPad = Array.from({ length: Math.max(0, 2 - wits.length) })
    .map((_, i) => `<tr style="height:26px"><td class="c">${wits.length + i + 1}</td><td></td><td></td><td></td></tr>`).join('');

  return `<div class="tf"><div class="tf-frame">
    <div class="tf-title"><u>TEST REQUEST FORM</u></div>
    <div class="tf-head">
      <div class="tf-code">ATS/QF/7.1/A/TRF&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;REV 00 AUG'24</div>
      <div style="flex:1"><img class="tf-logo" src="${LOGO_B64}" alt="ATS"></div>
      <div class="tf-headr"></div>
    </div>
    <div class="tf-row2">
      <div style="font-weight:800">Report No :&nbsp;&nbsp;<span class="tf-red">${esc(t.no)}</span></div>
      <div class="tf-sec">CUSTOMER DETAILS</div>
      <div style="text-align:right;font-weight:800">Date :&nbsp;<span style="font-weight:700">${fmtD(t.date)}</span></div>
    </div>
    <table><tr>
      <td style="width:47%;height:118px"><b>Name &amp; Address of the Customer :</b><br><br>${esc(t.customer_company)}<br>${nl(t.customer_addr || '')}${t.customer_gst ? `<br>GSTIN: ${esc(t.customer_gst)}` : ''}</td>
      <td><div style="min-height:32px"><b>Contact Person Name :</b>&nbsp;${esc(t.customer_contact || '')}</div>
        <div style="min-height:32px;margin-top:8px"><b>Contact Number :</b>&nbsp;${esc(t.customer_phone || '')}</div>
        <div style="min-height:32px;margin-top:8px"><b>E-mail :</b>&nbsp;${esc(t.customer_email || '')}</div>
        ${t.batch_no ? `<div style="margin-top:8px"><b>Batch No :</b>&nbsp;${esc(t.batch_no)}</div>` : ''}</td>
    </tr></table>
    <div class="tf-sec" style="margin:8px 0 5px">UNIT&nbsp;&nbsp;PARTICULARS</div>
    <table><thead><tr>
      <th style="width:6%">Sl.<br>No.</th><th style="width:19%">Name of Sample</th><th style="width:12%">Model No/<br>SL.No.</th><th style="width:21%">Test (s) requested</th><th style="width:28%">Test Method /<br>Specification</th><th style="width:14%">Sample Qty.</th>
    </tr></thead><tbody>${testRows}${padRows}</tbody></table>
    <div class="tf-notes"><u>*Note : 1 on Test method / Specification :</u> Test method identification is mandatory. If test method column is left blank, ATS will test using available standard test procedures/in-house test procedures. If specification column is left blank, test report will be issued without any specified requirements. <u>Note : 2 on Sample retention :</u> Samples will be retained for one month after completion of testing, unless requested by the customer separately. Perishable samples will be destroyed one week after completion of testing, samples will be returned, if requested by the customer within the retention period. <u>Note : 3 on Test report :</u> When the customer requests a statement of conformity to a specification/standard for the test, the specification and decision rule shall be clearly defined.</div>
    <div class="tf-sig" style="margin-top:7px">DECISION RULE APPLIED : YES/NO</div>
    <div class="tf-sig" style="margin:5px 0 4px">TEST WITNESSED BY :</div>
    <table><thead><tr><th style="width:7%">S.No.</th><th style="width:37%">Name</th><th style="width:26%">Designation</th><th>Organization</th></tr></thead><tbody>${witRows}${witPad}</tbody></table>
    <div class="tf-sig tf-mt">Signature of Representative : <span class="tf-line" style="min-width:135px"></span>&nbsp;&nbsp;Name of Representative : <span class="tf-line" style="min-width:190px">${esc(t.customer_contact || '')}</span></div>
    <div class="tf-sig tf-mt">Signature of ATS Representative : <span class="tf-line" style="min-width:110px"></span>&nbsp;&nbsp;Name of Representative : <span class="tf-line" style="min-width:170px">${esc(t.created_by || '')}</span></div>
    <div class="tf-sig tf-mt" style="line-height:2">Mode of Report Delivery<br>(Post / Courier / Person) : <span class="tf-line" style="min-width:300px"></span>&nbsp;Due Date : <span class="tf-line" style="min-width:140px"></span></div>
  </div></div>`;
}

/* --------------------------- Test Witness Form (printable) ---- */
export function buildWitnessDoc(t, S) {
  const wits = t.witnesses || [];
  const rows = wits.map((w, i) =>
    `<tr style="height:44px"><td class="c">${i + 1}</td><td>${esc(w.name)}</td><td>${esc(w.designation || '')}</td><td>${esc(w.organization || '')}</td><td></td></tr>`).join('');
  const pad = Array.from({ length: Math.max(0, 3 - wits.length) })
    .map((_, i) => `<tr style="height:44px"><td class="c">${wits.length + i + 1}</td><td></td><td></td><td></td><td></td></tr>`).join('');
  const testNames = (t.tests || []).map((x) => x.test).join(', ');
  const info = (k, v) => `<tr><td style="width:26%"><b>${k}</b></td><td>${v || ''}</td></tr>`;
  return `<div class="tf"><div class="tf-frame">
    <div class="tf-title"><u>TEST WITNESS FORM</u></div>
    <div class="tf-head">
      <div class="tf-code">${esc(S.name || '')}</div>
      <div style="flex:1"><img class="tf-logo" src="${LOGO_B64}" alt="ATS"></div>
      <div class="tf-headr" style="text-align:right;font-weight:800">TRF No :&nbsp;<span class="tf-red">${esc(t.no)}</span></div>
    </div>
    <div class="tf-sec" style="margin:6px 0 5px">TEST INFORMATION</div>
    <table>${info('TRF Number', esc(t.no))}${info('Client Name', esc(t.customer_company))}${info('Sample Name', esc(t.sample_desc) + (t.sample_part ? ' — ' + esc(t.sample_part) : ''))}${info('Test Name (s)', esc(testNames))}${info('Date', fmtD(t.op_start_date || t.date))}${info('Start Time', esc(t.op_start_time || ''))}${info('End Time', esc(t.op_end_time || ''))}</table>
    <div class="tf-sec" style="margin:9px 0 5px">WITNESS INFORMATION</div>
    <table><thead><tr><th style="width:7%">S.No.</th><th style="width:28%">Name</th><th style="width:22%">Designation</th><th style="width:25%">Organization</th><th>Signature</th></tr></thead><tbody>${rows}${pad}</tbody></table>
    <div class="tf-notes" style="font-weight:600">The witness may sign above after completion of the test.</div>
    <div class="tf-sig" style="margin-top:34px">For ${esc(S.name || '')} — Authorised Signatory : <span class="tf-line" style="min-width:220px"></span></div>
  </div></div>`;
}

/* -------------------------------------------- Quotation ---- */
export function buildQuotationDoc(q, S) {
  const vtill = new Date(new Date(q.date + 'T00:00').getTime() + (q.validity || 30) * 86400000);
  return letterhead(S) +
    `<div class="pd-title">Quotation</div><div class="pd-sub">Environmental testing services</div>` +
    `<div class="pd-meta"><table><tr><td>Quotation No.</td><td><b>${esc(q.no)}</b></td></tr><tr><td>Date</td><td>${fmtD(q.date)}</td></tr><tr><td>Valid till</td><td>${vtill.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr></table>` +
    `<table><tr><td>Kind Attn.</td><td>${esc(q.customer_contact || '—')}</td></tr><tr><td>Phone</td><td>${esc(q.customer_phone || '—')}</td></tr><tr><td>Email</td><td>${esc(q.customer_email || '—')}</td></tr></table></div>` +
    `<div class="pd-box"><h5>To</h5><b>${esc(q.customer_company)}</b><br>${esc(q.customer_addr || '')}${q.customer_gst ? '<br>GSTIN: ' + esc(q.customer_gst) : ''}</div>` +
    (q.subject ? `<div class="pd-note" style="margin-bottom:8px"><b>Subject:</b> ${esc(q.subject)}</div>` : '') +
    `<table class="pd-tbl"><thead><tr><th style="width:5%">#</th><th>Description of Test / Service</th><th style="width:9%" class="r">Qty</th><th style="width:15%" class="r">Rate (₹)</th><th style="width:16%" class="r">Amount (₹)</th></tr></thead><tbody>` +
    (q.items || []).map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.desc)}</td><td class="r">${+x.qty}</td><td class="r">${inr(x.rate)}</td><td class="r">${inr(x.qty * x.rate)}</td></tr>`).join('') +
    `<tr class="pd-tot"><td colspan="4" class="r">Sub Total</td><td class="r">${inr(q.sub)}</td></tr>` +
    `<tr class="pd-tot"><td colspan="4" class="r">GST @ ${+q.gst_rate}%</td><td class="r">${inr(q.gst_amount)}</td></tr>` +
    `<tr class="pd-grand"><td colspan="4" class="r">Grand Total</td><td class="r">${inr(q.total)}</td></tr></tbody></table>` +
    `<div class="pd-words">${esc(inWords(q.total))}</div>` +
    `<div class="pd-box"><h5>Terms &amp; Conditions</h5>${nl((q.notes ? q.notes + '\n' : '') + (S.quotation_terms || ''))}</div>` +
    `<div class="pd-sign"><div><span>Customer Acceptance</span></div><div><span>For ${esc(S.name)} — Authorised Signatory</span></div></div>` +
    foot(S, 'Quotation ' + esc(q.no));
}

/* ---------------------------------------------- Invoice ---- */
export function buildInvoiceDoc(v, S) {
  const half = +v.gst_rate / 2;
  return letterhead(S) +
    `<div class="pd-title">Tax Invoice</div><div class="pd-sub">Original for recipient</div>` +
    `<div class="pd-meta"><table><tr><td>Invoice No.</td><td><b>${esc(v.no)}</b></td></tr><tr><td>Invoice Date</td><td>${fmtD(v.date)}</td></tr><tr><td>TRF Ref.</td><td><span class="pd-badge">${esc(v.trf_no)}</span></td></tr></table>` +
    `<table><tr><td>Customer PO</td><td>${esc(v.po_no || '—')}</td></tr><tr><td>Payment Status</td><td>${esc(v.status)}</td></tr></table></div>` +
    `<div class="pd-box"><h5>Bill To</h5><b>${esc(v.customer_company)}</b>${v.customer_contact ? ' — ' + esc(v.customer_contact) : ''}<br>${esc(v.customer_addr || '')}${v.customer_gst ? '<br>GSTIN: ' + esc(v.customer_gst) : ''}</div>` +
    `<table class="pd-tbl"><thead><tr><th style="width:5%">#</th><th>Description</th><th style="width:10%">SAC</th><th style="width:8%" class="r">Qty</th><th style="width:14%" class="r">Rate (₹)</th><th style="width:15%" class="r">Amount (₹)</th></tr></thead><tbody>` +
    (v.items || []).map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.desc)}</td><td>${esc(x.sac || '')}</td><td class="r">${+x.qty}</td><td class="r">${inr(x.rate)}</td><td class="r">${inr(x.qty * x.rate)}</td></tr>`).join('') +
    `<tr class="pd-tot"><td colspan="5" class="r">Sub Total</td><td class="r">${inr(v.sub)}</td></tr>` +
    `<tr class="pd-tot"><td colspan="5" class="r">CGST @ ${half}%</td><td class="r">${inr(v.gst_amount / 2)}</td></tr>` +
    `<tr class="pd-tot"><td colspan="5" class="r">SGST @ ${half}%</td><td class="r">${inr(v.gst_amount / 2)}</td></tr>` +
    `<tr class="pd-grand"><td colspan="5" class="r">Grand Total</td><td class="r">${inr(v.total)}</td></tr></tbody></table>` +
    `<div class="pd-words">${esc(inWords(v.total))}</div>` +
    (v.notes ? `<div class="pd-note"><b>Notes:</b> ${esc(v.notes)}</div>` : '') +
    ((S.bank_name || S.bank_account) ? `<div class="pd-box"><h5>Bank Details</h5>${esc(S.bank_name)}${S.bank_account ? ' · A/c: ' + esc(S.bank_account) : ''}${S.bank_ifsc ? ' · IFSC: ' + esc(S.bank_ifsc) : ''}${S.bank_branch ? ' · ' + esc(S.bank_branch) : ''}</div>` : '') +
    `<div class="pd-box"><h5>Terms</h5>${nl(S.invoice_terms || '')}</div>` +
    `<div class="pd-sign"><div><span>Receiver&#39;s Signature</span></div><div><span>For ${esc(S.name)} — Authorised Signatory</span></div></div>` +
    foot(S, `Invoice ${esc(v.no)} · TRF ${esc(v.trf_no)}`);
}

/* ------------------------------------------ Internal PO ---- */
export function buildIpoDoc(p, S) {
  return letterhead(S) +
    `<div class="pd-title">Purchase Order</div><div class="pd-sub">Internal procurement — ${esc(p.category)}</div>` +
    `<div class="pd-meta"><table><tr><td>PO No.</td><td><b>${esc(p.no)}</b></td></tr><tr><td>PO Date</td><td>${fmtD(p.date)}</td></tr></table>` +
    `<table><tr><td>Category</td><td>${esc(p.category)}</td></tr><tr><td>Issued by</td><td>${esc(p.created_by)}</td></tr></table></div>` +
    `<div class="pd-box"><h5>To (Vendor)</h5><b>${esc(p.vendor)}</b>${p.vendor_addr ? '<br>' + nl(p.vendor_addr) : ''}</div>` +
    `<table class="pd-tbl"><thead><tr><th style="width:5%">#</th><th>Item</th><th style="width:9%" class="r">Qty</th><th style="width:15%" class="r">Rate (₹)</th><th style="width:16%" class="r">Amount (₹)</th></tr></thead><tbody>` +
    (p.items || []).map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.desc)}</td><td class="r">${+x.qty}</td><td class="r">${inr(x.rate)}</td><td class="r">${inr(x.qty * x.rate)}</td></tr>`).join('') +
    `<tr class="pd-tot"><td colspan="4" class="r">Sub Total</td><td class="r">${inr(p.sub)}</td></tr>` +
    `<tr class="pd-tot"><td colspan="4" class="r">GST @ ${+p.gst_rate}%</td><td class="r">${inr(p.gst_amount)}</td></tr>` +
    `<tr class="pd-grand"><td colspan="4" class="r">Grand Total</td><td class="r">${inr(p.total)}</td></tr></tbody></table>` +
    `<div class="pd-words">${esc(inWords(p.total))}</div>` +
    `<div class="pd-box"><h5>Terms</h5>${nl((p.notes ? p.notes + '\n' : '') + 'Please quote the PO number on your invoice and delivery challan.')}</div>` +
    `<div class="pd-sign"><div><span>Vendor Acknowledgement</span></div><div><span>For ${esc(S.name)} — Authorised Signatory</span></div></div>` +
    foot(S, 'Internal PO ' + esc(p.no));
}

/* ---------- Delivery Challan / Gate Pass — official ATS/QF/7.1/C/DCF ---- */
export function buildChallanDoc(c, S) {
  const items = c.items || [];
  const rows = items.map((x, i) =>
    `<tr><td class="c" style="width:8%">${i + 1}</td><td>${esc(x.item)}</td><td class="c" style="width:12%">${esc(x.qty || '')}</td><td style="width:13%">${esc(x.remarks || '')}</td></tr>`).join('');
  const fillerH = Math.max(70, 400 - items.length * 30);
  const purpose = ['Sub-contracting', 'Repairing', 'Others'].map((p) =>
    c.purpose === p ? `<b style="text-decoration:underline;text-underline-offset:2px">${p}</b>` : p).join(' / ');
  const addrLines = String(c.address || '').split(/\n/).filter(Boolean);
  const otherAuto = [c.trf_no ? `TRF: ${c.trf_no}` : '', c.report_no ? `Report: ${c.report_no}` : '']
    .filter(Boolean).join(' · ');
  const other1 = c.other_info || otherAuto;
  const other2 = c.courier || '';
  const dot = (v, k, kw) => `<div class="dc-kv">${k ? `<span class="k" style="width:${kw}px">${k}</span>` : ''}<span class="dc-dot">${esc(v || '')}</span></div>`;

  return `<div class="dc">
    <div class="dc-head"><div class="dc-code">ATS/QF/7.1/C/DCF&nbsp;&nbsp;&nbsp;&nbsp;REV 00&nbsp;&nbsp;&nbsp;JUN'24</div><img class="dc-logo" src="${LOGO_B64}" alt="ATS"></div>
    <div class="dc-box">
      <div class="dc-sec">
        <div class="dc-title">DELIVERY CHALLAN / GATE PASS</div>
        <div class="dc-co">${esc((S.name || '').toUpperCase())}</div>
        <div class="dc-c">${esc(S.addr || '')}</div>
        <div class="dc-c">Email: ${esc(S.email || '')}, Phone: ${esc(S.phone || '')}</div>
        <div class="dc-c" style="font-weight:700;margin-top:2px">GST No. ${esc(S.gst || '')}</div>
      </div>
      <div class="dc-grid">
        <div class="l">
          <div style="font-weight:600">To,</div>
          ${dot(c.client_name, 'M/s', 34)}
          ${dot(addrLines[0] || '')}
          ${dot(addrLines.slice(1).join(', ') || '')}
          ${dot(c.client_gst, 'GST No.', 56)}
        </div>
        <div class="r">
          ${dot(c.no, 'D. C. No. :', 96)}
          ${dot(fmtD(c.date), 'Date :', 96)}
          ${dot(c.inv_ref, 'Inv No./Date :', 96)}
          ${dot(other1, 'Any other Inf.:', 96)}
          ${dot(other2)}
        </div>
      </div>
      <div class="dc-sec">
        <div class="dc-kv"><span class="k" style="width:70px">P O No. :</span><span class="dc-dot">${esc(c.po_no || '')}</span>
          <span class="k" style="width:60px;margin-left:14px">Date :</span><span class="dc-dot" style="max-width:190px">${c.po_date ? fmtD(c.po_date) : ''}</span></div>
        <div style="margin-top:3px"><b>Purpose :</b>&nbsp;&nbsp;${purpose}</div>
      </div>
      <div>
        <table><thead><tr>
          <th style="width:8%">S. No.</th>
          <th>ITEM(S) DETAILS<br><span style="font-weight:600;font-size:9.6px">(SAMPLE NAME, UNIQUE SAMPLE Id., ITEM NAME, ITEM DETAILS etc.,)</span></th>
          <th style="width:12%">Quantity</th><th style="width:13%">Remarks</th>
        </tr></thead><tbody>
          ${rows}
          <tr style="height:${fillerH}px"><td></td><td></td><td></td><td></td></tr>
        </tbody></table>
      </div>
      <div>
        <div style="text-align:right;font-weight:800;padding:8px 12px 0">For ${esc(S.name || '')},</div>
        <div class="dc-sig" style="margin-top:56px"><span>Receiver's Signature</span><span>Authorised Signatory</span></div>
      </div>
    </div>
  </div>`;
}

/* ---------------------------------------------- printer ---- */
/** Open the window synchronously inside the click handler, then hand it to
    printDocument() after the API call — avoids popup blockers. */
export function openPrintWindow() {
  const w = window.open('', '_blank');
  if (w) {
    w.document.write('<title>Preparing document…</title><body style="font-family:sans-serif;color:#66738C;padding:36px">Preparing document…</body>');
  }
  return w;
}

export function printDocument(title, bodyHtml, win) {
  const w = win || window.open('', '_blank');
  if (!w) { alert('Popup blocked — allow popups for this site to print documents.'); return; }
  w.document.open();
  w.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>` +
    `<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&display=swap" rel="stylesheet">` +
    `<style>${PD_CSS}</style></head><body><div class="pdoc">${bodyHtml}</div>` +
    `<scr` + `ipt>window.onload=function(){setTimeout(function(){window.print()},350)}</scr` + `ipt></body></html>`
  );
  w.document.close();
}
