import express from "express";
import { cfg } from "./config";
import { alreadyPosted, markPosted } from "./store";
import { tweet } from "./twitter";
import { sendDiscordEmbed, createTicketEmbed } from "./discord";
import { mkdirSync, appendFileSync } from "fs";

const app = express();
app.use(express.json({ type: ["application/json", "application/*+json"] }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "jira-x-bot" }));

function logWebhook(payload: any, headers: any) {
  try {
    mkdirSync("./data", { recursive: true });
    appendFileSync(
      "./data/last-webhook.json",
      JSON.stringify({ at: new Date().toISOString(), headers, payload }, null, 2) + "\n\n"
    );
  } catch {}
}

app.post("/webhooks/jira", async (req, res) => {
  if (cfg.webhookSecret) {
    const h = req.header("X-Webhook-Secret") || req.header("x-webhook-secret");
    if (h !== cfg.webhookSecret) return res.status(401).json({ ok: false, reason: "secret mismatch" });
  }

  res.status(200).json({ ok: true });

  console.log("---- JIRA WEBHOOK ----");
  console.log("UA:", req.headers["user-agent"], "CT:", req.headers["content-type"]);
  logWebhook(req.body, req.headers);

  try {
    const { webhookEvent, issue, changelog } = (req as any).body || {};
    if (!issue?.key) return;

    const proj = issue?.fields?.project?.key;
    if (cfg.projectKey && proj && proj !== cfg.projectKey) {
      return console.log("Ignoring project:", proj);
    }

    const isUpdate = webhookEvent === "jira:issue_updated";
    const statusChange = Array.isArray(changelog?.items)
      ? changelog.items.find((it: any) => it.field === "status")
      : null;
    if (!isUpdate) return console.log("Not an issue update event; ignoring");
    if (!statusChange) {
      const changedFields = changelog?.items?.map((it: any) => it.field).join(", ") || "none";
      return console.log(`No status change; ignoring (changed fields: ${changedFields})`);
    }

    const from = statusChange.fromString || "Unknown";
    const to = statusChange.toString || issue?.fields?.status?.name || "Unknown";
    
    // Track transitions FROM "In Progress" OR transitions TO "Done"
    const fromLower = from.toLowerCase().trim();
    const toLower = to.toLowerCase().trim();
    const isFromInProgress = fromLower === "in progress";
    const isToDone = toLower === "done";
    
    if (!isFromInProgress && !isToDone) {
      return console.log(`Ignoring transition: ${from} → ${to}`);
    }

    const key = issue.key as string;
    const summary = issue.fields?.summary || "";

    const dedupId = `${key}:${from}->${to}`;
    if (alreadyPosted(dedupId)) return console.log("Already posted", dedupId);

    const text = `${key} moved ${from} → ${to} — ${summary}`.slice(0, 280);
    const r = await tweet(text);
    if ((r as any).ok) {
      markPosted(dedupId);
      
      // Send Discord embed (separate from tweet, same info)
      const embed = createTicketEmbed(key, summary, from, to);
      await sendDiscordEmbed(embed);
    }
  } catch (e: any) {
    console.error("Handler error:", e?.message || e);
  }
});

app.listen(cfg.port, () => {
  console.log(`Jira webhook server listening on :${cfg.port}`);
  console.log(`Health: http://localhost:${cfg.port}/health`);
  console.log(`Webhook: POST http://localhost:${cfg.port}/webhooks/jira`);
});
