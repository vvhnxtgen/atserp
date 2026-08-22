import { inr, num } from '../lib/format';

/** Generic dynamic line-item table.
 *  columns: [{key,label,type?,width?,placeholder?,list?}] · rows/onChange · amount: show qty×rate */
export default function ItemsEditor({ columns, rows, onChange, amount = false, addLabel = '+ Add row' }) {
  const blank = () => Object.fromEntries(columns.map((c) => [c.key, c.def ?? '']));
  const set = (i, k, v) => onChange(rows.map((r, x) => (x === i ? { ...r, [k]: v } : r)));
  const rm = (i) => (rows.length > 1 ? onChange(rows.filter((_, x) => x !== i)) : null);

  return (
    <div className="table-responsive">
      <table className="table table-sm tbl align-middle mb-2">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
            {amount && <th className="text-end" style={{ width: '14%' }}>Amount</th>}
            <th style={{ width: 34 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>
                  <input
                    className="form-control form-control-sm"
                    type={c.type || 'text'}
                    min={c.type === 'number' ? 0 : undefined}
                    placeholder={c.placeholder || ''}
                    list={c.list}
                    value={r[c.key]}
                    onChange={(e) => set(i, c.key, e.target.value)}
                  />
                </td>
              ))}
              {amount && (
                <td className="text-end num">
                  {num(r.qty) && num(r.rate) ? inr(num(r.qty) * num(r.rate)) : '—'}
                </td>
              )}
              <td>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => rm(i)}
                  disabled={rows.length <= 1} title="Remove">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onChange([...rows, blank()])}>
        {addLabel}
      </button>
    </div>
  );
}
