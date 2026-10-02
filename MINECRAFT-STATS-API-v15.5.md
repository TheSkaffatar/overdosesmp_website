# OverdoseSMP Minecraft Stats API — v15.5

`PUT /api/minecraft/players/{minecraftUuid}/stats`

Uses the existing `Authorization: Bearer <websiteApiToken>` authentication.

The v15.4 payload remains supported. For source-order protection, Core 0.2.6 may additionally send one of these UTC Unix millisecond fields: `updatedAt` (preferred), `snapshotAt`, `timestamp`, or `sentAt`. When present, older snapshots are atomically ignored. If omitted, Worker receipt time is used for backwards compatibility.

Successful writes (including safely ignored stale writes) return HTTP 204.

The profile read endpoint treats `online=true` as a 60-second lease. If no fresh snapshot/heartbeat has arrived within 60 seconds, the player is reported offline even if the last stored snapshot said online.
