// Tasks and projects (product plan section 9): one-off actions, repairs,
// errands, and bigger outcomes made of several tasks. Pure - no DOM.
//
// A project is a task with kind 'project'; its tasks point at it with parentId.
// Dates are flexible: a task may have a planned day or none. A date that has
// passed is shown neutrally ("planned for Tue"), never as a growing overdue
// count (plan sections 3.7 and 8.6).

import { dayDiff } from '../../dates.js';

export const STATUSES = ['open', 'doing', 'done', 'dropped'];
export const STATUS_LABEL = { open: 'To do', doing: 'In progress', done: 'Done', dropped: 'No longer needed' };
export const CATEGORIES = ['household', 'repair', 'errand', 'admin', 'garden', 'kids', 'other'];

const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));

export function normaliseTask(t = {}) {
  const checklist = (Array.isArray(t.checklist) ? t.checklist : [])
    .filter((c) => c && typeof c.text === 'string' && c.text.trim())
    .map((c, i) => ({ id: str(c.id, 40) || `ck${i}`, text: c.text.trim().slice(0, 300), done: c.done === true }));
  return {
    ...t,
    title: str(t.title, 200) || 'Untitled task',
    description: str(t.description),
    kind: t.kind === 'project' ? 'project' : 'task',
    parentId: typeof t.parentId === 'string' && t.parentId ? t.parentId : null,
    category: CATEGORIES.includes(t.category) ? t.category : 'other',
    status: STATUSES.includes(t.status) ? t.status : 'open',
    due: day(t.due),
    assignees: ids(t.assignees),
    minutes: num(t.minutes),
    effort: ['low', 'medium', 'high'].includes(t.effort) ? t.effort : null,
    cost: num(t.cost),
    checklist,
    dependsOn: ids(t.dependsOn),
    links: Array.isArray(t.links) ? t.links.filter((l) => l && l.app && l.id).slice(0, 20) : [],
    completedAt: typeof t.completedAt === 'string' ? t.completedAt : null,
    completedBy: typeof t.completedBy === 'string' ? t.completedBy : null,
    source: typeof t.source === 'string' && /^[a-z][a-z0-9.-]*:[A-Za-z0-9_-]+$/.test(t.source) ? t.source : null,   // e.g. 'tickets:tkt_...'
    visibility: 'shared',
  };
}

/** What the index keeps: enough to list, filter and sort without opening a task. */
export function taskSummary(t) {
  return {
    title: t.title,
    kind: t.kind,
    status: t.status,
    parentId: t.parentId,
    due: t.due,
    category: t.category,
    assignees: t.assignees,
    checklistDone: t.checklist.filter((c) => c.done).length,
    checklistTotal: t.checklist.length,
    dependsOn: t.dependsOn,
    source: t.source,
  };
}

export const taskText = (t) => [t.title, t.description, t.category, ...t.checklist.map((c) => c.text)].join(' ');

export const isOpen = (s) => s.status === 'open' || s.status === 'doing';

/** Open first; then those with a planned day, soonest first; then the newest. */
export function sortTasks(a, b) {
  if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
  if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
  if (Boolean(a.due) !== Boolean(b.due)) return a.due ? -1 : 1;
  return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));
}

/** "today", "tomorrow", "Fri", or a neutral "planned for 12 Oct" for a passed day. */
export function dueText(due, today, fmtDay) {
  if (!due) return 'no set day';
  const d = dayDiff(today, due);
  if (d < 0) return `planned for ${fmtDay(due, today)}`;
  return fmtDay(due, today);
}

/** A task can be started when every task it waits for is done or no longer needed. */
export function waitingOn(summary, all) {
  return summary.dependsOn
    .map((id) => all.find((x) => x.id === id))
    .filter((x) => x && isOpen(x));
}

export function projectProgress(projectId, all) {
  const kids = all.filter((t) => t.parentId === projectId && t.status !== 'dropped');
  return { done: kids.filter((t) => t.status === 'done').length, total: kids.length };
}

/** Mark done / reopen / drop, keeping who and when. */
export function setStatus(task, status, { by = null, now = new Date().toISOString() } = {}) {
  if (!STATUSES.includes(status)) throw new Error(`Unknown status ${status}`);
  return {
    ...task,
    status,
    completedAt: status === 'done' ? now : null,
    completedBy: status === 'done' ? by : null,
  };
}

export function toggleChecklist(task, itemId) {
  return { ...task, checklist: task.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) };
}

export function addChecklistItem(task, text, id = `ck${Date.now().toString(36)}`) {
  const t = String(text || '').trim();
  return t ? { ...task, checklist: [...task.checklist, { id, text: t.slice(0, 300), done: false }] } : task;
}

/** Filters for the list screen, by name. */
export const FILTERS = {
  open: (s) => isOpen(s) && s.kind === 'task',
  mine: (s, personId) => isOpen(s) && s.assignees.includes(personId),
  projects: (s) => s.kind === 'project' && s.status !== 'dropped',
  finished: (s) => !isOpen(s),
};
