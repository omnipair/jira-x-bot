# Jira → X Bot (TypeScript, CommonJS)

## Setup
1. `cp .env.example .env` and fill `X_ACCESS_TOKEN`.
2. `yarn install`
3. Local run: `yarn dev`
4. Expose HTTPS (pick one):
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
