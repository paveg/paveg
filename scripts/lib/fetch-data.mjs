const MAX_DESCRIPTION_LENGTH = 48;

export function loadPackages(json) {
  if (!Array.isArray(json)) throw new Error('packages config must be an array');
  return json.map((entry, index) => {
    if (typeof entry?.name !== 'string' || entry.name === '') {
      throw new Error(`packages[${index}]: name must be a non-empty string`);
    }
    if (typeof entry.description !== 'string' || entry.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(`packages[${index}] (${entry.name}): description must be a string of ${MAX_DESCRIPTION_LENGTH} characters or fewer`);
    }
    return { name: entry.name, description: entry.description };
  });
}

export async function fetchDownloads(name, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.npmjs.org/downloads/range/last-month/${name}`);
  if (!response.ok) throw new Error(`npm downloads for ${name}: HTTP ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body?.downloads)) throw new Error(`npm downloads for ${name}: downloads is not an array`);
  if (body.downloads.length === 0) throw new Error(`npm downloads for ${name}: downloads is empty`);
  return [...body.downloads]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((entry) => entry.downloads);
}

export async function fetchRepoMeta(repo, token, fetchImpl = fetch) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchImpl(`https://api.github.com/repos/paveg/${repo}`, { headers });
  if (!response.ok) throw new Error(`GitHub repo paveg/${repo}: HTTP ${response.status}`);
  const body = await response.json();
  const stars = body.stargazers_count;
  if (!Number.isInteger(stars) || stars < 0) throw new Error(`GitHub repo paveg/${repo}: invalid stargazers_count`);
  const spdxId = body.license?.spdx_id;
  return {
    stars,
    language: body.language ?? null,
    license: spdxId && spdxId !== 'NOASSERTION' ? spdxId : null,
  };
}
