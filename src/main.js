import { transliterate } from "transliteration";
import { buildWordTimeline } from "./timing.js";
import { emojiFor } from "./emoji.js";
import { extractPalette } from "./palette.js";

const DEFAULT_LINE = "SEARCH & PLAY";
const NO_LYRIC_LINE = "NO LYRIC SIGNAL // AUDIO CONTINUES";
const SYSTEM_LINES = [DEFAULT_LINE, NO_LYRIC_LINE, ""];
const LAYOUTS = { "word-pop": "wordpop", constellation: "constellation", chat: "chat" };
const THEMES = ["crt-glitch", "neon-grid", "red-arcade", "sunset-pixels", "ice-crt", "word-pop", "constellation", "chat"];

const state = {
  player: null, playerReady: false, pendingTrack: null,
  results: [], currentIndex: -1, currentTrack: null,
  playing: false, currentTime: 0, duration: 0, volume: 80,
  lyricOffset: 0, lyricScale: 1,
  visualTheme: "neon-grid", lyricAnimation: "static", edge: true, dark: true,
  lyrics: { mode: "missing", lines: [], plainLines: [] },
  lyricKey: "", renderKey: "",
  browserKey: "", hasServerKey: false, languageMode: "english",
  timeline: null, gen: 0
};
// Show lines slightly early to hide polling + render latency.
const LEAD = 0.12;
const clock = { base: 0, at: 0 };
const translationCache = Object.create(null);
const els = {};
const $ = (id) => document.getElementById(id);

/* ---------- helpers ---------- */
async function api(path, options) {
  const r = await fetch(path, options);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed (" + r.status + ")");
  return j;
}

function setStatus(m) { els.statusText.textContent = "STATUS: " + m; }

function decodeText(v) {
  const t = document.createElement("textarea");
  t.innerHTML = String(v || "");
  return t.value;
}

function cleanTitle(title) {
  return String(title || "")
    .replace(/\[[^\]]*(official|video|audio|lyrics?|visuali[sz]er|hd|4k)[^\]]*\]/gi, "")
    .replace(/\([^)]*(official|video|audio|lyrics?|visuali[sz]er|hd|4k)[^)]*\)/gi, "")
    .replace(/\s+/g, " ").trim();
}

// reliable=false when the artist is only a guess taken from the channel name.
function splitTrack(result) {
  const cleaned = cleanTitle(decodeText(result.title));
  const d = cleaned.match(/\s[-–—|]\s/);
  if (d && typeof d.index === "number") {
    return { artist: cleaned.slice(0, d.index).trim(), track: cleaned.slice(d.index + d[0].length).trim(), reliable: true };
  }
  const by = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
  if (by) return { artist: by[2].trim(), track: by[1].trim(), reliable: true };
  return {
    artist: decodeText(result.channel).replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim(),
    track: cleaned, reliable: false
  };
}

function extractVideoId(value) {
  try {
    const url = new URL(value);
    let id = null;
    if (url.hostname === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    if (url.hostname.indexOf("youtube.com") !== -1) {
      id = /^\/(shorts|embed|live)\//.test(url.pathname) ? url.pathname.split("/")[2] : url.searchParams.get("v");
    }
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  } catch (e) { return null; }
}

function formatTime(s) {
  if (!Number.isFinite(s) || s < 0) return "00:00";
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(Math.floor(s % 60)).padStart(2, "0");
}

/* ---------- language ---------- */
const needsRomanization = (t) => /[^\x00-\x7F]/.test(String(t || ""));
function romanize(text) {
  const v = String(text || "");
  if (!v || !needsRomanization(v)) return v;
  try { return transliterate(v) || v; } catch (e) { return v; }
}

function queueTranslation(text) {
  if (translationCache[text] !== undefined) return;
  translationCache[text] = null;
  api("/api/translate?text=" + encodeURIComponent(text))
    .then((j) => { translationCache[text] = j.text ? decodeText(j.text) : romanize(text); })
    .catch(() => { translationCache[text] = romanize(text); })
    .then(() => { if (state.languageMode === "translate") { state.renderKey = ""; state.lyricKey = ""; } });
}

function displayText(text) {
  const v = String(text || "");
  if (!v || SYSTEM_LINES.indexOf(v) !== -1) return v;
  if (state.languageMode === "original") return v;
  if (state.languageMode === "english") return romanize(v);
  const c = translationCache[v];
  if (c !== undefined && c !== null) return c;
  queueTranslation(v);
  return romanize(v);
}

/* ---------- UI render helpers ---------- */
function showSetup(force) {
  const show = typeof force === "boolean" ? force : els.setupPanel.hidden;
  els.setupPanel.hidden = !show;
  els.configButton.setAttribute("aria-expanded", String(show));
}

function renderKeyState() {
  const on = state.hasServerKey || Boolean(state.browserKey);
  els.configButton.classList.toggle("is-connected", on);
  els.configButton.textContent = state.hasServerKey ? "KEY: SRV" : state.browserKey ? "KEY: ON" : "SETUP";
  els.serverKeyMessage.hidden = !state.hasServerKey;
  els.browserKeyCopy.hidden = state.hasServerKey;
  els.keyInput.hidden = state.hasServerKey;
  els.saveKeyButton.hidden = state.hasServerKey;
}

function renderResults() {
  els.results.replaceChildren();
  state.results.forEach((result, index) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "result-row" + (state.currentTrack && state.currentTrack.videoId === result.videoId ? " active" : "");
    const n = document.createElement("span"); n.className = "result-number"; n.textContent = String(index + 1).padStart(2, "0");
    const copy = document.createElement("span"); copy.className = "result-copy";
    const t = document.createElement("strong"); t.textContent = decodeText(result.title);
    const c = document.createElement("small"); c.textContent = decodeText(result.channel);
    copy.append(t, c);
    const a = document.createElement("span"); a.className = "result-action"; a.textContent = "▶";
    b.append(n, copy, a);
    b.addEventListener("click", () => selectTrack(result, index, els.songInput.value));
    els.results.appendChild(b);
  });
  els.results.hidden = state.results.length === 0;
}
const hideResults = () => { els.results.hidden = true; };

function renderOffset() { els.offsetLabelTop.textContent = (state.lyricOffset >= 0 ? "+" : "") + state.lyricOffset.toFixed(1) + "s"; }
function renderLyricScale() {
  document.documentElement.style.setProperty("--lyric-scale", state.lyricScale.toFixed(2));
  els.sizeLabelTop.textContent = Math.round(state.lyricScale * 100) + "%";
}
function renderAnimationMode() {
  state.lyricAnimation = state.lyricAnimation === "scroll" ? "scroll" : "static";
  els.lyricsWindow.setAttribute("data-animation", state.lyricAnimation);
  els.animationButton.textContent = state.lyricAnimation.toUpperCase();
}
function renderDark() {
  document.body.setAttribute("data-dark", state.dark ? "on" : "off");
  els.darkButton.textContent = "DARK: " + (state.dark ? "ON" : "OFF");
  els.darkButton.setAttribute("aria-pressed", String(state.dark));
}
function renderEdge() {
  document.body.setAttribute("data-edge", state.edge ? "on" : "off");
  els.edgeButton.textContent = "EDGE: " + (state.edge ? "ON" : "OFF");
  els.edgeButton.setAttribute("aria-pressed", String(state.edge));
}
function renderVisualTheme() {
  if (THEMES.indexOf(state.visualTheme) === -1) state.visualTheme = "neon-grid";
  document.body.setAttribute("data-theme", state.visualTheme);
  document.body.setAttribute("data-layout", LAYOUTS[state.visualTheme] || "classic");
  els.themeSelect.value = state.visualTheme;
  state.renderKey = ""; state.lyricKey = "";
}
function renderLanguageMode() {
  if (["original", "english", "translate"].indexOf(state.languageMode) === -1) state.languageMode = "english";
  document.querySelectorAll("[data-language-mode]").forEach((b) =>
    b.setAttribute("aria-checked", String(b.getAttribute("data-language-mode") === state.languageMode)));
}

/* ---------- immersive play mode ---------- */
let uiTimer = 0;
function setMode(mode) {
  document.body.setAttribute("data-mode", mode);
  showUi();
}
function uiPinned() {
  const a = document.activeElement;
  return !els.results.hidden || !els.setupPanel.hidden ||
    (a && a.matches && a.matches("input, select")) ||
    els.topUi.matches(":hover") || els.bottomUi.matches(":hover");
}
function showUi() {
  document.body.setAttribute("data-ui", "show");
  clearTimeout(uiTimer);
  uiTimer = setTimeout(function hideUi() {
    if (document.body.getAttribute("data-mode") !== "play") return;
    if (uiPinned()) { uiTimer = setTimeout(hideUi, 1500); return; }
    document.body.setAttribute("data-ui", "hide");
  }, 3000);
}
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } catch (e) { /* ignore */ }
}

/* ---------- track + lyrics loading ---------- */
function selectTrack(result, index, searchQuery, opts) {
  hideResults();
  setMode("play");
  state.gen++;
  state.currentTrack = result;
  state.currentIndex = index;
  state.currentTime = 0; state.duration = 0;
  clock.base = 0; clock.at = performance.now();
  state.pendingTrack = result;
  state.lyrics = { mode: "missing", lines: [], plainLines: [] };
  state.timeline = null; state.lyricKey = ""; state.renderKey = "";
  els.lyricModeTop.textContent = "NO LRC";
  els.videoPlaceholder.hidden = true;
  els.nowLabel.textContent = "NOW PLAYING";
  els.nowPlaying.textContent = decodeText(result.channel) + " — " + cleanTitle(decodeText(result.title));
  els.progress.value = "0"; els.currentTime.textContent = "00:00"; els.duration.textContent = "00:00";
  renderResults();
  if (state.playerReady && state.player) { state.player.loadVideoById(result.videoId); state.pendingTrack = null; }
  else setStatus("PLAYER INITIALIZING // TRACK QUEUED");
  extractPalette(result.videoId).then((p) => {
    if (state.currentTrack && state.currentTrack.videoId === result.videoId) applyPalette(p);
  });
  if (opts && opts.skipLyrics) { setStatus("VIDEO LOADED // PASTE FAILED TO READ TITLE, NO LYRIC LOOKUP"); return; }
  loadLyrics(result, searchQuery || result.title);
}

function applyPalette(p) {
  const root = document.documentElement.style;
  root.setProperty("--art1", p.c1);
  root.setProperty("--art2", p.c2);
  root.setProperty("--art-dark", p.dark);
}

async function loadLyrics(result, searchQuery) {
  const gen = state.gen;
  const parts = splitTrack(result);
  state.lyricOffset = 0; renderOffset();
  setStatus("TUNING LYRIC FREQUENCY...");
  try {
    const url = "/api/lyrics?" + new URLSearchParams({
      artist: parts.artist, track: parts.track, q: searchQuery || "", artistReliable: parts.reliable ? "1" : "0"
    });
    const payload = await api(url);
    if (gen !== state.gen) return;
    const has = payload && payload.mode !== "missing" &&
      ((payload.lines && payload.lines.length) || (payload.plainLines && payload.plainLines.length));
    if (has) {
      state.lyrics = payload;
      state.timeline = null;
      els.lyricModeTop.textContent = payload.mode === "synced" ? "LRC SYNC" : "PLAIN";
      setStatus(payload.mode === "synced" ? "READY // SYNCED LYRICS FOUND" : "READY // PLAIN LYRICS ONLY");
    } else {
      els.lyricModeTop.textContent = "NO LRC";
      setStatus("READY // NO LYRICS FOUND");
    }
  } catch (error) {
    if (gen !== state.gen) return;
    els.lyricModeTop.textContent = "NO LRC";
    setStatus("LYRICS OFFLINE // AUDIO STILL AVAILABLE");
  }
  state.lyricKey = ""; state.renderKey = "";
}

/* ---------- active lyric / word ---------- */
function getTimeline() {
  if (!state.timeline || state.timeline.stamp !== state.lyrics || state.timeline.dur !== Math.round(state.duration)) {
    state.timeline = buildWordTimeline(state.lyrics, state.duration);
    state.timeline.stamp = state.lyrics;
    state.timeline.dur = Math.round(state.duration);
  }
  return state.timeline;
}

// Returns the current line (+ its word index) for the clock.
function activeInfo() {
  const t = Math.max(0, state.currentTime + state.lyricOffset + LEAD);
  const tl = state.lyrics.mode === "missing" ? null : getTimeline();
  if (!tl || !tl.lines.length) {
    return state.currentTrack
      ? { key: "missing", text: NO_LYRIC_LINE, words: [], idx: -1, line: -1, start: 0, end: 0, next: "" }
      : { key: "idle", text: DEFAULT_LINE, words: [], idx: -1, line: -1, start: 0, end: 0, next: "" };
  }
  let li = -1;
  for (let i = 0; i < tl.lines.length; i++) { if (tl.lines[i].start <= t) li = i; else break; }
  if (li === -1) {
    return { key: "intro", text: "", words: [], idx: -1, line: -1, start: 0, end: tl.lines[0].start || 4, next: tl.lines[0].text };
  }
  const L = tl.lines[li];
  const nxt = tl.lines[li + 1];
  const gone = t >= L.visibleEnd;
  let wi = -1;
  for (let i = 0; i < L.words.length; i++) { if (L.words[i].t <= t) wi = i; else break; }
  return {
    key: gone ? "gap-" + li : "l" + li + "-" + L.start,
    text: gone ? "" : L.text, words: L.words, idx: gone ? -1 : wi, line: li,
    start: L.start, end: gone ? L.end : L.visibleEnd, gap: gone,
    next: nxt ? nxt.text : ""
  };
}

function tick() {
  const a = activeInfo();
  const layout = LAYOUTS[state.visualTheme] || "classic";
  if (layout === "classic") { renderClassic(a); }
  else {
    const rk = layout + "|" + a.key + "|" + a.idx + "|" + state.languageMode;
    if (rk !== state.renderKey) {
      const lineChanged = !state.renderKey.startsWith(layout + "|" + a.key + "|");
      state.renderKey = rk;
      if (layout === "wordpop") renderWordPop(a);
      else if (layout === "constellation") renderConstellation(a, lineChanged);
      else renderChat(a);
    }
    els.nextLyricTop.textContent = displayText(a.next) || "—";
  }
}

/* ----- classic (static cut, or horizontal scroll) ----- */
function renderClassic(a) {
  const scroll = state.lyricAnimation === "scroll";
  if (a.key === state.lyricKey) {
    if (scroll) {
      els.lyric.classList.toggle("paused", !state.playing);
      els.lyric.style.animationPlayState = state.playing ? "running" : "paused";
    }
    return;
  }
  state.lyricKey = a.key;
  const text = displayText(a.text);
  const next = displayText(a.next);
  const caps = state.languageMode === "translate";
  const shown = caps ? text.toUpperCase() : text;
  els.lyric.setAttribute("lang", state.languageMode === "original" && needsRomanization(text) ? "" : "en");
  const n = shown.length;
  const fit = scroll ? 1 : n > 86 ? .52 : n > 66 ? .62 : n > 48 ? .74 : n > 34 ? .86 : 1;
  els.lyric.style.setProperty("--fit-scale", fit.toFixed(2));
  els.nextLyricTop.textContent = (caps ? next.toUpperCase() : next) || "\u2014";
  els.lyric.textContent = shown;
  els.lyric.setAttribute("data-text", shown);
  if (!scroll) { els.lyric.classList.remove("moving"); return; }
  const t = Math.max(0, state.currentTime + state.lyricOffset + LEAD);
  const timed = Number.isFinite(a.start) && Number.isFinite(a.end) && a.end > a.start;
  const win = timed ? a.end - a.start : 0;
  const scrollSecs = Math.max(8, Math.min(18, n * .18));
  const dur = Math.max(.35, timed ? Math.min(win, scrollSecs) : scrollSecs);
  const elapsed = Math.min(timed ? Math.max(0, t - a.start) : 0, Math.max(0, dur - .01));
  els.lyric.style.setProperty("--lyric-speed", dur.toFixed(3) + "s");
  els.lyric.style.setProperty("--lyric-delay", (-elapsed).toFixed(3) + "s");
  els.lyric.classList.remove("moving");
  void els.lyric.offsetWidth;
  els.lyric.classList.add("moving");
  els.lyric.classList.toggle("paused", !state.playing);
  els.lyric.style.animationPlayState = state.playing ? "running" : "paused";
}

/* ----- shared: words of the current line in the chosen language ----- */
function lineWords(a) {
  if (!a.text) return [];
  const txt = displayText(a.text);
  return txt.split(/\s+/).filter(Boolean);
}
// language modes can change the word count, so map by position ratio
function wordIndexFor(a, words) {
  if (a.idx < 0 || !words.length) return -1;
  if (a.words.length === words.length) return a.idx;
  return Math.min(words.length - 1, Math.floor(((a.idx + 1) / a.words.length) * words.length - 1e-6));
}

/* ----- word pop ----- */
function renderWordPop(a) {
  const words = lineWords(a);
  const i = wordIndexFor(a, words);
  const wp = els.wordpop;
  if (i < 0) {
    wp.classList.add("empty");
    els.wpWord.textContent = ""; els.wpEmoji.textContent = "";
    els.wpPrev.textContent = ""; els.wpNext.textContent = "";
    return;
  }
  wp.classList.remove("empty");
  const pv = words[i - 1], nx = words[i + 1];
  els.wpPrev.textContent = pv ? pv + (emojiFor(pv) ? " " + emojiFor(pv) : "") : "";
  els.wpNext.textContent = nx ? (emojiFor(nx) ? emojiFor(nx) + " " : "") + nx : "";
  els.wpWord.textContent = words[i];
  els.wpEmoji.textContent = emojiFor(words[i]);
  els.wpCur.classList.remove("pop");
  void els.wpCur.offsetWidth;
  els.wpCur.classList.add("pop");
}

/* ----- constellation ----- */
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(name, attrs) {
  const e = document.createElementNS(SVG_NS, name);
  Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
  return e;
}
let constNodes = [];
function renderConstellation(a, lineChanged) {
  const svg = els.constSvg;
  const words = lineWords(a);
  const i = wordIndexFor(a, words);
  if (lineChanged || constNodes.length !== words.length) {
    svg.replaceChildren();
    constNodes = [];
    const rnd = seeded(a.text + a.line);
    const n = words.length;
    const pts = words.map((w, k) => ({
      x: 14 + ((k + .5) / Math.max(1, n)) * 132 + (rnd() - .5) * 8,
      y: 16 + rnd() * 54 + (k % 2 ? 4 : -4)
    }));
    for (let k = 1; k < n; k++) {
      const ln = svgEl("line", { x1: pts[k - 1].x, y1: pts[k - 1].y, x2: pts[k].x, y2: pts[k].y, class: "c-line" });
      ln.dataset.k = k; svg.appendChild(ln);
    }
    if (n > 3) { // a couple of cross links make it read as a constellation
      const extra = svgEl("line", { x1: pts[0].x, y1: pts[0].y, x2: pts[n - 1].x, y2: pts[n - 1].y, class: "c-line c-cross" });
      extra.dataset.k = n - 1; svg.appendChild(extra);
    }
    pts.forEach((p, k) => {
      const g = svgEl("g", { class: "c-node", transform: `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})` });
      g.appendChild(svgEl("circle", { r: 1.1, class: "c-dot" }));
      const t = svgEl("text", { y: -2.6, class: "c-label" });
      t.textContent = words[k];
      g.appendChild(t);
      svg.appendChild(g);
      constNodes.push(g);
    });
  }
  constNodes.forEach((g, k) => {
    g.classList.toggle("shown", k <= i);
    g.classList.toggle("active", k === i);
  });
  svg.querySelectorAll(".c-line").forEach((ln) => ln.classList.toggle("shown", Number(ln.dataset.k) <= i));
}

/* ----- chat bubbles ----- */
function renderChat(a) {
  const tl = state.lyrics.mode === "missing" ? null : getTimeline();
  const stack = els.chatStack;
  stack.replaceChildren();
  els.chatMeta.textContent = state.currentTrack ? decodeText(state.currentTrack.channel) : "";
  if (!tl || a.line < 0) return;
  const from = Math.max(0, a.line - 2);
  for (let k = from; k <= a.line; k++) {
    const isCur = k === a.line;
    const b = document.createElement("div");
    b.className = "bubble " + (isCur && !a.gap ? "cur" : "old") + (k === from && a.line - from === 2 ? " oldest" : "");
    let text = displayText(tl.lines[k].text);
    if (isCur && !a.gap) {
      const w = text.split(/\s+/).filter(Boolean);
      const i = wordIndexFor(a, w);
      text = i < 0 ? "…" : w.slice(0, i + 1).join(" ");
    }
    b.textContent = text;
    stack.appendChild(b);
  }
}

/* ---------- actions ---------- */
function togglePlay() {
  if (!state.player || !state.currentTrack) return setStatus("SELECT A TRACK FIRST");
  if (state.player.getPlayerState() === 1) state.player.pauseVideo(); else state.player.playVideo();
}

function moveTrack(dir) {
  if (!state.results.length) return setStatus("SEARCH FOR A TRACK FIRST");
  const n = (Math.max(state.currentIndex, 0) + dir + state.results.length) % state.results.length;
  selectTrack(state.results[n], n, els.songInput.value);
}

async function loadDirectUrl(videoId, url) {
  els.searchButton.disabled = true; els.searchButton.textContent = "TUNING...";
  setStatus("READING YOUTUBE SIGNAL...");
  try {
    const meta = await api("/api/meta?url=" + encodeURIComponent(url));
    const result = { videoId, title: meta.title, channel: meta.channel };
    state.results = [result];
    selectTrack(result, 0, meta.title);
  } catch (error) {
    const fb = { videoId, title: "YouTube video", channel: "" };
    state.results = [fb];
    selectTrack(fb, 0, "", { skipLyrics: true });
  } finally {
    els.searchButton.disabled = false; els.searchButton.textContent = "SEARCH";
  }
}

async function searchSong(event) {
  event.preventDefault();
  const query = els.songInput.value.trim();
  if (!query) return setStatus("ENTER A SONG OR ARTIST");
  const vid = extractVideoId(query);
  if (vid) return loadDirectUrl(vid, query);

  els.searchButton.disabled = true; els.searchButton.textContent = "TUNING...";
  state.results = []; state.currentIndex = -1; hideResults();
  setStatus("SEARCHING YOUTUBE...");
  try {
    const headers = state.browserKey ? { "x-yt-key": state.browserKey } : {};
    const payload = await api("/api/search?q=" + encodeURIComponent(query), { headers });
    if (payload.needsKey) { showSetup(true); return setStatus("YOUTUBE API KEY REQUIRED // OR PASTE A VIDEO LINK"); }
    state.results = Array.isArray(payload.results) ? payload.results : [];
    renderResults();
    setStatus(state.results.length ? state.results.length + " SIGNALS FOUND // SELECT ONE" : "NO MATCHES FOUND");
  } catch (error) {
    setStatus("SEARCH ERROR // " + String(error.message || error).toUpperCase());
  } finally {
    els.searchButton.disabled = false; els.searchButton.textContent = "SEARCH";
  }
}

/* ---------- YouTube player ---------- */
function initPlayer() {
  if (!window.YT || !window.YT.Player || state.player) return;
  state.player = new window.YT.Player("youtube-player", {
    width: "100%", height: "100%",
    playerVars: { controls: 1, playsinline: 1, rel: 0, modestbranding: 1 },
    events: {
      onReady() {
        state.playerReady = true;
        state.player.setVolume(state.volume);
        els.playerStatus.textContent = "ONLINE";
        if (state.pendingTrack) { state.player.loadVideoById(state.pendingTrack.videoId); state.pendingTrack = null; }
      },
      onStateChange(e) {
        syncClock();
        state.playing = e.data === 1;
        els.playButton.textContent = state.playing ? "Ⅱ PAUSE" : "▶ PLAY";
        els.lyric.classList.toggle("paused", !state.playing);
        clock.at = performance.now();
        document.body.classList.toggle("is-playing", state.playing);
        if (e.data === 1) hideResults();
        if (e.data === 2) setStatus("PAUSED");
        else if (e.data === 0) setStatus("TRACK ENDED");
      },
      onError() { setStatus("PLAYER ERROR // TRY ANOTHER RESULT"); }
    }
  });
}
window.onYouTubeIframeAPIReady = initPlayer;
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return initPlayer();
  if ($("youtube-iframe-api")) return;
  const s = document.createElement("script");
  s.id = "youtube-iframe-api"; s.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(s);
}

/* ---------- boot ---------- */
function bindElements() {
  ["searchForm", "songInput", "searchButton", "configButton", "setupPanel", "serverKeyMessage", "browserKeyCopy", "keyInput",
    "saveKeyButton", "results", "nowLabel", "nowPlaying", "themeSelect", "lyricsWindow", "lyric", "lyricModeTop", "offsetLabelTop",
    "sizeLabelTop", "nextLyricTop", "videoPlaceholder", "previousButton", "playButton", "nextButton", "currentTime", "progress",
    "duration", "volume", "volumeLabel", "animationButton", "edgeButton", "darkButton", "fsButton", "topUi", "bottomUi", "statusText", "playerStatus", "wordpop", "wpPrev", "wpCur", "wpWord",
    "wpNext", "wpEmoji", "constSvg", "chatStack", "chatMeta"].forEach((id) => { els[id] = $(id); });
}

const store = {
  get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};

function bindEvents() {
  els.searchForm.addEventListener("submit", searchSong);
  els.fsButton.addEventListener("click", toggleFullscreen);
  ["mousemove", "pointerdown", "touchstart", "wheel"].forEach((ev) => window.addEventListener(ev, showUi, { passive: true }));
  window.addEventListener("keydown", showUi);
  els.configButton.addEventListener("click", () => showSetup());
  els.saveKeyButton.addEventListener("click", () => {
    state.browserKey = els.keyInput.value.trim();
    if (state.browserKey) store.set("retro-yt-key", state.browserKey); else store.del("retro-yt-key");
    renderKeyState(); showSetup(false);
    setStatus(state.browserKey ? "API KEY SAVED IN THIS BROWSER // READY" : "API KEY REMOVED");
  });
  els.previousButton.addEventListener("click", () => moveTrack(-1));
  els.playButton.addEventListener("click", togglePlay);
  els.nextButton.addEventListener("click", () => moveTrack(1));

  els.themeSelect.addEventListener("change", () => {
    state.visualTheme = els.themeSelect.value;
    store.set("retro-theme", state.visualTheme);
    renderVisualTheme();
    setStatus("VISUAL STYLE: " + els.themeSelect.options[els.themeSelect.selectedIndex].text);
  });
  els.animationButton.addEventListener("click", () => {
    state.lyricAnimation = state.lyricAnimation === "static" ? "scroll" : "static";
    store.set("retro-anim", state.lyricAnimation);
    renderAnimationMode(); state.lyricKey = "";
    setStatus("LYRIC MOTION: " + state.lyricAnimation.toUpperCase());
  });
  els.darkButton.addEventListener("click", () => {
    state.dark = !state.dark;
    store.set("retro-dark", state.dark ? "on" : "off");
    renderDark();
    setStatus("DARK MODE: " + (state.dark ? "ON" : "OFF"));
  });
  els.edgeButton.addEventListener("click", () => {
    state.edge = !state.edge;
    store.set("retro-edge-v3", state.edge ? "on" : "off");
    renderEdge();
    setStatus("GLOW EDGE: " + (state.edge ? "ON" : "OFF"));
  });
  els.progress.addEventListener("input", () => {
    if (!state.player || !state.duration) return;
    state.player.seekTo((Number(els.progress.value) / 100) * state.duration, true);
  });
  els.volume.addEventListener("input", () => {
    state.volume = Number(els.volume.value);
    els.volumeLabel.textContent = Math.round(state.volume) + "%";
    if (state.player) state.player.setVolume(state.volume);
  });
  document.querySelectorAll("[data-language-mode]").forEach((b) => b.addEventListener("click", () => {
    state.languageMode = b.getAttribute("data-language-mode");
    store.set("retro-lang", state.languageMode);
    renderLanguageMode(); state.lyricKey = ""; state.renderKey = "";
    setStatus("LYRIC LANGUAGE: " + b.textContent);
  }));
  document.querySelectorAll("[data-offset]").forEach((b) => b.addEventListener("click", () => {
    const v = b.getAttribute("data-offset");
    state.lyricOffset = v === "zero" ? 0 : Math.max(-10, Math.min(10, state.lyricOffset + Number(v)));
    renderOffset(); state.lyricKey = ""; state.renderKey = "";
  }));
  document.querySelectorAll("[data-size]").forEach((b) => b.addEventListener("click", () => {
    const v = b.getAttribute("data-size");
    state.lyricScale = v === "reset" ? 1 : Math.round(Math.max(.5, Math.min(1.6, state.lyricScale + Number(v))) * 100) / 100;
    renderLyricScale();
  }));
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.repeat) return;
    if (e.target && e.target.closest && e.target.closest("input, textarea, select, button, a, [contenteditable='true']")) return;
    e.preventDefault(); togglePlay();
  });
}

// The YouTube API is polled a few times a second; between polls the clock is
// extrapolated with performance.now() so lyrics advance smoothly (no 100ms stair-steps).
function syncClock() {
  if (!state.playerReady || !state.player || typeof state.player.getCurrentTime !== "function") return;
  const t = Number(state.player.getCurrentTime());
  const d = Number(state.player.getDuration());
  if (Number.isFinite(t)) { clock.base = t; clock.at = performance.now(); }
  if (Number.isFinite(d)) state.duration = d;
}

let lastShownSecond = -1;
function startClock() {
  window.setInterval(() => {
    syncClock();
    const sec = Math.floor(clock.base);
    if (sec !== lastShownSecond) {
      lastShownSecond = sec;
      els.currentTime.textContent = formatTime(clock.base);
      els.duration.textContent = formatTime(state.duration);
    }
    if (state.duration && document.activeElement !== els.progress) {
      els.progress.value = String(Math.min(100, (clock.base / state.duration) * 100));
    }
  }, 250);
  const frame = () => {
    state.currentTime = state.playing ? clock.base + (performance.now() - clock.at) / 1000 : clock.base;
    tick();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function boot() {
  bindElements(); bindEvents();
  renderLyricScale(); renderOffset();
  state.browserKey = store.get("retro-yt-key", "");
  state.lyricAnimation = store.get("retro-anim", "static") === "scroll" ? "scroll" : "static";
  state.edge = store.get("retro-edge-v3", "on") === "on";
  state.dark = store.get("retro-dark", "on") === "on";
  state.visualTheme = store.get("retro-theme", "neon-grid");
  state.languageMode = store.get("retro-lang", "english");
  renderVisualTheme(); renderLanguageMode(); renderAnimationMode(); renderEdge(); renderDark();
  els.keyInput.value = state.browserKey;
  renderKeyState(); loadYouTubeApi(); startClock();
  try {
    const cfg = await api("/api/config");
    state.hasServerKey = Boolean(cfg.hasServerKey);
    renderKeyState();
  } catch (e) { /* search still works with a browser key */ }
}
boot();
