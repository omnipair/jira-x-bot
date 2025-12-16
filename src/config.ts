import "dotenv/config";

const dryRunGlobal = String(process.env.DRY_RUN || "false").toLowerCase() === "true";
export const cfg = {
  port: Number(process.env.PORT || 8080),
  projectKey: process.env.JIRA_PROJECT_KEY || "",
  webhookSecret: (process.env.JIRA_WEBHOOK_SECRET || "").trim(),
  // OAuth 1.0a credentials (4 tokens)
  xApiKey: (process.env.X_API_KEY || "").trim(),
  xApiSecret: (process.env.X_API_SECRET || "").trim(),
  xAccessToken: (process.env.X_ACCESS_TOKEN || "").trim(),
  xAccessTokenSecret: (process.env.X_ACCESS_TOKEN_SECRET || "").trim(),
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  dryRunTwitter: dryRunGlobal || String(process.env.DRY_RUN_TWITTER || "false").toLowerCase() === "true",
  dryRunDiscord: dryRunGlobal || String(process.env.DRY_RUN_DISCORD || "false").toLowerCase() === "true",
  // Feature toggles (set to "false" to completely disable)
  enableX: String(process.env.ENABLE_X || "true").toLowerCase() !== "false",
  enableDiscord: String(process.env.ENABLE_DISCORD || "true").toLowerCase() !== "false",
  // Branding configuration
  brandName: process.env.BRAND_NAME || "",
  brandIconUrl: process.env.BRAND_ICON_URL || "",
  tweetHashtags: process.env.TWEET_HASHTAGS || "",
};