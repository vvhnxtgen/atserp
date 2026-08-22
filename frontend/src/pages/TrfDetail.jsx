import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg, fileUrl } from '../api';
import { KV, StageBadge, Stepper } from '../components/Bits';
import CameraModal from '../components/CameraModal';
import { useApp } from '../ctx';
import { buildTrfDoc, buildWitnessDoc, printDocument } from '../lib/docs';
import { fmtD, fmtDT, today } from '../lib/format';

const In = ({ label, req, wide, ...p }) => (
  <div className={wide ? 'col-12' : 'col-md-3 col-6'}>
    <label className="form-label">{label} {req && <b>*</b>}</label>
    <input className="form-control form-control-sm" {...p} />
  </div>
);

const Head = ({ n, title, right }) => (
  <div className="stage-head card-header d-flex align-items-center gap-2">
    <span className="stage-num">0{n}</span><span>{title}</span><span className="ms-auto">{right}</span>
  </div>
);
const Stamp = ({ by, at }) => <div className="stamp">Recorded by {by} · {fmtDT(at)}</div>;

/* ---------------- Witness management (module 1: Add Witness) ---------------- */
const W_BLANK = { name: '', designation: '', organization: '' };

/* Module-scope editor row — keeps input focus across re-renders. */
const WitnessDraftRow = ({ sno, draft, setDraft, onSave, onCancel, busy, isEdit }) => (
  <tr>
    <td className="text-center">{sno}</td>
    <td><input className="form-control form-control-sm" autoFocus={!isEdit && !draft.name} placeholder="Name *" value={draft.name}
      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
      onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }} /></td>
    <td><input className="form-control form-control-sm" placeholder="Designation" value={draft.designation}
      onChange={(e) => setDraft((d) => ({ ...d, designation: e.target.value }))}
      onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }} /></td>
    <td><input className="form-control form-control-sm" placeholder="Organization" value={draft.organization}
      onChange={(e) => setDraft((d) => ({ ...d, organization: e.target.value }))}
      onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }} /></td>
    <td className="text-nowrap">
      <button className="btn btn-sm btn-gold me-1" disabled={busy} onClick={onSave}>{isEdit ? 'Save' : 'Add'}</button>
      <button className="btn btn-sm btn-outline-navy" disabled={busy} onClick={onCancel}>Cancel</button>
    </td>
  </tr>
);

function WitnessCard({ trf, refresh }) {
  const { settings, toast } = useApp();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(W_BLANK);
  const [busy, setBusy] = useState(false);
  const wits = trf.witnesses || [];

  const startAdd = () => { setDraft(W_BLANK); setEditId(null); setAdding(true); };
  const startEdit = (w) => { setDraft({ name: w.name, designation: w.designation, organization: w.organization }); setEditId(w.id); setAdding(false); };
  const cancel = () => { setAdding(false); setEditId(null); };

  const save = async () => {
    if (!draft.name.trim()) { toast('Witness name is required.', { variant: 'danger' }); return; }
    setBusy(true);
    try {
      if (editId) await api.put(`/api/witnesses/${editId}/`, { trf: trf.id, ...draft });
      else await api.post('/api/witnesses/', { trf: trf.id, ...draft });
      cancel();
      await refresh();
      toast(editId ? 'Witness updated ✓' : 'Witness added ✓', { variant: 'success' });
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const del = async (w) => {
    if (!window.confirm(`Remove witness "${w.name}"?`)) return;
    try { await api.delete(`/api/witnesses/${w.id}/`); await refresh(); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  return (
    <div className="card mt-3">
      <div className="card-header d-flex align-items-center gap-2">Test Witnesses
        <span className="ms-auto d-flex gap-2">
          <button className="btn btn-sm btn-outline-navy" onClick={() => printDocument('Witness Form — ' + trf.no, buildWitnessDoc(trf, settings))}>🖨 Witness form</button>
          <button className="btn btn-sm btn-gold" onClick={startAdd}>+ Add witness</button>
        </span>
      </div>
      <div className="card-body">
        {!wits.length && !adding ? (
          <div className="text-secondary small">No witnesses added — use “Add witness” if the test is witnessed by the customer / QA representatives. They print on the TRF and the witness form.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm tbl align-middle mb-0">
              <thead><tr><th style={{ width: 60 }}>S.No</th><th>Name</th><th>Designation</th><th>Organization</th><th style={{ width: 150 }}>Actions</th></tr></thead>
              <tbody>
                {wits.map((w, i) => editId === w.id ? (
                  <WitnessDraftRow key={w.id} sno={i + 1} draft={draft} setDraft={setDraft}
                    onSave={save} onCancel={cancel} busy={busy} isEdit />
                ) : (
                  <tr key={w.id}>
                    <td className="text-center">{i + 1}</td>
                    <td><b>{w.name}</b></td>
                    <td>{w.designation || '—'}</td>
                    <td>{w.organization || '—'}</td>
                    <td className="text-nowrap">
                      <button className="btn btn-sm btn-outline-navy me-1" onClick={() => startEdit(w)}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => del(w)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {adding && <WitnessDraftRow sno={wits.length + 1} draft={draft} setDraft={setDraft}
                  onSave={save} onCancel={cancel} busy={busy} isEdit={false} />}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Image capture block (start / end test photos) ------------- */
function ImageBox({ label, url, onUpload, busy }) {
  const [key, setKey] = useState(0);
  const [cam, setCam] = useState(false);
  return (
    <div className="col-md-6">
      <label className="form-label">{label}</label>
      {url ? (
        <div className="d-flex align-items-start gap-2 flex-wrap">
          <a href={fileUrl(url)} target="_blank" rel="noreferrer">
            <img src={fileUrl(url)} alt={label} style={{ height: 92, borderRadius: 8, border: '1px solid var(--line)' }} />
          </a>
          <div className="d-flex flex-column gap-2">
            <button type="button" className="btn btn-sm btn-gold" disabled={busy} onClick={() => setCam(true)}>📷 Retake with camera</button>
            <label className="btn btn-sm btn-outline-navy mb-0">
              Choose file
              <input key={key} type="file" hidden accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); setKey((k) => k + 1); } }} />
            </label>
          </div>
        </div>
      ) : (
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-sm btn-gold" disabled={busy} onClick={() => setCam(true)}>📷 Open camera</button>
          <label className="btn btn-sm btn-outline-navy mb-0">
            Choose file
            <input key={key} type="file" hidden accept="image/*" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); setKey((k) => k + 1); } }} />
          </label>
        </div>
      )}
      <div className="text-secondary" style={{ fontSize: 11.5 }}>Capture live with the camera, or choose a JPG / PNG file.</div>
      <CameraModal show={cam} title={label} onHide={() => setCam(false)}
        onCapture={(file) => onUpload(file)} />
    </div>
  );
}

/* =============================== Page ====================================== */
export default function TrfDetail() {
  const { id } = useParams();
  const { user, settings, toast, notify } = useApp();
  const nav = useNavigate();
  const [t, setT] = useState(null);
  const [edit, setEdit] = useState(0);
  const [al, setAl] = useState({});
  const [op, setOp] = useState({});
  const [rs, setRs] = useState({});
  const [rp, setRp] = useState({});
  const [obs, setObs] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback((d) => {
    setT(d);
    setAl({ alloc_chamber: d.alloc_chamber, alloc_date: d.alloc_date || today(), alloc_time: d.alloc_time, alloc_engineer: d.alloc_engineer, alloc_remarks: d.alloc_remarks });
    setOp({ op_start_date: d.op_start_date || today(), op_start_time: d.op_start_time, op_end_date: d.op_end_date || '', op_end_time: d.op_end_time, op_engineer: d.op_engineer || d.alloc_engineer, op_obs: d.op_obs });
    setRs({ result_status: d.result_status || 'Pass', result_remarks: d.result_remarks });
    setRp({ report_no: d.report_no, report_date: d.report_date || today() });
    setObs(d.op_obs || '');
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await api.get(`/api/trfs/${id}/`);
    sync(data);
  }, [id, sync]);

  useEffect(() => {
    refresh().catch((e) => { toast(errMsg(e), { variant: 'danger' }); nav('/test'); });
  }, [refresh, toast, nav]);

  if (!t) return <div className="text-secondary">Loading TRF…</div>;

  const act = async (path, body, msg, isForm = false) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/api/trfs/${id}/${path}/`, body,
        isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
      sync(data); setEdit(0);
      if (msg) notify(msg.title, msg.lines, data.notify || data.email);
      return true;
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); return false; }
    finally { setBusy(false); }
  };

  const saveAlloc = () => {
    if (!al.alloc_chamber || !al.alloc_date || !al.alloc_engineer) { toast('Chamber, Date and Engineer are required.', { variant: 'danger' }); return; }
    act('allocate', al, {
      title: `Chamber Allocated — ${t.no}`,
      lines: [`Chamber: ${al.alloc_chamber}`, `Scheduled: ${fmtD(al.alloc_date)} ${al.alloc_time || ''}`,
        `Engineer: ${al.alloc_engineer}`, `Customer: ${t.customer_company}`],
    });
  };

  const startTest = () => act('start-test', {}, {
    title: `Test Started — ${t.no}`,
    lines: [`Technician: ${user.name}`, `Chamber: ${t.alloc_chamber}`, `Customer: ${t.customer_company}`, 'Start time recorded automatically.'],
  });

  const completeTest = () => {
    if (!t.op_end_image && !window.confirm('No ending image uploaded yet — complete the test anyway?')) return;
    act('complete-test', { op_obs: obs }, {
      title: `Test Completed — ${t.no}`,
      lines: [`Start: ${fmtD(t.op_start_date)} ${t.op_start_time}`, `Completed by: ${user.name}`,
        `Customer: ${t.customer_company}`, 'End time recorded automatically.'],
    });
  };

  const uploadImage = async (kind, f) => {
    const fd = new FormData();
    fd.append('kind', kind);
    fd.append('image', f);
    setBusy(true);
    try {
      const { data } = await api.post(`/api/trfs/${id}/upload-image/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      sync(data);
      toast(`${kind === 'start' ? 'Starting' : 'Ending'} image saved ✓`, { variant: 'success' });
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const saveOpManual = () => {
    if (!op.op_start_date || !op.op_start_time || !op.op_engineer) { toast('Start date, start time and Engineer are required.', { variant: 'danger' }); return; }
    if (op.op_end_date && !op.op_end_time) { toast('Add the end time along with the end date.', { variant: 'danger' }); return; }
    act('operate', op, null).then((ok) => { if (ok) toast('Operation updated.', { variant: 'success' }); });
  };

  const saveResult = () => act('result', rs, {
    title: `Result Recorded — ${t.no} : ${rs.result_status.toUpperCase()}`,
    lines: [`Customer: ${t.customer_company}`, `Sample: ${t.sample_desc}`,
      rs.result_remarks ? `Remarks: ${rs.result_remarks}` : ''],
  });

  const saveReport = () => {
    if (!file) { toast('Choose the report file first.', { variant: 'danger' }); return; }
    const fd = new FormData();
    fd.append('report_file', file);
    fd.append('report_no', rp.report_no || '');
    fd.append('report_date', rp.report_date || today());
    act('report', fd, {
      title: `Final Report Uploaded — ${t.no}`,
      lines: [`Report No: ${rp.report_no || '—'}`, `Result: ${t.result_status ? t.result_status.toUpperCase() : '—'}`,
        `Customer: ${t.customer_company}`, 'TRF lifecycle complete.'],
    }, true).then((ok) => { if (ok) setFile(null); });
  };

  const del = async () => {
    if (!window.confirm(`Delete ${t.no}? Linked invoices keep the TRF number for records.`)) return;
    try { await api.delete(`/api/trfs/${id}/`); toast('TRF deleted.'); nav('/test'); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  const started = !!t.op_start_date;
  const completed = !!t.op_end_date;

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Link className="btn btn-sm btn-outline-navy" to="/test">← All TRFs</Link>
        <span className="ms-auto" />
        <button className="btn btn-sm btn-outline-navy" onClick={() => printDocument('TRF — ' + t.no, buildTrfDoc(t, settings))}>🖨 TRF PDF</button>
        <button className="btn btn-sm btn-outline-navy" onClick={() => printDocument('Witness Form — ' + t.no, buildWitnessDoc(t, settings))}>🖨 Witness form</button>
        {user.role === 'admin' && <>
          <button className="btn btn-sm btn-navy" onClick={() => nav('/accounts', { state: { trfId: t.id } })}>Generate invoice →</button>
          <button className="btn btn-sm btn-outline-danger" onClick={del}>Delete</button>
        </>}
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span className="font-disp" style={{ fontSize: 30, letterSpacing: '.04em', color: 'var(--navy-900)' }}>{t.no}</span>
            <StageBadge t={t} />
            {t.priority === 'Urgent' && <span className="abadge b-fail">Urgent</span>}
            <span className="ms-auto text-secondary small">Registered {fmtD(t.date)} by {t.created_by}</span>
          </div>
          <Stepper stage={t.stage} />
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header">Customer &amp; Sample</div>
        <div className="card-body">
          <div className="row">
            <KV k="Customer" v={t.customer_company} /><KV k="Contact" v={t.customer_contact} />
            <KV k="Phone" v={t.customer_phone} /><KV k="Email" v={t.customer_email} />
            <KV k="GSTIN" v={t.customer_gst} /><KV k="Customer Ref / PO" v={t.customer_ref} />
            <KV k="Address" v={t.customer_addr} /><KV k="Sample" v={t.sample_desc} />
            <KV k="Qty" v={t.sample_qty} /><KV k="Part / Model" v={t.sample_part} />
            <KV k="Condition" v={t.sample_cond} /><KV k="Batch No." v={t.batch_no} />
          </div>
          <div className="table-responsive mt-2">
            <table className="table table-sm tbl">
              <thead><tr><th>#</th><th>Test</th><th>Standard / Method</th><th>Specification &amp; Conditions</th><th>Duration</th></tr></thead>
              <tbody>{t.tests.map((x, i) => <tr key={i}><td>{i + 1}</td><td><b>{x.test}</b></td><td>{x.std}</td><td>{x.spec}</td><td>{x.dur}</td></tr>)}</tbody>
            </table>
          </div>
          {t.remarks && <div className="text-secondary small">Remarks: {t.remarks}</div>}
        </div>
      </div>

      <WitnessCard trf={t} refresh={refresh} />

      <datalist id="dl-ch">{(settings?.chambers || []).map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="dl-eng">{(settings?.engineers || []).map((c) => <option key={c} value={c} />)}</datalist>

      {/* -------- Stage 2 — Allocation -------- */}
      <div className="card mt-3">
        <Head n={2} title="Chamber / Equipment Allocation"
          right={t.alloc_chamber && user.role === 'admin' && edit !== 2 && <button className="btn btn-sm btn-outline-navy" onClick={() => setEdit(2)}>Edit</button>} />
        <div className="card-body">
          {t.alloc_chamber && edit !== 2 ? (
            <>
              <div className="row">
                <KV k="Chamber / Equipment" v={t.alloc_chamber} /><KV k="Date" v={fmtD(t.alloc_date)} />
                <KV k="Time" v={t.alloc_time} /><KV k="Engineer" v={t.alloc_engineer} />
                <KV k="Remarks" v={t.alloc_remarks} />
              </div>
              <Stamp by={t.alloc_by} at={t.alloc_at} />
            </>
          ) : (
            <>
              <div className="row g-3">
                <In label="Chamber / Equipment" req list="dl-ch" value={al.alloc_chamber || ''} onChange={(e) => setAl({ ...al, alloc_chamber: e.target.value })} />
                <In label="Date" req type="date" value={al.alloc_date || ''} onChange={(e) => setAl({ ...al, alloc_date: e.target.value })} />
                <In label="Time" type="time" value={al.alloc_time || ''} onChange={(e) => setAl({ ...al, alloc_time: e.target.value })} />
                <In label="Engineer" req list="dl-eng" value={al.alloc_engineer || ''} onChange={(e) => setAl({ ...al, alloc_engineer: e.target.value })} />
                <In label="Remarks" wide value={al.alloc_remarks || ''} onChange={(e) => setAl({ ...al, alloc_remarks: e.target.value })} />
              </div>
              <button className="btn btn-gold btn-sm mt-3" disabled={busy} onClick={saveAlloc}>Save allocation</button>
            </>
          )}
        </div>
      </div>

      {/* -------- Stage 3 — Test Operation (Start / Images / Complete) -------- */}
      <div className="card mt-3">
        <Head n={3} title="Test Operation"
          right={completed && user.role === 'admin' && edit !== 3 && <button className="btn btn-sm btn-outline-navy" onClick={() => setEdit(3)}>Edit</button>} />
        <div className="card-body">
          {!t.alloc_chamber ? <div className="stage-locked">🔒 Complete chamber allocation first.</div>
            : edit === 3 ? (
              <>
                <div className="text-secondary small mb-2">Admin correction — adjust the recorded times if needed.</div>
                <div className="row g-3">
                  <In label="Start date" req type="date" value={op.op_start_date || ''} onChange={(e) => setOp({ ...op, op_start_date: e.target.value })} />
                  <In label="Start time" req type="time" value={op.op_start_time || ''} onChange={(e) => setOp({ ...op, op_start_time: e.target.value })} />
                  <In label="End date" type="date" value={op.op_end_date || ''} onChange={(e) => setOp({ ...op, op_end_date: e.target.value })} />
                  <In label="End time" type="time" value={op.op_end_time || ''} onChange={(e) => setOp({ ...op, op_end_time: e.target.value })} />
                  <In label="Engineer" req list="dl-eng" value={op.op_engineer || ''} onChange={(e) => setOp({ ...op, op_engineer: e.target.value })} />
                  <In label="Observations" wide value={op.op_obs || ''} onChange={(e) => setOp({ ...op, op_obs: e.target.value })} />
                </div>
                <button className="btn btn-gold btn-sm mt-3" disabled={busy} onClick={saveOpManual}>Save operation</button>
              </>
            ) : !started ? (
              <div className="d-flex flex-wrap align-items-center gap-3">
                <button className="btn btn-gold" disabled={busy} onClick={startTest}>▶ Start Test</button>
                <span className="text-secondary small">One click — the system automatically stores the <b>start time</b> and <b>technician name</b> ({user.name}), then notifies the admin.</span>
              </div>
            ) : (
              <>
                <div className="row mb-2">
                  <KV k="Started" v={`${fmtD(t.op_start_date)} · ${t.op_start_time}`} />
                  <KV k="Technician" v={t.op_engineer} />
                  {completed && <KV k="Ended" v={`${fmtD(t.op_end_date)} · ${t.op_end_time}`} />}
                  {completed && <KV k="Test status" v="Completed" />}
                  {completed && t.op_obs && <KV k="Observations" v={t.op_obs} />}
                </div>
                <div className="row g-3">
                  <ImageBox label="Starting test image" url={t.op_start_image} busy={busy} onUpload={(f) => uploadImage('start', f)} />
                  <ImageBox label="Ending test image" url={t.op_end_image} busy={busy} onUpload={(f) => uploadImage('end', f)} />
                </div>
                {!completed && (
                  <>
                    <div className="text-secondary small mt-3">Perform the laboratory test. Tap <b>Open camera</b> to capture the starting image live, and on completion capture the ending image, then press Complete Test.</div>
                    <div className="row g-3 mt-0">
                      <div className="col-md-8">
                        <label className="form-label">Observations (optional)</label>
                        <input className="form-control form-control-sm" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Deviations, chamber behaviour, notes…" />
                      </div>
                      <div className="col-md-4 d-flex align-items-end">
                        <button className="btn btn-navy" disabled={busy} onClick={completeTest}>✔ Complete Test</button>
                      </div>
                    </div>
                    <div className="text-secondary" style={{ fontSize: 11.5 }}>Stores the <b>end time</b>, <b>test status</b> and <b>completed by</b> automatically.</div>
                  </>
                )}
                {completed && <Stamp by={t.op_by} at={t.op_at} />}
              </>
            )}
        </div>
      </div>

      {/* -------- Stage 4 — Results -------- */}
      <div className="card mt-3">
        <Head n={4} title="Results"
          right={t.result_status && user.role === 'admin' && edit !== 4 && <button className="btn btn-sm btn-outline-navy" onClick={() => setEdit(4)}>Edit</button>} />
        <div className="card-body">
          {!completed ? <div className="stage-locked">🔒 Complete the test operation first.</div>
            : t.result_status && edit !== 4 ? (
              <>
                <div className="d-flex align-items-center gap-3">
                  <span className={'abadge ' + (t.result_status === 'Pass' ? 'b-pass' : 'b-fail')} style={{ fontSize: 14, padding: '6px 16px' }}>{t.result_status.toUpperCase()}</span>
                  <span>{t.result_remarks}</span>
                </div>
                <Stamp by={t.result_by} at={t.result_at} />
              </>
            ) : (
              <>
                <div className="row g-3">
                  <div className="col-md-3 col-6">
                    <label className="form-label">Result *</label>
                    <select className="form-select form-select-sm" value={rs.result_status} onChange={(e) => setRs({ ...rs, result_status: e.target.value })}>
                      <option>Pass</option><option>Fail</option>
                    </select>
                  </div>
                  <In label="Remarks / Deviations" wide value={rs.result_remarks || ''} onChange={(e) => setRs({ ...rs, result_remarks: e.target.value })} />
                </div>
                <button className="btn btn-gold btn-sm mt-3" disabled={busy} onClick={saveResult}>Save result</button>
              </>
            )}
        </div>
      </div>

      {/* -------- Stage 5 — Final Report -------- */}
      <div className="card mt-3 mb-4">
        <Head n={5} title="Final Report — Upload"
          right={t.report_at && edit !== 5 && <button className="btn btn-sm btn-outline-navy" onClick={() => setEdit(5)}>Replace</button>} />
        <div className="card-body">
          {t.stage < 4 ? <div className="stage-locked">🔒 Record results before uploading the report.</div>
            : t.report_at && edit !== 5 ? (
              <>
                <div className="row">
                  <KV k="Report No." v={t.report_no} /><KV k="Report Date" v={fmtD(t.report_date)} />
                  <KV k="File" v={t.report_file ? decodeURIComponent(t.report_file.split('/').pop()) : '—'} />
                </div>
                <div className="d-flex gap-2 mt-2">
                  <a className="btn btn-sm btn-outline-navy" href={fileUrl(t.report_file)} target="_blank" rel="noreferrer">View report</a>
                  <a className="btn btn-sm btn-outline-navy" href={fileUrl(t.report_file)} download>Download</a>
                </div>
                <Stamp by={t.report_by} at={t.report_at} />
              </>
            ) : (
              <>
                <div className="row g-3">
                  <In label="Report No." placeholder="e.g., ATS/RPT/…" value={rp.report_no || ''} onChange={(e) => setRp({ ...rp, report_no: e.target.value })} />
                  <In label="Report Date" type="date" value={rp.report_date || ''} onChange={(e) => setRp({ ...rp, report_date: e.target.value })} />
                  <div className="col-12">
                    <label className="form-label">Report file (PDF) *</label>
                    <input type="file" className="form-control form-control-sm" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <button className="btn btn-gold btn-sm mt-3" disabled={busy} onClick={saveReport}>Upload report &amp; complete TRF</button>
              </>
            )}
        </div>
      </div>
    </>
  );
}
