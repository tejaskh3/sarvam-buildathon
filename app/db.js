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
  "ALTER TABLE people ADD COLUMN lang TEXT", // last detected language → next session opens in it
  "ALTER TABLE people ADD COLUMN phone TEXT", // allowlisted 10-digit number this person belongs to
]) {
  try { db.exec(ddl); } catch { /* column exists */ }
}

// Phase 6: family-uploaded photos with context. Family context is the
// source of truth (Sarvam Vision is a document OCR, not a photo captioner
// — decision logged in docs/DECISIONS.md). Deceased flags are REQUIRED
// per person in the frame (F2): past tense only, never used as prompts.
db.exec(`
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  file TEXT NOT NULL,
  event TEXT,
  place TEXT,
  year TEXT,
  people_json TEXT,                    -- [{name, relation, deceased, elder_knows}]
  notes TEXT,
  status TEXT DEFAULT 'NEW',           -- NEW|SHOWN
  created_at TEXT DEFAULT (datetime('now'))
);
`);
fs.mkdirSync(path.join(DATA_DIR, "photos"), { recursive: true });

// Recall-difficulty tracking (mentor feedback, 26 Jul): every voice turn
// stores the question asked and how long the elder took to START answering
// (measured in the browser: end of agent audio → first voiced frame).
// Long pauses = the question was hard — surfaced as alerts + a trend graph.
db.exec(`
CREATE TABLE IF NOT EXISTS turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  session_id TEXT,
  question TEXT,
  answer TEXT,
  delay_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

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
  createPerson: "INSERT INTO people (name, name_key, phone) VALUES (?, ?, ?)",
  linkSession: "INSERT OR REPLACE INTO sessions (id, person_id) VALUES (?, ?)",
  addMemory: `INSERT INTO memories (person_id, session_id, statement, canonical, category, emotional_tone, provenance, audio_file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  // agent-reachable memories: ACTIVE and not family-avoided (C3 — policy
  // enforced at retrieval; the model never sees filtered rows)
  memoriesFor: "SELECT * FROM memories WHERE person_id = ? AND status = 'ACTIVE' AND safe_to_use = 1 ORDER BY created_at DESC LIMIT 40",
  allMemoriesFor: "SELECT * FROM memories WHERE person_id = ? ORDER BY created_at DESC LIMIT 100",
  people: "SELECT p.*, (SELECT COUNT(*) FROM memories m WHERE m.person_id = p.id) AS memory_count FROM people p ORDER BY p.created_at DESC",
  peopleFor: "SELECT p.*, (SELECT COUNT(*) FROM memories m WHERE m.person_id = p.id) AS memory_count FROM people p WHERE p.phone = ? ORDER BY p.created_at DESC",
  addLoop: "INSERT INTO open_loops (person_id, topic) VALUES (?, ?)",
  closeLoops: "UPDATE open_loops SET status='CLOSED' WHERE person_id = ? AND status='OPEN'",
  openLoopFor: "SELECT * FROM open_loops WHERE person_id = ? AND status='OPEN' ORDER BY created_at DESC LIMIT 1",
}, { get: (sqls, name) => db.prepare(sqls[name]) });

// Identity = the phone number, nothing else (Tejas, 26 Jul). One allowlisted
// number = one elder = one memory store, and the same number opens the family
// portal. The name is just what Yaadein calls them, learned in the first
// session. Multi-user-per-number arrives with real auth, post-hackathon.
module.exports = {
  DATA_DIR,

  findPersonByPhone(phone) {
    return q.findPerson.get(String(phone)) || null;
  },

  findOrCreatePerson(name, phone) {
    const key = String(phone);
    let p = q.findPerson.get(key);
    let returning = true;
    if (!p) {
      q.createPerson.run(name.trim(), key, key);
      p = q.findPerson.get(key);
      returning = false;
    }
    return { person: p, returning };
  },

  // demo/test reset: wipe everything an allowlisted number has accumulated
  resetPhone(phone) {
    const p = q.findPerson.get(String(phone));
    if (!p) return false;
    db.prepare("DELETE FROM variants WHERE memory_id IN (SELECT id FROM memories WHERE person_id = ?)").run(p.id);
    for (const t of ["memories", "open_loops", "turns", "photos"]) {
      db.prepare(`DELETE FROM ${t} WHERE person_id = ?`).run(p.id);
    }
    db.prepare("DELETE FROM sessions WHERE person_id = ?").run(p.id);
    db.prepare("DELETE FROM people WHERE id = ?").run(p.id);
    return true;
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

  people(phone) {
    return phone ? q.peopleFor.all(phone) : q.people.all();
  },

  setPersonLang(personId, lang) {
    db.prepare("UPDATE people SET lang = ? WHERE id = ?").run(lang, personId);
  },

  addPhoto(personId, file, meta) {
    db.prepare(
      "INSERT INTO photos (person_id, file, event, place, year, people_json, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(personId, file, meta.event || "", meta.place || "", meta.year || "", JSON.stringify(meta.people || []), meta.notes || "");
  },

  photosFor(personId) {
    return db.prepare("SELECT * FROM photos WHERE person_id = ? ORDER BY created_at DESC").all(personId);
  },

  // next undiscussed photo — only if every person in frame has a resolved
  // deceased flag (F2: unresolved status ⇒ held back from sessions)
  nextNewPhoto(personId) {
    const rows = db.prepare("SELECT * FROM photos WHERE person_id = ? AND status = 'NEW' ORDER BY created_at ASC").all(personId);
    return rows.find((p) => {
      try {
        return JSON.parse(p.people_json || "[]").every((x) => typeof x.deceased === "boolean");
      } catch { return false; }
    }) || null;
  },

  markPhotoShown(photoId) {
    db.prepare("UPDATE photos SET status = 'SHOWN' WHERE id = ?").run(photoId);
  },

  addTurn(personId, sessionId, question, answer, delayMs) {
    db.prepare("INSERT INTO turns (person_id, session_id, question, answer, delay_ms) VALUES (?, ?, ?, ?, ?)")
      .run(personId, sessionId, question || null, answer || null, delayMs == null ? null : Math.round(delayMs));
  },

  // Alerts + planning graph for the family:
  //  - alerts: questions that took long to answer (≥4s pause = hard, ≥7s = very hard)
  //  - fading: memories whose recall trajectory slid to bare confirmation
  //  - series: per-session averages the dashboard draws as a trend line
  signals(personId) {
    const SLOW = 4000, VERY_SLOW = 7000;
    const alerts = db.prepare(
      `SELECT question, answer, delay_ms, created_at FROM turns
       WHERE person_id = ? AND delay_ms >= ? ORDER BY created_at DESC LIMIT 8`
    ).all(personId, SLOW).map((t) => ({ ...t, severity: t.delay_ms >= VERY_SLOW ? "high" : "medium" }));
    const fading = db.prepare(
      "SELECT id, statement, canonical, prov_history, visit_count FROM memories WHERE person_id = ? AND status = 'ACTIVE'"
    ).all(personId).filter((m) => {
      const h = (m.prov_history || "").split(",").filter(Boolean);
      // told richly before, now only confirms when it comes up = getting harder
      return h.length >= 2 && h.at(-1) === "USER_CONFIRMED" && h.some((g) => g === "USER_STATED" || g === "USER_ELABORATED");
    });
    const series = db.prepare(
      `SELECT session_id, MIN(created_at) AS at, COUNT(*) AS turns,
              ROUND(AVG(delay_ms)) AS avg_delay_ms, MAX(delay_ms) AS max_delay_ms,
              SUM(delay_ms >= ${SLOW}) AS slow_turns
       FROM turns WHERE person_id = ? AND delay_ms IS NOT NULL
       GROUP BY session_id ORDER BY at ASC LIMIT 30`
    ).all(personId).map((s) => ({
      ...s,
      captured: db.prepare("SELECT COUNT(*) c FROM memories WHERE person_id = ? AND session_id = ?").get(personId, s.session_id).c,
    }));
    return { alerts, fading, series, thresholds: { slow_ms: SLOW, very_slow_ms: VERY_SLOW } };
  },

  // coordinator digest: who needs a human, at a glance
  digest(phone) {
    return (phone ? q.peopleFor.all(phone) : q.people.all()).map((p) => ({
      id: p.id,
      name: p.name,
      lang: p.lang,
      memories: p.memory_count,
      unresolved: db.prepare("SELECT COUNT(*) c FROM memories WHERE person_id = ? AND status='UNRESOLVED'").get(p.id).c,
      avoided: db.prepare("SELECT COUNT(*) c FROM memories WHERE person_id = ? AND safe_to_use=0").get(p.id).c,
      open_loop: (q.openLoopFor.get(p.id) || {}).topic || null,
    }));
  },
};
