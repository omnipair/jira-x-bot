import express from "express";
import { cfg } from "./config";
import { alreadyPosted, markPosted } from "./store";
import { tweet } from "./twitter";
import { sendDiscordEmbed, createTicketEmbed } from "./discord";
import { dbOps } from "./db";
import { mkdirSync, appendFileSync } from "fs";
import crypto from "crypto";

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
    const sig = req.header("x-hub-signature"); // Jira webhook signature
    if (!sig) {
      console.error("[SECURITY] Webhook signature required but not provided in request");
      console.error("  Available headers:", Object.keys(req.headers).join(", ") || "none");
      return res.status(401).json({ ok: false, reason: "signature required" });
    }

    const raw = req.rawBody as Buffer | undefined;
    if (!raw) {
      console.error("[SECURITY] Missing rawBody; cannot verify signature");
      return res.status(500).json({ ok: false, reason: "server misconfigured (rawBody missing)" });
    }

    const expected = crypto
      .createHmac("sha256", cfg.webhookSecret)
      .update(raw)
      .digest("hex");

    // Some systems prefix signatures; Jira’s is commonly just hex.
    const received = String(sig).trim();

    if (received !== expected) {
      console.error("[SECURITY] Webhook signature mismatch");
      return res.status(401).json({ ok: false, reason: "signature mismatch" });
    }

    console.log("[SECURITY] Webhook signature validated successfully");
  }

  res.status(200).json({ ok: true });

  console.log("---- JIRA WEBHOOK ----");
  console.log("UA:", req.headers["user-agent"], "CT:", req.headers["content-type"]);
  await logWebhook(req.body);

  try {
    const { webhookEvent, issue, changelog } = (req as any).body || {};
    if (!issue?.key) return;

    // Filter out tickets with Security or Blocked labels
    const labels = issue?.fields?.labels || [];
    const labelNames = labels.map((l: string) => l.toLowerCase().trim());
    if (labelNames.includes("security") || labelNames.includes("blocked")) {
      return console.log(`Ignoring ticket ${issue.key} with excluded label(s): ${labels.join(", ")}`);
    }

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
    
    // Track transitions FROM "In Progress" OR transitions TO "Done" OR transitions TO "In Progress" OR transitions TO "Complete"
    const fromLower = from.toLowerCase().trim();
    const toLower = to.toLowerCase().trim();
    const isFromInProgress = fromLower === "in progress";
    const isToDone = toLower === "done";
    const isToInProgress = toLower === "in progress";
    const isToComplete = toLower === "complete";
    
    if (!isFromInProgress && !isToDone && !isToInProgress && !isToComplete) {
      return console.log(`Ignoring transition: ${from} → ${to}`);
    }

    const key = issue.key as string;
    const summary = issue.fields?.summary || "";

    const dedupId = `${key}:${from}->${to}`;
    if (await alreadyPosted(dedupId)) return console.log("Already posted", dedupId);

    let tweetResult = { ok: false, error: "X disabled" } as const;
    let discordResult = { ok: false, error: "Discord disabled" } as const;

    // Post to X if enabled
    if (cfg.enableX) {
      const hashtags = cfg.tweetHashtags ? `\n\n${cfg.tweetHashtags}` : "";
      const text = `🔁 ${key}: ${from} → ${to}\n📄 Description: ${summary}${hashtags}`.slice(0, 280);
      tweetResult = await tweet(text);
    } else {
      console.log(`[X] X posting is disabled; skipping tweet for ${dedupId}`);
    }
    
    // Send Discord embed if enabled
    if (cfg.enableDiscord) {
      const embed = createTicketEmbed(key, summary, from, to);
      discordResult = await sendDiscordEmbed(embed);
    } else {
      console.log(`[DISCORD] Discord posting is disabled; skipping notification for ${dedupId}`);
    }
    
    // Mark as posted if at least one enabled service succeeded
    // If both are disabled, still mark as posted to avoid duplicate processing
    if (tweetResult.ok || discordResult.ok || (!cfg.enableX && !cfg.enableDiscord)) {
      await markPosted(dedupId, key, from, to);
      console.log(`Successfully processed ${dedupId}`);
    } else {
      console.error(`All enabled services failed for ${dedupId}`);
      if (!tweetResult.ok && cfg.enableX) {
        console.error(`  X error:`, tweetResult.error);
      }
      if (!discordResult.ok && cfg.enableDiscord) {
        console.error(`  Discord error:`, discordResult.error);
      }
    }
  } catch (e: any) {
    console.error("Handler error:", e?.message || e);
  }
});

app.listen(cfg.port, () => {
  console.log(`Jira webhook server listening on :${cfg.port}`);
});
