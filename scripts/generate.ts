import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPackages, fetchDownloads, fetchRepoMeta } from './lib/fetch-data.ts';
import type { FetchImpl, PackageConfig } from './lib/fetch-data.ts';
import { renderPackageCard } from './lib/package-card.ts';
import type { PackageCard } from './lib/package-card.ts';
import { THEME_NAMES } from './lib/svg.ts';

type BuildOptions = { fetchImpl: FetchImpl; token: string | undefined };

export async function buildCards(
  packages: PackageConfig[],
  { fetchImpl, token }: BuildOptions,
): Promise<Map<string, string>> {
  const rendered = await Promise.all(
    packages.map(async ({ name, description }) => {
      const [downloads, meta] = await Promise.all([
        fetchDownloads(name, fetchImpl),
        fetchRepoMeta(name, token, fetchImpl),
      ]);
      const card: PackageCard = { name, description, downloads, ...meta };
      return THEME_NAMES.map((theme): [string, string] => [
        `assets/oss/${name}-${theme}.svg`,
        renderPackageCard(card, theme),
      ]);
    }),
  );
  return new Map(rendered.flat());
}

export function writeCards(cards: Map<string, string>, rootDir: string): void {
  for (const [path, svg] of cards) {
    const target = join(rootDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, svg);
  }
}

export async function main({
  fetchImpl,
  token,
  rootDir,
}: BuildOptions & { rootDir: string }): Promise<void> {
  const json: unknown = JSON.parse(
    await readFile(join(rootDir, 'config', 'packages.json'), 'utf8'),
  );
  const cards = await buildCards(loadPackages(json), { fetchImpl, token });
  writeCards(cards, rootDir);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main({ fetchImpl: fetch, token: process.env.GITHUB_TOKEN, rootDir: process.cwd() }).catch(
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
