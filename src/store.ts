import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

const FILE = "./data/posted.json";
type DB = { postedIds: string[] };

function ensureFile() {
  if (!existsSync(FILE)) {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify({ postedIds: [] } as DB, null, 2), "utf8");
  }
}
function readDB(): DB {
  try {
    ensureFile();
    const raw = readFileSync(FILE, "utf8");
    return (raw ? JSON.parse(raw) : { postedIds: [] }) as DB;
  } catch {
    return { postedIds: [] };
  }
}
function writeDB(db: DB) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(db, null, 2), "utf8");
}

export function alreadyPosted(id: string): boolean {
  if (!id) return false;
  return readDB().postedIds.includes(id);
}
export function markPosted(id: string): void {
  if (!id) return;
  const db = readDB();
  if (!db.postedIds.includes(id)) {
    db.postedIds.push(id);
    if (db.postedIds.length > 5000) db.postedIds = db.postedIds.slice(-2000);
    writeDB(db);
  }
}
