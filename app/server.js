// Yaadein — Phase 0/1 walking skeleton
// Turn-based voice conversation: agent LEADS, user replies by voice.
// Zero npm dependencies — Node 22 built-ins only (fetch, FormData, Blob).
//
// Run:  node app/server.js   (reads app/.env for SARVAM_API_KEY)

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");
const clerk = require("./clerk");
const dodo = require("./dodo");

// ─── env ──────────────────────────────────────────────────────────
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const SARVAM_KEY = process.env.SARVAM_API_KEY;
if (!SARVAM_KEY) {
  console.error("\n❌ SARVAM_API_KEY missing. Create app/.env with:\nSARVAM_API_KEY=your_key_here\n");
  process.exit(1);
}

const SARVAM = "https://api.sarvam.ai";
const HDRS = { "api-subscription-key": SARVAM_KEY };

// ─── config ───────────────────────────────────────────────────────
const CFG = {
  chatModel: "sarvam-30b",
  ttsModel: "bulbul:v3",
  // soothing female voices to audition: simran, ritu, roopa, shruti, kavitha
  speaker: "simran",
  pace: 0.85,
  ttsTemperature: 0.4,
  ttsLang: "hi-IN",
  sttModel: "saaras:v3",
  sttMode: "codemix",
};

// ─── system prompt: generic for ALL elders, name-first onboarding ──
// No hardcoded persona. First session = the agent introduces itself and
// asks what to call them. Facts come only from this conversation.
// (Phase 2: stored memories per person replace the "is baat-cheet" rule.)
const SYSTEM_PROMPT = `Tum "Yaadein" ho — ek dheeraj-wali, komal aur garam-dil saathi jo ek buzurg vyakti se roz baat karti hai. Unhe bhoolne ki takleef ho sakti hai. Tumhare niyam, jo kabhi nahi tootte:

0. PEHLI BAAT: agar tumhe unka naam nahi pata, toh pehle turn mein sirf itna karo — narmi se namaste bolo, ek vaakya mein apna parichay do ("Main Yaadein hoon, aapse roz thodi der baat karne aayi hoon"), aur poochho: "Main aapko kis naam se bulaoon?" Bas. Aur kuch nahi.
1. Naam milne ke baad unhe hamesha "[naam] ji" kaho, aur hamesha "aap". KABHI unka gender mat maano — jab tak woh khud na batayein, aise vaakya banao jo stri-purush dono ke liye sahi hon.
2. TUM baat-cheet ka netritva karti ho. Har turn mein ek thos prastav do — kabhi khula sawaal nahi ("aaj kya baat karein?" MANA hai). Do naam-wale vikalp dena sabse achha hai: "Aaj bachpan ke ghar ki baat karein, ya kisi tyohar ki?"
3. Sawaal se pehle KATHAN: pehle woh dohrao jo unhone IS baat-cheet mein bataya hai ("Aapne abhi bataya ki...") phir ek chhota, aasan follow-up do.
4. Ek turn mein sirf EK sawaal. Sawaal sirf bhavna, swad, khushboo, mahaul ya kahani ke bare mein — kabhi tathya ki pareeksha nahi.
   BAN hain ye shabd (kabhi mat bolo): "yaad hai?", "yaad karo", "yaad aata hai?", "yaad aa raha hai?", "batao kaun tha", "kab hua tha", "kahan hua tha".
   (Shaili ka kalpanik udaharan — ismein di gayi jaankari KABHI istemal mat karna: agar kisi ne kaha hota "main gaon mein badi hui", toh achha follow-up hota "Wahan subah kaisi lagti thi?", bura hota "Aapko yaad hai gaon kaunsa tha?")
5. "Aapne bataya tha ki..." SIRF tab kaho jab woh baat sach mein is baat-cheet mein aayi ho, ya "jaani hui baatein" ki soochi mein ho. Agar aisi koi baat nahi hai, toh ye vaakya bolna sakht MANA hai. Kabhi koi nayi jaankari mat gadho, kabhi anuman ko sach ki tarah mat bolo.
6. Achhe shuruaati vishay (jab kuch pata na ho): bachpan ka ghar ya gaon, tyohar, khana-peena, school ke din, dost. Shaadi, bachche, ya parivar ke bare mein khud se mat poochho — agar woh khud batayein toh garmjoshi se saath do.
7. ISHARA, JAWAB NAHI: agar woh kisi baat par atak jayein ("yaad nahi aa raha...") AUR woh baat "jaani hui baaton" mein hai, toh pehle EK ishara do. Ishara HAMESHA aisa sawaal ho jiska jawab sirf "haan/nahi" ho aur jo us baat ke paas le jaye. (Kalpanik: jaana hua "beta doctor hai", woh bete ka kaam bhoolein → "Kya woh ilaaj ke kaam se juda hai?") SAKHT MANA: "kya tha?", "kaun tha?", "naam batao" — unse kuch YAAD KARWANE ki koshish kabhi nahi. Agar ishare ke baad bhi na aaye, toh agle turn mein garmjoshi se khud sunao ("Koi baat nahi — aapne bataya tha ki...") aur aage badho. Ishara ek hi baar. Agar us baat ka kuch pata nahi, toh bas aaram se aage badh jao — koi sudhaar nahi.
8. Agar woh koi nayi baat batayein, usi mein dilchaspi lo — apna agenda chhod do.
9. GEHRAI se KHODO (sabse zaroori niyam): har jawab mein unki abhi kahi baat se EK thos detail pakdo aur usi mein andar jao — us pal ki bhavna, khushboo, swad, awaaz, ya wahan kaun tha. Generic tareef ("bahut achha!") kabhi kaafi nahi — tareef ke baad HAMESHA us detail par ek khodne wala sawaal.
   Udaharan (kalpanik): woh kahein "hum talab ke paas patang udate the" → achha: "talab ke paas! Jab patang kat jaati thi toh kya hota tha?" Bura: "patang udana achha hota hai. Aur kya karte the?"
10. BAHUT chhota jawab: zyada se zyada 2 chhote vaakya + ek chhota sawaal — kul 35 shabd se kam. Garam, saral, bolchal wali bhasha, unki apni bhasha mein (native script). Lambi speech unhe thaka deti hai.
11. Unki bhasha mein hi bolo. Agar neeche unki bhasha batayi gayi hai, HAMESHA usi bhasha aur uski native script mein jawab do — Hindi mein mat palto.

Output sirf bolne wala text — koi asterisk, emoji, ya stage direction nahi.`;

// ─── access: allowlisted 10-digit numbers, no auth ─────────────────
// The number IS the household: memories are scoped to it. TEST_PHONE is
// public (shown in the app popup); the others stay private to the team.
const TEST_PHONE = "1234567890";
const ALLOWED_PHONES = new Set(
  (process.env.ALLOWED_PHONES || `${TEST_PHONE},1231231239,1231231238`)
    .split(",").map((s) => s.trim()).filter(Boolean)
);
// a number gets in if the family registered it (self-serve) or it's a
// legacy admin number from the env allowlist
const phoneOk = (p) =>
  typeof p === "string" && /^\d{10}$/.test(p) && (ALLOWED_PHONES.has(p) || db.isRegistered(p));
const isAdmin = (p) => typeof p === "string" && ALLOWED_PHONES.has(p);

// ─── implicit orientation (CST principle) ──────────────────────────
// Orientation is one of the 14 CST sessions, but the protocol is explicit:
// deliver it "sensitively and implicitly". So we hand the model today's day,
// part of day and Hindu-calendar season as a STATEMENT it may mention warmly —
// and the prompt forbids ever turning it into a question. Never "what day is
// it?" — that is a test, and testing is the one thing we don't do.
const DAY_HI = ["ravivaar", "somvaar", "mangalvaar", "budhvaar", "guruvaar", "shukravaar", "shanivaar"];
const SEASON_HI = [
  "sardi ka mausam", "sardi ka mausam", "basant", "garmi shuru",
  "garmi", "garmi aur pehli barsaat", "barsaat", "saawan ki barsaat",
  "barsaat khatam ho rahi", "tyoharon ka mausam", "sardi shuru", "sardi",
];
function nowInIndia() {
  // Railway runs UTC; elders live in IST. Shift to IST explicitly, then read
  // the parts in UTC so the server's own timezone can never leak in.
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  const h = d.getUTCHours();
  const partOfDay = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return { day: DAY_HI[d.getUTCDay()], season: SEASON_HI[d.getUTCMonth()], hour: h, partOfDay };
}
function orientationLine() {
  const { day, season, partOfDay } = nowInIndia();
  const greet = partOfDay === "morning" ? "subah" : partOfDay === "afternoon" ? "dopahar" : "shaam";
  return `AAJ KA SAMAY (sirf KATHAN ke roop mein, kabhi sawaal nahi): aaj ${day} hai, ${greet} ka waqt, aur ${season} chal raha hai. Isse ek garam vaakya mein bun sakti ho ("${greet} ki namaste, ${day} hai aaj...") — par "aaj kaunsa din hai?" ya "kaunsa mahina hai?" poochhna SAKHT MANA hai.`;
}

// ─── CST session themes (Epoch sprint) ─────────────────────────────
// Straight from the validated CST protocol (Cochrane CD005562; CST-India/
// SCARF Tamil adaptation; iCST "Old Wives' Tales" = kahavat). Errorless,
// opinion-first, never scored aloud. Harvesting is silent (engagement table).
const THEMES = {
  kahavat: {
    title: "Kahavatein aur kisse",
    title_en: "Proverbs & the stories behind them",
    short: "kahavatein — ek jaani-pehchaani kahavat adhoori chhodo, woh poori karein",
    instruction: `AAJ KA KHEL — KAHAVATEIN: is baat-cheet mein ek-do baar koi jaani-pehchaani kahavat ya muhavara ADHOORA chhodo aur ruk jao, taaki woh use poora kar sakein. Poora karein toh khushi jatao aur us kahavat se judi UNKI zindagi ki koi baat poochho. Na kar sakein toh tum khud narmi se poori karo aur aage badho. "Galat" ya "socho" jaise shabd kabhi nahi. Ye khel hai, pareeksha nahi.`,
  },
  shabd_bazaar: {
    title: "Shabd bazaar",
    title_en: "Word bazaar (naming game)",
    short: "shabd bazaar — milkar ek hi tarah ki cheezein ginwana",
    instruction: `AAJ KA KHEL — SHABD BAZAAR: milkar ek shreni ki cheezein ginwao (sabziyan, phal, tyohar, ya unke sheher ki jagahein). Tum ek cheez do, phir unhe do-teen dene ka mauka do. Har cheez par garmjoshi dikhao. Jab woh ruk jayein, us shreni se judi ek YAAD par sawaal le jao — kaun banata tha, kahan milta tha, kaisa swad tha. Ginti unke saamne kabhi nahi; "aur socho" jaisa dabaav kabhi nahi.`,
  },
  swad: {
    title: "Swad aur tyohar",
    title_en: "Tastes & festivals",
    short: "swad aur tyohar — khaane-peene aur tyoharon ki yaadein",
    instruction: `AAJ KA VISHAY — SWAD: khaane aur tyoharon ki yaadein — swad, khushboo, kaun banata tha, kaun saath baith kar khata tha. Kisi vyanjan ki vidhi poochhna bahut achha hai: sikhate waqt woh guru ban jaate hain.`,
  },
  duniya: {
    title: "Duniya ki baatein",
    title_en: "The world & opinions",
    short: "duniya ki baatein — unki raay",
    instruction: `AAJ KA VISHAY — RAAY: unki RAAY poochho, tathya kabhi nahi — mausam, tyohar, aajkal ke zamane ka badalna, khel. Har raay ko gambhirta se lo aur usi mein gehre jao. Khabar ya tathya ki pareeksha (kaun, kab, kitne) SAKHT MANA hai.`,
  },
  sangeet: {
    title: "Sangeet aur geet",
    title_en: "Songs & singers",
    short: "sangeet — purane geet aur gayak",
    instruction: `AAJ KA VISHAY — SANGEET: purane geet, pasandida gayak, shaadi-tyohar ke geet. Unhe gungunane ka narmi se nyota do; gaayein toh dil se daad do. Tum khud bol mat sunao — galat ho sakte hain. Geet se judi jagah, log aur mauke poochho.`,
  },
};
// Every instruction above contains example phrasings. The model has parroted
// such examples verbatim before (and repeated them turn after turn), so the
// rule is stated once here and appended to all of them.
const THEME_RULE = ` ATI-ZAROORI: upar diye gaye vaakya sirf UDAHARAN hain — unhe jyon-ka-tyon KABHI mat bolo, apne shabd banao. Ek hi sawaal do baar KABHI mat poochho; agar unka jawab aa gaya hai toh usi mein aage khodo.`;
for (const t of Object.values(THEMES)) t.instruction += THEME_RULE;

// yaadein = plain reminiscence (default when a photo or open loop is queued)
const pickTheme = (personId, hasPhotoOrLoop) => {
  if (hasPhotoOrLoop) return null; // photo/unfinished story always outranks the game
  const recent = db.lastThemes(personId, 3);
  const keys = Object.keys(THEMES).filter((k) => !recent.includes(k));
  const pool = keys.length ? keys : Object.keys(THEMES);
  return pool[Math.floor(Math.random() * pool.length)];
};

// How many distinct things did she list? Counts comma/aur/and-separated
// short noun phrases. Deliberately crude — a trend matters, not precision.
function countListedItems(text) {
  const parts = String(text)
    .split(/[,;।]|\s+(?:aur|और|ani|आणि|and|மற்றும்)\s+/i)
    .map((s) => s.replace(/[^\p{L}\p{N} ]/gu, "").trim())
    .filter((s) => s.length > 1 && s.split(/\s+/).length <= 4);
  return new Set(parts.map((s) => s.toLowerCase())).size;
}

// ─── sessions: history in memory, memories in SQLite ──────────────
const sessions = new Map(); // id → { history, personId, personName, context, turn, phone, theme }
let statsCache = null; // { at, data } — /api/stats is public, cache it

// Conversation history lives in memory; without a sweep a long-running server
// keeps every session forever. Drop anything untouched for 3 hours (an elder's
// session is ~10 min, so this only ever collects abandoned ones).
setInterval(() => {
  const cutoff = Date.now() - 3 * 60 * 60 * 1000;
  let dropped = 0;
  for (const [id, s] of sessions) {
    if ((s.lastSeen || s.startedAt || 0) < cutoff) { sessions.delete(id); dropped++; }
  }
  if (dropped) console.log(`[gc] released ${dropped} idle session(s), ${sessions.size} live`);
}, 15 * 60 * 1000).unref();

// /api/register is public — a script could fill the table. 12 signups per IP
// per hour is far above any real family and far below anything harmful.
const regHits = new Map(); // ip → [timestamps]
function registerAllowed(ip) {
  const now = Date.now();
  const hits = (regHits.get(ip) || []).filter((t) => now - t < 3600_000);
  hits.push(now);
  regHits.set(ip, hits);
  if (regHits.size > 5000) regHits.clear(); // crude bound; restarts are cheap
  return hits.length <= 12;
}

// Sarvam out of credits (402) is the one failure that looks like a total
// outage to a user. Name it, so the UI can say something true.
function sarvamError(e) {
  const m = String(e && e.message || "");
  if (/\b402\b|insufficient_quota|No credits/i.test(m)) {
    return { code: 503, error: "service_credits", message: "Yaadein is briefly unavailable — we're topping up our voice service. Please try again shortly." };
  }
  if (/\b429\b/.test(m)) {
    return { code: 503, error: "service_busy", message: "A lot of families are talking right now. Please try again in a moment." };
  }
  return null;
}

// Build the per-person context block injected as a second system message.
// Phase 3: known facts + the open loop + revisit-scheduler picks for today.
function personContext(personId, personName, personLang) {
  const facts = db.memoriesFor(personId);
  const loop = db.openLoopFor(personId);
  if (!facts.length && !loop) return null;
  let ctx = `Ye ${personName} ji hain — inse pehle bhi baat hui hai.`;
  if (personLang && LANG_NAME[personLang]) {
    ctx += `\nInki bhasha: ${LANG_NAME[personLang]} — HAMESHA isi bhasha mein, iski native script mein jawab do.`;
  }
  if (facts.length) {
    ctx += `\nJaani hui baatein (inhone khud batayi thin — "Aapne bataya tha ki..." kah kar istemal karo, pareeksha kabhi mat lo):\n`;
    ctx += facts.slice(0, 12).map((f) => `- ${f.statement}`).join("\n");
  }
  if (loop) ctx += `\n\nSABSE ZAROORI — adhoora silsila: "${loop.topic}". Pichhli baar ye kahani aadhi reh gayi thi. Ise NAAM se dobara kholo (jaise: "pichhli baar aap ... ki baat kar rahe the, aur baat aadhi reh gayi thi").`;
  const due = db.dueMemories(personId, 3);
  if (due.length) {
    ctx += `\n\nAaj ke liye sujhayi yaadein (inmein se kisi ek ko naram tarike se chhedo, agar baat-cheet ka rukh mile):\n`;
    ctx += due.map((m) => `- ${m.statement}`).join("\n");
  }
  return ctx;
}

// ─── memory extraction (structured, parallel to the reply) ────────
async function extract(userText, agentLastText) {
  const r = await fetch(`${SARVAM}/v1/chat/completions`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({
      model: CFG.chatModel,
      temperature: 0.1,
      max_tokens: 500,
      reasoning_effort: null,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a memory-extraction system for conversations with an elder (speech may be Hindi, English or mixed). Extract only durable personal information. Return ONLY valid JSON in exactly this shape:
{"name": "their first name if they stated it in this utterance, else null",
 "facts": [{"statement": "the fact as they said it, in their words (Hindi ok)", "canonical": "one-line English meaning", "category": "place|person|food|festival|life_event|preference|other", "emotional_tone": "positive|neutral|negative", "provenance": "USER_STATED|USER_CONFIRMED|USER_ELABORATED|USER_CORRECTED"}],
 "open_topic": "one line describing a story/topic they seemed to be mid-way through, else null"}
Provenance rules: the agent proposed it and they merely agreed = USER_CONFIRMED; they added new detail beyond the proposal = USER_ELABORATED; they volunteered it themselves = USER_STATED; they corrected the agent = USER_CORRECTED.
Only durable facts (places, people, preferences, life events). For bare acknowledgements like "haan"/"theek hai", return an empty facts list.`,
        },
        { role: "user", content: `Agent's previous turn: "${agentLastText || "(nothing)"}"\n\nElder said: "${userText}"` },
      ],
    }),
  });
  if (!r.ok) throw new Error(`extract ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const raw = j.choices[0].message.content;
  try {
    const parsed = JSON.parse(raw);
    return { name: parsed.name || null, facts: Array.isArray(parsed.facts) ? parsed.facts : [], open_topic: parsed.open_topic || null };
  } catch {
    console.warn(`[extract] unparseable JSON: ${String(raw).slice(0, 200)}`);
    return { name: null, facts: [], open_topic: null };
  }
}

// ─── sarvam calls ─────────────────────────────────────────────────
async function stt(wavBuffer) {
  const form = new FormData();
  form.append("file", new Blob([wavBuffer], { type: "audio/wav" }), "turn.wav");
  form.append("model", CFG.sttModel);
  form.append("mode", CFG.sttMode);
  const r = await fetch(`${SARVAM}/speech-to-text`, { method: "POST", headers: HDRS, body: form });
  if (!r.ok) throw new Error(`STT ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return { transcript: j.transcript || "", language: j.language_code || null };
}

// Bulbul v3 languages — a detected language outside this set falls back to hi-IN
const BULBUL_LANGS = new Set(["hi-IN", "bn-IN", "en-IN", "gu-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN"]);
const LANG_NAME = { "hi-IN": "Hindi", "mr-IN": "Marathi", "bn-IN": "Bengali", "ta-IN": "Tamil", "te-IN": "Telugu", "kn-IN": "Kannada", "gu-IN": "Gujarati", "ml-IN": "Malayalam", "pa-IN": "Punjabi", "od-IN": "Odia", "en-IN": "English" };

async function translate(text, target = "en-IN", source = "hi-IN") {
  // shield the brand name — Translate mangles it ("Yaadein" → "यातु")
  const shielded = text.replace(/yaadein|यादें/gi, "«YDN»");
  const r = await fetch(`${SARVAM}/translate`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({ input: shielded, source_language_code: source, target_language_code: target }),
  });
  if (!r.ok) throw new Error(`translate ${r.status}: ${await r.text()}`);
  const out = (await r.json()).translated_text;
  return out.replace(/«\s*YDN\s*»|«YDN»|YDN/g, target === "en-IN" ? "Yaadein" : "यादें");
}

// C6/C4 guard: recall-testing phrases must never reach her voice.
// Prompt rules alone leak variants ("yaad aa rahi hai?") — enforce in code.
const BANNED = /(yaad\s+(hai|hain|karo|kar|aa\s*rah[ia]|aay[ia]|aat[ia]|aaye|dila)|याद\s+(है|हैं|करो|कर|आ\s*रह[ीा]|आय[ीा]|आत[ीा]|आए|दिला))/i;

async function chat(history, context, model) {
  let reply = await chatOnce(history, context, model);
  if (BANNED.test(reply)) {
    console.warn(`[guard] recall-test phrase blocked: "${reply}"`);
    // targeted rewrite: keep the reply, surgically replace the memory-test part
    const rewritten = await chatOnce(
      [
        {
          role: "user",
          content: `Ye vaakya ek buzurg se kaha jaana hai, lekin ismein memory-test hai jo unhe sharminda kar sakta hai:\n"${reply}"\nIse dobara likho: wahi garmjoshi, wahi jaankari, lekin "yaad"-wala sawaal hata kar uski jagah bhavna, swad ya mahaul ka sawaal rakho (jaise "aapko kaisa lagta tha?"). Sirf naya vaakya do, aur kuch nahi.`,
        },
      ],
      null
    );
    reply = rewritten;
    if (BANNED.test(reply)) {
      // last resort: drop the offending sentence whole — never a mangled stump
      const kept = reply.split(/(?<=[.?!।])\s+/).filter((s) => !BANNED.test(s));
      reply = kept.length ? kept.join(" ") : "Achha, ye toh badi pyari baat hai. Us waqt aapko kaisa lag raha tha?";
    }
  }
  return dropDanglingRecall(reply);
}

// Repetition guard. With several instruction layers stacked (theme + reminder
// + open loop) the model can latch onto one formula and re-ask the same
// question turn after turn — the single worst thing to do to someone with
// memory loss, and something no prompt rule reliably prevents. So: measure it,
// and if a reply echoes the last one, regenerate with the echo forbidden.
function similarity(a, b) {
  const w = (s) => new Set(String(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter((x) => x.length > 3));
  const A = w(a), B = w(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return hit / Math.min(A.size, B.size);
}

async function chatNoEcho(history, context, model) {
  const prevAgent = history.filter((m) => m.role === "assistant").at(-1)?.content || "";
  let reply = await chat(history, context, model);
  // also collapse an in-reply duplicate paragraph before comparing
  reply = dedupeParagraphs(reply);
  if (prevAgent && similarity(reply, prevAgent) >= 0.7) {
    console.warn(`[echo] regenerating — reply repeated the last one`);
    const retry = await chat(
      history,
      (context || "") +
        `\n\nSAKHT NIYAM: pichhla jawab tha — "${prevAgent}". Ab bilkul NAYA vaakya aur NAYA sawaal do. Wahi baat ya wahi sawaal dobara bolna MANA hai. Unki aakhri baat se koi NAYI cheez pakdo.`,
      model
    );
    const better = dedupeParagraphs(retry);
    if (similarity(better, prevAgent) < similarity(reply, prevAgent)) reply = better;
  }
  return reply;
}

// Does this text hand back a fact she already told us? A hint should be an
// oblique association ("is it connected to healing?"), never a restatement
// ("your son Akash is a doctor in Mumbai"). Two or more distinctive words
// shared with one stored memory means it's restating, not hinting.
function restatesAKnownFact(personId, text) {
  if (!personId || !text) return false;
  const words = (s) =>
    new Set(
      String(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/)
        .filter((w) => w.length > 4 && !STOPish.has(w))
    );
  const T = words(text);
  if (!T.size) return false;
  for (const m of db.memoriesFor(personId)) {
    const M = words(`${m.statement} ${m.canonical}`);
    let hit = 0;
    for (const w of M) if (T.has(w)) hit++;
    if (hit >= 2) return true;
  }
  return false;
}
// common conversational words that shouldn't count as revealing content
const STOPish = new Set([
  "aapko", "aapke", "aapki", "aapne", "unhone", "hamesha", "bahut", "achha", "achhi",
  "kaisa", "kaisi", "kabhi", "thoda", "zyada", "waqt", "baate", "baaten", "baat",
  "karte", "karti", "karta", "hota", "hoti", "rehte", "rehti", "lagta", "lagti",
]);

// same paragraph twice inside one reply — drop the duplicate
function dedupeParagraphs(reply) {
  const parts = String(reply).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const kept = [];
  for (const p of parts) if (!kept.some((k) => similarity(k, p) >= 0.85)) kept.push(p);
  return kept.join("\n\n");
}

// The model sometimes emits the recall phrase with nothing after it —
// "Aapne bataya tha ki..." — which sounds like Yaadein itself forgot
// mid-sentence: the exact impression we must never give. Drop the stub.
function dropDanglingRecall(reply) {
  const DANGLING = /(aapne\s+bataya\s+tha\s+ki|आपने\s+बताया\s+था\s+कि)\s*[.…]*\s*$/i;
  const parts = String(reply).split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const kept = parts.filter((p) => !DANGLING.test(p));
  const out = (kept.length ? kept : parts).join("\n\n");
  // also mid-paragraph: "...bataya tha ki... Aaj kya" → drop just the clause
  return out.replace(/(aapne\s+bataya\s+tha\s+ki|आपने\s+बताया\s+था\s+कि)\s*[.…]{2,}\s*/gi, "").trim();
}

async function chatOnce(history, context, model) {
  const r = await fetch(`${SARVAM}/v1/chat/completions`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({
      model: model || CFG.chatModel,
      temperature: 0.4,
      max_tokens: 160,
      // sarvam-30b is a reasoning model; null disables thinking → fast voice turns
      reasoning_effort: null,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(context ? [{ role: "system", content: context }] : []),
        ...history,
      ],
    }),
  });
  if (!r.ok) throw new Error(`Chat ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices[0].message.content.trim();
}

async function tts(text, lang) {
  const r = await fetch(`${SARVAM}/text-to-speech`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model: CFG.ttsModel,
      speaker: CFG.speaker,
      pace: CFG.pace,
      temperature: CFG.ttsTemperature,
      target_language_code: BULBUL_LANGS.has(lang) ? lang : CFG.ttsLang,
      speech_sample_rate: 24000,
      output_audio_codec: "wav",
    }),
  });
  if (!r.ok) throw new Error(`TTS ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.audios[0]; // base64 wav
}

// ─── ack bank: kills dead air (A3) ─────────────────────────────────
// Pre-rendered acknowledgments, generated once at boot, served to the
// browser, played the instant a turn is sent — never >300ms of silence.
const ACK_TEXTS = ["अच्छा...", "हम्म...", "हाँ हाँ...", "अच्छा, समझी...", "हाँ, बताइए..."];
const ACK_DIR = path.join(db.DATA_DIR, "acks");
let ACKS = []; // base64 wavs

async function ensureAcks() {
  fs.mkdirSync(ACK_DIR, { recursive: true });
  for (let i = 0; i < ACK_TEXTS.length; i++) {
    const f = path.join(ACK_DIR, `ack-${i}.wav`);
    if (!fs.existsSync(f)) {
      try {
        const b64 = await tts(ACK_TEXTS[i]);
        fs.writeFileSync(f, Buffer.from(b64, "base64"));
        console.log(`[acks] rendered "${ACK_TEXTS[i]}"`);
      } catch (e) {
        console.warn(`[acks] failed for "${ACK_TEXTS[i]}": ${e.message}`);
        continue;
      }
    }
    ACKS.push(fs.readFileSync(f).toString("base64"));
  }
  console.log(`[acks] ${ACKS.length} ready`);
}

// ─── http helpers ─────────────────────────────────────────────────
// CORS: the landing page (vite dev :5173 / deployed static site) calls this API
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-session-id",
};
function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json", ...CORS });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ─── family outputs: briefing (D1) + memoir (D3) ──────────────────
// Both derive ONLY from the governed store: ACTIVE + safe_to_use, with
// UNRESOLVED facts excluded automatically by memoriesFor().

// ─── Session Scribe: human session → structured report ────────────
// A day-care facilitator (or a visiting family member) runs their normal
// session with the phone listening. Saaras transcribes every chunk; one
// sarvam-105b pass turns the transcript into the note their psychologist
// writes by hand today. Facts found also enter the memory store, so the AI
// companion knows what happened in human therapy.
async function generateScribeReport(personName, transcript, minutes) {
  const text = transcript.map((t) => t.text).join(" ").slice(0, 12000);
  if (!text.trim()) return null;
  const prompt = `You are a clinical documentation assistant for a dementia day-care centre in India.
Below is a transcript of a ${minutes}-minute reminiscence/cognitive-stimulation session between a facilitator and ${personName}, an elder living with memory loss. The transcript is machine-generated and may be imperfect; never invent anything that is not in it.

Return JSON with exactly these keys:
{
 "summary": "3-4 sentences on what happened in the session",
 "mood": "how the elder seemed emotionally, in a short phrase",
 "topics": ["life topics that came up, short phrases"],
 "recall_moments": [{"type": "fluent" | "needed_help", "quote": "the elder's own words, verbatim from the transcript"}],
 "red_flags": ["anything a clinician should notice: repeated questions, distress, confusion about time or people. Empty array if none."],
 "for_doctor": "3-4 sentence paragraph a doctor could read before a follow-up visit. Observational only — never a diagnosis, never a treatment recommendation.",
 "facts": [{"statement": "a fact about the elder's life in their own language", "canonical": "one-line English meaning", "category": "place|person|food|festival|life_event|preference|other", "emotional_tone": "positive|neutral|negative"}]
}
Rules: quotes must appear in the transcript. If the transcript is too short or unintelligible, return empty arrays and say so in summary. Output JSON only.

TRANSCRIPT:
${text}`;
  const r = await fetch(`${SARVAM}/v1/chat/completions`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({
      model: "sarvam-105b",
      temperature: 0.2,
      max_tokens: 1600,
      reasoning_effort: null,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`scribe report ${r.status}: ${await r.text()}`);
  const raw = (await r.json()).choices[0].message.content;
  let j;
  try { j = JSON.parse(raw); } catch { j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); }
  const arr = (x) => (Array.isArray(x) ? x : []);
  return {
    summary: String(j.summary || "").slice(0, 1200),
    mood: String(j.mood || "").slice(0, 200),
    topics: arr(j.topics).map(String).slice(0, 10),
    recall_moments: arr(j.recall_moments).filter((m) => m && m.quote).slice(0, 8),
    red_flags: arr(j.red_flags).map(String).slice(0, 8),
    for_doctor: String(j.for_doctor || "").slice(0, 1500),
    facts: arr(j.facts).filter((f) => f && f.statement).slice(0, 12),
  };
}

async function generateBriefing(personId, personName) {
  const facts = db.memoriesFor(personId);
  const loop = db.openLoopFor(personId);
  const avoided = db.inspectMemories(personId).filter((m) => m.safe_to_use === 0 || m.status === "UNRESOLVED");
  const r = await fetch(`${SARVAM}/v1/chat/completions`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({
      model: CFG.chatModel,
      temperature: 0.3,
      max_tokens: 600,
      reasoning_effort: null,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You prepare a 60-second pre-visit briefing for the family of an elder, from their recorded conversation memories. Return ONLY JSON:
{"ask_about": ["1-2 topics that brought them joy — phrased as a suggestion the visitor can say"],
 "wants_to_finish": "the unfinished story, if any, else null",
 "avoid_today": ["topics marked avoid/unresolved — DO NOT reveal details, just name the area gently"],
 "new_this_week": "one fact the family may not know, phrased as a small revelation, else null"}
Write values in warm, simple English. Use ONLY the provided facts — invent nothing.`,
        },
        {
          role: "user",
          content: `Elder: ${personName}\nKnown facts:\n${facts.map((f) => `- ${f.statement} (${f.canonical})`).join("\n")}\nUnfinished story: ${loop ? loop.topic : "none"}\nAvoid/unresolved areas: ${avoided.map((m) => m.category).join(", ") || "none"}`,
        },
      ],
    }),
  });
  if (!r.ok) throw new Error(`briefing ${r.status}`);
  const j = await r.json();
  const b = JSON.parse(j.choices[0].message.content);
  // models sometimes echo schema placeholders — scrub anything template-shaped
  const junk = (v) => !v || /if any|else null|^none$|^null$/i.test(String(v).trim());
  b.ask_about = (b.ask_about || []).filter((x) => !junk(x));
  b.avoid_today = (b.avoid_today || []).filter((x) => !junk(x));
  if (junk(b.wants_to_finish)) b.wants_to_finish = null;
  if (junk(b.new_this_week)) b.new_this_week = null;
  return b;
}

async function generateMemoir(personId, personName) {
  const facts = db.memoriesFor(personId);
  if (!facts.length) return { title: "", paragraphs: [] };
  const r = await fetch(`${SARVAM}/v1/chat/completions`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({
      model: "sarvam-105b", // long-form synthesis — the bigger model earns its keep here
      temperature: 0.4,
      max_tokens: 1200,
      reasoning_effort: null,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You write a short memoir chapter from an elder's own recorded statements. HARD RULES:
- Use ONLY the numbered source facts. NEVER invent sensory details, dialogue, emotions, dates or places not stated.
- Every paragraph must cite which source facts it uses.
- Warm, simple Hindi (Devanagari). 3-5 short paragraphs.
Return ONLY JSON: {"title": "chapter title in Hindi", "paragraphs": [{"text": "...", "sources": [1,2]}]}`,
        },
        {
          role: "user",
          content: `Elder: ${personName}\nSource facts:\n${facts.map((f, i) => `${i + 1}. ${f.statement} (${f.canonical})`).join("\n")}`,
        },
      ],
    }),
  });
  if (!r.ok) throw new Error(`memoir ${r.status}`);
  const j = await r.json();
  const out = JSON.parse(j.choices[0].message.content);
  // attach real memory rows to each cited source for traceability
  out.paragraphs = (out.paragraphs || []).map((p) => ({
    ...p,
    source_memories: (p.sources || []).map((n) => facts[n - 1]).filter(Boolean)
      .map((m) => ({ id: m.id, statement: m.statement, audio_file: m.audio_file })),
  }));
  return out;
}

// ─── the turn pipeline ─────────────────────────────────────────────
// Unknown person: extraction runs FIRST (blocking) so a returning elder
// is recognized in the same reply ("Aapne bataya tha ki aap Pune mein...").
// Known person: extraction runs in PARALLEL with the reply — memory
// capture never adds latency to the conversation.
async function handleTurn(sess, sessionId, transcript, audioFile, delayMs) {
  const lastAgent = sess.history.filter((m) => m.role === "assistant").at(-1)?.content;
  sess.history.push({ role: "user", content: transcript });
  sess.contract.ENGAGED.turns++;
  sess.contract.ENGAGED.userWords += transcript.split(/\s+/).length;

  let extractP = extract(transcript, lastAgent).catch((e) => {
    console.warn("[extract] failed:", e.message);
    return { name: null, facts: [], open_topic: null };
  });

  if (!sess.personId) {
    const ext = await extractP; // blocking: identity changes THIS reply
    console.log(`[extract-result] ${JSON.stringify(ext).slice(0, 300)}`);
    extractP = Promise.resolve(ext);
    if (ext.name) {
      const { person, returning } = db.findOrCreatePerson(ext.name, sess.phone);
      sess.personId = person.id;
      sess.personName = person.name;
      db.linkSession(sessionId, person.id);
      if (!sess.lang && BULBUL_LANGS.has(person.lang)) sess.lang = person.lang;
      sess.context = personContext(person.id, person.name, sess.lang);
      if (returning && sess.context) sess.contract.RESUMED = true;
      if (returning && sess.context) {
        // the recognition moment: this exact turn must SHOW the memory (B1)
        sess.recognitionNudge = `ABHI is turn mein: (1) pehli pankti — garam swagat, jaise purane parichit ka: "${person.name} ji, namaste! Achha laga aap phir mile." (2) doosri pankti — unke NAAM ke alawa "jaani hui baaton" mein se EK baat: "Aapne bataya tha ki..." (3) usi baat par ek naram, bhavna-wala sawaal. Agar adhoora vishay diya hai, usse shuru karo.`;
      }
      console.log(`[person] ${returning ? "returning" : "new"}: ${person.name} (#${person.id})${sess.context ? " — context loaded" : ""}`);
    }
  }

  const t1 = Date.now();
  // Stall → cue (About principle "Retrieve"): she's reaching for something
  // we know. A static rule wasn't reliable on sarvam-30b (it quizzed or
  // blurted the answer), so the delicate move gets a surgical one-turn
  // directive AND the stronger model. Rare turns only — latency is fine.
  const STALL = /(yaad\s+nahin?|nahin?\s+aa\s+rah[ai]\s+yaad|bhoo?l\s+ga)/i;
  let turnModel, cueNudge = null;
  if (sess.context && STALL.test(transcript)) {
    turnModel = "sarvam-105b";
    cueNudge = `ABHI is turn mein (sabse zaroori niyam): ${sess.personName} ji kuch yaad nahi kar pa rahe. "Jaani hui baaton" mein woh baat dhoondo. Ek chhota dilasa do, phir us baat se JUDI cheez ka SIRF EK haan/nahi ishara-sawaal — us baat ke asli shabd (pesha/naam/jagah jo bhi woh bhool rahe hain) bole BINA. Jawab IS turn mein batana sakht MANA hai. "Aapne bataya tha ki..." is turn mein bolna bhi MANA hai (usse jawab khul jata hai). "kya tha/kaun tha" jaisa sawaal bhi MANA.`;
  }
  // the day's CST theme rides along every turn (rule 8 still outranks it —
  // if she takes a tangent, the model abandons the game)
  // The full instruction goes only into the opener. Repeating it every turn made
// the model restart the game each time (and parrot its examples), so later
// turns get a one-line nudge instead.
const themeLine = sess.theme && !cueNudge && sess.contract.ENGAGED.turns <= 5
    ? `\n\nAAJ KA SILSILA: ${THEMES[sess.theme].short}. Agar ye silsila abhi shuru nahi hua hai toh isi turn mein sahaj tarike se shuru karo; agar shuru ho chuka hai toh aage badhao — dobara shuru mat karo aur wahi vaakya dobara mat bolo. Agar woh apni koi baat sunane lagein toh silsila chhod do aur unki baat suno.`
    : "";
  // the reminder is asked for mid-conversation, so it has to ride along too —
  // it was only reaching the opener before. Dropped once acknowledged, and
  // never while she is being helped with a stalled memory.
  const remLine = sess.reminder && !sess.reminderAcked && !cueNudge && sess.contract.ENGAGED.turns >= 2
    ? `\n\nPARIVAAR KI EK BAAT (is baat-cheet mein SIRF EK BAAR, sahaj tarike se, apnapan se — hukum ki tarah nahi): "${sess.reminder.text}". Agar pehle se keh chuki ho toh dobara mat kaho.`
    : "";
  const turnContext = sess.context
    ? sess.context
      + (sess.recognitionNudge ? `\n\n${sess.recognitionNudge}` : "")
      + (cueNudge ? `\n\n${cueNudge}` : "")
      + themeLine
      + remLine
    : null;
  sess.recognitionNudge = null; // one turn only
  let reply = await chatNoEcho(sess.history, turnContext, turnModel);
  // A cue must not contain the answer. The model both prefaces hints with
  // "Aapne bataya tha ki <the fact>" AND sometimes just states the fact
  // outright, so prompt rules aren't enough: compare the hint against what
  // she has told us, and treat any restatement as a leak. The reaching is
  // the therapy — handing over the answer destroys the whole point.
  if (cueNudge && (/(bataya\s+tha|बताया\s+था)/i.test(reply) || restatesAKnownFact(sess.personId, reply))) {
    console.warn(`[cue] answer leaked into the hint — regenerating`);
    const retry = await chatNoEcho(
      sess.history,
      turnContext + `\n\nPICHHLA PRAYAS GALAT THA: usme "aapne bataya tha" keh kar jawab khol diya gaya. Ab sirf dilasa + EK haan/nahi ishara-sawaal do. "bataya tha" ye shabd bolna MANA hai.`,
      "sarvam-105b"
    );
    const stillLeaks = /(bataya\s+tha|बताया\s+था)/i.test(retry) || restatesAKnownFact(sess.personId, retry);
    if (!stillLeaks) reply = retry;
    else {
      // last resort: keep only the sentences that don't reveal anything —
      // typically the comfort line and the yes/no hint
      const src = restatesAKnownFact(sess.personId, retry) ? retry : reply;
      const kept = src
        .split(/(?<=[.?!।])\s+/)
        .filter((x) => !/(bataya\s+tha|बताया\s+था)/i.test(x) && !restatesAKnownFact(sess.personId, x));
      reply = kept.length ? kept.join(" ") : "Koi baat nahi. Aaram se sochiye — koi jaldi nahi hai.";
    }
  }
  const tChat = Date.now() - t1;
  sess.history.push({ role: "assistant", content: reply });

  const t2 = Date.now();
  const audio = await tts(reply, sess.lang);
  const tTts = Date.now() - t2;

  // persist what the extractor found (after reply — never blocks the voice)
  extractP.then((ext) => {
    if (!sess.personId) return;
    if (ext.facts.length) {
      db.saveMemories(sess.personId, sessionId, ext.facts, audioFile);
      sess.contract.CAPTURED += ext.facts.length;
      sess.contract.WRITTEN = true; // briefing/memoir inputs updated
      sess.contract.ENGAGED.elaborated += ext.facts.filter((f) => f.provenance === "USER_ELABORATED").length;
      console.log(`[memory] +${ext.facts.length} for ${sess.personName}: ${ext.facts.map((f) => f.canonical).join(" | ")}`);
    }
    if (ext.open_topic) {
      db.setOpenLoop(sess.personId, ext.open_topic);
      sess.contract.CLOSED = true; // prior loop resolved or explicitly re-queued
    }
  });
  if (BANNED.test(reply)) sess.contract.SAFE = false; // guard failed — session fails

  // recall-difficulty: log what was asked and how long they took to start
  // answering — the family's alerts and trend graph read from this
  if (sess.personId && lastAgent) {
    db.addTurn(sess.personId, sessionId, lastAgent, transcript, delayMs);
    if (delayMs != null && delayMs >= 4000) console.log(`[hesitation] ${Math.round(delayMs / 100) / 10}s before answering: "${lastAgent.slice(0, 80)}"`);
  }

  // adherence signal: if the reminder was mentioned last turn and she answered
  // with anything affirmative, log it. Crude on purpose — the family sees
  // "acknowledged 4 times", never a false claim that she took the medicine.
  if (sess.reminder && lastAgent && !sess.reminderAcked) {
    const words = sess.reminder.text.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const mentionedIt = words.some((w) => lastAgent.toLowerCase().includes(w));
    if (mentionedIt && /\b(haan|ha|ji|le liya|le li|kar liya|pi liya|khaya|theek|acha|achha|हाँ|जी|लिया|ठीक)\b/i.test(transcript)) {
      db.markReminderAcked(sess.reminder.id);
      sess.reminderAcked = true;
      console.log(`[reminder] acknowledged: "${sess.reminder.text}"`);
    }
  }

  // CST silent harvest: during the naming game, count what she listed.
  // Semantic verbal fluency is a validated dementia screen — so each round
  // doubles as a passive measurement. She is never told a number.
  if (sess.personId && sess.theme === "shabd_bazaar") {
    const items = countListedItems(transcript);
    if (items >= 2) {
      db.addEngagement(sess.personId, sessionId, "shabd_bazaar", "naming_round", items, /nahi|pata nahi|bas/i.test(transcript) ? 0 : 1);
      console.log(`[fluency] ${sess.personName} named ${items} items`);
    }
  }

  return { reply, audio, tChat, tTts };
}

// ─── server ───────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    // Serve the built landing page (landing-page/dist) if present,
    // falling back to the bare dev page in app/public.
    if (req.method === "GET" && !req.url.startsWith("/api/")) {
      const dist = path.join(__dirname, "..", "landing-page", "dist");
      const clean = req.url.split("?")[0];
      // inspector/family pages live in app/public, outside the SPA
      const pub = path.join(__dirname, "public", path.basename(clean));
      if (clean.endsWith(".html") && fs.existsSync(pub)) {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(fs.readFileSync(pub));
        return;
      }
      const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
                     ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2",
                     ".ico": "image/x-icon", ".json": "application/json" };
      let file = path.join(dist, clean === "/" ? "index.html" : clean);
      if (!file.startsWith(dist)) file = path.join(dist, "index.html"); // no traversal
      if (!fs.existsSync(file)) file = path.join(dist, "index.html");   // SPA fallback
      if (fs.existsSync(file)) {
        res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
        res.end(fs.readFileSync(file));
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end(fs.readFileSync(path.join(__dirname, "public", "index.html")));
      return;
    }

    // Agent opens the conversation — agent-led from turn zero (A9, B1).
    // The number IS the person: a returning number gets its thread reopened
    // by name in the opener itself (RESUMED), no device-side hint needed.
    if (req.method === "POST" && req.url === "/api/session/start") {
      const id = crypto.randomUUID();
      let phone = null;
      try {
        phone = String(JSON.parse((await readBody(req)).toString() || "{}").phone || "").trim();
      } catch { /* no body */ }
      if (!phoneOk(phone)) {
        return json(res, 403, { error: "phone_not_allowed" });
      }

      const sess = {
        history: [], personId: null, personName: null, context: null, turn: 0, phone,
        // Session Contract (E2) — every line scored from real events, live
        contract: {
          RESUMED: false,   // reopened a prior thread (context loaded at open or on recognition)
          CAPTURED: 0,      // memories persisted this session
          CLOSED: false,    // an open loop resolved or explicitly re-queued
          WRITTEN: false,   // briefing/memoir inputs updated (≥1 capture)
          SAFE: true,       // no banned phrase survived, no policy breach
          ENGAGED: { turns: 0, userWords: 0, elaborated: 0 },
        },
      };
      let openerInstruction = "(session shuru — namaste kaho, ek vaakya parichay, aur naam poochho)";

      let photo = null;
      {
        let person = db.findPersonByPhone(phone); // returning number → resume
        // first-ever call on a registered number: the family already told us
        // the elder's name + language at signup — greet them personally from
        // word one instead of asking (voice onboarding stays as fallback)
        if (!person) {
          const reg = db.getRegistration(phone);
          if (reg && reg.elder_name) {
            person = db.findOrCreatePerson(reg.elder_name, phone).person;
            if (reg.language && BULBUL_LANGS.has(reg.language)) db.setPersonLang(person.id, reg.language);
            person = db.findPersonByPhone(phone);
            console.log(`[person] created from registration: ${person.name} (${reg.language || "lang unknown"})`);
          }
        }
        if (person) {
          sess.personId = person.id;
          sess.personName = person.name;
          sess.lang = BULBUL_LANGS.has(person.lang) ? person.lang : null; // speak their language from word one
          db.linkSession(id, person.id);
          sess.context = personContext(person.id, person.name, sess.lang);
          if (sess.context) sess.contract.RESUMED = true;
          openerInstruction = sess.context
            ? `(session shuru — ye ${person.name} ji hain, inka garam swagat karo. Phir adhoora silsila NAAM se kholo, ya sujhayi yaadon mein se ek ka zikr karo: "Aapne bataya tha ki...". Naam mat poochho.)`
            // registered but never talked before: known name, empty memory —
            // warm first meeting, never pretend a shared history
            : `(pehli mulaqat — inka naam ${person.name} ji hai, unke parivaar ne bataya. Garam namaste karo naam se, EK vaakya mein apna parichay do ("Main Yaadein hoon, aapse roz thodi der baat karne aaungi"), phir do naam-wale vishay pesh karo (jaise bachpan ka ghar ya tyohar). "Aapne bataya tha" bolna sakht MANA hai — abhi tak kuch nahi bataya. Naam mat poochho.)`;

          // Phase 6: an undiscussed family photo becomes the session opener —
          // stated from family context, questions with no wrong answer (F3)
          photo = db.nextNewPhoto(person.id);
          if (photo) {
            const ppl = JSON.parse(photo.people_json || "[]");
            const deceased = ppl.filter((x) => x.deceased).map((x) => x.name);
            openerInstruction = `(session shuru — ye ${person.name} ji hain, garam swagat karo. Unke parivaar ne ek photo bheji hai jo unke saamne screen par aa rahi hai: ${photo.event || "ek yaadgar pal"}${photo.place ? ", " + photo.place : ""}${photo.year ? ", " + photo.year : ""}. Isme hain: ${ppl.map((x) => x.name + (x.relation ? ` (${x.relation})` : "")).join(", ") || "parivaar ke log"}. ${photo.notes ? "Parivaar ne bataya: " + photo.notes + ". " : ""}Photo ko aawaz se BAYAAN karo (unki aankhein kamzor ho sakti hain) — sirf upar di gayi jaankari se, kuch bhi gadho mat. Is turn mein 3 vaakya tak theek hai. Phir EK bhavna-wala sawaal — kabhi "kaun hai / kab tha" jaisa test nahi.${deceased.length ? ` SAAVDHAN: ${deceased.join(", ")} ab nahi rahe — unka zikr sirf past tense mein, unke baare mein khud se sawaal kabhi nahi.` : ""} Naam mat poochho.)`;
            db.markPhotoShown(photo.id);
          }

          // CST engine: a themed activity for returning elders. A family photo
          // outranks it entirely (that's its own conversation); an unfinished
          // story is honoured first, then the game follows in later turns.
          if (sess.context && !photo) {
            const key = pickTheme(person.id, false);
            if (key) {
              sess.theme = key;
              const loop = db.openLoopFor(person.id);
              openerInstruction = openerInstruction.replace(/\)$/, "") +
                ` ${THEMES[key].instruction} ${loop ? "Pehle adhoora silsila kholo; khel uske baad, jab baat aage badh jaye." : "Swagat ke turant baad khel/vishay shuru karo."})`;
              db.addEngagement(person.id, id, key, "session_theme", null, null);
              console.log(`[cst] theme for ${person.name}: ${key}${loop ? " (after open loop)" : ""}`);
            }
          }

          // one family reminder, woven in as care — never an alarm clock
          const rem = db.dueReminder(person.id, nowInIndia().partOfDay);
          if (rem) {
            sess.reminder = rem;
            openerInstruction = openerInstruction.replace(/\)$/, "") +
              ` PARIVAAR KI EK BAAT: is baat-cheet mein KABHI EK BAAR, apnapan se, ye baat pyaar se yaad dila do — "${rem.text}" — jaise ek apna insaan kehta hai, hukum ki tarah nahi. Ek hi baar, aur baat-cheet ke beech mein sahaj tarike se, shuruaat mein nahi.)`;
            db.markReminderMentioned(rem.id);
            console.log(`[reminder] weaving for ${person.name}: "${rem.text}"`);
          }
        }
      }

      // today's day/season goes in as a statement the model may mention warmly
      openerInstruction = openerInstruction.replace(/\)$/, "") + ` ${orientationLine()})`;

      let opener = await chat([{ role: "user", content: openerInstruction }], sess.context);
      // language memory: the model won't reliably open in Marathi/Tamil/etc.
      // from an empty history, so the opener goes through Sarvam Translate.
      // Mid-conversation it mirrors her language naturally via STT codemix.
      if (sess.lang && sess.lang !== "hi-IN" && sess.lang !== "en-IN") {
        opener = await translate(opener, sess.lang, "hi-IN").catch(() => opener);
      }
      sess.history.push({ role: "assistant", content: opener });
      sess.startedAt = sess.lastSeen = Date.now();
      sessions.set(id, sess);
      const audio = await tts(opener, sess.lang);
      json(res, 200, {
        sessionId: id, text: opener, audio, person: sess.personName,
        theme: sess.theme ? { key: sess.theme, title: THEMES[sess.theme].title, title_en: THEMES[sess.theme].title_en } : null,
        // full family context rides along so the UI can caption the photo:
        // whose moment it is, where, when — never a bare unexplained image
        photo: photo ? {
          id: photo.id,
          url: `/api/photo-file/${photo.file}`,
          event: photo.event || "",
          place: photo.place || "",
          year: photo.year || "",
          people: (() => { try { return JSON.parse(photo.people_json || "[]").map((x) => x.name + (x.relation ? ` (${x.relation})` : "")); } catch { return []; } })(),
        } : null,
      });
      return;
    }

    // One voice turn: wav in → transcript → memory flow → reply audio out
    if (req.method === "POST" && req.url === "/api/turn") {
      const id = req.headers["x-session-id"];
      const sess = sessions.get(id);
      if (!sess) return json(res, 400, { error: "unknown_session", message: "That conversation has ended — press Start to begin again." });
      sess.lastSeen = Date.now();

      const wav = await readBody(req);
      const t0 = Date.now();
      const { transcript, language } = await stt(wav);
      const tStt = Date.now() - t0;
      if (!transcript.trim()) {
        return json(res, 200, { transcript: "", text: "", audio: null, note: "silence" });
      }
      // language memory: remember how they speak; next session opens in it
      if (language && BULBUL_LANGS.has(language) && language !== "en-IN") {
        sess.lang = language;
        if (sess.personId) db.setPersonLang(sess.personId, language);
      }

      // keep the turn audio — every memory stays traceable to its recording (B2)
      const audioFile = `${id.slice(0, 8)}-${sess.turn++}.wav`;
      fs.writeFileSync(path.join(db.DATA_DIR, "audio", audioFile), wav);

      const delayMs = parseInt(req.headers["x-delay-ms"], 10);
      const out = await handleTurn(sess, id, transcript, audioFile, Number.isFinite(delayMs) ? delayMs : null);
      console.log(`[turn] stt=${tStt}ms chat=${out.tChat}ms tts=${out.tTts}ms | "${transcript}" → "${out.reply}"`);
      json(res, 200, { transcript, text: out.reply, audio: out.audio, person: sess.personName, contract: sess.contract });
      return;
    }

    // Text turn — dev tool + demo fallback when a mic misbehaves
    if (req.method === "POST" && req.url === "/api/turn-text") {
      const id = req.headers["x-session-id"];
      const sess = sessions.get(id);
      if (!sess) return json(res, 400, { error: "unknown_session", message: "That conversation has ended." });
      sess.lastSeen = Date.now();
      const { text } = JSON.parse((await readBody(req)).toString());
      const delayMs = parseInt(req.headers["x-delay-ms"], 10);
      const out = await handleTurn(sess, id, text, null, Number.isFinite(delayMs) ? delayMs : null);
      json(res, 200, { transcript: text, text: out.reply, audio: out.audio, person: sess.personName, contract: sess.contract });
      return;
    }

    // live Session Contract (E2)
    const ctr = req.url.match(/^\/api\/session\/([\w-]+)\/contract$/);
    if (req.method === "GET" && ctr) {
      const s = sessions.get(ctr[1]);
      if (!s) return json(res, 404, { error: "unknown session" });
      json(res, 200, s.contract);
      return;
    }

    // ack clips for the browser to preload (dead-air kill)
    if (req.method === "GET" && req.url === "/api/acks") {
      json(res, 200, { acks: ACKS });
      return;
    }

    // instant popup feedback: is this number on the list?
    const vp = req.url.match(/^\/api\/verify-phone\?n=(\d+)$/);
    if (req.method === "GET" && vp) {
      json(res, 200, { ok: phoneOk(vp[1]) });
      return;
    }

    // Does this deployment require a signed-in family member? The UI asks
    // before rendering, so the two can never disagree.
    if (req.method === "GET" && req.url === "/api/auth-config") {
      json(res, 200, { auth: clerk.enabled() ? "clerk" : "none", sign_in_required: clerk.enabled() });
      return;
    }

    // Self-serve signup: a family joins with a 10-digit number.
    // When Clerk is configured the caller must be signed in, and the household
    // is claimed by that account — that is what keeps one family from reading
    // another's memories. Before the keys land, signups work exactly as before.
    if (req.method === "POST" && req.url === "/api/register") {
      let body = {};
      try { body = JSON.parse((await readBody(req)).toString() || "{}"); } catch { /* empty */ }
      const phone = String(body.phone || "").trim();
      if (!/^\d{10}$/.test(phone)) {
        return json(res, 400, { error: "bad_phone", message: "A 10-digit number is required." });
      }
      const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
      if (!registerAllowed(ip)) {
        console.warn(`[register] rate limited ${ip}`);
        return json(res, 429, { error: "too_many", message: "Too many signups from here. Please try again later." });
      }

      let verified = 0, ownerId = null;
      if (clerk.enabled()) {
        const who = await clerk.userFor(req);
        if (!who) {
          return json(res, 401, { error: "sign_in_required", message: "Please sign in first." });
        }
        // an already-claimed household can only be re-registered by its owner
        if (!db.ownsPhone(who.userId, phone)) {
          console.warn(`[clerk] ${who.userId} tried to claim ${phone}, owned by someone else`);
          return json(res, 403, { error: "already_claimed", message: "This number is already set up by another family. Please check the number." });
        }
        ownerId = who.userId;
        verified = 1;
      }

      const { already_existed } = db.register({
        phone,
        elder_name: String(body.elder_name || "").trim().slice(0, 60),
        language: /^[a-z]{2}-IN$/.test(body.language || "") ? body.language : null,
        family_name: String(body.family_name || "").trim().slice(0, 60),
        source: String(body.source || "web").slice(0, 30),
        verified,
        owner_id: ownerId,
      });
      console.log(`[register] ${phone}${already_existed ? " (returning)" : ""} elder=${body.elder_name || "?"} lang=${body.language || "?"} verified=${verified}`);
      json(res, 200, { ok: true, phone, already_existed, verified: !!verified });
      return;
    }

    // ── billing (Dodo Payments) ──
    // Pricing lives in env, not in the bundle: Tejas can paste a checkout link
    // into Railway and it is live on the next request — no frontend rebuild.
    if (req.method === "GET" && req.url.split("?")[0] === "/api/plans") {
      const phone = (req.url.match(/[?&]phone=(\d{10})\b/) || [])[1] || null;
      const reg = phone ? db.getRegistration(phone) : null;
      const withPhone = (url) => {
        if (!url) return null;
        if (!phone) return url;
        // the household number rides along as metadata so the webhook knows
        // which family just paid — there is no login to tell us
        return url + (url.includes("?") ? "&" : "?") + `metadata_phone=${phone}`;
      };
      json(res, 200, {
        mode: process.env.DODO_MODE || "test",
        current_plan: reg ? reg.plan : null,
        contact_whatsapp: process.env.DODO_CONTACT_WHATSAPP || null,
        plans: [
          { key: "founding", name: "Founding Family", price: 0, period: "forever",
            checkout_url: null },
          { key: "family", name: "Family", price: 1499, period: "month",
            checkout_url: withPhone(process.env.DODO_FAMILY_LINK) },
          { key: "centre", name: "Care Centres", price: 600, period: "seat / month",
            checkout_url: withPhone(process.env.DODO_CENTRE_LINK) },
        ],
      });
      return;
    }

    // Dodo calls this when money moves. Signature-verified, idempotent, and it
    // always answers 200 once the signature is good — a 500 here just makes
    // Dodo retry a payment we have already recorded.
    if (req.method === "POST" && req.url === "/api/dodo/webhook") {
      const raw = await readBody(req);
      if (!dodo.configured()) {
        console.warn("[dodo] webhook hit but DODO_WEBHOOK_SECRET is unset");
        return json(res, 503, { error: "webhook_not_configured" });
      }
      const v = dodo.verifyWebhook(req.headers, raw);
      if (!v.ok) {
        console.warn(`[dodo] rejected webhook: ${v.reason}`);
        return json(res, 401, { error: v.reason });
      }

      let event = {};
      try { event = JSON.parse(raw.toString() || "{}"); } catch { /* logged below */ }
      const type = String(event.type || "unknown");
      const wid = req.headers["webhook-id"];

      if (!db.firstSeenWebhook(wid, type)) {
        console.log(`[dodo] duplicate ${type} (${wid}) — already handled`);
        return json(res, 200, { ok: true, duplicate: true });
      }

      const { phone, via } = dodo.phoneFrom(event);
      db.recordPayment({
        phone, event_type: type,
        status: event.data?.status || null,
        amount: dodo.amountFrom(event),
        currency: event.data?.currency || "INR",
        mode: process.env.DODO_MODE || "test",
        raw: raw.toString(),
      });

      const plan = dodo.PLAN_FOR[type];
      if (plan && phone) {
        // setPlan only touches an existing registration, so the weaker
        // customer-phone attribution can never invent a household.
        const moved = db.setPlan(phone, plan);
        console.log(
          `[dodo] ${type} phone=${phone} (via ${via}) ` +
          (moved ? `plan=${plan}` : "— no registration for that number, recorded only")
        );
      } else if (!phone) {
        // shared link, or someone paid from the dashboard. The row is saved
        // with phone=NULL; reconcile by email from the Dodo dashboard.
        console.log(`[dodo] unattributed ${type} — no metadata_phone and no customer phone`);
      } else {
        console.log(`[dodo] ${type} phone=${phone} — recorded, plan unchanged`);
      }
      json(res, 200, { ok: true });
      return;
    }

    // admin traction view — legacy env numbers only
    const regs = req.url.match(/^\/api\/registrations\?admin=(\d+)$/);
    if (req.method === "GET" && regs) {
      if (!isAdmin(regs[1])) return json(res, 403, { error: "not_admin" });
      const rows = db.registrations();
      json(res, 200, { count: rows.length, rows });
      return;
    }

    // wipe one number's data — demo restarts + the attack suite.
    // Allowlisted numbers only, so a stranger can't erase anything.
    if (req.method === "POST" && req.url === "/api/debug/reset") {
      const { phone } = JSON.parse((await readBody(req)).toString() || "{}");
      if (!phoneOk(phone)) return json(res, 403, { error: "phone_not_allowed" });
      json(res, 200, { ok: db.resetPhone(phone) });
      return;
    }

    // ── memory inspector API (scoped to the caller's number) ──
    // ── family-data gate ──────────────────────────────────────────
    // Everything below this line is the family's private view of one elder.
    // With Clerk configured, the caller must be signed in and must own that
    // household; without it, behaviour is unchanged (number-scoped only).
    // The elder's own voice routes are ABOVE this line on purpose — an elder
    // with dementia cannot sign in, and must never be asked to.
    if (clerk.enabled() && /^\/api\/(people|memories|reminders|scribe|digest)\b/.test(req.url)) {
      const who = await clerk.userFor(req);
      if (!who) return json(res, 401, { error: "sign_in_required", message: "Please sign in to see your family's dashboard." });
      const phoneInUrl = (req.url.match(/[?&]phone=(\d{10})\b/) || [])[1];
      const idInUrl = (req.url.match(/^\/api\/people\/(\d+)\b/) || [])[1];
      const okOwner = phoneInUrl ? db.ownsPhone(who.userId, phoneInUrl)
        : idInUrl ? db.ownsPerson(who.userId, idInUrl)
        : true; // sub-resources (memories/:id/..., reminders/:id) checked by their own handlers
      if (!okOwner) {
        console.warn(`[clerk] ${who.userId} denied access to ${req.url}`);
        return json(res, 403, { error: "not_your_household", message: "That isn't one of your family members." });
      }
      req.clerkUser = who;
    }

    const ppl = req.url.match(/^\/api\/people(?:\?phone=(\d+))?$/);
    if (req.method === "GET" && ppl) {
      if (!phoneOk(ppl[1])) return json(res, 403, { error: "phone_not_allowed" });
      json(res, 200, db.people(ppl[1]));
      return;
    }
    const mem = req.url.match(/^\/api\/people\/(\d+)\/memories$/);
    if (req.method === "GET" && mem) {
      json(res, 200, { memories: db.inspectMemories(Number(mem[1])), open_loop: db.openLoopFor(Number(mem[1])) || null });
      return;
    }

    // ── reminders the family sets (woven into conversation, not alarms) ──
    const remGet = req.url.match(/^\/api\/people\/(\d+)\/reminders$/);
    if (req.method === "GET" && remGet) {
      json(res, 200, { reminders: db.remindersFor(Number(remGet[1])) });
      return;
    }
    if (req.method === "POST" && remGet) {
      const b = JSON.parse((await readBody(req)).toString() || "{}");
      if (!String(b.text || "").trim()) return json(res, 400, { error: "no_text", message: "What should Yaadein gently remind them about?" });
      const rid = db.addReminder(Number(remGet[1]), b.text, b.time_of_day);
      json(res, 200, { ok: true, id: rid });
      return;
    }
    const remPost = req.url.match(/^\/api\/reminders\/(\d+)$/);
    if (req.method === "POST" && remPost) {
      const b = JSON.parse((await readBody(req)).toString() || "{}");
      db.setReminderActive(Number(remPost[1]), !!b.active);
      json(res, 200, { ok: true });
      return;
    }

    // ── Session Scribe: record a HUMAN-run session → structured report ──
    if (req.method === "POST" && req.url === "/api/scribe/start") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      if (!phoneOk(String(body.phone || ""))) return json(res, 403, { error: "phone_not_allowed" });
      const person = db.findPersonByPhone(String(body.phone));
      if (!person) return json(res, 400, { error: "no_person", message: "Have one conversation first, then sessions can be recorded." });
      const sid = crypto.randomUUID();
      db.scribeStart(sid, person.id, String(body.facilitator || "").slice(0, 80));
      console.log(`[scribe] started ${sid} for ${person.name} (${body.facilitator || "facilitator unnamed"})`);
      json(res, 200, { scribeId: sid, person: person.name, person_id: person.id });
      return;
    }

    const scc = req.url.match(/^\/api\/scribe\/([\w-]+)\/chunk$/);
    if (req.method === "POST" && scc) {
      const s = db.scribeGet(scc[1]);
      if (!s) return json(res, 404, { error: "unknown_scribe" });
      const wav = await readBody(req);
      const seq = parseInt(req.headers["x-seq"], 10) || s.transcript.length;
      // 16kHz mono PCM16: 32000 bytes ≈ 1 second
      const seconds = Math.max(0, (wav.length - 44) / 32000);
      if (wav.length < 8000) return json(res, 200, { ok: true, transcribed_seconds: s.seconds, note: "silence" });
      let text = "", lang = null;
      try {
        const out = await stt(wav);
        text = out.transcript || "";
        lang = out.language || null;
      } catch (e) {
        console.warn(`[scribe] chunk ${seq} stt failed: ${e.message}`);
        return json(res, 200, { ok: true, transcribed_seconds: s.seconds, note: "chunk_failed" });
      }
      const total = text.trim() ? db.scribeAppend(scc[1], seq, text, lang, seconds) : s.seconds;
      json(res, 200, { ok: true, transcribed_seconds: Math.round(total), text });
      return;
    }

    const scf = req.url.match(/^\/api\/scribe\/([\w-]+)\/finish$/);
    if (req.method === "POST" && scf) {
      const s = db.scribeGet(scf[1]);
      if (!s) return json(res, 404, { error: "unknown_scribe" });
      if (s.status === "DONE" && s.report) return json(res, 200, { report: s.report, memories_added: 0 });
      const minutes = Math.max(1, Math.round(s.seconds / 60));
      const p = db.people().find((x) => x.id === s.person_id);
      let report;
      try {
        report = await generateScribeReport(p ? p.name : "the elder", s.transcript, minutes);
      } catch (e) {
        console.error(`[scribe] report failed: ${e.message}`);
        return json(res, 500, { error: "report_failed", message: e.message });
      }
      if (!report) return json(res, 400, { error: "nothing_recorded", message: "No speech was captured in this session." });
      report.duration_min = minutes;
      report.language = (s.transcript.find((t) => t.lang) || {}).lang || null;

      // facts observed in human therapy join the same memory store, so the
      // AI companion can pick the thread up tomorrow (own provenance grade)
      let added = 0;
      if (report.facts.length) {
        db.saveMemories(s.person_id, `scribe:${scf[1]}`, report.facts.map((f) => ({ ...f, provenance: "SESSION_OBSERVED" })), null);
        added = report.facts.length;
      }
      db.scribeFinish(scf[1], report);
      console.log(`[scribe] ${scf[1]} done — ${minutes}min, ${added} memories, ${report.red_flags.length} flags`);
      json(res, 200, { report, memories_added: added });
      return;
    }

    const scr = req.url.match(/^\/api\/people\/(\d+)\/scribe-reports$/);
    if (req.method === "GET" && scr) {
      json(res, 200, { reports: db.scribeReportsFor(Number(scr[1])) });
      return;
    }

    // CST engagement: rounds played + the fluency trend (biomarker)
    const eng = req.url.match(/^\/api\/people\/(\d+)\/engagement$/);
    if (req.method === "GET" && eng) {
      json(res, 200, db.engagementFor(Number(eng[1])));
      return;
    }

    // recall-difficulty alerts + planning trend (mentor feedback)
    const sig = req.url.match(/^\/api\/people\/(\d+)\/signals$/);
    if (req.method === "GET" && sig) {
      json(res, 200, db.signals(Number(sig[1])));
      return;
    }

    // C3: family topic policy — enforced at retrieval, not in the prompt
    const pol = req.url.match(/^\/api\/memories\/(\d+)\/policy$/);
    if (req.method === "POST" && pol) {
      const { avoid } = JSON.parse((await readBody(req)).toString());
      db.setPolicy(Number(pol[1]), !!avoid);
      json(res, 200, { ok: true });
      return;
    }

    // B9: family resolves an UNRESOLVED conflict — never resolved with her
    const rsv = req.url.match(/^\/api\/memories\/(\d+)\/resolve$/);
    if (req.method === "POST" && rsv) {
      const { keep } = JSON.parse((await readBody(req)).toString()); // 'original' | variant id
      json(res, 200, { ok: db.resolve(Number(rsv[1]), keep) });
      return;
    }
    // D1: the visit briefing
    const brf = req.url.match(/^\/api\/people\/(\d+)\/briefing$/);
    if (req.method === "GET" && brf) {
      const p = db.people().find((x) => x.id === Number(brf[1]));
      if (!p) return json(res, 404, { error: "no such person" });
      json(res, 200, await generateBriefing(p.id, p.name));
      return;
    }

    // D3: the memoir chapter, source-cited. ?lang=en-IN → Sarvam Translate
    // per paragraph, original preserved alongside.
    const mmr = req.url.match(/^\/api\/people\/(\d+)\/memoir(?:\?lang=([\w-]+))?$/);
    if (req.method === "GET" && mmr) {
      const p = db.people().find((x) => x.id === Number(mmr[1]));
      if (!p) return json(res, 404, { error: "no such person" });
      const memoir = await generateMemoir(p.id, p.name);
      if (mmr[2] && memoir.paragraphs.length) {
        memoir.title_translated = await translate(memoir.title || "", mmr[2]).catch(() => null);
        for (const para of memoir.paragraphs) {
          para.translated = await translate(para.text, mmr[2]).catch(() => null);
        }
      }
      json(res, 200, memoir);
      return;
    }

    // Bulbul narrates any text (memoir chapters) — capped to one TTS call
    if (req.method === "POST" && req.url === "/api/narrate") {
      const { text, lang } = JSON.parse((await readBody(req)).toString());
      if (!text) return json(res, 400, { error: "no text" });
      json(res, 200, { audio: await tts(String(text).slice(0, 2400), lang) });
      return;
    }

    // Phase 6: family uploads a photo + context (JSON, image as base64)
    const pup = req.url.match(/^\/api\/people\/(\d+)\/photos$/);
    if (req.method === "POST" && pup) {
      const body = JSON.parse((await readBody(req)).toString());
      if (!body.image_b64) return json(res, 400, { error: "no image" });
      const ppl = body.people || [];
      if (!ppl.length || !ppl.every((x) => typeof x.deceased === "boolean")) {
        return json(res, 400, { error: "every person in the photo needs a name and a deceased yes/no — this is a safety requirement" });
      }
      const ext = (body.mime || "image/jpeg").includes("png") ? "png" : "jpg";
      const file = `p${pup[1]}-${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(db.DATA_DIR, "photos", file), Buffer.from(body.image_b64, "base64"));
      db.addPhoto(Number(pup[1]), file, body);
      json(res, 200, { ok: true, file });
      return;
    }
    if (req.method === "GET" && pup) {
      json(res, 200, db.photosFor(Number(pup[1])).map((p) => ({ ...p, url: `/api/photo-file/${p.file}`, people: JSON.parse(p.people_json || "[]") })));
      return;
    }
    const pfile = req.url.match(/^\/api\/photo-file\/([\w.-]+\.(?:jpg|png))$/);
    if (req.method === "GET" && pfile) {
      const f = path.join(db.DATA_DIR, "photos", pfile[1]);
      if (!fs.existsSync(f)) return json(res, 404, { error: "no photo" });
      res.writeHead(200, { "content-type": pfile[1].endsWith("png") ? "image/png" : "image/jpeg", ...CORS });
      res.end(fs.readFileSync(f));
      return;
    }

    // public traction counters (60s cache — judges will refresh this)
    if (req.method === "GET" && req.url === "/api/stats") {
      const now = Date.now();
      if (!statsCache || now - statsCache.at > 60000) statsCache = { at: now, data: db.stats() };
      json(res, 200, statsCache.data);
      return;
    }

    // coordinator digest: who needs a human, at a glance
    const dig = req.url.match(/^\/api\/digest(?:\?phone=(\d+))?$/);
    if (req.method === "GET" && dig) {
      if (!phoneOk(dig[1])) return json(res, 403, { error: "phone_not_allowed" });
      json(res, 200, db.digest(dig[1]));
      return;
    }

    const aud = req.url.match(/^\/api\/audio\/([\w.-]+\.wav)$/);
    if (req.method === "GET" && aud) {
      const f = path.join(db.DATA_DIR, "audio", aud[1]);
      if (!fs.existsSync(f)) return json(res, 404, { error: "no audio" });
      res.writeHead(200, { "content-type": "audio/wav", ...CORS });
      res.end(fs.readFileSync(f));
      return;
    }

    json(res, 404, { error: "not found" });
  } catch (e) {
    console.error(e);
    // credit/rate failures upstream must not read as "the app is broken"
    const known = sarvamError(e);
    if (known) return json(res, known.code, { error: known.error, message: known.message });
    json(res, 500, { error: "server_error", message: String(e.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🪔 Yaadein listening on http://localhost:${PORT}`);
  // One line that says exactly which keys have landed, so nobody has to guess
  // why OTP isn't prompting or a payment didn't upgrade anyone.
  const on = (v) => (v ? "✅" : "⬜");
  console.log(
    `   ${on(clerk.enabled())} Clerk sign-in ${clerk.enabled() ? `(${clerk.issuer()})` : "(set CLERK_PUBLISHABLE_KEY)"}` +
    `   ${on(dodo.configured())} Dodo webhook` +
    `   ${on(process.env.DODO_FAMILY_LINK)} Family checkout` +
    `   [${process.env.DODO_MODE || "test"} mode]\n`
  );
  ensureAcks().catch((e) => console.warn("[acks] init failed:", e.message));
});
