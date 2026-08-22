import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { Empty, StageBadge, StatCard } from '../components/Bits';
import { itemsSummary } from '../components/Indents';
import { useApp } from '../ctx';
import { STAGES, fmtDT, inr } from '../lib/format';

export default function Dashboard() {
  const { toast } = useApp();
  const nav = useNavigate();
  const [d, setD] = useState(null);

  const load = useCallback(async () => {
    try { setD((await api.get('/api/dashboard/')).data); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  }, [toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const decide = async (id, action) => {
    let note = '';
    if (action === 'reject') note = window.prompt('Reason for rejection (optional):', '') ?? '';
    try { await api.post(`/api/indents/${id}/${action}/`, { note }); load(); }
    catch (e) { toast(errMsg(e), { variant: 'danger' }); }
  };

  if (!d) return <div className="text-secondary">Loading dashboard…</div>;
  const c = d.cards;
  const mx = Math.max(...d.pipeline);

  return (
    <>
      <div className="row g-3">
        {[
          ['Active TRFs', c.active_trfs, 'stage 1–4'],
          ['Tests in Operation', c.in_operation, 'currently on chamber'],
          ['Reports Issued', c.reports_month, 'this month'],
          ['Pending Indents', c.pending_indents, 'awaiting your approval', 1],
          ['Revenue', inr(c.revenue_month, 0), 'invoiced this month', 1],
          ['Receivables', inr(c.receivables, 0), 'unpaid invoices', 1],
        ].map(([k, v, s, alt]) => (
          <div className="col-6 col-md-4 col-xl-2" key={k}><StatCard k={k} v={v} s={s} alt={alt} /></div>
        ))}
      </div>

      <div className="card mt-3">
        <div className="card-header d-flex align-items-center">Test pipeline
          <span className="ms-auto text-secondary small text-lowercase" style={{ letterSpacing: 0 }}>{d.total_trfs} TRF{d.total_trfs === 1 ? '' : 's'} total</span>
        </div>
        <div className="card-body">
          <div className="row g-2">
            {d.pipeline.map((n, i) => (
              <div className="col-6 col-md" key={i}>
                <button className={'pl-col' + (n && n === mx ? ' hot' : '')} onClick={() => nav('/test?stage=' + (i + 1))}>
                  <div className="n">{n}</div>
                  <div className="l">{STAGES[i]}</div>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="row g-3 mt-0">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">Needs attention</div>
            <div className="card-body">
              {!d.pending_indents.length && !d.awaiting_trfs.length && <Empty title="All clear">No pending approvals or stalled TRFs.</Empty>}
              {d.pending_indents.length > 0 && <>
                <div className="text-secondary small mb-1">Indents awaiting approval</div>
                {d.pending_indents.map((i) => (
                  <div className="d-flex align-items-center gap-2 py-2 border-bottom" style={{ borderStyle: 'dashed' }} key={i.id}>
                    <span className="num">{i.no}</span>
                    <span className="text-secondary small flex-grow-1">{i.raised_by} · {itemsSummary(i.items)}</span>
                    <button className="btn btn-sm btn-gold" onClick={() => decide(i.id, 'approve')}>Approve</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => decide(i.id, 'reject')}>Reject</button>
                  </div>
                ))}
              </>}
              {d.awaiting_trfs.length > 0 && <>
                <div className="text-secondary small mt-3 mb-1">TRFs awaiting next stage</div>
                {d.awaiting_trfs.map((t) => (
                  <div className="d-flex align-items-center gap-2 py-2 border-bottom" style={{ borderStyle: 'dashed' }} key={t.id}>
                    <Link className="num text-decoration-none" to={'/test/' + t.id}>{t.no}</Link>
                    <StageBadge t={t} />
                    <span className="ms-auto text-secondary small">{t.customer_company}</span>
                  </div>
                ))}
              </>}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">Recent activity</div>
            <div className="card-body">
              {!d.activity.length && <Empty title="No activity yet">Actions across the ERP will appear here.</Empty>}
              {d.activity.map((a, i) => (
                <div className="d-flex gap-2 py-1 small" key={i}>
                  <span style={{ color: 'var(--gold)' }}>●</span>
                  <span className="flex-grow-1"><b>{a.user}</b> {a.text}</span>
                  <span className="text-secondary text-nowrap">{fmtDT(a.at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
