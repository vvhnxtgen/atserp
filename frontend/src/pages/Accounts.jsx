import { useCallback, useEffect, useState } from 'react';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { useLocation } from 'react-router-dom';
import api, { errMsg } from '../api';
import { Empty, StatCard } from '../components/Bits';
import ItemsEditor from '../components/ItemsEditor';
import MoneyChart from '../components/MoneyChart';
import { useApp } from '../ctx';
import { buildInvoiceDoc, buildIpoDoc, openPrintWindow, printDocument } from '../lib/docs';
import { fmtD, inr, num, today } from '../lib/format';

const IBLANK = [{ desc: '', sac: '998346', qty: 1, rate: '' }];
const PBLANK = [{ desc: '', qty: 1, rate: '' }];
const IPO_CATS = ['Consumables', 'Tools & Maintenance', 'Calibration Services', 'Office / Admin', 'Other'];

export default function Accounts() {
  const { settings, toast, notify } = useApp();
  const location = useLocation();
  const preTrf = location.state?.trfId || '';
  const [tab, setTab] = useState('inv');

  const [trfs, setTrfs] = useState([]);
  const [pos, setPos] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [ipos, setIpos] = useState([]);
  const [busy, setBusy] = useState(false);

  // invoice form
  const [trfId, setTrfId] = useState('');
  const [inv, setInv] = useState({ date: today(), po_no_sel: '', customer_company: '', customer_gst: '', customer_contact: '', customer_addr: '', notes: '' });
  const [invItems, setInvItems] = useState(IBLANK);
  const [invGst, setInvGst] = useState('');

  // internal PO form
  const [ip, setIp] = useState({ date: today(), vendor: '', vendor_addr: '', category: IPO_CATS[0], notes: '' });
  const [ipItems, setIpItems] = useState(PBLANK);
  const [ipGst, setIpGst] = useState('');

  // finance
  const [fin, setFin] = useState(null);
  const [mode, setMode] = useState('CY');
  const [year, setYear] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, b, c, d] = await Promise.all([
        api.get('/api/trfs/'), api.get('/api/customer-pos/'),
        api.get('/api/invoices/'), api.get('/api/internal-pos/')]);
      setTrfs(a.data); setPos(b.data); setInvoices(c.data); setIpos(d.data);
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const loadFin = useCallback(async () => {
    try {
      const p = new URLSearchParams({ mode });
      if (year) p.set('year', year);
      const { data } = await api.get('/api/finance/?' + p);
      setFin(data);
      if (!year) setYear(String(data.year));
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  }, [mode, year, toast]);
  useEffect(() => { loadFin(); }, [loadFin]);

  const pickTrf = useCallback(async (id) => {
    setTrfId(id);
    if (!id) { setInvItems(IBLANK); return; }
    try {
      const { data: t } = await api.get(`/api/trfs/${id}/`);
      const match = pos.find((p) => p.customer.toLowerCase() === t.customer_company.toLowerCase());
      setInv((v) => ({ ...v, customer_company: t.customer_company, customer_gst: t.customer_gst || '', customer_contact: t.customer_contact || '', customer_addr: t.customer_addr || '', po_no_sel: match ? String(match.id) : v.po_no_sel }));
      setInvItems(t.tests.length
        ? t.tests.map((x) => ({ desc: x.test + (x.std ? ' — ' + x.std : '') + (x.dur ? ` (${x.dur})` : ''), sac: '998346', qty: 1, rate: '' }))
        : IBLANK);
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  }, [pos, toast]);

  useEffect(() => { if (preTrf && trfs.length) { setTab('inv'); pickTrf(String(preTrf)); } }, [preTrf, trfs.length, pickTrf]);

  const invGstRate = invGst === '' ? num(settings?.gst_default) : num(invGst);
  const ipGstRate = ipGst === '' ? num(settings?.gst_default) : num(ipGst);
  const invSub = invItems.reduce((a, r) => a + num(r.qty) * num(r.rate), 0);

  const saveInvoice = async () => {
    if (!trfId) { toast('Select the TRF this invoice is raised against — invoices stay traceable to a TRF number.', { variant: 'danger' }); return; }
    const items = invItems.filter((r) => r.desc.trim()).map((r) => ({ desc: r.desc.trim(), sac: r.sac, qty: num(r.qty) || 1, rate: num(r.rate) }));
    if (!items.length || !items.some((x) => x.rate > 0)) { toast('Add at least one line item with a rate.', { variant: 'danger' }); return; }
    const po = pos.find((p) => String(p.id) === inv.po_no_sel);
    const w = openPrintWindow();
    setBusy(true);
    try {
      const { data } = await api.post('/api/invoices/', {
        trf: trfId, date: inv.date || today(), po_no: po ? po.no : '',
        customer_company: inv.customer_company, customer_gst: inv.customer_gst,
        customer_contact: inv.customer_contact, customer_addr: inv.customer_addr,
        gst_rate: invGstRate, notes: inv.notes, items,
      });
      notify(`Invoice Raised — ${data.no}`,
        [`Against TRF: ${data.trf_no}`, `Customer: ${data.customer_company}`, `Amount: ${inr(data.total)}`], data.notify || data.email);
      printDocument('Invoice — ' + data.no, buildInvoiceDoc(data, settings), w);
      setTrfId(''); setInv({ date: today(), po_no_sel: '', customer_company: '', customer_gst: '', customer_contact: '', customer_addr: '', notes: '' });
      setInvItems(IBLANK); setInvGst('');
      load(); loadFin();
    } catch (e) { if (w) w.close(); toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const togglePaid = async (v) => {
    try { await api.post(`/api/invoices/${v.id}/toggle-paid/`); load(); loadFin(); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };
  const delInvoice = async (v) => {
    if (!window.confirm(`Delete invoice ${v.no}?`)) return;
    try { await api.delete(`/api/invoices/${v.id}/`); load(); loadFin(); } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  const saveIpo = async () => {
    const items = ipItems.filter((r) => r.desc.trim()).map((r) => ({ desc: r.desc.trim(), qty: num(r.qty) || 1, rate: num(r.rate) }));
    if (!ip.vendor.trim() || !items.length) { toast('Vendor and at least one item are required.', { variant: 'danger' }); return; }
    const w = openPrintWindow();
    setBusy(true);
    try {
      const { data } = await api.post('/api/internal-pos/', { ...ip, vendor: ip.vendor.trim(), date: ip.date || today(), gst_rate: ipGstRate, items });
      toast(`Internal PO ${data.no} saved ✓`, { variant: 'success' });
      printDocument('Internal PO — ' + data.no, buildIpoDoc(data, settings), w);
      setIp({ date: today(), vendor: '', vendor_addr: '', category: IPO_CATS[0], notes: '' });
      setIpItems(PBLANK); setIpGst('');
      load(); loadFin();
    } catch (e) { if (w) w.close(); toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };
  const delIpo = async (p) => {
    if (!window.confirm(`Delete internal PO ${p.no}?`)) return;
    try { await api.delete(`/api/internal-pos/${p.id}/`); load(); loadFin(); } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  return (
    <Tabs activeKey={tab} onSelect={setTab} className="mb-3">
      {/* ------------------------------ Invoices ------------------------------ */}
      <Tab eventKey="inv" title="Invoices">
        <div className="card mb-3">
          <div className="card-header d-flex">New invoice — traced to a TRF
            <span className="ms-auto abadge b-gold">Next: {settings?.next_numbers?.inv}</span>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Against TRF *</label>
                <select className="form-select form-select-sm" value={trfId} onChange={(e) => pickTrf(e.target.value)}>
                  <option value="">— Select TRF —</option>
                  {trfs.map((t) => <option key={t.id} value={t.id}>{t.no} — {t.customer_company}</option>)}
                </select>
              </div>
              <div className="col-md-2"><label className="form-label">Invoice date</label><input type="date" className="form-control form-control-sm" value={inv.date} onChange={(e) => setInv({ ...inv, date: e.target.value })} /></div>
              <div className="col-md-3">
                <label className="form-label">Customer PO</label>
                <select className="form-select form-select-sm" value={inv.po_no_sel} onChange={(e) => setInv({ ...inv, po_no_sel: e.target.value })}>
                  <option value="">— None —</option>
                  {pos.map((p) => <option key={p.id} value={p.id}>{p.no} — {p.customer}</option>)}
                </select>
              </div>
              <div className="col-md-3"><label className="form-label">GST %</label><input type="number" className="form-control form-control-sm" placeholder={String(settings?.gst_default ?? 18)} value={invGst} onChange={(e) => setInvGst(e.target.value)} /></div>
              <div className="col-md-4"><label className="form-label">Bill to (company)</label><input className="form-control form-control-sm" value={inv.customer_company} onChange={(e) => setInv({ ...inv, customer_company: e.target.value })} /></div>
              <div className="col-md-2"><label className="form-label">GSTIN</label><input className="form-control form-control-sm" value={inv.customer_gst} onChange={(e) => setInv({ ...inv, customer_gst: e.target.value })} /></div>
              <div className="col-md-3"><label className="form-label">Contact</label><input className="form-control form-control-sm" value={inv.customer_contact} onChange={(e) => setInv({ ...inv, customer_contact: e.target.value })} /></div>
              <div className="col-md-3"><label className="form-label">Address</label><input className="form-control form-control-sm" value={inv.customer_addr} onChange={(e) => setInv({ ...inv, customer_addr: e.target.value })} /></div>
              <div className="col-12"><label className="form-label">Notes (on PDF)</label><input className="form-control form-control-sm" value={inv.notes} onChange={(e) => setInv({ ...inv, notes: e.target.value })} /></div>
            </div>
            <div className="eyebrow mt-4 mb-2">Line items <span className="text-secondary text-lowercase" style={{ letterSpacing: 0 }}>(auto-filled from the TRF's tests)</span></div>
            <ItemsEditor
              columns={[
                { key: 'desc', label: 'Description', width: '40%' },
                { key: 'sac', label: 'SAC', width: '10%', def: '998346' },
                { key: 'qty', label: 'Qty', type: 'number', width: '9%', def: 1 },
                { key: 'rate', label: 'Rate (₹)', type: 'number', width: '15%' },
              ]}
              rows={invItems} onChange={setInvItems} amount
            />
            <div className="d-flex flex-wrap align-items-center gap-3 mt-2">
              <button className="btn btn-gold btn-sm" disabled={busy} onClick={saveInvoice}>Save invoice &amp; generate PDF</button>
              <span className="text-secondary small">Sub {inr(invSub)} · CGST {inr(invSub * invGstRate / 200)} · SGST {inr(invSub * invGstRate / 200)} · <b>Total {inr(invSub * (1 + invGstRate / 100))}</b></span>
            </div>
          </div>
        </div>

        <div className="card"><div className="card-body">
          {!invoices.length ? <Empty title="No invoices yet">Select a TRF above — customer details and test lines fill in automatically.</Empty> : (
            <div className="table-responsive">
              <table className="table tbl align-middle">
                <thead><tr><th>Invoice No.</th><th>Date</th><th>TRF Ref.</th><th>Customer</th><th className="text-end">Amount</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {invoices.map((v) => (
                    <tr key={v.id}>
                      <td className="num">{v.no}</td>
                      <td className="text-nowrap">{fmtD(v.date)}</td>
                      <td className="num">{v.trf_no}</td>
                      <td>{v.customer_company}</td>
                      <td className="text-end num">{inr(v.total, 0)}</td>
                      <td><button className="btn btn-sm p-0 border-0" title="Click to toggle" onClick={() => togglePaid(v)}><span className={'abadge b-' + v.status.toLowerCase()}>{v.status}</span></button></td>
                      <td className="text-nowrap">
                        <button className="btn btn-sm btn-outline-navy me-1" onClick={() => printDocument('Invoice — ' + v.no, buildInvoiceDoc(v, settings))}>PDF</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => delInvoice(v)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div></div>
      </Tab>

      {/* ---------------------------- Internal POs ---------------------------- */}
      <Tab eventKey="ipo" title="Internal POs">
        <div className="card mb-3">
          <div className="card-header d-flex">New internal purchase order
            <span className="ms-auto abadge b-gold">Next: {settings?.next_numbers?.ipo}</span>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4"><label className="form-label">Vendor *</label><input className="form-control form-control-sm" value={ip.vendor} onChange={(e) => setIp({ ...ip, vendor: e.target.value })} /></div>
              <div className="col-md-4"><label className="form-label">Vendor address</label><input className="form-control form-control-sm" value={ip.vendor_addr} onChange={(e) => setIp({ ...ip, vendor_addr: e.target.value })} /></div>
              <div className="col-md-2"><label className="form-label">Category</label>
                <select className="form-select form-select-sm" value={ip.category} onChange={(e) => setIp({ ...ip, category: e.target.value })}>
                  {IPO_CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-md-2"><label className="form-label">PO date</label><input type="date" className="form-control form-control-sm" value={ip.date} onChange={(e) => setIp({ ...ip, date: e.target.value })} /></div>
              <div className="col-md-2"><label className="form-label">GST %</label><input type="number" className="form-control form-control-sm" placeholder={String(settings?.gst_default ?? 18)} value={ipGst} onChange={(e) => setIpGst(e.target.value)} /></div>
              <div className="col-md-10"><label className="form-label">Notes (on PDF)</label><input className="form-control form-control-sm" value={ip.notes} onChange={(e) => setIp({ ...ip, notes: e.target.value })} /></div>
            </div>
            <div className="eyebrow mt-4 mb-2">Items</div>
            <ItemsEditor
              columns={[
                { key: 'desc', label: 'Item', width: '50%' },
                { key: 'qty', label: 'Qty', type: 'number', width: '10%', def: 1 },
                { key: 'rate', label: 'Rate (₹)', type: 'number', width: '16%' },
              ]}
              rows={ipItems} onChange={setIpItems} amount
            />
            <button className="btn btn-gold btn-sm mt-2" disabled={busy} onClick={saveIpo}>Save internal PO &amp; generate PDF</button>
          </div>
        </div>

        <div className="card"><div className="card-body">
          {!ipos.length ? <Empty title="No internal POs">Raise purchase orders for consumables, tools and maintenance — they count as spend on the finance dashboard.</Empty> : (
            <div className="table-responsive">
              <table className="table tbl align-middle">
                <thead><tr><th>PO No.</th><th>Date</th><th>Vendor</th><th>Category</th><th className="text-end">Amount</th><th>Actions</th></tr></thead>
                <tbody>
                  {ipos.map((p) => (
                    <tr key={p.id}>
                      <td className="num">{p.no}</td>
                      <td className="text-nowrap">{fmtD(p.date)}</td>
                      <td>{p.vendor}</td>
                      <td><span className="abadge b-grey">{p.category}</span></td>
                      <td className="text-end num">{inr(p.total, 0)}</td>
                      <td className="text-nowrap">
                        <button className="btn btn-sm btn-outline-navy me-1" onClick={() => printDocument('Internal PO — ' + p.no, buildIpoDoc(p, settings))}>PDF</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => delIpo(p)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div></div>
      </Tab>

      {/* ------------------------------ Finance ------------------------------ */}
      <Tab eventKey="fin" title="Finance Dashboard">
        {fin && (
          <>
            <div className="d-flex flex-wrap gap-2 mb-3">
              <select className="form-select form-select-sm" style={{ maxWidth: 220 }} value={mode} onChange={(e) => { setMode(e.target.value); setYear(''); }}>
                <option value="CY">Calendar year (Jan–Dec)</option>
                <option value="FY">Financial year (Apr–Mar)</option>
              </select>
              <select className="form-select form-select-sm" style={{ maxWidth: 160 }} value={year} onChange={(e) => setYear(e.target.value)}>
                {fin.years.map((y) => <option key={y} value={y}>{mode === 'FY' ? `FY ${y}–${String(y + 1).slice(2)}` : y}</option>)}
              </select>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6 col-md-3"><StatCard k="Revenue" v={inr(fin.cards.revenue, 0)} s={`${fin.cards.invoices} invoice${fin.cards.invoices === 1 ? '' : 's'} raised`} /></div>
              <div className="col-6 col-md-3"><StatCard k="Spend" v={inr(fin.cards.spend, 0)} s="internal purchase orders" alt /></div>
              <div className="col-6 col-md-3"><StatCard k="Net" v={inr(fin.cards.net, 0)} s={fin.cards.net >= 0 ? 'surplus' : 'deficit'} /></div>
              <div className="col-6 col-md-3"><StatCard k="Receivables" v={inr(fin.cards.receivables, 0)} s="unpaid for this period" alt /></div>
            </div>
            <div className="card mb-3">
              <div className="card-header">Monthly revenue vs spend</div>
              <div className="card-body"><MoneyChart labels={fin.labels} revenue={fin.revenue} spend={fin.spend} /></div>
            </div>
            <div className="card">
              <div className="card-header">Year-wise summary</div>
              <div className="card-body">
                {!fin.year_rows.length ? <Empty title="No financial data yet">Raise invoices and internal POs to populate this summary.</Empty> : (
                  <div className="table-responsive">
                    <table className="table tbl align-middle">
                      <thead><tr><th>Period</th><th className="text-end">Revenue</th><th className="text-end">Spend</th><th className="text-end">Net</th></tr></thead>
                      <tbody>
                        {fin.year_rows.map((r) => (
                          <tr key={r.year}>
                            <td className="num">{mode === 'FY' ? `FY ${r.year}–${String(r.year + 1).slice(2)}` : r.year}</td>
                            <td className="text-end">{inr(r.revenue, 0)}</td>
                            <td className="text-end">{inr(r.spend, 0)}</td>
                            <td className="text-end" style={{ color: r.net >= 0 ? '#1F8A5B' : '#B03A2E', fontWeight: 600 }}>{inr(r.net, 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Tab>
    </Tabs>
  );
}
