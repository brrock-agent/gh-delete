import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 3000);
const clientId = process.env.GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;
const baseUrl = process.env.APP_URL || `http://localhost:${port}`;
const sessions = new Map();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function cookie(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(x => x.trim().split('=').map(decodeURIComponent)).filter(x => x[0])); }
function send(res, code, data, headers = {}) { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(data)); }
function session(req) { return sessions.get(cookie(req).gd_session); }
function setSession(res, data) { const id = randomBytes(24).toString('hex'); sessions.set(id, data); res.setHeader('set-cookie', `gd_session=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${baseUrl.startsWith('https:') ? '; Secure' : ''}`); }
function clearSession(res) { res.setHeader('set-cookie', 'gd_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); }
function requireSession(req, res) { const s = session(req); if (!s) { send(res, 401, { error: 'Sign in required.' }); return null; } return s; }
async function github(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...options, headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28', ...options.headers } });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub returned ${response.status}`);
  return data;
}
async function body(req) { let raw = ''; for await (const c of req) raw += c; return raw ? JSON.parse(raw) : {}; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, baseUrl);
  try {
    if (url.pathname === '/auth/github') {
      if (!clientId || !clientSecret) return send(res, 503, { error: 'GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.' });
      const state = randomBytes(24).toString('hex'); setSession(res, { state, csrf: randomBytes(24).toString('hex') });
      const auth = new URL('https://github.com/login/oauth/authorize');
      auth.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${baseUrl}/auth/callback`, scope: 'repo read:org', state }).toString();
      res.writeHead(302, { location: auth }); return res.end();
    }
    if (url.pathname === '/auth/callback') {
      const s = session(req);
      if (!s || !url.searchParams.get('code') || url.searchParams.get('state') !== s.state) { clearSession(res); res.writeHead(302, { location: '/?error=signin' }); return res.end(); }
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: url.searchParams.get('code'), redirect_uri: `${baseUrl}/auth/callback` }) });
      const token = (await tokenResponse.json()).access_token;
      if (!token) throw new Error('GitHub did not return an access token.');
      const user = await github('/user', token); setSession(res, { token, user: { login: user.login, avatar_url: user.avatar_url }, csrf: randomBytes(24).toString('hex') });
      res.writeHead(302, { location: '/' }); return res.end();
    }
    if (url.pathname === '/auth/logout' && req.method === 'POST') { clearSession(res); return send(res, 200, { ok: true }); }
    if (url.pathname === '/api/me') { const s = session(req); return send(res, 200, s?.user ? { user: s.user, csrf: s.csrf } : { user: null }); }
    if (url.pathname === '/api/repos') {
      const s = requireSession(req, res); if (!s) return;
      const page = Math.max(1, Number(url.searchParams.get('page') || 1));
      const repos = await github(`/user/repos?affiliation=owner&per_page=100&page=${page}&sort=updated`, s.token);
      return send(res, 200, repos.map(r => ({ id: r.id, name: r.name, full_name: r.full_name, owner: r.owner.login, private: r.private, archived: r.archived, fork: r.fork, description: r.description, updated_at: r.updated_at, language: r.language, pinned: false })));
    }
    if (url.pathname === '/api/bulk' && req.method === 'POST') {
      const s = requireSession(req, res); if (!s) return;
      if (req.headers['x-csrf-token'] !== s.csrf) return send(res, 403, { error: 'Invalid request token.' });
      const { action, repos, target, confirmation } = await body(req);
      if (!['pin', 'unpin', 'delete', 'transfer'].includes(action) || !Array.isArray(repos) || !repos.length || repos.length > 50) return send(res, 400, { error: 'Choose 1–50 repositories and a valid action.' });
      if ((action === 'delete' && confirmation !== 'DELETE') || (action === 'transfer' && !/^[\w.-]+$/.test(target || ''))) return send(res, 400, { error: action === 'delete' ? 'Type DELETE to confirm.' : 'Enter a valid target account or organization.' });
      const results = [];
      for (const repo of repos) {
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { results.push({ repo, ok: false, error: 'Invalid repository name.' }); continue; }
        try {
          if (action === 'delete') await github(`/repos/${repo}`, s.token, { method: 'DELETE' });
          if (action === 'pin') await github(`/user/pinned_repositories/${repo}`, s.token, { method: 'PUT' });
          if (action === 'unpin') await github(`/user/pinned_repositories/${repo}`, s.token, { method: 'DELETE' });
          if (action === 'transfer') await github(`/repos/${repo}/transfer`, s.token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ new_owner: target }) });
          results.push({ repo, ok: true });
        } catch (error) { results.push({ repo, ok: false, error: error.message }); }
      }
      return send(res, 200, { results });
    }
    const file = url.pathname === '/' ? 'index.html' : normalize(url.pathname).replace(/^[/\\]+/, '');
    const path = join(process.cwd(), 'public', file);
    if (!path.startsWith(join(process.cwd(), 'public'))) return send(res, 404, { error: 'Not found' });
    const content = await readFile(path); res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(content);
  } catch (error) { console.error(error); send(res, 500, { error: error.message || 'Something went wrong.' }); }
});
server.listen(port, () => console.log(`gh-delete listening at ${baseUrl}`));
