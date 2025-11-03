import { cfg } from "./config";

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;
  footer?: { text: string };
}

export async function sendDiscordEmbed(embed: DiscordEmbed) {
  if (cfg.dryRunDiscord) {
    console.log("[DRY_RUN_DISCORD] Would send Discord embed:", JSON.stringify(embed, null, 2));
    return { ok: true } as const;
  }
  if (!cfg.discordWebhookUrl) {
    console.log("[DISCORD] No webhook URL configured; skipping");
    return { ok: true } as const; // Don't fail if Discord isn't configured
  }

  try {
    const res = await fetch(cfg.discordWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ embeds: [embed] })
    });

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { text };
    }

    if (!res.ok) {
      console.error("Discord webhook failed:", res.status, res.statusText, json);
      return { ok: false, error: json } as const;
    }
    console.log("Discord embed sent successfully");
    return { ok: true, ...json } as const;
  } catch (e: any) {
    console.error("Discord webhook error:", e?.message || e);
    return { ok: false, error: e?.message || String(e) } as const;
  }
}

export function createTicketEmbed(
  key: string,
  summary: string,
  from: string,
  to: string
): DiscordEmbed {
  // Choose color based on status transition
  let color = 0x5865f2; // Default Discord blurple
  const toLower = to.toLowerCase().trim();
  if (toLower === "done") {
    color = 0x57f287; // Green for done
  } else if (toLower === "in progress") {
    color = 0xfee75c; // Yellow for in progress
  }

  const embed: DiscordEmbed = {
    title: `Ticket ${key}`,
    description: summary || "No summary available",
    color,
    fields: [
      {
        name: "Status Change",
        value: `${from} → ${to}`,
        inline: true
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Jira → X Bot"
    }
  };

  return embed;
}

