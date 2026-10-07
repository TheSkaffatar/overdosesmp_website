const SESSION_COOKIE = "od_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;

export default {
  async fetch(request, env) {
    const response = await handleRequest(request, env);
    return withSecurityHeaders(response);
  }
};

async function handleRequest(request, env) {
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
    if (url.pathname === "/api/account/privacy" && request.method === "POST") {
      if (!sameOrigin(request)) return json({ error: "Invalid request." }, 403);
      return changeProfilePrivacy(request, env);
    }
    if (url.pathname === "/api/messages/inbox" && request.method === "GET") return getMessageInbox(request, env);
    if (url.pathname === "/api/messages/conversations" && request.method === "GET") return getMessageConversations(request, env);
    const webMessageMatch = url.pathname.match(/^\/api\/messages\/([^/]+)$/);
    if (webMessageMatch && request.method === "GET") return getConversation(request, env, decodeURIComponent(webMessageMatch[1]));
    if (webMessageMatch && request.method === "POST") { if (!sameOrigin(request)) return json({ error: "Invalid request." }, 403); return sendWebMessage(request, env, decodeURIComponent(webMessageMatch[1])); }
    if (url.pathname === "/api/minecraft/messages/outbox" && request.method === "GET") return minecraftMessageOutbox(request, env);
    if (url.pathname === "/api/minecraft/messages/inbound" && request.method === "POST") return receiveMinecraftMessage(request, env);
    const deliveryMatch = url.pathname.match(/^\/api\/minecraft\/messages\/([0-9a-fA-F-]{36})\/delivered$/);
    if (deliveryMatch && request.method === "POST") return markMinecraftMessageDelivered(request, env, deliveryMatch[1]);
    if (url.pathname === "/api/players" && request.method === "GET") return listPlayers(env);
    const publicPlayerMatch = url.pathname.match(/^\/api\/players\/([^/]+)$/);
    if (publicPlayerMatch && request.method === "GET") return getPublicPlayer(env, decodeURIComponent(publicPlayerMatch[1]));
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

async function register(request, env) {
  if (!(await allowRequest(env, request, "register", 5, 3600))) return json({ error: "Too many attempts. Try again later." }, 429);
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
  return createSession(env, id, { id, username, email, profilePublic: true, minecraft: null }, 201);
}

async function login(request, env) {
  if (!(await allowRequest(env, request, "login", 12, 900))) return json({ error: "Too many login attempts. Try again later." }, 429);
  const body = await readJson(request);
  if (!body) return json({ error: "Invalid request." }, 400);
  const identifier = String(body.login || "").trim();
  const password = String(body.password || "");
  if (!identifier || !password) return json({ error: "Enter your username/email and password." }, 400);

  const account = await env.DB.prepare("SELECT id, username, email, password_hash, profile_public, created_at FROM accounts WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1").bind(identifier, identifier).first();
  if (!account || !(await verifyPassword(password, account.password_hash))) return json({ error: "Incorrect username/email or password." }, 401);

  const minecraft = await env.DB.prepare("SELECT minecraft_uuid, minecraft_username, linked_at FROM minecraft_accounts WHERE account_id = ? LIMIT 1").bind(account.id).first();
  return createSession(env, account.id, { id: account.id, username: account.username, email: account.email, createdAt: account.created_at, profilePublic: Boolean(account.profile_public), minecraft: minecraft ? { uuid: minecraft.minecraft_uuid, username: minecraft.minecraft_username, linkedAt: minecraft.linked_at } : null });
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
  const row = await env.DB.prepare(`SELECT a.id, a.username, a.email, a.created_at, a.profile_public, m.minecraft_uuid, m.minecraft_username, m.linked_at
    FROM sessions s JOIN accounts a ON a.id = s.account_id
    LEFT JOIN minecraft_accounts m ON m.account_id = a.id
    WHERE s.id = ? AND s.expires_at > ? LIMIT 1`).bind(sessionId, now).first();
  if (!row) return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie() });
  return json({ authenticated: true, account: { id: row.id, username: row.username, email: row.email, createdAt: row.created_at, profilePublic: Boolean(row.profile_public), minecraft: row.minecraft_uuid ? { uuid: row.minecraft_uuid, username: row.minecraft_username, linkedAt: row.linked_at } : null } });
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

async function changeProfilePrivacy(request, env) {
  const account = await authenticatedAccount(request, env);
  if (!account) return json({ error: "You must be logged in." }, 401);
  const body = await readJson(request);
  if (typeof body?.profilePublic !== "boolean") return json({ error: "Invalid privacy setting." }, 400);
  await env.DB.prepare("UPDATE accounts SET profile_public = ? WHERE id = ?").bind(body.profilePublic ? 1 : 0, account.id).run();
  return json({ ok: true, profilePublic: body.profilePublic });
}

async function listPlayers(env) {
  const rows = await env.DB.prepare(`SELECT a.username AS website_username, a.profile_public, m.minecraft_username
    FROM minecraft_accounts m JOIN accounts a ON a.id = m.account_id
    ORDER BY m.minecraft_username COLLATE NOCASE ASC`).all();
  return json({ players: (rows.results || []).map(r => ({ username: r.minecraft_username, websiteUsername: r.website_username, public: Boolean(r.profile_public) })) });
}

async function getPublicPlayer(env, username) {
  if (!/^[A-Za-z0-9_]{1,16}$/.test(username)) return json({ error: "Player not found." }, 404);
  const row = await env.DB.prepare(`SELECT a.profile_public, m.minecraft_uuid, m.minecraft_username,
      s.online, s.last_seen, s.first_joined, s.kills, s.deaths, s.playtime_ticks, s.distance_cm, s.blocks_mined, s.monsters_killed, s.champion_kills, s.duels_won, s.duels_lost, s.contracts_completed, s.hostile, s.bounty, s.updated_at
    FROM minecraft_accounts m JOIN accounts a ON a.id = m.account_id
    LEFT JOIN minecraft_player_stats s ON s.minecraft_uuid = m.minecraft_uuid
    WHERE m.minecraft_username = ? COLLATE NOCASE LIMIT 1`).bind(username).first();
  if (!row) return json({ error: "Player not found." }, 404);
  const base = { username: row.minecraft_username, public: Boolean(row.profile_public) };
  if (!base.public) return json({ player: base });
  const publicBase = base;
  if (row.updated_at == null) return json({ player: { ...publicBase, stats: null } });
  const now = Date.now(), fresh = now - Number(row.updated_at) <= 60000;
  return json({ player: { ...publicBase, stats: {
    online: Boolean(row.online) && fresh, lastSeen: Math.max(Number(row.last_seen || 0), Number(row.updated_at || 0)) || null,
    firstJoined: row.first_joined, kills: row.kills, deaths: row.deaths, playtimeTicks: row.playtime_ticks,
    distanceCm: row.distance_cm, blocksMined: row.blocks_mined, monstersKilled: row.monsters_killed,
    championKills: row.champion_kills, duelsWon: row.duels_won || 0, duelsLost: row.duels_lost || 0, contractsCompleted: row.contracts_completed || 0, hostile: Boolean(row.hostile), bounty: row.bounty
  } } });
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
  if (!(await allowRequest(env, request, "minecraft-link", 12, 600))) return json({ error: "Too many verification attempts. Try again later." }, 429);
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
  const duelsWon = int("duelsWon", 0), duelsLost = int("duelsLost", 0), contractsCompleted = int("contractsCompleted", 0);
  const hostile = body.hostile === true || body.hostile === 1 ? 1 : 0;
  const bounty = int("bounty");
  if (online === null || lastSeen === undefined || firstJoined === undefined || [kills,deaths,playtimeTicks,distanceCm,blocksMined,monstersKilled,championKills,duelsWon,duelsLost,contractsCompleted,bounty].some(v => v === null)) return json({ error: "Invalid player statistics." }, 400);

  const now = Date.now();
  // Core 0.2.6 may provide a source snapshot timestamp. Prefer it so a delayed
  // older request cannot overwrite a newer snapshot. Fall back to receipt time
  // for backwards compatibility with v15.4 senders.
  const suppliedSnapshotTime = body.updatedAt ?? body.snapshotAt ?? body.timestamp ?? body.sentAt;
  const parsedSnapshotTime = suppliedSnapshotTime == null ? now : Number(suppliedSnapshotTime);
  if (!Number.isSafeInteger(parsedSnapshotTime) || parsedSnapshotTime < 0) return json({ error: "Invalid snapshot timestamp." }, 400);
  const snapshotTime = parsedSnapshotTime;

  try {
    const result = await env.DB.prepare(`INSERT INTO minecraft_player_stats
      (minecraft_uuid, online, last_seen, first_joined, kills, deaths, playtime_ticks, distance_cm, blocks_mined, monsters_killed, champion_kills, duels_won, duels_lost, contracts_completed, hostile, bounty, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(minecraft_uuid) DO UPDATE SET
        online=excluded.online, last_seen=excluded.last_seen, first_joined=COALESCE(minecraft_player_stats.first_joined, excluded.first_joined),
        kills=excluded.kills, deaths=excluded.deaths, playtime_ticks=excluded.playtime_ticks, distance_cm=excluded.distance_cm,
        blocks_mined=excluded.blocks_mined, monsters_killed=excluded.monsters_killed, champion_kills=excluded.champion_kills,
        duels_won=excluded.duels_won, duels_lost=excluded.duels_lost, contracts_completed=excluded.contracts_completed,
        hostile=excluded.hostile, bounty=excluded.bounty, updated_at=excluded.updated_at
      WHERE excluded.updated_at >= minecraft_player_stats.updated_at`)
      .bind(minecraftUuid, online, lastSeen, firstJoined, kills, deaths, playtimeTicks, distanceCm, blocksMined, monstersKilled, championKills, duelsWon, duelsLost, contractsCompleted, hostile, bounty, snapshotTime).run();

    // Only let an accepted/current snapshot update the cached username too.
    const minecraftUsername = String(body.minecraftUsername || "").trim();
    if ((result?.meta?.changes ?? 0) > 0 && /^[A-Za-z0-9_]{1,16}$/.test(minecraftUsername)) {
      await env.DB.prepare("UPDATE minecraft_accounts SET minecraft_username = ? WHERE minecraft_uuid = ?").bind(minecraftUsername, minecraftUuid).run();
    }
  } catch (e) {
    console.error("Minecraft player stats storage failed", e?.message || e);
    return json({ error: "Unable to store player statistics." }, 500);
  }
  // Core 0.2.6 accepts HTTP 204 as acknowledgement.
  return new Response(null, { status: 204 });
}

async function getMinecraftPlayerStats(request, env) {
  const account = await authenticatedAccount(request, env);
  if (!account) return json({ error: "You must be logged in." }, 401);
  const linked = await env.DB.prepare("SELECT minecraft_uuid, minecraft_username FROM minecraft_accounts WHERE account_id = ? LIMIT 1").bind(account.id).first();
  if (!linked) return json({ linked: false, stats: null });
  const row = await env.DB.prepare(`SELECT online, last_seen, first_joined, kills, deaths, playtime_ticks, distance_cm, blocks_mined, monsters_killed, champion_kills, duels_won, duels_lost, contracts_completed, hostile, bounty, updated_at
    FROM minecraft_player_stats WHERE minecraft_uuid = ? LIMIT 1`).bind(linked.minecraft_uuid).first();
  if (!row) return json({ linked: true, minecraft: { uuid: linked.minecraft_uuid, username: linked.minecraft_username }, stats: null });
  const now = Date.now();
  const heartbeatFresh = Number.isFinite(Number(row.updated_at)) && (now - Number(row.updated_at) <= 60000);
  const effectiveOnline = Boolean(row.online) && heartbeatFresh;
  // If Core disappears without a clean disconnect, use the last received
  // heartbeat as the effective last-seen time once its 60s lease expires.
  const effectiveLastSeen = effectiveOnline ? row.last_seen : Math.max(Number(row.last_seen || 0), Number(row.updated_at || 0)) || null;
  return json({ linked: true, minecraft: { uuid: linked.minecraft_uuid, username: linked.minecraft_username }, stats: {
    online: effectiveOnline, lastSeen: effectiveLastSeen, firstJoined: row.first_joined,
    kills: row.kills, deaths: row.deaths, playtimeTicks: row.playtime_ticks, distanceCm: row.distance_cm,
    blocksMined: row.blocks_mined, monstersKilled: row.monsters_killed, championKills: row.champion_kills,
    hostile: Boolean(row.hostile), bounty: row.bounty, updatedAt: row.updated_at
  }});
}

async function linkedMinecraftForAccount(env, accountId) {
  return env.DB.prepare("SELECT minecraft_uuid, minecraft_username FROM minecraft_accounts WHERE account_id = ? LIMIT 1").bind(accountId).first();
}
async function messagePeer(env, username) {
  if (!/^[A-Za-z0-9_]{1,16}$/.test(username)) return null;
  return env.DB.prepare("SELECT minecraft_uuid, minecraft_username FROM minecraft_accounts WHERE minecraft_username = ? COLLATE NOCASE LIMIT 1").bind(username).first();
}
async function messageIdentity(request, env) {
  const account=await authenticatedAccount(request,env); if(!account)return null;
  const me=await linkedMinecraftForAccount(env,account.id); return me||null;
}
async function getMessageInbox(request, env) {
  const me=await messageIdentity(request,env); if(!me)return json({error:"Link your Minecraft account first."},403);
  const rows=await env.DB.prepare(`SELECT pm.id,pm.sender_uuid,ma.minecraft_username sender_username,pm.body,pm.created_at
    FROM player_messages pm JOIN minecraft_accounts ma ON ma.minecraft_uuid=pm.sender_uuid
    WHERE pm.recipient_uuid=? AND pm.read_at IS NULL ORDER BY pm.created_at DESC LIMIT 50`).bind(me.minecraft_uuid).all();
  return json({messages:rows.results||[]});
}
async function getMessageConversations(request, env) {
  const me=await messageIdentity(request,env); if(!me)return json({error:"Link your Minecraft account first."},403);
  const rows=await env.DB.prepare(`SELECT pm.id,pm.sender_uuid,pm.recipient_uuid,pm.body,pm.created_at,pm.read_at,
    CASE WHEN pm.sender_uuid=? THEN pm.recipient_uuid ELSE pm.sender_uuid END peer_uuid
    FROM player_messages pm WHERE pm.sender_uuid=? OR pm.recipient_uuid=? ORDER BY pm.created_at DESC LIMIT 1000`).bind(me.minecraft_uuid,me.minecraft_uuid,me.minecraft_uuid).all();
  const seen=new Set(), conversations=[];
  for(const r of (rows.results||[])){ if(seen.has(r.peer_uuid))continue; seen.add(r.peer_uuid); const peer=await env.DB.prepare("SELECT minecraft_username FROM minecraft_accounts WHERE minecraft_uuid=? LIMIT 1").bind(r.peer_uuid).first(); if(!peer)continue; const unread=await env.DB.prepare("SELECT COUNT(*) n FROM player_messages WHERE sender_uuid=? AND recipient_uuid=? AND read_at IS NULL").bind(r.peer_uuid,me.minecraft_uuid).first(); conversations.push({username:peer.minecraft_username,lastBody:r.body,lastAt:r.created_at,unread:Number(unread?.n||0)}); }
  return json({conversations});
}
async function getConversation(request, env, username) {
  const account=await authenticatedAccount(request,env); if(!account)return json({error:"You must be logged in."},401);
  const me=await linkedMinecraftForAccount(env,account.id); if(!me)return json({error:"Link your Minecraft account first."},403);
  const peer=await messagePeer(env,username); if(!peer)return json({error:"Player not found."},404);
  const rows=await env.DB.prepare(`SELECT id,sender_uuid,recipient_uuid,body,source,delivery_mode,created_at,read_at FROM player_messages
    WHERE (sender_uuid=? AND recipient_uuid=?) OR (sender_uuid=? AND recipient_uuid=?) ORDER BY created_at ASC LIMIT 500`)
    .bind(me.minecraft_uuid,peer.minecraft_uuid,peer.minecraft_uuid,me.minecraft_uuid).all();
  await env.DB.prepare("UPDATE player_messages SET read_at=? WHERE recipient_uuid=? AND sender_uuid=? AND read_at IS NULL").bind(Date.now(),me.minecraft_uuid,peer.minecraft_uuid).run();
  return json({player:peer.minecraft_username,messages:(rows.results||[]).map(r=>({id:r.id,outgoing:r.sender_uuid===me.minecraft_uuid,body:r.body,source:r.source,deliveryMode:r.delivery_mode,createdAt:r.created_at}))});
}
async function sendWebMessage(request,env,username){
  if (!(await allowRequest(env, request, "message", 30, 60))) return json({error:"You are sending messages too quickly."},429);
  const account=await authenticatedAccount(request,env); if(!account)return json({error:"You must be logged in."},401);
  const me=await linkedMinecraftForAccount(env,account.id); if(!me)return json({error:"Link your Minecraft account first."},403);
  const peer=await messagePeer(env,username); if(!peer)return json({error:"Player not found."},404);
  if(peer.minecraft_uuid===me.minecraft_uuid)return json({error:"You cannot message yourself."},400);
  const body=await readJson(request),text=String(body?.body||"").trim(); if(!text||text.length>256)return json({error:"Messages must be 1–256 characters."},400);
  const id=crypto.randomUUID(),now=Date.now(); await env.DB.prepare("INSERT INTO player_messages (id,sender_uuid,recipient_uuid,body,source,delivery_status,created_at) VALUES (?,?,?,?,?,?,?)").bind(id,me.minecraft_uuid,peer.minecraft_uuid,text,"web","pending",now).run();
  return json({ok:true,message:{id,createdAt:now}},201);
}
async function requireMinecraftApi(request,env){
  if(!env.MINECRAFT_API_TOKEN)return false; const auth=request.headers.get("Authorization")||""; return auth.startsWith("Bearer ")&&await safeSecretEqual(auth.slice(7),env.MINECRAFT_API_TOKEN);
}
async function minecraftMessageOutbox(request,env){
  if(!(await requireMinecraftApi(request,env)))return json({error:"Unauthorized."},401);
  const rows=await env.DB.prepare(`SELECT pm.id,pm.sender_uuid,sm.minecraft_username sender_username,pm.recipient_uuid,rm.minecraft_username recipient_username,pm.body,pm.created_at
    FROM player_messages pm JOIN minecraft_accounts sm ON sm.minecraft_uuid=pm.sender_uuid JOIN minecraft_accounts rm ON rm.minecraft_uuid=pm.recipient_uuid
    WHERE pm.source='web' AND pm.delivery_status='pending' ORDER BY pm.created_at ASC LIMIT 50`).all();
  return json({messages:rows.results||[]});
}
async function markMinecraftMessageDelivered(request,env,id){
  if(!(await requireMinecraftApi(request,env)))return json({error:"Unauthorized."},401); const body=await readJson(request); const mode=String(body?.mode||""); if(!["msg","mail"].includes(mode))return json({error:"Invalid delivery mode."},400);
  await env.DB.prepare("UPDATE player_messages SET delivery_status='delivered',delivery_mode=?,delivered_at=? WHERE id=? AND source='web'").bind(mode,Date.now(),id).run(); return new Response(null,{status:204});
}
async function receiveMinecraftMessage(request,env){
  if(!(await requireMinecraftApi(request,env)))return json({error:"Unauthorized."},401); const body=await readJson(request); if(!body)return json({error:"Invalid JSON."},400);
  const from=normalizeUuid(String(body.fromUuid||"")),to=normalizeUuid(String(body.toUuid||"")),text=String(body.body||"").trim(),created=Number(body.createdAt||Date.now()); if(!from||!to||!text||text.length>256||!Number.isSafeInteger(created)||Math.abs(Date.now()-created)>86400000)return json({error:"Invalid message."},400);
  const known=await env.DB.prepare("SELECT COUNT(*) n FROM minecraft_accounts WHERE minecraft_uuid IN (?,?)").bind(from,to).first(); if(Number(known?.n)!==2)return json({error:"Both players must have linked accounts."},400);
  const id=String(body.id||crypto.randomUUID()); if(!/^[0-9a-fA-F-]{36}$/.test(id))return json({error:"Invalid message id."},400);
  await env.DB.prepare("INSERT OR IGNORE INTO player_messages (id,sender_uuid,recipient_uuid,body,source,delivery_status,delivery_mode,created_at,delivered_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,from,to,text,"game","delivered","msg",created,created).run(); return new Response(null,{status:204});
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
  const site = request.headers.get("Sec-Fetch-Site");
  if (site === "cross-site") return false;
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

async function allowRequest(env, request, bucket, limit, windowSeconds) {
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const key = await sha256Hex(`${bucket}:${ip}`);
    const windowMs = windowSeconds * 1000;
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    await env.DB.prepare(`INSERT INTO api_rate_limits (rate_key, window_start, hits) VALUES (?, ?, 1)
      ON CONFLICT(rate_key, window_start) DO UPDATE SET hits = hits + 1`).bind(key, windowStart).run();
    const row = await env.DB.prepare("SELECT hits FROM api_rate_limits WHERE rate_key = ? AND window_start = ?").bind(key, windowStart).first();
    // Opportunistic cleanup keeps this tiny without a scheduled job.
    if (Math.random() < 0.01) await env.DB.prepare("DELETE FROM api_rate_limits WHERE window_start < ?").bind(now - 86400000).run();
    return Number(row?.hits || 0) <= limit;
  } catch (e) {
    console.error("Rate limit check failed", e?.message || e);
    // Fail open so a D1 issue cannot lock every player out.
    return true;
  }
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://mc-heads.net; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
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
