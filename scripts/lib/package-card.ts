import { THEMES, FONT, escapeXml, compactNumber } from './svg.ts';
import type { Theme } from './svg.ts';

export type PackageCard = {
  name: string;
  description: string;
  stars: number;
  language: string | null;
  license: string | null;
  downloads: number[];
};

const LANGUAGE_COLORS: Record<string, string> = { TypeScript: '#3178C6' };
const STAR_PATH =
  'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z';

export const CARD_WIDTH = 380;
export const CARD_PAD = 20;

export function renderPackageCard(card: PackageCard, theme: Theme): string {
  const c = THEMES[theme];
  const width = CARD_WIDTH,
    height = 164,
    pad = CARD_PAD;
  const chartTop = 74,
    chartBottom = 116,
    chartLeft = pad,
    chartRight = width - pad;
  const peak = Math.max(...card.downloads, 1);
  const lastIndex = Math.max(card.downloads.length - 1, 1);
  const points = card.downloads.map((value, index): [number, number] => [
    chartLeft + (index / lastIndex) * (chartRight - chartLeft),
    chartBottom - (value / peak) * (chartBottom - chartTop),
  ]);
  const line = points
    .map(([px, py], index) => `${index ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${chartRight} ${chartBottom} L${chartLeft} ${chartBottom} Z`;
  const total = card.downloads.reduce((sum, value) => sum + value, 0);
  const starsText = compactNumber(card.stars);
  const starX = width - pad - starsText.length * 8.5 - 21;
  const footerY = 144;
  const titleTail = [card.language, card.license && `${card.license} license`]
    .filter(Boolean)
    .map((part) => `, ${part}`)
    .join('');
  const languageColor =
    card.language && Object.hasOwn(LANGUAGE_COLORS, card.language)
      ? LANGUAGE_COLORS[card.language]
      : undefined;
  const languageDot = languageColor
    ? `<circle cx="${pad + 5}" cy="${footerY - 4}" r="5" fill="${languageColor}"/>\n`
    : '';
  const languageText = card.language
    ? `<text x="${pad + 16}" y="${footerY}" class="meta">${escapeXml(card.language)}</text>\n`
    : '';
  const licenseText = card.license
    ? `<text x="${card.language ? pad + 102 : pad}" y="${footerY}" class="meta">${escapeXml(card.license)}</text>\n`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title">
<title id="title">${escapeXml(card.name)}: ${escapeXml(card.description)}. ${card.stars} GitHub ${card.stars === 1 ? 'star' : 'stars'}, ${total} npm downloads in the last 30 days${escapeXml(titleTail)}</title>
<style>
  text { font-family: ${FONT}; fill: ${c.ink}; }
  .name { font-size: 16px; font-weight: 700; fill: ${c.span}; }
  .description { font-size: 12.5px; fill: ${c.muted}; }
  .meta { font-size: 12px; fill: ${c.muted}; font-variant-numeric: tabular-nums; }
  .meta tspan.value { fill: ${c.ink}; font-weight: 600; }
  .stars { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .star { fill: ${c.open}; transform-box: fill-box; transform-origin: center; animation: pop 600ms cubic-bezier(.34, 1.56, .64, 1) 1500ms both; }
  .line { fill: none; stroke: ${c.span}; stroke-width: 1.75; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1400ms cubic-bezier(.65, 0, .35, 1) 200ms forwards; }
  .area { fill: ${c.span}; opacity: 0; animation: fade 600ms ease-out 1300ms forwards; }
  .rule { stroke: ${c.rule}; stroke-width: 1; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  @keyframes fade { to { opacity: .12; } }
  @keyframes pop { 0% { transform: scale(.4) rotate(-30deg); } 100% { transform: scale(1) rotate(0); } }
  @media (prefers-reduced-motion: reduce) { .line { animation: none; stroke-dashoffset: 0; } .area { animation: none; opacity: .12; } .star { animation: none; } }
</style>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${c.paper}" stroke="${c.rule}"/>
<text x="${pad}" y="34" class="name">${escapeXml(card.name)}</text>
<g transform="translate(${starX} 21)"><path d="${STAR_PATH}" class="star"/></g>
<text x="${width - pad}" y="34" text-anchor="end" class="stars">${starsText}</text>
<text x="${pad}" y="56" class="description">${escapeXml(card.description)}</text>
<path d="${area}" class="area"/>
<path d="${line}" class="line" pathLength="1"/>
<line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" class="rule"/>
${languageDot}${languageText}${licenseText}<text x="${width - pad}" y="${footerY}" text-anchor="end" class="meta"><tspan class="value">${compactNumber(total)}</tspan> downloads / 30 days</text>
</svg>
`;
}
