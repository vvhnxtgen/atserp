import { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import api, { errMsg } from '../api';
import { useApp } from '../ctx';
import { fmtD, fmtDT, num } from '../lib/format';
import ItemsEditor from './ItemsEditor';
import { Empty } from './Bits';

export const itemsSummary = (items) => (items || []).map((i) => `${i.item} ×${+i.qty}`).join(', ');

/* ------------------------------------------------ table ---- */
export function IndentTable({ rows, admin, onChanged }) {
  const { toast } = useApp();
  const decide = async (id, action) => {
    let note = '';
    if (action === 'reject') note = window.prompt('Reason for rejection (optional):', '') ?? '';
    try {
      await api.post(`/api/indents/${id}/${action}/`, { note });
      toast(`Indent ${action === 'approve' ? 'approved ✓' : 'rejected.'}`);
      onChanged?.();
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  if (!rows.length) return <Empty title="No indents">Raise an indent for consumables, tools or maintenance items.</Empty>;
  return (
    <div className="table-responsive">
      <table className="table tbl align-middle">
        <thead><tr><th>Indent No.</th><th>Date</th><th>Raised by</th><th>Items</th><th>Priority</th><th>Status</th><th>{admin ? 'Approval' : 'Decision'}</th></tr></thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id}>
              <td className="num">{i.no}</td>
              <td className="text-nowrap">{fmtD(i.date)}</td>
              <td>{i.raised_by}</td>
              <td>
                {itemsSummary(i.items)}
                {i.need_by && <div className="text-secondary small">Needed by {fmtD(i.need_by)}</div>}
                {i.remarks && <div className="text-secondary small">{i.remarks}</div>}
              </td>
              <td><span className={'abadge ' + (i.priority === 'Urgent' ? 'b-fail' : 'b-grey')}>{i.priority}</span></td>
              <td><span className={'abadge b-' + i.status.toLowerCase()}>{i.status}</span></td>
              <td>
                {admin && i.status === 'Pending' ? (
                  <span className="d-inline-flex gap-1">
                    <button className="btn btn-sm btn-gold" onClick={() => decide(i.id, 'approve')}>Approve</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => decide(i.id, 'reject')}>Reject</button>
                  </span>
                ) : i.status !== 'Pending' ? (
                  <span className="text-secondary small">{i.decided_by} · {fmtDT(i.decided_at)}{i.note ? <><br />{i.note}</> : null}</span>
                ) : (
                  <span className="text-secondary small">Awaiting admin</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------ modal ---- */
const BLANK = [{ item: '', qty: 1, unit: '', purpose: '' }];

export function RaiseIndentModal({ show, onHide, onDone }) {
  const { toast, notify } = useApp();
  const [rows, setRows] = useState(BLANK);
  const [priority, setPriority] = useState('Normal');
  const [needBy, setNeedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const items = rows.filter((r) => r.item.trim() && num(r.qty) > 0)
      .map((r) => ({ item: r.item.trim(), qty: num(r.qty), unit: r.unit, purpose: r.purpose }));
    if (!items.length) { toast('Add at least one item with quantity.', { variant: 'danger' }); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/api/indents/', {
        priority, need_by: needBy || null, remarks, items,
      });
      notify(`Indent Raised — ${data.no} (${priority})`,
        ['Items: ' + itemsSummary(items),
          needBy ? 'Needed by: ' + fmtD(needBy) : '',
          'Action: approval pending in Business → Indents.'], data.email);
      setRows(BLANK); setPriority('Normal'); setNeedBy(''); setRemarks('');
      onDone?.(); onHide();
    } catch (e) { toast(errMsg(e), { variant: 'danger' }); }
    setBusy(false);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton><Modal.Title className="font-disp" style={{ letterSpacing: '.05em' }}>Raise Indent</Modal.Title></Modal.Header>
      <Modal.Body>
        <div className="row g-3 mb-2">
          <div className="col-6 col-md-3">
            <label className="form-label">Priority</label>
            <select className="form-select form-select-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option>Normal</option><option>Urgent</option>
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Needed by</label>
            <input type="date" className="form-control form-control-sm" value={needBy} onChange={(e) => setNeedBy(e.target.value)} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Remarks</label>
            <input className="form-control form-control-sm" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <ItemsEditor
          columns={[
            { key: 'item', label: 'Item', placeholder: 'Item', width: '38%' },
            { key: 'qty', label: 'Qty', type: 'number', width: '12%', def: 1 },
            { key: 'unit', label: 'Unit', placeholder: 'Nos / L / kg', width: '14%' },
            { key: 'purpose', label: 'Purpose', placeholder: 'Purpose' },
          ]}
          rows={rows} onChange={setRows} addLabel="+ Add item"
        />
        <div className="text-secondary small mt-1">The indent goes to the administrator for approval; they are notified by email / WhatsApp.</div>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-outline-navy" onClick={onHide}>Cancel</button>
        <button className="btn btn-gold" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit for approval'}</button>
      </Modal.Footer>
    </Modal>
  );
}
