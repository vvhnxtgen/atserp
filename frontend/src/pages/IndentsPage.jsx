import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { IndentTable, RaiseIndentModal } from '../components/Indents';
import { useApp } from '../ctx';

export default function IndentsPage() {
  const { toast } = useApp();
  const [rows, setRows] = useState([]);
  const [show, setShow] = useState(false);

  const load = useCallback(async () => {
    try { setRows((await api.get('/api/indents/')).data); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="card">
      <div className="card-header d-flex align-items-center">Material indents
        <button className="btn btn-sm btn-gold ms-auto" onClick={() => setShow(true)}>+ Raise indent</button>
      </div>
      <div className="card-body">
        <div className="text-secondary small mb-3">Raise indents for consumables, tools and maintenance items. The administrator is notified and approves them under Business → Indents.</div>
        <IndentTable rows={rows} admin={false} onChanged={load} />
      </div>
      <RaiseIndentModal show={show} onHide={() => setShow(false)} onDone={load} />
    </div>
  );
}
