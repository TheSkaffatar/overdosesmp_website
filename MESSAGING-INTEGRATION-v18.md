# OverdoseSMP Core messaging bridge for website v18

The website side is implemented. Core must bridge Minecraft `/msg` and `/mail` to these API endpoints for true two-way messaging.

Use the existing `MINECRAFT_API_TOKEN` bearer authentication. Do not expose the token to clients.

## Website -> Minecraft

Poll:
`GET /api/minecraft/messages/outbox`

For every returned message:
- If `recipient_uuid` is online, deliver it as the normal private `/msg` experience.
- If offline, store/deliver it through the server's `/mail` behavior.
- Preserve the website sender name shown to the recipient.
- After successful delivery, acknowledge exactly once:
  `POST /api/minecraft/messages/{id}/delivered`
  JSON: `{ "mode": "msg" }` or `{ "mode": "mail" }`
- Do not acknowledge failed deliveries. The message remains pending and can be retried.

## Minecraft -> Website

Whenever one linked player sends another linked player a private message in game, also push a copy to:
`POST /api/minecraft/messages/inbound`

JSON:
```json
{
  "id": "stable-uuid-for-this-message",
  "fromUuid": "sender minecraft uuid",
  "toUuid": "recipient minecraft uuid",
  "body": "Wassup",
  "createdAt": 1791320000000
}
```

The stable message id prevents duplicate history entries if a request is retried.

Important: do NOT push a website-originated message back through `/inbound` when Core delivers it. It already exists in website history. Only acknowledge it with `/delivered`.

## Stats additions

The existing player stats payload can now optionally send:
- `duelsWon`
- `duelsLost`
- `contractsCompleted`

Until Core sends them, the website accepts missing values and displays `0`.
