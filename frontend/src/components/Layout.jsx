import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../ctx';

const NAV = [
  { sec: 'Overview', to: '/', label: 'Dashboard', icon: '▦', roles: ['admin'], end: true },
  { sec: 'Laboratory', to: '/test', label: 'Test — TRF Workflow', icon: '⚗', roles: ['admin', 'tech'] },
  { sec: 'Laboratory', to: '/quality', label: 'Quality & Traceability', icon: '✓', roles: ['admin', 'tech'] },
  { sec: 'Lab Records', to: '/equipment', label: 'Equipment List', icon: '⚒', roles: ['admin', 'tech'] },
  { sec: 'Lab Records', to: '/calibration', label: 'Calibration Certificates', icon: '◷', roles: ['admin', 'tech'] },
  { sec: 'Lab Records', to: '/reports', label: 'Upload Reports', icon: '▥', roles: ['admin', 'tech'] },
  { sec: 'Dispatch', to: '/dispatch', label: 'Dispatch Information', icon: '➤', roles: ['admin', 'tech'] },
  { sec: 'Dispatch', to: '/challan', label: 'Delivery Challan', icon: '⧉', roles: ['admin', 'tech'] },
  { sec: 'Commercial', to: '/business', label: 'Business', icon: '◈', roles: ['admin'] },
  { sec: 'Commercial', to: '/accounts', label: 'Accounts', icon: '₹', roles: ['admin'] },
  { sec: 'Accounts', to: '/indents', label: 'Indents', icon: '▤', roles: ['tech'] },
  { sec: 'System', to: '/settings', label: 'Settings', icon: '⚙', roles: ['admin'] },
];

const TITLES = {
  '/': ['Overview', 'Dashboard'], '/test': ['Laboratory', 'Test — TRF Workflow'],
  '/quality': ['Laboratory', 'Quality & Traceability'],
  '/equipment': ['Lab Records', 'Equipment List'],
  '/calibration': ['Lab Records', 'Calibration Certificates'],
  '/reports': ['Lab Records', 'Upload Reports'],
  '/dispatch': ['Dispatch', 'Dispatch Information'],
  '/challan': ['Dispatch', 'Delivery Challan'],
  '/business': ['Commercial', 'Business'], '/accounts': ['Commercial', 'Accounts'],
  '/indents': ['Accounts', 'Indents'], '/settings': ['System', 'Settings'],
};

export default function Layout() {
  const { user, settings, logout } = useApp();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { pathname } = useLocation();

  const base = '/' + (pathname.split('/')[1] || '');
  const [crumb, title] = TITLES[base] || TITLES[pathname.startsWith('/test') ? '/test' : '/'];
  const items = NAV.filter((n) => n.roles.includes(user.role));
  const first = (settings?.name || 'ARUDHYA').trim().split(/\s+/)[0].toUpperCase();

  let lastSec = '';
  return (
    <>
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="sb-head">
          <span className="sb-logo"><img src="/logo-white.png" alt="ATS" /></span>
          <div>
            <div className="t1">{first} ERP</div>
            <div className="t2">Testing · Quality · Accounts</div>
          </div>
        </div>
        <nav className="sb-nav">
          {items.map((n) => {
            const sec = n.sec !== lastSec ? <div className="sb-sec" key={'s' + n.sec}>{n.sec}</div> : null;
            lastSec = n.sec;
            return (
              <div key={n.to}>
                {sec}
                <NavLink to={n.to} end={n.end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
                  onClick={() => setOpen(false)}>
                  <span style={{ width: 18, textAlign: 'center' }}>{n.icon}</span>{n.label}
                </NavLink>
              </div>
            );
          })}
        </nav>
        <div className="sb-foot d-flex align-items-center gap-2">
          <div className="user-av">{(user.name || 'U')[0].toUpperCase()}</div>
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div className="user-role">{user.role === 'admin' ? 'Administrator' : 'Technician'}</div>
          </div>
          <button className="btn btn-sm btn-outline-light" title="Sign out"
            onClick={async () => { await logout(); nav('/login'); }}>⎋</button>
        </div>
      </aside>

      <div className="main-wrap">
        <div className="topbar">
          <button id="sbToggle" className="btn btn-outline-navy btn-sm" onClick={() => setOpen(!open)}>☰</button>
          <div>
            <div className="eyebrow">{crumb}</div>
            <h2>{title}</h2>
          </div>
          <div className="ms-auto" />
          {base === '/' && <div className="live-dot"><i />Live · 30s refresh</div>}
        </div>
        <div className="content"><Outlet /></div>
      </div>
    </>
  );
}
