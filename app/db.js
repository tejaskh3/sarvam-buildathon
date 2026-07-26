// Yaadein memory store — Phase 2.
// SQLite via node:sqlite (zero npm deps; needs --experimental-sqlite on Node 22).
// This IS the product: provenance-graded, per-person, survives restarts.

const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(path.join(DATA_DIR, "audio"), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "yaadein.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,      -- lowercase match key
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  person_id INTEGER,
  started_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  session_id TEXT,
  statement TEXT NOT NULL,            -- as they said it (native)
  canonical TEXT,                     -- one-line english meaning
  category TEXT,                      -- place|person|food|festival|life_event|preference|other
  emotional_tone TEXT,                -- positive|neutral|negative
  provenance TEXT NOT NULL,           -- USER_STATED|USER_CONFIRMED|USER_ELABORATED|USER_CORRECTED
  audio_file TEXT,                    -- turn recording this came from
  status TEXT DEFAULT 'ACTIVE',       -- ACTIVE|SUPERSEDED
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS open_loops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  topic TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN',         -- OPEN|CLOSED
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Phase 3 columns: revisit scheduling + passive recall trajectory.
// (ALTER guarded — runs once, no-ops after.)
for (const ddl of [
  "ALTER TABLE memories ADD COLUMN visit_count INTEGER DEFAULT 0",
  "ALTER TABLE memories ADD COLUMN last_visited TEXT",
  "ALTER TABLE memories ADD COLUMN prov_history TEXT", // e.g. 'USER_STATED,USER_ELABORATED,USER_CONFIRMED'
]) {
  try { db.exec(ddl); } catch { /* column exists */ }
}

// node:sqlite finalizes module-scope statements between uses — prepare per call.
const q = new Proxy({
  findPerson: "SELECT * FROM people WHERE name_key = ?",
  createPerson: "INSERT INTO people (name, name_key) VALUES (?, ?)",
  linkSession: "INSERT OR REPLACE INTO sessions (id, person_id) VALUES (?, ?)",
  addMemory: `INSERT INTO memories (person_id, session_id, statement, canonical, category, emotional_tone, provenance, audio_file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  memoriesFor: "SELECT * FROM memories WHERE person_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 40",
  people: "SELECT p.*, (SELECT COUNT(*) FROM memories m WHERE m.person_id = p.id) AS memory_count FROM people p ORDER BY p.created_at DESC",
  addLoop: "INSERT INTO open_loops (person_id, topic) VALUES (?, ?)",
  closeLoops: "UPDATE open_loops SET status='CLOSED' WHERE person_id = ? AND status='OPEN'",
  openLoopFor: "SELECT * FROM open_loops WHERE person_id = ? AND status='OPEN' ORDER BY created_at DESC LIMIT 1",
}, { get: (sqls, name) => db.prepare(sqls[name]) });

function keyOf(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

module.exports = {
  DATA_DIR,

  findPerson(name) {
    return q.findPerson.get(keyOf(name)) || null;
  },

  findOrCreatePerson(name) {
    const key = keyOf(name);
    let p = q.findPerson.get(key);
    let returning = true;
    if (!p) {
      q.createPerson.run(name.trim(), key);
      p = q.findPerson.get(key);
      returning = false;
    }
    return { person: p, returning };
  },

  linkSession(sessionId, personId) {
    q.linkSession.run(sessionId, personId);
  },

  // Dedup + recall trajectory: a re-told fact doesn't duplicate — it appends
  // its provenance grade to prov_history. A slide from ELABORATED → CONFIRMED
  // over visits = the memory is getting harder (observed, never elicited).
  saveMemories(personId, sessionId, facts, audioFile) {
    const existing = q.memoriesFor.all(personId);
    const norm = (s) => (s || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").trim();
    const tokens = (s) => new Set(norm(s).split(/\s+/).filter((w) => w.length > 2));
    for (const f of facts) {
      const fTok = tokens(f.canonical || f.statement);
      const dup = existing.find((m) => {
        const mTok = tokens(m.canonical || m.statement);
        if (!fTok.size || !mTok.size) return false;
        let hit = 0;
        for (const w of fTok) if (mTok.has(w)) hit++;
        return hit / Math.min(fTok.size, mTok.size) >= 0.6;
      });
      if (dup) {
        const hist = (dup.prov_history || dup.provenance) + "," + (f.provenance || "USER_STATED");
        db.prepare("UPDATE memories SET prov_history = ?, visit_count = visit_count + 1, last_visited = datetime('now') WHERE id = ?")
          .run(hist, dup.id);
        continue;
      }
      q.addMemory.run(
        personId, sessionId,
        f.statement || "", f.canonical || "", f.category || "other",
        f.emotional_tone || "neutral",
        f.provenance || "USER_STATED",
        audioFile || null
      );
    }
  },

  // Revisit scheduler: joy-weighted, least-recently-visited first.
  // Marks the picks as visited so the same suggestion isn't reused next session.
  dueMemories(personId, limit = 3) {
    const due = db.prepare(
      `SELECT * FROM memories WHERE person_id = ? AND status = 'ACTIVE'
       ORDER BY (emotional_tone = 'positive') DESC,
                COALESCE(last_visited, '1970') ASC,
                visit_count ASC
       LIMIT ?`
    ).all(personId, limit);
    if (due.length) {
      const ids = due.map((m) => m.id).join(",");
      db.exec(`UPDATE memories SET visit_count = visit_count + 1, last_visited = datetime('now') WHERE id IN (${ids})`);
    }
    return due;
  },

  memoriesFor(personId) {
    return q.memoriesFor.all(personId);
  },

  setOpenLoop(personId, topic) {
    q.closeLoops.run(personId);
    if (topic) q.addLoop.run(personId, topic);
  },

  openLoopFor(personId) {
    return q.openLoopFor.get(personId);
  },

  people() {
    return q.people.all();
  },
};
