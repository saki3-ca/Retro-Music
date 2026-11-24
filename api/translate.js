import { qs } from "./_lib.js";

export default async function handler(req, res) {
  const text = String(req.query.text || "").trim().slice(0, 500);
  if (!text) return res.status(200).json({ text: "" });
  res.setHeader("Cache-Control", "s-maxage=604800, stale-while-revalidate=604800");

  try {
    const gKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (gKey) {
      const r = await fetch("https://translation.googleapis.com/language/translate/v2?key=" + encodeURIComponent(gKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, target: "en", format: "text" })
      });
      const j = await r.json();
      const out = j && j.data && j.data.translations && j.data.translations[0];
      if (out && out.translatedText) return res.status(200).json({ text: out.translatedText });
    }
    // Free fallback. MyMemory needs a source language, so auto-detect with a cheap heuristic.
    const source = /[ঀ-৿]/.test(text) ? "bn" : /[ऀ-ॿ]/.test(text) ? "hi" : /[؀-ۿ]/.test(text) ? "ur" : "autodetect";
    const r = await fetch("https://api.mymemory.translated.net/get?" + qs({ q: text, langpair: source + "|en" }));
    const j = await r.json();
    const out = j && j.responseData && j.responseData.translatedText;
    return res.status(200).json({ text: out && !/MYMEMORY WARNING/i.test(out) ? out : text });
  } catch (e) {
    return res.status(200).json({ text });
  }
}
