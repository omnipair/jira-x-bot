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
  };

  // Add footer only if branding is configured
  if (cfg.brandName) {
    embed.footer = {
      text: cfg.brandName,
      ...(cfg.brandIconUrl && { icon_url: cfg.brandIconUrl })
    };
  }

  return embed;
}
