import { STAGES } from '../lib/format';

export const StatCard = ({ k, v, s, alt }) => (
  <div className={'card stat h-100' + (alt ? ' alt' : '')}>
    <div className="card-body py-3">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      <div className="s">{s}</div>
    </div>
  </div>
);

export const Stepper = ({ stage }) => (
  <div className="stepper">
    {STAGES.map((s, i) => {
      const n = i + 1;
      const cls = n < stage ? 'done' : n === stage ? 'cur' : '';
      return (
        <div className={'step ' + cls} key={n}>
          <div className="dot">{n < stage ? '✓' : n}</div>
          <div className="lbl">{s}</div>
        </div>
      );
    })}
  </div>
);

export const StageBadge = ({ t }) => {
  let cls = 'b-s' + t.stage;
  let label = `${t.stage} · ${STAGES[t.stage - 1]}`;
  if (t.stage === 4 && t.result_status) {
    cls = t.result_status === 'Pass' ? 'b-pass' : 'b-fail';
    label = `4 · Result: ${t.result_status.toUpperCase()}`;
  }
  return <span className={'abadge ' + cls}>{label}</span>;
};

export const MiniDots = ({ stage }) => (
  <span className="minidots">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= stage ? 'on' : ''} />)}</span>
);

export const Empty = ({ title, children }) => (
  <div className="empty"><b>{title}</b>{children}</div>
);

export const KV = ({ k, v }) => (
  <div className="kv col-6 col-md-3 mb-2"><span>{k}</span><b>{v || '—'}</b></div>
);
