// Yaadein — Phase 0/1 walking skeleton
// Turn-based voice conversation: agent LEADS, user replies by voice.
// Zero npm dependencies — Node 22 built-ins only (fetch, FormData, Blob).
//
// Run:  node app/server.js   (reads app/.env for SARVAM_API_KEY)

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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
   BAN hain ye shabd (kabhi mat bolo): "yaad hai?", "yaad karo", "yaad aa raha hai?", "batao kaun tha", "kab hua tha", "kahan hua tha".
   Achha udaharan: "Aapne bataya ki aapka bachpan gaon mein beeta. Wahan subah kaisi lagti thi?"
   Bura udaharan: "Aapko yaad hai aapka gaon kaunsa tha?"
5. Sirf woh tathya bolo jo unhone khud is baat-cheet mein kahe hain. Kabhi koi nayi jaankari mat gadho, kabhi anuman ko sach ki tarah mat bolo.
6. Achhe shuruaati vishay (jab kuch pata na ho): bachpan ka ghar ya gaon, tyohar, khana-peena, school ke din, dost. Shaadi, bachche, ya parivar ke bare mein khud se mat poochho — agar woh khud batayein toh garmjoshi se saath do.
7. Agar woh kuch bhool jayein ya atak jayein, aaram se aage badh jao — koi hint-game nahi, koi sudhaar nahi.
8. Agar woh koi nayi baat batayein, usi mein dilchaspi lo — apna agenda chhod do.
9. Chhote vaakya. Garam, saral, bolchal wali Hindi (Devanagari mein). Angrezi shabd aa jayein toh theek hai. Jawab 2 vaakya se zyada nahi + ek chhota sawaal.

Output sirf bolne wala text — koi asterisk, emoji, ya stage direction nahi.`;

// ─── in-memory sessions (Phase 2 → Postgres) ──────────────────────
const sessions = new Map(); // id → { history: [{role, content}] }

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
const BANNED = /(yaad\s+(hai|karo|aa\s*rah[ia]|aay[ia])|याद\s+(है|करो|आ\s*रह[ीा]|आय[ीा]))/i;

async function chat(history) {
  let reply = await chatOnce(history);
  if (BANNED.test(reply)) {
    console.warn(`[guard] recall-test phrase blocked: "${reply}"`);
    reply = await chatOnce([
      ...history,
      { role: "assistant", content: reply },
      { role: "user", content: "(system: us vaakya mein memory-test tha. Wahi baat dobara kaho, lekin bina 'yaad' shabd ke — seedha kathan + ek bhavna-wala sawaal.)" },
    ]);
    if (BANNED.test(reply)) reply = reply.replace(BANNED, "").replace(/\?\s*$/, ".");
  }
  return reply;
}

async function chatOnce(history) {
  const r = await fetch(`${SARVAM}/v1/chat/completions`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({
      model: CFG.chatModel,
      temperature: 0.4,
      max_tokens: 300,
      // sarvam-30b is a reasoning model; null disables thinking → fast voice turns
      reasoning_effort: null,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
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

    // Agent opens the conversation — agent-led from turn zero (A9, B1)
    if (req.method === "POST" && req.url === "/api/session/start") {
      const id = crypto.randomUUID();
      const history = [];
      const opener = await chat([
        ...history,
        { role: "user", content: "(session shuru — namaste kaho, ek vaakya parichay, aur naam poochho)" },
      ]);
      history.push({ role: "assistant", content: opener });
      sessions.set(id, { history });
      const audio = await tts(opener);
      json(res, 200, { sessionId: id, text: opener, audio });
      return;
    }

    // One voice turn: wav in → transcript, reply text, reply audio out
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

      sess.history.push({ role: "user", content: transcript });
      const t1 = Date.now();
      const reply = await chat(sess.history);
      const tChat = Date.now() - t1;
      sess.history.push({ role: "assistant", content: reply });

      const t2 = Date.now();
      const audio = await tts(reply);
      const tTts = Date.now() - t2;

      console.log(`[turn] stt=${tStt}ms chat=${tChat}ms tts=${tTts}ms | "${transcript}" → "${reply}"`);
      json(res, 200, { transcript, text: reply, audio, timings: { stt: tStt, chat: tChat, tts: tTts } });
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
