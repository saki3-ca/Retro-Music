import { qs, similarity } from "./_lib.js";

const ALLOWED_SRC = /^https:\/\/(images|assets|t2|s)\.genius\.com\//i;

async function fetchImage(url) {
  const r = await fetch(url, { headers: { "User-Agent": "RetroLyricsPlayer/2.0" } });
  if (!r.ok) return null;
  const type = r.headers.get("content-type") || "";
  if (!/^image\//i.test(type)) return null;
  return { type, body: Buffer.from(await r.arrayBuffer()) };
}

async function itunesCover(artist, track) {
  const term = `${artist} ${track}`.trim();
  if (!term) return null;
  const r = await fetch("https://itunes.apple.com/search?" + qs({ term, entity: "song", media: "music", limit: "8" }));
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const list = (j && j.results) || [];
  let best = null;
  list.forEach((s) => {
    if (!s.artworkUrl100) return;
    const score = similarity(track, s.trackName || "") * 0.6 + (artist ? similarity(artist, s.artistName || "") * 0.4 : 40);
    if (!best || score > best.score) best = { score, url: s.artworkUrl100 };
  });
  if (!best || best.score < 55) return null;
  return fetchImage(best.url.replace(/\/\d+x\d+bb\./, "/400x400bb."));
}

// Same-origin album cover so the browser can read its pixels for the color palette.
export default async function handler(req, res) {
  const artist = String(req.query.artist || "").trim().slice(0, 200);
  const track = String(req.query.track || "").trim().slice(0, 200);
  const src = String(req.query.src || "");
  try {
    let img = await itunesCover(artist, track);
    if (!img && ALLOWED_SRC.test(src)) img = await fetchImage(src);
    if (!img) return res.status(404).json({ error: "No cover found" });
    res.setHeader("Content-Type", img.type);
    res.setHeader("Cache-Control", "public, s-maxage=604800, max-age=86400");
    return res.status(200).send(img.body);
  } catch (e) {
    return res.status(404).json({ error: "No cover found" });
  }
}
