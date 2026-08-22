export const num = (v) => { const n = parseFloat(v); return Number.isNaN(n) ? 0 : n; };

export const inr = (n, dec = 2) =>
  '₹ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const fmtD = (d) => {
  if (!d) return '—';
  const x = new Date(String(d).length === 10 ? d + 'T00:00' : d);
  return Number.isNaN(x.getTime())
    ? String(d)
    : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDT = (t) =>
  t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function words(n) {
  n = Math.round(n);
  if (n === 0) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''));
  const three = (x) => {
    let s = '';
    if (x > 99) { s += a[Math.floor(x / 100)] + ' Hundred'; if (x % 100) s += ' and '; }
    if (x % 100) s += two(x % 100);
    return s;
  };
  let s = '';
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const la = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1e3); const re = n % 1e3;
  if (cr) s += three(cr) + ' Crore ';
  if (la) s += two(la) + ' Lakh ';
  if (th) s += two(th) + ' Thousand ';
  if (re) s += three(re);
  return s.trim();
}
export const inWords = (n) => 'Rupees ' + words(Math.round(Number(n || 0))) + ' Only';

export const STAGES = ['TRF Registered', 'Chamber Allocated', 'Test Operation', 'Results Recorded', 'Report Uploaded'];
