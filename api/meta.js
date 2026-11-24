import { qs } from "./_lib.js";

const YT_URL = /^https?:\/\/((www|m|music)\.)?(youtube\.com|youtu\.be)\//i;

export default async function handler(req, res) {
  const url = String(req.query.url || "").trim();
  if (!YT_URL.test(url)) return res.status(400).json({ error: "Please paste a valid YouTube URL." });
  const response = await fetch("https://www.youtube.com/oembed?" + qs({ url, format: "json" }));
  if (!response.ok) return res.status(502).json({ error: "Video metadata is unavailable." });
  const payload = (await response.json().catch(() => null)) || {};
  res.setHeader("Cache-Control", "s-maxage=86400");
  return res.status(200).json({ title: payload.title || "", channel: payload.author_name || "" });
}
