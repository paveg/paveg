import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPackageCard } from '../scripts/lib/package-card.mjs';

const card = {
  name: 'hono-idempotency',
  description: 'Stripe-style Idempotency-Key middleware',
  stars: 14,
  language: 'TypeScript',
  license: 'MIT',
  downloads: [0, 0, 166, 218, 326, 404, 247, 392, 350, 442, 215, 286, 226, 313, 177, 327, 676, 516, 294, 87, 102, 205, 409, 185, 258, 180, 53, 26, 123, 114],
};

test('renders name, stars, language, license, label and language color', () => {
  const svg = renderPackageCard(card, 'light');
  for (const expected of ['>hono-idempotency<', '>14<', '>TypeScript<', '>MIT<', 'downloads / 30 days', '#3178C6']) {
    assert.ok(svg.includes(expected), expected);
  }
});

test('title contains the total download count', () => {
  const total = card.downloads.reduce((sum, value) => sum + value, 0);
  const title = renderPackageCard(card, 'light').match(/<title[^>]*>([^<]*)<\/title>/)[1];
  assert.ok(title.includes(String(total)), title);
});

test('all-zero downloads produce no NaN or Infinity', () => {
  const svg = renderPackageCard({ ...card, downloads: Array(30).fill(0) }, 'light');
  assert.ok(!svg.includes('NaN'));
  assert.ok(!svg.includes('Infinity'));
});

test('description is escaped', () => {
  const svg = renderPackageCard({ ...card, description: 'Fast & <safe>' }, 'light');
  assert.ok(svg.includes('Fast &amp; &lt;safe&gt;'));
  assert.ok(!svg.includes('<safe>'));
});

test('null language and license render no dot and no "null"', () => {
  const svg = renderPackageCard({ ...card, language: null, license: null }, 'light');
  assert.ok(!svg.includes('<circle'));
  assert.ok(!svg.includes('null'));
});

test('star sits left of the compacted star count', () => {
  const svg = renderPackageCard({ ...card, stars: 1234 }, 'light');
  assert.ok(svg.includes('>1.2k<'));
  const starX = Number(svg.match(/<g transform="translate\(([\d.]+) /)[1]);
  assert.ok(starX <= 420 - 20 - 4 * 8.5 - 21, String(starX));
});

test('themes use their own paper color', () => {
  assert.ok(renderPackageCard(card, 'light').includes('#FBFCFD'));
  assert.ok(renderPackageCard(card, 'dark').includes('#14212F'));
});
