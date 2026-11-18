import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPackageCard, CARD_WIDTH, CARD_PAD } from '../scripts/lib/package-card.ts';
import type { PackageCard } from '../scripts/lib/package-card.ts';

const card: PackageCard = {
  name: 'hono-idempotency',
  description: 'Stripe-style Idempotency-Key middleware',
  stars: 14,
  language: 'TypeScript',
  license: 'MIT',
  downloads: [
    0, 0, 166, 218, 326, 404, 247, 392, 350, 442, 215, 286, 226, 313, 177, 327, 676, 516, 294, 87,
    102, 205, 409, 185, 258, 180, 53, 26, 123, 114,
  ],
};

function capture(text: string, pattern: RegExp): string {
  const captured = text.match(pattern)?.[1];
  assert.ok(captured !== undefined, `${pattern} did not match`);
  return captured;
}

const titleOf = (svg: string): string => capture(svg, /<title[^>]*>([^<]*)<\/title>/);
const starXOf = (svg: string): number => Number(capture(svg, /<g transform="translate\(([\d.]+) /));

test('renders name, stars, language, license, label and language color', () => {
  const svg = renderPackageCard(card, 'light');
  for (const expected of [
    '>hono-idempotency<',
    '>14<',
    '>TypeScript<',
    '>MIT<',
    'downloads / 30 days',
    '#3178C6',
  ]) {
    assert.ok(svg.includes(expected), expected);
  }
});

test('title contains the total download count', () => {
  const total = card.downloads.reduce((sum, value) => sum + value, 0);
  const title = titleOf(renderPackageCard(card, 'light'));
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

test('prototype keys are not language colors', () => {
  for (const language of ['constructor', '__proto__', 'toString']) {
    const svg = renderPackageCard({ ...card, language }, 'light');
    assert.ok(!svg.includes('<circle'), language);
    assert.ok(!svg.includes('function'), language);
    assert.ok(!svg.includes('[object'), language);
    assert.ok(svg.includes(`>${language}<`), language);
  }
});

test('XML-illegal characters never reach the rendered card', () => {
  const svg = renderPackageCard({ ...card, language: '\u0001Type\u0008Script' }, 'light');
  assert.ok(svg.includes('>TypeScript<'));
  assert.ok(!svg.includes('\u0001'));
  assert.ok(!svg.includes('\u0008'));
});

test('star sits left of the compacted star count', () => {
  const svg = renderPackageCard({ ...card, stars: 1234 }, 'light');
  assert.ok(svg.includes('>1.2k<'));
  const starX = starXOf(svg);
  assert.ok(starX <= CARD_WIDTH - CARD_PAD - 4 * 8.5 - 21, String(starX));
});

test('star X follows the compacted text width for five-digit stars', () => {
  const svg = renderPackageCard({ ...card, stars: 12345 }, 'light');
  assert.ok(svg.includes('>12k<'));
  const starX = starXOf(svg);
  assert.equal(starX, CARD_WIDTH - CARD_PAD - 3 * 8.5 - 21);
});

test('themes use their own paper color', () => {
  assert.ok(renderPackageCard(card, 'light').includes('#FBFCFD'));
  assert.ok(renderPackageCard(card, 'dark').includes('#14212F'));
});

const titleFor = (stars: number): string => titleOf(renderPackageCard({ ...card, stars }, 'light'));

test('title uses the singular for exactly one star', () => {
  assert.ok(titleFor(1).includes('1 GitHub star,'), titleFor(1));
  assert.ok(!titleFor(1).includes('1 GitHub stars'), titleFor(1));
  assert.ok(titleFor(2).includes('2 GitHub stars,'), titleFor(2));
  assert.ok(titleFor(0).includes('0 GitHub stars,'), titleFor(0));
});

test('longest description keeps footer items at their anchors and right-aligned text at the right padding', () => {
  const svg = renderPackageCard(
    {
      ...card,
      description: 'Country / ASN blocking and maintenance mode',
      stars: 1234,
      downloads: [...Array(29).fill(0), 73012],
    },
    'light',
  );
  const rightEdge = CARD_WIDTH - CARD_PAD;
  assert.equal(rightEdge, 360);
  assert.ok(svg.includes('>Country / ASN blocking and maintenance mode<'));
  assert.ok(svg.includes('<text x="36" y="144" class="meta">TypeScript</text>'));
  assert.ok(svg.includes('<text x="122" y="144" class="meta">MIT</text>'));
  assert.ok(
    svg.includes(`<text x="${rightEdge}" y="34" text-anchor="end" class="stars">1.2k</text>`),
  );
  assert.ok(
    svg.includes(
      `<text x="${rightEdge}" y="144" text-anchor="end" class="meta"><tspan class="value">73k</tspan> downloads / 30 days</text>`,
    ),
  );
});
