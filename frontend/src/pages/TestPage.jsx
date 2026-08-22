import { useCallback, useEffect, useState } from 'react';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { Empty, MiniDots, StageBadge } from '../components/Bits';
import ItemsEditor from '../components/ItemsEditor';
import { useApp } from '../ctx';
import { buildTrfDoc, openPrintWindow, printDocument } from '../lib/docs';
import { STAGES, fmtD } from '../lib/format';

const BLANK_TEST = [{ test: '', std: '', spec: '', dur: '' }];
const CF = { customer_company: '', customer_contact: '', customer_phone: '', customer_email: '', customer_addr: '', customer_gst: '', customer_ref: '', sample_desc: '', sample_qty: '', sample_part: '', sample_cond: '', batch_no: '', remarks: '', priority: 'Normal' };

export default function TestPage() {
  const { user, settings, toast, notify, autoPrint } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState('all');
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [stageF, setStageF] = useState(params.get('stage') || '');
  const [form, setForm] = useState(CF);
  const [tests, setTests] = useState(BLANK_TEST);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setList((await api.get('/api/trfs/')).data); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // ---- GST auto-fill: on a valid GSTIN, pull the saved customer (or parse state) ----
  const [gstInfo, setGstInfo] = useState({ state: '', found: false, msg: '' });
  const lookupGst = useCallback(async (raw) => {
    const g = (raw || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    if (g.length < 15) { setGstInfo({ state: '', found: false, msg: '' }); return; }
    try {
      const { data } = await api.get('/api/customers/by-gst/', { params: { gstin: g } });
      if (data.found && data.customer) {
        const c = data.customer;
        // fill only empty fields so we never clobber what the user already typed
        setForm((prev) => ({
          ...prev,
          customer_company: prev.customer_company || c.company || '',
          customer_contact: prev.customer_contact || c.contact || '',
          customer_phone: prev.customer_phone || c.phone || '',
          customer_email: prev.customer_email || c.email || '',
          customer_addr: prev.customer_addr || c.address || '',
        }));
        setGstInfo({ state: data.state, found: true, msg: `Auto-filled from saved customer · ${data.state}` });
        toast(`Customer found — details auto-filled (${c.company})`, { variant: 'success' });
      } else {
        setGstInfo({ state: data.state, found: false, msg: data.state ? `New customer · ${data.state}` : '' });
      }
    } catch { /* silent — lookup is a convenience */ }
  }, [toast]);

  const onGstChange = (e) => {
    const v = e.target.value;
    setForm((prev) => ({ ...prev, customer_gst: v }));
    lookupGst(v);
  };

  const register = async () => {
    const items = tests.filter((t) => t.test.trim());
    if (!form.customer_company.trim() || !form.customer_phone.trim() || !form.sample_desc.trim() || !items.length) {
      toast('Fill Customer, Phone, Sample and at least one Test.', { variant: 'danger' }); return;
    }
    const w = autoPrint ? openPrintWindow() : null;
    setBusy(true);
    try {
      const { data } = await api.post('/api/trfs/', { ...form, tests: items });
      notify(`New TRF Registered — ${data.no}`,
        [`Customer: ${form.customer_company}`, `Sample: ${form.sample_desc}`,
          'Tests: ' + items.map((x) => x.test).join(', '), `Priority: ${form.priority}`], data.notify || data.email);
      if (autoPrint) printDocument('TRF — ' + data.no, buildTrfDoc(data, settings), w);
      setForm(CF); setTests(BLANK_TEST);
      setGstInfo({ state: '', found: false, msg: '' });
      nav('/test/' + data.id);
    } catch (e) { if (w) w.close(); toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const pdf = async (id) => {
    const { data } = await api.get(`/api/trfs/${id}/`);
    printDocument('TRF — ' + data.no, buildTrfDoc(data, settings));
  };

  const del = async (t) => {
    if (!window.confirm(`Delete ${t.no}? Linked invoices keep the TRF number for records, but the TRF itself will be removed.`)) return;
    try { await api.delete(`/api/trfs/${t.id}/`); toast('TRF deleted.'); load(); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  const shown = list.filter((t) =>
    (!q || (t.no + ' ' + t.customer_company + ' ' + t.sample_desc).toLowerCase().includes(q.toLowerCase())) &&
    (!stageF || String(t.stage) === stageF));

  return (
    <Tabs activeKey={tab} onSelect={setTab} className="mb-3">
      <Tab eventKey="all" title="All TRFs">
        <div className="card">
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2 mb-3">
              <input className="form-control form-control-sm" style={{ maxWidth: 300 }} placeholder="Search TRF no, customer, sample…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="form-select form-select-sm" style={{ maxWidth: 220 }} value={stageF} onChange={(e) => setStageF(e.target.value)}>
                <option value="">All stages</option>
                {STAGES.map((s, i) => <option key={i} value={i + 1}>{i + 1} · {s}</option>)}
              </select>
              <button className="btn btn-sm btn-gold ms-auto" onClick={() => setTab('new')}>+ Register new TRF</button>
            </div>
            {!shown.length ? <Empty title="No TRFs found">Register a new TRF to start the workflow.</Empty> : (
              <div className="table-responsive">
                <table className="table tbl align-middle">
                  <thead><tr><th>TRF No.</th><th>Date</th><th>Customer</th><th>Sample</th><th>Progress</th><th>Stage</th><th>Actions</th></tr></thead>
                  <tbody>
                    {shown.map((t) => (
                      <tr key={t.id}>
                        <td><Link to={'/test/' + t.id} className="num text-decoration-none">{t.no}</Link>{t.priority === 'Urgent' && <span className="abadge b-fail ms-1">Urgent</span>}</td>
                        <td className="text-nowrap">{fmtD(t.date)}</td>
                        <td>{t.customer_company}</td>
                        <td>{t.sample_desc}</td>
                        <td><MiniDots stage={t.stage} /></td>
                        <td><StageBadge t={t} /></td>
                        <td className="text-nowrap">
                          <Link className="btn btn-sm btn-outline-navy me-1" to={'/test/' + t.id}>Open</Link>
                          <button className="btn btn-sm btn-outline-navy me-1" onClick={() => pdf(t.id)}>PDF</button>
                          {user.role === 'admin' && <button className="btn btn-sm btn-outline-danger" onClick={() => del(t)}>Delete</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Tab>

      <Tab eventKey="new" title="Register New TRF">
        <div className="card">
          <div className="card-header d-flex">Stage 1 · TRF — Customer &amp; Test Details
            <span className="ms-auto abadge b-gold">Next: {settings?.next_numbers?.trf}</span>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4"><label className="form-label">GSTIN <span className="text-secondary" style={{ fontWeight: 400 }}>— type to auto-fill</span></label>
                <input className="form-control" value={form.customer_gst} onChange={onGstChange} placeholder="15-digit GSTIN" maxLength={15} style={{ textTransform: 'uppercase' }} />
                {gstInfo.msg && <div className={'small mt-1 ' + (gstInfo.found ? 'text-success' : 'text-secondary')}>{gstInfo.found ? '✓ ' : '• '}{gstInfo.msg}</div>}
              </div>
              <div className="col-md-4"><label className="form-label">Customer / Company *</label><input className="form-control" value={form.customer_company} onChange={f('customer_company')} /></div>
              <div className="col-md-4"><label className="form-label">Contact person</label><input className="form-control" value={form.customer_contact} onChange={f('customer_contact')} /></div>
              <div className="col-md-4"><label className="form-label">Phone *</label><input className="form-control" value={form.customer_phone} onChange={f('customer_phone')} /></div>
              <div className="col-md-4"><label className="form-label">Email</label><input className="form-control" value={form.customer_email} onChange={f('customer_email')} /></div>
              <div className="col-md-4"><label className="form-label">Customer Ref / PO</label><input className="form-control" value={form.customer_ref} onChange={f('customer_ref')} /></div>
              <div className="col-12"><label className="form-label">Address</label><input className="form-control" value={form.customer_addr} onChange={f('customer_addr')} /></div>
              <div className="col-md-4"><label className="form-label">Sample / EUT description *</label><input className="form-control" value={form.sample_desc} onChange={f('sample_desc')} /></div>
              <div className="col-md-2"><label className="form-label">Qty</label><input className="form-control" value={form.sample_qty} onChange={f('sample_qty')} /></div>
              <div className="col-md-3"><label className="form-label">Part / Model No.</label><input className="form-control" value={form.sample_part} onChange={f('sample_part')} /></div>
              <div className="col-md-3"><label className="form-label">Condition on receipt</label><input className="form-control" value={form.sample_cond} onChange={f('sample_cond')} /></div>
              <div className="col-md-3"><label className="form-label">Batch No.</label><input className="form-control" value={form.batch_no} onChange={f('batch_no')} /></div>
              <div className="col-md-2"><label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={f('priority')}><option>Normal</option><option>Urgent</option></select>
              </div>
              <div className="col-md-7"><label className="form-label">Remarks</label><input className="form-control" value={form.remarks} onChange={f('remarks')} /></div>
            </div>

            <div className="eyebrow mt-4 mb-2">Tests required</div>
            <datalist id="dl-tests">{(settings?.test_types || []).map((t) => <option key={t} value={t} />)}</datalist>
            <ItemsEditor
              columns={[
                { key: 'test', label: 'Test *', placeholder: 'Test name', list: 'dl-tests', width: '24%' },
                { key: 'std', label: 'Standard / Method', placeholder: 'e.g., JSS 55555 / IEC 60068', width: '22%' },
                { key: 'spec', label: 'Specification & Conditions', placeholder: 'Temp / RH / cycles / severity…' },
                { key: 'dur', label: 'Duration', placeholder: 'e.g., 96 h', width: '12%' },
              ]}
              rows={tests} onChange={setTests} addLabel="+ Add test"
            />
            <div className="d-flex gap-2 mt-3">
              <button className="btn btn-gold" disabled={busy} onClick={register}>{busy ? 'Saving…' : 'Register TRF & generate PDF'}</button>
              <span className="text-secondary small align-self-center">Assigns the TRF number, opens the printable TRF, and notifies the admin.</span>
            </div>
          </div>
        </div>
      </Tab>
    </Tabs>
  );
}
