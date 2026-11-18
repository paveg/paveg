import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCards, writeCards, main } from '../scripts/generate.ts';
import type { FetchImpl } from '../scripts/lib/fetch-data.ts';

const packages = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map((name) => ({
  name,
  description: `${name} description`,
}));

function fakeFetch({ failingNpmPackage }: { failingNpmPackage?: string } = {}): FetchImpl {
  return async (input) => {
    const url = String(input);
    if (url.startsWith('https://api.npmjs.org/')) {
      if (failingNpmPackage && url.endsWith(`/${failingNpmPackage}`))
        return new Response('{}', { status: 500 });
      return Response.json({
        downloads: [
          { day: '2026-01-01', downloads: 10 },
          { day: '2026-01-02', downloads: 20 },
        ],
      });
    }
    return Response.json({
      stargazers_count: 7,
      language: 'TypeScript',
      license: { spdx_id: 'MIT' },
    });
  };
}

async function createRoot() {
  const rootDir = await mkdtemp(join(tmpdir(), 'oss-cards-'));
  await mkdir(join(rootDir, 'config'));
  await writeFile(join(rootDir, 'config', 'packages.json'), JSON.stringify(packages));
  return rootDir;
}

test('buildCards returns a light and dark SVG for every package', async () => {
  const cards = await buildCards(packages, { fetchImpl: fakeFetch(), token: 'token' });
  assert.equal(cards.size, 10);
  assert.ok(cards.has('assets/oss/alpha-light.svg'));
  assert.ok(cards.has('assets/oss/epsilon-dark.svg'));
  assert.match(cards.get('assets/oss/alpha-light.svg') ?? '', /^<svg /);
});

test('buildCards rejects when one npm request fails', async () => {
  await assert.rejects(
    buildCards(packages, { fetchImpl: fakeFetch({ failingNpmPackage: 'gamma' }), token: 'token' }),
    /gamma/,
  );
});

test('writeCards writes every card under rootDir', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'oss-cards-'));
  const cards = await buildCards(packages, { fetchImpl: fakeFetch(), token: 'token' });
  writeCards(cards, rootDir);
  assert.equal((await readdir(join(rootDir, 'assets', 'oss'))).length, 10);
});

test('main writes the cards for every configured package', async () => {
  const rootDir = await createRoot();
  await main({ fetchImpl: fakeFetch(), token: 'token', rootDir });
  assert.equal((await readdir(join(rootDir, 'assets', 'oss'))).length, 10);
});

test('main leaves existing files untouched when a fetch fails', async () => {
  const rootDir = await createRoot();
  await mkdir(join(rootDir, 'assets', 'oss'), { recursive: true });
  const existing = join(rootDir, 'assets', 'oss', 'alpha-light.svg');
  await writeFile(existing, 'previous');
  await assert.rejects(
    main({ fetchImpl: fakeFetch({ failingNpmPackage: 'gamma' }), token: 'token', rootDir }),
  );
  assert.equal(await readFile(existing, 'utf8'), 'previous');
  assert.deepEqual(await readdir(join(rootDir, 'assets', 'oss')), ['alpha-light.svg']);
});
