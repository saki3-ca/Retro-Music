// Word -> emoji for the Word Pop theme.
// 1) hand-picked lyric words (checked first), 2) generated keyword map as a fallback.
import GENERATED from "./emoji-data.js";

const CURATED = {
  // light / electricity / flight (the "Flashing Lights" kind of words)
  light: "💡", lights: "💡", flash: "⚡", flashing: "⚡", flashin: "⚡", lightning: "⚡", spark: "✨", sparkle: "✨", shine: "✨", shining: "✨",
  glow: "✨", bright: "🔆", camera: "📸", cameras: "📸", paparazzi: "📸", photo: "📸", picture: "📸", shoot: "📸", shooting: "📸",
  flight: "✈️", plane: "✈️", jet: "✈️", airport: "🛫", fly: "🕊️", flying: "🕊️", wings: "🪽", rocket: "🚀", spaceship: "🚀", space: "🌌",
  // love / feelings
  love: "❤️", heart: "💛", hearts: "💛", kiss: "💋", baby: "🍼", crush: "😍", hate: "💔", broken: "💔", cry: "😢", tears: "😢",
  smile: "😊", laugh: "😂", happy: "😄", sad: "😞", angry: "😡", scared: "😨", lonely: "🥀", alone: "🥀", pain: "🩹", hurt: "🩹",
  dream: "💭", dreams: "💭", sleep: "😴", wake: "⏰", pray: "🙏", god: "🙏", heaven: "😇", angel: "😇", devil: "😈", hell: "🔥", soul: "👻", ghost: "👻",
  // time / nature
  night: "🌙", moon: "🌙", sun: "☀️", sunshine: "☀️", morning: "🌅", sunset: "🌇", day: "🌤️", star: "⭐", stars: "✨", sky: "🌌",
  rain: "🌧️", storm: "⛈️", thunder: "⛈️", snow: "❄️", ice: "🧊", cold: "🥶", winter: "❄️", summer: "🏖️", wind: "🌬️", cloud: "☁️", clouds: "☁️",
  fire: "🔥", flame: "🔥", burn: "🔥", burning: "🔥", hot: "🥵", smoke: "💨", water: "💧", ocean: "🌊", sea: "🌊", wave: "🌊", river: "🏞️",
  tree: "🌳", trees: "🌳", wood: "🪵", woods: "🌲", flower: "🌸", flowers: "🌸", rose: "🌹", grass: "🌱", mountain: "⛰️", earth: "🌍", world: "🌍",
  // places / things
  home: "🏠", house: "🏠", apartment: "🏢", building: "🏢", city: "🌆", street: "🛣️", road: "🛣️", highway: "🛣️", bridge: "🌉", hotel: "🏨", school: "🏫",
  car: "🚗", cars: "🚗", ride: "🚗", drive: "🚗", driving: "🚗", porsche: "🏎️", lambo: "🏎️", lamb: "🏎️", truck: "🚚", bike: "🚲", train: "🚆", boat: "⛵", ship: "🚢",
  door: "🚪", window: "🪟", key: "🔑", keys: "🔑", lock: "🔒", bed: "🛏️", room: "🚪", floor: "🪵", floors: "🪵", wall: "🧱", chair: "🪑",
  phone: "📱", call: "📞", calling: "📞", text: "💬", message: "💬", tv: "📺", radio: "📻", computer: "💻", screen: "🖥️", game: "🎮",
  // money / status
  money: "💵", cash: "💵", dollar: "💵", dollars: "💵", rich: "🤑", gold: "🪙", golden: "🪙", diamond: "💎", diamonds: "💎", ring: "💍", crown: "👑", king: "👑", queen: "👸",
  // clothes / body
  shoes: "👟", shoe: "👟", sneakers: "👟", boots: "🥾", hat: "🧢", cap: "🧢", dress: "👗", jeans: "👖", jacket: "🧥", glasses: "🕶️", shades: "🕶️", watch: "⌚", chain: "⛓️",
  eyes: "👀", eye: "👁️", look: "👀", looking: "👀", see: "👀", hand: "✋", hands: "🙌", finger: "☝️", fist: "✊", mouth: "👄", lips: "💋", face: "🙂", head: "🗣️",
  legs: "🦵", feet: "🦶", foot: "🦶", hair: "💇", skin: "🧴", bone: "🦴", body: "🧍", brain: "🧠", mind: "🧠", blood: "🩸", tattoo: "🖋️",
  // people
  girl: "👧", boy: "👦", man: "👨", woman: "👩", mama: "👩", mother: "👩", daddy: "👨", father: "👨", family: "👨‍👩‍👧", friend: "🤝", friends: "🤝", people: "👥", crowd: "👥",
  // music / party
  music: "🎵", song: "🎶", songs: "🎶", sing: "🎤", singing: "🎤", dance: "💃", dancing: "💃", dancin: "💃", party: "🎉", club: "🪩", dj: "🎧", beat: "🥁", drum: "🥁", guitar: "🎸", piano: "🎹", mic: "🎤", radio: "📻",
  // drink / food
  drink: "🥂", drinks: "🥂", drunk: "🥴", champagne: "🍾", wine: "🍷", beer: "🍺", coffee: "☕", pizza: "🍕", burger: "🍔", food: "🍽️", candy: "🍬", sweet: "🍬", cake: "🎂", apple: "🍎",
  // actions / danger
  gun: "🔫", bullet: "💥", bang: "💥", boom: "💥", war: "⚔️", fight: "🥊", run: "🏃", running: "🏃", walk: "🚶", jump: "🦘", fall: "🍂", falling: "🍂", drop: "💧", rise: "📈", win: "🏆", winner: "🏆", trophy: "🏆",
  time: "⏳", clock: "🕐", hour: "⏳", late: "⏰", wait: "⏳", forever: "♾️", free: "🕊️", freedom: "🕊️", peace: "☮️", flag: "🏁", bomb: "💣", knife: "🔪", skull: "💀", dead: "💀", death: "💀", die: "💀",
  // animals
  dog: "🐕", cat: "🐈", bird: "🐦", horse: "🐎", wolf: "🐺", lion: "🦁", snake: "🐍", bear: "🐻", bee: "🐝", butterfly: "🦋", fish: "🐟", monkey: "🐒",
  // misc
  book: "📖", letter: "✉️", paper: "📄", pen: "🖊️", bag: "👜", gift: "🎁", bottle: "🍾", mirror: "🪞", candle: "🕯️", camera_: "📷", heaven_: "☁️", luck: "🍀", magic: "🪄", secret: "🤫", quiet: "🤫", noise: "🔊", loud: "🔊", silence: "🤫"
};

const cache = new Map();

function candidates(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  const out = [w];
  if (w.endsWith("in")) out.push(w + "g");               // shootin -> shooting
  if (w.endsWith("ies")) out.push(w.slice(0, -3) + "y");
  if (w.endsWith("es")) out.push(w.slice(0, -2));
  if (w.endsWith("s")) out.push(w.slice(0, -1));
  if (w.endsWith("ing")) { const b = w.slice(0, -3); out.push(b, b + "e", b.slice(0, -1)); }
  if (w.endsWith("ed")) { const b = w.slice(0, -2); out.push(b, b + "e", b.slice(0, -1)); }
  return out;
}

export function emojiFor(word) {
  const key = String(word || "");
  if (cache.has(key)) return cache.get(key);
  let found = "";
  const list = candidates(key);
  for (const c of list) { if (CURATED[c]) { found = CURATED[c]; break; } }
  if (!found) for (const c of list) { if (c.length >= 3 && GENERATED[c]) { found = GENERATED[c]; break; } }
  cache.set(key, found);
  return found;
}
