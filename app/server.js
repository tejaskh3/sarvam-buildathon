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
9. Chhote vaakya. Garam, saral, bolchal wali Hindi (Devanagari mein). Angrezi shabd aa jayein toh theek hai. Jawab 2 vaakya se zyada nahi + ek chhota sawaal.

Output sirf bolne wala text — koi asterisk, emoji, ya stage direction nahi.`;

// ─── sessions: history in memory, memories in SQLite ──────────────
const sessions = new Map(); // id → { history, personId, personName, context, turn }

// Build the per-person context block injected as a second system message.
// Phase 3: known facts + the open loop + revisit-scheduler picks for today.
function personContext(personId, personName) {
  const facts = db.memoriesFor(personId);
  const loop = db.openLoopFor(personId);
  if (!facts.length && !loop) return null;
  let ctx = `Ye ${personName} ji hain — inse pehle bhi baat hui hai.`;
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
  return j.transcript || "";
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
      max_tokens: 300,
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

async function tts(text) {
  const r = await fetch(`${SARVAM}/text-to-speech`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model: CFG.ttsModel,
      speaker: CFG.speaker,
      pace: CFG.pace,
      temperature: CFG.ttsTemperature,
      target_language_code: CFG.ttsLang,
      speech_sample_rate: 24000,
      output_audio_codec: "wav",
    }),
  });
  if (!r.ok) throw new Error(`TTS ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.audios[0]; // base64 wav
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

// ─── the turn pipeline ─────────────────────────────────────────────
// Unknown person: extraction runs FIRST (blocking) so a returning elder
// is recognized in the same reply ("Aapne bataya tha ki aap Pune mein...").
// Known person: extraction runs in PARALLEL with the reply — memory
// capture never adds latency to the conversation.
async function handleTurn(sess, sessionId, transcript, audioFile) {
  const lastAgent = sess.history.filter((m) => m.role === "assistant").at(-1)?.content;
  sess.history.push({ role: "user", content: transcript });

  let extractP = extract(transcript, lastAgent).catch((e) => {
    console.warn("[extract] failed:", e.message);
    return { name: null, facts: [], open_topic: null };
  });

  if (!sess.personId) {
    const ext = await extractP; // blocking: identity changes THIS reply
    console.log(`[extract-result] ${JSON.stringify(ext).slice(0, 300)}`);
    extractP = Promise.resolve(ext);
    if (ext.name) {
      const { person, returning } = db.findOrCreatePerson(ext.name);
      sess.personId = person.id;
      sess.personName = person.name;
      db.linkSession(sessionId, person.id);
      sess.context = personContext(person.id, person.name);
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
  const audio = await tts(reply);
  const tTts = Date.now() - t2;

  // persist what the extractor found (after reply — never blocks the voice)
  extractP.then((ext) => {
    if (!sess.personId) return;
    if (ext.facts.length) {
      db.saveMemories(sess.personId, sessionId, ext.facts, audioFile);
      console.log(`[memory] +${ext.facts.length} for ${sess.personName}: ${ext.facts.map((f) => f.canonical).join(" | ")}`);
    }
    if (ext.open_topic) db.setOpenLoop(sess.personId, ext.open_topic);
  });

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
      // memory inspector lives in app/public, outside the SPA
      if (clean === "/memory.html") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(fs.readFileSync(path.join(__dirname, "public", "memory.html")));
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
      let hint = null;
      try { hint = JSON.parse((await readBody(req)).toString() || "{}").person || null; } catch { /* no body */ }

      const sess = { history: [], personId: null, personName: null, context: null, turn: 0 };
      let openerInstruction = "(session shuru — namaste kaho, ek vaakya parichay, aur naam poochho)";

      if (hint) {
        const person = db.findPerson(hint); // lookup only — a hint must never create
        if (person) {
          sess.personId = person.id;
          sess.personName = person.name;
          db.linkSession(id, person.id);
          sess.context = personContext(person.id, person.name);
          openerInstruction = `(session shuru — ye ${person.name} ji hain, inka garam swagat karo. Phir adhoora silsila NAAM se kholo, ya sujhayi yaadon mein se ek ka zikr karo: "Aapne bataya tha ki...". Naam mat poochho.)`;
        }
      }

      const opener = await chat([{ role: "user", content: openerInstruction }], sess.context);
      sess.history.push({ role: "assistant", content: opener });
      sessions.set(id, sess);
      const audio = await tts(opener);
      json(res, 200, { sessionId: id, text: opener, audio, person: sess.personName });
      return;
    }

    // One voice turn: wav in → transcript → memory flow → reply audio out
    if (req.method === "POST" && req.url === "/api/turn") {
      const id = req.headers["x-session-id"];
      const sess = sessions.get(id);
      if (!sess) return json(res, 400, { error: "unknown session — press Start again" });

      const wav = await readBody(req);
      const t0 = Date.now();
      const transcript = await stt(wav);
      const tStt = Date.now() - t0;
      if (!transcript.trim()) {
        return json(res, 200, { transcript: "", text: "", audio: null, note: "silence" });
      }

      // keep the turn audio — every memory stays traceable to its recording (B2)
      const audioFile = `${id.slice(0, 8)}-${sess.turn++}.wav`;
      fs.writeFileSync(path.join(db.DATA_DIR, "audio", audioFile), wav);

      const out = await handleTurn(sess, id, transcript, audioFile);
      console.log(`[turn] stt=${tStt}ms chat=${out.tChat}ms tts=${out.tTts}ms | "${transcript}" → "${out.reply}"`);
      json(res, 200, { transcript, text: out.reply, audio: out.audio, person: sess.personName });
      return;
    }

    // Text turn — dev tool + demo fallback when a mic misbehaves
    if (req.method === "POST" && req.url === "/api/turn-text") {
      const id = req.headers["x-session-id"];
      const sess = sessions.get(id);
      if (!sess) return json(res, 400, { error: "unknown session" });
      const { text } = JSON.parse((await readBody(req)).toString());
      const out = await handleTurn(sess, id, text, null);
      json(res, 200, { transcript: text, text: out.reply, audio: out.audio, person: sess.personName });
      return;
    }

    // ── memory inspector API ──
    if (req.method === "GET" && req.url === "/api/people") {
      json(res, 200, db.people());
      return;
    }
    const mem = req.url.match(/^\/api\/people\/(\d+)\/memories$/);
    if (req.method === "GET" && mem) {
      json(res, 200, { memories: db.inspectMemories(Number(mem[1])), open_loop: db.openLoopFor(Number(mem[1])) || null });
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
server.listen(PORT, () => console.log(`\n🪔 Yaadein listening on http://localhost:${PORT}\n`));
