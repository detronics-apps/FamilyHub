// A plain page to print (or save as PDF), built from nodes (D-129). The print window shares the
// app's address, so nothing a family typed may ever be read as markup there: every value goes in
// as text. Pure apart from the `doc` it is handed - tests pass a stand-in.

const STYLE = 'body{font:16px/1.5 system-ui,sans-serif;margin:2rem;color:#222}h1{font-size:1.4rem}pre{white-space:pre-wrap;font:inherit}'
  + 'table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px 8px;text-align:left;vertical-align:top}.n{color:#555;font-size:.9rem}';

export const PRINT_NOTE = 'If you are wondering whether to go to a doctor, go.';

/**
 * Fill `doc` with a printable page: a title, then plain text or a table, then a note.
 * @param {Document} doc
 * @param {{ title: string, text?: string, columns?: string[], rows?: Array<Array<string>>, note?: string, today?: string }} page
 */
export function buildPrint(doc, { title, text = '', columns = null, rows = [], note = '', today = '' }) {
  const make = (tag, value) => { const n = doc.createElement(tag); if (value !== undefined) n.textContent = String(value); return n; };
  doc.title = String(title ?? '');
  const head = doc.head ?? doc.documentElement;
  const charset = doc.createElement('meta'); charset.setAttribute('charset', 'utf-8');
  head.appendChild(charset);
  head.appendChild(make('style', STYLE));
  const body = doc.body;
  body.appendChild(make('h1', title ?? ''));
  if (columns) {
    const table = doc.createElement('table');
    const tr = doc.createElement('tr');
    for (const c of columns) tr.appendChild(make('th', c));
    table.appendChild(tr);
    for (const r of rows) {
      const row = doc.createElement('tr');
      for (let i = 0; i < columns.length; i += 1) row.appendChild(make('td', r[i] ?? ''));
      table.appendChild(row);
    }
    body.appendChild(table);
  } else {
    body.appendChild(make('pre', text));
  }
  const n = make('p', note || `Printed ${today} from Family Hub. ${PRINT_NOTE}`);
  n.setAttribute('class', 'n');
  body.appendChild(n);
  return doc;
}
