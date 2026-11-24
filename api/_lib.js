// Shared helpers for the serverless routes. Files starting with "_" are not routed by Vercel.

export const MIN_MATCH = 51;

export function qs(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(String(params[k])))
    .join("&");
}

export function normalize(text) {
  let value = String(text || "").toLowerCase().trim();
  try {
    value = value.normalize("NFD").replace(/[̀-ͯ]/g, "");
  } catch (e) { /* ignore */ }
  value = value.replace(/[‘’“”]/g, "'");
  value = value.replace(/[()[\]{}|,:;.!?'"\-_/\\–—+=*~`@#$%^&<>]+/g, " ");
  value = value.replace(/\b(feat|ft|featuring|official|lyrics?|audio|video|visualizer)\b/gi, " ");
  return value.replace(/\s+/g, " ").trim();
}

function uniqueWords(words) {
  const seen = {};
  const out = [];
  words.forEach((w) => {
    w = String(w || "").trim();
    if (w && !seen[w]) { seen[w] = true; out.push(w); }
  });
  return out;
}

function levenshtein(a, b) {
  let prev = [];
  let cur = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const t = prev; prev = cur; cur = t;
  }
  return prev[b.length];
}

function levSimilarity(a, b) {
  a = a.slice(0, 500);
  b = b.slice(0, 500);
  const max = Math.max(a.length, b.length);
  if (!max) return 100;
  return (1 - levenshtein(a, b) / max) * 100;
}

function wordSimilarity(a, b) {
  const A = uniqueWords(a.split(" "));
  const B = uniqueWords(b.split(" "));
  if (!A.length || !B.length) return 0;
  const hits = A.filter((w) => B.indexOf(w) !== -1).length;
  return (hits / Math.max(A.length, B.length)) * 100;
}

// Share of the SHORTER word list found in the longer one ("A" vs "A & B" -> 100).
export function tokenOverlap(a, b) {
  const A = uniqueWords(normalize(a).split(" "));
  const B = uniqueWords(normalize(b).split(" "));
  if (!A.length || !B.length) return 0;
  const hits = A.filter((w) => B.indexOf(w) !== -1).length;
  return (hits / Math.min(A.length, B.length)) * 100;
}

export function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 100;
  let contain = 0;
  if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) {
    contain = (Math.min(a.length, b.length) / Math.max(a.length, b.length)) * 100;
  }
  return Math.round(Math.max(levSimilarity(a, b), wordSimilarity(a, b), contain));
}

/**
 * Score LRCLIB records against the wanted track/artist.
 * artistReliable=false (e.g. artist came from the channel name) means the artist
 * is a ranking bonus only, never a hard requirement.
 */
export function pickBest(records, { artist, track, duration = 0, artistReliable = true }) {
  const scored = records.map((record) => {
    const titleScore = track ? similarity(track, record.trackName || "") : 0;
    let artistScore = 0;
    if (artist) {
      artistScore = Math.max(
        similarity(artist, record.artistName || ""),
        tokenOverlap(artist, record.artistName || "")
      );
    }
    let accepted;
    if (artist && artistReliable) {
      accepted = titleScore >= MIN_MATCH && (artistScore >= MIN_MATCH || titleScore >= 85);
    } else {
      accepted = titleScore >= MIN_MATCH;
    }
    const finalScore = artist ? Math.round(titleScore * 0.6 + artistScore * 0.4) : titleScore;
    return { record, titleScore, artistScore, finalScore, accepted };
  });

  const ok = scored.filter((s) => s.accepted);
  ok.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    const as = a.record.syncedLyrics ? 1 : 0;
    const bs = b.record.syncedLyrics ? 1 : 0;
    if (bs !== as) return bs - as;
    if (duration) {
      const ad = a.record.duration ? Math.abs(a.record.duration - duration) : Infinity;
      const bd = b.record.duration ? Math.abs(b.record.duration - duration) : Infinity;
      return ad - bd;
    }
    return b.titleScore - a.titleScore;
  });
  return { best: ok[0] || null, scored };
}

export function parseSynced(value) {
  const out = [];
  String(value || "").split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]\s*(.*)$/);
    if (!m) return;
    const text = m[3].trim();
    if (!text) return;
    out.push({ time: Number(m[1]) * 60 + Number(m[2]), text });
  });
  return out.sort((a, b) => a.time - b.time);
}

export function buildLyrics(record) {
  if (!record) return { mode: "missing", lines: [], plainLines: [] };
  const lines = record.syncedLyrics ? parseSynced(record.syncedLyrics) : [];
  const plainLines = String(record.plainLyrics || "")
    .split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length && !plainLines.length) return { mode: "missing", lines: [], plainLines: [] };
  return {
    mode: lines.length ? "synced" : "plain",
    lines,
    plainLines,
    trackName: record.trackName || "",
    artistName: record.artistName || "",
    duration: record.duration || 0
  };
}

export function cleanTitle(value) {
  return String(value || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*(official|video|audio|lyrics?|visuali[sz]er|hd|4k|mv)[^)]*\)/gi, " ")
    .replace(/\b(official\s+(music\s+)?video|official\s+audio|lyric\s+video|lyrics?|visuali[sz]er|full\s+video\s+song|video\s+song)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
