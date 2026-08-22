import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api';
import { Empty } from '../components/Bits';
import { useApp } from '../ctx';
import { fmtD, today } from '../lib/format';

const S_CLS = { Pending: 'b-pending', Dispatched: 'b-s2', Delivered: 'b-pass' };
const BLANK = { trf: '', client_name: '', courier_name: '', tracking_no: '', dispatch_date: '', sent_by: '', status: 'Pending' };

export default function DispatchPage() {
  const { user, settings, toast } = useApp();
  const [list, setList] = useState([]);
  const [trfs, setTrfs] = useState([]);
  const [form, setForm] = useState({ ...BLANK, dispatch_date: today(), sent_by: user.name });
  const [busy, setBusy] = useState(false);
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = useCallback(() => api.get('/api/dispatches/').then((r) => setList(r.data)), []);
  useEffect(() => {
    load().catch((e) => toast(errMsg(e), { variant: 'danger' }));
    api.get('/api/trfs/').then((r) => setTrfs(r.data)).catch(() => {});
  }, [load, toast]);

  const pickTrf = (e) => {
    const id = e.target.value;
    const t = trfs.find((x) => String(x.id) === id);
    setForm({ ...form, trf: id, client_name: t ? t.customer_company : form.client_name });
  };

  const save = async () => {
    if (!form.client_name.trim()) { toast('Client name is required.', { variant: 'danger' }); return; }
    if (!form.courier_name.trim()) { toast('Courier name is required.', { variant: 'danger' }); return; }
    setBusy(true);
    try {
      await api.post('/api/dispatches/', { ...form, trf: form.trf || null });
      setForm({ ...BLANK, dispatch_date: today(), sent_by: user.name });
      await load();
      toast('Dispatch recorded ✓', { variant: 'success' });
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const setStatus = async (d, status) => {
    try {
      await api.patch(`/api/dispatches/${d.id}/`, { status });
      setList((l) => l.map((x) => (x.id === d.id ? { ...x, status } : x)));
      toast(`${d.no} → ${status}`, { variant: 'success' });
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  const del = async (d) => {
    if (!window.confirm(`Delete dispatch ${d.no}?`)) return;
    try { await api.delete(`/api/dispatches/${d.id}/`); await load(); toast('Dispatch deleted.'); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  return (
    <>
      <div className="card">
        <div className="card-header d-flex align-items-center">New Dispatch
          {settings?.next_numbers?.dsp && <span className="abadge b-open ms-auto">Next: {settings.next_numbers.dsp}</span>}
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3"><label className="form-label">TRF Number</label>
              <select className="form-select form-select-sm" value={form.trf} onChange={pickTrf}>
                <option value="">— Link a TRF (optional) —</option>
                {trfs.map((t) => <option key={t.id} value={t.id}>{t.no} — {t.customer_company}</option>)}
              </select>
            </div>
            <div className="col-md-3"><label className="form-label">Client Name *</label><input className="form-control form-control-sm" value={form.client_name} onChange={f('client_name')} /></div>
            <div className="col-md-3"><label className="form-label">Courier Name *</label><input className="form-control form-control-sm" value={form.courier_name} onChange={f('courier_name')} placeholder="e.g., BlueDart / DTDC" /></div>
            <div className="col-md-3"><label className="form-label">Tracking Number</label><input className="form-control form-control-sm" value={form.tracking_no} onChange={f('tracking_no')} /></div>
            <div className="col-md-3"><label className="form-label">Dispatch Date</label><input type="date" className="form-control form-control-sm" value={form.dispatch_date} onChange={f('dispatch_date')} /></div>
            <div className="col-md-3"><label className="form-label">Sent By</label><input className="form-control form-control-sm" value={form.sent_by} onChange={f('sent_by')} /></div>
            <div className="col-md-3"><label className="form-label">Status</label>
              <select className="form-select form-select-sm" value={form.status} onChange={f('status')}>
                <option>Pending</option><option>Dispatched</option><option>Delivered</option>
              </select>
            </div>
          </div>
          <button className="btn btn-gold btn-sm mt-3" disabled={busy} onClick={save}>Save dispatch</button>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header">Dispatch Register</div>
        <div className="card-body">
          {!list.length ? <Empty label="No dispatches recorded yet." /> : (
            <div className="table-responsive">
              <table className="table table-sm tbl align-middle" style={{ minWidth: 1050 }}>
                <thead><tr><th>Dispatch No.</th><th>Date</th><th>TRF</th><th>Client</th><th>Courier</th><th>Tracking No.</th><th>Sent By</th><th>Status</th><th style={{ width: 90 }}></th></tr></thead>
                <tbody>{list.map((d) => (
                  <tr key={d.id}>
                    <td><b>{d.no}</b></td>
                    <td>{fmtD(d.dispatch_date)}</td>
                    <td>{d.trf ? <Link to={'/test/' + d.trf}>{d.trf_no}</Link> : (d.trf_no || '—')}</td>
                    <td>{d.client_name}</td>
                    <td>{d.courier_name || '—'}</td>
                    <td className="small">{d.tracking_no || '—'}</td>
                    <td className="small">{d.sent_by}</td>
                    <td>
                      <span className={'abadge me-2 ' + (S_CLS[d.status] || 'b-grey')}>{d.status}</span>
                      <select className="form-select form-select-sm d-inline-block" style={{ width: 130 }}
                        value={d.status} onChange={(e) => setStatus(d, e.target.value)}>
                        <option>Pending</option><option>Dispatched</option><option>Delivered</option>
                      </select>
                    </td>
                    <td><button className="btn btn-sm btn-outline-danger" onClick={() => del(d)}>Delete</button></td>
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
