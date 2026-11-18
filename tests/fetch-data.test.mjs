import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPackages, fetchDownloads, fetchRepoMeta } from '../scripts/lib/fetch-data.mjs';

function fakeFetch(body, status = 200) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(body), { status });
  };
  return { impl, calls };
}

test('loadPackages rejects non-array input', () => {
  assert.throws(() => loadPackages({ name: 'x', description: 'y' }), /array/);
});

test('loadPackages rejects an empty name', () => {
  assert.throws(() => loadPackages([{ name: '', description: 'ok' }]), /name/);
});

test('loadPackages rejects a description of 49 characters or more', () => {
  assert.throws(() => loadPackages([{ name: 'pkg', description: 'x'.repeat(49) }]), /description/);
  assert.equal(loadPackages([{ name: 'pkg', description: 'x'.repeat(48) }]).length, 1);
});

test('loadPackages reads config/packages.json', async () => {
  const json = JSON.parse(await readFile(new URL('../config/packages.json', import.meta.url), 'utf8'));
  const packages = loadPackages(json);
  assert.equal(packages.length, 5);
  assert.equal(packages[0].name, 'hono-problem-details');
  assert.equal(packages[4].name, 'hono-dpop');
});

test('fetchDownloads requests the npm range API for the last month', async () => {
  const { impl, calls } = fakeFetch({ downloads: [{ day: '2026-01-01', downloads: 1 }] });
  await fetchDownloads('hono-dpop', impl);
  assert.equal(calls[0].url, 'https://api.npmjs.org/downloads/range/last-month/hono-dpop');
});

test('fetchDownloads returns counts sorted by day', async () => {
  const { impl } = fakeFetch({
    downloads: [
      { day: '2026-01-03', downloads: 30 },
      { day: '2026-01-01', downloads: 10 },
      { day: '2026-01-02', downloads: 20 },
    ],
  });
  assert.deepEqual(await fetchDownloads('hono-dpop', impl), [10, 20, 30]);
});

test('fetchDownloads throws with the package name on HTTP 404', async () => {
  const { impl } = fakeFetch({ error: 'not found' }, 404);
  await assert.rejects(fetchDownloads('hono-dpop', impl), /hono-dpop.*404/);
});

test('fetchDownloads throws with the package name when downloads is not an array', async () => {
  const { impl } = fakeFetch({ downloads: null });
  await assert.rejects(fetchDownloads('hono-dpop', impl), /hono-dpop/);
});

test('fetchDownloads throws with the package name when downloads is empty', async () => {
  const { impl } = fakeFetch({ downloads: [] });
  await assert.rejects(fetchDownloads('hono-dpop', impl), /hono-dpop/);
});

test('fetchRepoMeta requests the GitHub repos API without auth when no token', async () => {
  const { impl, calls } = fakeFetch({ stargazers_count: 1, language: 'TypeScript', license: null });
  await fetchRepoMeta('hono-dpop', undefined, impl);
  assert.equal(calls[0].url, 'https://api.github.com/repos/paveg/hono-dpop');
  assert.equal(calls[0].options.headers.Authorization, undefined);
});

test('fetchRepoMeta sends the token as a Bearer header', async () => {
  const { impl, calls } = fakeFetch({ stargazers_count: 1, language: 'TypeScript', license: null });
  await fetchRepoMeta('hono-dpop', 'secret', impl);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret');
});

test('fetchRepoMeta maps stars, language and license spdx id', async () => {
  const { impl } = fakeFetch({ stargazers_count: 14, language: 'TypeScript', license: { spdx_id: 'MIT' } });
  assert.deepEqual(await fetchRepoMeta('hono-idempotency', 't', impl), { stars: 14, language: 'TypeScript', license: 'MIT' });
});

test('fetchRepoMeta returns license null when the repo has none', async () => {
  const { impl } = fakeFetch({ stargazers_count: 0, language: null, license: null });
  assert.deepEqual(await fetchRepoMeta('hono-dpop', 't', impl), { stars: 0, language: null, license: null });
});

test('fetchRepoMeta throws with the repo and status on non-2xx', async () => {
  const { impl } = fakeFetch({ message: 'Forbidden' }, 403);
  await assert.rejects(fetchRepoMeta('hono-dpop', 't', impl), /hono-dpop.*403/);
});

test('fetchRepoMeta throws naming the repo when stargazers_count is missing', async () => {
  const { impl } = fakeFetch({ language: 'TypeScript', license: null });
  await assert.rejects(fetchRepoMeta('hono-dpop', 't', impl), /paveg\/hono-dpop.*stargazers_count/);
});

test('fetchRepoMeta rejects negative and non-integer stargazers_count', async () => {
  for (const stargazers_count of [-1, 1.5, '3', null]) {
    const { impl } = fakeFetch({ stargazers_count, language: null, license: null });
    await assert.rejects(fetchRepoMeta('hono-dpop', 't', impl), /hono-dpop.*stargazers_count/, String(stargazers_count));
  }
});

test('fetchRepoMeta maps NOASSERTION license to null', async () => {
  const { impl } = fakeFetch({ stargazers_count: 2, language: 'TypeScript', license: { spdx_id: 'NOASSERTION' } });
  assert.equal((await fetchRepoMeta('hono-dpop', 't', impl)).license, null);
});
