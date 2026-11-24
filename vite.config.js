import { defineConfig, loadEnv } from "vite";

// Runs the files in /api as local serverless handlers during `npm run dev`.
function apiDev(env) {
  return {
    name: "api-dev",
    configureServer(server) {
      Object.assign(process.env, env);
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith("/api/")) return next();
        const url = new URL(req.url, "http://localhost");
        const name = url.pathname.replace("/api/", "");
        if (!/^[a-z]+$/.test(name)) return next();
        try {
          const mod = await server.ssrLoadModule("/api/" + name + ".js");
          req.query = Object.fromEntries(url.searchParams);
          res.status = (code) => { res.statusCode = code; return res; };
          res.json = (obj) => {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(obj));
          };
          await mod.default(req, res);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: String(error.message || error) }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [apiDev(loadEnv(mode, process.cwd(), ""))]
}));
