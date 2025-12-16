# Jira → X Bot (TypeScript, CommonJS)

## Setup
1. `cp .env.example .env` and fill OAuth 1.0a credentials:
   - `X_API_KEY` - Your Twitter API Key (Consumer Key)
   - `X_API_SECRET` - Your Twitter API Secret (Consumer Secret)
   - `X_ACCESS_TOKEN` - Your Access Token
   - `X_ACCESS_TOKEN_SECRET` - Your Access Token Secret
2. (Optional) Add `DISCORD_WEBHOOK_URL` for Discord notifications
3. (Optional) Configure branding:
   - `BRAND_NAME` - Footer text in Discord embeds
   - `BRAND_ICON_URL` - Footer icon URL in Discord embeds
   - `TWEET_HASHTAGS` - Hashtags to append to tweets (must be quoted in .env, e.g., `"#MyBrand #MyProject"`)
4. `yarn install`
5. Local run: `yarn dev`
6. Expose HTTPS (pick one):
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

## Feature Toggles

You can enable or disable X and Discord posting independently:

- `ENABLE_X=true` (default) - Enable X/Twitter posting
- `ENABLE_X=false` - Disable X/Twitter posting completely
- `ENABLE_DISCORD=true` (default) - Enable Discord notifications
- `ENABLE_DISCORD=false` - Disable Discord notifications completely

If both are disabled, webhooks will still be processed and logged, but nothing will be posted.

## Discord Integration

When a ticket status changes, the bot will send a rich embed to Discord (if `DISCORD_WEBHOOK_URL` is configured and `ENABLE_DISCORD` is not set to `false`).

**No bot token needed!** Discord webhooks work differently than Discord bots:
- Webhooks only need a webhook URL (no bot token, no channel ID)
- You can create webhooks directly in Discord server settings
- The webhook URL already contains both the channel and authentication info

The Discord embed includes:
- Ticket key and summary
- Status transition (from → to)
- Custom branding (if `BRAND_NAME` and optionally `BRAND_ICON_URL` are configured)

To get a Discord webhook URL:
1. Go to your Discord server settings
2. Navigate to Integrations → Webhooks
3. Create a new webhook or use an existing one
4. Copy the webhook URL (looks like `https://discord.com/api/webhooks/...`) and add it to `.env` as `DISCORD_WEBHOOK_URL`

## Dry Run Options

You can test without actually posting by setting:
- `DRY_RUN_TWITTER=true` - Will log tweets instead of posting them
- `DRY_RUN_DISCORD=true` - Will log Discord embeds instead of sending them
- `DRY_RUN=true` - Will enable dry run for both services

You can enable either or both independently. Note: Dry run is different from disabling a service. With dry run, the service still processes the request but doesn't actually post. With `ENABLE_X=false` or `ENABLE_DISCORD=false`, the service is completely skipped.

## Branding Configuration

Customize the bot's appearance:

- `BRAND_NAME` - Text displayed in Discord embed footer (optional)
- `BRAND_ICON_URL` - Icon URL displayed in Discord embed footer (optional, only used if `BRAND_NAME` is set)
- `TWEET_HASHTAGS` - Hashtags appended to tweets (optional)

**Important:** When setting `TWEET_HASHTAGS`, you must quote the value in your `.env` file because `#` is used for comments in `.env` files:

```bash
TWEET_HASHTAGS="#MyBrand #MyProject"
```

If `BRAND_NAME` is not set, Discord embeds will not include a footer.
