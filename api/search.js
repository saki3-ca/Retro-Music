import { qs } from "./_lib.js";

export default async function handler(req, res) {
  const query = String(req.query.q || "").trim().slice(0, 200);
  if (!query) return res.status(400).json({ error: "Enter a song or artist." });

  const key = process.env.YOUTUBE_API_KEY || String(req.headers["x-yt-key"] || "").trim();
  if (!key) return res.status(200).json({ needsKey: true, results: [] });

  const url = "https://www.googleapis.com/youtube/v3/search?" + qs({
    part: "snippet", q: query, type: "video", videoCategoryId: "10",
    videoEmbeddable: "true", maxResults: "6", safeSearch: "moderate", key
  });

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message;
    return res.status(502).json({ error: message || "YouTube search failed. Check the API key and quota." });
  }
  const items = payload && Array.isArray(payload.items) ? payload.items : [];
  const results = items
    .filter((i) => i && i.id && i.id.videoId && i.snippet && i.snippet.title)
    .map((i) => ({
      videoId: i.id.videoId,
      title: i.snippet.title,
      channel: i.snippet.channelTitle || "Unknown channel"
    }));

  // Cache per query on the CDN, but never when the caller supplied their own key.
  if (process.env.YOUTUBE_API_KEY) res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({ needsKey: false, results });
}
