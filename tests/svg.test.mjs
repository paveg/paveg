import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactNumber, escapeXml } from '../scripts/lib/svg.mjs';

test('compactNumber abbreviates thousands', () => {
  assert.equal(compactNumber(999), '999');
  assert.equal(compactNumber(1000), '1.0k');
  assert.equal(compactNumber(7312), '7.3k');
  assert.equal(compactNumber(73012), '73k');
});

test('escapeXml escapes ampersand and angle brackets', () => {
  assert.equal(escapeXml('a & <b>'), 'a &amp; &lt;b&gt;');
});
