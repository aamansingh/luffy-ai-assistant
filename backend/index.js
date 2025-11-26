// // // backend/index.js
// // require("dotenv").config();
// // const express = require("express");
// // const cors = require("cors");
// // const fs = require("fs");
// // const path = require("path");

// // const app = express();
// // app.use(cors());
// // app.use(express.json());

// // const PORT = process.env.PORT || 4000;
// // const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

// // console.log("GEMINI_KEY length:", (GEMINI_KEY || "").length);

// // // ---------- Gemini endpoint (working model from your allowed list) ----------
// // const MODEL = "models/gemini-2.0-flash-lite"; // chosen from list_models output
// // // Use v1beta path for generateContent (works with 2.0 models)
// // const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${GEMINI_KEY}`;

// // app.post("/api/chat", async (req, res) => {
// //   try {
// //     const prompt = (req.body.message || "").toString();
// //     if (!prompt) return res.json({ reply: "No input" });

// //     const r = await fetch(GEMINI_URL, {
// //       method: "POST",
// //       headers: { "Content-Type": "application/json" },
// //       body: JSON.stringify({
// //         contents: [{ parts: [{ text: prompt }] }]
// //       })
// //     });

// //     const raw = await r.text();
// //     // debug log (keep short)
// //     console.log("Gemini HTTP:", r.status, r.statusText, "raw len:", raw ? raw.length : 0);

// //     let json = null;
// //     try { json = JSON.parse(raw); } catch (e) { json = null; }

// //     const reply =
// //       json?.candidates?.[0]?.content?.parts?.[0]?.text ||
// //       (json && typeof json === "object" && json?.output && json.output[0]?.content) ||
// //       "No response";

// //     return res.json({ reply });
// //   } catch (err) {
// //     console.error("Chat handler error:", err);
// //     return res.status(500).json({ error: "Server error", detail: err.message });
// //   }
// // });

// // // ---------- Simple file-based chat persistence ----------
// // const CHATS_FILE = path.join(__dirname, "chats.json");

// // // ensure file exists
// // if (!fs.existsSync(CHATS_FILE)) {
// //   fs.writeFileSync(CHATS_FILE, "[]", "utf8");
// // }

// // function readChatsFile() {
// //   try {
// //     const raw = fs.readFileSync(CHATS_FILE, "utf8");
// //     return JSON.parse(raw);
// //   } catch (e) {
// //     console.error("readChatsFile error", e);
// //     return [];
// //   }
// // }

// // function writeChatsFile(data) {
// //   try {
// //     fs.writeFileSync(CHATS_FILE, JSON.stringify(data, null, 2), "utf8");
// //   } catch (e) {
// //     console.error("writeChatsFile error", e);
// //   }
// // }

// // // GET /api/chats -> return saved chats
// // app.get("/api/chats", (req, res) => {
// //   const chats = readChatsFile();
// //   res.json(chats);
// // });

// // // POST /api/chats -> { chat } upsert by id
// // app.post("/api/chats", (req, res) => {
// //   try {
// //     const chat = req.body.chat;
// //     if (!chat || !chat.id) return res.status(400).json({ error: "bad request" });

// //     const chats = readChatsFile();
// //     const idx = chats.findIndex(c => c.id === chat.id);
// //     if (idx >= 0) {
// //       chats[idx] = chat;
// //     } else {
// //       chats.unshift(chat);
// //     }
// //     writeChatsFile(chats);
// //     return res.json({ ok: true });
// //   } catch (e) {
// //     console.error("POST /api/chats error", e);
// //     return res.status(500).json({ error: "server error", detail: e.message });
// //   }
// // });

// // app.listen(PORT, () => {
// //   console.log(`Backend running on port ${PORT}`);
// // });

// // backend/index.js — corrected: send only valid fields to generateContent
// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");

// const app = express();
// app.use(cors());
// app.use(express.json());

// const PORT = process.env.PORT || 4000;
// const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

// console.log("GEMINI_KEY length:", GEMINI_KEY.length || 0);

// // Use a model from your list_models output
// const GEMINI_MODEL = "models/gemini-2.5-flash"; // change if you prefer another available model
// // Use v1 endpoint pattern for the chosen model (works for generation-capable models)
// const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

// /**
//  * Call Gemini generateContent with a minimal valid body.
//  * We intentionally avoid passing unsupported top-level fields to prevent 400 errors.
//  * Returns: { ok, status, data, raw } where data is parsed JSON when possible.
//  */
// async function callGeminiMinimal(prompt) {
//   const body = {
//     // Minimal valid content structure accepted by generateContent
//     contents: [
//       {
//         parts: [{ text: prompt }]
//       }
//     ]
//   };

//   try {
//     const r = await fetch(GEMINI_URL, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(body)
//     });

//     const raw = await r.text();
//     let parsed = null;
//     try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }

//     return { ok: r.ok, status: r.status, data: parsed, raw };
//   } catch (err) {
//     return { ok: false, status: 0, data: null, raw: String(err) };
//   }
// }

// /* Main chat endpoint: forwards user message to Gemini and returns reply */
// app.post("/api/chat", async (req, res) => {
//   try {
//     const prompt = (req.body.message || "").toString();
//     if (!prompt) return res.status(400).json({ error: "missing message" });

//     const call = await callGeminiMinimal(prompt);
//     if (!call.ok) {
//       console.warn("Gemini call failed:", call.status, call.raw);
//       // return a friendly fallback so frontend isn't stuck with "No response"
//       return res.json({ reply: "No response" });
//     }

//     const reply =
//       call.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
//       call.data?.candidates?.[0]?.message?.content ||
//       null;

//     if (!reply) {
//       console.warn("Gemini returned no reply. Raw response snippet:", (call.raw || "").slice(0, 1000));
//       return res.json({ reply: "No response" });
//     }

//     return res.json({ reply });
//   } catch (err) {
//     console.error("Chat handler error:", err);
//     return res.status(500).json({ error: "Server error", detail: err.message });
//   }
// });

// /* Generate a short chat title for a message using the same minimal call.
//    We give a short instruction and then parse the first line returned. */
// app.post("/api/generate-title", async (req, res) => {
//   try {
//     const text = (req.body.message || "").toString().trim();
//     if (!text) return res.status(400).json({ error: "missing message" });

//     const instruction = `Write a concise chat title (2-6 words) for this user message. Use Title Case, no punctuation. Keep it short and descriptive.\n\nUser message:\n${text}\n\nTitle:`;

//     const call = await callGeminiMinimal(instruction);
//     if (!call.ok) {
//       console.warn("Title generation failed:", call.status, call.raw);
//       return res.json({ title: null, ok: false, raw: call.raw });
//     }

//     const titleText =
//       call.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
//       call.data?.candidates?.[0]?.message?.content ||
//       null;

//     const cleanTitle = titleText ? titleText.split("\n")[0].trim().replace(/^[\W_]+|[\W_]+$/g, "") : null;
//     return res.json({ title: cleanTitle });
//   } catch (err) {
//     console.error("Generate title error:", err);
//     return res.status(500).json({ error: "Server error", detail: err.message });
//   }
// });

// app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

// // Replace the existing /api/chat handler with this robust version.
// // app.post("/api/chat", async (req, res) => {
// //   try {
// //     const prompt = (req.body.message || "").toString();
// //     if (!prompt) return res.status(400).json({ error: "missing message" });

// //     // retry helper: tries fetchFn up to attempts times with simple backoff
// //     async function retry(fn, attempts = 2, delayMs = 400) {
// //       let lastErr = null;
// //       for (let i = 0; i < attempts; i++) {
// //         try {
// //           return await fn();
// //         } catch (e) {
// //           lastErr = e;
// //           if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
// //         }
// //       }
// //       throw lastErr;
// //     }

// //     // actual call function using your existing callGeminiMinimal or inline body
// //     const callFn = async () => {
// //       const body = { contents: [{ parts: [{ text: prompt }] }] };
// //       const r = await fetch(GEMINI_URL, {
// //         method: "POST",
// //         headers: { "Content-Type": "application/json" },
// //         body: JSON.stringify(body),
// //       });

// //       const raw = await r.text();
// //       let parsed = null;
// //       try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }

// //       return { ok: r.ok, status: r.status, data: parsed, raw };
// //     };

// //     // Attempt the call with retries
// //     let call;
// //     try {
// //       call = await retry(callFn, 2, 500);
// //     } catch (err) {
// //       console.error("Gemini request failed after retries:", err);
// //       // friendly fallback
// //       return res.json({ reply: "Sorry — Luffy is temporarily unavailable. Try again in a moment." });
// //     }

// //     // Log detailed info for debugging when not OK or empty
// //     if (!call.ok) {
// //       console.warn("Gemini returned non-OK status:", call.status, "raw:", call.raw?.slice?.(0,2000));
// //       return res.json({ reply: "Sorry — Luffy couldn't process that. Try again." });
// //     }

// //     // Parse reply text robustly
// //     const reply =
// //       call.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
// //       call.data?.candidates?.[0]?.message?.content ||
// //       null;

// //     if (!reply) {
// //       console.warn("Gemini returned no reply text. Raw response (truncated):", (call.raw || "").slice(0,2000));
// //       return res.json({ reply: "Sorry — Luffy didn't return anything. Try rephrasing or try again." });
// //     }

// //     // Success: return the AI reply
// //     return res.json({ reply });
// //   } catch (err) {
// //     console.error("Chat handler unexpected error:", err);
// //     return res.status(500).json({ error: "Server error", detail: err.message });
// //   }
// // });


// backend/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 4000;
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

console.log("[startup] GEMINI_KEY length:", (GEMINI_KEY || "").length);

// Choose a model that your key supports (from your list_models output).
// If you want a different model, replace the string below with one from list_models.js output.
const GEMINI_MODEL = "models/gemini-2.5-flash";
// Use v1 endpoint for the model
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

/**
 * Minimal valid call to generateContent.
 * Returns object { ok, status, data, raw }.
 */
async function callGeminiOnce(prompt) {
  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (e) { data = null; }

    return { ok: res.ok, status: res.status, data, raw };
  } catch (err) {
    return { ok: false, status: 0, data: null, raw: String(err) };
  }
}

/**
 * callGemini with retries/backoff.
 * attempts: number of tries (default 2).
 */
async function callGeminiRetry(prompt, attempts = 2, delayMs = 400) {
  let last;
  for (let i = 0; i < attempts; i++) {
    last = await callGeminiOnce(prompt);
    if (last.ok) return last;
    // If not ok, wait a bit before retrying (exponential)
    await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
  }
  return last;
}

/* Helper: extract reply text safely from different response shapes */
function extractReplyFromData(data) {
  if (!data) return null;
  // Common structure: candidates[0].content.parts[0].text
  const a = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (a) return a;
  // Another possible shape:
  const b = data?.candidates?.[0]?.message?.content;
  if (b) return b;
  // older or alternate shape: output[0].content
  const c = data?.output && Array.isArray(data.output) && data.output[0]?.content;
  if (c) return c;
  return null;
}

/* Robust /api/chat handler */
app.post("/api/chat", async (req, res) => {
  try {
    const prompt = (req.body.message || "").toString();
    if (!prompt) return res.status(400).json({ error: "missing message" });

    // Call Gemini with retries
    const call = await callGeminiRetry(prompt, 2, 500);

    // Debug logging for failure cases
    if (!call.ok) {
      console.warn("[gemini] non-ok response:", call.status, "raw snippet:", (call.raw || "").slice(0, 1000));
      // Friendly fallback so frontend doesn't show "No response"
      return res.json({ reply: "Sorry — Luffy couldn't generate a reply right now. Try again." });
    }

    // Extract text
    const replyText = extractReplyFromData(call.data);

    if (!replyText) {
      console.warn("[gemini] parsed ok but no reply text. raw snippet:", (call.raw || "").slice(0, 2000));
      return res.json({ reply: "Sorry — Luffy didn't return a usable reply. Try again." });
    }

    // Success
    return res.json({ reply: replyText });
  } catch (err) {
    console.error("[/api/chat] unexpected error:", err);
    return res.status(500).json({ error: "server error", detail: String(err) });
  }
});

/* /api/generate-title: produce a short 2-6 word title for the given text/message */
app.post("/api/generate-title", async (req, res) => {
  try {
    const text = (req.body.message || "").toString().trim();
    if (!text) return res.status(400).json({ error: "missing message" });

    // Instruction: short title only. Keep it tight.
    const instruction = `Create a concise chat title in Title Case (2-6 words) for this user message. No punctuation at the end.\n\nUser message:\n${text}\n\nTitle:`;

    const call = await callGeminiRetry(instruction, 2, 400);

    if (!call.ok) {
      console.warn("[title] gemini non-ok:", call.status, "raw:", (call.raw || "").slice(0, 1000));
      return res.json({ title: null, ok: false });
    }

    const titleRaw = extractReplyFromData(call.data);
    if (!titleRaw) {
      console.warn("[title] no title returned. raw:", (call.raw || "").slice(0, 2000));
      return res.json({ title: null, ok: false });
    }

    // Clean title: first line, trim, remove leading/trailing punctuation
    const firstLine = titleRaw.split("\n")[0].trim();
    const cleaned = firstLine.replace(/^[\W_]+|[\W_]+$/g, "");
    // Keep it short - cut if overly long
    const cleanedShort = cleaned.split(" ").slice(0, 6).join(" ").trim();

    return res.json({ title: cleanedShort || null, ok: true });
  } catch (err) {
    console.error("[/api/generate-title] error:", err);
    return res.status(500).json({ error: "server error", detail: String(err) });
  }
});

/* health */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, model: GEMINI_MODEL });
});

/* start server */
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

