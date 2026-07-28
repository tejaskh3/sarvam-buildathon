"use strict";
/* ── the one door to Sarvam ─────────────────────────────────────────
   Every model call in the product goes through this file.

   It exists because it already existed, eight times. server.js had eight
   `fetch(${SARVAM}/...)` sites, and each one carried its own copy of the same
   three lines: spread the headers, `if (!r.ok) throw`, unwrap the JSON. Eight
   copies of a thing is not a coincidence to tidy up; it is a seam that was
   never named.

   What that cost is the point. Not one of the eight had a timeout, and not one
   had a retry — not because anybody decided against them, but because there
   was nowhere to put them that would not have meant getting the same edit
   right in eight places. A policy with eight homes has no home. Now there is
   one, and the policy is the first thing in the file.

   The methods below also own response unwrapping, so no caller has to know
   that a reply arrives at `choices[0].message.content` or audio at
   `audios[0]`. That is the difference between a wrapper and a module: callers
   learn four verbs instead of four verbs plus Sarvam's JSON shapes.

   Zero npm dependencies, like the rest of the backend. fetch and
   AbortSignal.timeout are both native on Node 22.
   ------------------------------------------------------------------ */

const BASE = process.env.SARVAM_BASE_URL || "https://api.sarvam.ai";

/* Budgets, measured rather than guessed (28 Jul, live API):
   Saaras answered in ~372–885ms regardless of clip length, Bulbul in
   ~1.4–3.4s regardless of reply length, an ordinary chat turn in ~560ms–2s.
   All three are dominated by fixed per-call overhead, so these ceilings sit
   far above the observed spread — they are there to end a hang, not to police
   a slow call. Long-form generation (memoir, scribe) runs to 1600 tokens and
   nobody is waiting on it out loud, so it gets its own far looser budget. */
const VOICE_TIMEOUT_MS = 15_000;
const LONGFORM_TIMEOUT_MS = 60_000;

/* Retry only what is worth retrying.

   A 429 or a 502 fails fast and usually succeeds on the second ask, so it is
   retried. A timeout does NOT get retried, and that asymmetry is deliberate:
   the elder is already sitting in silence behind a wave, and turning one
   15-second hang into a 30-second hang would be the worst possible way to
   "improve reliability". A hang costs one budget and then surfaces.

   Every call this file makes is a generation or a transcription — read-only
   as far as Sarvam is concerned — so a retry can never double an effect. */
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 400;

class SarvamError extends Error {
  constructor(label, status, body) {
    /* The message keeps "<label> <status>:" because sarvamError() in
       server.js reads the status back out of it to tell a family "a lot of
       families are talking right now" rather than showing them a number.
       Changing this format silently breaks that message. */
    super(`${label} ${status}: ${body}`);
    this.name = "SarvamError";
    this.status = status;
    this.label = label;
  }
}

class SarvamTimeout extends Error {
  constructor(label, ms) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "SarvamTimeout";
    this.label = label;
    this.timeout = true;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* How long to wait before the one retry. Sarvam's own Retry-After wins when
   it sends one; otherwise a short jittered pause, so that a burst of families
   hitting a rate limit together does not retry in lockstep. */
function backoffMs(res) {
  const hinted = Number(res && res.headers && res.headers.get("retry-after"));
  if (Number.isFinite(hinted) && hinted > 0) return Math.min(hinted * 1000, 5_000);
  return RETRY_DELAY_MS + Math.floor(Math.random() * RETRY_DELAY_MS);
}

/**
 * One HTTP call to Sarvam, with the whole policy applied.
 * @returns {Promise<any>} the parsed JSON body
 */
async function request(pathname, { label, body, form, timeoutMs = VOICE_TIMEOUT_MS, retries = 1 } = {}) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error(`${label}: SARVAM_API_KEY is not set`);

  let attempt = 0;
  for (;;) {
    let res;
    try {
      res = await fetch(`${BASE}${pathname}`, {
        method: "POST",
        headers: {
          "api-subscription-key": key,
          /* FormData must set its own content-type — it carries the multipart
             boundary, and overriding it makes the upload unparseable. */
          ...(form ? {} : { "content-type": "application/json" }),
        },
        body: form || JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      /* AbortSignal.timeout raises TimeoutError; a dropped connection raises
         a TypeError. The first is deliberately terminal, the second is worth
         one more go. */
      if (e && (e.name === "TimeoutError" || e.name === "AbortError")) {
        throw new SarvamTimeout(label, timeoutMs);
      }
      if (attempt++ < retries) {
        console.warn(`[sarvam] ${label} network error (${e.message}) — retrying once`);
        await sleep(backoffMs(null));
        continue;
      }
      throw e;
    }

    if (res.ok) return res.json();

    const text = await res.text().catch(() => "");
    if (RETRY_STATUS.has(res.status) && attempt++ < retries) {
      const wait = backoffMs(res);
      console.warn(`[sarvam] ${label} ${res.status} — retrying in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    throw new SarvamError(label, res.status, text);
  }
}

/* ── the four verbs ─────────────────────────────────────────────── */

/**
 * A chat completion. Returns the reply text, or the parsed object when
 * `json` is set — callers never touch `choices[0].message.content`.
 */
async function chat({ model, messages, temperature = 0.4, maxTokens = 160, json = false, label = "chat", timeoutMs }) {
  const body = {
    model,
    temperature,
    max_tokens: maxTokens,
    // sarvam-30b is a reasoning model; null disables thinking → fast voice turns
    reasoning_effort: null,
    ...(json ? { response_format: { type: "json_object" } } : {}),
    messages,
  };
  const j = await request("/v1/chat/completions", { label, body, timeoutMs });
  const raw = j.choices[0].message.content;
  return json ? raw : raw.trim();
}

/** Transcribe one wav. Returns `{ transcript, language }`. */
async function stt(wavBuffer, { model, mode, label = "STT", timeoutMs } = {}) {
  const form = new FormData();
  form.append("file", new Blob([wavBuffer], { type: "audio/wav" }), "turn.wav");
  form.append("model", model);
  form.append("mode", mode);
  const j = await request("/speech-to-text", { label, form, timeoutMs });
  return { transcript: j.transcript || "", language: j.language_code || null };
}

/** Synthesize speech. Returns a base64 wav. */
async function tts({ text, model, speaker, pace, temperature, language, sampleRate = 24000, label = "TTS", timeoutMs }) {
  const j = await request("/text-to-speech", {
    label,
    timeoutMs,
    body: {
      text,
      model,
      speaker,
      pace,
      temperature,
      target_language_code: language,
      speech_sample_rate: sampleRate,
      output_audio_codec: "wav",
    },
  });
  return j.audios[0];
}

/** Translate one string. Returns the translated text. */
async function translate({ input, source, target, label = "translate", timeoutMs }) {
  const j = await request("/translate", {
    label,
    timeoutMs,
    body: { input, source_language_code: source, target_language_code: target },
  });
  return j.translated_text;
}

module.exports = {
  chat, stt, tts, translate,
  SarvamError, SarvamTimeout,
  VOICE_TIMEOUT_MS, LONGFORM_TIMEOUT_MS,
  /* exported for the tests, which drive the policy directly rather than
     through four wrappers that would each need their own fake */
  request,
};
