// Pulls two accent colors from the YouTube thumbnail for the "album mood" themes.
const FALLBACK = { c1: "#ff5fa2", c2: "#8a4dff", dark: "#12041a" };
const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function fromUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 32;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 32, 32);
        const d = ctx.getImageData(0, 0, 32, 32).data;
        const buckets = {};
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max ? (max - min) / max : 0;
          if (max < 50 || sat < .25) continue;
          const key = (r >> 5) + "," + (g >> 5) + "," + (b >> 5);
          const e = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0, score: 0 });
          e.n++; e.r += r; e.g += g; e.b += b; e.score += sat * (max / 255);
        }
        const list = Object.keys(buckets).map((k) => buckets[k]).sort((a, b) => b.score - a.score);
        if (!list.length) return resolve(null);
        const avg = (e) => [e.r / e.n, e.g / e.n, e.b / e.n];
        const a = avg(list[0]);
        const b = list[1] ? avg(list[1]) : a.map((v) => v * .6);
        resolve({ c1: hex(...a), c2: hex(...b), dark: hex(a[0] * .12, a[1] * .12, a[2] * .12) });
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Tries each image in order (album cover first, video thumbnail last).
export async function extractPalette(urls) {
  for (const url of urls) {
    const p = await fromUrl(url);
    if (p) return p;
  }
  return FALLBACK;
}
