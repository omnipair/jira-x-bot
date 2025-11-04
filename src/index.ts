import express from "express";
import { cfg } from "./config";
import { alreadyPosted, markPosted } from "./store";
import { tweet } from "./twitter";
import { sendDiscordEmbed, createTicketEmbed } from "./discord";
import { dbOps } from "./db";
import { mkdirSync, appendFileSync } from "fs";

const app = express();
app.use(express.json({ type: ["application/json", "application/*+json"] }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "jira-x-bot" }));

// Debug endpoint to view recent webhook events from database
app.get("/webhooks/recent", async (_req, res) => {
  try {
    const limit = parseInt(_req.query.limit as string) || 20;
    const events = await dbOps.getRecentEvents(limit);
    res.json({ ok: true, count: events.length, events });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || e });
  }
});

async function logWebhook(payload: any) {
  try {
    // Only extract essential data needed for posts
    const { webhookEvent, issue, changelog } = payload || {};
    const statusChange = Array.isArray(changelog?.items)
      ? changelog.items.find((it: any) => it.field === "status")
      : null;
    
    const essentialData = {
      timestamp: new Date().toISOString(),
      webhookEvent,
      issueKey: issue?.key || null,
      summary: issue?.fields?.summary || null,
      fromStatus: statusChange?.fromString || null,
      toStatus: statusChange?.toString || null,
    };
    
    // Save to database
    await dbOps.recordWebhookEvent(essentialData);
    
    // Also keep a simple JSON log for quick inspection (optional)
    mkdirSync("./data", { recursive: true });
    appendFileSync(
      "./data/last-webhook.json",
      JSON.stringify(essentialData, null, 2) + "\n\n"
    );
  } catch (e: any) {
    console.error("Error logging webhook:", e?.message || e);
  }
}

app.post("/webhooks/jira", async (req, res) => {
  if (cfg.webhookSecret) {
    const h = req.header("X-Webhook-Secret") || req.header("x-webhook-secret");
    if (h !== cfg.webhookSecret) return res.status(401).json({ ok: false, reason: "secret mismatch" });
  }

  res.status(200).json({ ok: true });

  console.log("---- JIRA WEBHOOK ----");
  console.log("UA:", req.headers["user-agent"], "CT:", req.headers["content-type"]);
  await logWebhook(req.body);

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
    
    // Track transitions FROM "In Progress" OR transitions TO "Done" OR transitions TO "In Progress"
    const fromLower = from.toLowerCase().trim();
    const toLower = to.toLowerCase().trim();
    const isFromInProgress = fromLower === "in progress";
    const isToDone = toLower === "done";
    const isToInProgress = toLower === "in progress";
    
    if (!isFromInProgress && !isToDone && !isToInProgress) {
      return console.log(`Ignoring transition: ${from} → ${to}`);
    }

    const key = issue.key as string;
    const summary = issue.fields?.summary || "";

    const dedupId = `${key}:${from}->${to}`;
    if (await alreadyPosted(dedupId)) return console.log("Already posted", dedupId);

    const text = `🔁 ${key}: ${from} → ${to}\n📄 Description: ${summary}\n\n#Omnipair #Futarchy`.slice(0, 280);
    const tweetResult = await tweet(text);
    
    // Send Discord embed regardless of tweet success/failure
    const embed = createTicketEmbed(key, summary, from, to);
    const discordResult = await sendDiscordEmbed(embed);
    
    // Only mark as posted if tweet succeeded
    if (tweetResult.ok) {
      await markPosted(dedupId, key, from, to);
      console.log(`Successfully posted ${dedupId}`);
    } else {
      console.error(`Tweet failed for ${dedupId}:`, tweetResult.error);
      // Log Discord status too
      if (!discordResult.ok) {
        console.error(`Discord also failed for ${dedupId}:`, discordResult.error);
      } else {
        console.log(`Discord notification sent successfully for ${dedupId} (tweet failed)`);
      }
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
