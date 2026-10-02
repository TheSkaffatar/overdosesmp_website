# OverdoseSMP Minecraft Stats API (v15.4)

Private server endpoint:

`PUT /api/minecraft/players/{minecraftUuid}/stats`

Headers:
- `Authorization: Bearer <MINECRAFT_API_TOKEN>`
- `Content-Type: application/json`

Full snapshot body:
```json
{
  "minecraftUsername": "ExamplePlayer",
  "online": true,
  "lastSeen": 1790899800000,
  "firstJoined": 1790000000000,
  "kills": 12,
  "deaths": 4,
  "playtimeTicks": 720000,
  "distanceCm": 128400000,
  "blocksMined": 91420,
  "monstersKilled": 4291,
  "championKills": 17,
  "hostile": false,
  "bounty": 0
}
```
All timestamps are UTC Unix milliseconds. All counters are non-negative integers. Send complete snapshots, not deltas.

Success:
`200 {"status":"updated","minecraftUuid":"...","updatedAt":...}`

Authenticated website endpoint:
`GET /api/minecraft/stats`

The profile polls this endpoint every 5 seconds while open. Until the Minecraft server has sent a snapshot, the UI keeps statistic values as `—`.
