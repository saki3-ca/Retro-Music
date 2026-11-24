export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ hasServerKey: Boolean(process.env.YOUTUBE_API_KEY) });
}
