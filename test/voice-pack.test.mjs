import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planWrites } from "../scripts/apply-theme.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(rootDir, ...rel.split("/")), "utf8");
const presenter = read("assets/dsh-whale-moe.js");
const client = read("lib/client.js");

test("every bubble path requests live Kokoro voice and has a text fallback", () => {
  assert.match(presenter, /var VOICE_TRANSLATIONS = "\/assets\/voice\/ja\/translations\.json";/);
  assert.match(presenter, /typeBubble\(text, speakLine\(line, text\)\)/);
  assert.match(presenter, /typeBubble\(bubbleText, speakLine\(computed\.line, bubbleText\)\)/);
  assert.match(presenter, /typeBubble\(bubbleText, speakLine\("Ehehe~ I like Master best!", bubbleText\)\)/);
  assert.match(presenter, /VOICE_API \+ "\/synthesize"/);
  assert.match(presenter, /emitInteractionLine\(shown\)/);
  assert.match(presenter, /generation === voiceGeneration/);
  assert.match(presenter, /function voiceEnabled\(\)[\s\S]*?return readPref\("voiceJa"\) && readPref\("chat"\);/);
  /* names no longer mute anything: 74% of clips contain one, so muting looked
     like a broken feature rather than a naming choice */
  assert.doesNotMatch(presenter, /if \(localized === String\(line\)\) playVoiceFor\(line\)/);
  /* autoplay refusals must not spam, and a gesture re-arms playback */
  assert.match(presenter, /started && typeof started\.catch === "function"[\s\S]*?voiceBlocked = true/);
  assert.match(presenter, /function onUserActivity\(\)[\s\S]*?if \(voiceBlocked\) voiceBlocked = false;/);
  assert.doesNotMatch(presenter, /manifest\.json|loadVoiceManifest|voiceSourceFor|not-in-pack|manifest-not-loaded/);
});

test("silent bubbles can be explained from the console", () => {
  /* window.__dshWhaleVoice.misses[].reason names the exact cause */
  assert.match(presenter, /root\.__dshWhaleVoice = \{/);
  for (const reason of [
    "voice-off",
    "bubbles-off",
    "no-live-audio",
    "autoplay-blocked",
    "autoplay-refused",
    "playback-error"
  ]) {
    assert.ok(presenter.includes(`"${reason}"`), `noteVoiceMiss must record ${reason}`);
  }
  assert.match(presenter, /VOICE_MISS_MAX = 20/, "the miss log stays bounded");
});

test("bundle mode serves translations through the plugin asset route", () => {
  assert.match(
    client,
    /\.replace\('var VOICE_TRANSLATIONS = "\/assets\/voice\/ja\/translations\.json";', 'var VOICE_TRANSLATIONS = "' \+ BASE \+ 'voice\/ja\/translations\.json";'\)/
  );
  assert.match(client, /prefKey: "voiceJa"/);
});

/* The behavioural tests share one harness: playVoiceFor() closes over two other
   module-scope helpers, so both must be injected alongside it or the extracted
   copy throws a ReferenceError instead of exercising the code. */
function extractFunctionBody(name) {
  const start = presenter.indexOf(`function ${name}(`);
  const end = presenter.indexOf("\n  function ", start + 10);
  assert.ok(start > 0 && end > start, `${name} must exist`);
  return presenter.slice(start, end).trim();
}

test("dialogue text follows the selected language and personalized names", () => {
  const make = new Function("voiceLanguage", "voiceTranslations", "title", "selfName", "spokenTitle", "spokenSelfName", "core", "japaneseOverrideFor", `${extractFunctionBody("localizeLine")}; return localizeLine;`);
  const translations = { "Master likes Umika": "マスターはくじらちゃんが好き" };
  const names = { title: () => "先生", selfName: () => "ミカ" };
  const ja = make(() => "ja", translations, names.title, names.selfName, names.title, names.selfName, {}, () => "");
  assert.equal(ja("Master likes Umika"), "先生はミカが好き");
  const editedJa = make(() => "ja", translations, names.title, names.selfName, names.title, names.selfName, {}, () => "マスターとくじらちゃん！");
  assert.equal(editedJa("Master likes Umika"), "先生とミカ！");
  const en = make(() => "en", translations, names.title, names.selfName, names.title, names.selfName, {}, () => "");
  assert.equal(en("Master likes Umika"), "先生 likes ミカ");
});

test("dialog CSV preserves quoted and multiline text and rejects unknown IDs before saving", () => {
  const parse = new Function(`${extractFunctionBody("parseDialogCsv")}; return parseDialogCsv;`)();
  const csvCell = new Function(`${extractFunctionBody("csvCell")}; return csvCell;`)();
  const rows = [["id", "english", "japanese", "muted"], ["idle:0", 'Hello, "Master"\nagain', "こんにちは、マスター！", "0"]];
  assert.deepEqual(parse("\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")), rows);
  let saved = false;
  const state = {
    core: { LINES: { idle: ["Hello"] }, DIALOGUE: {} },
    readDialogOverrides: () => ({}), writeDialogOverrides: () => { saved = true; },
    voiceTranslations: { Hello: "こんにちは" }, root: { dispatchEvent() {}, CustomEvent: class {} },
  };
  const apply = new Function("state", `with (state) { ${extractFunctionBody("dialogEntries")}; ${extractFunctionBody("parseDialogCsv")}; ${extractFunctionBody("importDialogCsv")}; return importDialogCsv; }`)(state);
  assert.throws(() => apply("id,english,japanese,muted\nmissing:0,Hello,こんにちは,0"), /Invalid dialog CSV row/);
  assert.equal(saved, false);
  assert.equal(apply("id,english,japanese,muted\nidle:0,Hi,やあ,1"), 1);
  assert.equal(saved, true);
});

test("a late synthesis response cannot replace or speak a newer bubble", async () => {
  const requests = [];
  const played = [];
  const bubble = { hidden: false };
  const textNode = { isConnected: true, textContent: "", closest: () => bubble };
  const state = {
    activeVoiceLine: "", activeVoiceText: null, voiceGeneration: 0, voiceAudio: null, typingTimer: null,
    VOICE_API: "/api/voice",
    root: { fetch: () => new Promise((resolve) => requests.push(resolve)), clearTimeout() {} },
    voiceLanguage: () => "en", kokoroVoice: () => "af_sarah", localizeLine: (line) => line, readPref: () => true,
    title: () => "Master", selfName: () => "Umika", spokenTitle: () => "Master", spokenSelfName: () => "Umika",
    playVoiceFor: (line, audio) => { played.push([line, audio]); return true; },
    emitInteractionLine() {}, memory: { bubbleHideAt: 0 },
  };
  const speakLine = new Function("state", `with (state) { ${extractFunctionBody("speakLine")}; return speakLine; }`)(state);
  speakLine("old", textNode);
  speakLine("new", textNode);
  requests[0]({ ok: true, json: async () => ({ text: "old translated", audio: "/old.wav" }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(textNode.textContent, "");
  assert.deepEqual(played, []);
  requests[1]({ ok: true, json: async () => ({ text: "new translated", audio: "/new.wav" }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(textNode.textContent, "new translated");
  assert.deepEqual(played, [["new", "/new.wav"]]);
});

function makeVoiceHarness(options = {}) {
  const plays = [];
  const audios = [];
  const misses = [];
  class FakeAudio {
    constructor() {
      this.src = "";
      this.currentTime = 0;
      audios.push(this);
    }
    play() {
      plays.push(this.src);
      if (options.throws) throw Object.assign(new Error("blocked"), { name: "NotAllowedError" });
      if (options.aborts) {
        return Promise.reject(
          Object.assign(new Error("The play() request was interrupted by a new load request."), { name: "AbortError" })
        );
      }
      if (options.refuses) {
        return Promise.reject(
          Object.assign(new Error("play() failed because the user didn't interact with the document first"), {
            name: "NotAllowedError"
          })
        );
      }
      return Promise.resolve();
    }
  }
  const factory = new Function(
    "readPref", "root", "noteVoiceMiss",
    `let voiceAudio = null;
     let voiceBlocked = false;
     ${extractFunctionBody("voiceBlockedReason")}
     ${extractFunctionBody("playVoiceFor")}
     return {
       play: playVoiceFor,
       blocked: function () { return voiceBlocked; },
       rearm: function () { voiceBlocked = false; },
       audio: function () { return voiceAudio; }
     };`
  );
  const loads = [];
  const api = factory(
    () => options.enabled !== false,
    { Audio: FakeAudio },
    (line, reason) => misses.push(reason)
  );
  return { api, plays, audios, misses, loads };
}

test("playVoiceFor drives one reusable Audio element and stays silent without a clip", () => {
  /* toggled off: no element is even created, and the reason is recorded */
  const off = makeVoiceHarness({ enabled: false });
  assert.equal(off.api.play("line A"), false);
  assert.equal(off.audios.length, 0);
  assert.equal(off.plays.length, 0);
  assert.deepEqual(off.misses, ["voice-off"]);

  /* enabled: one element, the right URL, reused so lines never overlap */
  const on = makeVoiceHarness();
  assert.equal(on.api.play("line A", "/api/dsh-whale-musume/voice/file?id=a"), true);
  assert.equal(on.api.play("line B", "/api/dsh-whale-musume/voice/file?id=b"), true);
  assert.equal(on.audios.length, 1, "audio elements are reused so lines never overlap");
  assert.deepEqual(on.plays, ["/api/dsh-whale-musume/voice/file?id=a", "/api/dsh-whale-musume/voice/file?id=b"]);

  /* no live URL: silent, nothing played, and why is recorded */
  const before = on.plays.length;
  assert.equal(on.api.play("a line Kokoro did not render"), false);
  assert.equal(on.plays.length, before);
  assert.deepEqual(on.misses, ["no-live-audio"]);
});

test("interrupting a clip is not treated as a refusal", async () => {
  const classify = new Function(`return (${extractFunctionBody("voiceBlockedReason")});`)();
  assert.equal(
    classify(Object.assign(new Error("The play() request was interrupted by a new load request."), { name: "AbortError" })),
    "",
    "a superseded clip is not a refusal"
  );
  assert.equal(classify(Object.assign(new Error("blocked"), { name: "NotAllowedError" })), "policy");
  assert.equal(classify(new Error("play() failed because the user didn't interact with the document first")), "policy");
  assert.equal(classify(new Error("some decoding hiccup")), "", "an unknown error is not proof of a refusal");

  /* Replacing .src while play() is pending rejects with AbortError; mistaking it
     for a policy block silences the mascot until the next click, which is exactly
     what a live test caught. */
  const aborted = makeVoiceHarness({ aborts: true });
  assert.equal(aborted.api.play("line A", "/api/dsh-whale-musume/voice/file?id=a"), true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(aborted.api.blocked(), false, "an interrupted clip must not disarm playback");
  assert.deepEqual(aborted.misses, []);
});

test("a refused play() promise disarms playback until the next gesture", async () => {
  const refused = makeVoiceHarness({ refuses: true });
  assert.equal(refused.api.play("line A", "/api/dsh-whale-musume/voice/file?id=a"), true);
  assert.equal(refused.api.blocked(), false, "the rejection is asynchronous");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(refused.api.blocked(), true, "an autoplay refusal disarms playback instead of spamming rejections");
  assert.deepEqual(refused.misses, ["autoplay-refused"]);
  assert.equal(refused.api.play("line A", "/api/dsh-whale-musume/voice/file?id=a"), false, "no further attempts while blocked");
  assert.deepEqual(refused.misses, ["autoplay-refused", "autoplay-blocked"]);

  refused.api.rearm();
  assert.equal(refused.api.play("line A", "/api/dsh-whale-musume/voice/file?id=a"), true, "a user gesture re-arms playback");
  assert.equal(refused.plays.length, 2);
});

test("a synchronous autoplay failure is swallowed and disarms further attempts", () => {
  const thrown = makeVoiceHarness({ throws: true });
  assert.equal(thrown.api.play("line A", "/api/dsh-whale-musume/voice/file?id=a"), false);
  assert.equal(thrown.api.blocked(), true);
  assert.equal(thrown.api.play("line B", "/api/dsh-whale-musume/voice/file?id=b"), false);
  assert.deepEqual(thrown.plays, ["/api/dsh-whale-musume/voice/file?id=a"]);
});

test("the theme install copies translations, not generated voice clips", () => {
  const fake = path.join(rootDir, ".voice-preview", "tmp", "theme-fixture");
  const { writes } = planWrites(fake, true);
  const rels = writes.map((write) => write.rel.split(path.sep).join("/"));
  assert.ok(rels.includes("node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/voice/ja/translations.json"));
  assert.ok(!rels.includes("node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/voice/ja/manifest.json"));
  const clips = rels.filter((rel) => rel.endsWith(".ogg"));
  assert.deepEqual(clips, []);
});
