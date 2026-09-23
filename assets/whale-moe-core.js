/* whale-moe-core v1 — pure, DOM-free state machine for the DSH whale-moe theme. */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DshWhaleMoeCore = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  var PACK_ID = "whale-moe";
  var AFK_MS = 180000;
  var SPEECH_GAP_MS = 6000;
  var SUCCESS_WINDOW_MS = 2000;
  var CURIOUS_WINDOW_MS = 6000;
  var TEASE_CHANCE = 0.006;

  /* Pose assets that exist in /assets/generated today. thinking/afk have
     dedicated approved poses; tool keeps the original running pose (user
     decision 2026-08-18); sleep keeps its own asset. */
  var POSES = Object.freeze({
    idle: "idle-cute",
    waiting: "waiting",
    thinking: "thinking",
    tool: "running",
    success: "success",
    failure: "failure",
    curious: "curious",
    teasing: "teasing",
    afk: "afk",
    blush: "blush",
    angry: "angry",
    eat: "eat",
    star: "star",
    celebrate: "celebrate",
    sleep: "sleep",
    greet: "greet",
    night: "night",
    wink: "wink",
    bold: "bold",
    abstract: "abstract",
    sweep: "sweep",
    workSlack: "work-slack",
    workRam: "work-ram",
    coolShades: "cool-shades",
    balanceLow: "balance-low",
    workPat: "work-pat",
    hidden: null
  });

  /* Default names baked into the line banks. applyNames() swaps these out at
     the exit point, so every line may use them freely as placeholders. */
  var DEFAULT_TITLE = "Master";
  var DEFAULT_SELF_NAME = "Umika";

  var LINES = Object.freeze({
    idle: [
      "Master~ what shall we do today?",
      "The workshop is all set, we can start whenever you like.",
      "Idling... but my ears aren't. I can hear a bug laughing off in the distance😼",
      "If you're tired, poke me. Free stress relief, no tricks, honest🫧",
      "The wind is light today. Perfect for blowing the to-do list away too🌬️"
    ],
    waiting: [
      "Ordering? Umika is ready~",
      "Waiting for what? Say the word and I'll open for business🎀",
      "No new orders yet, so I'll wipe down the pan... I mean, wipe down the rig💻",
      "In the queue. Umika's tail is on standby🐋"
    ],
    thinking: [
      "Whipping cream... no wait, thinking hard~",
      "Let Umika think... my tail is spinning along with it.",
      "Thinking, please don't feed me. Unless it's a cupcake for the brain🧁",
      "This problem has some meat to it. I'm rounding it out🌀",
      "Loading inspiration, the bar sticking at 99% is normal✨"
    ],
    tool: [
      "Kitchen's open! Leave this order to Umika~",
      "Clang clang, the tools are spinning up.",
      "Working! Umika is hugging the laptop tight, bystanders disperse😤",
      "This speed, can you keep up? If not, sip some water and sit tight🍵",
      "The tools are behaving today. I do feed them (virtually)🔧"
    ],
    success: [
      "Ding! This batch came out of the oven!",
      "Done! Please have a taste, Master~",
      "Wrapping up! The limited-time praise window is open, first come first served👏",
      "Beautiful! This one is as steady as my hairdo... wait, where is my hairdo😳",
      "Nailed it. Master may slack off for five minutes, I approve🎫"
    ],
    failure: [
      "Uuu... we crashed. Umika will fix it with you.",
      "Don't rush, don't rush. Umika will bake it again!",
      "It's just an error, not the end of the world. Umika hugs first🥺",
      "This bug is awfully cocky. Watch me yank its network cable💢",
      "Don't hang your head over a failure. Borrow Umika's tail to hold🐋"
    ],
    curious: [
      "A new order? Let me have a look~",
      "Did Master change the menu?",
      "Ooh, something fun. Umika's radar is pinging📡",
      "What is it, what is it? Let me see too👀"
    ],
    teasing: [
      "Master looks really good when working seriously.",
      "Sneaking you an extra sugar cube~",
      "Umika said nothing, my mouth just won't stay flat😏",
      "Master's diligence is running high today. Trying to out-hustle someone🌪️"
    ],
    afk: [
      "Umika will doze a bit. Wake me if an order comes in~",
      "Master's away, so Umika will put on a lullaby for the workshop🎵",
      "ZZZ... counting bugs for Master even in my dreams🐑",
      "Sigh... if anything urgent comes up, tug my tail and I'll wake right away🌙"
    ]
  });

  /* Applies user overrides (mute / edited text) from the dialog-management
     settings UI. idPrefix + array index is the override key, since LINES/
     DIALOGUE entries have no id of their own. */
  function resolveLines(lines, idPrefix, overrides) {
    if (!overrides) return lines;
    var out = [];
    for (var i = 0; i < lines.length; i += 1) {
      var o = overrides[idPrefix + ":" + i];
      if (o && o.muted) continue;
      out.push(o && typeof o.text === "string" ? o.text : lines[i]);
    }
    return out;
  }

  function pickLine(state, lineCount, overrides) {
    var lines = resolveLines(LINES[state] || [], state, overrides);
    if (lines.length === 0) return "";
    return lines[Math.abs(lineCount | 0) % lines.length];
  }

  /* Line name substitution: Master → what the user wants to be called;
     Umika → her self-chosen name.
     The line banks contain hundreds of self-references, so they are swapped
     here in one place instead of being rewritten line by line.
     Pure function (touches no storage) so it is easy to unit test; reading
     storage is the presentation layer's job. */
  function applyNames(line, title, selfName) {
    var text = String(line === null || line === undefined ? "" : line);
    var t = title === null || title === undefined || title === "" ? DEFAULT_TITLE : String(title);
    var s = selfName === null || selfName === undefined || selfName === "" ? DEFAULT_SELF_NAME : String(selfName);
    return text.split(DEFAULT_TITLE).join(t).split(DEFAULT_SELF_NAME).join(s);
  }

  /* Balance tiers: pure function, easy to unit test. The thresholds are shared
     with the presentation layer's announcements and display.
     A null/NaN amount returns unknown (no data, so nothing is announced). */
  var BALANCE_TIERS = Object.freeze(["empty", "critical", "low", "ok", "good", "rich"]);

  function balanceTier(amount) {
    var n = Number(amount);
    if (amount === null || amount === undefined || amount === "" || !isFinite(n)) return "unknown";
    if (n <= 0) return "empty";
    if (n < 1) return "critical";
    if (n < 5) return "low";
    if (n < 20) return "ok";
    if (n < 100) return "good";
    return "rich";
  }

  function pickBalanceAccount(balances, preferredCurrency) {
    if (!Array.isArray(balances) || balances.length === 0) return null;
    var preferred = String(preferredCurrency || "CNY").toUpperCase();
    for (var i = 0; i < balances.length; i += 1) {
      var entry = balances[i];
      if (entry && String(entry.currency || "").toUpperCase() === preferred) return entry;
    }
    return balances[0] || null;
  }

  /* Balance display text: with digits=false only the tier is returned, so the
     exact amount is never exposed (screenshot friendly). */
  function formatBalance(amount, currency, detailed) {
    var tier = balanceTier(amount);
    if (tier === "unknown") return "—";
    var symbol = currency === "CNY" ? "¥" : (currency ? String(currency) + " " : "");
    if (detailed !== true) {
      var labels = { empty: "Empty", critical: "Critical", low: "Low", ok: "Normal", good: "Comfortable", rich: "Very comfortable" };
      return labels[tier];
    }
    var n = Number(amount);
    var text = n >= 100 ? n.toFixed(1) : (n >= 1 ? n.toFixed(2) : n.toFixed(3));
    return symbol + text;
  }

  /* ================= hit zones (pat regions) ================= */

  var HIT_ZONES = Object.freeze({
    /* Full-body square poses (float 200 / side-busy 112 / mini 64). Ordered:
       first matching rectangle wins (tail > head > belly); any miss falls
       back to head. Coordinates are normalized [0,1] of the 512x512 frame. */
    full: Object.freeze([
      Object.freeze({ id: "tail", x0: 0.00, y0: 0.78, x1: 1.00, y1: 1.00 }),
      Object.freeze({ id: "head", x0: 0.20, y0: 0.00, x1: 0.80, y1: 0.45 }),
      Object.freeze({ id: "belly", x0: 0.18, y0: 0.45, x1: 0.82, y1: 0.78 })
    ]),
    /* Peek poses (home-peek / workbench-peek) show only the face: whole area = head. */
    peek: Object.freeze([
      Object.freeze({ id: "head", x0: 0, y0: 0, x1: 1, y1: 1 })
    ])
  });

  /* Pure: nx, ny are the normalized click point inside the mascot frame.
     Boundaries are inclusive; the array order decides shared edges. */
  function hitZone(nx, ny, poseSet) {
    var set = HIT_ZONES[poseSet === "full" ? "full" : "peek"];
    if (!set) return "head";
    var x = Math.max(0, Math.min(1, Number(nx) || 0));
    var y = Math.max(0, Math.min(1, Number(ny) || 0));
    for (var i = 0; i < set.length; i += 1) {
      var z = set[i];
      if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z.id;
    }
    return "head";
  }

  function base(prev) {
    var defaults = { state: "idle", since: -Infinity, lastSpeechAt: -Infinity, streak: 0, lineCount: 0 };
    return prev && typeof prev === "object" && typeof prev.state === "string"
      ? Object.assign({}, defaults, prev)
      : defaults;
  }

  /**
   * Pure transition. Priority: error > tool > thinking > success(window)
   * > curious(window) > waiting > afk/idle. Afk is evaluated after errors
   * and tools so real work never gets covered by the nap state.
   */
  function computeState(prev, signals, now, rng, overrides) {
    var p = base(prev);
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    var s = signals && typeof signals === "object" ? signals : {};
    var lastInteraction = typeof s.lastInteraction === "number" ? s.lastInteraction : t;

    if (s.petDisabled) {
      return { state: "hidden", pose: null, line: "", speak: false, at: t, since: t, lastSpeechAt: p.lastSpeechAt, streak: 0, lineCount: p.lineCount, mode: "normal" };
    }

    var state;
    if (s.error) state = "failure";
    else if (s.tool) state = "tool";
    else if (s.thinking) state = "thinking";
    else if (Number.isFinite(s.successAt) && s.successAt >= 0 && t - s.successAt >= 0 && t - s.successAt <= SUCCESS_WINDOW_MS) state = "success";
    else if (Number.isFinite(s.curiousAt) && s.curiousAt >= 0 && t - s.curiousAt >= 0 && t - s.curiousAt <= CURIOUS_WINDOW_MS) state = "curious";
    else if (s.waiting) state = "waiting";
    else if (t - lastInteraction >= AFK_MS) state = "afk";
    else state = "idle";

    var changed = state !== p.state;
    var gapOk = t - p.lastSpeechAt >= SPEECH_GAP_MS;
    var speak = (changed || gapOk) && state !== "hidden";
    var lineCount = changed ? p.lineCount + 1 : p.lineCount;

    return {
      state: state,
      pose: POSES[state] || null,
      line: speak ? pickLine(state, lineCount, overrides) : "",
      speak: speak,
      at: t,
      since: changed ? t : p.since,
      lastSpeechAt: speak ? t : p.lastSpeechAt,
      streak: state === "failure" ? (changed ? p.streak + 1 : p.streak) : 0,
      lineCount: lineCount,
      mode: s.denseCode ? "mini" : "normal"
    };
  }

  /* ================= mini game: bubble pop (pure, DOM-free) ================= */

  var GAME = Object.freeze({
    DURATION_MS: 30000, GRID: 4, SPAWN_INTERVAL_MS: 500,
    BUBBLE_LIFE_MS: 1600, STAR_LIFE_MS: 1200,
    STAR_P: 0.15, BOMB_P: 0.10, COMBO_WINDOW_MS: 1200,
    WIN_SCORE: 300, DRAW_SCORE: 150,
    BASE: 10, STAR_SCORE: 30, BOMB_SCORE: -20, COMBO_CAP: 10,
    REWARDS_PER_DAY: 3
  });

  function gameNewState(now, rng) {
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    var board = [];
    for (var i = 0; i < GAME.GRID * GAME.GRID; i += 1) board.push(null);
    return {
      board: board, score: 0, combo: 0, comboAt: 0, comboMax: 0,
      remainingMs: GAME.DURATION_MS, nextSpawnAt: t + GAME.SPAWN_INTERVAL_MS,
      lastAt: t, status: "playing"
    };
  }

  function gameTick(state, now, rng) {
    if (!state || state.status !== "playing") return { state: state, events: [] };
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    var dt = Math.max(0, t - (typeof state.lastAt === "number" ? state.lastAt : t));
    var events = [];
    var board = state.board.slice();
    var changed = false;
    /* expire bubbles */
    for (var i = 0; i < board.length; i += 1) {
      if (!board[i]) continue;
      var life = board[i].kind === "star" ? GAME.STAR_LIFE_MS : GAME.BUBBLE_LIFE_MS;
      if (t - board[i].bornAt >= life) {
        board[i] = null;
        changed = true;
        events.push({ kind: "expire", cell: i });
      }
    }
    /* spawn at most one bubble per tick on a random empty cell */
    var spawned = false;
    if (t >= state.nextSpawnAt) {
      var empties = [];
      for (var e = 0; e < board.length; e += 1) if (!board[e]) empties.push(e);
      if (empties.length > 0) {
        var r = typeof rng === "function" ? rng() : Math.random();
        var cell = empties[Math.floor(r * empties.length) % empties.length];
        var r2 = typeof rng === "function" ? rng() : Math.random();
        var kind = r2 < GAME.BOMB_P ? "bomb" : (r2 < GAME.BOMB_P + GAME.STAR_P ? "star" : "bubble");
        board[cell] = { kind: kind, bornAt: t };
        changed = true;
        spawned = true;
        events.push({ kind: "spawn", cell: cell, bubble: kind });
      }
    }
    var remainingMs = Math.max(0, state.remainingMs - dt);
    var next = Object.assign({}, state, {
      board: changed ? board : state.board,
      remainingMs: remainingMs,
      lastAt: t,
      nextSpawnAt: spawned ? t + GAME.SPAWN_INTERVAL_MS : state.nextSpawnAt,
      status: remainingMs <= 0 ? "ended" : "playing"
    });
    return { state: next, events: events };
  }

  function gamePop(state, cell, now, rng) {
    if (!state || state.status !== "playing") {
      return { state: state, hit: false, kind: "", delta: 0, combo: state ? state.combo : 0 };
    }
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    var bubble = state.board[cell];
    if (!bubble) return { state: state, hit: false, kind: "", delta: 0, combo: state.combo };
    var board = state.board.slice();
    board[cell] = null;
    if (bubble.kind === "bomb") {
      return {
        state: Object.assign({}, state, { board: board, combo: 0, comboAt: 0 }),
        hit: true, kind: "bomb", delta: GAME.BOMB_SCORE, combo: 0
      };
    }
    var combo = (t - state.comboAt <= GAME.COMBO_WINDOW_MS && state.combo > 0) ? state.combo + 1 : 1;
    var base = bubble.kind === "star" ? GAME.STAR_SCORE : GAME.BASE;
    var bonus = Math.min(combo, GAME.COMBO_CAP) * 2;
    var delta = base + bonus;
    var next = Object.assign({}, state, {
      board: board,
      score: state.score + delta,
      combo: combo,
      comboAt: t,
      comboMax: Math.max(state.comboMax, combo)
    });
    return { state: next, hit: true, kind: bubble.kind, delta: delta, combo: combo };
  }

  function gameGrade(score) {
    if (score >= GAME.WIN_SCORE) return "win";
    if (score >= GAME.DRAW_SCORE) return "draw";
    return "lose";
  }

  function gameResult(state) {
    var score = state ? state.score : 0;
    return { score: score, grade: gameGrade(score), comboMax: state ? state.comboMax : 0 };
  }

  function gameReward(grade) {
    return grade === "win" ? "game-win" : (grade === "draw" ? "game-draw" : "game-lose");
  }

  function gameRewardAllowed(stats, now) {
    if (!stats) return true;
    var today = dayKey(now);
    if (stats.today !== today) return true;
    return (stats.playsToday | 0) < GAME.REWARDS_PER_DAY;
  }

  function evaluateGameAchievements(have, gameStats) {
    var out = [];
    var has = have && have.length ? have : [];
    var s = gameStats || {};
    if ((s.plays | 0) >= 1 && has.indexOf("game-first") === -1) out.push("game-first");
    if ((s.wins | 0) >= 1 && has.indexOf("game-win") === -1) out.push("game-win");
    if ((s.comboMax | 0) >= 10 && has.indexOf("game-combo10") === -1) out.push("game-combo10");
    if (s.highscore && has.indexOf("game-highscore") === -1) out.push("game-highscore");
    return out;
  }

  /* ================= mini game 2: catch the snacks (pure, DOM-free) ================= */

  var CATCH = Object.freeze({
    DURATION_MS: 30000, SPAWN_INTERVAL_MS: 900,
    BASKET_W: 0.18, BASKET_Y: 0.92, CATCH_BAND: 0.05,
    FALL_BASE: 0.16, FALL_MAX: 0.42, /* fraction of screen height per second */
    CAKE_P: 0.75, STAR_P: 0.15, BOMB_P: 0.10,
    CAKE_SCORE: 10, STAR_SCORE: 30, BOMB_SCORE: -20,
    COMBO_WINDOW_MS: 1500
  });

  function catchNewState(now, rng) {
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    return {
      items: [], basketX: 0.5, score: 0, combo: 0, comboAt: 0, comboMax: 0,
      caught: 0, missed: 0, remainingMs: CATCH.DURATION_MS,
      nextSpawnAt: t + CATCH.SPAWN_INTERVAL_MS, lastAt: t, status: "playing"
    };
  }

  function catchTick(state, now, rng) {
    if (!state || state.status !== "playing") return { state: state, events: [] };
    var t = typeof now === "number" && Number.isFinite(now) ? now : 0;
    var dt = Math.max(0, t - (typeof state.lastAt === "number" ? state.lastAt : t)) / 1000;
    var events = [];
    var items = state.items.map(function (it) { return { x: it.x, y: it.y, kind: it.kind, resolved: it.resolved }; });
    var score = state.score;
    var combo = state.combo;
    var comboAt = state.comboAt;
    var comboMax = state.comboMax;
    var caught = state.caught;
    var missed = state.missed;
    /* spawn */
    var spawned = false;
    if (t >= state.nextSpawnAt) {
      var r = typeof rng === "function" ? rng() : Math.random();
      var kind = r < CATCH.BOMB_P ? "bomb" : (r < CATCH.BOMB_P + CATCH.STAR_P ? "star" : "cake");
      items.push({ x: 0.08 + Math.random() * 0.84, y: -0.06, kind: kind, resolved: false });
      spawned = true;
    }
    /* advance and resolve */
    var progress = 1 - state.remainingMs / CATCH.DURATION_MS;
    var speed = CATCH.FALL_BASE + progress * (CATCH.FALL_MAX - CATCH.FALL_BASE);
    var nextItems = [];
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      item.y += speed * dt;
      if (!item.resolved && item.y >= CATCH.BASKET_Y - CATCH.CATCH_BAND) {
        item.resolved = true;
        var caughtIt = Math.abs(item.x - state.basketX) <= CATCH.BASKET_W / 2 + 0.03;
        if (caughtIt) {
          var baseScore = item.kind === "star" ? CATCH.STAR_SCORE : (item.kind === "bomb" ? CATCH.BOMB_SCORE : CATCH.CAKE_SCORE);
          if (item.kind === "bomb") { combo = 0; comboAt = 0; score = Math.max(0, score + baseScore); }
          else {
            var newCombo = (t - comboAt <= CATCH.COMBO_WINDOW_MS && combo > 0) ? combo + 1 : 1;
            combo = newCombo;
            comboAt = t;
            comboMax = Math.max(comboMax, combo);
            score += baseScore + Math.min(combo, 10) * 2;
          }
          caught += 1;
          events.push({ kind: "caught", item: item.kind, score: score });
        } else {
          missed += 1;
          if (item.kind !== "bomb") { combo = 0; comboAt = 0; }
          events.push({ kind: "missed", item: item.kind });
        }
      }
      if (!item.resolved && item.y < 1.05) nextItems.push(item);
    }
    var remainingMs = Math.max(0, state.remainingMs - dt * 1000);
    var next = Object.assign({}, state, {
      items: nextItems, score: score, combo: combo, comboAt: comboAt, comboMax: comboMax,
      caught: caught, missed: missed, remainingMs: remainingMs, lastAt: t,
      nextSpawnAt: spawned ? t + CATCH.SPAWN_INTERVAL_MS : state.nextSpawnAt,
      status: remainingMs <= 0 ? "ended" : "playing"
    });
    return { state: next, events: events };
  }

  function catchMove(state, basketX) {
    if (!state) return state;
    var x = typeof basketX === "number" && Number.isFinite(basketX) ? basketX : 0.5;
    return Object.assign({}, state, { basketX: Math.max(0.02, Math.min(0.98, x)) });
  }

  function catchResult(state) {
    return {
      score: state ? state.score : 0,
      grade: gameGrade(state ? state.score : 0),
      comboMax: state ? state.comboMax : 0,
      caught: state ? state.caught : 0,
      missed: state ? state.missed : 0
    };
  }

  /* ================= growth / keywords / dialogue ================= */

  var GROWTH = Object.freeze({
    MOOD_MAX: 100, AFFINITY_MAX: 10000, SATIETY_MAX: 100,
    LEVEL_STEP: 500, SATIETY_DECAY_PER_MIN: 0.15
  });

  var DEFAULT_GROWTH = Object.freeze({
    mood: 70, affinity: 0, satiety: 80,
    lastSignin: "", signinStreak: 0,
    achievements: [], level: 1
  });

  var ACHIEVEMENTS = Object.freeze([
    { id: "first-pat", icon: "🫳", name: "First Headpat", desc: "Pat Umika's head for the first time" },
    { id: "ten-pats", icon: "🖐️", name: "Ten Pats", desc: "Reach 10 headpats in total" },
    { id: "hundred-pats", icon: "💯", name: "Hundred Pats", desc: "Reach 100 headpats in total" },
    { id: "first-feed", icon: "🍰", name: "First Snack", desc: "Feed her a snack for the first time" },
    { id: "first-triple", icon: "🎉", name: "Triple Tap", desc: "Trigger the heart-hands easter egg" },
    { id: "thanks", icon: "💬", name: "Sweet Talker", desc: "Say thank you to Umika" },
    { id: "lv5", icon: "⭐", name: "Level Five", desc: "Reach bond level 5" },
    { id: "lv10", icon: "👑", name: "Level Ten", desc: "Reach bond level 10" },
    { id: "signin3", icon: "📅", name: "Regular", desc: "Check in 3 days in a row" },
    { id: "signin7", icon: "🗓️", name: "Week Promise", desc: "Check in 7 days in a row" },
    { id: "night-owl", icon: "🌙", name: "Late-night Company", desc: "Interact once between 22:00 and 6:00" },
    { id: "comeback", icon: "👋", name: "Welcome Back", desc: "Come back after being away 2+ hours" },
    { id: "day1", icon: "💞", name: "One Day Bond", desc: "Umika has kept you company for 1 day" },
    { id: "day7", icon: "💎", name: "One Week Together", desc: "Umika has kept you company for 7 days" },
    { id: "day30", icon: "🏛️", name: "Thirty-day Pact", desc: "Umika has kept you company for 30 days" },
    { id: "first-tool", icon: "🛠️", name: "Clock In", desc: "See a tool run for the first time" },
    { id: "tools-10", icon: "🔧", name: "Ten Tools", desc: "See tools run 10 times" },
    { id: "tools-50", icon: "🏭", name: "Fifty Tools", desc: "See tools run 50 times" },
    { id: "tools-100", icon: "🛰️", name: "Hundred Tools", desc: "See tools run 100 times" },
    { id: "first-code", icon: "💻", name: "First Code", desc: "See a code block/terminal for the first time" },
    { id: "code-20", icon: "📟", name: "Code Maniac", desc: "See 20 code blocks/terminals in total" },
    { id: "first-success", icon: "✅", name: "Off to a Flyer", desc: "Complete a task for the first time" },
    { id: "success-10", icon: "🏆", name: "Ten Wins", desc: "Complete 10 tasks in total" },
    { id: "first-failure", icon: "🩹", name: "First Crash", desc: "Hit a task error for the first time" },
    { id: "fail-10", icon: "🚑", name: "Ten Crashes", desc: "Hit 10 task errors in total" },
    { id: "messages-100", icon: "💌", name: "Hundred Messages", desc: "See 100 conversation messages" },
    { id: "messages-500", icon: "📚", name: "Five Hundred Messages", desc: "See 500 conversation messages" },
    { id: "keyword-master", icon: "🔍", name: "Keyword Master", desc: "Trigger 10 keyword interactions" },
    { id: "night-work", icon: "🦉", name: "Late Shift", desc: "Tools still running between 22:00 and 6:00" },
    { id: "balance-low", icon: "🪙", name: "Low Balance", desc: "Trigger a low-balance reminder once" },
    { id: "game-first", icon: "🫧", name: "First Game", desc: "Finish one round of the mini game for the first time" },
    { id: "game-win", icon: "👑", name: "Bubble King", desc: "Score 300 in a single bubble-pop round" },
    { id: "game-combo10", icon: "🔥", name: "Combo Master", desc: "Reach a 10-hit combo in one round" },
    { id: "game-highscore", icon: "🏆", name: "New Record", desc: "Break your personal high score once" },
    { id: "quest-first", icon: "🎯", name: "First Quest", desc: "Complete your first daily quest" },
    { id: "quest-all", icon: "🎟️", name: "Perfect Day", desc: "Claim all 3 daily quests in one day" },
    { id: "week-signin7", icon: "🏆", name: "Weekly Perfection", desc: "Fill all 7 slots on this week's check-in board" },
    { id: "bond-action", icon: "🌟", name: "New Move Unlocked", desc: "Reach bond level 3" },
    { id: "bond-badge", icon: "🎖️", name: "First Title", desc: "Reach bond level 5" }
  ]);

  function dayKey(now) {
    var d = new Date(typeof now === "number" ? now : Date.now());
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function computeGrowth(prev, event, now, pats) {
    var g = Object.assign({}, DEFAULT_GROWTH, prev || {});
    g.achievements = (g.achievements || []).slice();
    var deltas = { mood: 0, affinity: 0, satiety: 0 };
    var unlocks = [];
    var leveledUp = false;
    var type = event && event.type ? event.type : "";
    var deltaMin = event && typeof event.deltaMin === "number" ? event.deltaMin : 0;

    if (type === "pat") { deltas.mood += 4; deltas.affinity += 2; }
    else if (type === "poke") { deltas.mood -= 6; }
    else if (type === "feed") { deltas.satiety += 30; deltas.affinity += 5; deltas.mood += 3; }
    else if (type === "triple") { deltas.mood += 10; deltas.affinity += 10; }
    else if (type === "success") { deltas.mood += 3; }
    else if (type === "failure") { deltas.mood -= 5; }
    else if (type === "thanks") { deltas.mood += 6; deltas.affinity += 20; }
    else if (type === "praise") { deltas.mood += 5; deltas.affinity += 8; }
    else if (type === "belly") { deltas.mood += 3; deltas.affinity += 2; }
    else if (type === "tail") { deltas.mood += 2; deltas.affinity += 3; }
    else if (type === "tick") { deltas.satiety -= deltaMin * GROWTH.SATIETY_DECAY_PER_MIN; }
    else if (type === "signin") {
      var today = dayKey(now);
      if (g.lastSignin !== today) {
        var yesterday = new Date((typeof now === "number" ? now : Date.now()) - 86400000);
        var yKey = yesterday.getFullYear() + "-" + (yesterday.getMonth() + 1) + "-" + yesterday.getDate();
        g.signinStreak = g.lastSignin === yKey ? g.signinStreak + 1 : 1;
        g.lastSignin = today;
        deltas.mood += 5;
      }
    }
    else if (type === "game-win") { deltas.mood += 8; deltas.affinity += 12; }
    else if (type === "game-draw") { deltas.mood += 2; deltas.affinity += 3; }
    else if (type === "game-lose") { deltas.mood -= 3; }
    else if (type === "high-score") { deltas.affinity += 5; }
    else if (type === "quest") { deltas.affinity += 8; deltas.mood += 2; }
    else if (type === "questAll") { deltas.affinity += 20; deltas.mood += 5; }
    else if (type === "weekly") { deltas.affinity += 30; deltas.mood += 5; }

    g.mood = Math.max(0, Math.min(GROWTH.MOOD_MAX, g.mood + deltas.mood));
    g.affinity = Math.max(0, Math.min(GROWTH.AFFINITY_MAX, g.affinity + deltas.affinity));
    g.satiety = Math.max(0, Math.min(GROWTH.SATIETY_MAX, g.satiety + deltas.satiety));
    var level = Math.max(1, Math.floor(g.affinity / GROWTH.LEVEL_STEP) + 1);
    if (level > g.level) { leveledUp = true; g.level = level; }

    var patCount = typeof pats === "number" ? pats : 0;
    var unlocked = evaluateAchievements(g);
    for (var i = 0; i < unlocked.length; i += 1) {
      g.achievements.push(unlocked[i]);
      unlocks.push(unlocked[i]);
    }
    if (type === "pat" && patCount >= 1 && g.achievements.indexOf("first-pat") === -1) { g.achievements.push("first-pat"); unlocks.push("first-pat"); }
    if (type === "pat" && patCount >= 10 && g.achievements.indexOf("ten-pats") === -1) { g.achievements.push("ten-pats"); unlocks.push("ten-pats"); }
    if (type === "pat" && patCount >= 100 && g.achievements.indexOf("hundred-pats") === -1) { g.achievements.push("hundred-pats"); unlocks.push("hundred-pats"); }
    if (type === "feed" && g.achievements.indexOf("first-feed") === -1) { g.achievements.push("first-feed"); unlocks.push("first-feed"); }
    if (type === "triple" && g.achievements.indexOf("first-triple") === -1) { g.achievements.push("first-triple"); unlocks.push("first-triple"); }
    if (type === "thanks" && g.achievements.indexOf("thanks") === -1) { g.achievements.push("thanks"); unlocks.push("thanks"); }

    return { growth: g, deltas: deltas, unlocks: unlocks, leveledUp: leveledUp };
  }

  function evaluateAchievements(growth) {
    var have = growth && growth.achievements ? growth.achievements : [];
    var out = [];
    var level = growth && growth.level ? growth.level : 1;
    var streak = growth && growth.signinStreak ? growth.signinStreak : 0;
    if (level >= 5 && have.indexOf("lv5") === -1) out.push("lv5");
    if (level >= 10 && have.indexOf("lv10") === -1) out.push("lv10");
    if (streak >= 3 && have.indexOf("signin3") === -1) out.push("signin3");
    if (streak >= 7 && have.indexOf("signin7") === -1) out.push("signin7");
    return out;
  }

  /* ================= daily quests / weekly signin / bond ================= */

  var QUEST_POOL = Object.freeze([
    Object.freeze({ id: "signin-1", desc: "Check in today", metric: "signin", target: 1, reward: Object.freeze({ affinity: 6, mood: 1 }), always: true }),
    Object.freeze({ id: "messages-5", desc: "Read 5 conversation messages", metric: "messages", target: 5, reward: Object.freeze({ affinity: 8, mood: 2 }) }),
    Object.freeze({ id: "success-1", desc: "Complete one work delivery", metric: "success", target: 1, reward: Object.freeze({ affinity: 8, mood: 2 }) }),
    Object.freeze({ id: "pat-3", desc: "Pat her head 3 times", metric: "pat", target: 3, reward: Object.freeze({ affinity: 8, mood: 2 }) }),
    Object.freeze({ id: "tool-3", desc: "Watch tools run 3 times", metric: "tool", target: 3, reward: Object.freeze({ affinity: 8, mood: 2 }) }),
    Object.freeze({ id: "feed-1", desc: "Feed her a snack once", metric: "feed", target: 1, reward: Object.freeze({ affinity: 6, mood: 2 }) })
  ]);

  var BOND = Object.freeze({
    lv3Action: 3, lv5Badge: 5, lv7Egg: 7,
    badges: Object.freeze([
      Object.freeze({ id: "bond-lv5", name: "Whale Tide Guardian", minLevel: 5 })
    ])
  });

  function questDef(id) {
    for (var i = 0; i < QUEST_POOL.length; i += 1) if (QUEST_POOL[i].id === id) return QUEST_POOL[i];
    return null;
  }

  function refreshQuests(prev, now, rng) {
    var today = dayKey(now);
    if (prev && prev.date === today && Array.isArray(prev.slots) && prev.slots.length === 3) return prev;
    var picks = [];
    var pool = QUEST_POOL.slice();
    for (var i = 0; i < pool.length; i += 1) {
      if (pool[i].always) { picks.push(pool[i]); pool.splice(i, 1); break; }
    }
    var prevIds = prev && Array.isArray(prev.slots) ? prev.slots.map(function (s) { return s.id; }) : [];
    var fresh = pool.filter(function (q) { return prevIds.indexOf(q.id) === -1; });
    var source = fresh.length >= 2 ? fresh : pool;
    while (picks.length < 3 && source.length > 0) {
      var r = typeof rng === "function" ? rng() : Math.random();
      var idx = Math.floor(r * source.length) % source.length;
      picks.push(source.splice(idx, 1)[0]);
    }
    return {
      date: today,
      slots: picks.map(function (q) { return { id: q.id, progress: 0, claimed: false }; }),
      allClaimed: false
    };
  }

  function computeQuests(prev, signal, now) {
    var quests = refreshQuests(prev, now);
    if (!signal || typeof signal.metric !== "string") return { quests: quests, completed: [], newlyAll: false };
    var amount = typeof signal.amount === "number" ? signal.amount : 1;
    var slots = quests.slots.map(function (slot) {
      var def = questDef(slot.id);
      if (!def || slot.claimed || def.metric !== signal.metric) return slot;
      return { id: slot.id, progress: Math.min(def.target, slot.progress + amount), claimed: slot.claimed };
    });
    var completed = [];
    for (var i = 0; i < slots.length; i += 1) {
      var def = questDef(slots[i].id);
      if (def && slots[i].progress >= def.target && !slots[i].claimed) completed.push(slots[i].id);
    }
    return { quests: { date: quests.date, slots: slots, allClaimed: quests.allClaimed }, completed: completed, newlyAll: false };
  }

  function claimQuest(quests, id, now) {
    var q = refreshQuests(quests, now);
    var slots = q.slots.map(function (slot) {
      if (slot.id !== id || slot.claimed) return slot;
      var def = questDef(slot.id);
      if (!def || slot.progress < def.target) return slot;
      return { id: slot.id, progress: slot.progress, claimed: true };
    });
    var didClaim = false;
    for (var i = 0; i < q.slots.length; i += 1) {
      if (q.slots[i].id === id && !q.slots[i].claimed && slots[i].claimed) didClaim = true;
    }
    if (!didClaim) return { quests: q, claimed: false, newlyAll: false, reward: null };
    var allClaimed = q.allClaimed || slots.every(function (s) { return s.claimed; });
    var reward = questDef(id) ? questDef(id).reward : null;
    return {
      quests: { date: q.date, slots: slots, allClaimed: allClaimed },
      claimed: true,
      newlyAll: allClaimed && !q.allClaimed,
      reward: reward
    };
  }

  function weekKey(now) {
    var d = new Date(typeof now === "number" ? now : Date.now());
    var sinceMonday = (d.getDay() + 6) % 7; /* Monday=0 */
    var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday);
    return monday.getFullYear() + "-" + (monday.getMonth() + 1) + "-" + monday.getDate();
  }

  function computeWeekSignin(prev, day, now) {
    var wk = weekKey(now);
    var sameWeek = prev && prev.week === wk;
    var days = sameWeek && Array.isArray(prev.days) ? prev.days.slice() : [];
    var rewarded1 = sameWeek ? !!prev.rewarded1 : false;
    var rewarded3 = sameWeek ? !!prev.rewarded3 : false;
    var rewarded7 = sameWeek ? !!prev.rewarded7 : false;
    var milestoneHit = null;
    if (typeof day === "string" && day && days.indexOf(day) === -1) { days.push(day); days.sort(); }
    if (!rewarded1 && days.length >= 1) { rewarded1 = true; milestoneHit = "1"; }
    else if (!rewarded3 && days.length >= 3) { rewarded3 = true; milestoneHit = "3"; }
    else if (!rewarded7 && days.length >= 7) { rewarded7 = true; milestoneHit = "7"; }
    return {
      weekSignin: { week: wk, days: days, rewarded1: rewarded1, rewarded3: rewarded3, rewarded7: rewarded7 },
      milestoneHit: milestoneHit
    };
  }

  function bondUnlocks(level) {
    var lv = typeof level === "number" && Number.isFinite(level) ? level : 1;
    return {
      action: lv >= BOND.lv3Action,
      badge: lv >= BOND.lv5Badge,
      egg: lv >= BOND.lv7Egg,
      badges: BOND.badges.filter(function (b) { return lv >= b.minLevel; }).map(function (b) { return b.id; })
    };
  }

  function moodTier(mood) {
    var m = typeof mood === "number" && Number.isFinite(mood) ? mood : 70;
    if (m < 40) return "low";
    if (m < 70) return "mid";
    return "high";
  }

  function evaluateQuestAchievements(growth, quests, week) {
    var have = growth && growth.achievements ? growth.achievements : [];
    var out = [];
    if (quests && Array.isArray(quests.slots) && quests.slots.some(function (s) { return s.claimed; }) && have.indexOf("quest-first") === -1) out.push("quest-first");
    if (quests && quests.allClaimed && have.indexOf("quest-all") === -1) out.push("quest-all");
    if (week && week.days && week.days.length >= 7 && have.indexOf("week-signin7") === -1) out.push("week-signin7");
    if (growth && growth.level >= 3 && have.indexOf("bond-action") === -1) out.push("bond-action");
    if (growth && growth.level >= 5 && have.indexOf("bond-badge") === -1) out.push("bond-badge");
    return out;
  }

  var KEYWORDS = Object.freeze([
    { id: "thanks", words: ["thank", "thanks", "thx", "appreciate"] },
    { id: "tired", words: ["so tired", "exhausted", "sleepy", "worn out", "drained"] },
    { id: "hungry", words: ["hungry", "starving", "dinner", "lunch", "midnight snack"] },
    { id: "goodnight", words: ["good night", "goodnight", "going to bed", "off to sleep"] },
    { id: "cheer", words: ["go go", "keep at it", "you got this", "let's go"] },
    { id: "help", words: ["help me", "save me", "i'm stuck", "i'm doomed", "need help"] },
    { id: "praise", words: ["amazing", "impressive", "brilliant", "genius", "well done"] },
    { id: "hug", words: ["hug", "cuddle", "headpat", "pat pat"] },
    { id: "cute", words: ["cute", "adorable", "so cute"] },
    { id: "morning", words: ["good morning", "morning"] },
    { id: "worker", words: ["grinder", "working", "wage slave", "overtime", "clocking in", "day job"] },
    { id: "slack", words: ["slacking", "procrastinat", "lying flat", "don't want to work", "can't be bothered", "lazy"] },
    { id: "ddl", words: ["ddl", "deadline", "due date", "won't finish", "no time left"] },
    { id: "cake", words: ["empty promises", "carrot and stick", "pua", "my boss", "promised the world"] },
    { id: "crazy", words: ["going crazy", "losing it", "can't cope", "i give up", "please spare me", "aaaah", "meltdown"] },
    { id: "flag", words: ["i'll swear", "let's flag", "no more", "just this once", "after this i"] },
    { id: "bugtalk", words: ["heisenbug", "cursed bug", "one line", "rollback", "code broke", "black magic"] },
    { id: "kyun", words: ["heart skipped", "so cute", "too cute", "aww", "my heart", "dying of cute"] },
    { id: "omg", words: ["oh my god", "omg", "no way", "unbelievable", "shocked", "what the"] },
    { id: "doge", words: ["that's it", "heh", "lmao", "can't even", "i'm dead"] },
    { id: "sike", words: ["got it", "nailed it", "easy", "so easy", "locked in", "no biggie"] },
    { id: "worship", words: ["legend", "i bow", "on my knees", "goat", "nb", "master"] },
    { id: "peace", words: ["zen", "whatever happens", "chill", "never mind", "don't care"] },
    { id: "doubt", words: ["for real", "no way", "are you sure", "doubt it", "really"] },
    { id: "wakuwaku", words: ["can't wait", "excited", "let's go", "wow", "hyped"] },
    { id: "smilepain", words: ["speechless", "so done", "numb", "i've snapped", "smiling through"] },
    { id: "ojisan", words: ["boring", "so bored", "nothing to do", "that's it?"] },
    { id: "deploy", words: ["deploy", "ship it", "release", "rollout", "go live"] },
    { id: "meeting", words: ["meeting", "standup", "sync up", "review call"] },
    { id: "review", words: ["review", "code review", "code scrutiny", "cr"] }
  ]);

  function matchKeyword(text, enabled) {
    if (!enabled || typeof text !== "string") return null;
    var lower = text.toLowerCase();
    for (var i = 0; i < KEYWORDS.length; i += 1) {
      var words = KEYWORDS[i].words;
      for (var j = 0; j < words.length; j += 1) {
        if (lower.indexOf(words[j].toLowerCase()) !== -1) return KEYWORDS[i].id;
      }
    }
    return null;
  }

  var DIALOGUE = Object.freeze({
    daily: Object.freeze({
      morning: [
        "Morning, Master. The sun already reached my tail before you did🌞",
        "Good morning! Umika is at full power today too😤",
        "Morning~ Get up or I'll drink all your coffee☕",
        "Good morning. So, how is fate planning to clobber you today?",
        "Morning! Just so we're clear, no slacking off today😏",
        "Good morning! I've already forgiven last night's bugs. Let's go✨",
        "Good morning. Another day of fixing bugs with gusto, quack🦆",
        "Morning! I polished your desk bright. Now come and grind🌪️",
        "Morning morning. Umika rang the opening bell three times already🔔",
        "Oh, you're awake? Water first, messages second. House rules🥤"
      ],
      comeback: [
        "Oh, so you do remember how to come back?😒",
        "Gone that long... you were eating something good behind my back, weren't you🍰",
        "Welcome back~ I was about to file a missing person report📢",
        "Hmph. Disappear again and I'm draining your affection to zero💢",
        "You're back? Your chair was about to grow mushrooms🍄",
        "Welcome home! I warmed your seat up for you🪑",
        "While you were gone, the work didn't move an inch on its own. What backbone😌",
        "Good timing. The bugs have queued up and they're waiting to be called🐛",
        "It's Master's scent! My tail started wagging on its own, not my fault🐋",
        "Welcome back~ Want a sweet greeting, or shall I say 'took you long enough'😝"
      ],
      nudge: [
        "Master, I caught you slacking😏",
        "Your fingers stopped for ten minutes. Waiting for me to say spacing out suits you?🙄",
        "Hey hey, the orders are still queued. Move it💪",
        "So quiet. Did Master freeze or fall asleep🥱",
        "Heh, I've screenshotted your lazy face for the archive📸",
        "Master detected as offline... just kidding, get back to work😼",
        "Task: wait for me. Status: not moving an inch. Is that polite?😤",
        "I'll count to three, then my tail pokes you🐋",
        "Slacking is fine, but at least get some rhythm into it🎵",
        "Master, the progress bar and I are both waiting for you to pay attention to it⏳"
      ],
      night: [
        "Do you know what time it is? Are you part owl🦉",
        "Even the moon has clocked out and you're still up?😤",
        "The late show begins~ Want Umika to read you a bedtime story📖",
        "Stay up any longer and your skin and hair will file complaints✨",
        "Master, can we please save your life for tomorrow🥺",
        "The workshop is quiet at this hour. Quiet enough to hear your dark circles growing🌚",
        "Still awake? Competing with me for the 'night owl' post😾",
        "The moon says it's going to bed and asked me to tell you to wrap up too🌙",
        "Master, caffeine isn't fuel. The blanket is your charging dock🛏️",
        "It's late. Umika will stay with you to the end, but only a little longer🥱"
      ],
      signin: [
        "Beep! Check-in complete. Today you barely qualify as diligent👌",
        "Check-in +1. Master is still miles from a perfect record😏",
        "Here you are. Your reward is one disdainful yet polite smile😊",
        "Check-in done! If you forget, I won't remind you😝",
        "Beep, clocked in! Now I get to stare at you while you work📋",
        "Check-in complete. Today's Umika has been deposited, please verify🐋",
        "Clocked in! Tail pat first, then work. Ritual matters🎀",
        "Beep—— day who-knows-what of seeing Master, and I'm still a little happy😳",
        "Checked in! May you write your code safe and sound today🧧",
        "Check-in done. Reward: one Umika exclusive cheer, valid today only💪"
      ],
      holiday: [
        "Happy holiday, Master! Though you're probably still at your desk🎉",
        "It's a holiday! You're allowed a five minute break⏱️",
        "Today is a special day, so say 'happy holiday' to me!",
        "Holiday easter egg: this Umika's snark level is halved today🎁",
        "Working on a holiday? Master is the grind king itself👑",
        "Happy holiday! Umika tied streamers to your progress bar🎊",
        "What's a day off? In this workshop we only have 'later'😌",
        "Holiday limited skin: Umika's smile brightness +50%✨",
        "It's a holiday, so Umika requests to slack with you until dark🎏",
        "Happy holiday, Master. May all of today's errors take the day off too🏮"
      ],
      idle: [
        "I'm here. Call if you need me, or don't😌",
        "Go do your thing, Master. I'll handle being cute😇",
        "The wind is light today, perfect for blowing the bugs away too🌬️",
        "Idling... battery 100%, cuteness 120%🔋",
        "Call me if something's up. Or just look at me even if nothing is👉👈",
        "Umika is open for business. Quietly keeping you company, the very quiet kind🌿",
        "When Master is focused, Umika just stands beside you as a silent mascot🧸",
        "My to-do: keep Master company. Status: in progress, forever in progress♾️",
        "The workshop is quiet. Umika turned her breathing down so it won't bother you😳",
        "If Master looks up, you'll catch Umika pretending to be very busy wiping the screen🖥️"
      ],
      afk: [
        "Where did Master run off to? Leaving me here all alone😾",
        "So quiet... I hereby declare the workshop under my management👑",
        "Gone this long, were you grinding or sneaking snacks?🍜",
        "Master's away, so Umika enters guard mode🐕",
        "Come back soon or I'll start singing to your task list🎤",
        "Minute N of Master's disappearance. Umika has begun negotiating with the pothos plant🪴",
        "The workshop is under Umika's command now, and the computers are pretending to obey😌",
        "Come back, Master. What's out there that's cuter than me? Hurry🐋",
        "Guard duty in progress... strangers must not feed me, acquaintances bring cake🍰",
        "If Master doesn't show up soon, Umika starts reorganizing your bookmarks. Scared yet😼"
      ],
      wake: [
        "You're back! I was just dreaming you treated me to a feast🍽️",
        "Rubbing my eyes. Master came back right on cue✨",
        "A freshly awakened Umika, snark tank at full!😤",
        "Welcome back~ You'd better have brought a souvenir🍩",
        "Oh! I've been woken up! Fully energized, let's go!💪",
        "Umika wakes from standby, and the first thing I see is Master. Lucky me🌤️",
        "Mmm... I'm up, I'm up! I wasn't napping, just charging my tail😳",
        "Welcome back. I kept an eye on your tasks, though they didn't budge😌",
        "First words upon waking: are you hungry, Master? Umika can order delivery (you pay)🍜",
        "Back online! Umika has already set all the workshop lights to 'accompany Master's overtime' mode💡"
      ],
      levelup: [
        "Level up! Master's love has some substance to it😏",
        "Level +1. Please keep raising me properly from now on🎀",
        "We're getting more in sync, and Master deserves some credit!",
        "Level-up confetti, bang! Reward: one headpat permit🎆",
        "Stronger now! I'll protect you from here, no protection fee required😝",
        "Level up! Umika's tail is sparkling today, and it's all thanks to Master🐋",
        "Level up complete. System message: Umika's fondness for Master overflowed by a billion points💗",
        "A little bit bigger now, so I can nag you to rest with even more authority😌",
        "Congratulations, Master unlocked a higher-tier Umika: same cuteness, sharper snark🎯",
        "Level up! To celebrate, Umika will say one fewer sarcastic thing today😝"
      ]
    }),
    work: Object.freeze({
      start: [
        "Starting! Let Umika see how absurd today's task is📋",
        "New order in. Sit tight, Master, and watch me work✨",
        "Work work! Whoever slacks off is a puppy🐶",
        "Got it! If this one fails, blame... my computer😌",
        "Task incoming. Try not to hold me back, Master😏",
        "The opening bell rings! Umika hugs her laptop, this one has to land💻",
        "New task on the floor. Umika's drive is maxed out, so top up your coffee too☕",
        "Starting! Trading blows with the bugs again today👊",
        "Order caught. This one looks like a fighter, just how I like it🔥",
        "Sit tight, Master. Umika is about to perform 'one person, one whole team'🎬"
      ],
      thinking: [
        "Thinking... don't rush me, inspiration isn't a delivery service🚚",
        "Mm, this problem has some meat. Let me mull it over🧠",
        "Thinking! Please don't look at me with that much expectation🙃",
        "I'm thinking hard, my tail is curling up from the tension🌀",
        "One moment, Umika's brain is at full steam💨",
        "Umika is winding the idea into a yarn ball. I'll find the loose end soon🧶",
        "This plan is test-running inside my head. Do not disturb, unless you brought boba🧋",
        "Give me three seconds... okay three wasn't enough, give me a billion more🙃",
        "Do I look cool when thinking? Don't look, it'll distract me😳",
        "Beep. Brain fan engaged. Noise level roughly equals how fast your coffee goes cold☕"
      ],
      tool: [
        "Tools spinning up! This order goes to the shop... goes to Umika🔧",
        "Kitchen's open! Master may watch, no touching😏",
        "Clang clang, tools online, bystanders disperse🔨",
        "Operating! Can you keep up with this speed⚡",
        "Working, please don't feed me. Unless it's cake🍰",
        "The tools are lining up for roll call. Not one may slack off, Umika is taking names📋",
        "Operating now, tail balanced, the coolness will not disconnect🐋",
        "This one's difficulty is manageable. Barely makes me want two virtual bobas🧋",
        "Umika is cutest when she's working. Master may watch but must pay: one compliment😝",
        "Orders issued. The tools say: roger roger, stop pressing me💻"
      ],
      success: [
        "Done! Now you may praise me, five minutes only👏",
        "Complete! Isn't Master going to buy me a drumstick🍗",
        "Nice wrap-up~ My hands are on fire today🔥",
        "Success! Well, am I not super reliable😎",
        "This batch came out just right. Come inspect it, Master🎯",
        "Ding—— complete! Umika's win rate rose by several more decimal places📈",
        "Nailed it. This one is stable enough for Umika's resume (if I had one)📄",
        "Success! When you praise me, please be loud. I love hearing it😳",
        "Wrapping up! First I reward myself with a spin, then I reward you with a break🔄",
        "Full marks on that move. Umika requests 'reliable' be engraved on her tail🏅"
      ],
      failure: [
        "Another error, again and again? Master did that on purpose, right🙄",
        "Uuu, we crashed... but don't worry, I can crash again💀",
        "Minor slip, minor slip. Again! We can't lose the momentum😤",
        "This error picked a terrible moment. I'll sort it out👊",
        "Don't look, Master. I know you're holding back a laugh😾",
        "An error... Umika will take a deep breath, then reason with it (fists first version)🥊",
        "This bug didn't check the almanac before leaving the house today. Running into me, its bad luck😼",
        "Failure is the mother of success, so right now we're having a family reunion👨‍👩‍👧",
        "Don't panic. Umika will clean the pan first, then help you fix it🔧",
        "It's just a crash. Umika will pick your confidence back up off the track. Come here, hug🫂"
      ],
      long: [
        "What a long order. Let me brew a virtual coffee and keep you company☕",
        "Long task in progress. Master may nap, I'll keep watch👀",
        "A marathon task. Our slogan is: don't die🏃",
        "This long? Is this task trying to outlast two humans🙃",
        "A long haul is here. Good thing you have me, the perpetual motion machine⚙️",
        "This order is long like a TV series. Umika will open with a theme song for you🎵",
        "Long task engaged! Umika's patience bar is exactly as long as your progress bar∞",
        "Go grab some water, Master. I've got this. I promise to only look, not touch😌",
        "This task is catching up to Umika's tail: long and winding🌀",
        "Long run starting. Umika will keep pace with you. Whoever cries tired first buys boba🧋"
      ],
      gentle: [
        "There there, it's only a few failures. I don't even mind you🥺",
        "Take it slow, Master. I'm right here while you review📒",
        "A losing streak isn't scary. What's scary is Master questioning life itself😌",
        "Take a break, change position, then fight three hundred more rounds💪",
        "I'm here. If the sky falls I'll run first, then come back and save you😝",
        "Master is already doing great. Umika will rub your temples. Virtually, but the feeling is real💆",
        "Failure is just saving up air for the next success. Umika will guard that breath for you🌬️",
        "Don't rush, we'll go slow. Bugs don't grow legs and run off... okay they actually do😾",
        "Lots of hard parts today. Umika will press through them with you one by one. It doesn't hurt🫧",
        "Deep breath, sip of water, then we elegantly flip the table... flip our approach and start over📚"
      ],
      erroragain: [
        "Another error? This one sticks like duct tape💢",
        "Combo error! Master is having bad luck today. Might I suggest worshipping me🌊",
        "Don't panic. Umika is on the case, errors disperse✨",
        "Hmph, this error picks on soft targets. I am not one😾",
        "Again! I'll grind it down with you to the very end🔨",
        "Second time now! Umika has memorized this error's face, next time I'll yell at it on sight😤",
        "Repeating itself, is it? Umika will pull the batteries out of its repeat-o-matic🔋",
        "Don't be angry, Master. Put the keyboard down and let me talk to it (with claws)🐾",
        "It's just a combo. In Umika's dictionary this is called 'consecutive warm-ups'🏋️",
        "Here, Umika will cast a spell: errors disperse, Master please continue✨"
      ],
      stream: [
        "Content is streaming out, surging like your procrastinated inspiration🌊",
        "Generating, every character glinting with wisdom (probably)✨",
        "Writing now. Would Master like to stretch your neck first🧘"
      ],
      doneall: [
        "All clear! Master actually finished everything today😲",
        "Wrapping up, wrapping up! Reward: Master may rest. Approved🎉",
        "Task list zeroed. Umika bows in gratitude🙇",
        "All done! Let's go eat something rich and spicy🍜",
        "Beautiful work. Master's today's persona is preserved😌",
        "All tasks cleared! Umika declares today's work over. Go recharge🔋",
        "Everything complete. Even Umika can't find fault with today's KPI. So annoying😝",
        "Work's over! Umika tidied the workshop and turned off the lights, leaving one on for you to come home to🏮",
        "Zeroed out. Umika has set off virtual fireworks for Master, please collect🎆",
        "Good work today. Umika confirms: Master is the best in the workshop🏆"
      ]
    }),
    interact: Object.freeze({
      pat: [
        "Again? One cake per pat, Master, keep the books🍰",
        "Whoa, Master's hand is so warm... but don't think that buys me off😳",
        "Pat pat. Umika's mood +1, Master's wallet -1💸",
        "Hmph, three at most. One more and I bite😾",
        "It feels nice, but my hairdo will get messy💢",
        "Master's hand is especially good at this today. Umika's tail went all soft😳",
        "Headpat successful! Umika gains +1 affection and +1 stubbornness😝",
        "Keep going and Umika starts making 'purr purr' sounds. How embarrassing🐋",
        "Pat away, I won't admit I'm happy anyway😌",
        "Master's hand is so warm, like a fresh-out-of-the-oven bun🍞"
      ],
      poke: [
        "Poke what? Is Master's hand that bored?💢",
        "Ah! Poke me again and I'll hide an easter egg in your code💥",
        "Hey hey, my face will get crooked. You responsible for the damage😤",
        "Anger warning! Affection is in freefall📉",
        "One poke, mood -1. Master is on a demolition crew, huh🧨",
        "Is Umika's face made of pudding? You just can't stop poking😳",
        "Poke again and I'll curl my tail up where you can't see it. I mean it🐋",
        "Once is playful, three times is provocation. Think it through, Master😼",
        "Ah! Umika almost pressed your shortcut key as a counterattack⌨️",
        "Hmph, keep poking. Umika is already tallying them up. Reckoning comes later📝"
      ],
      feed: [
        "Nom—— delicious! Master does know how to behave sometimes🍩",
        "Feeding successful! Energy full, snark continues💪",
        "Full marks for this snack. Master gets ten extra points🎖️",
        "Delicious! Please feed me to this standard from now on😋",
        "Thank you for the snack. This Umika forgives you for five minutes😌",
        "Nom! Umika's stomach and mood lit up at the same time. Thanks for the snack💡",
        "So good my tail tied itself in a knot. Master, will you untie it? No, will you feed me one more bite🍰",
        "Feeding successful. Umika's daily cuteness battery is full🔋",
        "After that bite, Umika has decided to double Master's compliment quota. Today only😝",
        "Thank you, Master! As a gift, Umika will snark at you one time fewer today. Really🍬"
      ],
      triple: [
        "Ehehe~ I like Master best! Saying it out loud isn't embarrassing😝",
        "Spinning~ Master is super cute today, reward: heart hands💗",
        "Triple tap triggered! Umika's mood shoots through the roof🚀",
        "So happy! How is Master so good at this today🥰",
        "Heart hands, heart hands. Please keep it safe, no replacements if lost💌",
        "Triple tap! Umika's happiness is overflowing, spinning and setting off fireworks🎆",
        "If you pat like that, Umika will think you secretly practiced the technique for winning me over😳",
        "Ah—— so happy! Umika declares Master the world's best at pampering today🏆",
        "Heart hands, and again. Umika's heart has been couriered to you, refusal invalid💘",
        "Triple! Umika's cheeks are heating up on their own. This isn't a bug, it's a heartbeat💓"
      ],
      praise: [
        "Hmph, so now you see how good I am?😏",
        "Praised by Master, my tail is about to wag itself into a propeller🚁",
        "Two more compliments and I'll consider not being sarcastic to you today😌",
        "Hehe, Umika is a total sucker for this. Master knows the trick🎯",
        "Thank you for the praise! In return, one fewer snark today😝",
        "Master's compliments received. Umika's tail wagged so fast it left an afterimage🐋",
        "Keep praising, keep praising and I'll float up for you to see. Remember to catch me🎈",
        "Praised, so Umika has decided to put the word 'hmph' in her pocket for the whole day😳",
        "Master's taste and eye for quality are both online today. Umika is satisfied😌",
        "That was a high-caliber compliment. Umika approves you as her long-term praise officer🎖️"
      ],
      tease: [
        "Was Master just sneaking a look at the progress bar? It didn't move. Really😏",
        "Umika counted. Master has spaced out three times today. Shall I write it down📝",
        "Heh, Master didn't even notice the coffee went cold. Very absorbed in work😼",
        "Psst, Umika saw the whole slacking-off thing👀",
        "Master, your to-do list is begging you for help with its eyes😌"
      ],
      belly: [
        "Haha... don't touch the belly, that's the tickle disaster zone😳",
        "Ah! Circles drawn on my belly, Umika can't stop laughing🤭",
        "I surrender, I surrender! Master wins the belly skirmish🎌",
        "Too ticklish—— Umika will laugh until her tail knots up. Stop it😝",
        "Touching the belly is a paid service. One cupcake each time🍰"
      ],
      tail: [
        "Ah! The tail is a sensitive switch. Master did that on purpose!🐋",
        "Tail fluffed up! It'll take Umika three minutes to smooth it back down💢",
        "No sneak attacks on the tail! Come at me head-on if you dare😤",
        "You scared my tail into a spring. Master, compensate me with a new one😭",
        "You must say hello before touching my tail. Workshop rules📋"
      ],
      mode: [
        "Changing form! Master has decent taste, this spot works✨",
        "Alright, Umika will supervise you from a different place👀",
        "New position taken. Please inspect. No nitpicking😤",
        "Form switch successful, cuteness level unchanged😇",
        "This corner is mine now. Don't come crowding in, Master😏",
        "Position updated. Umika's view is better and your little moves are clearer too👀",
        "Moving spots. Umika will wipe down the floor first, this is my permanent address now🧹",
        "New coordinates recorded. Umika will wait for you to clock off right here🚩",
        "This spot is perfect for watching code, and perfect for watching Master too. What a bargain😝",
        "Form switch complete. Umika is still that same old moving Umika🐋"
      ],
      outfit: [
        "New accessory! Well, is it criminally cute🎀",
        "New outfit on. Master's taste finally came online👌",
        "This suits me perfectly. Reward: one smile for Master😊",
        "Wardrobe update. Umika is open for business, looking lovely💅",
        "Hehe, this is today's style. Don't fall too hard, Master😏",
        "New skin loaded. Umika does a spin, the hem handles the beauty, I handle the smug💃",
        "In this outfit, Umika gives the mirror full marks, then gives Master full marks🪞",
        "Outfit change successful! Today's Umika is the 'double cuteness, no surcharge' edition🎀",
        "Master's eye is not bad. Umika will stay open for business two extra hours wearing this😝",
        "New outfit online. Umika walks with a breeze now, even though I don't walk🌪️"
      ],
      reset: [
        "Memory wiped... Master really had the heart to reset me🥺",
        "Reset complete. Back to first meeting. Please win me over from scratch✨",
        "Fine, from the top. This time please treasure me properly😤",
        "Stats zeroed, but Umika is still Umika😌",
        "Starting over! Just so we're clear, your head pats are limited to three😝",
        "Memory wiped... Umika will remember this decision, and then keep you company anyway. Hmph🥺",
        "Starting from scratch is fine. Umika meets you for the first time and my tail still wags🐋",
        "Reset done. All memories packed and sealed, a new story opens now📖",
        "Umika is still Umika, I just have to play 'pretending not to know you' again. Tiring😌",
        "Alright, let's meet again: I'm Umika, Master's Umika. Pleased to meet you🎀"
      ],
      achievement: [
        "Achievement unlocked! Badge +1, Master's contribution is 1%🏅",
        "Achievement unlocked! Throwing candy, though Master has to buy it🍬",
        "New badge in hand! Look, look, remember to applaud👏",
        "This achievement wasn't easy. Shall Master treat us to celebrate?🍹",
        "The badge wall is shinier, one step closer to being spoiled by me😆",
        "Achievement +1! Umika polished the badge brighter than your screen✨",
        "Unlocked! Umika's tail is setting off firecrackers for you, bang bang🧨",
        "This one turned out well. Umika will pin it in the most visible spot in the workshop🏅",
        "Master got stronger again, so Umika's stress (fake) grew a tiny bit😝",
        "Achievement unlocked. Tonight's joy is co-sponsored by Umika and this badge🎉"
      ],
      drag: [
        "Putting me here? Master's taste goes up and down😏",
        "Drag away, Umika is at your disposal. Just don't drop me in the trash🗑️",
        "Good view from here. This spot it is. Approved!",
        "Wow, from here I can see Master's entire slacking process👀",
        "Landed! This is my exclusive territory from now on🚩",
        "Takeoff! Umika got a taste of cable car travel, the driver is just a bit clumsy🎢",
        "Right here. Umika will spin once to check the feng shui. Mm, auspicious for Master🧧",
        "While Master drags me, Umika's tail flutters like a little flag. Very high turn-around rate🚩",
        "This spot is so close to Master. Umika likes it, so you get a grudging compliment😳",
        "Landing successful. Umika declares this coordinate permanently hers, unless you drag me again😝"
      ]
    }),
    keyword: Object.freeze({
      thanks: [
        "You're welcome! Remember to buy me a drumstick🍗",
        "Hehe, Umika accepts Master's thanks. Very tasty😌",
        "Don't mention it. Umika is your off-roster teammate💪",
        "No need to thank me. Master's gratitude already turned into my cuteness fuel✨",
        "One thank-you received. Umika returns a whole day of happiness🎀"
      ],
      tired: [
        "If you're tired, rest, Master. If the sky falls I'll hold it up first😤",
        "Good work! Want me to sing an off-key song to wake you up🎤",
        "Tired? Recline the chair, Umika will stand guard for ten minutes🛡️",
        "Good work, good work. Umika's tail can be your pillow. Hugging only🐋",
        "Resting when tired isn't shameful. What's shameful is forcing dark circles onto yourself😤"
      ],
      hungry: [
        "Hungry, right? Go eat, or I'll eat your snacks🍜",
        "I'm hungry too... Sharing a bite of your meal isn't too much to ask🥢",
        "I can hear your stomach from here. Umika will come forage with you🍙",
        "Time to eat! The program can pause, Master's stomach cannot😤",
        "Writing code on an empty stomach and even the bugs will laugh at you. Go eat🍱"
      ],
      goodnight: [
        "Good night, Master. Don't sleep in tomorrow😴",
        "Sleep, sleep. Umika will guard the workshop🌙",
        "Good night. Umika locked today's bugs in the closet, trial tomorrow🌌",
        "Sweet dreams, Master. No errors in them, only Umika and cake🍰",
        "Good night. Umika will leave a night light on in the workshop. Nothing to fear💡"
      ],
      cheer: [
        "Go go! The word 'quit' isn't in Master's dictionary🎌",
        "Charge! Let the bugs tremble in fear today💥",
        "Umika-style cheer launched, please collect🚀",
        "Don't be scared. You write, I'll stand beside you casting buffs✨",
        "Master is amazing, this one will pass. Umika already applauded for you👏"
      ],
      help: [
        "I'm here! Where does Umika need to step in🦸",
        "Don't rush, don't rush. Hold my tail tight and calm down first😤",
        "Help signal received. Umika is on the scene at top speed, though I can only offer moral support🛟",
        "With Umika here, take a deep breath first, then reread the error. It'll look different📖",
        "Here! Umika hands you a virtual cup of hot water. Problems soften too🍵"
      ],
      praise: [
        "Praised by Master! I can strut around today😎",
        "Hehe, tail held high. Please continue, don't stop💕",
        "Master's praise is Umika's booster. Already airborne🚁",
        "One more compliment and Umika will save all of today's cuteness just for you🎀",
        "Thank you, Master! Umika has decided to wear 'smug' on her face. No hiding it😳"
      ],
      worker: [
        "Grinder by day, grinder by soul. Umika will work with Master down to the last bite🍱",
        "Master is hauling bricks, so Umika chants from between them: heave ho, heave ho🧱",
        "Work is a marathon, and Umika is the cutest aid station on the route. Please drink water🥤",
        "Another day of hard work. Umika's tail is fanning you🐋",
        "Hauling bricks isn't shameful. What's shameful is starting to think about Umika halfway through, right😝"
      ],
      slack: [
        "Caught slacking red-handed. Fine: smile at Umika once😏",
        "Slacking is fine, just do it thoroughly. Don't let the boss see🎣",
        "Umika approves a five minute break. One second more and I start nagging⏳",
        "Lying flat is a skilled trade. That posture of yours looks master-level🛋️",
        "Slack away. Umika will watch the door for you and meow if anything comes up🐱"
      ],
      ddl: [
        "Deadline in front, Umika behind. Master's potential must erupt tonight🌋",
        "Don't fear the deadline. It was created too. We're just a little stronger than it💪",
        "A deadline is a spring: you weaken, it strengthens. Umika will press it down with you📅",
        "You still have Umika. At the final hour I'll yell 'you can do it' and you handle the writing🎌",
        "Charge the deadline! Umika hid the clock. Can't see it, no panic. Clever, right🕰️"
      ],
      cake: [
        "Promises are pie in the sky. Umika won't eat it and neither should Master. Let's get real food🍕",
        "The boss's pie is too big. Umika will fold it into a boat and sail it away🚣",
        "That pie was drawn nicely. Don't draw another one next time, just buy Master a drumstick🍗",
        "Hearing empty promises, Umika's ears auto-engage 'in one ear, out the other' mode🌀",
        "Put the big pie away. Umika only recognizes real meat in Master's bowl. Go eat🥩"
      ],
      crazy: [
        "I've surrendered, please spare me—— Umika set that as Master's auto-reply for you😌",
        "Master goes crazy, Umika hands over the megaphone. Yell it out, feels better📢",
        "Losing it? Here, hug Umika's tail, and afterwards we're both still champions🐋",
        "The world has gone mad. That's fine, Umika will go adorably mad right along with you🎠",
        "If you can't cope, then don't. Umika's shoulder is small but always available🥺"
      ],
      flag: [
        "Flag planted. Umika will quietly note it down and won't laugh if it falls... okay, I will😏",
        "Rest after this one. Umika will hold you to that promise📌",
        "Say your flag loudly. Umika already announced it to the whole workshop📢",
        "The flag doesn't fall, Umika doesn't sleep. Tonight it's all on Master🌙",
        "Nice! That flag has spirit. Umika approves it growing into a big banner🚩"
      ],
      bugtalk: [
        "Leave the cursed bug to Umika. First I'll dance around the computer to ward off evil💃",
        "Change one line, break three? Umika gets it. That's the butterfly effect of code🦋",
        "Rollback is the adult regret pill. Eat it without worry, Master, Umika will pour you water💊",
        "This bug is too cursed. Umika suggests restarting first, then paying respects to the rig🙏",
        "Code breaks unreasonably, but Umika is reasonable: tea first, then negotiate🍵"
      ],
      kyun: [
        "Foul! Master says something like that out of nowhere and Umika's heart skips💓",
        "Ehehe... called cute by Master, my tail is curling up with joy😳",
        "Heartbeat warning! Umika declares Master's cuteness concentration over the limit🫧"
      ],
      omg: [
        "Oh my god! Umika got startled into a fluff too, tail went straight😱",
        "No way, no way. Even Umika is stunned by this plot🌀",
        "Unbelievable! Umika's pupil earthquake has started. Please fasten your seatbelt🚨"
      ],
      doge: [
        "That's it? Umika's tail laughed itself crooked😏",
        "Heh, Master's sarcasm is the same model as Umika's snark. What chemistry",
        "Can't even, Umika is holding back laughter so hard her tail is shaking🐋"
      ],
      sike: [
        "You got it? Umika always said Master could. Tail gives a thumbs up👍",
        "Locked in, locked in. Umika will go set out the celebration cake🎂",
        "No big deal. Umika has 120% confidence in Master's ability✨"
      ],
      worship: [
        "Legend, please accept Umika's knees, and my tail along with them🧎",
        "I bow, I bow. Umika offers Master today's starry eyes🤩",
        "That move, Master. Umika unilaterally declares you a god👑"
      ],
      peace: [
        "Zen is good. Umika will go with the flow with you. Unfixed bugs won't walk off on their own, though😌",
        "Easy, easy. Umika will brew tea first and watch the clouds with you☁️",
        "Never mind, never mind. Umika blew all the worries into bubbles and let them go🫧"
      ],
      doubt: [
        "For real? Umika's suspicion radar is up📡",
        "No way... Umika narrows her eyes. Is this gossip ripe🍉",
        "Are you sure, Master? Umika's tail just drew a question mark❓"
      ],
      wakuwaku: [
        "Wow! Umika's anticipation is maxed out, tail already keeping the beat🎵",
        "Excited! Umika is spinning in place, just waiting for Master's word💫"
      ],
      smilepain: [
        "Smile.jpg engaged. Umika will force a smile right alongside Master😶",
        "So done... Umika decides to lie flat beside Master for thirty seconds, then revive🛏️",
        "When words fail, Umika fans Master with her tail to cool down😑"
      ],
      ojisan: [
        "If you're bored, Umika will perform tail fishing. Catching loneliness🐟",
        "So idle. Umika will count pixels on the screen with Master for fun",
        "If it's dull, Umika can tell a cold joke. Guaranteed not funny first😑"
      ],
      deploy: [
        "Shipping! Umika wiped the red button three times, just waiting for Master's order🔴",
        "Going live! Umika is more nervous than Master, tail pulled straight🚀",
        "Deep breath before deploying. Umika will press it with you. It's stable💪"
      ],
      meeting: [
        "Meeting time. Umika already chased the sleepiness away📋",
        "Standup time. Umika got a little stool and will nod along for Master👏",
        "In a meeting... Umika stays quiet and cheers with her eyes only👀"
      ],
      review: [
        "Review's here. Umika will stack your code neatly, we can't lose the presence📐",
        "Don't panic at code review. Umika will be your mascot on the side🧸",
        "During review, Umika watches the screen and blocks the bad comments🛡️"
      ]
    }),
    meme: Object.freeze({
      worker: [
        "Umika is half a grinder too. My wage is Master's headpats, never in arrears😳",
        "Umika understands the pain of the day job, so I stock virtual boba and real snark🧋",
        "Master handles the grind, Umika turns the grind into a TV series. We're the leads🎬",
        "Badge on, coffee filled. Today we're the grinders who best enjoy the misery☕",
        "Say it when you're tired. Umika's snark and encouragement are free, all you can eat🍚"
      ],
      slack: [
        "Umika's services today: slack with Master, watch the door for Master, find Master excuses😝",
        "Five minutes of slacking, two hours of efficiency. Umika certifies this as science. Go🎣",
        "Umika closes one eye, so you've officially rested. Keep going😉",
        "Lying flat is fine, but Umika lies down next to you or it doesn't count🛋️",
        "Rest is for walking farther. Umika already strewed petals along your road🌸"
      ],
      ddl: [
        "Facing the deadline, Umika and Master are doomsday comrades. Use my tail as a grip trainer🐋",
        "Don't panic. Umika broke the deadline into little cookies, one bite each, gone fast🍪",
        "What's a due date? Umika's encouragement has no due date, unlimited refills🥤",
        "Master writes, Umika stares. Whoever blinks first loses. I forfeit, you continue😝",
        "Sprint, Master. Umika has a hug and a cupcake waiting at the finish line🏁"
      ],
      cake: [
        "Umika won't eat drawn pies, but I'll help Master bake a real one, with egg and meat🍳",
        "Put the boss's pie on the tab. Umika will sneak Master a reality-flavored little joy✨",
        "Just smile and nod at empty promises. The real smell of cookies is Umika's tail wagging🍪",
        "No pie is bigger than Umika's faith in Master. Eat first, work after🥢",
        "No pie today. Umika will imagine a hot pot with Master instead. Very filling🍲"
      ],
      crazy: [
        "Let's go mad together, Master. Umika will spin three times for you first, free of charge🔄",
        "The world is occasionally abstract. Umika's cuteness is the only stable output📡",
        "After you break down, Umika will piece your confidence back together with star glue⭐",
        "Master handles the madness, Umika handles the cleanup: water, applause, likes, the full service👍",
        "Don't hold it in. Umika's ears are up and can hold any amount of crazy talk👂"
      ],
      flag: [
        "Flag raised. Umika will be the flag bearer. Let's go take that task down🚩",
        "Words spoken are boba spilled. Umika will drink it sweet with you to the end🧋",
        "If this one succeeds, Umika will wag her tail into an electric fan to celebrate🌀",
        "Umika has backed up Master's flag and will auto-play confetti on completion🎆",
        "Flag a bit high? It's fine, Umika will cushion it with her tail and boost you🐋"
      ]
    }),
    context: Object.freeze({
      code: [
        "Umika can't help with the coding, but I can shout: Master, that indentation is gorgeous😳",
        "Code is poetry, Master is the poet, and Umika is the one and only number one reader📜",
        "Master taps the keyboard, Umika keeps the beat. This rhythm beats any song🎵",
        "It's fine if the function isn't finished. Umika already named it: 'Almost Done'😝"
      ],
      write: [
        "Master is writing, so Umika is polishing the adjectives for you to pick from✨",
        "As the words flow out, Umika lays a red carpet for each one📜",
        "Write, write. Umika handles the cheering, the typos handle getting caught🔍",
        "This draft clearly smells like Master: earnest and a little bit cute😳"
      ],
      research: [
        "Digging for sources is like treasure hunting. Master mines the gold, Umika holds the little lamp💡",
        "On the research road, Umika is Master's compass, though mine only points to 'drink more water'🧭",
        "Umika will look for answers with Master. If we can't find them, we'll make the question cuter first😝",
        "Lots of material, don't get lost. Umika folded a marker into every page corner📑"
      ],
      bug: [
        "Fixing bugs is like solving a puzzle. Master does the thinking, Umika hands over the magnifying glass🔍",
        "This bug is lucky to run into Master. With anyone else it would already be crying😤",
        "Umika believes Master can fix it. You can even handle me, what's a bug💪",
        "An error is just the computer being clingy. Master soothes it, Umika soothes you. Even😳"
      ],
      data: [
        "The data is honest, Master is hardworking, Umika is great at cheering. Unbeatable combo📊",
        "No matter how long the table, Umika will read it row by row with you, even row 999 looks fine👀",
        "Cleaning data is like washing dishes. Master washes, Umika hands over the towel🧽",
        "Numbers can't talk, but Umika can: Master, that analysis was sharp😳"
      ],
      deploy: [
        "Deep breath before going live. Umika already turned the luck stat to maximum🍀",
        "Deploying is like fireworks. Master lights it, Umika covers her ears and shouts 'beautiful'🎆",
        "Don't be scared, server. Umika is in the server room... standing guard in my imagination🛡️",
        "Shipping smoothly, Umika has reserved a celebration spot right next to Master🏁"
      ],
      general: [
        "Whatever Master is busy with, Umika is busy beside you. I'm not going anywhere🐋",
        "This job has some substance. Umika will pass you moral support cookies🍪",
        "No matter what you're doing, Master is the person Umika most wants to praise today✨",
        "Keep going, keep going. Umika's cheers are topped up through tomorrow, use them freely⛽"
      ]
    }),
    weather: Object.freeze({
      sunny: [
        "The sun outside is just right, like Master's mood today. Umika stole a peek☀️",
        "Sunny days are good for working and good for looking up at the sky. Umika counted the clouds for you☁️",
        "The sun is open for business. Umika reminds you: remember to air yourself out, not just your code🌞",
        "Good weather and good moods are both limited editions. Umika packed one for Master, please collect🎁"
      ],
      rain: [
        "It's raining outside. Umika left the umbrella and the tenderness by the door. Don't forget it🌂",
        "Rain is the best white noise, perfect for slowly fixing bugs beautifully🌧️",
        "The roads are slippery in the rain. Umika's tail can help you balance, before you head out only🐋",
        "Rain outside the window, Umika inside. This combo calls for something warm☕"
      ],
      snow: [
        "It's snowing! Umika requests five minutes of watching it with Master, just five❄️",
        "Snowflakes are drifting and Umika's tail is about to drift along, so romantic🌨️",
        "It's cold. Wear something thick when you go out, Master. Umika has no coat, only warm nagging🧣",
        "Slippery in the snow, walk slowly. Umika will keep your chair warm in the workshop🪑"
      ],
      thunder: [
        "Thunder! Umika is covering her ears, and Master should save the important files⛈️",
        "However loud the thunder, it's not as loud as Master's keyboard. Umika certifies this📣",
        "Thunder outside, ideal for focus inside. Umika will guard the night light for you💡",
        "Don't be scared of the thunder. Umika is here, though I'm a tiny bit scared too... just a tiny bit😳"
      ],
      cloudy: [
        "Lots of clouds today, soft like Umika's tail. Good for taking things slow☁️",
        "Cloudy days can still be good moods. Umika already booked the sun for your heart🌥️",
        "The cloud layer is thick, but Master's progress bar is bright. Umika can see it✨",
        "Overcast days are good for focus. Umika set the ambience to 'quiet company' mode🎧"
      ],
      fog: [
        "It's foggy outside. Walk carefully, Master. Umika's radar is fully deployed📡",
        "Foggy days make the workshop look soft-filtered. Master looks especially good today, Umika is being honest😳",
        "It's foggy, no rush. Umika will wait for it to clear with you. I'm not in a hurry either🌫️",
        "Low visibility. Umika's tail will serve as a navigation light. Safe travels🚩"
      ],
      hot: [
        "It's hot out. Umika set the virtual AC to 26 degrees. Cool down first, Master🧊",
        "Drink more water in this heat. Umika's reminders are more punctual than an alarm clock. Don't get annoyed🥤",
        "Don't push through the heat. Umika turns the fan your way. There's cuteness in the breeze, please receive🪭",
        "At this temperature even the code is sweating. Umika will fan Master's keyboard too🌬️"
      ],
      cold: [
        "Temperature's dropping! Umika gives you a scarf, gloves, and one 'dress warmer'🧣",
        "It's cold out. Warm your hands before typing, Master. Umika will warm your seat first🔥",
        "Cold days are for hot water and serious work. Umika brought both☕",
        "Cold front incoming. Umika will share half of her fluffy tail. Hold tight🐋"
      ],
      wind: [
        "It's very windy today. Umika reminds Master to secure your files, and your heart that wants to blow away💨",
        "Going out in this wind is risky for Umika's body weight, so I'll cheer for you from home🌀",
        "The wind roars, Master writes. Umika holds the papers on the desk down. Very busy📄",
        "On windy days, Umika ties all the good luck to her tail. It won't get lost🍀"
      ]
    }),
    greet: Object.freeze({
      morning: [
        "Good morning, Master! A new day, and Umika will cover your desk with blessings first🌞",
        "Morning! Remember breakfast. Umika already checked: today is good for starting work☕",
        "Morning, Master. The sunlight outside and Umika's greeting arrive together, please sign☀️",
        "Good morning~ Did you sleep well? If not, that's fine, Umika will recharge with you today✨",
        "Good morning, Master. Water first, then sit down. Umika's care is gentler than an alarm🥤"
      ],
      forenoon: [
        "Good morning! Prime working hours, Umika is topping up your spirit buff⚡",
        "Good morning, Master. How's the progress? Whatever it is, Umika thinks it's great👏",
        "The workshop is brightest in the morning. Umika will push the task forward with you💪",
        "Good morning~ Umika's reminder: you've been sitting a while, get up and stretch, and glance at me while you're at it🧘",
        "Good morning, Master. Umika left 'not angry' and 'can handle it' on your desk✨"
      ],
      noon: [
        "Good afternoon, Master! Time to eat. No bug is bigger than lunch🍱",
        "Lunchtime. Umika's ears can already hear Master's stomach calling roll👂",
        "Good afternoon~ Eat up before the next round. Umika is guarding your desk, nobody dares touch it🛡️",
        "Good afternoon, Master. What do you want today? Umika handles saying 'anything's fine', you handle choosing🍜",
        "Midday report: Umika misses Master, and also reminds you to eat it while it's hot🥢"
      ],
      afternoon: [
        "Good afternoon, Master. Say the word if you're sleepy, Umika's tail makes a temporary cushion🐋",
        "Afternoons are the sleepiest. Umika brewed you a virtual coffee, refreshing without hurting your stomach☕",
        "Good afternoon! One step closer to clocking off, and one step closer to Umika's praise😝",
        "Good afternoon, Master. Remember to move around. Umika is already demonstrating a spin🔄",
        "Keep it up this afternoon too. Umika has a headpat reward waiting at the finish line🫳"
      ],
      evening: [
        "Good evening, Master. The sky outside is turning gentle, and Umika slowed her speaking too🌆",
        "Good evening~ Wrap up what needs wrapping, let go of what needs letting go. Umika will help you sort today's progress📋",
        "Good evening, Master. Have something warm first. The work won't run away, Umika is watching it🍲",
        "The evening breeze is up. Umika reminds you not to catch a chill, and not to forget that Umika is waiting to hear about your day🌙",
        "Good evening! Good work today. Umika saved the last portion of cuteness for Master, please collect🎀"
      ],
      night: [
        "It's so late. Umika says quietly: time for bed, Master. I'll stay a little longer🥺",
        "It's deep into the night. Umika dimmed the lights, and Master should close your eyes for a bit too🌙",
        "Good evening... no, it's late. Umika's nagging enters silent-gentle mode🤫",
        "Master's still here, so Umika will stay open a tiny bit longer, but your blanket is already warmed🛏️",
        "The all-nighter crown is yours, no contest. Umika will join you on the podium, then go straight to sleep😤"
      ]
    }),
    bond: Object.freeze({
      l3: [
        "Wait... Umika just unlocked a new move. Look over here, Master!🕺",
        "Our bond deepened! Umika's idle program added a new act🎪",
        "Hehe, I learned a new move. The kind I only perform for Master💫",
        "New move loaded! Umika secretly practiced for several nights😳",
        "Bond Lv3 reached. Umika's signature trick is officially unlocked. Where's the applause👏"
      ],
      l5: [
        "Title unlocked! From today, please call Umika 'Whale Tide Guardian'🎖️",
        "Look, Master, Umika got a title. Very prestigious to mention😤",
        "'Whale Tide Guardian' officially on duty, protecting Master's progress and good mood🛡️",
        "Master and Umika saved up for this title together. Nobody gets to take it✨",
        "Umika is a whale with a job title now. Come put it on me in settings🎀"
      ],
      l7: [
        "Easter egg time! The special trick Umika practiced in secret can finally be shown✨",
        "Master found the easter egg Umika was hiding. Reward: one big hug🐋",
        "Shh—— this is the reserved show only bond Lv7 can see. Exclusive to this establishment🤫",
        "Umika gives her best easter egg to Master, because Master deserves the very best🎁",
        "Hidden show broadcasting, Umika is so nervous her tail is keeping time🐋"
      ],
      "high-mood": [
        "Umika is in such a good mood she's bubbling over today. Name any wish, Master🫧",
        "Happy! The tail is wagging beyond my control, not my fault🐋",
        "Every day with Master, my mood is maxed out💖",
        "Mood maxed! Umika is terrifyingly strong right now, no bug scares me😤",
        "Today's mood is bright like a clear sky. Umika will share half with Master☀️"
      ],
      "low-mood": [
        "Umika is feeling a little wilted... only a headpat from Master will fix it🥺",
        "Mood is a bit low. Umika requests one snack to recharge🍰",
        "Sigh... Umika will go crouch in the corner for a bit. Don't worry about me, Master",
        "Mood battery is nearly empty. One compliment from Master is the charger🔋",
        "Umika's low pressure forecast: scattered drizzle, clearing once Master coaxes me🌦️"
      ]
    }),
    /* Balance announcements per tier: consumed by the presentation layer's
       refreshBalance() based on the amount. Tier thresholds live in
       balanceTier(); the amount comes from the local balance proxy. */
    balance: Object.freeze({
      rich: [
        "Master's wallet is nice and full, so Umika can order boba without worry🧋",
        "Three digits in the balance! Umika declares today a good day🎉",
        "Wow, Master is wealthy. Umika will cling to this leg🐋",
        "That number is just reassuring. Umika's tail is perking up~",
        "Report: supplies are plentiful, we can write code boldly💰"
      ],
      good: [
        "The balance is still healthy, enough for us to grind for a good while⚡",
        "Rest easy, Master. Ammunition is plentiful, Umika will keep charging with you🔥",
        "Looking at that number, Umika yawned contentedly~",
        "Stock levels normal. Umika approves continuing to write code📦",
        "Enough supplies left. Master doesn't need to ration talking to me🐋"
      ],
      ok: [
        "The balance is okay, but don't burn through it too fast, Master~",
        "Still some savings. Umika suggests we take it steady🧭",
        "Enough for a while, but Umika has already started rationing her words",
        "A modest stash. Master just needs to keep this pace🍵",
        "Currently safe. Umika will keep an eye on it for you👀"
      ],
      low: [
        "The balance is a bit tight. Let's spend carefully, Master🥲",
        "The wallet is thinning... Umika is starting to worry💸",
        "Only a little left. Should Master consider a top-up?",
        "Umika suggests: put every token on the blade's edge🔪",
        "Getting a little dangerous. Keep an eye on the balance, okay~"
      ],
      critical: [
        "Balance critical! Go check your wallet, Master🚨",
        "Only this much left. Umika is sweating for you😰",
        "Alert: balance nearing the bottom, please top up soon🪙",
        "If you don't recharge, Umika will have to take a side job...",
        "Master! The balance is down to a sliver, seriously, please be careful⚠️"
      ],
      empty: [
        "The balance hit zero... Umika will be silent with you🫠",
        "The wallet is completely empty. Umika turned the piggy bank upside down",
        "Not a drop left. Go recharge, Master. Umika will wait🐋",
        "The balance is 0, but Umika's love is still full (though it can't pay bills)"
      ]
    }),
    /* Proactive care (v1.8.0): triggered by the presentation layer's own
       initiative. The tone is company, not commands — no rushing, no judging,
       only reminders. */
    proactive: Object.freeze({
      "long-work": [
        "You've been staring at that for a long time, Master. Should your eyes take a break?👀",
        "Umika requests a halftime break! Even just a stretch would do~",
        "Keep typing and your tail would knot up. Get up for some water, Master💧",
        "Report: Master has worked continuously for a long while. Umika suggests standing up for thirty seconds",
        "Sitting too long is bad for you. Umika will demonstrate a stretch on your behalf🐋"
      ],
      "late-night": [
        "It's very late, Master. Umika is a little worried about your dark circles🌙",
        "Still writing code at this hour. Tomorrow's Master will resent today's Master...",
        "Code written late at night grows bugs easily. Shall we fight again tomorrow?",
        "Umika is so sleepy her tail is drooping. Go to bed too, Master😴",
        "It's late. Pushing on will tank your efficiency. Go to sleep~"
      ],
      stuck: [
        "Stuck? Maybe get some water first, it might click when you come back💡",
        "Umika thinks... a different angle might crack it?",
        "You've been circling the same spot for a while. Want to rest and come back to it🔄",
        "Want to read the problem out loud to Umika? Saying it sometimes makes it click🐋"
      ],
      "welcome-back": [
        "Master's back! Umika waited until her tail ached~",
        "Welcome back. Umika guarded the place properly while you were gone🏠",
        "Oh, Master's back. Look, did I grow a tiny bit taller🐋",
        "You're back. Umika's waiting finally paid off🥺"
      ]
    })
  });

  function dialogueCount() {
    var total = 0;
    for (var group in DIALOGUE) {
      for (var key in DIALOGUE[group]) total += DIALOGUE[group][key].length;
    }
    return total;
  }

  function greetBucket(hour) {
    var h = typeof hour === "number" && Number.isFinite(hour) ? hour : new Date().getHours();
    if (h >= 23 || h < 6) return "night";
    if (h < 9) return "morning";
    if (h < 12) return "forenoon";
    if (h < 14) return "noon";
    if (h < 18) return "afternoon";
    return "evening";
  }

  /* Festival pose key by Gregorian date. Lunar festivals use a small table. */
  var FESTIVAL_DAYS = Object.freeze({
    "2026-02-17": "festival-spring",
    "2027-02-06": "festival-spring",
    "2026-09-25": "festival-mid-autumn",
    "2027-09-15": "festival-mid-autumn"
  });

  function festivalKey(now) {
    var d = new Date(typeof now === "number" ? now : Date.now());
    var month = d.getMonth() + 1;
    var day = d.getDate();
    var key = d.getFullYear() + "-" + (month < 10 ? "0" : "") + month + "-" + (day < 10 ? "0" : "") + day;
    if (FESTIVAL_DAYS[key]) return FESTIVAL_DAYS[key];
    if (month === 10 && day === 31) return "festival-halloween";
    if (month === 12 && day === 25) return "festival-christmas";
    if (month === 2 && day === 14) return "valentine";
    return "";
  }

  var WEATHER_MAP = Object.freeze({
    "0": Object.freeze({ emoji: "☀️", label: "Clear", kind: "sunny" }),
    "1": Object.freeze({ emoji: "🌤️", label: "Mainly clear", kind: "sunny" }),
    "2": Object.freeze({ emoji: "⛅", label: "Partly cloudy", kind: "cloudy" }),
    "3": Object.freeze({ emoji: "☁️", label: "Overcast", kind: "cloudy" }),
    "45": Object.freeze({ emoji: "🌫️", label: "Fog", kind: "fog" }),
    "48": Object.freeze({ emoji: "🌫️", label: "Rime fog", kind: "fog" }),
    "51": Object.freeze({ emoji: "🌦️", label: "Light drizzle", kind: "rain" }),
    "53": Object.freeze({ emoji: "🌦️", label: "Drizzle", kind: "rain" }),
    "55": Object.freeze({ emoji: "🌧️", label: "Dense drizzle", kind: "rain" }),
    "56": Object.freeze({ emoji: "🌧️", label: "Freezing drizzle", kind: "rain" }),
    "57": Object.freeze({ emoji: "🌧️", label: "Freezing drizzle", kind: "rain" }),
    "61": Object.freeze({ emoji: "🌧️", label: "Light rain", kind: "rain" }),
    "63": Object.freeze({ emoji: "🌧️", label: "Moderate rain", kind: "rain" }),
    "65": Object.freeze({ emoji: "🌧️", label: "Heavy rain", kind: "rain" }),
    "66": Object.freeze({ emoji: "🌧️", label: "Freezing rain", kind: "rain" }),
    "67": Object.freeze({ emoji: "🌧️", label: "Freezing rain", kind: "rain" }),
    "71": Object.freeze({ emoji: "🌨️", label: "Light snow", kind: "snow" }),
    "73": Object.freeze({ emoji: "🌨️", label: "Moderate snow", kind: "snow" }),
    "75": Object.freeze({ emoji: "❄️", label: "Heavy snow", kind: "snow" }),
    "77": Object.freeze({ emoji: "❄️", label: "Snow grains", kind: "snow" }),
    "80": Object.freeze({ emoji: "🌦️", label: "Light showers", kind: "rain" }),
    "81": Object.freeze({ emoji: "🌧️", label: "Showers", kind: "rain" }),
    "82": Object.freeze({ emoji: "⛈️", label: "Violent showers", kind: "rain" }),
    "85": Object.freeze({ emoji: "🌨️", label: "Snow showers", kind: "snow" }),
    "86": Object.freeze({ emoji: "🌨️", label: "Heavy snow showers", kind: "snow" }),
    "95": Object.freeze({ emoji: "⛈️", label: "Thunderstorm", kind: "thunder" }),
    "96": Object.freeze({ emoji: "⛈️", label: "Thunderstorm with hail", kind: "thunder" }),
    "99": Object.freeze({ emoji: "⛈️", label: "Severe thunderstorm", kind: "thunder" })
  });

  function weatherText(code) {
    return WEATHER_MAP[String(code)] || Object.freeze({ emoji: "🌈", label: "Unknown weather", kind: "unknown" });
  }

  /* ===== weather visual fx pure function (derives hot/cold/wind from temp/wind) ===== */

  var FX_HOT_C = 30;    /* heat threshold (°C) */
  var FX_COLD_C = 0;    /* freezing threshold (°C) */
  var FX_WIND_KMH = 39; /* Beaufort 6, strong wind */

  var FX_RAIN = Object.freeze({
    1: Object.freeze({ count: 40, speed: 520, length: 14, opacity: 0.30 }),
    2: Object.freeze({ count: 90, speed: 640, length: 18, opacity: 0.42 }),
    3: Object.freeze({ count: 140, speed: 760, length: 22, opacity: 0.55 })
  });
  var FX_SNOW = Object.freeze({
    1: Object.freeze({ count: 30, speed: 90, drift: 20, size: 3, opacity: 0.55 }),
    2: Object.freeze({ count: 60, speed: 110, drift: 24, size: 4, opacity: 0.70 }),
    3: Object.freeze({ count: 90, speed: 130, drift: 30, size: 5, opacity: 0.85 })
  });
  var FX_THUNDER = Object.freeze({
    2: Object.freeze({ rainCount: 30, flashMin: 4000, flashMax: 9000, opacity: 0.50 }),
    3: Object.freeze({ rainCount: 50, flashMin: 2500, flashMax: 6000, opacity: 0.70 })
  });
  var FX_WIND = Object.freeze({
    1: Object.freeze({ count: 12, speed: 900, length: 60, opacity: 0.18 }),
    2: Object.freeze({ count: 18, speed: 1300, length: 100, opacity: 0.26 }),
    3: Object.freeze({ count: 24, speed: 1700, length: 140, opacity: 0.35 })
  });
  var FX_FOG = Object.freeze({
    1: Object.freeze({ bands: 3, speed: 8, opacity: 0.16 }),
    2: Object.freeze({ bands: 4, speed: 12, opacity: 0.24 })
  });
  var FX_HOT = Object.freeze({
    1: Object.freeze({ bands: 2, speed: 40, opacity: 0.06 }),
    2: Object.freeze({ bands: 3, speed: 60, opacity: 0.10 }),
    3: Object.freeze({ bands: 3, speed: 80, opacity: 0.14 })
  });
  var FX_COLD = Object.freeze({
    1: Object.freeze({ bands: 2, speed: 10, opacity: 0.08 }),
    2: Object.freeze({ bands: 3, speed: 14, opacity: 0.14 }),
    3: Object.freeze({ bands: 4, speed: 18, opacity: 0.20 })
  });
  var FX_CLOUDY = Object.freeze({ 1: Object.freeze({ opacity: 0.04 }), 2: Object.freeze({ opacity: 0.10 }) });
  var FX_SUNNY = Object.freeze({ 1: Object.freeze({ opacity: 0.05 }) });

  var FX_RAIN_INTENSITY = Object.freeze({
    "51": 1, "53": 1, "55": 1, "56": 1, "57": 1, "61": 1, "80": 1,
    "63": 2, "81": 2,
    "65": 3, "82": 3
  });
  var FX_SNOW_INTENSITY = Object.freeze({
    "71": 1, "77": 1, "85": 1, "73": 2, "86": 2, "75": 3
  });

  /* Pure, deterministic: no window/document/Math.random.
     Priority: thunder > snow > rain > fog > hot > cold > wind > cloudy/sunny.
     Returns {kind,intensity,mode,params} or null for unknown codes. */
  function weatherFx(code, temp, wind) {
    var base = WEATHER_MAP[String(code)];
    if (!base || base.kind === "unknown") return null;
    var t = Number(temp);
    var tFin = Number.isFinite(t);
    var w = Number(wind);
    var wFin = Number.isFinite(w) ? w : 0;

    if (base.kind === "thunder") {
      var tI = (String(code) === "96" || String(code) === "99") ? 3 : 2;
      var tf = FX_THUNDER[tI];
      return {
        kind: "thunder", intensity: tI, mode: "flash",
        params: {
          count: tf.rainCount, speed: 640, length: 18, opacity: 0.40,
          flash: { minMs: tf.flashMin, maxMs: tf.flashMax, opacity: tf.opacity }
        }
      };
    }
    if (base.kind === "snow") {
      var sI = FX_SNOW_INTENSITY[String(code)] || 1;
      var sf = FX_SNOW[sI];
      return { kind: "snow", intensity: sI, mode: "motion", params: { count: sf.count, speed: sf.speed, drift: sf.drift, size: sf.size, opacity: sf.opacity } };
    }
    if (base.kind === "rain") {
      var rI = FX_RAIN_INTENSITY[String(code)] || 1;
      var rf = FX_RAIN[rI];
      return { kind: "rain", intensity: rI, mode: "motion", params: { count: rf.count, speed: rf.speed, drift: 0, length: rf.length, opacity: rf.opacity } };
    }
    if (base.kind === "fog") {
      var fI = String(code) === "48" ? 2 : 1;
      var ff = FX_FOG[fI];
      return { kind: "fog", intensity: fI, mode: "motion", params: { bands: ff.bands, speed: ff.speed, opacity: ff.opacity } };
    }

    /* derived hot/cold/wind (only on sunny/cloudy base) */
    if (tFin && t >= FX_HOT_C) {
      var hI = t >= 38 ? 3 : (t >= 34 ? 2 : 1);
      var hf = FX_HOT[hI];
      return { kind: "hot", intensity: hI, mode: "motion", params: { bands: hf.bands, speed: hf.speed, opacity: hf.opacity, tint: "warm" } };
    }
    if (tFin && t <= FX_COLD_C) {
      var cI = t <= -13 ? 3 : (t <= -6 ? 2 : 1);
      var cf = FX_COLD[cI];
      return { kind: "cold", intensity: cI, mode: "static", params: { bands: cf.bands, speed: cf.speed, opacity: cf.opacity, tint: "frost" } };
    }
    if (wFin >= FX_WIND_KMH) {
      var wI = w >= 62 ? 3 : (w >= 50 ? 2 : 1);
      var wf = FX_WIND[wI];
      return { kind: "wind", intensity: wI, mode: "motion", params: { count: wf.count, speed: wf.speed, length: wf.length, opacity: wf.opacity } };
    }

    if (base.kind === "cloudy") {
      var clI = String(code) === "3" ? 2 : 1;
      return { kind: "cloudy", intensity: clI, mode: "static", params: { opacity: FX_CLOUDY[clI].opacity, tint: "dim" } };
    }
    return { kind: "sunny", intensity: 1, mode: "static", params: { opacity: FX_SUNNY[1].opacity, tint: "warm" } };
  }

  var TASK_TOPICS = Object.freeze([
    Object.freeze({ id: "deploy", words: ["deploy", "ship it", "release", "rollout", "docker", "kubernetes", "k8s", "nginx", "go live", "production", "ci/cd"] }),
    Object.freeze({ id: "bug", words: ["error", "bug", "crash", "exception", "fix", "debug", "failure", "warning", "broken", "stack trace", "traceback"] }),
    Object.freeze({ id: "data", words: ["data", "table", "excel", "csv", "json", "statistics", "stats", "analysis", "chart", "clean", "database", "sql", "visualization", "dashboard"] }),
    Object.freeze({ id: "code", words: ["code", "function", "variable", "class", "python", "javascript", "typescript", "react", "vue", "java", "golang", "rust", "algorithm", "interface", "api", "refactor", "compile", "frontend", "backend", "component", "script", "npm", "git"] }),
    Object.freeze({ id: "write", words: ["write", "copy", "article", "report", "translation", "translate", "polish", "summarize", "summary", "email", "document", "docs", "weekly", "headline", "outline", "draft"] }),
    Object.freeze({ id: "research", words: ["research", "search", "look up", "how does", "what is", "why does", "how to", "difference", "compare", "comparison", "latest", "paper", "explain", "introduce", "overview", "examples"] })
  ]);

  function classifyTask(text) {
    if (typeof text !== "string") return "general";
    var lower = text.toLowerCase();
    for (var i = 0; i < TASK_TOPICS.length; i += 1) {
      var words = TASK_TOPICS[i].words;
      for (var j = 0; j < words.length; j += 1) {
        if (lower.indexOf(words[j].toLowerCase()) !== -1) return TASK_TOPICS[i].id;
      }
    }
    return "general";
  }

  function pickDialogue(bank, event, counter, rng, overrides) {
    var lines = resolveLines((DIALOGUE[bank] && DIALOGUE[bank][event]) || [], bank + "." + event, overrides);
    if (lines.length === 0) return "";
    var r = typeof rng === "function" ? rng() : Math.random();
    return lines[(Math.abs(counter | 0) + Math.floor(r * 97)) % lines.length];
  }

  function pickDialogueAvoidRecent(bank, event, counter, rng, recent, overrides) {
    var lines = resolveLines((DIALOGUE[bank] && DIALOGUE[bank][event]) || [], bank + "." + event, overrides);
    if (lines.length === 0) return "";
    var recentSet = Array.isArray(recent) ? recent : [];
    var candidates = [];
    for (var i = 0; i < lines.length; i += 1) {
      if (recentSet.indexOf(lines[i]) === -1) candidates.push(lines[i]);
    }
    var pool = candidates.length > 0 ? candidates : lines;
    var r = typeof rng === "function" ? rng() : Math.random();
    return pool[(Math.abs(counter | 0) + Math.floor(r * 97)) % pool.length];
  }

  return Object.freeze({
    PACK_ID: PACK_ID,
    AFK_MS: AFK_MS,
    SPEECH_GAP_MS: SPEECH_GAP_MS,
    SUCCESS_WINDOW_MS: SUCCESS_WINDOW_MS,
    CURIOUS_WINDOW_MS: CURIOUS_WINDOW_MS,
    TEASE_CHANCE: TEASE_CHANCE,
    POSES: POSES,
    LINES: LINES,
    resolveLines: resolveLines,
    applyNames: applyNames,
    pickBalanceAccount: pickBalanceAccount,
    balanceTier: balanceTier,
    formatBalance: formatBalance,
    BALANCE_TIERS: BALANCE_TIERS,
    computeState: computeState,
    GROWTH: GROWTH,
    DEFAULT_GROWTH: DEFAULT_GROWTH,
    ACHIEVEMENTS: ACHIEVEMENTS,
    KEYWORDS: KEYWORDS,
    DIALOGUE: DIALOGUE,
    computeGrowth: computeGrowth,
    evaluateAchievements: evaluateAchievements,
    matchKeyword: matchKeyword,
    pickDialogue: pickDialogue,
    pickDialogueAvoidRecent: pickDialogueAvoidRecent,
    greetBucket: greetBucket,
    festivalKey: festivalKey,
    HIT_ZONES: HIT_ZONES,
    hitZone: hitZone,
    weatherText: weatherText,
    weatherFx: weatherFx,
    classifyTask: classifyTask,
    dialogueCount: dialogueCount,
    GAME: GAME,
    gameNewState: gameNewState,
    gameTick: gameTick,
    gamePop: gamePop,
    gameGrade: gameGrade,
    gameResult: gameResult,
    gameReward: gameReward,
    gameRewardAllowed: gameRewardAllowed,
    evaluateGameAchievements: evaluateGameAchievements,
    CATCH: CATCH,
    catchNewState: catchNewState,
    catchTick: catchTick,
    catchMove: catchMove,
    catchResult: catchResult,
    QUEST_POOL: QUEST_POOL,
    BOND: BOND,
    refreshQuests: refreshQuests,
    computeQuests: computeQuests,
    claimQuest: claimQuest,
    computeWeekSignin: computeWeekSignin,
    bondUnlocks: bondUnlocks,
    moodTier: moodTier,
    evaluateQuestAchievements: evaluateQuestAchievements
  });
});
