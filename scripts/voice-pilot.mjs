#!/usr/bin/env node
/*
 * Whale-chan JP voice pilot — step 1 of 2.
 *
 * Picks 10 representative lines out of the 612-line library in
 * assets/whale-moe-core.js, pairs each with a hand-written spoken-Japanese
 * translation, and writes the synthesis job for scripts/kokoro-render.py.
 *
 * Translation rules (the full 612-line pass must inherit these):
 *   - natural spoken Japanese, not a literal translation;
 *   - energetic childhood-friend persona, snark allowed, never commanding;
 *   - Master -> マスター, Whale-chan -> くじらちゃん (the plugin's own
 *     applyNames() substitutes these at display time in every other language);
 *   - keep 。！？…～, turn "~" into "～";
 *   - strip emoji / kaomoji only, never punctuation;
 *   - keep the line about as long as the English so bubble timing is unchanged.
 *
 * Usage:
 *   node scripts/voice-pilot.mjs --setup   # download the Kokoro model files
 *   node scripts/voice-pilot.mjs           # write .voice-preview/pilot.json
 */
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { loadCore } from "../test/load-core.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".voice-preview");
const MODELS = path.join(OUT, "models");
const EXPECTED_LINES = 612;
const VOICES = ["jf_alpha", "jf_gongitsune", "jf_tebukuro", "jf_nezumi"];
/* The full-set pass uses the voice picked from the pilot. */
const FULL_VOICES = ["jf_tebukuro"];

/* GitHub release model-files-v1.1 of thewh1teagle/kokoro-onnx. The v1.0 pair is
   the one that carries the jf_* Japanese voices; v1.1-zh dropped many voices. */
const MODEL_BASE =
  process.env.KOKORO_MODEL_BASE ||
  "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1";
const MODEL_FILES = [
  { file: "kokoro-v1.0.fp16.onnx", minBytes: 100e6 },
  { file: "voices-v1.0.bin", minBytes: 20e6 }
];

const PILOT = [
  {
    path: "LINES.idle",
    index: 0,
    ja: "マスター～、今日は何をするの～？"
  },
  {
    path: "LINES.success",
    index: 1,
    ja: "できたよ！マスター、味見してみて～"
  },
  {
    path: "LINES.failure",
    index: 2,
    ja: "ただのエラーだよ、世界の終わりじゃないもん。くじらちゃんが先にぎゅーってしてあげるね"
  },
  {
    path: "LINES.afk",
    index: 0,
    ja: "くじらちゃん、ちょっとうたた寝するね。注文が来たら起こして～"
  },
  {
    path: "DIALOGUE.daily.morning",
    index: 2,
    ja: "おはよ～。起きないと、コーヒー全部飲んじゃうよ～"
  },
  {
    path: "DIALOGUE.interact.pat",
    index: 0,
    ja: "また～？マスター、なでなではケーキ一個だからね。ちゃんと帳簿つけてよ～"
  },
  {
    path: "DIALOGUE.keyword.ddl",
    index: 0,
    ja: "締め切りが前で、くじらちゃんが後ろ。マスターの底力、今夜爆発させようね"
  },
  {
    path: "DIALOGUE.balance.critical",
    index: 0,
    ja: "残高ピンチ！マスター、お財布確認して～"
  },
  {
    path: "DIALOGUE.weather.rain",
    index: 0,
    ja: "外は雨だよ。くじらちゃん、傘とやさしさを玄関に置いておいたの。忘れないでね～"
  },
  {
    path: "DIALOGUE.proactive.late-night",
    index: 0,
    ja: "もうこんな時間だよ、マスター。くじらちゃん、マスターのクマがちょっと心配なの"
  }
];

/* Emoji, variation selectors, ZWJ and keycaps only — punctuation is kept. */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/* Bubble texts the presenter writes itself rather than picking from a core bank.
   They are fixed strings, so they can be voiced too; the manifest is keyed by the
   exact English literal the presenter passes to playVoiceFor(). Translations are
   authored here because they never go through the batch translation pass.
   Dynamic announcements ("Achievement unlocked: X!") are interpolated per event
   and stay unvoiced unless the optional MiMo TTS bridge is installed. */
const EXTRAS = [
  {
    key: "PRESENTER.celebrate",
    path: "PRESENTER.celebrate",
    slug: "presenter-celebrate",
    index: 0,
    en: "Ehehe~ I like Master best!",
    ja: "えへへ～、マスターのこと、いちばん好きだよ！"
  }
];

function stripEmoji(text) {
  return text
    .replace(EMOJI, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([。、！？…～,.!?])/g, "$1")
    .trim();
}

function normalizeJapanese(text) {
  return text.replace(/~/g, "～").replace(/[ \t]{2,}/g, " ").trim();
}

function resolveLine(core, bankPath) {
  const [head, ...rest] = bankPath.split(".");
  let bank = head === "LINES" ? core.LINES : core.DIALOGUE;
  for (const key of rest) bank = bank && bank[key];
  return bank;
}

function slug(bankPath) {
  return bankPath.toLowerCase().replace(/\./g, "-");
}

async function download(url, target, minBytes) {
  const existing = fs.existsSync(target) ? fs.statSync(target).size : 0;
  if (existing >= minBytes) {
    console.log(`  keep ${path.basename(target)} (${(existing / 1e6).toFixed(1)}MB)`);
    return;
  }
  console.log(`  get  ${path.basename(target)} <- ${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`download failed: HTTP ${response.status} for ${url}`);
  }
  const part = `${target}.part`;
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(part));
  const size = fs.statSync(part).size;
  if (size < minBytes) {
    fs.rmSync(part, { force: true });
    throw new Error(`download too small: ${size} bytes for ${url}`);
  }
  fs.renameSync(part, target);
  console.log(`  done ${path.basename(target)} (${(size / 1e6).toFixed(1)}MB)`);
}

async function setup() {
  fs.mkdirSync(MODELS, { recursive: true });
  console.log(`models -> ${path.relative(ROOT, MODELS)}`);
  for (const entry of MODEL_FILES) {
    await download(`${MODEL_BASE}/${entry.file}`, path.join(MODELS, entry.file), entry.minBytes);
  }
}

function assertLibrary(core) {
  const total = core.dialogueCount();
  if (total !== EXPECTED_LINES) {
    throw new Error(
      `dialogueCount() is ${total}, expected ${EXPECTED_LINES}: the line banks changed, re-check the sample`
    );
  }
  const stateLines = Object.values(core.LINES).reduce((sum, lines) => sum + lines.length, 0);
  return { total, stateLines };
}

/* Every line in the library in stable order: LINES states first, then DIALOGUE. */
function enumerateLines(core) {
  const out = [];
  for (const [state, lines] of Object.entries(core.LINES)) {
    lines.forEach((en, index) =>
      out.push({
        key: `LINES.${state}#${index}`,
        path: `LINES.${state}`,
        bank: "LINES",
        event: state,
        index,
        en
      })
    );
  }
  for (const [group, events] of Object.entries(core.DIALOGUE)) {
    for (const [event, lines] of Object.entries(events)) {
      if (!Array.isArray(lines)) throw new Error(`DIALOGUE.${group}.${event} is not a line bank`);
      lines.forEach((en, index) =>
        out.push({
          key: `DIALOGUE.${group}.${event}#${index}`,
          path: `DIALOGUE.${group}.${event}`,
          bank: group,
          event,
          index,
          en
        })
      );
    }
  }
  return out;
}

/* Balanced translation batches: split on character count so no batch drags. */
function writeBatches(core, count) {
  const lines = enumerateLines(core);
  const totalChars = lines.reduce((sum, line) => sum + line.en.length, 0);
  const target = totalChars / count;
  const batches = [[]];
  let running = 0;
  for (const line of lines) {
    if (batches[batches.length - 1].length && running + line.en.length > target && batches.length < count) {
      batches.push([]);
      running = 0;
    }
    batches[batches.length - 1].push(line);
    running += line.en.length;
  }

  fs.mkdirSync(path.join(OUT, "ja"), { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "all-lines.json"),
    `${JSON.stringify({ count: lines.length, lines }, null, 2)}\n`,
    "utf8"
  );

  batches.forEach((batch, i) => {
    const payload = {};
    for (const line of batch) payload[line.key] = line.en;
    const dir = path.join(OUT, "ja");
    const file = path.join(dir, `batch-${String(i + 1).padStart(2, "0")}.json`);
    fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(
      `  ${path.relative(ROOT, file)}  ${batch.length} lines, ${batch.reduce((s, l) => s + l.en.length, 0)} chars`
    );
  });

  console.log(
    `\n${lines.length} lines enumerated -> .voice-preview/all-lines.json and ${batches.length} batch files`
  );
  console.log("translations go to .voice-preview/ja/part-NN.json (same keys, value = Japanese line)");
}

/* Merge the per-batch translation parts into one store, reporting every gap. */
function mergeParts(core) {
  const lines = enumerateLines(core);
  const dir = path.join(OUT, "ja");
  const parts = fs
    .readdirSync(dir)
    .filter((name) => /^part-\d+\.json$/.test(name))
    .sort();
  if (!parts.length) throw new Error("no .voice-preview/ja/part-NN.json files to merge");

  const store = {};
  const duplicates = [];
  for (const name of parts) {
    const chunk = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    for (const [key, value] of Object.entries(chunk)) {
      if (store[key] !== undefined) duplicates.push(`${key} (${name})`);
      store[key] = value;
    }
  }
  /* Presenter-authored strings are not part of the batch pass. */
  for (const extra of EXTRAS) {
    if (store[extra.key] !== undefined) duplicates.push(`${extra.key} (script EXTRAS)`);
    store[extra.key] = extra.ja;
  }

  const expected = lines.concat(EXTRAS.map((extra) => ({ key: extra.key })));
  const empty = expected.filter((line) => !String(store[line.key] || "").trim());
  const leftoverNames = expected.filter((line) => /Master|Whale-chan/.test(String(store[line.key] || "")));
  const asciiOnly = expected.filter((line) => {
    const value = String(store[line.key] || "");
    return value && !/[\u3040-\u30ff\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(value);
  });
  const extra = Object.keys(store).filter((key) => !expected.some((line) => line.key === key));

  const report = (label, list) => {
    if (!list.length) return;
    console.error(`${label} (${list.length}):`);
    for (const entry of list.slice(0, 15)) console.error(`  ${entry}`);
    if (list.length > 15) console.error(`  ... and ${list.length - 15} more`);
  };
  report("untranslated", empty.map((line) => line.key));
  report("still containing an English name", leftoverNames.map((line) => line.key));
  report("no Japanese characters at all", asciiOnly.map((line) => line.key));
  report("duplicate keys", duplicates);
  report("stale keys", extra);

  if (empty.length || leftoverNames.length || asciiOnly.length || extra.length) {
    throw new Error(
      `translation store is incomplete: ${empty.length} untranslated, ${leftoverNames.length} with English names, ` +
        `${asciiOnly.length} non-Japanese, ${extra.length} stale (of ${expected.length} lines)`
    );
  }

  const ordered = {};
  for (const line of expected) ordered[line.key] = String(store[line.key]).trim();
  fs.writeFileSync(
    path.join(OUT, "ja-translations.json"),
    `${JSON.stringify(ordered, null, 2)}\n`,
    "utf8"
  );
  console.log(
    `merged ${parts.length} parts -> .voice-preview/ja-translations.json (${lines.length} lines, all keys accounted for)`
  );
}

function buildFullJob(core) {
  const { total, stateLines } = assertLibrary(core);
  const lines = enumerateLines(core).concat(
    EXTRAS.map((extra) => ({
      key: extra.key,
      path: extra.path,
      bank: "PRESENTER",
      event: "celebrate",
      index: extra.index,
      en: extra.en
    }))
  );
  const extraKeys = new Set(EXTRAS.map((extra) => extra.key));
  const translations = path.join(OUT, "ja-translations.json");
  if (!fs.existsSync(translations)) {
    throw new Error(`missing ${path.relative(ROOT, translations)}; run --batches then the translation pass`);
  }
  const store = JSON.parse(fs.readFileSync(translations, "utf8"));

  const missing = lines.filter((line) => !store[line.key] || !String(store[line.key]).trim());
  if (missing.length) {
    for (const line of missing.slice(0, 20)) console.error(`  untranslated: ${line.key}  ${line.en}`);
    throw new Error(`${missing.length} of ${lines.length} lines have no translation`);
  }
  const extra = Object.keys(store).filter((key) => !lines.some((line) => line.key === key));
  if (extra.length) throw new Error(`translation store has ${extra.length} stale keys, e.g. ${extra[0]}`);

  const items = lines.map((line, i) => {
    const ja = normalizeJapanese(store[line.key]);
    const tts = stripEmoji(ja);
    /* Presenter-authored lines legitimately contain no name, but a core line
       that still does means the translation pass missed the substitution. */
    if (!extraKeys.has(line.key) && /Master|Whale-chan/.test(tts)) {
      throw new Error(`${line.key} still contains an untranslated name`);
    }
    if (!tts) throw new Error(`${line.key} produced empty speech text`);
    return {
      n: i + 1,
      key: line.key,
      path: line.path,
      slug: slug(line.path),
      index: line.index,
      en: line.en,
      ja,
      tts
    };
  });

  const job = {
    source: "assets/whale-moe-core.js",
    purpose: "Whale-chan full JP dialogue set (core banks + presenter announcement lines)",
    dialogueCount: total,
    stateLines,
    voices: FULL_VOICES,
    speed: 1.0,
    items
  };
  fs.writeFileSync(path.join(OUT, "job.json"), `${JSON.stringify(job, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(OUT, "lines.all.tsv"),
    `${["n\tkey\ten\tja"]
      .concat(items.map((it) => [it.n, it.key, it.en, it.ja].join("\t")))
      .join("\n")}\n`,
    "utf8"
  );
  console.log(
    `job.json: ${items.length} lines (${stateLines} state + ${items.length - stateLines - EXTRAS.length} dialogue + ${EXTRAS.length} presenter), voices ${FULL_VOICES.join(", ")}`
  );
  console.log("next: .voice-preview/.venv/Scripts/python.exe scripts/kokoro-render.py --job .voice-preview/job.json --variants clean");
}

function buildPilotJob() {
  const core = loadCore();
  const { total, stateLines } = assertLibrary(core);

  const items = PILOT.map((entry, i) => {
    const lines = resolveLine(core, entry.path);
    if (!Array.isArray(lines)) throw new Error(`unknown bank path: ${entry.path}`);
    if (!(entry.index in lines)) {
      throw new Error(`${entry.path}[${entry.index}] is out of range (${lines.length} lines)`);
    }
    const en = lines[entry.index];
    const ja = normalizeJapanese(entry.ja);
    const tts = stripEmoji(ja);
    if (/Master|Whale-chan/.test(tts)) {
      throw new Error(`${entry.path}[${entry.index}] still contains an untranslated name: ${tts}`);
    }
    if (!tts) throw new Error(`${entry.path}[${entry.index}] produced empty speech text`);
    return {
      n: i + 1,
      path: entry.path,
      slug: slug(entry.path),
      index: entry.index,
      en,
      ja,
      tts
    };
  });

  const job = {
    source: "assets/whale-moe-core.js",
    purpose: "Whale-chan JP voice pilot (10 lines, 4 voices, raw + clean phoneme variants)",
    dialogueCount: total,
    stateLines,
    voices: VOICES,
    speed: 1.0,
    items
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "pilot.json"), `${JSON.stringify(job, null, 2)}\n`, "utf8");

  const tsv = ["n\tpath\ten\tja"]
    .concat(items.map((it) => [it.n, `${it.path}[${it.index}]`, it.en, it.ja].join("\t")))
    .join("\n");
  fs.writeFileSync(path.join(OUT, "lines.ja.tsv"), `${tsv}\n`, "utf8");
  console.log(`pilot.json: ${items.length} lines, voices ${VOICES.join(", ")}`);
  console.log("next: .voice-preview/.venv/Scripts/python.exe scripts/kokoro-render.py");
}

try {
  if (process.argv.includes("--setup")) {
    await setup();
  } else if (process.argv.includes("--batches")) {
    const flag = process.argv.indexOf("--batches");
    const count = Number(process.argv[flag + 1]) || 6;
    writeBatches(loadCore(), count);
  } else if (process.argv.includes("--merge")) {
    mergeParts(loadCore());
  } else if (process.argv.includes("--all")) {
    buildFullJob(loadCore());
  } else {
    buildPilotJob();
  }
} catch (error) {
  console.error(`voice-pilot: ${error.message}`);
  process.exit(1);
}

