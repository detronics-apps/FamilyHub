// Tasks: one-off jobs and projects. Screens: the lists (to do, mine, projects,
// finished), one task, and the add/edit form. Data through hub.data only.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay } from '../../dates.js';
import { tabs, loading, failure, recordForm, saveRecord, nameOf } from '../kit.js';
import {
  normaliseTask, taskSummary, taskText, sortTasks, dueText, waitingOn, projectProgress, setStatus,
  toggleChecklist, addChecklistItem, FILTERS, STATUS_LABEL, CATEGORIES,
} from './logic.js';

const ui = { query: '', showAll: false };

const col = (hub) => hub.data.collection('tasks', { summary: taskSummary, text: taskText, prefix: 'tsk' });
const allSummaries = (hub) => hub.use('all', async () => (await col(hub).list({ limit: 100000 })).items);

export function render(hub, route) {
  const screen = route.sub ?? 'open';
  if (screen === 'task' || screen === 'item') return taskScreen(hub, route.rest[0]);
  if (screen === 'new') return editScreen(hub, null, route.rest[0] ?? null);
  if (screen === 'edit') return editScreen(hub, route.rest[0]);
  return listScreen(hub, FILTERS[screen] ? screen : 'open');
}

function nav(hub, current) {
  return tabs(hub, [
    { screen: null, label: 'To do' }, { screen: 'mine', label: 'Mine' },
    { screen: 'projects', label: 'Projects' }, { screen: 'finished', label: 'Finished' },
  ], current === 'open' ? null : current);
}

function listScreen(hub, filter) {
  const all = allSummaries(hub);
  const me = hub.people.current();
  const quick = el('input', { class: 'input', id: 'quick-task', placeholder: filter === 'projects' ? 'Name a new project and press Enter' : 'Add a task and press Enter', 'data-field': 'quick-task', autocomplete: 'off' });
  const addQuick = async () => {
    const title = quick.value.trim();
    if (!title) return;
    await saveRecord(hub, col(hub), normaliseTask({ title, kind: filter === 'projects' ? 'project' : 'task', assignees: filter === 'mine' && me ? [me.id] : [] }));
    hub.ui.notice(`Added: ${title}`);
  };
  quick.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addQuick(); } });

  let body;
  if (all.loading) body = loading();
  else if (all.error) body = failure(all.error);
  else {
    let items = all.data.filter((s) => FILTERS[filter](s, me?.id));
    if (ui.query.trim()) {
      const q = ui.query.toLowerCase().split(/\s+/).filter(Boolean);
      items = items.filter((s) => q.every((w) => s.title.toLowerCase().includes(w)));
    }
    items.sort(sortTasks);
    const shown = ui.showAll ? items : items.slice(0, 50);
    body = items.length
      ? el('div', { class: 'stack' }, [
        el('ul', { class: 'list panel' }, shown.map((s) => row(hub, s, all.data))),
        items.length > shown.length ? el('button', { class: 'btn', type: 'button', text: `Show ${items.length - shown.length} more`, on: { click: () => { ui.showAll = true; hub.render(); } } }) : null,
      ])
      : el('div', { class: 'panel empty' }, [el('p', { text: {
        open: 'Nothing to do. Add something above when it comes up.',
        mine: me ? 'Nothing assigned to you.' : 'Say who you are (top right) to see your tasks.',
        projects: 'No projects yet. A project groups the tasks for one bigger outcome - like "Sort out the garage".',
        finished: 'Finished and dropped tasks will be listed here.',
      }[filter] })]);
  }

  return el('section', { class: 'stack', 'aria-label': 'Tasks' }, [
    nav(hub, filter),
    filter !== 'finished' ? el('div', { class: 'row' }, [
      el('label', { class: 'sr-only', for: 'quick-task', text: 'New task' }),
      el('div', { style: { flex: '1 1 240px' } }, [quick]),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Add', on: { click: addQuick } }),
      el('a', { class: 'btn', href: hub.href('new'), text: 'Add with details' }),
    ]) : null,
    el('input', {
      class: 'input', type: 'search', placeholder: 'Find a task', 'aria-label': 'Find a task', value: ui.query, 'data-field': 'task-search',
      on: { change: (e) => { ui.query = e.target.value; hub.render(); } },
    }),
    body,
  ]);
}

function row(hub, s, all) {
  const people = hub.people.list();
  const waiting = waitingOn(s, all);
  const progress = s.kind === 'project' ? projectProgress(s.id, all) : null;
  const parent = s.parentId ? all.find((x) => x.id === s.parentId) : null;
  const meta = [
    s.kind === 'project' ? `Project · ${progress.done} of ${progress.total} done` : null,
    parent ? `in ${parent.title}` : null,
    s.status === 'doing' ? 'in progress' : null,
    s.due ? dueText(s.due, hub.today(), fmtDay) : null,
    s.assignees.length ? s.assignees.map((id) => nameOf(people, id)).join(', ') : null,
    s.checklistTotal ? `${s.checklistDone}/${s.checklistTotal} steps` : null,
    waiting.length ? `waits for ${waiting.map((w) => w.title).join(', ')}` : null,
    s.status === 'done' || s.status === 'dropped' ? STATUS_LABEL[s.status] : null,
  ].filter(Boolean).join(' · ');
  return el('li', {}, [
    el('a', { class: 'list__main', href: hub.href('task', s.id), style: { color: 'inherit', textDecoration: 'none' } }, [
      el('strong', { text: s.title }),
      meta ? el('div', { class: 'small muted', text: meta }) : null,
    ]),
    s.kind === 'task' && (s.status === 'open' || s.status === 'doing') ? el('button', {
      class: 'btn btn-small', type: 'button', text: 'Done', 'data-field': `task-done:${s.id}`,
      on: { click: () => quickStatus(hub, s.id, 'done') },
    }) : null,
  ]);
}

async function quickStatus(hub, id, status) {
  const c = col(hub);
  const t = await c.get(id);
  if (!t) return;
  await saveRecord(hub, c, setStatus(normaliseTask(t), status, { by: hub.people.current()?.id ?? null }));
  hub.ui.notice(status === 'done' ? `Done: ${t.title}.` : `${t.title}: ${STATUS_LABEL[status].toLowerCase()}.`, 'ok', {
    label: 'Undo', onClick: () => quickStatus(hub, id, t.status),
  });
}

function taskScreen(hub, id) {
  const r = hub.use(`task:${id}`, () => col(hub).get(id));
  const all = allSummaries(hub);
  if (r.loading || all.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This task no longer exists.' }), el('a', { class: 'btn', href: hub.href(), text: 'Back to tasks' })]);
  const t = normaliseTask(r.data);
  const people = hub.people.list();
  const save = async (next, message) => { await saveRecord(hub, col(hub), next); if (message) hub.ui.notice(message); };
  const kids = all.data.filter((s) => s.parentId === t.id).sort(sortTasks);
  const parent = t.parentId ? all.data.find((s) => s.id === t.parentId) : null;
  const waiting = waitingOn(taskSummary(t), all.data);
  const newItem = el('input', { class: 'input', placeholder: 'Add a step', 'aria-label': 'Add a step', 'data-field': 'new-step' });
  newItem.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(addChecklistItem(t, newItem.value)); } });
  const open = t.status === 'open' || t.status === 'doing';
  const by = hub.people.current()?.id ?? null;

  return el('section', { class: 'stack', 'aria-label': t.title }, [
    el('a', { href: hub.href(t.kind === 'project' ? 'projects' : null), class: 'small', text: `‹ ${t.kind === 'project' ? 'Projects' : 'Tasks'}` }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'card__label', text: t.kind === 'project' ? 'Project' : STATUS_LABEL[t.status] }),
      el('h1', { text: t.title, style: { margin: 0 } }),
      el('p', { class: 'small muted', text: [
        parent ? `Part of ${parent.title}` : null,
        t.due ? dueText(t.due, hub.today(), fmtDay) : 'no set day',
        t.assignees.length ? `for ${t.assignees.map((x) => nameOf(people, x)).join(', ')}` : 'anyone can do it',
        t.minutes != null ? `about ${t.minutes} min` : null,
        t.cost != null ? `about ${t.cost} to spend` : null,
        t.status === 'done' && t.completedAt ? `done ${fmtDay(t.completedAt.slice(0, 10), hub.today())}${t.completedBy ? ` by ${nameOf(people, t.completedBy)}` : ''}` : null,
      ].filter(Boolean).join(' · ') }),
      t.description ? el('p', { text: t.description }) : null,
      waiting.length ? el('p', { class: 'small', text: `Waits for: ${waiting.map((w) => w.title).join(', ')}` }) : null,
      el('div', { class: 'row' }, [
        open && t.kind === 'task' ? el('button', { class: 'btn btn-primary', type: 'button', text: 'Mark done', 'data-field': 'task-mark-done', on: { click: () => save(setStatus(t, 'done', { by }), `Done: ${t.title}.`) } }) : null,
        t.status === 'open' && t.kind === 'task' ? el('button', { class: 'btn', type: 'button', text: 'Start', on: { click: () => save(setStatus(t, 'doing')) } }) : null,
        open && t.kind === 'project' ? el('button', { class: 'btn btn-primary', type: 'button', text: 'Project finished', on: { click: () => save(setStatus(t, 'done', { by }), `${t.title} is finished.`) } }) : null,
        !open ? el('button', { class: 'btn', type: 'button', text: 'Reopen', on: { click: () => save(setStatus(t, 'open')) } }) : null,
        open ? el('button', { class: 'btn btn-quiet', type: 'button', text: 'No longer needed', on: { click: () => save(setStatus(t, 'dropped'), `${t.title} closed.`) } }) : null,
        el('a', { class: 'btn', href: hub.href('edit', t.id), text: 'Edit' }),
      ]),
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Steps' }),
      t.checklist.length ? el('ul', { class: 'list' }, t.checklist.map((c) => el('li', {}, [
        el('label', { class: 'checkline list__main' }, [
          el('input', { type: 'checkbox', checked: c.done, on: { change: () => save(toggleChecklist(t, c.id)) } }),
          el('span', { text: c.text, style: c.done ? { textDecoration: 'line-through', color: 'var(--text-faint)' } : null }),
        ]),
      ]))) : el('p', { class: 'small muted', text: 'No steps. Add some if it helps to break it down.' }),
      newItem,
    ]),
    t.kind === 'project' ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Tasks in this project' }),
      kids.length ? el('ul', { class: 'list' }, kids.map((s) => row(hub, s, all.data))) : el('p', { class: 'small muted', text: 'None yet.' }),
      el('a', { class: 'btn', href: hub.href('new', t.id), text: 'Add a task to this project' }),
    ]) : null,
    t.source ? el('p', { class: 'small' }, ['Started from ', el('a', { href: `#/${t.source.split(':')[0]}/item/${encodeURIComponent(t.source.split(':')[1])}`, text: t.source.startsWith('tickets') ? 'a ticket' : 'a decision' }), '.']) : null,
    t.links.length ? el('div', { class: 'panel' }, [
      el('h2', { text: 'Linked' }),
      el('ul', { class: 'list' }, t.links.map((l) => el('li', {}, [el('a', { href: `#/${l.app}/${l.screen ?? 'item'}/${encodeURIComponent(l.id)}`, text: l.title ?? l.id }), el('span', { class: 'small muted', text: ` (${l.app})` })]))),
    ]) : null,
    el('button', {
      class: 'btn btn-danger', type: 'button', text: 'Delete this task',
      on: {
        click: async () => {
          if (!await confirmAction({ title: `Delete ${t.title}?`, text: kids.length ? 'Its tasks stay, without a project.' : 'This cannot be undone. "No longer needed" keeps it in the history instead.', confirmLabel: 'Delete', danger: true })) return;
          await col(hub).remove(t.id);
          hub.invalidate();
          hub.go(null);
        },
      },
    }),
  ]);
}

/** "new/<project id>" adds to a project; "new/tickets:<id>" or "new/decisions:<id>" starts from that record. */
function sourceRecord(hub, from) {
  const [app, rid] = from.split(':');
  if (!['tickets', 'decisions'].includes(app) || !hub.data.installed(app)) return { data: null };
  return hub.use(`src:${from}`, () => hub.data.of(app, app).get(rid));
}

function editScreen(hub, id, param = null) {
  const r = id ? hub.use(`task:${id}`, () => col(hub).get(id)) : { loading: false, data: null };
  const all = allSummaries(hub);
  const from = !id && param?.includes(':') ? param : null;
  const src = from ? sourceRecord(hub, from) : { data: null };
  if (r.loading || all.loading || src.loading) return loading();
  if (r.error) return failure(r.error);
  const existing = r.data ? normaliseTask(r.data) : null;
  const srcTitle = src.data ? String(src.data.text ?? src.data.agreement ?? src.data.title ?? '').split('\n')[0].slice(0, 120) : '';
  const record = existing ?? normaliseTask({ title: srcTitle, parentId: from ? null : param, source: src.data ? from : null });
  const projects = all.data.filter((s) => s.kind === 'project' && s.id !== id && s.status !== 'dropped');
  const others = all.data.filter((s) => s.id !== id && s.kind === 'task' && (s.status === 'open' || s.status === 'doing' || record.dependsOn.includes(s.id)));

  return el('section', { class: 'stack' }, [
    el('h1', { text: existing ? `Edit ${existing.title}` : 'Add a task' }),
    src.data ? el('p', { class: 'small muted', text: `Started from ${from.startsWith('tickets') ? 'a ticket' : 'a decision'} - it is linked, and will show this task.` }) : null,
    recordForm({
      record: { ...record, title: existing || src.data ? record.title : '' },
      people: hub.people.list(),
      fields: [
        { key: 'title', label: 'What needs doing?', required: true },
        { key: 'due', label: 'Planned for (optional)', type: 'day', hint: 'Leave empty if it can happen whenever.' },
        { key: 'assignees', label: 'Who will do it', type: 'people', hint: 'None ticked: anyone.' },
        { key: 'description', label: 'Notes', type: 'textarea', more: true },
        { key: 'kind', label: 'Kind', type: 'select', options: [['task', 'A task'], ['project', 'A project (several tasks)']], more: true },
        { key: 'parentId', label: 'Part of a project', type: 'select', options: [['', 'No project'], ...projects.map((p) => [p.id, p.title])], more: true },
        { key: 'category', label: 'Category', type: 'select', options: CATEGORIES.map((c) => [c, c[0].toUpperCase() + c.slice(1)]), more: true },
        { key: 'minutes', label: 'About how long (minutes)', type: 'number', placeholder: 'not sure', more: true },
        { key: 'effort', label: 'Effort', type: 'select', options: [['', 'Not sure'], ['low', 'Low'], ['medium', 'Some'], ['high', 'A big effort']], more: true },
        { key: 'cost', label: 'Cost, if any', type: 'number', more: true },
        { key: 'dependsOn', label: 'Wait until these are done', type: 'choices', options: others.map((s) => [s.id, s.title]), more: true },
      ],
      onCancel: () => (existing ? hub.go('task', existing.id) : hub.go(null)),
      onSave: async (values) => {
        const next = normaliseTask({ ...record, ...values });
        const saved = await saveRecord(hub, col(hub), next);
        if (!saved) return;
        hub.ui.notice(existing ? 'Saved.' : 'Added.');
        hub.go('task', saved.id);
      },
    }),
  ]);
}
