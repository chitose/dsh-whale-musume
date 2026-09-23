import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

test("voice route reports setup, serves cached audio safely, and clears it", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "whale-voice-route-"));
  process.env.DSH_WHALE_VOICE_HOME = home;
  const { createVoiceService } = await import("../lib/voice-service.js");
  const voice = createVoiceService();
  const server = http.createServer(voice.handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/dsh-whale-musume/voice`;
  try {
    const status = await (await fetch(base + "/status")).json();
    assert.equal(status.installed, false);
    assert.equal((await fetch(base + "/clear", { method: "POST", headers: { Origin: "http://other.example" } })).status, 403);
    const id = "a".repeat(64);
    fs.mkdirSync(path.join(home, "cache"));
    fs.writeFileSync(path.join(home, "cache", id + ".wav"), "RIFFtest");
    assert.equal((await fetch(base + "/file?id=../bad")).status, 400);
    const audio = await fetch(base + "/file?id=" + id);
    assert.equal(audio.status, 200);
    assert.equal(audio.headers.get("content-type"), "audio/wav");
    assert.equal(await audio.text(), "RIFFtest");
    assert.equal((await fetch(base + "/clear", { method: "POST" })).status, 200);
    assert.equal(fs.existsSync(path.join(home, "cache", id + ".wav")), false);
    const unavailable = await fetch(base + "/synthesize", { method: "POST", body: JSON.stringify({ line: "hi", language: "en" }) });
    assert.equal(unavailable.status, 503);
  } finally {
    voice.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("plugin mounts and disposes the four voice routes", async () => {
  const { apply } = await import("../lib/index.js");
  const paths = [];
  const closed = [];
  let cleanup;
  const server = { register(route) { paths.push(route.path); return () => closed.push(route.path); } };
  const ctx = { inject(_services, callback) { callback({ get: () => server, effect(register) { cleanup = register(); } }); } };
  await apply(ctx);
  assert.deepEqual(paths, [
    "/api/dsh-whale-musume/assets",
    "/api/dsh-whale-musume/voice/status",
    "/api/dsh-whale-musume/voice/clear",
    "/api/dsh-whale-musume/voice/file",
    "/api/dsh-whale-musume/voice/synthesize",
  ]);
  assert.equal(closed.length, 0, "routes stay mounted while the plugin is active");
  cleanup();
  assert.equal(closed.length, paths.length);
});
