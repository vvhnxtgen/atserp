import { useCallback, useEffect, useState } from 'react';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import api, { errMsg, fileUrl } from '../api';
import { Empty } from '../components/Bits';
import { IndentTable, RaiseIndentModal } from '../components/Indents';
import ItemsEditor from '../components/ItemsEditor';
import { useApp } from '../ctx';
import { buildQuotationDoc, openPrintWindow, printDocument } from '../lib/docs';
import { fmtD, inr, num, today } from '../lib/format';

const QBLANK = [{ desc: '', qty: 1, rate: '' }];
const QF = { customer_company: '', customer_contact: '', customer_phone: '', customer_email: '', customer_addr: '', customer_gst: '', subject: '', validity: 30, notes: '' };

export default function Business() {
  const { settings, toast, notify } = useApp();
  const [quotes, setQuotes] = useState([]);
  const [pos, setPos] = useState([]);
  const [indents, setIndents] = useState([]);
  const [showRaise, setShowRaise] = useState(false);

  const [qf, setQf] = useState(QF);
  const [qItems, setQItems] = useState(QBLANK);
  const [qGst, setQGst] = useState('');

  const [pf, setPf] = useState({ no: '', customer: '', date: today(), amount: '', quotation: '' });
  const [poFile, setPoFile] = useState(null);
  const [poKey, setPoKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([
        api.get('/api/quotations/'), api.get('/api/customer-pos/'), api.get('/api/indents/')]);
      setQuotes(a.data); setPos(b.data); setIndents(c.data);
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const gstRate = qGst === '' ? num(settings?.gst_default) : num(qGst);
  const qSub = qItems.reduce((a, r) => a + num(r.qty) * num(r.rate), 0);

  const saveQuote = async () => {
    const items = qItems.filter((r) => r.desc.trim()).map((r) => ({ desc: r.desc.trim(), qty: num(r.qty) || 1, rate: num(r.rate) }));
    if (!qf.customer_company.trim() || !items.length) { toast('Customer and at least one line item are required.', { variant: 'danger' }); return; }
    const w = openPrintWindow();
    setBusy(true);
    try {
      const { data } = await api.post('/api/quotations/', { ...qf, validity: num(qf.validity) || 30, gst_rate: gstRate, items });
      toast(`Quotation ${data.no} saved ✓`, { variant: 'success' });
      printDocument('Quotation — ' + data.no, buildQuotationDoc(data, settings), w);
      setQf(QF); setQItems(QBLANK); setQGst('');
      load();
    } catch (e) { if (w) w.close(); toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const delQuote = async (q) => {
    if (!window.confirm(`Delete quotation ${q.no}?`)) return;
    try { await api.delete(`/api/quotations/${q.id}/`); load(); } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  const uploadPO = async () => {
    if (!pf.no.trim() || !pf.customer.trim()) { toast('PO number and Customer are required.', { variant: 'danger' }); return; }
    if (!poFile) { toast('Choose the PO file first.', { variant: 'danger' }); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('no', pf.no); fd.append('customer', pf.customer); fd.append('date', pf.date || today());
      if (pf.amount !== '') fd.append('amount', num(pf.amount));
      if (pf.quotation) fd.append('quotation', pf.quotation);
      fd.append('file', poFile);
      const { data } = await api.post('/api/customer-pos/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      notify(`Customer PO Received — ${data.no}`,
        [`Customer: ${data.customer}`, data.amount ? `Value: ${inr(data.amount, 0)}` : '',
          data.quotation_no ? `Against quotation: ${data.quotation_no}` : ''], data.notify || data.email);
      setPf({ no: '', customer: '', date: today(), amount: '', quotation: '' });
      setPoFile(null); setPoKey((k) => k + 1);
      load();
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const delPO = async (p) => {
    if (!window.confirm(`Delete PO ${p.no}?`)) return;
    try { await api.delete(`/api/customer-pos/${p.id}/`); load(); } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  const pending = indents.filter((i) => i.status === 'Pending').length;

  return (
    <>
      <Tabs defaultActiveKey="q" className="mb-3">
        <Tab eventKey="q" title="Quotations">
          <div className="card mb-3">
            <div className="card-header d-flex">New quotation
              <span className="ms-auto abadge b-gold">Next: {settings?.next_numbers?.qtn}</span>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4"><label className="form-label">Customer / Company *</label><input className="form-control form-control-sm" value={qf.customer_company} onChange={(e) => setQf({ ...qf, customer_company: e.target.value })} /></div>
                <div className="col-md-4"><label className="form-label">Kind attention</label><input className="form-control form-control-sm" value={qf.customer_contact} onChange={(e) => setQf({ ...qf, customer_contact: e.target.value })} /></div>
                <div className="col-md-4"><label className="form-label">Phone</label><input className="form-control form-control-sm" value={qf.customer_phone} onChange={(e) => setQf({ ...qf, customer_phone: e.target.value })} /></div>
                <div className="col-md-4"><label className="form-label">Email</label><input className="form-control form-control-sm" value={qf.customer_email} onChange={(e) => setQf({ ...qf, customer_email: e.target.value })} /></div>
                <div className="col-md-4"><label className="form-label">GSTIN</label><input className="form-control form-control-sm" value={qf.customer_gst} onChange={(e) => setQf({ ...qf, customer_gst: e.target.value })} /></div>
                <div className="col-md-4"><label className="form-label">Address</label><input className="form-control form-control-sm" value={qf.customer_addr} onChange={(e) => setQf({ ...qf, customer_addr: e.target.value })} /></div>
                <div className="col-md-6"><label className="form-label">Subject</label><input className="form-control form-control-sm" value={qf.subject} onChange={(e) => setQf({ ...qf, subject: e.target.value })} /></div>
                <div className="col-md-2"><label className="form-label">Validity (days)</label><input type="number" className="form-control form-control-sm" value={qf.validity} onChange={(e) => setQf({ ...qf, validity: e.target.value })} /></div>
                <div className="col-md-2"><label className="form-label">GST %</label><input type="number" className="form-control form-control-sm" placeholder={String(settings?.gst_default ?? 18)} value={qGst} onChange={(e) => setQGst(e.target.value)} /></div>
                <div className="col-md-2"><label className="form-label">Notes (on PDF)</label><input className="form-control form-control-sm" value={qf.notes} onChange={(e) => setQf({ ...qf, notes: e.target.value })} /></div>
              </div>
              <div className="eyebrow mt-4 mb-2">Line items</div>
              <ItemsEditor
                columns={[
                  { key: 'desc', label: 'Description of test / service', width: '46%' },
                  { key: 'qty', label: 'Qty', type: 'number', width: '10%', def: 1 },
                  { key: 'rate', label: 'Rate (₹)', type: 'number', width: '16%' },
                ]}
                rows={qItems} onChange={setQItems} amount
              />
              <div className="d-flex flex-wrap align-items-center gap-3 mt-2">
                <button className="btn btn-gold btn-sm" disabled={busy} onClick={saveQuote}>Save quotation &amp; generate PDF</button>
                <span className="text-secondary small">Sub {inr(qSub)} · GST {inr(qSub * gstRate / 100)} · <b>Total {inr(qSub * (1 + gstRate / 100))}</b></span>
              </div>
            </div>
          </div>

          <div className="card"><div className="card-body">
            {!quotes.length ? <Empty title="No quotations yet">Create a quotation above — it saves here and opens as a printable PDF.</Empty> : (
              <div className="table-responsive">
                <table className="table tbl align-middle">
                  <thead><tr><th>Quotation No.</th><th>Date</th><th>Customer</th><th className="text-end">Amount</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {quotes.map((qt) => (
                      <tr key={qt.id}>
                        <td className="num">{qt.no}</td>
                        <td className="text-nowrap">{fmtD(qt.date)}</td>
                        <td>{qt.customer_company}</td>
                        <td className="text-end num">{inr(qt.total, 0)}</td>
                        <td>{qt.po_received ? <span className="abadge b-approved">PO received</span> : <span className="abadge b-open">Open</span>}</td>
                        <td className="text-nowrap">
                          <button className="btn btn-sm btn-outline-navy me-1" onClick={() => printDocument('Quotation — ' + qt.no, buildQuotationDoc(qt, settings))}>PDF</button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => delQuote(qt)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div></div>
        </Tab>

        <Tab eventKey="pos" title="Customer POs">
          <div className="card mb-3">
            <div className="card-header">Upload customer PO</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3"><label className="form-label">PO number *</label><input className="form-control form-control-sm" value={pf.no} onChange={(e) => setPf({ ...pf, no: e.target.value })} /></div>
                <div className="col-md-3"><label className="form-label">Customer *</label><input className="form-control form-control-sm" value={pf.customer} onChange={(e) => setPf({ ...pf, customer: e.target.value })} /></div>
                <div className="col-md-2"><label className="form-label">PO date</label><input type="date" className="form-control form-control-sm" value={pf.date} onChange={(e) => setPf({ ...pf, date: e.target.value })} /></div>
                <div className="col-md-2"><label className="form-label">Value (₹)</label><input type="number" className="form-control form-control-sm" value={pf.amount} onChange={(e) => setPf({ ...pf, amount: e.target.value })} /></div>
                <div className="col-md-2"><label className="form-label">Against quotation</label>
                  <select className="form-select form-select-sm" value={pf.quotation} onChange={(e) => setPf({ ...pf, quotation: e.target.value })}>
                    <option value="">— None —</option>
                    {quotes.map((qt) => <option key={qt.id} value={qt.id}>{qt.no}</option>)}
                  </select>
                </div>
                <div className="col-md-6"><label className="form-label">PO file *</label><input key={poKey} type="file" className="form-control form-control-sm" onChange={(e) => setPoFile(e.target.files?.[0] || null)} /></div>
                <div className="col-md-6 d-flex align-items-end"><button className="btn btn-gold btn-sm" disabled={busy} onClick={uploadPO}>Save customer PO</button></div>
              </div>
            </div>
          </div>
          <div className="card"><div className="card-body">
            {!pos.length ? <Empty title="No customer POs">Upload purchase orders received from customers to keep them traceable to quotations and invoices.</Empty> : (
              <div className="table-responsive">
                <table className="table tbl align-middle">
                  <thead><tr><th>PO No.</th><th>Date</th><th>Customer</th><th className="text-end">Value</th><th>Against Quotation</th><th>Actions</th></tr></thead>
                  <tbody>
                    {pos.map((p) => (
                      <tr key={p.id}>
                        <td className="num">{p.no}</td>
                        <td className="text-nowrap">{fmtD(p.date)}</td>
                        <td>{p.customer}</td>
                        <td className="text-end num">{p.amount ? inr(p.amount, 0) : '—'}</td>
                        <td className="num">{p.quotation_no || '—'}</td>
                        <td className="text-nowrap">
                          <a className="btn btn-sm btn-outline-navy me-1" href={fileUrl(p.file)} target="_blank" rel="noreferrer">View</a>
                          <a className="btn btn-sm btn-outline-navy me-1" href={fileUrl(p.file)} download>Download</a>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => delPO(p)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div></div>
        </Tab>

        <Tab eventKey="ind" title={<>Indents {pending > 0 && <span className="abadge b-pending ms-1">{pending}</span>}</>}>
          <div className="card"><div className="card-body">
            <div className="d-flex mb-3">
              <span className="text-secondary small align-self-center">Technician-raised material indents — approve or reject below.</span>
              <button className="btn btn-sm btn-gold ms-auto" onClick={() => setShowRaise(true)}>+ Raise indent</button>
            </div>
            <IndentTable rows={indents} admin onChanged={load} />
          </div></div>
        </Tab>
      </Tabs>
      <RaiseIndentModal show={showRaise} onHide={() => setShowRaise(false)} onDone={load} />
    </>
  );
}
