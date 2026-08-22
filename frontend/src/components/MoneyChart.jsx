import { inr } from '../lib/format';

const shortInr = (n) => (n >= 1e7 ? (n / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr'
  : n >= 1e5 ? (n / 1e5).toFixed(1).replace(/\.0$/, '') + 'L'
  : n >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : String(Math.round(n)));

export default function MoneyChart({ labels, revenue, spend }) {
  const W = 760, H = 260, L = 56, R = 12, T = 14, B = 34;
  const cw = W - L - R, ch = H - T - B;
  const mx = Math.max(1, ...revenue, ...spend) * 1.12;
  const gw = cw / 12, bw = Math.min(16, gw * 0.3);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 640, width: '100%', fontFamily: 'Barlow' }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const y = T + ch - (ch * i) / 4;
          return (
            <g key={i}>
              <line x1={L} y1={y} x2={W - R} y2={y} stroke="#E2E8F2" />
              <text x={L - 8} y={y + 3.5} textAnchor="end" fontSize="10.5" fill="#8D9BB1">₹{shortInr((mx * i) / 4)}</text>
            </g>
          );
        })}
        {labels.map((lb, i) => {
          const x = L + gw * i + gw / 2;
          const h1 = (revenue[i] / mx) * ch, h2 = (spend[i] / mx) * ch;
          return (
            <g key={lb + i}>
              <rect x={x - bw - 2} y={T + ch - h1} width={bw} height={Math.max(h1, 0)} rx="2.5" fill="#C9A227">
                <title>{lb} revenue: {inr(revenue[i], 0)}</title>
              </rect>
              <rect x={x + 2} y={T + ch - h2} width={bw} height={Math.max(h2, 0)} rx="2.5" fill="#B03A2E">
                <title>{lb} spend: {inr(spend[i], 0)}</title>
              </rect>
              <text x={x} y={H - 11} textAnchor="middle" fontSize="10.5" fill="#5B6B85">{lb}</text>
            </g>
          );
        })}
        <line x1={L} y1={T + ch} x2={W - R} y2={T + ch} stroke="#C9D4E4" />
      </svg>
      <div className="d-flex gap-3 small text-secondary mt-1">
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#C9A227', borderRadius: 2, marginRight: 5 }} />Revenue (invoices)</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#B03A2E', borderRadius: 2, marginRight: 5 }} />Spend (internal POs)</span>
      </div>
    </div>
  );
}
