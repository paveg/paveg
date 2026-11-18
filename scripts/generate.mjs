import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPackages, fetchDownloads, fetchRepoMeta } from './lib/fetch-data.mjs';
import { renderPackageCard } from './lib/package-card.mjs';
import { THEMES } from './lib/svg.mjs';

export async function buildCards(packages, { fetchImpl, token }) {
  const rendered = await Promise.all(packages.map(async ({ name, description }) => {
    const [downloads, meta] = await Promise.all([
      fetchDownloads(name, fetchImpl),
      fetchRepoMeta(name, token, fetchImpl),
    ]);
    const card = { name, description, downloads, ...meta };
    return Object.keys(THEMES).map((theme) => [`assets/oss/${name}-${theme}.svg`, renderPackageCard(card, theme)]);
  }));
  return new Map(rendered.flat());
}

export function writeCards(cards, rootDir) {
  for (const [path, svg] of cards) {
    const target = join(rootDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, svg);
  }
}

export async function main({ fetchImpl, token, rootDir }) {
  const json = JSON.parse(await readFile(join(rootDir, 'config', 'packages.json'), 'utf8'));
  const cards = await buildCards(loadPackages(json), { fetchImpl, token });
  writeCards(cards, rootDir);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main({ fetchImpl: fetch, token: process.env.GITHUB_TOKEN, rootDir: process.cwd() }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
