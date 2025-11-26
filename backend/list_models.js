require("dotenv").config();
const fetch = global.fetch || require("node-fetch");
(async () => {
  const key = process.env.GEMINI_API_KEY || "";
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;
  const r = await fetch(url);
  console.log("models status:", r.status);
  const txt = await r.text();
  console.log(txt.slice(0, 8000));
})();
