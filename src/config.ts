import "dotenv/config";

export const cfg = {
  port: Number(process.env.PORT || 8080),
  projectKey: process.env.JIRA_PROJECT_KEY || "",
  webhookSecret: process.env.JIRA_WEBHOOK_SECRET || "",
  xAccessToken: process.env.X_ACCESS_TOKEN || "",
  dryRun: String(process.env.DRY_RUN || "false").toLowerCase() === "true",
};