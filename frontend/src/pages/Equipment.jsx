import { useCallback, useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { Empty } from '../components/Bits';
import { useApp } from '../ctx';
import { fmtD, today } from '../lib/format';

const BLANK = { name: '', equipment_id: '', range_spec: '', manufacturer: '', model: '', serial_no: '', location: '', calib_details: '', calib_due: '', status: 'Active' };
const S_CLS = { Active: 'b-pass', 'Calibration Due': 'b-pending', 'Under Maintenance': 'b-s3', Retired: 'b-grey' };

const In = ({ label, col = 'col-md-4', ...p }) => (
  <div className={col}><label className="form-label">{label}</label><input className="form-control form-control-sm" {...p} /></div>
);

export default function Equipment() {
  const { toast } = useApp();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = useCallback(() => api.get('/api/equipment/').then((r) => setList(r.data)), []);
  useEffect(() => { load().catch((e) => toast(errMsg(e), { variant: 'danger' })); }, [load, toast]);

  const openAdd = () => { setForm(BLANK); setEditId(null); setShow(true); };
  const openEdit = (eq) => { setForm({ ...BLANK, ...eq, calib_due: eq.calib_due || '' }); setEditId(eq.id); setShow(true); };

  const save = async () => {
    if (!form.name.trim()) { toast('Equipment name is required.', { variant: 'danger' }); return; }
    setBusy(true);
    try {
      const body = { ...form, calib_due: form.calib_due || null };
      if (editId) await api.put(`/api/equipment/${editId}/`, body);
      else await api.post('/api/equipment/', body);
      setShow(false); await load();
      toast(editId ? 'Equipment updated ✓' : 'Equipment added ✓', { variant: 'success' });
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  const del = async (eq) => {
    if (!window.confirm(`Delete "${eq.name}"? Its calibration certificates remain on record.`)) return;
    try { await api.delete(`/api/equipment/${eq.id}/`); await load(); toast('Equipment deleted.'); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  return (
    <>
      <div className="card">
        <div className="card-header d-flex align-items-center">Testing Equipment
          <button className="btn btn-sm btn-gold ms-auto" onClick={openAdd}>+ Add equipment</button>
        </div>
        <div className="card-body">
          {!list.length ? <Empty label="No equipment yet — add your chambers and instruments." /> : (
            <div className="table-responsive">
              <table className="table table-sm tbl align-middle" style={{ minWidth: 1100 }}>
                <thead><tr><th>Equipment Name</th><th>Range</th><th>Calibration Details</th><th>Calibration Due</th><th>Manufacturer / Model</th><th>Serial No.</th><th>Location</th><th>Status</th><th style={{ width: 250 }}>Actions</th></tr></thead>
                <tbody>{list.map((eq) => {
                  const overdue = eq.calib_due && eq.calib_due < today();
                  return (
                    <tr key={eq.id}>
                      <td><b>{eq.name}</b>{eq.equipment_id && <div className="text-secondary small">{eq.equipment_id}</div>}</td>
                      <td>{eq.range_spec || '—'}</td>
                      <td className="small">{eq.calib_details || '—'}</td>
                      <td>{eq.calib_due ? <span className={overdue ? 'text-danger fw-bold' : ''}>{fmtD(eq.calib_due)}{overdue && ' ⚠'}</span> : '—'}</td>
                      <td className="small">{[eq.manufacturer, eq.model].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="small">{eq.serial_no || '—'}</td>
                      <td className="small">{eq.location || '—'}</td>
                      <td><span className={'abadge ' + (S_CLS[eq.status] || 'b-grey')}>{eq.status}</span></td>
                      <td className="text-nowrap">
                        <button className="btn btn-sm btn-outline-navy me-1" onClick={() => openEdit(eq)}>Edit</button>
                        <button className="btn btn-sm btn-outline-navy me-1" onClick={() => nav('/calibration?equipment=' + eq.id)}>View calibration</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => del(eq)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal show={show} onHide={() => setShow(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title style={{ fontSize: 17 }}>{editId ? 'Edit equipment' : 'Add equipment'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="row g-3">
            <In label="Equipment Name *" value={form.name} onChange={f('name')} autoFocus />
            <In label="Equipment ID" col="col-md-4" value={form.equipment_id} onChange={f('equipment_id')} placeholder="e.g., EQ-01" />
            <In label="Range" col="col-md-4" value={form.range_spec} onChange={f('range_spec')} placeholder="e.g., −70 °C to +180 °C" />
            <In label="Manufacturer" value={form.manufacturer} onChange={f('manufacturer')} />
            <In label="Model" col="col-md-4" value={form.model} onChange={f('model')} />
            <In label="Serial Number" col="col-md-4" value={form.serial_no} onChange={f('serial_no')} />
            <In label="Location" value={form.location} onChange={f('location')} placeholder="e.g., Bay 2" />
            <In label="Calibration Due Date" col="col-md-4" type="date" value={form.calib_due} onChange={f('calib_due')} />
            <div className="col-md-4"><label className="form-label">Status</label>
              <select className="form-select form-select-sm" value={form.status} onChange={f('status')}>
                <option>Active</option><option>Calibration Due</option><option>Under Maintenance</option><option>Retired</option>
              </select>
            </div>
            <In label="Calibration Details" col="col-12" value={form.calib_details} onChange={f('calib_details')} placeholder="Agency, certificate reference, cycle…" />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-sm btn-outline-navy" onClick={() => setShow(false)}>Cancel</button>
          <button className="btn btn-sm btn-gold" disabled={busy} onClick={save}>{editId ? 'Save changes' : 'Add equipment'}</button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
