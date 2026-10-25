// CSV - what spreadsheets (Excel, Google Sheets, Numbers) read and write.
// RFC 4180: quoted fields, doubled quotes, line breaks inside quotes, CRLF.
// Also copes with a byte-order mark and with ";"-separated files (common
// where the decimal separator is a comma). Pure.

/** Rows of strings. The delimiter is detected from the first line unless given. */
export function parseCSV(text, delimiter = null) {
  let s = String(text ?? '');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  const d = delimiter ?? detectDelimiter(s);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === d) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

function detectDelimiter(s) {
  const first = s.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch) => first.split(ch).length - 1;
  return count(';') > count(',') ? ';' : ',';
}

/** Rows as objects keyed by the (trimmed, lower-cased) header row. */
export function toObjects(rows) {
  const [head = [], ...body] = rows;
  const keys = head.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/\*$/, ''));
  return { headers: keys, records: body.map((r, i) => ({ line: i + 2, values: Object.fromEntries(keys.map((k, j) => [k, (r[j] ?? '').trim()])) })) };
}

const needsQuotes = /[",\n\r;]/;
export const toCSV = (rows) => rows.map((r) => r.map((v) => {
  const t = String(v ?? '');
  return needsQuotes.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}).join(',')).join('\r\n');
