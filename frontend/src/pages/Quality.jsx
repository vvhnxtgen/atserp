import { useCallback, useEffect, useState } from 'react';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { Link } from 'react-router-dom';
import api, { errMsg, fileUrl } from '../api';
import { Empty } from '../components/Bits';
import { useApp } from '../ctx';
import { fmtD, today } from '../lib/format';

const CATS = ['Inspection Report', 'Calibration Report', 'Monthly Meeting', 'Internal Audit Report',
  'NCR', 'Traceability Record', 'SOP / Work Instruction', 'Training Record', 'Other'];
const CAT_CLS = { 'Inspection Report': 'b-open', 'Calibration Report': 'b-s4', 'Monthly Meeting': 'b-s2', 'Internal Audit Report': 'b-s3', NCR: 'b-fail', 'Traceability Record': 'b-gold', 'SOP / Work Instruction': 'b-grey', 'Training Record': 'b-pass', Other: 'b-grey' };

export default function Quality() {
  const { user, toast } = useApp();
  const [trfs, setTrfs] = useState([]);
  const [trace, setTrace] = useState([]);
  const [docs, setDocs] = useState([]);
  const [fCat, setFCat] = useState('');
  const [fQ, setFQ] = useState('');
  const [form, setForm] = useState({ category: CATS[0], title: '', trf: '', doc_date: today() });
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const loadDocs = useCallback(async () => {
    const p = new URLSearchParams();
    if (fCat) p.set('category', fCat);
    if (fQ) p.set('q', fQ);
    setDocs((await api.get('/api/quality-docs/?' + p)).data);
  }, [fCat, fQ]);

  const loadAll = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.get('/api/trace/'), api.get('/api/trfs/')]);
      setTrace(a.data); setTrfs(b.data);
      await loadDocs();
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  }, [loadDocs, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadDocs().catch(() => {}); }, [loadDocs]);

  const upload = async () => {
    if (!form.title.trim()) { toast('Give the document a title.', { variant: 'danger' }); return; }
    if (!file) { toast('Choose a file first.', { variant: 'danger' }); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries({ ...form, trf: form.trf || '' }).forEach(([k, v]) => { if (v !== '') fd.append(k, v); });
      fd.append('file', file);
      await api.post('/api/quality-docs/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast('Document uploaded ✓', { variant: 'success' });
      setForm({ category: form.category, title: '', trf: '', doc_date: today() });
      setFile(null); setFileKey((k) => k + 1);
      loadAll();
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const del = async (d) => {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    try { await api.delete(`/api/quality-docs/${d.id}/`); loadAll(); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  return (
    <Tabs defaultActiveKey="trace" className="mb-3">
      <Tab eventKey="trace" title="Traceability Matrix">
          <div className="card"><div className="card-body">
            <div className="text-secondary small mb-2">Complete audit history per TRF — sample, technician, method, instrument &amp; calibration, batch, witnesses and test images.</div>
            {!trace.length ? <Empty label="Nothing to trace yet — register a TRF." /> : (
              <div className="table-responsive">
                <table className="table table-sm tbl align-middle" style={{ minWidth: 1450 }}>
                  <thead><tr><th>TRF</th><th>Customer</th><th>Sample ID</th><th>Batch</th><th>Technician</th><th>Instrument</th><th>Method</th><th>Operation</th><th>Witnesses</th><th>Images</th><th>Result</th><th>Report</th><th>Docs</th><th>Invoices</th></tr></thead>
                  <tbody>{trace.map((r) => {
                    const overdue = r.calib_due && r.calib_due < today();
                    return (
                      <tr key={r.id}>
                        <td><Link to={'/test/' + r.id} style={{ fontWeight: 700 }}>{r.no}</Link></td>
                        <td>{r.customer}</td>
                        <td>{r.sample_id || '—'}</td>
                        <td>{r.batch || '—'}</td>
                        <td>{r.technician || '—'}</td>
                        <td>{r.instrument ? <>{r.instrument}{r.calib_status && <div className={'small ' + (overdue ? 'text-danger fw-bold' : 'text-secondary')}>{r.calib_status}{r.calib_due ? ' · due ' + fmtD(r.calib_due) : ''}</div>}</> : '—'}</td>
                        <td className="small">{r.method || '—'}</td>
                        <td className="small">{r.op_start ? <>{fmtD(r.op_start)} {r.op_start_time}<br />→ {r.op_end ? `${fmtD(r.op_end)} ${r.op_end_time}` : <i>running</i>}</> : '—'}</td>
                        <td className="small">{r.witnesses?.length ? r.witnesses.join(', ') : '—'}</td>
                        <td className="text-nowrap">
                          {r.start_image ? <a href={fileUrl(r.start_image)} target="_blank" rel="noreferrer" title="Starting image">S</a> : <span className="text-secondary">S</span>}
                          {' · '}
                          {r.end_image ? <a href={fileUrl(r.end_image)} target="_blank" rel="noreferrer" title="Ending image">E</a> : <span className="text-secondary">E</span>}
                        </td>
                        <td>{r.result ? <span className={'abadge ' + (r.result === 'Pass' ? 'b-pass' : 'b-fail')}>{r.result}</span> : '—'}</td>
                        <td>{r.report_url ? <a href={fileUrl(r.report_url)} target="_blank" rel="noreferrer">PDF</a> : '—'}</td>
                        <td className="small">{r.doc_cats?.length ? [...new Set(r.doc_cats)].join(', ') : '—'}</td>
                        <td className="small">{r.invoices?.length ? r.invoices.join(', ') : '—'}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </div></div>
        </Tab>

        <Tab eventKey="docs" title="Quality Documents">
        <div className="card mb-3">
          <div className="card-header">Upload document</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Category</label>
                <select className="form-select form-select-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Title / Reference *</label>
                <input className="form-control form-control-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Link to TRF (optional)</label>
                <select className="form-select form-select-sm" value={form.trf} onChange={(e) => setForm({ ...form, trf: e.target.value })}>
                  <option value="">— Not linked —</option>
                  {trfs.map((t) => <option key={t.id} value={t.id}>{t.no} — {t.customer_company}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Document date</label>
                <input type="date" className="form-control form-control-sm" value={form.doc_date} onChange={(e) => setForm({ ...form, doc_date: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label">File *</label>
                <input key={fileKey} type="file" className="form-control form-control-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <button className="btn btn-gold btn-sm" disabled={busy} onClick={upload}>{busy ? 'Uploading…' : 'Upload document'}</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card"><div className="card-body">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <select className="form-select form-select-sm" style={{ maxWidth: 240 }} value={fCat} onChange={(e) => setFCat(e.target.value)}>
              <option value="">All categories</option>
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="form-control form-control-sm" style={{ maxWidth: 300 }} placeholder="Search title, TRF no…" value={fQ} onChange={(e) => setFQ(e.target.value)} />
          </div>
          {!docs.length ? <Empty title="No documents">Upload inspection, calibration, audit, NCR and other quality records here.</Empty> : (
            <div className="table-responsive">
              <table className="table tbl align-middle">
                <thead><tr><th>Date</th><th>Category</th><th>Title</th><th>Linked TRF</th><th>By</th><th>Actions</th></tr></thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td className="text-nowrap">{fmtD(d.doc_date)}</td>
                      <td><span className={'abadge ' + (CAT_CLS[d.category] || 'b-grey')}>{d.category}</span></td>
                      <td>{d.title}</td>
                      <td className="num">{d.trf_no || '—'}</td>
                      <td>{d.uploaded_by}</td>
                      <td className="text-nowrap">
                        <a className="btn btn-sm btn-outline-navy me-1" href={fileUrl(d.file)} target="_blank" rel="noreferrer">View</a>
                        <a className="btn btn-sm btn-outline-navy me-1" href={fileUrl(d.file)} download>Download</a>
                        {user.role === 'admin' && <button className="btn btn-sm btn-outline-danger" onClick={() => del(d)}>Delete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div></div>
      </Tab>
    </Tabs>
  );
}
