// Turns LRCLIB lines into per-word timestamps.
// LRCLIB has line timestamps only, so words are spread across each line weighted by length.

function windowFor(lines, i, duration) {
  const start = lines[i].time;
  const next = lines[i + 1] ? lines[i + 1].time : 0;
  const text = String(lines[i].text || "");
  const fallback = duration > start ? duration : start + Math.max(4, Math.min(12, text.length * .18));
  const end = next > start ? next : fallback;
  const readable = Math.max(3.2, Math.min(7, 2.4 + text.length * .085));
  const visibleEnd = end - Math.min(end, start + readable) >= 1.25 ? Math.min(end, start + readable) : end;
  return { start, end, visibleEnd };
}

function spreadWords(text, start, span) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const weights = words.map((w) => Math.max(1, w.replace(/[^\p{L}\p{N}]/gu, "").length) + 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  // words land in the first ~85% of the window so the last one is not a flash
  const usable = span * 0.85;
  let acc = 0;
  return words.map((w, i) => {
    const t = start + (acc / total) * usable;
    acc += weights[i];
    return { w, t };
  });
}

export function buildWordTimeline(lyrics, duration) {
  const out = { lines: [] };
  if (!lyrics) return out;
  if (lyrics.mode === "synced" && lyrics.lines.length) {
    lyrics.lines.forEach((l, i, arr) => {
      const win = windowFor(arr, i, duration);
      out.lines.push({
        text: l.text, start: win.start, end: win.end, visibleEnd: win.visibleEnd,
        words: spreadWords(l.text, win.start, Math.max(0.5, win.visibleEnd - win.start))
      });
    });
  } else if (lyrics.mode === "plain" && lyrics.plainLines.length) {
    const n = lyrics.plainLines.length;
    const per = duration ? duration / n : 8;
    lyrics.plainLines.forEach((text, i) => {
      const start = i * per;
      out.lines.push({
        text, start, end: start + per, visibleEnd: start + per,
        words: spreadWords(text, start, per)
      });
    });
  }
  return out;
}
