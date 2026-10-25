// Family Notes - an example third-party mini-app.
//
// It runs inside Family Hub's sandbox: no network, no access to anything but
// what `hub` offers, and `hub` only offers what its manifest asked for and
// the family approved. Every hub call returns a promise.

FamilyHub.ready(async (hub) => {
  const root = document.getElementById('app');
  const people = await hub.people.list();
  let query = '';

  const h = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
    }
    n.append(...kids.flat().filter((k) => k != null));
    return n;
  };

  const style = h('style', {}, `
    .wrap { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
    .card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; }
    input, textarea, select { width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--panel); color: var(--text); }
    button { padding: 8px 16px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--panel); color: var(--text); cursor: pointer; font-weight: 600; }
    .primary { background: var(--accent-strong); border-color: var(--accent-strong); color: var(--accent-ink); }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .muted { color: var(--text-faint); font-size: 13px; }
    h2 { margin: 0; font-size: 18px; }`);

  async function draw() {
    const result = query ? await hub.data.search('notes', query, { limit: 50 }) : await hub.data.list('notes', { limit: 50 });
    const title = h('input', { placeholder: 'Note title', 'aria-label': 'Note title' });
    const body = h('textarea', { rows: 3, placeholder: 'More detail (optional)', 'aria-label': 'Note detail' });
    const author = h('select', { 'aria-label': 'Written by' }, h('option', { value: '' }, 'Someone'), people.map((p) => h('option', { value: p.name }, p.name)));
    const search = h('input', { type: 'search', placeholder: 'Search notes', value: query, 'aria-label': 'Search notes', onchange: (e) => { query = e.target.value; draw(); } });

    root.replaceChildren(style, h('div', { class: 'wrap' },
      h('div', { class: 'card' },
        h('h2', {}, 'Add a note'),
        title, body,
        h('div', { class: 'row' }, author,
          h('button', { class: 'primary', onclick: async () => {
            if (!title.value.trim()) { title.focus(); return; }
            await hub.data.put('notes', { title: title.value.trim(), body: body.value.trim(), author: author.value || 'Someone' });
            await hub.notify('Note added.', 'ok');
            draw();
          } }, 'Add'))),
      search,
      h('p', { class: 'muted' }, `${result.total} note${result.total === 1 ? '' : 's'}`),
      result.items.map((n) => {
        // The list holds summaries only; the full note is fetched when it is opened.
        const detail = h('p', { hidden: true });
        return h('div', { class: 'card' },
          h('div', { class: 'row' }, h('strong', {}, n.title), h('span', { class: 'muted' }, `by ${n.author}`)),
          detail,
          h('div', { class: 'row' },
            h('button', { onclick: async () => {
              if (detail.hidden) detail.textContent = (await hub.data.get('notes', n.id))?.body || '(no detail)';
              detail.hidden = !detail.hidden;
            } }, 'Read'),
            h('button', { onclick: async () => { await hub.data.remove('notes', n.id); draw(); } }, 'Remove')));
      })));
  }

  draw();
});
