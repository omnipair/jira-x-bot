# Jira → X Bot (TypeScript, CommonJS)

## Setup
1. `cp .env.example .env` and fill OAuth 1.0a credentials:
   - `X_API_KEY` - Your Twitter API Key (Consumer Key)
   - `X_API_SECRET` - Your Twitter API Secret (Consumer Secret)
   - `X_ACCESS_TOKEN` - Your Access Token
   - `X_ACCESS_TOKEN_SECRET` - Your Access Token Secret
2. (Optional) Add `DISCORD_WEBHOOK_URL` for Discord notifications
3. `yarn install`
4. Local run: `yarn dev`
5. Expose HTTPS (pick one):
   - `cloudflared tunnel --url http://localhost:8080`
   - `ngrok http 8080`

## Jira Webhook (Cloud)
- Settings (⚙️) → System → Webhooks → Create
- URL: `https://YOUR-TUNNEL/webhooks/jira`
- Events: Issue updated
- JQL: `project = OMFG AND status CHANGED`
- (Optional) Header: `X-Webhook-Secret: <your secret>` and set `JIRA_WEBHOOK_SECRET` in `.env`

## Test
```

curl -sv -X POST https://YOUR-TUNNEL/webhooks/jira \
-H "Content-Type: application/json" \
-H "X-Webhook-Secret: $JIRA_WEBHOOK_SECRET" \
-d '{"webhookEvent":"jira:issue_updated","issue":{"key":"OMFG-123","fields":{"summary":"Testing","status":{"name":"Done"},"project":{"key":"OMFG"}}},"changelog":{"items":[{"field":"status","fromString":"In Progress","toString":"Done"}]}}'

```

You should see `Tweet ok:` in logs and a post on X.

## Discord Integration

When a ticket status changes and is tweeted, the bot will also send a rich embed to Discord (if `DISCORD_WEBHOOK_URL` is configured).

**No bot token needed!** Discord webhooks work differently than Discord bots:
- Webhooks only need a webhook URL (no bot token, no channel ID)
- You can create webhooks directly in Discord server settings
- The webhook URL already contains both the channel and authentication info

The Discord embed includes:
- Ticket key and summary
- Status transition (from → to)
- Color coding (green for "Done", yellow for "In Progress")

To get a Discord webhook URL:
1. Go to your Discord server settings
2. Navigate to Integrations → Webhooks
3. Create a new webhook or use an existing one
4. Copy the webhook URL (looks like `https://discord.com/api/webhooks/...`) and add it to `.env` as `DISCORD_WEBHOOK_URL`

## Dry Run Options

You can test without actually posting by setting:
- `DRY_RUN_TWITTER=true` - Will log tweets instead of posting them
- `DRY_RUN_DISCORD=true` - Will log Discord embeds instead of sending them

You can enable either or both independently.
