import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";

const DB_PATH = "./data/jira-bot.db";

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma("journal_mode = WAL");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    webhook_event TEXT,
    issue_key TEXT,
    summary TEXT,
    from_status TEXT,
    to_status TEXT
  );

  CREATE TABLE IF NOT EXISTS posted_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dedup_id TEXT UNIQUE NOT NULL,
    posted_at TEXT NOT NULL,
    issue_key TEXT,
    from_status TEXT,
    to_status TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_webhook_events_timestamp ON webhook_events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_webhook_events_issue_key ON webhook_events(issue_key);
  CREATE INDEX IF NOT EXISTS idx_posted_items_dedup_id ON posted_items(dedup_id);
`);

// Prepared statements for better performance
const insertWebhookEvent = db.prepare(`
  INSERT INTO webhook_events (timestamp, webhook_event, issue_key, summary, from_status, to_status)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertPostedItem = db.prepare(`
  INSERT INTO posted_items (dedup_id, posted_at, issue_key, from_status, to_status)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(dedup_id) DO NOTHING
`);

const checkPosted = db.prepare(`
  SELECT 1 FROM posted_items WHERE dedup_id = ? LIMIT 1
`);

const getRecentWebhookEvents = db.prepare(`
  SELECT * FROM webhook_events 
  ORDER BY timestamp DESC 
  LIMIT ?
`);

// Export database operations
export const dbOps = {
  // Record a webhook event (simplified data)
  recordWebhookEvent(data: {
    timestamp: string;
    webhookEvent?: string;
    issueKey?: string;
    summary?: string;
    fromStatus?: string;
    toStatus?: string;
  }) {
    insertWebhookEvent.run(
      data.timestamp,
      data.webhookEvent || null,
      data.issueKey || null,
      data.summary || null,
      data.fromStatus || null,
      data.toStatus || null
    );
  },

  // Check if an item was already posted
  isPosted(dedupId: string): boolean {
    const result = checkPosted.get(dedupId);
    return result !== undefined;
  },

  // Mark an item as posted
  markPosted(data: {
    dedupId: string;
    issueKey: string;
    fromStatus: string;
    toStatus: string;
  }) {
    insertPostedItem.run(
      data.dedupId,
      new Date().toISOString(),
      data.issueKey,
      data.fromStatus,
      data.toStatus
    );
  },

  // Get recent webhook events (for debugging/review)
  getRecentEvents(limit: number = 10) {
    return getRecentWebhookEvents.all(limit);
  },

  // Close database connection (useful for graceful shutdown)
  close() {
    db.close();
  },
};

