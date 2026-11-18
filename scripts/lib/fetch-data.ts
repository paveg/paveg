import { stripXmlIllegal } from './svg.ts';

const MAX_DESCRIPTION_LENGTH = 48;
const MAX_DOWNLOAD_ENTRIES = 31;
const MAX_LABEL_LENGTH = 40;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export type FetchImpl = typeof fetch;

export type PackageConfig = { name: string; description: string };

export type RepoMeta = { stars: number; language: string | null; license: string | null };

type DownloadEntry = { day: string; downloads: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isDownloadEntry = (value: unknown): value is DownloadEntry =>
  isRecord(value) &&
  typeof value.day === 'string' &&
  ISO_DAY.test(value.day) &&
  Number.isSafeInteger(value.downloads) &&
  (value.downloads as number) >= 0;

function normalizeLabel(value: unknown, field: string, source: string): string | null {
  if (typeof value !== 'string') return null;
  const label = stripXmlIllegal(value).trim();
  if (label === '') return null;
  if (label.length > MAX_LABEL_LENGTH) throw new Error(`${source}: ${field} too long`);
  return label;
}

async function readJson(response: Response, source: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`${source}: invalid JSON`);
  }
}

export function loadPackages(json: unknown): PackageConfig[] {
  if (!Array.isArray(json)) throw new Error('packages config must be an array');
  return json.map((entry: unknown, index) => {
    if (!isRecord(entry) || typeof entry.name !== 'string' || entry.name === '') {
      throw new Error(`packages[${index}]: name must be a non-empty string`);
    }
    if (
      typeof entry.description !== 'string' ||
      entry.description.length > MAX_DESCRIPTION_LENGTH
    ) {
      throw new Error(
        `packages[${index}] (${entry.name}): description must be a string of ${MAX_DESCRIPTION_LENGTH} characters or fewer`,
      );
    }
    return { name: entry.name, description: entry.description };
  });
}

export async function fetchDownloads(
  name: string,
  fetchImpl: FetchImpl = fetch,
): Promise<number[]> {
  const response = await fetchImpl(`https://api.npmjs.org/downloads/range/last-month/${name}`);
  if (!response.ok) throw new Error(`npm downloads for ${name}: HTTP ${response.status}`);
  const body = await readJson(response, `npm downloads for ${name}`);
  const entries: unknown = isRecord(body) ? body.downloads : undefined;
  if (!Array.isArray(entries))
    throw new Error(`npm downloads for ${name}: downloads is not an array`);
  if (entries.length < 1 || entries.length > MAX_DOWNLOAD_ENTRIES)
    throw new Error(`npm downloads for ${name}: unexpected entry count ${entries.length}`);
  if (
    !entries.every(isDownloadEntry) ||
    new Set(entries.map((entry) => entry.day)).size !== entries.length
  )
    throw new Error(`npm downloads for ${name}: downloads has an invalid entry`);
  return entries.toSorted((a, b) => a.day.localeCompare(b.day)).map((entry) => entry.downloads);
}

export async function fetchRepoMeta(
  repo: string,
  token: string | undefined,
  fetchImpl: FetchImpl = fetch,
): Promise<RepoMeta> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchImpl(`https://api.github.com/repos/paveg/${repo}`, { headers });
  if (!response.ok) throw new Error(`GitHub repo paveg/${repo}: HTTP ${response.status}`);
  const body = await readJson(response, `GitHub repo paveg/${repo}`);
  const repoBody: Record<string, unknown> = isRecord(body) ? body : {};
  const stars = repoBody.stargazers_count;
  if (typeof stars !== 'number' || !Number.isSafeInteger(stars) || stars < 0) {
    throw new Error(`GitHub repo paveg/${repo}: invalid stargazers_count`);
  }
  const source = `GitHub repo paveg/${repo}`;
  const language = normalizeLabel(repoBody.language, 'language', source);
  const spdxId = isRecord(repoBody.license) ? repoBody.license.spdx_id : undefined;
  const license = normalizeLabel(spdxId, 'license', source);
  return { stars, language, license: license === 'NOASSERTION' ? null : license };
}
