import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errMsg } from '../api';
import { useApp } from '../ctx';

export default function Login() {
  const { login } = useApp();
  const nav = useNavigate();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const user = await login(u.trim(), p);
      nav(user.role === 'admin' ? '/' : '/test', { replace: true });
    } catch (ex) {
      setErr(ex.response?.status === 400 ? 'Invalid username or password.' : errMsg(ex));
    }
    setBusy(false);
  };

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <div className="d-flex align-items-center gap-3 mb-4" style={{ opacity: 0.9 }}>
          <span className="lb-logo"><img src="/logo-white.png" alt="ATS" /></span>
          <span className="font-cond" style={{ letterSpacing: '.22em', fontSize: 12 }}>NABL · ISO/IEC 17025:2017</span>
        </div>
        <h1>ARUDHYA<br /><em>TEST SOLUTIONS</em> ERP</h1>
        <div className="lb-rule" />
        <p style={{ maxWidth: 520, color: '#B9C7DC' }}>
          One workflow from TRF to final report — chamber allocation, test operation, results,
          quality traceability, quotations, indents and TRF-linked invoicing.
        </p>
        <div className="d-flex flex-wrap gap-2 mt-2">
          {['TRF Registered', 'Chamber Allocated', 'Test Operation', 'Results', 'Report'].map((s, i) => (
            <span key={s} className="font-cond" style={{ border: '1px solid rgba(201,162,39,.45)', color: '#E8D9A0', borderRadius: 99, padding: '4px 12px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {i + 1} · {s}
            </span>
          ))}
        </div>
      </div>

      <div className="login-side">
        <form className="card p-4" style={{ width: 'min(400px,94vw)' }} onSubmit={go}>
          <div className="eyebrow mb-1">Sign in</div>
          <h3 className="font-disp mb-3" style={{ letterSpacing: '.04em', color: 'var(--navy-900)' }}>Laboratory ERP</h3>
          <label className="form-label">Username</label>
          <input className="form-control mb-3" autoFocus value={u} onChange={(e) => setU(e.target.value)} placeholder="admin or tech" />
          <label className="form-label">Password</label>
          <input className="form-control mb-3" type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" />
          {err && <div className="alert alert-danger py-2 small">{err}</div>}
          <button className="btn btn-navy w-100" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <div className="text-secondary small mt-3" style={{ lineHeight: 1.6 }}>
            Default logins — Admin: <code>admin / admin@123</code> · Technician: <code>tech / tech@123</code>.
            Change both in Settings after first login.
          </div>
        </form>
      </div>
    </div>
  );
}
