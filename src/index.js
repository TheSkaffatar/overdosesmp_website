const SESSION_COOKIE = "od_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;

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
    if (url.pathname === "/api/account/username" && request.method === "POST") {
      if (!sameOrigin(request)) return json({ error: "Invalid request." }, 403);
      return changeUsername(request, env);
    }
    if (url.pathname === "/api/account/password" && request.method === "POST") {
      if (!sameOrigin(request)) return json({ error: "Invalid request." }, 403);
      return changePassword(request, env);
    }
    if (url.pathname === "/api/account/delete" && request.method === "POST") {
      if (!sameOrigin(request)) return json({ error: "Invalid request." }, 403);
      return deleteAccount(request, env);
    }
    const verificationMatch = url.pathname.match(/^\/api\/minecraft\/verifications\/([0-9a-fA-F-]{32,36})$/);
    if (verificationMatch && request.method === "PUT") {
      return receiveMinecraftVerification(request, env, verificationMatch[1]);
    }
    if (url.pathname === "/api/minecraft/link" && request.method === "POST") {
      if (!sameOrigin(request)) return json({ error: "Invalid request." }, 403);
      return linkMinecraftAccount(request, env);
    }
    const statsPushMatch = url.pathname.match(/^\/api\/minecraft\/players\/([0-9a-fA-F-]{32,36})\/stats$/);
    if (statsPushMatch && request.method === "PUT") {
      return receiveMinecraftPlayerStats(request, env, statsPushMatch[1]);
    }
    if (url.pathname === "/api/minecraft/stats" && request.method === "GET") {
      return getMinecraftPlayerStats(request, env);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);

    // SPA-style fallback: direct visits/refreshes such as /profile should load
    // the app shell instead of asking the static asset binding for a missing file.
    if (request.method === "GET" && !url.pathname.includes(".")) {
      const shellUrl = new URL(request.url);
      shellUrl.pathname = "/";
      return env.ASSETS.fetch(new Request(shellUrl, request));
    }
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
  const row = await env.DB.prepare(`SELECT a.id, a.username, a.email, a.created_at, m.minecraft_uuid, m.minecraft_username, m.linked_at
    FROM sessions s JOIN accounts a ON a.id = s.account_id
    LEFT JOIN minecraft_accounts m ON m.account_id = a.id
    WHERE s.id = ? AND s.expires_at > ? LIMIT 1`).bind(sessionId, now).first();
  if (!row) return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie() });
  return json({ authenticated: true, account: { id: row.id, username: row.username, email: row.email, createdAt: row.created_at, minecraft: row.minecraft_uuid ? { uuid: row.minecraft_uuid, username: row.minecraft_username, linkedAt: row.linked_at } : null } });
}

async function authenticatedAccount(request, env, includePassword = false) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const sessionId = await sha256Hex(token);
  const fields = includePassword ? "a.id, a.username, a.email, a.password_hash" : "a.id, a.username, a.email";
  return env.DB.prepare(`SELECT ${fields} FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.id = ? AND s.expires_at > ? LIMIT 1`).bind(sessionId, Date.now()).first();
}

async function changeUsername(request, env) {
  const account = await authenticatedAccount(request, env, true);
  if (!account) return json({ error: "You must be logged in." }, 401);
  const body = await readJson(request);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return json({ error: "Username must be 3–24 characters using letters, numbers or _." }, 400);
  if (!(await verifyPassword(password, account.password_hash))) return json({ error: "Current password is incorrect." }, 401);
  if (username.toLowerCase() === account.username.toLowerCase()) return json({ error: "Choose a different username." }, 400);
  const taken = await env.DB.prepare("SELECT 1 FROM accounts WHERE username = ? COLLATE NOCASE AND id != ? LIMIT 1").bind(username, account.id).first();
  if (taken) return json({ error: "That username is already taken." }, 409);
  await env.DB.prepare("UPDATE accounts SET username = ? WHERE id = ?").bind(username, account.id).run();
  return json({ ok: true, username });
}

async function changePassword(request, env) {
  const account = await authenticatedAccount(request, env, true);
  if (!account) return json({ error: "You must be logged in." }, 401);
  const body = await readJson(request);
  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");
  if (!(await verifyPassword(currentPassword, account.password_hash))) return json({ error: "Current password is incorrect." }, 401);
  if (newPassword.length < 8 || newPassword.length > 128) return json({ error: "New password must be 8–128 characters." }, 400);
  if (currentPassword === newPassword) return json({ error: "Choose a different password." }, 400);
  const newHash = await hashPassword(newPassword);
  const token = getCookie(request, SESSION_COOKIE);
  const currentSession = token ? await sha256Hex(token) : "";
  await env.DB.batch([
    env.DB.prepare("UPDATE accounts SET password_hash = ? WHERE id = ?").bind(newHash, account.id),
    env.DB.prepare("DELETE FROM sessions WHERE account_id = ? AND id != ?").bind(account.id, currentSession)
  ]);
  return json({ ok: true });
}

async function deleteAccount(request, env) {
  const account = await authenticatedAccount(request, env, true);
  if (!account) return json({ error: "You must be logged in." }, 401);
  const body = await readJson(request);
  const password = String(body?.password || "");
  const confirmation = String(body?.confirmation || "");
  if (!(await verifyPassword(password, account.password_hash))) return json({ error: "Current password is incorrect." }, 401);
  if (confirmation !== account.username) return json({ error: "Type your username exactly to confirm deletion." }, 400);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE account_id = ?").bind(account.id),
    env.DB.prepare("DELETE FROM minecraft_accounts WHERE account_id = ?").bind(account.id),
    env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(account.id)
  ]);
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}

async function receiveMinecraftVerification(request, env, pathUuid) {
  if (!env.MINECRAFT_API_TOKEN) return json({ error: "Server integration is not configured." }, 503);
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || !(await safeSecretEqual(auth.slice(7), env.MINECRAFT_API_TOKEN))) return json({ error: "Unauthorized." }, 401);

  const body = await readJson(request);
  if (!body) return json({ error: "Invalid JSON." }, 400);
  const requestId = String(body.requestId || "").trim();
  const code = String(body.code || "").trim().toUpperCase();
  const minecraftUuid = normalizeUuid(String(body.minecraftUuid || ""));
  const routeUuid = normalizeUuid(pathUuid);
  const minecraftUsername = String(body.minecraftUsername || "").trim();
  const generation = Number(body.generation);
  const createdAt = Number(body.createdAt);
  const expiresAt = Number(body.expiresAt);
  const now = Date.now();

  if (!requestId || !/^[0-9a-fA-F-]{36}$/.test(requestId)) return json({ error: "Invalid requestId." }, 400);
  if (!/^OD-[A-Z0-9-]{8,32}$/.test(code)) return json({ error: "Invalid verification code." }, 400);
  if (!minecraftUuid || minecraftUuid !== routeUuid) return json({ error: "Minecraft UUID mismatch." }, 400);
  if (!/^[A-Za-z0-9_]{1,16}$/.test(minecraftUsername)) return json({ error: "Invalid Minecraft username." }, 400);
  if (!Number.isSafeInteger(generation) || generation < 0 || !Number.isSafeInteger(createdAt) || !Number.isSafeInteger(expiresAt)) return json({ error: "Invalid timestamps or generation." }, 400);
  if (expiresAt <= now || expiresAt <= createdAt || expiresAt - createdAt > 11 * 60 * 1000) return json({ error: "Invalid or expired verification window." }, 400);
  if (createdAt > now + 2 * 60 * 1000) return json({ error: "Invalid creation timestamp." }, 400);

  const current = await env.DB.prepare("SELECT request_id, generation FROM verification_codes WHERE minecraft_uuid = ? LIMIT 1").bind(minecraftUuid).first();
  if (current) {
    if (Number(current.generation) > generation) return json({ error: "Stale generation." }, 409);
    if (Number(current.generation) === generation) {
      if (current.request_id === requestId) return json({ status: "created", requestId });
      return json({ error: "Generation conflict." }, 409);
    }
  }

  const codeHash = await sha256Hex(code);
  try {
    const result = await env.DB.prepare(`INSERT INTO verification_codes
      (code_hash, minecraft_uuid, minecraft_username, expires_at, created_at, request_id, generation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(minecraft_uuid) DO UPDATE SET
        code_hash = excluded.code_hash,
        minecraft_username = excluded.minecraft_username,
        expires_at = excluded.expires_at,
        created_at = excluded.created_at,
        request_id = excluded.request_id,
        generation = excluded.generation
      WHERE excluded.generation > verification_codes.generation`)
      .bind(codeHash, minecraftUuid, minecraftUsername, expiresAt, createdAt, requestId, generation).run();
    if (!result.success) return json({ error: "Unable to store verification." }, 500);
  } catch (e) {
    console.error("Minecraft verification storage failed", e?.message || e);
    return json({ error: "Unable to store verification." }, 500);
  }
  return json({ status: "created", requestId }, 201);
}

async function linkMinecraftAccount(request, env) {
  const account = await authenticatedAccount(request, env);
  if (!account) return json({ error: "You must be logged in." }, 401);
  const body = await readJson(request);
  const code = String(body?.code || "").trim().toUpperCase();
  if (!/^OD-[A-Z0-9-]{8,32}$/.test(code)) return json({ error: "Enter a valid verification code." }, 400);

  const codeHash = await sha256Hex(code);
  const now = Date.now();
  const verification = await env.DB.prepare(`SELECT minecraft_uuid, minecraft_username, expires_at
    FROM verification_codes WHERE code_hash = ? LIMIT 1`).bind(codeHash).first();
  if (!verification || Number(verification.expires_at) <= now) {
    if (verification) await env.DB.prepare("DELETE FROM verification_codes WHERE code_hash = ?").bind(codeHash).run();
    return json({ error: "That verification code is invalid or has expired." }, 400);
  }

  const existingForAccount = await env.DB.prepare("SELECT minecraft_uuid, minecraft_username FROM minecraft_accounts WHERE account_id = ? LIMIT 1").bind(account.id).first();
  if (existingForAccount) return json({ error: "This website account already has a Minecraft account linked." }, 409);
  const existingMinecraft = await env.DB.prepare("SELECT account_id FROM minecraft_accounts WHERE minecraft_uuid = ? LIMIT 1").bind(verification.minecraft_uuid).first();
  if (existingMinecraft) return json({ error: "That Minecraft account is already linked to another website account." }, 409);

  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO minecraft_accounts (minecraft_uuid, account_id, minecraft_username, linked_at) VALUES (?, ?, ?, ?)").bind(verification.minecraft_uuid, account.id, verification.minecraft_username, now),
      env.DB.prepare("DELETE FROM verification_codes WHERE code_hash = ? AND minecraft_uuid = ?").bind(codeHash, verification.minecraft_uuid)
    ]);
  } catch (e) {
    console.error("Minecraft account link failed", e?.message || e);
    return json({ error: "Unable to link that Minecraft account." }, 409);
  }
  return json({ ok: true, minecraft: { uuid: verification.minecraft_uuid, username: verification.minecraft_username, linkedAt: now } });
}

async function receiveMinecraftPlayerStats(request, env, pathUuid) {
  if (!env.MINECRAFT_API_TOKEN) return json({ error: "Server integration is not configured." }, 503);
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || !(await safeSecretEqual(auth.slice(7), env.MINECRAFT_API_TOKEN))) return json({ error: "Unauthorized." }, 401);

  const minecraftUuid = normalizeUuid(pathUuid);
  const body = await readJson(request);
  if (!minecraftUuid || !body) return json({ error: "Invalid request." }, 400);

  const int = (name, fallback = 0) => {
    const n = Number(body[name] ?? fallback);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  };
  const nullableTime = name => {
    if (body[name] == null) return null;
    const n = Number(body[name]);
    return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
  };
  const online = body.online === true || body.online === 1 ? 1 : body.online === false || body.online === 0 ? 0 : null;
  const lastSeen = nullableTime("lastSeen");
  const firstJoined = nullableTime("firstJoined");
  const kills = int("kills"), deaths = int("deaths"), playtimeTicks = int("playtimeTicks"), distanceCm = int("distanceCm"), blocksMined = int("blocksMined"), monstersKilled = int("monstersKilled"), championKills = int("championKills");
  const hostile = body.hostile === true || body.hostile === 1 ? 1 : 0;
  const bounty = int("bounty");
  if (online === null || lastSeen === undefined || firstJoined === undefined || [kills,deaths,playtimeTicks,distanceCm,blocksMined,monstersKilled,championKills,bounty].some(v => v === null)) return json({ error: "Invalid player statistics." }, 400);

  const now = Date.now();
  try {
    await env.DB.prepare(`INSERT INTO minecraft_player_stats
      (minecraft_uuid, online, last_seen, first_joined, kills, deaths, playtime_ticks, distance_cm, blocks_mined, monsters_killed, champion_kills, hostile, bounty, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(minecraft_uuid) DO UPDATE SET
        online=excluded.online, last_seen=excluded.last_seen, first_joined=COALESCE(minecraft_player_stats.first_joined, excluded.first_joined),
        kills=excluded.kills, deaths=excluded.deaths, playtime_ticks=excluded.playtime_ticks, distance_cm=excluded.distance_cm,
        blocks_mined=excluded.blocks_mined, monsters_killed=excluded.monsters_killed, champion_kills=excluded.champion_kills,
        hostile=excluded.hostile, bounty=excluded.bounty, updated_at=excluded.updated_at`)
      .bind(minecraftUuid, online, lastSeen, firstJoined, kills, deaths, playtimeTicks, distanceCm, blocksMined, monstersKilled, championKills, hostile, bounty, now).run();

    const minecraftUsername = String(body.minecraftUsername || "").trim();
    if (/^[A-Za-z0-9_]{1,16}$/.test(minecraftUsername)) {
      await env.DB.prepare("UPDATE minecraft_accounts SET minecraft_username = ? WHERE minecraft_uuid = ?").bind(minecraftUsername, minecraftUuid).run();
    }
  } catch (e) {
    console.error("Minecraft player stats storage failed", e?.message || e);
    return json({ error: "Unable to store player statistics." }, 500);
  }
  return json({ status: "updated", minecraftUuid, updatedAt: now });
}

async function getMinecraftPlayerStats(request, env) {
  const account = await authenticatedAccount(request, env);
  if (!account) return json({ error: "You must be logged in." }, 401);
  const linked = await env.DB.prepare("SELECT minecraft_uuid, minecraft_username FROM minecraft_accounts WHERE account_id = ? LIMIT 1").bind(account.id).first();
  if (!linked) return json({ linked: false, stats: null });
  const row = await env.DB.prepare(`SELECT online, last_seen, first_joined, kills, deaths, playtime_ticks, distance_cm, blocks_mined, monsters_killed, champion_kills, hostile, bounty, updated_at
    FROM minecraft_player_stats WHERE minecraft_uuid = ? LIMIT 1`).bind(linked.minecraft_uuid).first();
  if (!row) return json({ linked: true, minecraft: { uuid: linked.minecraft_uuid, username: linked.minecraft_username }, stats: null });
  return json({ linked: true, minecraft: { uuid: linked.minecraft_uuid, username: linked.minecraft_username }, stats: {
    online: Boolean(row.online), lastSeen: row.last_seen, firstJoined: row.first_joined,
    kills: row.kills, deaths: row.deaths, playtimeTicks: row.playtime_ticks, distanceCm: row.distance_cm,
    blocksMined: row.blocks_mined, monstersKilled: row.monsters_killed, championKills: row.champion_kills,
    hostile: Boolean(row.hostile), bounty: row.bounty, updatedAt: row.updated_at
  }});
}

function normalizeUuid(value) {
  const hex = value.toLowerCase().replace(/-/g, "");
  return /^[0-9a-f]{32}$/.test(hex) ? hex : null;
}

async function safeSecretEqual(a, b) {
  const [ah, bh] = await Promise.all([sha256Hex(String(a)), sha256Hex(String(b))]);
  let diff = 0;
  for (let i = 0; i < ah.length; i++) diff |= ah.charCodeAt(i) ^ bh.charCodeAt(i);
  return diff === 0;
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
