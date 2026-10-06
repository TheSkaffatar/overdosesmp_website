# OverdoseSMP website security audit v19

Threat model: assume a malicious player can inspect/decompile every public mod and frontend file, alter requests, and call the Worker API directly.

## Hardened in this build
- Server-only Minecraft write endpoints require `MINECRAFT_API_TOKEN`.
- The token is not present in the website source. Keep it only as a Cloudflare Worker secret and on the real server.
- Browser account mutations are same-origin protected and session identity is resolved server-side.
- Session cookie is HttpOnly, Secure and SameSite=Lax; only its SHA-256 hash is stored in D1.
- Password hashes use salted PBKDF2-SHA256. New passwords now use 310,000 iterations; old hashes remain compatible and can still be verified.
- Added D1-backed throttling for registration, login, Minecraft-code redemption and website messaging.
- Private public-profile API responses no longer expose the player's UUID or stats.
- Public profiles no longer expose UUIDs even when public.
- All SQL values reviewed here use D1 bound parameters rather than string interpolation.
- User-controlled message/profile text is escaped before insertion into generated HTML.
- Added CSP, HSTS, clickjacking protection, MIME sniffing protection, referrer policy and permissions policy.
- Minecraft-originated message timestamps are constrained to prevent arbitrary far-future/past history entries.

## Owner actions
1. Run `D1-MIGRATION-v19-security.sql` once BEFORE deploying this build.
2. Keep `MINECRAFT_API_TOKEN` only in Cloudflare secrets and the dedicated server's server-only config.
3. If that token has ever been committed to GitHub, included in a modpack/client config, posted in chat, or otherwise exposed, rotate it.
4. A separate audit of the current OverdoseSMP Core project is still required to confirm the token never reaches clients and every Core -> website write uses authenticated server requests.

## Deliberately not changed
- Public linked-player usernames remain public because the Players directory is an intentional site feature.
- Private profiles remain messageable, as designed, but their stats/status/progression stay hidden by the API.
