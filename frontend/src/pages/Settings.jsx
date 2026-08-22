import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useApp } from '../ctx';

const In = ({ label, k, type = 'text', col = 'col-md-4', ph, s, f }) => (
  <div className={col}>
    <label className="form-label">{label}</label>
    <input type={type} className="form-control form-control-sm" placeholder={ph || ''} value={s[k] ?? ''} onChange={f(k)} />
  </div>
);

function Chips({ list, onRemove }) {
  return (
    <div className="mb-2">
      {list.length ? list.map((v, i) => (
        <span className="chip" key={v + i}>{v}<button onClick={() => onRemove(i)} title="Remove">✕</button></span>
      )) : <span className="text-secondary small">None yet.</span>}
    </div>
  );
}

function MasterEditor({ label, list, setList }) {
  const [val, setVal] = useState('');
  const add = () => {
    const v = val.trim();
    if (!v) return;
    if (list.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    setList([...list, v]); setVal('');
  };
  return (
    <div className="mb-3">
      <label className="form-label">{label}</label>
      <Chips list={list} onRemove={(i) => setList(list.filter((_, x) => x !== i))} />
      <div className="d-flex gap-2">
        <input className="form-control form-control-sm" style={{ maxWidth: 320 }} value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={'Add ' + label.toLowerCase()} />
        <button className="btn btn-sm btn-outline-navy" onClick={add}>Add</button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { settings, refreshSettings, toast, autoPrint, setAutoPrint } = useApp();
  const [s, setS] = useState(null);
  const [pw, setPw] = useState({ admin_password: '', tech_password: '' });
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState({});

  useEffect(() => { if (settings) setS(JSON.parse(JSON.stringify(settings))); }, [settings]);

  // Live numbering preview — recompute (debounced) whenever the format changes.
  useEffect(() => {
    if (!s) return;
    const t = setTimeout(async () => {
      try {
        const codes = {};
        ['code_trf', 'code_qtn', 'code_inv', 'code_ind', 'code_ipo', 'code_dsp', 'code_dch'].forEach((k) => { codes[k] = s[k]; });
        const { data } = await api.post('/api/numbering-preview/', {
          num_format: s.num_format, num_org: s.num_org, num_pad: s.num_pad, codes,
        });
        setPreview(data.preview || {});
      } catch { /* preview is best-effort */ }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s && s.num_format, s && s.num_org, s && s.num_pad, s && s.code_trf, s && s.code_qtn, s && s.code_inv, s && s.code_ind, s && s.code_ipo, s && s.code_dsp, s && s.code_dch]);

  if (!s) return <div className="text-secondary">Loading settings…</div>;

  const f = (k) => (e) => setS({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (keys, label) => {
    setBusy(label);
    try {
      const body = Object.fromEntries(keys.map((k) => [k, s[k]]));
      await api.put('/api/settings/', body);
      await refreshSettings();
      toast(label + ' saved ✓', { variant: 'success' });
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy('');
  };

  const savePw = async () => {
    if (!pw.admin_password && !pw.tech_password) { toast('Enter a new password to update.', { variant: 'danger' }); return; }
    setBusy('pw');
    try {
      await api.put('/api/auth/passwords/', pw);
      setPw({ admin_password: '', tech_password: '' });
      toast('Passwords updated ✓', { variant: 'success' });
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy('');
  };

  const seed = async () => {
    if (!window.confirm('Load sample data (TRFs, quotation, invoice, quality docs…) alongside existing records?')) return;
    setBusy('seed');
    try {
      await api.post('/api/seed-demo/');
      await refreshSettings();
      toast('Sample data loaded — explore the dashboard, TRFs, quality docs, invoices and finance charts.', { variant: 'success' });
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy('');
  };

  return (
    <>
      <div className="card mb-3">
        <div className="card-header">Lab profile — appears on every PDF</div>
        <div className="card-body">
          <div className="row g-3">
            <In s={s} f={f} label="Lab name" k="name" />
            <In s={s} f={f} label="Tagline / accreditation" k="tag" col="col-md-8" />
            <div className="col-md-6"><label className="form-label">Address</label>
              <textarea className="form-control form-control-sm" rows={2} value={s.addr ?? ''} onChange={f('addr')} /></div>
            <In s={s} f={f} label="Phone" k="phone" col="col-md-2" />
            <In s={s} f={f} label="Email" k="email" col="col-md-2" />
            <In s={s} f={f} label="GSTIN" k="gstin" col="col-md-2" />
          </div>
          <button className="btn btn-navy btn-sm mt-3" disabled={!!busy} onClick={() => save(['name', 'tag', 'addr', 'phone', 'email', 'gstin'], 'Lab profile')}>Save lab profile</button>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">Notifications — admin alerts on every workflow event</div>
        <div className="card-body">
          <div className="row g-3">
            <In s={s} f={f} label="Admin email" k="admin_email" col="col-md-4" />
            <In s={s} f={f} label="Admin WhatsApp (with country code)" k="admin_whatsapp" col="col-md-4" ph="e.g. 9198XXXXXXXX" />
            <div className="col-md-4 d-flex align-items-end">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="emailOn" checked={!!s.email_notifications} onChange={f('email_notifications')} />
                <label className="form-check-label" htmlFor="emailOn">Email notifications enabled</label>
              </div>
            </div>
          </div>
          <div className="text-secondary small mt-2">
            Emails are sent by the Django backend. Without SMTP configuration they print in the backend terminal;
            for real delivery set <code>EMAIL_HOST_USER / EMAIL_HOST_PASSWORD</code> in <code>.env</code> (Gmail App Password).
            WhatsApp sends automatically when <code>WHATSAPP_PROVIDER</code> is <code>cloud</code> or <code>twilio</code>; in
            the default <code>link</code> mode each alert shows a one-tap <code>wa.me</code> button. Test both with
            <code>python manage.py test_notify</code>.
          </div>
          <button className="btn btn-navy btn-sm mt-3" disabled={!!busy} onClick={() => save(['admin_email', 'admin_whatsapp', 'email_notifications'], 'Notification settings')}>Save notifications</button>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">Preferences</div>
        <div className="card-body">
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="autoprint" checked={!!autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} />
            <label className="form-check-label" htmlFor="autoprint">Automatically open the print dialog after registering a TRF</label>
          </div>
          <div className="text-secondary small mt-2">
            Off by default — a new TRF is saved without a print popup, and you can print it anytime from the TRF page.
            Turn this on to have the print dialog open immediately on registration. (Saved on this device.)
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">Masters — engineers, chambers &amp; test types</div>
        <div className="card-body">
          <MasterEditor label="Engineers" list={s.engineers || []} setList={(l) => setS({ ...s, engineers: l })} />
          <MasterEditor label="Chambers / Equipment" list={s.chambers || []} setList={(l) => setS({ ...s, chambers: l })} />
          <MasterEditor label="Test types" list={s.test_types || []} setList={(l) => setS({ ...s, test_types: l })} />
          <button className="btn btn-navy btn-sm" disabled={!!busy} onClick={() => save(['engineers', 'chambers', 'test_types'], 'Masters')}>Save masters</button>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">Document numbering — custom format</div>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-6"><label className="form-label">Number format</label>
              <input className="form-control form-control-sm" style={{ fontFamily: 'monospace' }} value={s.num_format ?? ''} onChange={f('num_format')} placeholder="{ORG}/{CODE}/{FY}/{NUM}" />
            </div>
            <div className="col-md-3"><label className="form-label">Organisation ({'{ORG}'})</label>
              <input className="form-control form-control-sm" value={s.num_org ?? ''} onChange={f('num_org')} placeholder="ATS" />
            </div>
            <div className="col-md-3"><label className="form-label">Serial padding ({'{NUM}'})</label>
              <select className="form-select form-select-sm" value={s.num_pad ?? 3} onChange={f('num_pad')}>
                <option value={1}>1 → 1</option><option value={2}>2 → 01</option><option value={3}>3 → 001</option>
                <option value={4}>4 → 0001</option><option value={5}>5 → 00001</option><option value={6}>6 → 000001</option>
              </select>
            </div>
          </div>

          <div className="text-secondary small mt-3 p-3" style={{ background: 'var(--bg0)', border: '1px solid var(--line)', borderRadius: 10 }}>
            <b className="text-light">Placeholders</b> — click to insert:
            <div className="d-flex flex-wrap gap-2 mt-2">
              {[['{ORG}', 'organisation, e.g. ATS'], ['{CODE}', 'document code, e.g. INV'], ['{NUM}', 'running serial'],
                ['{FY}', 'financial year 2025-26'], ['{YYYY}', '4-digit year'], ['{YY}', '2-digit year'],
                ['{MM}', 'month'], ['{DD}', 'day']].map(([tok, desc]) => (
                <button key={tok} type="button" className="abadge b-grey" style={{ fontFamily: 'monospace', cursor: 'pointer' }}
                  title={desc} onClick={() => setS({ ...s, num_format: (s.num_format || '') + tok })}>{tok}</button>
              ))}
            </div>
            <div className="mt-2">Any other characters (<code>/ - . space</code>) are kept exactly as typed. Each document type substitutes its own <code>{'{CODE}'}</code> below.</div>
          </div>

          <div className="row g-3 mt-1">
            <div className="col-12"><label className="form-label mb-1">Per-document codes ({'{CODE}'})</label></div>
            <In s={s} f={f} label="TRF" k="code_trf" col="col-md-2" />
            <In s={s} f={f} label="Quotation" k="code_qtn" col="col-md-2" />
            <In s={s} f={f} label="Invoice" k="code_inv" col="col-md-2" />
            <In s={s} f={f} label="Indent" k="code_ind" col="col-md-2" />
            <In s={s} f={f} label="Internal PO" k="code_ipo" col="col-md-2" />
            <In s={s} f={f} label="Dispatch" k="code_dsp" col="col-md-2" />
            <In s={s} f={f} label="Challan" k="code_dch" col="col-md-2" />
          </div>

          <div className="form-check form-switch mt-3">
            <input className="form-check-input" type="checkbox" id="yreset" checked={!!s.yearly_reset} onChange={f('yearly_reset')} />
            <label className="form-check-label" htmlFor="yreset">Reset serials to 1 each new year {(s.num_format || '').includes('{FY}') ? '(financial year)' : '(calendar year)'}</label>
          </div>

          <div className="mt-3 p-3" style={{ background: 'var(--bg0)', border: '1px solid var(--line)', borderRadius: 10 }}>
            <div className="text-secondary small mb-2">Live preview — the next number in each series:</div>
            <div className="d-flex flex-wrap gap-2">
              {[['TRF', 'trf'], ['Quotation', 'qtn'], ['Invoice', 'inv'], ['Indent', 'ind'], ['Internal PO', 'ipo'], ['Dispatch', 'dsp'], ['Challan', 'dch']].map(([lbl, k]) => (
                <span key={k} className="abadge b-open" style={{ fontFamily: 'monospace' }}>{lbl}: {(preview[k] ?? settings.next_numbers[k])}</span>
              ))}
            </div>
          </div>

          <button className="btn btn-navy btn-sm mt-3" disabled={!!busy} onClick={() => save(['num_format', 'num_org', 'num_pad', 'code_trf', 'code_qtn', 'code_inv', 'code_ind', 'code_ipo', 'code_dsp', 'code_dch', 'yearly_reset'], 'Numbering')}>Save numbering</button>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">Invoice &amp; quotation defaults</div>
        <div className="card-body">
          <div className="row g-3">
            <In s={s} f={f} label="Default GST %" k="gst_default" type="number" col="col-md-2" />
            <In s={s} f={f} label="Bank name" k="bank_name" col="col-md-3" />
            <In s={s} f={f} label="Account no." k="bank_account" col="col-md-3" />
            <In s={s} f={f} label="IFSC" k="bank_ifsc" col="col-md-2" />
            <In s={s} f={f} label="Branch" k="bank_branch" col="col-md-2" />
            <div className="col-md-6"><label className="form-label">Invoice terms</label>
              <textarea className="form-control form-control-sm" rows={3} value={s.invoice_terms ?? ''} onChange={f('invoice_terms')} /></div>
            <div className="col-md-6"><label className="form-label">Quotation terms</label>
              <textarea className="form-control form-control-sm" rows={3} value={s.quotation_terms ?? ''} onChange={f('quotation_terms')} /></div>
          </div>
          <button className="btn btn-navy btn-sm mt-3" disabled={!!busy} onClick={() => save(['gst_default', 'bank_name', 'bank_account', 'bank_ifsc', 'bank_branch', 'invoice_terms', 'quotation_terms'], 'Invoice defaults')}>Save defaults</button>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">Users &amp; security</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4"><label className="form-label">New admin password</label>
              <input type="password" className="form-control form-control-sm" value={pw.admin_password} onChange={(e) => setPw({ ...pw, admin_password: e.target.value })} placeholder="Leave blank to keep current" /></div>
            <div className="col-md-4"><label className="form-label">New technician password</label>
              <input type="password" className="form-control form-control-sm" value={pw.tech_password} onChange={(e) => setPw({ ...pw, tech_password: e.target.value })} placeholder="Leave blank to keep current" /></div>
            <div className="col-md-4 d-flex align-items-end">
              <button className="btn btn-navy btn-sm" disabled={busy === 'pw'} onClick={savePw}>Update passwords</button>
            </div>
          </div>
          <div className="text-secondary small mt-2">Minimum 6 characters. More users/roles can be added from the Django admin at <code>/admin/</code>.</div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header">Data</div>
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <button className="btn btn-gold btn-sm" disabled={busy === 'seed'} onClick={seed}>Load sample data</button>
          <span className="text-secondary small">Adds demo TRFs, a quotation, customer PO, invoice, internal PO, indent and quality docs so you can explore every module. All data lives in the Django database (<code>db.sqlite3</code>) and uploaded files in <code>media/</code> — back those up.</span>
        </div>
      </div>
    </>
  );
}
