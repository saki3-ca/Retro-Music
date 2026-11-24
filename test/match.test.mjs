import assert from "node:assert/strict";
import { pickBest, parseSynced, buildLyrics, similarity, cleanTitle } from "../api/_lib.js";

const rec = (t, a, extra = {}) => ({ trackName: t, artistName: a, duration: 200, ...extra });

// channel-derived artist must not block a perfect title match
let r = pickBest([rec("Tum Hi Ho", "Arijit Singh", { syncedLyrics: "[00:01.00] a" })],
  { artist: "T-Series", track: "Tum Hi Ho", artistReliable: false });
assert.ok(r.best, "unreliable artist should not reject");

// reliable artist but wrong + weak title is rejected
r = pickBest([rec("Other Song", "Nobody")], { artist: "Kanye West", track: "Through The Wire" });
assert.equal(r.best, null);

// collaboration: "A" vs "A & B"
r = pickBest([rec("Song", "A, B")], { artist: "A", track: "Song" });
assert.ok(r.best, "collab artist overlap");

// curly apostrophes
assert.equal(similarity("don’t stop", "don't stop"), 100);

// plain lyrics survive
const plain = buildLyrics({ trackName: "x", artistName: "y", plainLyrics: "one\ntwo" });
assert.equal(plain.mode, "plain");
assert.equal(plain.plainLines.length, 2);

assert.equal(parseSynced("[01:02.50] hi\n[00:01.00] yo")[0].text, "yo");
assert.equal(cleanTitle("Song (Official Video) [HD]"), "Song");
console.log("all match tests passed");
