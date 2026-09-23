import test from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "./load-core.mjs";

const core = loadCore();
const T0 = 1_000_000;

const freshSignals = (over = {}) => ({
  view: "workbench", waiting: false, thinking: false, tool: false,
  successAt: -Infinity, error: false, curiousAt: -Infinity,
  lastInteraction: T0, denseCode: false, ...over
});

test("priority: error beats tool and thinking", () => {
  const out = core.computeState(null, freshSignals({ error: true, tool: true, thinking: true }), T0, () => 0);
  assert.equal(out.state, "failure");
  assert.equal(out.speak, true);
  assert.ok(out.line.length > 0);
});

test("priority: tool beats thinking", () => {
  const out = core.computeState(null, freshSignals({ tool: true, thinking: true }), T0, () => 0);
  assert.equal(out.state, "tool");
  assert.equal(out.pose, "running");
});

test("success only wins inside its 2s window", () => {
  const inWindow = core.computeState(null, freshSignals({ successAt: T0 - 1500 }), T0, () => 0);
  assert.equal(inWindow.state, "success");
  const expired = core.computeState(null, freshSignals({ successAt: T0 - 3000 }), T0, () => 1);
  assert.equal(expired.state, "idle");
});

test("afk after 3 minutes of no interaction", () => {
  const idle = core.computeState(null, freshSignals({ lastInteraction: T0 - 170_000 }), T0, () => 1);
  assert.equal(idle.state, "idle");
  const nap = core.computeState(idle, freshSignals({ lastInteraction: T0 - 181_000 }), T0, () => 0);
  assert.equal(nap.state, "afk");
  assert.equal(nap.pose, "afk");
});

test("speech gap: same state re-speaks only after 6s", () => {
  const first = core.computeState(null, freshSignals({ error: true }), T0, () => 0);
  assert.equal(first.speak, true);
  const quiet = core.computeState(first, freshSignals({ error: true }), T0 + 3000, () => 0);
  assert.equal(quiet.speak, false);
  assert.equal(quiet.line, "");
  const again = core.computeState(quiet, freshSignals({ error: true }), T0 + 9000, () => 0);
  assert.equal(again.speak, true);
  assert.equal(again.streak, 1);
});

test("idle stays idle no matter the rng (no teasing flicker)", () => {
  const low = core.computeState(null, freshSignals(), T0, () => 0.001);
  assert.equal(low.state, "idle");
  const high = core.computeState(null, freshSignals(), T0, () => 0.5);
  assert.equal(high.state, "idle");
});

test("waiting beats idle but not thinking", () => {
  assert.equal(core.computeState(null, freshSignals({ waiting: true }), T0, () => 1).state, "waiting");
  assert.equal(core.computeState(null, freshSignals({ waiting: true, thinking: true }), T0, () => 1).state, "thinking");
});

test("petDisabled short-circuits to hidden without speech", () => {
  const out = core.computeState(null, freshSignals({ petDisabled: true, error: true }), T0, () => 0);
  assert.equal(out.state, "hidden");
  assert.equal(out.pose, null);
  assert.equal(out.speak, false);
});

test("denseCode flips mode to mini", () => {
  const out = core.computeState(null, freshSignals({ denseCode: true }), T0, () => 1);
  assert.equal(out.mode, "mini");
});

test("default rng falls back to idle, not teasing", () => {
  const out = core.computeState(null, freshSignals(), T0);
  assert.equal(out.state, "idle");
});

test("partial prev is normalized with defaults", () => {
  const out = core.computeState({ state: "idle" }, freshSignals({ error: true }), T0, () => 0);
  assert.equal(out.state, "failure");
  assert.equal(out.lastSpeechAt, T0);
  assert.equal(out.lineCount, 1);
  assert.equal(out.streak, 1);
});

test("curious wins inside its 6s window", () => {
  const inWindow = core.computeState(null, freshSignals({ curiousAt: T0 - 4000 }), T0, () => 1);
  assert.equal(inWindow.state, "curious");
  const expired = core.computeState(null, freshSignals({ curiousAt: T0 - 7000 }), T0, () => 1);
  assert.equal(expired.state, "idle");
});

test("afk never covers active work signals", () => {
  const err = core.computeState(null, freshSignals({ error: true, lastInteraction: T0 - 500_000 }), T0, () => 0);
  assert.equal(err.state, "failure");
  const tool = core.computeState(null, freshSignals({ tool: true, lastInteraction: T0 - 500_000 }), T0, () => 0);
  assert.equal(tool.state, "tool");
});

test("non-finite or future success timestamps are ignored", () => {
  assert.notEqual(core.computeState(null, freshSignals({ successAt: Infinity }), T0, () => 1).state, "success");
  assert.notEqual(core.computeState(null, freshSignals({ successAt: T0 + 5000 }), T0, () => 1).state, "success");
  assert.equal(core.computeState(null, freshSignals({ successAt: T0 - 500 }), T0, () => 1).state, "success");
});

test("greetBucket maps all six time buckets", () => {
  assert.equal(core.greetBucket(5), "night");
  assert.equal(core.greetBucket(6), "morning");
  assert.equal(core.greetBucket(8), "morning");
  assert.equal(core.greetBucket(9), "forenoon");
  assert.equal(core.greetBucket(11), "forenoon");
  assert.equal(core.greetBucket(12), "noon");
  assert.equal(core.greetBucket(13), "noon");
  assert.equal(core.greetBucket(14), "afternoon");
  assert.equal(core.greetBucket(17), "afternoon");
  assert.equal(core.greetBucket(18), "evening");
  assert.equal(core.greetBucket(22), "evening");
  assert.equal(core.greetBucket(23), "night");
});

test("weatherText maps WMO codes", () => {
  assert.equal(core.weatherText(0).kind, "sunny");
  assert.equal(core.weatherText(2).kind, "cloudy");
  assert.equal(core.weatherText(61).kind, "rain");
  assert.equal(core.weatherText(71).kind, "snow");
  assert.equal(core.weatherText(95).kind, "thunder");
  assert.equal(core.weatherText(3).kind, "cloudy");
  assert.equal(core.weatherText(45).kind, "fog");
  assert.equal(core.weatherText(999).kind, "unknown");
});

test("classifyTask sorts text into topic buckets", () => {
  assert.equal(core.classifyTask("help me write a React component"), "code");
  assert.equal(core.classifyTask("polish this article into a weekly report"), "write");
  assert.equal(core.classifyTask("research how Server-Sent Events work"), "research");
  assert.equal(core.classifyTask("how do I fix the error"), "bug");
  assert.equal(core.classifyTask("clean the CSV and run stats"), "data");
  assert.equal(core.classifyTask("deploy to the production server"), "deploy");
  assert.equal(core.classifyTask("feeling good today"), "general");
});

test("pickDialogueAvoidRecent avoids recent lines", () => {
  const recent = ["Morning, Master. The sun already reached my tail before you did🌞", "Good morning! Umika is at full power today too😤"];
  const pick = core.pickDialogueAvoidRecent("daily", "morning", 0, () => 0.99, recent);
  assert.equal(pick, "Morning~ Get up or I'll drink all your coffee☕");
});

test("resolveLines: mutes are dropped, edited text is substituted, untouched lines pass through", () => {
  const lines = ["a", "b", "c"];
  const overrides = { "idle:1": { muted: true }, "idle:2": { text: "c-edited" } };
  assert.deepEqual(core.resolveLines(lines, "idle", overrides), ["a", "c-edited"]);
});

test("resolveLines is a no-op without overrides", () => {
  const lines = ["a", "b"];
  assert.deepEqual(core.resolveLines(lines, "idle", null), lines);
});

test("pickDialogue honors mute/edit overrides", () => {
  const overrides = { "daily.holiday:0": { muted: true } };
  const line = core.pickDialogue("daily", "holiday", 0, () => 0, overrides);
  assert.notEqual(line, core.DIALOGUE.daily.holiday[0]);
});

test("meme keyword groups match and have lines", () => {
  assert.equal(core.matchKeyword("I'm a grinder", true), "worker");
  assert.equal(core.matchKeyword("slacking off all day", true), "slack");
  assert.equal(core.matchKeyword("the ddl is coming", true), "ddl");
  assert.equal(core.matchKeyword("my boss is promising the world again", true), "cake");
  assert.equal(core.matchKeyword("I give up, please spare me", true), "crazy");
  assert.equal(core.matchKeyword("let's flag this one", true), "flag");
  assert.equal(core.matchKeyword("this cursed bug again", true), "bugtalk");
  ["worker", "slack", "ddl", "cake", "crazy", "flag", "bugtalk"].forEach((id) => {
    assert.ok(core.DIALOGUE.keyword[id] && core.DIALOGUE.keyword[id].length >= 5, id);
  });
  ["worker", "slack", "ddl", "cake", "crazy", "flag"].forEach((id) => {
    assert.ok(core.DIALOGUE.meme[id] && core.DIALOGUE.meme[id].length >= 5, "meme " + id);
  });
  ["code", "write", "research", "bug", "data", "deploy", "general"].forEach((id) => {
    assert.ok(core.DIALOGUE.context[id] && core.DIALOGUE.context[id].length >= 4, id);
  });
  ["sunny", "rain", "snow", "thunder", "cloudy", "fog", "hot", "cold", "wind"].forEach((id) => {
    assert.ok(core.DIALOGUE.weather[id] && core.DIALOGUE.weather[id].length >= 3, id);
  });
  ["morning", "forenoon", "noon", "afternoon", "evening", "night"].forEach((id) => {
    assert.ok(core.DIALOGUE.greet[id] && core.DIALOGUE.greet[id].length >= 5, id);
  });
});

test("applyNames swaps the user title and the mascot self-name", () => {
  assert.equal(core.applyNames("Hi Master, Umika is here", "Boss", "Lil Whale"), "Hi Boss, Lil Whale is here");
  assert.equal(core.applyNames("Umika is busy", "Master", ""), "Umika is busy");
  assert.equal(core.applyNames("Umika is busy", null, null), "Umika is busy");
  assert.equal(core.applyNames("Hi Master", "", "Lil Whale"), "Hi Master");
  assert.equal(core.applyNames("a sentence with no names", "Boss", "Lil Whale"), "a sentence with no names");
  assert.equal(core.applyNames("", "Boss", "Lil Whale"), "");
  assert.equal(core.applyNames(undefined, "Boss", "Lil Whale"), "");
  /* Every self-reference in a line must be swapped (lines often say
     "Umika" more than once). */
  assert.equal(core.applyNames("Umika says Umika is here", "Master", "Little Whale"), "Little Whale says Little Whale is here");
});

test("applyNames covers the default self-name carried by the line banks", () => {
  const allStates = Object.values(core.LINES).flat().join("|");
  assert.ok(allStates.indexOf("Umika") !== -1, "the line banks should keep the default self-name \"Umika\"");
  assert.equal(core.applyNames("Umika", "Master", "Lil Whale"), "Lil Whale");
});

test("balanceTier maps amounts to the six tiers", () => {
  assert.equal(core.balanceTier(null), "unknown");
  assert.equal(core.balanceTier(undefined), "unknown");
  assert.equal(core.balanceTier(""), "unknown");
  assert.equal(core.balanceTier("abc"), "unknown");
  assert.equal(core.balanceTier(0), "empty");
  assert.equal(core.balanceTier(-1), "empty");
  assert.equal(core.balanceTier(0.5), "critical");
  assert.equal(core.balanceTier(3), "low");
  assert.equal(core.balanceTier(7.83), "ok");
  assert.equal(core.balanceTier(20), "good");
  assert.equal(core.balanceTier(150), "rich");
  /* Boundary values: the thresholds compare with "less than", so an exact match moves up a tier */
  assert.equal(core.balanceTier(1), "low");
  assert.equal(core.balanceTier(5), "ok");
  assert.equal(core.balanceTier(100), "rich");
});

test("pickBalanceAccount prefers CNY and falls back to the first account", () => {
  const usd = { currency: "USD", totalBalance: "0.00" };
  const cny = { currency: "CNY", totalBalance: "183.30" };
  assert.equal(core.pickBalanceAccount([usd, cny]), cny);
  assert.equal(core.pickBalanceAccount([usd]), usd);
  assert.equal(core.pickBalanceAccount([], "CNY"), null);
  assert.equal(core.pickBalanceAccount(null, "CNY"), null);
});

test("formatBalance shows digits or only a tier label", () => {
  assert.equal(core.formatBalance(null, "CNY", true), "—");
  assert.equal(core.formatBalance(7.83, "CNY", true), "¥7.83");
  assert.equal(core.formatBalance(7.83, "CNY", false), "Normal");
  assert.equal(core.formatBalance(150, "CNY", false), "Very comfortable");
  assert.equal(core.formatBalance(0.5, "CNY", false), "Critical");
  /* Tier mode must not leak the exact amount */
  assert.equal(core.formatBalance(7.83, "CNY", false).indexOf("7.83"), -1);
});

test("balance and proactive line banks are populated for every tier", () => {
  const tiers = ["rich", "good", "ok", "low", "critical", "empty"];
  tiers.forEach((tier) => {
    const lines = core.DIALOGUE.balance[tier];
    assert.ok(Array.isArray(lines) && lines.length >= 4, "balance." + tier);
    lines.forEach((line) => assert.equal(typeof line, "string"));
  });
  const kinds = ["long-work", "late-night", "stuck", "welcome-back"];
  kinds.forEach((kind) => {
    const lines = core.DIALOGUE.proactive[kind];
    assert.ok(Array.isArray(lines) && lines.length >= 4, "proactive." + kind);
    lines.forEach((line) => assert.equal(typeof line, "string"));
  });
  /* New lines go through applyNames too, so the self-name is replaceable */
  const joined = Object.values(core.DIALOGUE.proactive).flat().join("|");
  assert.ok(joined.indexOf("Umika") !== -1, "proactive care lines should carry the default self-name");
});
