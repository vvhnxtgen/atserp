import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';
import api from './api';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [booted, setBooted] = useState(false);
  const [toasts, setToasts] = useState([]);
  // Auto-open the print dialog after saving a TRF/challan. Default OFF.
  const [autoPrint, setAutoPrintState] = useState(localStorage.getItem('ats_autoprint') === '1');
  const setAutoPrint = useCallback((on) => {
    setAutoPrintState(on);
    localStorage.setItem('ats_autoprint', on ? '1' : '0');
  }, []);

  const refreshSettings = useCallback(async () => {
    const { data } = await api.get('/api/settings/');
    setSettings(data);
    return data;
  }, []);

  useEffect(() => {
    (async () => {
      if (localStorage.getItem('ats_token')) {
        try {
          const { data } = await api.get('/api/auth/me/');
          setUser(data);
          await refreshSettings();
        } catch { /* token invalid — interceptor clears it */ }
      }
      setBooted(true);
    })();
  }, [refreshSettings]);

  const login = async (username, password) => {
    const { data } = await api.post('/api/auth/login/', { username, password });
    localStorage.setItem('ats_token', data.token);
    setUser(data.user);
    await refreshSettings();
    return data.user;
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout/'); } catch { /* ignore */ }
    localStorage.removeItem('ats_token');
    setUser(null);
  };

  const toast = useCallback((msg, opts = {}) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.delay || 8000);
  }, []);

  /** Workflow notification: toast + real WhatsApp status (or one-tap wa.me fallback) + email status. */
  const notify = useCallback((title, lines = [], notifyResult) => {
    const s = settings;
    // Back-compat: callers may pass the email status string, or the full object.
    const info = (notifyResult && typeof notifyResult === 'object')
      ? notifyResult
      : { email: notifyResult, whatsapp: 'skipped', wa_link: '' };

    const parts = [];
    if (info.email === 'sent') parts.push('✓ email sent');
    else if (info.email === 'failed') parts.push('email failed — check Gmail settings');
    if (info.whatsapp === 'sent') parts.push('✓ WhatsApp sent');
    else if (info.whatsapp === 'failed') parts.push('WhatsApp failed — check provider settings');
    const extra = parts.length ? '  ·  ' + parts.join('  ·  ') : '';

    const body = lines.filter(Boolean).join('\n');
    const full = `[${s?.name || 'Lab'} ERP]\n${title}\n${body}\nBy: ${user?.name || ''}`;

    // Only offer the manual wa.me tap when the backend is in "link" mode
    // (no WhatsApp API credentials). If it already auto-sent, no button needed.
    const linkUrl = info.wa_link
      || (info.whatsapp === 'link' && s?.admin_whatsapp
          ? 'https://wa.me/' + String(s.admin_whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent(full)
          : '');
    const action = linkUrl
      ? { label: 'WhatsApp admin', fn: () => window.open(linkUrl, '_blank') }
      : null;
    toast(title + extra, { action });
  }, [settings, user, toast]);

  const value = useMemo(() => ({ user, settings, booted, login, logout, refreshSettings, toast, notify, autoPrint, setAutoPrint }),
    [user, settings, booted, refreshSettings, toast, notify, autoPrint, setAutoPrint]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastContainer className="toasts-fix">
        {toasts.map((t) => (
          <Toast key={t.id} bg={t.variant || 'dark'} onClose={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            <Toast.Body className="text-white d-flex align-items-start gap-3">
              <span style={{ whiteSpace: 'pre-line', flex: 1 }}>{t.msg}</span>
              {t.action && (
                <button className="btn btn-sm btn-gold" onClick={t.action.fn}>{t.action.label}</button>
              )}
              <button className="btn-close btn-close-white ms-1" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} />
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </Ctx.Provider>
  );
}
