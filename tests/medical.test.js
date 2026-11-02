import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseAccount, owed, outOfPocket, nextStep, tileNote, taxYear, taxYearSpan, yearView, missingProof, FILTERS, yearsOf,
} from '../js/apps/medical/logic.js';

const acc = (x) => normaliseAccount({ provider: 'Dr Naidoo', personId: 'p1', day: '2026-04-10', amount: 1000, ...x });

test('what is owed counts our payments and anything paid to the provider for us', () => {
  assert.equal(owed(acc()), 1000);
  assert.equal(owed(acc({ payments: [{ day: '2026-04-12', amount: 300 }] })), 700);
  assert.equal(owed(acc({ aidStatus: 'paid', aidBack: 600, aidTo: 'provider', payments: [{ amount: 400 }] })), 0);
  assert.equal(owed(acc({ aidStatus: 'paid', aidBack: 600, aidTo: 'us', payments: [{ amount: 400 }] })), 600, 'paid back to us does not settle the provider');
  assert.equal(owed(acc({ kind: 'quote' })), 0);
});

test('out of pocket is what we paid less what came back to us', () => {
  const r = acc({ payments: [{ amount: 1000 }], aidStatus: 'paid', aidBack: 700, aidTo: 'us', gapStatus: 'paid', gapBack: 200, gapTo: 'us' });
  assert.equal(owed(r), 0);
  assert.equal(outOfPocket(r), 100);
});

test('the next step follows the paperwork', () => {
  const today = '2026-05-01';
  assert.equal(nextStep(acc({ aidStatus: 'tosend' }), today), 'Send to medical aid');
  assert.equal(nextStep(acc({ aidStatus: 'paid', aidBack: 1000, gapStatus: 'sent' }), today), 'Waiting on gap cover');
  assert.equal(nextStep(acc({ followUp: '2026-04-30', followNote: 'phone the practice' }), today), 'Follow up: phone the practice');
  assert.equal(nextStep(acc({ payments: [{ amount: 1000 }] }), today), null);
});

test('the home tile names what is due this week and the follow-ups, or nothing', () => {
  const today = '2026-05-01';
  assert.equal(tileNote([acc({ due: '2026-05-05' }), acc({ due: '2026-06-01' }), acc({ followUp: '2026-05-01' })], today), '1 due this week · 1 follow-up');
  assert.equal(tileNote([acc({ due: '2026-05-05', payments: [{ amount: 1000 }] })], today), null);
});

test('the SARS tax year runs 1 March to the end of February', () => {
  assert.equal(taxYear('2026-02-28'), 2026);
  assert.equal(taxYear('2026-03-01'), 2027);
  assert.deepEqual(taxYearSpan(2024), { from: '2023-03-01', to: '2024-02-29' });
  assert.deepEqual(yearsOf([acc({ day: '2024-06-01' })], '2026-11-02'), [2027, 2025]);
});

test('the year view totals per person and lists missing proof and waiting claims', () => {
  const all = [
    acc({ payments: [{ amount: 1000 }], proofInvoice: 'Medical/2026/naidoo.pdf', aidStatus: 'paid', aidBack: 800, aidTo: 'us' }),
    acc({ personId: 'p2', amount: 500, aidStatus: 'sent' }),
    acc({ day: '2026-02-20' }),            // the year before
    acc({ kind: 'quote', amount: 9000 }),  // never counted
  ];
  const v = yearView(all, 2027);
  assert.equal(v.family.count, 2);
  assert.equal(v.family.charged, 1500);
  assert.equal(v.family.outOfPocket, 200);
  assert.equal(v.perPerson.find((p) => p.personId === 'p1').paidByUs, 1000);
  assert.deepEqual(v.missing.map((m) => m.what), [['proof of payment', 'claim statement'], ['invoice', 'claim statement']]);
  assert.equal(v.waiting.length, 1);
  assert.deepEqual(missingProof(acc({ kind: 'quote' })), []);
});

test('filters', () => {
  const today = '2026-05-01';
  assert.ok(FILTERS.outstanding(acc()));
  assert.ok(FILTERS.aid(acc({ aidStatus: 'tosend' })));
  assert.ok(!FILTERS.gap(acc({ gapStatus: 'paid' })));
  assert.ok(FILTERS.followup(acc({ followUp: '2026-04-01' }), today));
});
