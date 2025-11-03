import sqlite3 from "sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { promisify } from "util";

const DB_PATH = "./data/jira-bot.db";

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

// Create database instance
const db = new sqlite3.Database(DB_PATH);

// Promisify database methods for easier async/await usage
const dbRun = promisify(db.run.bind(db)) as (...args: any[]) => Promise<any>;
const dbGet = promisify(db.get.bind(db)) as (...args: any[]) => Promise<any>;
const dbAll = promisify(db.all.bind(db)) as (...args: any[]) => Promise<any>;
const dbClose = promisify(db.close.bind(db)) as () => Promise<void>;

// Helper to promisify db.exec (has different callback signature)
const dbExec = (sql: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Initialize database (run once on module load)
(async () => {
  try {
    // Enable WAL mode for better concurrent access
    await dbRun(`PRAGMA journal_mode = WAL`);

    // Create tables if they don't exist
    await dbExec(`
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
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
})();

// Export database operations
export const dbOps = {
  // Record a webhook event (simplified data)
  async recordWebhookEvent(data: {
    timestamp: string;
    webhookEvent?: string;
    issueKey?: string;
    summary?: string;
    fromStatus?: string;
    toStatus?: string;
  }) {
    await dbRun(
      `INSERT INTO webhook_events (timestamp, webhook_event, issue_key, summary, from_status, to_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      data.timestamp,
      data.webhookEvent || null,
      data.issueKey || null,
      data.summary || null,
      data.fromStatus || null,
      data.toStatus || null
    );
  },

  // Check if an item was already posted
  async isPosted(dedupId: string): Promise<boolean> {
    const result = await dbGet(
      `SELECT 1 FROM posted_items WHERE dedup_id = ? LIMIT 1`,
      dedupId
    );
    return result !== undefined;
  },

  // Mark an item as posted
  async markPosted(data: {
    dedupId: string;
    issueKey: string;
    fromStatus: string;
    toStatus: string;
  }) {
    await dbRun(
      `INSERT INTO posted_items (dedup_id, posted_at, issue_key, from_status, to_status)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(dedup_id) DO NOTHING`,
      data.dedupId,
      new Date().toISOString(),
      data.issueKey,
      data.fromStatus,
      data.toStatus
    );
  },

  // Get recent webhook events (for debugging/review)
  async getRecentEvents(limit: number = 10) {
    return await dbAll(
      `SELECT * FROM webhook_events 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      limit
    );
  },

  // Close database connection (useful for graceful shutdown)
  async close() {
    await dbClose();
  },
};