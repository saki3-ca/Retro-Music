# Retro Lyrics Player

Search a song (or paste a YouTube link), play it through the YouTube player and watch synced lyrics in
eight visual styles. Deploys to Vercel's free Hobby plan.

**Styles:** CRT Glitch, Neon Grid, Red Arcade, Sunset Pixels, Ice CRT (one big line) and the album-mood
styles **Word Pop**, **Constellation**, **Chat Bubbles** (word by word, colors taken from the video thumbnail).

## How it works
- `api/search.js` YouTube Data API search (needs `YOUTUBE_API_KEY`, 100 quota units per search, cached on the CDN)
- `api/meta.js` title/channel for a pasted link via YouTube oEmbed (no quota)
- `api/lyrics.js` LRCLIB lyrics. If `GENIUS_API_KEY` is set, Genius is used only to learn the canonical title/artist
  (Genius' API returns no lyric text)
- `api/translate.js` Google Cloud Translation if `GOOGLE_TRANSLATE_API_KEY` is set, otherwise MyMemory (free, limited)
- LRCLIB only has **line** timestamps, so word timing is spread across each line by word length (`src/timing.js`).

## Run locally
```bash
cp .env.example .env   # add your keys
npm install
npm run dev
npm test               # lyric matching tests
```

## Deploy to Vercel
1. Import the repo in Vercel (framework: Vite is auto-detected).
2. Add `YOUTUBE_API_KEY` and `GENIUS_API_KEY` under Settings > Environment Variables.
3. Deploy. Keys stay on the server; never commit `.env`.

Without a server key, users can paste their own YouTube key under SETUP, or just paste video links.
