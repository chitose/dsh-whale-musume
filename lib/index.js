// Host routes for Umika's bundled assets and local Kokoro voice sidecar.
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createVoiceService } from "./voice-service.js";

/** Cordis plugin name (used in loader diagnostics). */
export const name = "dsh-whale-musume";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(HERE, "..", "assets");

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".mp3": "audio/mpeg",
};

/** Resolve request parameter f to a safe path inside the assets directory;
    returns null when it escapes. */
function safeResolve(rel) {
  const target = path.normalize(path.join(ASSETS_DIR, rel));
  if (target !== ASSETS_DIR && !target.startsWith(ASSETS_DIR + path.sep)) return null;
  return target;
}

export async function apply(ctx) {
  const voice = createVoiceService(ctx.logger);
  // Must go through inject — when apply runs, the webserver's fiber may not exist yet
  ctx.inject(["webServer"], (wctx) => {
    const webServer = wctx.get("webServer");
    wctx.effect(() => {
      const dispose = webServer.register({
        kind: "exact",
        path: "/api/dsh-whale-musume/assets",
        handler: async (req, res) => {
          try {
            const url = new URL(req.url, "http://127.0.0.1");
            // f may carry a version tail like ?v=3 (appended when the presentation
            // layer builds URLs); strip it before resolving
            const rel = (url.searchParams.get("f") ?? "").split("?")[0];
            const file = safeResolve(rel);
            if (file === null || !existsSync(file) || !statSync(file).isFile()) {
              res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
              res.end("not found");
              return;
            }
            const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
            res.writeHead(200, {
              "Content-Type": type,
              "Cache-Control": "public, max-age=3600",
            });
            createReadStream(file).pipe(res);
          } catch (error) {
            res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
            res.end(String(error?.message ?? error));
          }
        },
      });
      const voiceRoutes = ["status", "clear", "file", "synthesize"].map((route) => webServer.register({
        kind: "exact", path: "/api/dsh-whale-musume/voice/" + route, handler: voice.handler,
      }));
      return () => { voiceRoutes.forEach((close) => close()); dispose(); voice.close(); };
    }, "dsh-whale-musume: routes and voice sidecar");
  });

  ctx.logger?.info?.("dsh-whale-musume: mounted (asset route /api/dsh-whale-musume/assets)");
}
