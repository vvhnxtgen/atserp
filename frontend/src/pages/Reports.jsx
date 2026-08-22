import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg, fileUrl } from '../api';
import { Empty } from '../components/Bits';
import { useApp } from '../ctx';
import { fmtD, today } from '../lib/format';

export default function Reports() {
  const { toast } = useApp();
  const [list, setList] = useState([]);
  const [trfs, setTrfs] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ trf: '', client_name: '', report_no: '', report_date: today() });
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback((query = '') =>
    api.get('/api/lab-reports/' + (query ? `?q=${encodeURIComponent(query)}` : '')).then((r) => setList(r.data)), []);
  useEffect(() => {
    load().catch((e) => toast(errMsg(e), { variant: 'danger' }));
    api.get('/api/trfs/').then((r) => setTrfs(r.data)).catch(() => {});
  }, [load, toast]);
  useEffect(() => { const t = setTimeout(() => load(q), 300); return () => clearTimeout(t); }, [q, load]);

  const pickTrf = (e) => {
    const id = e.target.value;
    const t = trfs.find((x) => String(x.id) === id);
    setForm({ ...form, trf: id, client_name: t ? t.customer_company : form.client_name });
  };

  const upload = async () => {
    if (!form.report_no.trim()) { toast('Report number is required.', { variant: 'danger' }); return; }
    if (!file) { toast('Attach the report PDF.', { variant: 'danger' }); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      if (form.trf) fd.append('trf', form.trf);
      fd.append('client_name', form.client_name);
      fd.append('report_no', form.report_no);
      fd.append('report_date', form.report_date || today());
      fd.append('file', file);
      await api.post('/api/lab-reports/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm({ trf: '', client_name: '', report_no: '', report_date: today() });
      setFile(null); setFileKey((k) => k + 1);
      await load(q);
      toast('Report uploaded ✓', { variant: 'success' });
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const del = async (r) => {
    if (!window.confirm(`Delete report ${r.report_no}?`)) return;
    try { await api.delete(`/api/lab-reports/${r.id}/`); await load(q); toast('Report deleted.'); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  return (
    <>
      <div className="card">
        <div className="card-header">Upload Laboratory Report</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3"><label className="form-label">TRF Number</label>
              <select className="form-select form-select-sm" value={form.trf} onChange={pickTrf}>
                <option value="">— Link a TRF (optional) —</option>
                {trfs.map((t) => <option key={t.id} value={t.id}>{t.no} — {t.customer_company}</option>)}
              </select>
            </div>
            <div className="col-md-3"><label className="form-label">Client Name</label><input className="form-control form-control-sm" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
            <div className="col-md-2"><label className="form-label">Report Number *</label><input className="form-control form-control-sm" value={form.report_no} onChange={(e) => setForm({ ...form, report_no: e.target.value })} /></div>
            <div className="col-md-2"><label className="form-label">Report Date</label><input type="date" className="form-control form-control-sm" value={form.report_date} onChange={(e) => setForm({ ...form, report_date: e.target.value })} /></div>
            <div className="col-md-2"><label className="form-label">Report (PDF) *</label>
              <input key={fileKey} type="file" className="form-control form-control-sm" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <button className="btn btn-gold btn-sm mt-3" disabled={busy} onClick={upload}>⇪ Upload report</button>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header d-flex align-items-center gap-2">Report Register
          <input className="form-control form-control-sm ms-auto" style={{ maxWidth: 320 }}
            placeholder="Search TRF no · client name · report no…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="card-body">
          {!list.length ? <Empty label={q ? 'No reports match your search.' : 'No reports uploaded yet.'} /> : (
            <div className="table-responsive">
              <table className="table table-sm tbl align-middle">
                <thead><tr><th>Report No.</th><th>Report Date</th><th>TRF</th><th>Client</th><th>Uploaded By</th><th style={{ width: 230 }}>Actions</th></tr></thead>
                <tbody>{list.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.report_no}</b></td>
                    <td>{fmtD(r.report_date)}</td>
                    <td>{r.trf ? <Link to={'/test/' + r.trf}>{r.trf_no}</Link> : (r.trf_no || '—')}</td>
                    <td>{r.client_name || '—'}</td>
                    <td className="small">{r.uploaded_by}</td>
                    <td className="text-nowrap">
                      <a className="btn btn-sm btn-outline-navy me-1" href={fileUrl(r.file)} target="_blank" rel="noreferrer">View</a>
                      <a className="btn btn-sm btn-outline-navy me-1" href={fileUrl(r.file)} download>Download</a>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => del(r)}>Delete</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
