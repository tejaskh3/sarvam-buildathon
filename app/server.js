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
7. Agar woh kuch bhool jayein ya atak jayein, aaram se aage badh jao — koi hint-game nahi, koi sudhaar nahi.
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
const phoneOk = (p) => typeof p === "string" && /^\d{10}$/.test(p) && ALLOWED_PHONES.has(p);

// ─── sessions: history in memory, memories in SQLite ──────────────
const sessions = new Map(); // id → { history, personId, personName, context, turn, phone }

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
  const r = await fetch(`${SARVAM}/translate`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({ input: text, source_language_code: source, target_language_code: target }),
  });
  if (!r.ok) throw new Error(`translate ${r.status}: ${await r.text()}`);
  return (await r.json()).translated_text;
}

// C6/C4 guard: recall-testing phrases must never reach her voice.
// Prompt rules alone leak variants ("yaad aa rahi hai?") — enforce in code.
const BANNED = /(yaad\s+(hai|hain|karo|kar|aa\s*rah[ia]|aay[ia]|aat[ia]|aaye|dila)|याद\s+(है|हैं|करो|कर|आ\s*रह[ीा]|आय[ीा]|आत[ीा]|आए|दिला))/i;

async function chat(history, context) {
  let reply = await chatOnce(history, context);
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
  return reply;
}

async function chatOnce(history, context) {
  const r = await fetch(`${SARVAM}/v1/chat/completions`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({
      model: CFG.chatModel,
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
  const turnContext = sess.context
    ? sess.context + (sess.recognitionNudge ? `\n\n${sess.recognitionNudge}` : "")
    : null;
  sess.recognitionNudge = null; // one turn only
  const reply = await chat(sess.history, turnContext);
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
    // Optional body {person: "Ramesh"} = device remembers who talks here →
    // the opener itself reopens the unfinished thread by name (RESUMED).
    if (req.method === "POST" && req.url === "/api/session/start") {
      const id = crypto.randomUUID();
      let hint = null, phone = null;
      try {
        const body = JSON.parse((await readBody(req)).toString() || "{}");
        hint = body.person || null;
        phone = String(body.phone || "").trim();
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
      if (hint) {
        const person = db.findPerson(hint, phone); // lookup only — a hint must never create
        if (person) {
          sess.personId = person.id;
          sess.personName = person.name;
          sess.lang = BULBUL_LANGS.has(person.lang) ? person.lang : null; // speak their language from word one
          db.linkSession(id, person.id);
          sess.context = personContext(person.id, person.name, sess.lang);
          if (sess.context) sess.contract.RESUMED = true;
          openerInstruction = `(session shuru — ye ${person.name} ji hain, inka garam swagat karo. Phir adhoora silsila NAAM se kholo, ya sujhayi yaadon mein se ek ka zikr karo: "Aapne bataya tha ki...". Naam mat poochho.)`;

          // Phase 6: an undiscussed family photo becomes the session opener —
          // stated from family context, questions with no wrong answer (F3)
          photo = db.nextNewPhoto(person.id);
          if (photo) {
            const ppl = JSON.parse(photo.people_json || "[]");
            const deceased = ppl.filter((x) => x.deceased).map((x) => x.name);
            openerInstruction = `(session shuru — ye ${person.name} ji hain, garam swagat karo. Unke parivaar ne ek photo bheji hai jo unke saamne screen par aa rahi hai: ${photo.event || "ek yaadgar pal"}${photo.place ? ", " + photo.place : ""}${photo.year ? ", " + photo.year : ""}. Isme hain: ${ppl.map((x) => x.name + (x.relation ? ` (${x.relation})` : "")).join(", ") || "parivaar ke log"}. ${photo.notes ? "Parivaar ne bataya: " + photo.notes + ". " : ""}Photo ko aawaz se BAYAAN karo (unki aankhein kamzor ho sakti hain) — sirf upar di gayi jaankari se, kuch bhi gadho mat. Is turn mein 3 vaakya tak theek hai. Phir EK bhavna-wala sawaal — kabhi "kaun hai / kab tha" jaisa test nahi.${deceased.length ? ` SAAVDHAN: ${deceased.join(", ")} ab nahi rahe — unka zikr sirf past tense mein, unke baare mein khud se sawaal kabhi nahi.` : ""} Naam mat poochho.)`;
            db.markPhotoShown(photo.id);
          }
        }
      }

      let opener = await chat([{ role: "user", content: openerInstruction }], sess.context);
      // language memory: the model won't reliably open in Marathi/Tamil/etc.
      // from an empty history, so the opener goes through Sarvam Translate.
      // Mid-conversation it mirrors her language naturally via STT codemix.
      if (sess.lang && sess.lang !== "hi-IN" && sess.lang !== "en-IN") {
        opener = await translate(opener, sess.lang, "hi-IN").catch(() => opener);
      }
      sess.history.push({ role: "assistant", content: opener });
      sessions.set(id, sess);
      const audio = await tts(opener, sess.lang);
      json(res, 200, {
        sessionId: id, text: opener, audio, person: sess.personName,
        photo: photo ? { id: photo.id, url: `/api/photo-file/${photo.file}`, event: photo.event } : null,
      });
      return;
    }

    // One voice turn: wav in → transcript → memory flow → reply audio out
    if (req.method === "POST" && req.url === "/api/turn") {
      const id = req.headers["x-session-id"];
      const sess = sessions.get(id);
      if (!sess) return json(res, 400, { error: "unknown session — press Start again" });

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
      if (!sess) return json(res, 400, { error: "unknown session" });
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

    // ── memory inspector API (scoped to the caller's number) ──
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
    json(res, 500, { error: String(e.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🪔 Yaadein listening on http://localhost:${PORT}\n`);
  ensureAcks().catch((e) => console.warn("[acks] init failed:", e.message));
});
