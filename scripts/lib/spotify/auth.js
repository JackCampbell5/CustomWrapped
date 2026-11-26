// Spotify auth: Client Credentials first; Authorization Code + PKCE as a fallback.
// Never logs client secrets, access tokens, or refresh tokens.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
export const REDIRECT_URI = 'http://127.0.0.1:8888/callback';

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function postToken(body, headers = {}) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // json.error is a short code like "invalid_client"; safe to show.
    throw new Error(`token request failed (${res.status} ${json.error ?? ''})`.trim());
  }
  return json;
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function waitForCode(state, timeoutMs = 5 * 60_000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT_URI);
      if (u.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const ok = u.searchParams.get('state') === state && u.searchParams.get('code');
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html' });
      res.end(ok ? '<p>Logged in. You can close this tab and return to the terminal.</p>' : '<p>Login failed. Check the terminal.</p>');
      clearTimeout(timer);
      server.close();
      if (ok) resolve(u.searchParams.get('code'));
      else reject(new Error(`login failed: ${u.searchParams.get('error') ?? 'state mismatch'}`));
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('login timed out after 5 minutes'));
    }, timeoutMs);
    server.on('error', reject);
    server.listen(8888, '127.0.0.1');
  });
}

/**
 * @param {{ clientId: string, clientSecret: string, cacheDir: string, log: (s: string) => void }} opts
 */
export function createAuth({ clientId, clientSecret, cacheDir, log }) {
  const tokenFile = path.join(cacheDir, 'spotify-auth.json');
  let mode = 'client'; // 'client' | 'user'
  let access = null;
  let expiresAt = 0;

  const readRefresh = () => {
    try {
      return JSON.parse(fs.readFileSync(tokenFile, 'utf8')).refreshToken ?? null;
    } catch {
      return null;
    }
  };
  const writeRefresh = (refreshToken) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(tokenFile, JSON.stringify({ refreshToken, savedAt: new Date().toISOString() }));
  };

  async function fetchClientToken() {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    return postToken({ grant_type: 'client_credentials' }, { Authorization: `Basic ${basic}` });
  }

  async function fetchUserToken() {
    const refresh = readRefresh();
    if (refresh) {
      try {
        const j = await postToken({ grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId });
        if (j.refresh_token) writeRefresh(j.refresh_token);
        return j;
      } catch {
        log('  Saved Spotify login expired; logging in again.');
      }
    }
    if (!process.stdin.isTTY) throw new Error('Spotify user login needed, but this is not an interactive terminal');
    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(12));
    const url = `${AUTHORIZE_URL}?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
    })}`;
    log('\n  Spotify needs a one-time login for this app (Development Mode).');
    log('  Opening your browser. If it does not open, visit:');
    log(`  ${url}\n`);
    const codePromise = waitForCode(state);
    openBrowser(url);
    const code = await codePromise;
    const j = await postToken({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, client_id: clientId, code_verifier: verifier });
    if (j.refresh_token) writeRefresh(j.refresh_token);
    log('  Logged in. Refresh token cached in data/cache/ (gitignored).');
    return j;
  }

  return {
    get mode() {
      return mode;
    },
    async token() {
      if (access && Date.now() < expiresAt - 60_000) return access;
      const j = mode === 'client' ? await fetchClientToken() : await fetchUserToken();
      access = j.access_token;
      expiresAt = Date.now() + (j.expires_in ?? 3600) * 1000;
      return access;
    },
    invalidate() {
      access = null;
    },
    async switchToUser() {
      mode = 'user';
      access = null;
      await this.token();
    },
  };
}
