import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseTicket, ticketSummary, headline, agenda, setStatus, TYPES } from '../js/apps/tickets/logic.js';

test('capture needs only some words; type defaults to an observation', () => {
  const t = normaliseTicket({ text: '  Bedtime went smoothly tonight  ' });
  assert.equal(t.text, 'Bedtime went smoothly tonight');
  assert.equal(t.type, 'observation');
  assert.equal(t.status, 'captured');
  assert.equal(t.visibility, 'shared');
  assert.equal(normaliseTicket({ text: 'x', visibility: 'private' }).visibility, 'shared', 'private needs accounts first');
});

test('the plan’s six ticket types exist', () => {
  assert.deepEqual(Object.keys(TYPES).sort(), ['appreciation', 'concern', 'idea', 'improvement', 'observation', 'success']);
});

test('headline: first line, short', () => {
  assert.equal(headline('Line one\nline two'), 'Line one');
  assert.equal(headline('x'.repeat(200)).length, 88);
});

test('meeting agenda: appreciations first, then what was chosen; the rest waits untouched', () => {
  const s = [
    { id: '1', type: 'appreciation', status: 'captured' },
    { id: '2', type: 'concern', status: 'discuss' },
    { id: '3', type: 'idea', status: 'captured' },
    { id: '4', type: 'concern', status: 'closed' },
    { id: '5', type: 'idea', status: 'deferred' },
  ];
  const a = agenda(s);
  assert.deepEqual(a.appreciations.map((x) => x.id), ['1']);
  assert.deepEqual(a.toDiscuss.map((x) => x.id), ['2']);
  assert.deepEqual(a.waiting.map((x) => x.id), ['3']);
  assert.deepEqual(a.later.map((x) => x.id), ['5']);
});

test('a ticket can be closed with no action, and reopened', () => {
  const t = normaliseTicket({ text: 'Screen time transitions are hard', type: 'concern' });
  const closed = setStatus(t, 'closed', { reason: 'Resolved itself after the holidays' });
  assert.equal(closed.outcome, 'none');
  assert.equal(closed.closedReason, 'Resolved itself after the holidays');
  const reopened = setStatus(closed, 'discuss');
  assert.equal(reopened.outcome, null);
  assert.equal(ticketSummary(reopened).status, 'discuss');
  assert.throws(() => setStatus(t, 'archived'), /Unknown status/);
});
