import assert from "node:assert/strict";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
globalThis.fetch = async (url) => {
  url = String(url);
  if (url.includes("itunes.apple.com")) return { ok: true, json: async () => ({ results: [
    { trackName: "Other", artistName: "Nobody", artworkUrl100: "https://x/100x100bb.jpg" },
    { trackName: "Flashing Lights (feat. Dwele)", artistName: "Kanye West", artworkUrl100: "https://is1.mzstatic.com/a/100x100bb.jpg" } ] }) };
  if (url.includes("mzstatic.com")) { globalThis.__img = url; return { ok: true, headers: { get: () => "image/jpeg" }, arrayBuffer: async () => png }; }
  return { ok: false };
};
const { default: handler } = await import("../api/cover.js");
const out = {};
const res = { setHeader(k, v) { out[k] = v; }, status(c) { out.status = c; return res; }, send(b) { out.body = b; return res; }, json(o) { out.json = o; return res; } };
await handler({ query: { artist: "Kanye West", track: "Flashing Lights" } }, res);
assert.equal(out.status, 200); assert.ok(out.body.length > 0);
assert.match(globalThis.__img, /400x400bb/, "upgrades artwork size");
const res2 = { setHeader() {}, status(c) { out.status2 = c; return res2; }, send() {}, json() { return res2; } };
await handler({ query: { artist: "Zzzz", track: "Qqqq" } }, res2);
assert.equal(out.status2, 404);
console.log("cover tests passed");
