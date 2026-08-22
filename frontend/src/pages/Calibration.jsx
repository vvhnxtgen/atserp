import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errMsg, fileUrl } from '../api';
import { Empty } from '../components/Bits';
import { useApp } from '../ctx';
import { fmtD, today } from '../lib/format';

export default function Calibration() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const eqFilter = params.get('equipment') || '';
  const [list, setList] = useState([]);
  const [equip, setEquip] = useState([]);
  const [form, setForm] = useState({ equipment: '', cert_no: '', calib_date: today(), expiry_date: '' });
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = useCallback(() => Promise.all([
    api.get('/api/calibration-certs/' + (eqFilter ? `?equipment=${eqFilter}` : '')).then((r) => setList(r.data)),
    api.get('/api/equipment/').then((r) => setEquip(r.data)),
  ]), [eqFilter]);
  useEffect(() => { load().catch((e) => toast(errMsg(e), { variant: 'danger' })); }, [load, toast]);

  const upload = async () => {
    if (!form.cert_no.trim()) { toast('Certificate number is required.', { variant: 'danger' }); return; }
    if (!file) { toast('Attach the certificate (PDF or image).', { variant: 'danger' }); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      if (form.equipment) fd.append('equipment', form.equipment);
      fd.append('cert_no', form.cert_no);
      fd.append('calib_date', form.calib_date || today());
      if (form.expiry_date) fd.append('expiry_date', form.expiry_date);
      fd.append('file', file);
      await api.post('/api/calibration-certs/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm({ equipment: '', cert_no: '', calib_date: today(), expiry_date: '' });
      setFile(null); setFileKey((k) => k + 1);
      await load();
      toast('Calibration certificate uploaded ✓ Stored permanently on the server.', { variant: 'success' });
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const del = async (c) => {
    if (!window.confirm(`Delete certificate ${c.cert_no}?`)) return;
    try { await api.delete(`/api/calibration-certs/${c.id}/`); await load(); toast('Certificate deleted.'); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  const eqName = eqFilter && equip.find((e) => String(e.id) === eqFilter)?.name;

  return (
    <>
      <div className="card">
        <div className="card-header">Upload Calibration Certificate</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">Equipment Name</label>
              <select className="form-select form-select-sm" value={form.equipment} onChange={f('equipment')}>
                <option value="">— Select equipment —</option>
                {equip.map((e) => <option key={e.id} value={e.id}>{e.name}{e.equipment_id ? ` (${e.equipment_id})` : ''}</option>)}
              </select>
            </div>
            <div className="col-md-2"><label className="form-label">Certificate No. *</label><input className="form-control form-control-sm" value={form.cert_no} onChange={f('cert_no')} /></div>
            <div className="col-md-2"><label className="form-label">Calibration Date</label><input type="date" className="form-control form-control-sm" value={form.calib_date} onChange={f('calib_date')} /></div>
            <div className="col-md-2"><label className="form-label">Expiry Date</label><input type="date" className="form-control form-control-sm" value={form.expiry_date} onChange={f('expiry_date')} /></div>
            <div className="col-md-3"><label className="form-label">Certificate (PDF / image) *</label>
              <input key={fileKey} type="file" className="form-control form-control-sm" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <button className="btn btn-gold btn-sm mt-3" disabled={busy} onClick={upload}>⇪ Upload certificate</button>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header d-flex align-items-center gap-2">Calibration Certificates
          {eqName && <span className="abadge b-open">Filtered: {eqName}</span>}
          {eqFilter && <button className="btn btn-sm btn-outline-navy ms-auto" onClick={() => setParams({})}>Show all</button>}
        </div>
        <div className="card-body">
          {!list.length ? <Empty label="No calibration certificates uploaded yet." /> : (
            <div className="table-responsive">
              <table className="table table-sm tbl align-middle">
                <thead><tr><th>Equipment</th><th>Certificate No.</th><th>Calibration Date</th><th>Expiry Date</th><th>Uploaded By</th><th style={{ width: 230 }}>Actions</th></tr></thead>
                <tbody>{list.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.equipment_name || '—'}</b></td>
                    <td>{c.cert_no}</td>
                    <td>{fmtD(c.calib_date)}</td>
                    <td>{c.expiry_date ? <>{fmtD(c.expiry_date)} {c.expired && <span className="abadge b-fail">Expired</span>}</> : '—'}</td>
                    <td className="small">{c.uploaded_by}</td>
                    <td className="text-nowrap">
                      <a className="btn btn-sm btn-outline-navy me-1" href={fileUrl(c.file)} target="_blank" rel="noreferrer">View</a>
                      <a className="btn btn-sm btn-outline-navy me-1" href={fileUrl(c.file)} download>Download</a>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => del(c)}>Delete</button>
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
