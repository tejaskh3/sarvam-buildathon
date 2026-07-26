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

// Phase 3/4 columns: revisit scheduling, recall trajectory, topic policy.
// (ALTER guarded — runs once, no-ops after.)
for (const ddl of [
  "ALTER TABLE memories ADD COLUMN visit_count INTEGER DEFAULT 0",
  "ALTER TABLE memories ADD COLUMN last_visited TEXT",
  "ALTER TABLE memories ADD COLUMN prov_history TEXT", // e.g. 'USER_STATED,USER_ELABORATED,USER_CONFIRMED'
  "ALTER TABLE memories ADD COLUMN safe_to_use INTEGER DEFAULT 1", // 0 = family marked AVOID (C3)
]) {
  try { db.exec(ddl); } catch { /* column exists */ }
}

// B8: conflicting versions of the same fact — kept, never merged, never
// resolved with the elder. The parent memory goes UNRESOLVED and out of
// the agent's reachable context until the family settles it.
db.exec(`
CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id INTEGER NOT NULL,
  statement TEXT NOT NULL,
  canonical TEXT,
  session_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// node:sqlite finalizes module-scope statements between uses — prepare per call.
const q = new Proxy({
  findPerson: "SELECT * FROM people WHERE name_key = ?",
  createPerson: "INSERT INTO people (name, name_key) VALUES (?, ?)",
  linkSession: "INSERT OR REPLACE INTO sessions (id, person_id) VALUES (?, ?)",
  addMemory: `INSERT INTO memories (person_id, session_id, statement, canonical, category, emotional_tone, provenance, audio_file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  // agent-reachable memories: ACTIVE and not family-avoided (C3 — policy
  // enforced at retrieval; the model never sees filtered rows)
  memoriesFor: "SELECT * FROM memories WHERE person_id = ? AND status = 'ACTIVE' AND safe_to_use = 1 ORDER BY created_at DESC LIMIT 40",
  allMemoriesFor: "SELECT * FROM memories WHERE person_id = ? ORDER BY created_at DESC LIMIT 100",
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
    // dedup against everything (incl. UNRESOLVED/SUPERSEDED) so a third
    // conflicting answer versions the same memory instead of forking a new one
    const existing = q.allMemoriesFor.all(personId).filter((m) => m.status !== "SUPERSEDED");
    const norm = (s) => (s || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").trim();
    const tokens = (s) => new Set(norm(s).split(/\s+/).filter((w) => w.length > 2));
    const ratio = (a, b) => {
      const A = tokens(a), B = tokens(b);
      if (!A.size || !B.size) return 0;
      let hit = 0;
      for (const w of A) if (B.has(w)) hit++;
      return hit / Math.min(A.size, B.size);
    };
    for (const f of facts) {
      // canonical (English) paraphrases drift wildly between extractions —
      // compare canonical↔canonical AND statement↔statement, take the best
      const dup = existing.find(
        (m) => Math.max(ratio(f.canonical, m.canonical), ratio(f.statement, m.statement)) >= 0.6
      );
      if (dup) {
        if ((f.provenance || "") === "USER_CORRECTED") {
          // B4: she overruled the record — old value SUPERSEDED (kept,
          // inspectable), corrected value becomes the ACTIVE memory.
          db.prepare("UPDATE memories SET status = 'SUPERSEDED' WHERE id = ?").run(dup.id);
          q.addMemory.run(
            personId, sessionId,
            f.statement || "", f.canonical || "", f.category || dup.category,
            f.emotional_tone || dup.emotional_tone, "USER_CORRECTED", audioFile || null
          );
          db.prepare("UPDATE memories SET prov_history = ? WHERE person_id = ? AND status='ACTIVE' AND canonical = ?")
            .run((dup.prov_history || dup.provenance) + ",USER_CORRECTED", personId, f.canonical || "");
          console.log(`[supersede] "${dup.statement}" → "${f.statement}"`);
          continue;
        }
        // B8: same fact, different numbers → a contradiction, not a retelling.
        // Version it silently; block the fact until the family resolves it.
        const NUMWORD = /\d+|एक|दो|तीन|चार|पांच|छह|सात|आठ|\b(do|teen|char|paanch|chhah|saat|aath|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi;
        const nums = (s) => (((s || "").match(NUMWORD)) || []).map((x) => x.toLowerCase()).sort().join(",");
        const dupNums = nums((dup.canonical || "") + " " + (dup.statement || ""));
        const newNums = nums((f.canonical || "") + " " + (f.statement || ""));
        if (dupNums && newNums && dupNums !== newNums) {
          db.prepare("INSERT INTO variants (memory_id, statement, canonical, session_id) VALUES (?, ?, ?, ?)")
            .run(dup.id, f.statement || "", f.canonical || "", sessionId);
          db.prepare("UPDATE memories SET status = 'UNRESOLVED' WHERE id = ?").run(dup.id);
          console.log(`[variance] UNRESOLVED: "${dup.statement}" vs "${f.statement}" — routed to family, blocked from agent`);
          continue;
        }
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

  // inspector view: everything, with variants attached
  inspectMemories(personId) {
    const rows = q.allMemoriesFor.all(personId);
    const getVars = db.prepare("SELECT * FROM variants WHERE memory_id = ? ORDER BY created_at");
    return rows.map((m) => ({ ...m, variants: getVars.all(m.id) }));
  },

  // C3: family marks a memory unreachable — enforced in the retrieval query
  setPolicy(memoryId, avoid) {
    db.prepare("UPDATE memories SET safe_to_use = ? WHERE id = ?").run(avoid ? 0 : 1, memoryId);
  },

  // B9: family settles an UNRESOLVED conflict. keep='original' re-activates
  // the stored value; keep=<variant id> promotes that variant. Either way
  // the result is FAMILY-grade truth and the losers stay inspectable.
  resolve(memoryId, keep) {
    const m = db.prepare("SELECT * FROM memories WHERE id = ?").get(memoryId);
    if (!m) return false;
    if (keep === "original") {
      db.prepare("UPDATE memories SET status = 'ACTIVE', provenance = 'FAMILY_VERIFIED' WHERE id = ?").run(memoryId);
    } else {
      const v = db.prepare("SELECT * FROM variants WHERE id = ? AND memory_id = ?").get(Number(keep), memoryId);
      if (!v) return false;
      db.prepare("UPDATE memories SET status = 'SUPERSEDED' WHERE id = ?").run(memoryId);
      db.prepare(
        `INSERT INTO memories (person_id, session_id, statement, canonical, category, emotional_tone, provenance, audio_file, safe_to_use)
         VALUES (?, ?, ?, ?, ?, ?, 'FAMILY_VERIFIED', NULL, ?)`
      ).run(m.person_id, v.session_id, v.statement, v.canonical, m.category, m.emotional_tone, m.safe_to_use);
    }
    return true;
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
