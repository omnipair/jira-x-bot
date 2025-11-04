import { cfg } from "./config";

interface DiscordEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: {
    text: string;
    icon_url?: string;
    proxy_icon_url?: string;
  };
  image?: {
    url: string;
    proxy_url?: string;
    height?: number;
    width?: number;
  };
  thumbnail?: {
    url: string;
    proxy_url?: string;
    height?: number;
    width?: number;
  };
  video?: {
    url?: string;
    proxy_url?: string;
    height?: number;
    width?: number;
  };
  provider?: {
    name?: string;
    url?: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
    proxy_icon_url?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

// --- ADD: quips + picker (no other refactors) ---
const quips = [
  "Keep that code cleaner than mainnet.",
  "Another block added to the chain of progress.",
  "Inching closer to deployment… or disaster.",
  "Commit it like you mean it.",
  "You can’t refactor life, but this’ll do.",
  "Progress confirmed. Jira’s satisfied (for now).",
  "Somewhere, a PM just smiled.",
  "This ticket’s moving faster than gas prices.",
  "In motion like a Solana transaction. ⚡",
  "Nice — fewer tickets, fewer excuses.",
  "This one’s officially not your problem anymore.",
  "Another soul freed from the backlog abyss.",
  "Jira approves. The coffee gods bless your PR.",
  "Workflow: updated. Sanity: questionable.",
  "One small step for dev, one giant leap for QA."
];
const pickRandomQuip = () => quips[Math.floor(Math.random() * quips.length)];
// --- END ADD ---

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
  // Color is 01e895
  let color = 0x01e895;
  //const toLower = to.toLowerCase().trim();
  //if (toLower === "done") {
  //  color = 0x57f287; // Green for done
  //} else if (toLower === "in progress") {
  //  color = 0xfee75c; // Yellow for in progress
  //}

  const embed: DiscordEmbed = {
    title: `Ticket ${key}`,
    color,
    fields: [
      {
        name: "🔁 Status Change",
        value: `${from} → ${to}`,
        inline: false
      },
      {
        name: "📄 Description",
        value: `${summary || "No description available"}`,
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Omnipair",
      icon_url: "https://pbs.twimg.com/profile_images/1976012477964898304/IRWypZmF_400x400.png"
    }
  };

  // --- ADD: append a quip field (1 line doing the work) ---
  // embed.fields?.push({ name: "Note", value: pickRandomQuip() });
  // --- END ADD ---

  return embed;
}
