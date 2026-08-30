export async function github(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...options, headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28', ...options.headers } });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub returned ${response.status}`);
  return data;
}
