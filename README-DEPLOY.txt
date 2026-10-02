OverdoseSMP v10 - Worker + Static Assets foundation

What changed:
- Existing v9 site moved into /public (visual website is unchanged).
- Worker entry point added at /src/index.js.
- /api/health returns a small JSON response to prove Worker code is running.
- wrangler.jsonc configures static assets + Worker API routing.
- No database/authentication has been added yet.

After deploying, visit:
https://overdosesmp.online/api/health

Expected response:
{"ok":true,"service":"OverdoseSMP","api":"online"}

Next step after this works:
Create/bind the D1 database as DB, then add account schema and authentication endpoints.
