const SESSION_COOKIE = "od_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 210000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "OverdoseSMP", api: "online" });
    }

    if (url.pathname === "/api/register" && request.method === "POST") {
      if (!sameOrigin(request)) return json({ error: "Invalid request." }, 403);
      return register(request, env);
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      if (!sameOrigin(request)) return json({ error: "Invalid request." }, 403);
      return login(request, env);
    }
    if (url.pathname === "/api/logout" && request.method === "POST") {
      if (!sameOrigin(request)) return json({ error: "Invalid request." }, 403);
      return logout(request, env);
    }
    if (url.pathname === "/api/me" && request.method === "GET") {
      return me(request, env);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);

    return env.ASSETS.fetch(request);
  }
};

async function register(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request." }, 400);
  const username = String(body.username || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return json({ error: "Username must be 3–24 characters using letters, numbers or _." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: "Password must be 8–128 characters." }, 400);

  const existing = await env.DB.prepare("SELECT username, email FROM accounts WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1").bind(username, email).first();
  if (existing) {
    if (existing.username.toLowerCase() === username.toLowerCase()) return json({ error: "That username is already taken." }, 409);
    return json({ error: "An account already uses that email." }, 409);
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = Date.now();
  try {
    await env.DB.prepare("INSERT INTO accounts (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, username, email, passwordHash, now).run();
  } catch {
    return json({ error: "That username or email is already in use." }, 409);
  }
  return createSession(env, id, { id, username, email, minecraft: null }, 201);
}

async function login(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request." }, 400);
  const identifier = String(body.login || "").trim();
  const password = String(body.password || "");
  if (!identifier || !password) return json({ error: "Enter your username/email and password." }, 400);

  const account = await env.DB.prepare("SELECT id, username, email, password_hash FROM accounts WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1").bind(identifier, identifier).first();
  if (!account || !(await verifyPassword(password, account.password_hash))) return json({ error: "Incorrect username/email or password." }, 401);

  const minecraft = await env.DB.prepare("SELECT minecraft_uuid, minecraft_username, linked_at FROM minecraft_accounts WHERE account_id = ? LIMIT 1").bind(account.id).first();
  return createSession(env, account.id, { id: account.id, username: account.username, email: account.email, minecraft: minecraft || null });
}

async function logout(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}

async function me(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return json({ authenticated: false });
  const now = Date.now();
  const sessionId = await sha256Hex(token);
  const row = await env.DB.prepare(`SELECT a.id, a.username, a.email, m.minecraft_uuid, m.minecraft_username, m.linked_at
    FROM sessions s JOIN accounts a ON a.id = s.account_id
    LEFT JOIN minecraft_accounts m ON m.account_id = a.id
    WHERE s.id = ? AND s.expires_at > ? LIMIT 1`).bind(sessionId, now).first();
  if (!row) return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie() });
  return json({ authenticated: true, account: { id: row.id, username: row.username, email: row.email, minecraft: row.minecraft_uuid ? { uuid: row.minecraft_uuid, username: row.minecraft_username, linkedAt: row.linked_at } : null } });
}

async function createSession(env, accountId, account, status = 200) {
  const rawToken = randomToken(32);
  const sessionId = await sha256Hex(rawToken);
  const now = Date.now();
  const expires = now + SESSION_DAYS * 86400000;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare("INSERT INTO sessions (id, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(sessionId, accountId, expires, now)
  ]);
  return json({ ok: true, account }, status, { "Set-Cookie": sessionCookie(rawToken, SESSION_DAYS * 86400) });
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  try {
    const [scheme, iterationsText, salt64, expected64] = stored.split("$");
    if (scheme !== "pbkdf2-sha256") return false;
    const iterations = Number(iterationsText);
    const salt = fromBase64(salt64);
    const expected = fromBase64(expected64);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, expected.length * 8));
    if (bits.length !== expected.length) return false;
    let diff = 0; for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
    return diff === 0;
  } catch { return false; }
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}
async function readJson(request) { try { return await request.json(); } catch { return null; } }
function randomToken(bytes) { return base64Url(crypto.getRandomValues(new Uint8Array(bytes))); }
async function sha256Hex(value) { const b = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); return [...b].map(x => x.toString(16).padStart(2,"0")).join(""); }
function toBase64(bytes) { let s=""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function fromBase64(s) { const raw=atob(s), out=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i); return out; }
function base64Url(bytes) { return toBase64(bytes).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
function getCookie(request, name) { const cookies=request.headers.get("Cookie")||""; for(const part of cookies.split(";")){const [k,...v]=part.trim().split("="); if(k===name)return v.join("=");} return null; }
function sessionCookie(token, maxAge) { return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function clearSessionCookie() { return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
function json(data, status=200, extraHeaders={}) { return Response.json(data,{status,headers:{"Cache-Control":"no-store",...extraHeaders}}); }
