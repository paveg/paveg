import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactNumber, escapeXml } from '../scripts/lib/svg.ts';

test('compactNumber abbreviates thousands', () => {
  assert.equal(compactNumber(999), '999');
  assert.equal(compactNumber(1000), '1.0k');
  assert.equal(compactNumber(7312), '7.3k');
  assert.equal(compactNumber(73012), '73k');
  assert.equal(compactNumber(9949), '9.9k');
  assert.equal(compactNumber(9950), '10k');
  assert.equal(compactNumber(9999), '10k');
});

test('escapeXml escapes ampersand and angle brackets', () => {
  assert.equal(escapeXml('a & <b>'), 'a &amp; &lt;b&gt;');
});

test('escapeXml removes characters that XML 1.0 forbids', () => {
  assert.equal(escapeXml('a\u0001b\u0008c\uFFFFd\uD800e\uDFFFf'), 'abcdef');
});

test('escapeXml keeps tab, newline, Japanese text and emoji', () => {
  assert.equal(escapeXml('a\tb\nc\r日本語🎉'), 'a\tb\nc\r日本語🎉');
});
