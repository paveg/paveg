const MAX_DESCRIPTION_LENGTH = 48;

export type FetchImpl = typeof fetch;

export type PackageConfig = { name: string; description: string };

export type RepoMeta = { stars: number; language: string | null; license: string | null };

type DownloadEntry = { day: string; downloads: number };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isDownloadEntry = (value: unknown): value is DownloadEntry =>
  isRecord(value) && typeof value.day === 'string' && typeof value.downloads === 'number';

export function loadPackages(json: unknown): PackageConfig[] {
  if (!Array.isArray(json)) throw new Error('packages config must be an array');
  return json.map((entry: unknown, index) => {
    if (!isRecord(entry) || typeof entry.name !== 'string' || entry.name === '') {
      throw new Error(`packages[${index}]: name must be a non-empty string`);
    }
    if (typeof entry.description !== 'string' || entry.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(`packages[${index}] (${entry.name}): description must be a string of ${MAX_DESCRIPTION_LENGTH} characters or fewer`);
    }
    return { name: entry.name, description: entry.description };
  });
}

export async function fetchDownloads(name: string, fetchImpl: FetchImpl = fetch): Promise<number[]> {
  const response = await fetchImpl(`https://api.npmjs.org/downloads/range/last-month/${name}`);
  if (!response.ok) throw new Error(`npm downloads for ${name}: HTTP ${response.status}`);
  const body: unknown = await response.json();
  const entries: unknown = isRecord(body) ? body.downloads : undefined;
  if (!Array.isArray(entries)) throw new Error(`npm downloads for ${name}: downloads is not an array`);
  if (entries.length === 0) throw new Error(`npm downloads for ${name}: downloads is empty`);
  if (!entries.every(isDownloadEntry)) throw new Error(`npm downloads for ${name}: downloads has an invalid entry`);
  return [...entries]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((entry) => entry.downloads);
}

export async function fetchRepoMeta(repo: string, token: string | undefined, fetchImpl: FetchImpl = fetch): Promise<RepoMeta> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchImpl(`https://api.github.com/repos/paveg/${repo}`, { headers });
  if (!response.ok) throw new Error(`GitHub repo paveg/${repo}: HTTP ${response.status}`);
  const body: unknown = await response.json();
  const repoBody: Record<string, unknown> = isRecord(body) ? body : {};
  const stars = repoBody.stargazers_count;
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 0) {
    throw new Error(`GitHub repo paveg/${repo}: invalid stargazers_count`);
  }
  const spdxId = isRecord(repoBody.license) ? repoBody.license.spdx_id : undefined;
  return {
    stars,
    language: typeof repoBody.language === 'string' ? repoBody.language : null,
    license: typeof spdxId === 'string' && spdxId !== '' && spdxId !== 'NOASSERTION' ? spdxId : null,
  };
}
