// Bringing in data that existed before (product-patterns: onboarding import).
// Each mini-app that accepts imports describes its spreadsheet template:
//
//   { kind, label, app, collection, columns: [{ name, required, help }],
//     example: [{ column: value }], key(record), fromRow(values) -> { record } | { error } }
//
// Import is additive and idempotent: a row whose key (usually its name)
// already exists is reported as "already there", never added twice; a bad
// row is reported by line and the rest still go in. Pure - no DOM.

import { parseCSV, toObjects, toCSV } from './csv.js';

/** The template file: the header row (required columns marked *) and the example rows. */
export function templateCSV(imp) {
  const head = imp.columns.map((c) => (c.required ? `${c.name}*` : c.name));
  const rows = imp.example.map((ex) => imp.columns.map((c) => ex[c.name] ?? ''));
  return toCSV([head, ...rows]);
}

export const templateName = (imp) => `${imp.kind}-template.csv`;

/**
 * Which importer a file is for: by file name first ("recipes.csv",
 * "my recipes 2026.csv"), then by its columns.
 */
export function detectImporter(fileName, headers, importers) {
  const name = String(fileName || '').toLowerCase();
  const byName = importers.find((imp) => name.includes(imp.kind) || name.includes(imp.label.toLowerCase()));
  if (byName) return byName;
  const set = new Set(headers);
  const scored = importers
    .map((imp) => ({ imp, req: imp.columns.filter((c) => c.required).every((c) => set.has(c.name)), hits: imp.columns.filter((c) => set.has(c.name)).length }))
    .filter((x) => x.req && x.hits >= 2)
    .sort((a, b) => b.hits - a.hits);
  return scored[0]?.imp ?? null;
}

/**
 * Work out what an import would do, without doing it.
 * @param existingKeys  Set of keys already held
 * @returns {{ add: Array<{line, record}>, matched: Array<{line, name}>, errors: Array<{line, message}> }}
 */
export function planImport(imp, text, existingKeys) {
  const rows = parseCSV(text);
  if (!rows.length) return { add: [], matched: [], errors: [{ line: 1, message: 'The file is empty.' }] };
  const { headers, records } = toObjects(rows);
  const missing = imp.columns.filter((c) => c.required && !headers.includes(c.name));
  if (missing.length) {
    return { add: [], matched: [], errors: [{ line: 1, message: `The first row must name the columns; missing: ${missing.map((c) => c.name).join(', ')}.` }] };
  }
  const seen = new Set(existingKeys);
  const out = { add: [], matched: [], errors: [] };
  for (const { line, values } of records) {
    let r;
    try { r = imp.fromRow(values); } catch (err) { r = { error: err.message }; }
    if (r.error) { out.errors.push({ line, message: r.error }); continue; }
    const k = imp.key(r.record);
    if (seen.has(k)) { out.matched.push({ line, name: r.name ?? k }); continue; }
    seen.add(k);                                    // a repeat further down the same file is "already there" too
    out.add.push({ line, record: r.record });
  }
  return out;
}

/** One short sentence for a notice or a report file. */
export function describeImport(imp, plan, fileName) {
  const parts = [`${plan.add.length} new ${plan.add.length === 1 ? imp.singular ?? imp.label.toLowerCase() : imp.label.toLowerCase()}`];
  if (plan.matched.length) parts.push(`${plan.matched.length} already there`);
  if (plan.errors.length) parts.push(`${plan.errors.length} line${plan.errors.length === 1 ? '' : 's'} with a problem (${plan.errors.slice(0, 3).map((e) => `line ${e.line}: ${e.message}`).join('; ')}${plan.errors.length > 3 ? '; ...' : ''})`);
  return `${fileName}: ${parts.join(', ')}.`;
}

/** Shared helpers for fromRow. */
export const split = (v, by = /\s*[;\n]\s*/) => String(v || '').split(by).map((x) => x.trim()).filter(Boolean);
export const yes = (v) => /^(y|yes|true|1|x)$/i.test(String(v || '').trim());
export const numOrNull = (v) => {
  const t = String(v ?? '').trim().replace(',', '.');
  return t === '' || !Number.isFinite(Number(t)) ? null : Number(t);
};
export const dayOrNull = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : null);
