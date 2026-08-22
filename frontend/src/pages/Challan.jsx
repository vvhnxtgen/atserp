import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api';
import { Empty } from '../components/Bits';
import ItemsEditor from '../components/ItemsEditor';
import { useApp } from '../ctx';
import { buildChallanDoc, openPrintWindow, printDocument } from '../lib/docs';
import { fmtD, today } from '../lib/format';

const COLS = [
  { key: 'item', label: 'Item(s) Details', width: '50%', placeholder: 'Sample name, unique sample ID, item details…' },
  { key: 'qty', label: 'Quantity', width: '15%' },
  { key: 'remarks', label: 'Remarks', width: '35%' },
];
const BLANK = { date: '', trf: '', client_name: '', address: '', client_gst: '', report_no: '',
  copies: 1, courier: '', inv_ref: '', other_info: '', po_no: '', po_date: '', purpose: 'Sub-contracting' };

export default function Challan() {
  const { settings, toast } = useApp();
  const [list, setList] = useState([]);
  const [trfs, setTrfs] = useState([]);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({ ...BLANK, date: today() });
  const [items, setItems] = useState([{ item: 'Test report (hard copy)', qty: '1', remarks: '' }]);
  const [busy, setBusy] = useState(false);
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = useCallback(() => api.get('/api/challans/').then((r) => setList(r.data)), []);
  useEffect(() => {
    load().catch((e) => toast(errMsg(e), { variant: 'danger' }));
    api.get('/api/trfs/').then((r) => setTrfs(r.data)).catch(() => {});
    api.get('/api/lab-reports/').then((r) => setReports(r.data)).catch(() => {});
  }, [load, toast]);

  const pickTrf = (e) => {
    const id = e.target.value;
    const t = trfs.find((x) => String(x.id) === id);
    const rep = reports.find((r) => String(r.trf) === id);
    setForm({
      ...form, trf: id,
      client_name: t ? t.customer_company : form.client_name,
      client_gst: t?.customer_gst || form.client_gst,
      address: t?.customer_addr || form.address,
      report_no: rep ? rep.report_no : form.report_no,
      other_info: form.other_info || (t ? `TRF: ${t.no}` : ''),
    });
  };

  const save = async (print) => {
    if (!form.client_name.trim()) { toast('Client name is required.', { variant: 'danger' }); return; }
    const rows = items.filter((i) => i.item?.trim());
    if (!rows.length) { toast('Add at least one item line.', { variant: 'danger' }); return; }
    setBusy(true);
    const w = print ? openPrintWindow() : null;
    try {
      const { data } = await api.post('/api/challans/', {
        ...form, trf: form.trf || null, po_date: form.po_date || null, copies: Number(form.copies) || 1, items: rows,
      });
      setForm({ ...BLANK, date: today() });
      setItems([{ item: 'Test report (hard copy)', qty: '1', remarks: '' }]);
      await load();
      toast(`Delivery challan ${data.no} generated ✓`, { variant: 'success' });
      if (print) printDocument('Challan ' + data.no, buildChallanDoc(data, settings), w);
    } catch (e) { if (w) w.close(); toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const del = async (c) => {
    if (!window.confirm(`Delete challan ${c.no}?`)) return;
    try { await api.delete(`/api/challans/${c.id}/`); await load(); toast('Challan deleted.'); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  return (
    <>
      <div className="card">
        <div className="card-header d-flex align-items-center">Generate Delivery Challan
          {settings?.next_numbers?.dch && <span className="abadge b-open ms-auto">Next: {settings.next_numbers.dch}</span>}
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-2"><label className="form-label">Date</label><input type="date" className="form-control form-control-sm" value={form.date} onChange={f('date')} /></div>
            <div className="col-md-3"><label className="form-label">TRF Number</label>
              <select className="form-select form-select-sm" value={form.trf} onChange={pickTrf}>
                <option value="">— Link a TRF (optional) —</option>
                {trfs.map((t) => <option key={t.id} value={t.id}>{t.no} — {t.customer_company}</option>)}
              </select>
            </div>
            <div className="col-md-4"><label className="form-label">To / M/s (Client Name) *</label><input className="form-control form-control-sm" value={form.client_name} onChange={f('client_name')} /></div>
            <div className="col-md-3"><label className="form-label">Client GST No.</label><input className="form-control form-control-sm" value={form.client_gst} onChange={f('client_gst')} /></div>
            <div className="col-md-8"><label className="form-label">Address</label>
              <textarea rows="2" className="form-control form-control-sm" value={form.address} onChange={f('address')} /></div>
            <div className="col-md-4"><label className="form-label">Purpose</label>
              <select className="form-select form-select-sm" value={form.purpose} onChange={f('purpose')}>
                <option>Sub-contracting</option><option>Repairing</option><option>Others</option>
              </select>
            </div>
            <div className="col-md-2"><label className="form-label">P O No.</label><input className="form-control form-control-sm" value={form.po_no} onChange={f('po_no')} /></div>
            <div className="col-md-2"><label className="form-label">P O Date</label><input type="date" className="form-control form-control-sm" value={form.po_date} onChange={f('po_date')} /></div>
            <div className="col-md-3"><label className="form-label">Inv No./Date</label><input className="form-control form-control-sm" value={form.inv_ref} onChange={f('inv_ref')} placeholder="e.g., INV-102 / 05-08-2026" /></div>
            <div className="col-md-3"><label className="form-label">Report Number</label><input className="form-control form-control-sm" value={form.report_no} onChange={f('report_no')} /></div>
            <div className="col-md-2"><label className="form-label">No. of Copies</label><input type="number" min="1" className="form-control form-control-sm" value={form.copies} onChange={f('copies')} /></div>
            <div className="col-md-6"><label className="form-label">Any other Inf.</label><input className="form-control form-control-sm" value={form.other_info} onChange={f('other_info')} placeholder="Prints on the challan (auto-fills TRF ref)" /></div>
            <div className="col-md-6"><label className="form-label">Courier Details</label><input className="form-control form-control-sm" value={form.courier} onChange={f('courier')} placeholder="Courier · AWB no. (prints under Any other Inf.)" /></div>
          </div>
          <div className="mt-3"><ItemsEditor columns={COLS} rows={items} onChange={setItems} addLabel="+ Add item" /></div>
          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-gold btn-sm" disabled={busy} onClick={() => save(false)}>Generate challan</button>
            <button className="btn btn-outline-navy btn-sm" disabled={busy} onClick={() => save(true)}>Generate &amp; print</button>
          </div>
        </div>
      </div>

      <div className="card mt-3 mb-4">
        <div className="card-header">Challan Register</div>
        <div className="card-body">
          {!list.length ? <Empty label="No delivery challans generated yet." /> : (
            <div className="table-responsive">
              <table className="table table-sm tbl align-middle">
                <thead><tr><th>Challan No.</th><th>Date</th><th>Client</th><th>Purpose</th><th>TRF</th><th>Report No.</th><th>Copies</th><th style={{ width: 150 }}>Actions</th></tr></thead>
                <tbody>{list.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.no}</b></td>
                    <td>{fmtD(c.date)}</td>
                    <td>{c.client_name}</td>
                    <td className="small">{c.purpose || '—'}</td>
                    <td>{c.trf ? <Link to={'/test/' + c.trf}>{c.trf_no}</Link> : (c.trf_no || '—')}</td>
                    <td className="small">{c.report_no || '—'}</td>
                    <td>{c.copies}</td>
                    <td className="text-nowrap">
                      <button className="btn btn-sm btn-outline-navy me-1" onClick={() => printDocument('Challan ' + c.no, buildChallanDoc(c, settings))}>PDF</button>
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
