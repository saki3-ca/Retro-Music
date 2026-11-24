// Tiny keyword -> emoji accents for the Word Pop theme.
const MAP = {
  love: "❤️", heart: "💛", fire: "🔥", burn: "🔥", star: "⭐", stars: "✨", shootin: "📸", shooting: "📸", moon: "🌙",
  sun: "☀️", night: "🌙", dark: "🌑", light: "💡", car: "🚗", cars: "🚘", porsche: "🏎️", lamb: "🏎️", money: "💵",
  cash: "💵", gold: "👑", crown: "👑", king: "👑", queen: "👸", baby: "🍼", girl: "👧", boy: "👦", home: "🏠", house: "🏠",
  wood: "🌳", floors: "🪵", tree: "🌳", rain: "🌧️", water: "💧", ocean: "🌊", sea: "🌊", fly: "🕊️", wings: "🪽",
  dance: "💃", music: "🎵", song: "🎶", sing: "🎤", kiss: "💋", eyes: "👀", eye: "👁️", phone: "📱", call: "📞",
  name: "🏷️", dream: "💭", dreams: "💭", sleep: "😴", cry: "😢", tears: "😢", smile: "😊", sad: "😞", ice: "🧊",
  cold: "🥶", snow: "❄️", snowboard: "🏂", shoes: "👟", gun: "🔫", diamond: "💎", diamonds: "💎", drink: "🥂",
  party: "🎉", weekend: "🎉", road: "🛣️", city: "🏙️", wind: "🌬️", sky: "🌤️", angel: "😇", devil: "😈", hell: "🔥"
};
export function emojiFor(word) {
  const k = String(word || "").toLowerCase().replace(/[^\p{L}]/gu, "");
  return MAP[k] || "";
}
