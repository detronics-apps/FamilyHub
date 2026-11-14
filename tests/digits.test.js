// Amounts grouped in threes as you type (D-127).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupDigits, caretAfter, countBefore, showGrouped } from '../js/digits.js';

test('typed amounts are grouped in threes, the number kept', () => {
  assert.deepEqual(groupDigits('1500000'), { text: '1 500 000', value: 1500000 });
  assert.deepEqual(groupDigits('1 50'), { text: '150', value: 150 });
  assert.deepEqual(groupDigits('1234'), { text: '1 234', value: 1234 });
  assert.deepEqual(groupDigits('12 345,5'), { text: '12 345,5', value: 12345.5 });
  assert.deepEqual(groupDigits('R 9 999.99'), { text: '9 999.99', value: 9999.99 });
  assert.deepEqual(groupDigits(''), { text: '', value: null });
  assert.equal(groupDigits('-500', { negative: true }).value, -500);
  assert.equal(groupDigits('-500').value, 500, 'no minus where an amount cannot be negative');
  assert.equal(showGrouped(11500000), '11 500 000');
  assert.equal(showGrouped(null), '');
});

test('the caret stays after the same digit', () => {
  // Typing the 4th digit at the end of "123": "1234" becomes "1 234", caret at the end.
  const raw = '1234'; const g = groupDigits(raw);
  assert.equal(caretAfter(g.text, countBefore(raw, 4)), g.text.length);
  // Typing a 0 after the 1 in "1 500" ("10 500" typed as "10 500"): caret after that 0.
  const raw2 = '10 500'; const g2 = groupDigits(raw2);
  assert.equal(g2.text, '10 500');
  assert.equal(caretAfter(g2.text, countBefore(raw2, 2)), 2);
});
