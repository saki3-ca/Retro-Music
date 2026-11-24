import { qs, similarity, pickBest, buildLyrics, cleanTitle } from "./_lib.js";

const LRCLIB = "https://lrclib.net/api/search";

async function searchLrclib(params) {
  try {
    const r = await fetch(LRCLIB + "?" + qs(params), {
      headers: { Accept: "application/json", "User-Agent": "RetroLyricsPlayer/2.0" }
    });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch (e) {
    return [];
  }
}

// Genius only provides metadata (no lyric text). Use it to learn the canonical title/artist.
async function geniusLookup(query, wantedTrack) {
  const key = process.env.GENIUS_API_KEY;
  if (!key || !query) return null;
  try {
    const r = await fetch("https://api.genius.com/search?" + qs({ q: query }), {
      headers: { Authorization: "Bearer " + key }
    });
    if (!r.ok) return null;
    const j = await r.json();
    const hits = (j && j.response && j.response.hits) || [];
    let best = null;
    hits.slice(0, 5).forEach((h) => {
      const s = h && h.result;
      if (!s || !s.title) return;
      const score = similarity(wantedTrack || query, s.title);
      if (!best || score > best.score) {
        best = { score, title: s.title, artist: (s.primary_artist && s.primary_artist.name) || "", art: s.song_art_image_url || "" };
      }
    });
    return best && best.score >= 60 ? best : null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  const q = req.query;
  const artist = String(q.artist || "").trim().slice(0, 200);
  const track = cleanTitle(String(q.track || "")).slice(0, 200);
  const query = String(q.q || `${artist} ${track}`).trim().slice(0, 300);
  const duration = Number(q.duration) || 0;
  const artistReliable = q.artistReliable !== "0";

  if (!track && !query) return res.status(400).json({ error: "Track information is missing." });

  const genius = await geniusLookup(`${artist} ${track}`.trim() || query, track);

  const jobs = [];
  if (genius) jobs.push(searchLrclib({ track_name: genius.title, artist_name: genius.artist }));
  if (artist && track) jobs.push(searchLrclib({ track_name: track, artist_name: artist }));
  if (track) jobs.push(searchLrclib({ track_name: track }));
  if (query) jobs.push(searchLrclib({ q: query }));
  if (track && track !== query) jobs.push(searchLrclib({ q: track }));

  const seen = new Set();
  const candidates = [];
  (await Promise.all(jobs)).flat().forEach((rec) => {
    if (!rec) return;
    const key = `${rec.id || ""}|${rec.trackName}|${rec.artistName}|${rec.duration}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(rec);
  });

  // Prefer Genius' canonical identity when it exists: it is a more trustworthy artist than a channel name.
  const wantTrack = genius ? genius.title : track;
  const wantArtist = genius ? genius.artist : artist;
  const { best } = pickBest(candidates, {
    artist: wantArtist,
    track: wantTrack,
    duration,
    artistReliable: genius ? true : artistReliable
  });

  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  const out = buildLyrics(best && best.record);
  if (genius && genius.art) out.coverArt = genius.art;
  return res.status(200).json(out);
}
