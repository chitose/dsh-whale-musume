/* Run after setup:voice with node test/voice-live-smoke.mjs. Uses the real models. */
import assert from "node:assert/strict";
import http from "node:http";
import { createVoiceService } from "../lib/voice-service.js";

const voice = createVoiceService(console);
const server = http.createServer(voice.handler);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/api/dsh-whale-musume/voice`;
try {
  for (const language of ["en", "ja"]) {
    const response = await fetch(base + "/synthesize", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line: language === "ja" ? "Achievement unlocked: First Game!" : "Hello, Umika!", language, title: language === "ja" ? "マスター" : "Master", selfName: language === "ja" ? "くじらちゃん" : "Umika", speak: true }),
    });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.ok(result.text);
    const audio = await fetch(`http://127.0.0.1:${server.address().port}${result.audio}`);
    assert.equal(audio.status, 200);
    assert.equal(Buffer.from(await audio.arrayBuffer()).subarray(0, 4).toString(), "RIFF");
    console.log(`${language}: ${result.text}`);
  }
  const named = await fetch(base + "/synthesize", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ line: "Master, the next quest is ready!", language: "ja", title: "先生", selfName: "くじらちゃん", speak: true }),
  });
  const namedResult = await named.json();
  assert.equal(named.status, 200, JSON.stringify(namedResult));
  assert.ok(namedResult.text.includes("先生"));
  console.log(`ja personalized: ${namedResult.text}`);
} finally {
  voice.close();
  await new Promise((resolve) => server.close(resolve));
}
