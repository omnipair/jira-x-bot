import "dotenv/config";

const dryRunGlobal = String(process.env.DRY_RUN || "false").toLowerCase() === "true";
export const cfg = {
  port: Number(process.env.PORT || 8080),
  projectKey: process.env.JIRA_PROJECT_KEY || "",
  webhookSecret: process.env.JIRA_WEBHOOK_SECRET || "",
  xAccessToken: process.env.X_ACCESS_TOKEN || "",
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  dryRunTwitter: dryRunGlobal || String(process.env.DRY_RUN_TWITTER || "false").toLowerCase() === "true",
  dryRunDiscord: dryRunGlobal || String(process.env.DRY_RUN_DISCORD || "false").toLowerCase() === "true",
};