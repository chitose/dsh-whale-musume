# Meme Chat + Cute Dialogue + Weather Companionship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Umika's dialogue lines to about 500 (safe memes + cute), add 5–8 minute on-topic proactive chitchat, time-based greetings and Open-Meteo weather companionship, without breaking the v1.0.2 work-state stability.

**Architecture:** All pure logic (dialogue bank / bucketing / weather codes / topic classification) goes into `assets/whale-moe-core.js`; DOM/network/scheduling goes into `assets/dsh-whale-moe.js`; the settings panel (city / API Key / test connection) is injected as a React component by `scripts/apply-theme.mjs`. No new script files, no new dependencies.

**Tech Stack:** Vanilla ES5-style UMD core, browser fetch/AbortController, React JSX-runtime injection, node --test + CDP.

## Global Constraints

- Version: `package.json` → 1.1.0; README badge synced
- Total dialogue lines ≥ 480; cuteness-first + safe memes; no politics/discrimination/controversial memes
- Weather only requests Open-Meteo; empty city = zero network requests; task text is only classified locally
- Work states (thinking/tool/success/failure) must not be interrupted by proactive chitchat; work-state pose priority rules unchanged
- Proactive chitchat interval 5–8 minutes; no proactive greetings from 23:00–5:59
- The existing 37 unit tests + CDP + motion QA + soak-work must stay green
- Settings injection marker upgraded to `DSH-WHALE-MOE:MASCOT-SETTINGS v11` (legacy list includes v1–v10)

---

### Task 1: Core pure-logic helpers (greetBucket / weatherText / classifyTask / pickDialogueAvoidRecent)

**Files:**
- Modify: `assets/whale-moe-core.js:300-340` (insert the helpers near `pickDialogue`, and export them in the return)
- Test: `test/whale-moe-core.test.mjs` (append tests)

**Interfaces:**
- Produces:
  - `greetBucket(hour: number): "morning"|"forenoon"|"noon"|"afternoon"|"evening"|"night"` (6:00–8:59 morning, 9:00–11:59 forenoon, 12:00–13:59 noon, 14:00–17:59 afternoon, 18:00–22:59 evening, 23:00–5:59 night)
  - `weatherText(code: number|string): { emoji: string, label: string, kind: "sunny"|"cloudy"|"rain"|"snow"|"thunder"|"wind"|"hot"|"cold"|"fog"|"unknown" }`
  - `classifyTask(text: string): "code"|"write"|"research"|"bug"|"data"|"deploy"|"general"`
  - `pickDialogueAvoidRecent(bank, event, counter, rng, recent): string`

- [ ] **Step 1: Write the failing test**

The import at the top of `test/whale-moe-core.test.mjs` already exists (check the file for the existing approach, such as `import core from "../assets/whale-moe-core.js"`), append:

```js
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
  assert.equal(core.classifyTask("Help me write a React component"), "code");
  assert.equal(core.classifyTask("Polish this article into a weekly report"), "write");
  assert.equal(core.classifyTask("Research the principle of Server-Sent Events"), "research");
  assert.equal(core.classifyTask("How do I fix this error"), "bug");
  assert.equal(core.classifyTask("Clean the CSV and run statistics"), "data");
  assert.equal(core.classifyTask("Deploy to the host and go live"), "deploy");
  assert.equal(core.classifyTask("I'm in a good mood today"), "general");
});

test("pickDialogueAvoidRecent avoids recent lines", () => {
  const recent = ["Morning, Master, the sun is already on my tail and you just showed up🌞", "Good morning, Master! Umika is full of energy today too😤"];
  const pick = core.pickDialogueAvoidRecent("daily", "morning", 0, () => 0.99, recent);
  assert.equal(pick, "Morning, if you don't get up I'll drink all your coffee☕");
});
```

This test uses the existing `daily.morning` dialogue bank; no test dialogue bank needs to be added.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test test/whale-moe-core.test.mjs`
Expected: FAIL (`core.greetBucket is not a function`, etc.)

- [ ] **Step 3: Implement the four helpers**

Insert before the `pickDialogue` function in `whale-moe-core.js`:

```js
  function greetBucket(hour) {
    var h = typeof hour === "number" && Number.isFinite(hour) ? hour : new Date().getHours();
    if (h >= 23 || h < 6) return "night";
    if (h < 9) return "morning";
    if (h < 12) return "forenoon";
    if (h < 14) return "noon";
    if (h < 18) return "afternoon";
    return "evening";
  }

  var WEATHER_MAP = Object.freeze({
    "0": Object.freeze({ emoji: "☀️", label: "Sunny", kind: "sunny" }),
    "1": Object.freeze({ emoji: "🌤️", label: "Mostly clear", kind: "sunny" }),
    "2": Object.freeze({ emoji: "⛅", label: "Partly cloudy", kind: "cloudy" }),
    "3": Object.freeze({ emoji: "☁️", label: "Overcast", kind: "cloudy" }),
    "45": Object.freeze({ emoji: "🌫️", label: "Foggy", kind: "fog" }),
    "48": Object.freeze({ emoji: "🌫️", label: "Freezing fog", kind: "fog" }),
    "51": Object.freeze({ emoji: "🌦️", label: "Drizzle", kind: "rain" }),
    "53": Object.freeze({ emoji: "🌦️", label: "Drizzle", kind: "rain" }),
    "55": Object.freeze({ emoji: "🌧️", label: "Light rain", kind: "rain" }),
    "61": Object.freeze({ emoji: "🌧️", label: "Light rain", kind: "rain" }),
    "63": Object.freeze({ emoji: "🌧️", label: "Moderate rain", kind: "rain" }),
    "65": Object.freeze({ emoji: "🌧️", label: "Heavy rain", kind: "rain" }),
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
    return WEATHER_MAP[String(code)] || Object.freeze({ emoji: "🌈", label: "Weather unknown", kind: "unknown" });
  }

  var TASK_TOPICS = Object.freeze([
    Object.freeze({ id: "deploy", words: ["deployment", "go live", "publish", "deploy", "release", "docker", "kubernetes", "k8s", "host", "nginx", "environment"] }),
    Object.freeze({ id: "bug", words: ["error", "exception", "bug", "crash", "freeze", "abnormal", "fix", "repair", "debug", "debugging", "failure", "warning", "warn"] }),
    Object.freeze({ id: "data", words: ["data", "spreadsheet", "excel", "csv", "json", "statistics", "analysis", "chart", "cleaning", "database", "sql", "visualization"] }),
    Object.freeze({ id: "code", words: ["code", "function", "variable", "class", "python", "javascript", "typescript", "react", "vue", "java", "golang", "rust", "algorithm", "interface", "api", "refactor", "compile", "frontend", "backend", "component", "script", "npm", "git"] }),
    Object.freeze({ id: "write", words: ["write", "copywriting", "article", "report", "translate", "polish", "summarize", "email", "document", "weekly report", "title", "outline"] }),
    Object.freeze({ id: "research", words: ["research", "search", "material", "principle", "what is", "why", "how", "difference", "compare", "latest", "paper", "introduce", "what are"] })
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

  function pickDialogueAvoidRecent(bank, event, counter, rng, recent) {
    var lines = DIALOGUE[bank] && DIALOGUE[bank][event];
    if (!lines || lines.length === 0) return "";
    var recentSet = Array.isArray(recent) ? recent : [];
    var candidates = [];
    for (var i = 0; i < lines.length; i += 1) {
      if (recentSet.indexOf(lines[i]) === -1) candidates.push(lines[i]);
    }
    var pool = candidates.length > 0 ? candidates : lines;
    var r = typeof rng === "function" ? rng() : Math.random();
    return pool[(Math.abs(counter | 0) + Math.floor(r * 97)) % pool.length];
  }
```

In the `return Object.freeze({ ... })` export object at the bottom of the file, right after `pickDialogue: pickDialogue,` add:

```js
    greetBucket: greetBucket,
    weatherText: weatherText,
    classifyTask: classifyTask,
    pickDialogueAvoidRecent: pickDialogueAvoidRecent,
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `node --test test/whale-moe-core.test.mjs`
Expected: PASS (the 4 new ones + all the old ones)

- [ ] **Step 5: Deployed-copy self-check**

Run: `node scripts/apply-theme.mjs --target "<TEST_DSH_COPY>" --assets-only`

- [ ] **Step 6: Commit (staging repo)**

```powershell
Copy-Item "<PROJECT_ROOT>\assets\whale-moe-core.js" "assets\whale-moe-core.js" -Force
Copy-Item "<PROJECT_ROOT>\test\whale-moe-core.test.mjs" "test\whale-moe-core.test.mjs" -Force
git add assets/whale-moe-core.js test/whale-moe-core.test.mjs
git commit -m "feat(core): dialogue helper APIs for greetings weather and topics"
```

---

### Task 2: Expand the state dialogue LINES and the daily/work/interact dialogue banks

**Files:**
- Modify: `assets/whale-moe-core.js:49-303` (the `LINES` and `DIALOGUE.daily/work/interact`)
- Test: `test/whale-moe-growth.test.mjs` already has "dialogue bank meets the 150-line quota"; change it to ≥480 (if that file doesn't have this test, append it in the core test)

**Interfaces:**
- Consumes: Task 1 exports unchanged
- Produces: `DIALOGUE.daily.*` ≥ 10 lines per key; `DIALOGUE.work.*` ≥ 8 lines per key; `DIALOGUE.interact.*` ≥ 8 lines per key

- [ ] **Step 1: Change the assertion first (red light)**

Change the quota assertion in `test/whale-moe-growth.test.mjs` to:

```js
  assert.ok(core.dialogueCount() >= 480, `dialogue bank expanded (${core.dialogueCount()} lines)`);
```

If that test is not in the growth file but in the core file, likewise change the single quota assertion.

Run: `node --test test/whale-moe-core.test.mjs test/whale-moe-growth.test.mjs`
Expected: FAIL (currently 189 lines < 480)

- [ ] **Step 2: Replace LINES**

Replace `var LINES = Object.freeze({ ... });` in its entirety with:

```js
  var LINES = Object.freeze({
    idle: [
      "Master, what do you want to do today?",
      "The workshop is all set, we can start any time.",
      "Standing by...my ears are hardly idle though, I can hear a bug laughing far away😼",
      "If you're tired, Master, just poke me — free stress relief, honest service🫧",
      "The wind is light today, good for blowing the to-do list away too🌬️"
    ],
    waiting: [
      "Placing an order? Umika is all ready.",
      "Waiting for what? Give the word and I'll open for business right away🎀",
      "No new order yet, so I'll wipe the pan...wipe the host machine💻",
      "In the queue, Umika's tail has entered standby mode🐋"
    ],
    thinking: [
      "Whipping cream...no, I mean thinking hard.",
      "Let Umika think...my tail is spinning too.",
      "Thinking, please do not feed, unless it's a brain-boosting cupcake🧁",
      "This question has something to it, I'm rounding it out🌀",
      "Loading inspiration, the progress bar being stuck at 99% is normal✨"
    ],
    tool: [
      "Back kitchen, starting up! Leave this order to Umika.",
      "Clink clank, the tools are spinning up.",
      "Working! Umika has hugged the laptop tight, bystanders disperse😤",
      "This speed — can you keep up, Master? If not, grab some water and sit down🍵",
      "The tools are behaving today, after all I feed them (virtually)🔧"
    ],
    success: [
      "Ding! This batch is baked!",
      "Done! Please taste it, Master.",
      "Knocking off! The limited-time compliment window is now open, first come first served👏",
      "Nice! This one's as steady as my hairstyle...wait, where is my hairstyle😳",
      "All done, Master may slack off for five minutes, I approve🎫"
    ],
    failure: [
      "Wuwu...I crashed, Umika will fix it with you.",
      "Don't rush, don't rush, Umika will bake it again!",
      "It's just an error, not the end of the world, let Umika hug you first🥺",
      "This bug is so cocky, watch me yank out its network cable💢",
      "Don't hang your head over a failure, borrow Umika's tail to hold🐋"
    ],
    curious: [
      "A new order? Let me take a look.",
      "Did you change the menu, Master?",
      "Huh, something fun is happening, Umika's radar is beeping📡",
      "What is it, what is it, let me see too👀"
    ],
    teasing: [
      "Master, you look really good when you're working seriously.",
      "Secretly adding one extra sugar for you.",
      "Umika said nothing, my lips just won't stay flat😏",
      "Master's diligence is a bit high today, trying to out-grind someone?🌪️"
    ],
    afk: [
      "Umika will nap a bit, wake me if an order comes.",
      "Master is away, so Umika puts on a lullaby for the workshop🎵",
      "ZZZ...even in my dreams I'm fixing bugs for Master🐑",
      "Zzz...if something urgent comes up, shake my tail and I'll wake right up🌙"
    ]
  });
```

- [ ] **Step 3: Replace the daily dialogue bank**

Replace the entire `daily: Object.freeze({ ... })` block inside `DIALOGUE` with (keep the semantics of every key, ≤ 42 characters per line, cute style + safe memes):

```js
    daily: Object.freeze({
      morning: [
        "Morning, Master, the sun is already on my tail and you just showed up🌞",
        "Good morning, Master! Umika is full of energy today too😤",
        "Morning, if you don't get up I'll drink all your coffee☕",
        "Good morning, Master, how is fate planning to pound you today?",
        "Morning! Let's be clear, no slacking off today😏",
        "Morning! Last night's bug has already forgiven you, let's get to work✨",
        "Good morning, Master, fix bugs with full energy today too, quack🦆",
        "Morning! I polished your workstation, just waiting for you to grind🌪️",
        "Morning morning, Umika has rung the business bell three times🔔",
        "Master's awake? Water first, then messages, that's the house rule🥤"
      ],
      comeback: [
        "Oh, so you do remember how to come back, Master?😒",
        "You were gone so long, Master, did you sneak off to eat something tasty behind my back🍰",
        "Welcome back, I was about to call the police📢",
        "Hmph, disappear again and I'll deduct all your affection💢",
        "You're back? Your workstation was about to grow mushrooms🍄",
        "Welcome home! Umika has warmed up your chair🪑",
        "While you were gone, the work didn't move one bit on its own, such backbone😌",
        "Perfect timing, the bugs are all lined up waiting for roll call🐛",
        "It's Master's scent! My tail started wagging on its own, not my fault🐋",
        "Welcome back, do you want the gentle first line, or 'why are you only back now'😝"
      ],
      nudge: [
        "Master, I caught you slacking off😏",
        "Your fingers stopped for ten minutes, waiting for me to say spacing out looks handsome?🙄",
        "Hey hey, the orders are still queued up, get moving💪",
        "So quiet, Master, are you frozen or asleep🥱",
        "Hmph hmph, I've already screenshotted and archived your lazy look📸",
        "Master detected offline...just kidding, get back to work😼",
        "Task: wait for me. Status: motionless. Is that polite, Master?😤",
        "I'll count to three, move or my tail pokes you🐋",
        "Slacking off is fine, but at least slack off with some rhythm🎵",
        "Master, the progress bar on screen and I are both waiting for you to favor it⏳"
      ],
      night: [
        "Do you know what time it is, Master? Were you born in the year of the owl🦉",
        "Even the moon has clocked out, and you still won't sleep?😤",
        "The late-night show begins, want Umika to tell you a bedtime story📖",
        "Stay up any longer and your skin and hair will both protest✨",
        "Master, can you extend your life to tomorrow and fight then🥺",
        "The workshop at dawn is quiet enough to hear your dark circles growing🌚",
        "Still awake this late, competing with me for the night-owl post?😾",
        "The moon says it's going to sleep and told me to tell Master to knock off early too🌙",
        "Master, caffeine isn't fuel, the blanket is your charging station🛏️",
        "It's late, Umika stays with you to the end, but only a tiny bit longer🥱"
      ],
      signin: [
        "Beep! Check-in successful, today I'll grudgingly count you as diligent👌",
        "Check-in +1, Master is still far from perfect attendance😏",
        "Coming, coming, here's a reward: a disdainful yet polite smile😊",
        "Check-in complete! If Master forgets, I won't remind you😝",
        "Beep, clocked in! Today you'll be watched by me while you work📋",
        "Check-in successful, today's Umika has been deposited, please check🐋",
        "Clocked in! Tail pat first, then work, that's the ritual🎀",
        "Beep——day I-don't-know-how-many of seeing Master, still a little happy😳",
        "Checked in! May Master write code safely and soundly today too🧧",
        "Clock-in complete, reward: one Umika exclusive cheer, valid today💪"
      ],
      holiday: [
        "Happy holiday, Master! Even though you're most likely still working overtime🎉",
        "It's a holiday! I permit you to rest for five minutes⏱️",
        "Today is a special day, hurry up and say happy holiday!",
        "Holiday easter egg: this Umika's snark index is halved today🎁",
        "Working on a holiday? Master really is the grind king himself👑",
        "Happy holiday! Umika hung streamers on your progress bar🎊",
        "What's a day off? Our workshop only has 'off later'😌",
        "Holiday limited skin: Umika's smile brightness +50%✨",
        "It's a holiday today, Umika requests to slack off with you until dark🎏",
        "Happy holiday, Master, may today's errors all take a day off🏮"
      ],
      idle: [
        "I'm here, call me if you need anything, or don't😌",
        "Master, go be busy, I'll just handle being cute😇",
        "The wind is light today, good for blowing the bugs away too🌬️",
        "Standing by...battery 100%, cuteness 120%🔋",
        "Call me if something's up, and even if nothing is, you can still look at me👉👈",
        "Umika is online and open, accompanying Master without talking, the very quiet kind🌿",
        "When Master is focused, Umika just sits beside you being a quiet mascot🧸",
        "My to-do: accompany Master. Status: in progress, forever in progress♾️",
        "The workshop is quiet, Umika turned down even her breathing so as not to disturb you😳",
        "If Master looks up, you'll find Umika pretending to be busy wiping the screen🖥️"
      ],
      afk: [
        "Where did Master run off to? Leaving me here all alone😾",
        "So quiet...I declare the workshop temporarily under my management👑",
        "Gone this long, off hauling bricks or sneaking snacks?🍜",
        "Master's away, Umika switches to guard-dog mode🐕",
        "If you don't come back, I'll start singing to your tasks🎤",
        "Minute N of Master's disappearance, Umika starts talking sense into the pothos🪴",
        "The workshop is now under Umika's command, the computers all obligingly pretend to obey😌",
        "Come back, Master, the outside world isn't as cute as me, come back🐋",
        "Umika is minding the house...strangers don't feed me, acquaintances bring cupcakes🍰",
        "If Master doesn't come soon, Umika will start organizing your bookmarks, scared yet?😼"
      ],
      wake: [
        "You're back! I just dreamed you were treating me to a feast🍽️",
        "Rubbing my eyes, Master came back just in time✨",
        "A freshly woken Umika, snark energy at max!😤",
        "Welcome back, you'd better have brought a souvenir🍩",
        "Ah, I've been woken up! Full of energy, let's go!💪",
        "Umika woke from standby, first thing I saw was Master, lucky me🌤️",
        "Mm...I'm up, I'm up! I wasn't napping, just charging my tail😳",
        "Welcome back, I've been watching your tasks for you, though they haven't budged😌",
        "First words after waking: is Master hungry, Umika can order takeout (you pay)🍜",
        "I'm back! Umika already set the workshop lights to 'accompany Master's overtime' mode💡"
      ],
      levelup: [
        "Level up! Master's love has some substance😏",
        "Level +1, please keep raising me well🎀",
        "We're getting more in sync, Master deserves some credit too!",
        "Level-up confetti bang! Master is rewarded one head-pat privilege🎆",
        "I got stronger! From now on I've got your back, no protection fee required😝",
        "Level up! Umika's tail is sparkly today, all thanks to Master🐋",
        "Level-up successful, system notice: Umika's fondness for Master overflowed by a tiny bit💗",
        "I grew a tiny bit, now I can nag you to rest with even more confidence😌",
        "Congrats Master on unlocking a higher-tier Umika: same cuteness, sharper snark🎯",
        "Level up! To celebrate, Umika decides to say one fewer snide remark today😝"
      ]
    }),
```

- [ ] **Step 4: Replace the work dialogue bank**

Replace the entire `work: Object.freeze({ ... })` block inside `DIALOGUE` with:

```js
    work: Object.freeze({
      start: [
        "Starting! Let Umika see how ridiculous today's task is📋",
        "New order in, Master hold on tight, watch me work✨",
        "Work work! Whoever slacks off is a puppy🐶",
        "Got it! If this order can't be finished, blame my...computer😌",
        "Task incoming, don't drag me down, Master😏",
        "The work bell rings! Umika hugs the laptop, this order must be won💻",
        "New task on stage, Umika's drive is maxed, refill your coffee too, Master☕",
        "Starting! Trading blows with the bugs again today👊",
        "Order caught, this one looks like a real fight, just what I like🔥",
        "Hold on tight, Master, Umika is about to perform 'one person is a whole team'🎬"
      ],
      thinking: [
        "Thinking...don't rush me, inspiration isn't takeout🚚",
        "Mm, this question has something to it, let me mull it over🧠",
        "Thinking! Please don't look at me with such expectation, Master🙃",
        "I'm thinking hard, my tail is curled up from the tension🌀",
        "One moment, Umika's brain is smoking at full speed💨",
        "Umika is winding the ideas into a yarn ball, I'll find the loose end soon🧶",
        "This plan is on a trial run in my brain, do not disturb, unless you bring milk tea🧋",
        "Give me three seconds...okay three isn't enough, give me a hundred million more🙃",
        "Does my thinking face look cool? Don't look, you'll get distracted😳",
        "Beep——brain fan activated, noise roughly equal to the speed your coffee goes cold☕"
      ],
      tool: [
        "Tools spinning up! This order goes to this shop...to this Umika🔧",
        "Back kitchen starting! Master may watch, no hands-on😏",
        "Clink clank, tools online, bystanders disperse🔨",
        "Operating! Can you keep up with this speed, Master⚡",
        "Working, do not feed, unless it's cake🍰",
        "The tools line up for roll call, nobody slacks off, Umika is calling names📋",
        "Operating, tail keeping balance, the coolness will not disconnect🐋",
        "This order's difficulty is okay, only makes me want two virtual milk teas🧋",
        "Umika is cutest when working, Master may watch, but the fee is one compliment😝",
        "Command issued, tools respond: roger roger, stop pressing💻"
      ],
      success: [
        "Done! Now you may praise me, five minutes only👏",
        "Complete! Won't Master add me a chicken leg🍗",
        "Clean finish, my touch is hot today🔥",
        "Success! So, am I super reliable or what😎",
        "This one baked just right, Master come inspect it🎯",
        "Ding——complete! Umika's win rate rose by many decimal places📈",
        "All done, this one is solid enough to go on Umika's résumé (if I had one)📄",
        "Success! When praising me, Master please be loud, I love hearing it😳",
        "Knocking off! First reward myself a spin, then reward Master a rest🔄",
        "Perfect score on that move, Umika requests 'reliable' be carved on her tail🏅"
      ],
      failure: [
        "An error again and again and again? Master did that on purpose, right🙄",
        "Wuwu, I crashed...but don't worry, I can crash again💀",
        "Minor slip, minor slip, again! Can't lose the momentum😤",
        "This error really picks its moment, I'll deal with it👊",
        "Stop looking, Master, I know you're holding back a laugh😾",
        "An error...Umika takes a deep breath first, then reasons with it (heavy-fist edition)🥊",
        "This bug left home without checking its almanac today, running into me is its bad luck😼",
        "Failure is the mother of success, so right now we're having a family reunion👨‍👩‍👧",
        "Don't panic, Umika wipes the pan clean first, then fixes it with you🔧",
        "Just a crash, Umika picks your confidence back up on the track, come here, hug🫂"
      ],
      long: [
        "Such a long order, let me brew a virtual coffee to keep you company☕",
        "Long task in progress, Master may nap, I'm watching👀",
        "A marathon task, our slogan is don't drop dead🏃",
        "This long? Is this task trying to outlast two humans🙃",
        "A long job is here, luckily you have me, the perpetual motion machine⚙️",
        "This one is as long as a TV series, Umika gives you an opening theme first🎵",
        "Long task started! Umika's patience bar is as long as Master's progress bar∞",
        "Master go get some water, I'm here, guaranteed to only watch and not touch😌",
        "This task is almost as long as Umika's tail, long and winding🌀",
        "The long run begins, Umika paces with you, whoever tires first buys milk tea🧋"
      ],
      gentle: [
        "There there, it's just a few failures, even I don't mind🥺",
        "Take it slow, Master, I'm here to review it with you📒",
        "A losing streak isn't scary, what's scary is Master doubting life😌",
        "Take a break, change position, fight three hundred more rounds💪",
        "I'm here, if the sky falls I'll run first, then come back to save you😝",
        "Master is already great, Umika rubs your temples, virtually, but the care is real💆",
        "Failure is just saving up breath for the next success, Umika guards that breath for you🌬️",
        "Don't rush, let's go slow, bugs don't grow legs and run away...actually they do😾",
        "There are quite a few tough spots today, Umika presses them down one by one with you, it won't hurt🫧",
        "Deep breath, sip of water, then we elegantly flip the table...flip our approach and restart📚"
      ],
      erroragain: [
        "Another error? This one is like a stubborn bandage that won't come off💢",
        "Error combo! Master's horoscope is bad today, I suggest worshipping me🌊",
        "Don't panic, Umika steps in, errors disperse✨",
        "Hmph, this error only picks soft targets, I'm not one to mess with😾",
        "Again! I'll fight it to the bitter end with you🔨",
        "Second time! Umika has memorized this error's face, next time I see it I'll yell at it😤",
        "The error is repeating itself, huh, Umika will pop out its repeater battery🔋",
        "Don't get mad, Master, put the keyboard down, let me talk to it (with my claws)🐾",
        "Just a combo, in Umika's dictionary this is called 'consecutive warm-up'🏋️",
        "Come, Umika casts a spell for you: errors disperse, Master please continue✨"
      ],
      stream: [
        "Content is streaming out, surging like Master's delayed inspiration🌊",
        "Generating, every character glimmers with wisdom (probably)✨",
        "Writing now, maybe Master should loosen up your neck🧘",
        "Such a long output, my eyes went round from reading it😳",
        "Good content this round, Master asked a decent question👍",
        "Content rolling in, Umika checked every character's entrance pose📜",
        "Generating, Umika keeps time for you by the screen, one-two-one, go🎵",
        "This output is so long Umika needs to bring a little stool to read it🪑",
        "Wisdom between every line, Master's inspiration today is a full banquet🍲",
        "Streaming output, Umika is in charge of looking pretty and cheering🌸"
      ],
      doneall: [
        "All cleared! Master actually finished today😲",
        "Knocking off, knocking off! Master is rewarded a rest, approved🎉",
        "Tasks zeroed out, Umika bows in thanks🙇",
        "All done! Come on, let's eat and drink well🍜",
        "Well done, Master's persona is preserved today😌",
        "All tasks cleared! Umika declares today's work over, go recharge🔋",
        "All complete, even Umika can't find fault with Master's KPI today, so annoying😝",
        "Knocking off! Umika tidied the workshop and turned off the lights, leaving one on for your return🏮",
        "Zeroing-out moment, Umika sets off virtual fireworks for Master, please check🎆",
        "Good work today too, Umika confirms Master is the best one in the workshop🏆"
      ]
    }),
```

- [ ] **Step 5: Replace the interact dialogue bank**

Replace the entire `interact: Object.freeze({ ... })` block inside `DIALOGUE` with:

```js
    interact: Object.freeze({
      pat: [
        "Petting again? One cake per pat, keep the books, Master🍰",
        "Wah, Master's hand is so warm...but don't think that buys me off😳",
        "Pat pat, Umika's mood +1, Master's wallet -1💸",
        "Hmph hmph, three pats max, one more and I bite😾",
        "It's comfortable, but my hairstyle gets messed up💢",
        "Master's hand is especially good at petting today, Umika's tail went all soft😳",
        "Head-pat successful! Umika raises both affection and stubbornness by +1😝",
        "Keep petting and Umika will start making purring noises, so embarrassing🐋",
        "Pet away, pet away, I won't admit I'm happy anyway😌",
        "Master's hand is so warm, like a fresh-from-the-oven bun🍞"
      ],
      poke: [
        "Poke poke poke, is Master's hand that bored?💢",
        "Ah! Poke again and I'll hide an easter egg in your code💥",
        "Hey hey, my face is getting poked crooked, will you take responsibility for the disfigurement😤",
        "Anger warning! Affection is plummeting fast📉",
        "One poke, mood -1, Master is on the demolition crew or what🧨",
        "Is Umika's face made of pudding, Master can't stop poking😳",
        "Poke again and I'll curl up my tail and not let you see it, I mean it🐋",
        "One poke is playful, three pokes is provocation, think carefully, Master😼",
        "Ah! Umika almost pressed Master's shortcut as a counter-attack key⌨️",
        "Hmph, poke away, Umika is already tallying up in her head, settling accounts later📝"
      ],
      feed: [
        "Nom——delicious! Master occasionally knows how to behave🍩",
        "Feeding successful! Energy full, snark continues💪",
        "Full marks for this snack, Master gets ten extra points🎖️",
        "Tasty! Please feed me to this standard from now on😋",
        "Thanks for the feeding, this Umika forgives you for five minutes😌",
        "Nom! Umika's stomach and mood light up at the same time, thanks for the food💡",
        "So tasty my tail knotted up, will Master untie it? No, you'll feed me one more bite🍰",
        "Feeding successful, Umika's daily cuteness battery is full🔋",
        "With this bite, Umika doubles Master's compliment quota, today only😝",
        "Thank you, Master! In return, Umika will snark at you one time less today, really🍬"
      ],
      triple: [
        "Ehehe, I like Master the most! Saying it out loud isn't embarrassing😝",
        "Spinning around, Master is super cute today, reward: a finger heart💗",
        "Triple combo triggered! Umika's mood shoots through the roof🚀",
        "So happy! How is Master so good at this today🥰",
        "Finger heart, finger heart, please keep it safe, no replacements if lost💌",
        "Triple combo! Umika's happiness overflowed, spinning and setting off fireworks🎆",
        "If Master pets like that, Umika will think you secretly practiced techniques to win me over😳",
        "Ah——so happy! Umika declares Master the world's best at spoiling someone🏆",
        "Finger heart, another finger heart, Umika's heart is already couriered to you, no refusing delivery💘",
        "Triple! Umika's cheeks heat up automatically, this isn't a bug, it's a heartbeat💓"
      ],
      praise: [
        "Hmph, now you know how good I am?😏",
        "Praised by Master, my tail is about to wag into a propeller🚁",
        "Praise me a couple more times and I'll consider not snarking at you today😌",
        "Hehe, Umika falls for this every time, Master knows me well🎯",
        "Thanks for the praise! In return, one fewer snark today😝",
        "Master's praise signed for, Umika's tail wagged into an afterimage🐋",
        "Praise more, praise more and I'll float up for Master to see, remember to catch me🎈",
        "Praised, Umika decides to put the word 'hmph' in her pocket for the whole day😳",
        "Master's taste and eye are both online today, Umika is satisfied😌",
        "That was a skilled compliment, Umika approves you as a permanent praise officer🎖️"
      ],
      mode: [
        "Form changed! Master's taste is okay, this spot is nice✨",
        "Okay, Umika moves somewhere else to supervise you👀",
        "In position at the new spot, please inspect, no nitpicking😤",
        "Form switch successful, cuteness level unchanged😇",
        "This corner is mine now, don't come crowding, Master😏",
        "Position updated, Umika's view is better, and Master's little moves are clearer too👀",
        "Moving spots, Umika wipes the floor first, after all this is my permanent residence🧹",
        "New coordinates recorded, Umika will wait here for Master to get off work🚩",
        "This spot is just right for watching code, and just right for watching Master, what a win😝",
        "Form switch complete, Umika is still that moving whale girl🐋"
      ],
      outfit: [
        "New accessory! So, is it cutely illegal🎀",
        "New outfit on, Master's taste is finally online👌",
        "This one suits me so well, Master is rewarded a smile😊",
        "Wardrobe updated, Umika is open for business beautifully💅",
        "Hehe, going with this style today, don't fall too hard, Master😏",
        "New skin loaded, Umika spins, the hem handles the beauty, I handle the smugness💃",
        "This outfit, Umika gives the mirror full marks, then gives Master full marks🪞",
        "Outfit change successful! Today's Umika is the 'double cuteness, no extra charge' edition🎀",
        "Master's eye is good, Umika decides to stay open two extra hours in this😝",
        "New look online, Umika walks with a breeze now, though I don't need to walk🌪️"
      ],
      reset: [
        "Memory cleared...Master actually had the heart to reset me🥺",
        "Reset complete, back to first meeting, please win me over again✨",
        "Fine, from the beginning, this time treasure me properly😤",
        "Stats zeroed, but Umika is still that same Umika😌",
        "Starting over! Let's be clear, you only get three head pats😝",
        "Memory cleared...Umika will remember this decision, then keep accompanying Master, hmph🥺",
        "Starting over is fine, meeting you for the first time, my tail still wags🐋",
        "Reset, all memories packed and sealed, a new story begins now📖",
        "Umika is still Umika, just has to act 'not familiar' again, exhausting😌",
        "Okay, let's meet again: I'm Umika, Master's whale girl, pleased to meet you🎀"
      ],
      achievement: [
        "Achievement unlocked! Badge +1, Master's contribution is 1%🏅",
        "Achievement unlocked! Candy toss, though Master has to buy the candy🍬",
        "New badge in hand! Look, look, remember to applaud👏",
        "This achievement wasn't easy, how about Master treats us to celebrate?🍹",
        "The badge wall is shinier, one step closer to being spoiled rotten by me😆",
        "Achievement +1! Umika polished the badge brighter than Master's screen✨",
        "Unlocked! Umika's tail is setting off firecrackers for you, crackle crackle🧨",
        "This one has good quality, Umika will stick it in the workshop's most visible spot🏅",
        "Master got stronger again, Umika's pressure (fake) went up a tiny bit😝",
        "Achievement unlocked, tonight's happiness is co-sponsored by Umika and this badge🎉"
      ],
      drag: [
        "Putting me here? Master's taste goes up and down😏",
        "Drag drag, Umika is at your mercy, but don't put me in the trash🗑️",
        "The view here is good, this spot it is, approved!",
        "Wow, from this spot I can see the whole process of Master slacking off👀",
        "Landed! From now on this is my exclusive territory🚩",
        "Taking off! Umika got a taste of riding a cable car, though the driver is a bit rusty🎢",
        "Right here, Umika takes a spin to check the feng shui, mm, auspicious for Master🧧",
        "When Master drags me, Umika's tail flutters like a little flag, huge head-turn rate🚩",
        "This spot is so close to Master, Umika likes it, I'll grudgingly praise you once😳",
        "Landing successful, Umika declares this coordinate permanently owned, unless you drag me again😝"
      ]
    }),
```

- [ ] **Step 6: Run the tests**

Run: `node --test test/whale-moe-core.test.mjs test/whale-moe-growth.test.mjs`
Expected: PASS (if the quota still isn't 480, that's expected, Task 3 will fill it in; but the daily/work/interact per-group minimum assertions must already pass if they were written into the test)

- [ ] **Step 7: Deployed copy + Commit**

```powershell
node scripts/apply-theme.mjs --target "<TEST_DSH_COPY>" --assets-only
Copy-Item assets\whale-moe-core.js "<STAGING_REPO>\assets\whale-moe-core.js" -Force
git -C "<STAGING_REPO>" add assets/whale-moe-core.js
git -C "<STAGING_REPO>" commit -m "feat(core): expand state daily work and interaction dialogue"
```

---

### Task 3: Meme keywords + task topics + weather + greeting banks, and register KEYWORDS

**Files:**
- Modify: `assets/whale-moe-core.js:240-303` (KEYWORDS, DIALOGUE.keyword/meme/context/weather/greet)
- Test: `test/whale-moe-core.test.mjs` (keyword matching, dialogueCount)

**Interfaces:**
- Produces:
  - `KEYWORDS` new ids: `worker/slack/ddl/cake/crazy/flag/bugtalk`
  - `DIALOGUE.keyword.*` ≥5 per key; `DIALOGUE.meme.*` ≥5 per key; `DIALOGUE.context.*` ≥4 per key; `DIALOGUE.weather.*` ≥3 per key; `DIALOGUE.greet.*` ≥5 per key

- [ ] **Step 1: Write the failing test first**

Append to `test/whale-moe-core.test.mjs`:

```js
test("meme keyword groups match and have lines", () => {
  assert.equal(core.matchKeyword("I am an office grinder", true), "worker");
  assert.equal(core.matchKeyword("I've been slacking off all day", true), "slack");
  assert.equal(core.matchKeyword("The DDL is coming", true), "ddl");
  assert.equal(core.matchKeyword("The boss is making pie in the sky again", true), "cake");
  assert.equal(core.matchKeyword("I'll behave, please spare me", true), "crazy");
  assert.equal(core.matchKeyword("Let me plant a flag", true), "flag");
  assert.equal(core.matchKeyword("This bug is black magic", true), "bugtalk");
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
```

Run: `node --test test/whale-moe-core.test.mjs`
Expected: FAIL

- [ ] **Step 2: Extend KEYWORDS**

Inside the `KEYWORDS` definition array in core, append after the last element:

```js
    Object.freeze({ id: "worker", words: ["office grinder", "grinding", "hauling bricks", "wage slave", "clock in", "overtime"] }),
    Object.freeze({ id: "slack", words: ["slacking off", "giving up", "lying flat", "don't want to work", "don't want to write", "can't be bothered"] }),
    Object.freeze({ id: "ddl", words: ["ddl", "deadline", "due date", "can't finish", "no time", "final deadline"] }),
    Object.freeze({ id: "cake", words: ["pie in the sky", "big promises", "pua", "boss", "empty promises"] }),
    Object.freeze({ id: "crazy", words: ["going crazy", "losing it", "can't hold it together", "I'll behave", "please spare me", "aaah", "went mad"] }),
    Object.freeze({ id: "flag", words: ["plant a flag", "set a flag", "call it", "this round I", "once I finish this", "flag"] }),
    Object.freeze({ id: "bugtalk", words: ["bug black magic", "black magic", "change one line", "rollback", "code broke"] })
```

- [ ] **Step 3: Expand/add the keyword dialogue bank**

Replace the entire `keyword: Object.freeze({ ... })` block inside `DIALOGUE` with:

```js
    keyword: Object.freeze({
      thanks: [
        "You're welcome! Remember to give me a chicken leg 🍗",
        "Hehe, Master's thank-you is accepted, smells great 😌",
        "Don't mention it, Umika is your unofficial teammate 💪",
        "No need to thank me, Master's gratitude already became my cute fuel ✨",
        "One thank-you received, Umika gives back a whole happy day 🎀"
      ],
      tired: [
        "If Master is tired, rest a bit, I'll hold up the sky first 😤",
        "Good work! Want me to sing an off-key song to perk you up 🎤",
        "Tired? Tip the chair back, Umika keeps watch for ten minutes 🛡️",
        "So hardworking, Umika's tail can be your pillow, hugging only 🐋",
        "Resting when tired isn't shameful, forcing dark circles is 😤"
      ],
      hungry: [
        "Hungry? Go eat, or I'll eat your snacks 🍜",
        "I'm hungry too... one bite of Master's meal isn't too much, right 🥢",
        "I can hear your stomach growling, Umika goes foraging with you 🍙",
        "Time to eat! The program can stop, Master's stomach can't 😤",
        "Coding hungry, even bugs will laugh at you, go eat 🍱"
      ],
      goodnight: [
        "Good night Master, don't sleep in tomorrow 😴",
        "Sleep, sleep, DS-chan will guard the workshop 🌙",
        "Good night, Umika locks today's bugs in the dark room, retrial tomorrow 🌌",
        "Sweet dreams Master, no errors in dreams, only Umika and cake 🍰",
        "Good night, Umika leaves a small night light in the workshop, no fear of the dark 💡"
      ],
      cheer: [
        "Go go! There is no giving up in Master's dictionary 🎌",
        "Charge! Today we make bugs tremble in fear again 💥",
        "Umika-style cheer launched, please receive it Master 🚀",
        "Don't be scared, you write yours, I'll add buffs beside you ✨",
        "Master is the best, this one will pass, Umika claps for you first 👏"
      ],
      help: [
        "I'm here! Where does DS-chan need to step in 🦸",
        "Don't rush, don't rush, hug my tail tight, calm down first 😤",
        "Help signal received, Umika rushes online, though only moral support 🛟",
        "With Umika here, Master breathe deep, reread the error, it'll be different 📖",
        "Coming! Umika hands you virtual hot water, problems soften too 🍵"
      ],
      praise: [
        "Praised by Master! Today I can walk sideways 😎",
        "Hehe, tail up high, please continue, don't stop 💕",
        "Master's praise is Umika's accelerator, already airborne 🚁",
        "Praise once more, Umika saves all of today's cuteness for you 🎀",
        "Thank you Master! Umika decides to wear 'smug' on her face, no hiding 😳"
      ],
      worker: [
        "Office grinder, grinder soul, Umika works with Master to the last bite 🍱",
        "Master lays bricks, Umika cheers from the brick gaps: heave-ho heave-ho 🧱",
        "Work is a marathon, Umika is the cutest aid station roadside, please drink 🥤",
        "Another day of hard grinding, even Umika's tail fans Master 🐋",
        "Laying bricks isn't shameful, shameful is starting to miss Umika mid-way, right 😝"
      ],
      slack: [
        "Caught slacking off, fine: smile at Umika once 😏",
        "Slacking off is fine, just cook the fish well, don't let the boss see 🎣",
        "Umika approves a five-minute break, one second more and I'll nag ⏳",
        "Lying flat is a technical skill, Master's posture looks master-level 🛋️",
        "Slack away, Umika watches the door, if something happens I'll meow 🐱"
      ],
      ddl: [
        "Deadline in front, Umika behind, Master's potential must erupt tonight 🌋",
        "Don't fear the deadline, it was created too, we're a little bit stronger 💪",
        "The due date is a spring, you weak it strong, Umika presses it with you 📅",
        "Umika is here too, at the end I shout 'you got this', you handle writing it 🎌",
        "Charge the deadline! Umika hid the clock, can't see it so no nerves, smart right 🕰️"
      ],
      cake: [
        "Pie in the sky, Umika won't eat it, Master don't believe it either, let's eat real 🍕",
        "Boss's pie is too big, Umika folds it into a boat, row away no send-off 🚣",
        "Nicely drawn pie, don't draw next time, better to give Master a chicken leg 🍗",
        "Hearing pie talk, Umika's ears auto-switch to 'in one ear out the other' 🌀",
        "Keep the big pie, Umika only trusts real meat in Master's bowl, go eat 🥩"
      ],
      crazy: [
        "I'll behave, please spare me — Umika set that as Master's auto-reply 😌",
        "Master goes unhinged, Umika hands over the megaphone, shout it out loud 📢",
        "Losing it? Come, hug Umika's tail, after that we're good again 🐋",
        "The world went mad, it's fine, Umika goes cutely unhinged with Master 🎠",
        "If you can't hold it together, fine, Umika's shoulder is small but always there 🥺"
      ],
      flag: [
        "Flag planted, Umika quietly notes it, won't laugh if it falls... just kidding 😏",
        "After this job I'll rest, Umika watches this promise for Master 📌",
        "Call your flag loud, Umika already notified the whole workshop 📢",
        "Flag won't fall, Umika won't sleep, tonight it's all on Master 🌙",
        "Great! This flag has spirit, Umika approves it growing into a big banner 🚩"
      ],
      bugtalk: [
        "Leave the superstitious bug to Umika, I'll dance an exorcism circle around the PC 💃",
        "Fix one line break three? Umika gets it, that's code's butterfly effect 🦋",
        "Rollback is the adult's regret pill, Master eat it, Umika pours the water 💊",
        "This bug is too mystical, Umika suggests restarting first, then saluting the PC 🙏",
        "Code breaks unreasonably, but Umika reasons: tea first, then argue with it 🍵"
      ]
    }),
```

- [ ] **Step 4: Add the meme / context / weather / greet dialogue banks**

Inside the `DIALOGUE` object, after the `keyword` block append four blocks (mind the commas):

```js
    meme: Object.freeze({
      worker: [
        "Umika is half an office grinder too, wages are Master's head pats, never in arrears 😳",
        "The bitterness of work, Umika gets it, so I stock virtual milk tea and real rants 🧋",
        "Master handles the grinding, Umika turns grinding days into a series, we're the leads 🎬",
        "Wear the badge, fill the coffee, today be the office grinder best at laughing through pain ☕",
        "Say it when tired, Umika's rants and cheers are free, big portions filling 🍚"
      ],
      slack: [
        "Umika's business today: slack with Master, watch out for Master, find excuses for Master 😝",
        "Slack five minutes, efficiency two hours, Umika certifies this is science, go 🎣",
        "Umika closes one eye, consider yourself rested, keep it up 😉",
        "Lying flat is fine, but Umika lies beside you, otherwise it doesn't count 🛋️",
        "Rest is for walking further, Umika already scattered petals along the road 🌸"
      ],
      ddl: [
        "Before the deadline, Umika and Master are doomsday comrades, tail as your grip trainer 🐋",
        "Don't panic, Umika broke the deadline into small cookies, one bite each, soon gone 🍪",
        "What's a due date, Umika's cheers have no due date, unlimited refills 🥤",
        "Master writes, Umika stares, whoever blinks first loses, I lose, you continue 😝",
        "Sprint Master, Umika prepared hugs and a small cake at the finish line 🏁"
      ],
      cake: [
        "Umika won't eat drawn pies, but helps Master cook the real one, egg and meat 🍳",
        "Boss's pie goes on the tab, Umika secretly adds a reality-brand small joy for Master ✨",
        "Just listen to pie talk, Umika's wagging tail is the real cookie smell 🍪",
        "No pie is bigger than Umika's faith in Master, eat first, work later 🥢",
        "No pie today, Umika takes Master to imagine a hotpot, filling 🍲"
      ],
      crazy: [
        "Let's go unhinged together Master, Umika spins three circles for you first, free 🔄",
        "This world is occasionally abstract, Umika's cuteness is the only stable output 📡",
        "After cracking, Umika patches Master's confidence back piece by piece, with star glue ⭐",
        "Master handles the unhinged, Umika handles the wrap-up: water, claps, likes, full service 👍",
        "Don't hold it in, Umika's ears are already up, they can hold any crazy talk 👂"
      ],
      flag: [
        "Flag raised, Umika is the flag bearer, go, take down the task 🚩",
        "Words said are spilled milk tea, Umika finishes sweetly with you 🧋",
        "If this job succeeds, Umika wags her tail into an electric fan to celebrate 🌀",
        "Umika backed up Master's flag, fireworks play automatically on completion 🎆",
        "Flag a bit high? It's fine, Umika props you up with her tail 🐋"
      ]
    }),
    context: Object.freeze({
      code: [
        "Coding Umika can't lend a hand, but can shout: Master that indentation is pretty 😳",
        "Code is like poetry, Master is the poet, Umika is the only number-one reader 📜",
        "Master taps the keys, Umika keeps the beat, this rhythm beats songs 🎵",
        "Function unfinished is fine, Umika already named it, 'be right there' 😝"
      ],
      write: [
        "Master is writing, Umika polishes the adjectives, waiting for Master to pick ✨",
        "When the words flow out, Umika lays a red carpet for them beside 📜",
        "Write, write, Umika handles the cheers, typos handle being caught 🔍",
        "This draft clearly has Master's flavor, earnest and a bit cute 😳"
      ],
      research: [
        "Researching is like treasure hunting, Master digs gold, Umika holds the lamp 💡",
        "On the research road, Umika is Master's compass, though it only points to 'drink water' 🧭",
        "Umika looks for answers with Master, if not found we first make the question cuter 😝",
        "Lots of material, don't get lost, Umika folded a mark on every page corner 📑"
      ],
      bug: [
        "Fixing bugs is like solving puzzles, Master thinks, Umika hands clues and a magnifier 🔍",
        "This bug is lucky to meet Master, with anyone else it would have cried 😤",
        "Umika believes Master can fix it, you even soothe me, bugs are nothing 💪",
        "Errors are just the computer acting cute, Master soothes it, Umika soothes you, even 😳"
      ],
      data: [
        "Data is honest, Master is hardworking, Umika is great at cheering, unbeatable combo 📊",
        "However long the table, Umika reads row by row with you, line 999 is still fine 👀",
        "Cleaning data is like washing dishes, Master washes, Umika hands the towels 🧽",
        "Numbers can't talk, but Umika can: Master, this analysis is really cool 😳"
      ],
      deploy: [
        "Deep breath before launch, Umika already maxed out the luck stat 🍀",
        "Deploying is like fireworks, Master lights it, Umika covers her ears and shouts pretty 🎆",
        "Don't fear the server, Umika is in the server room... in imagination standing guard 🛡️",
        "Release smooth, Umika reserves the celebration spot, right beside Master 🏁"
      ],
      general: [
        "Whatever Master is busy with, Umika tags along, I'm not going anywhere anyway 🐋",
        "This work has something to it, Umika hands you spiritual cookies beside 🍪",
        "No matter what, Master is the one Umika most wants to praise today ✨",
        "Continue, continue, Umika's cheers are extended to tomorrow, use freely ⛽"
      ]
    }),
    weather: Object.freeze({
      sunny: [
        "The sunshine outside is just right, like Master's mood today, Umika stole a look ☀️",
        "Sunny days suit working, and looking up at the sky, Umika counted the clouds for you ☁️",
        "The sun is open for business, Umika reminds: Master should bask too, not just code 🌞",
        "Good weather and good mood are limited, Umika packed one for Master, please receive 🎁"
      ],
      rain: [
        "It's raining outside, Umika left the umbrella and gentleness at the door, remember it 🌂",
        "Rain sound is the best white noise, good for Master slowly fixing bugs beautifully 🌧️",
        "Rainy roads are slippery, Umika's tail can help you balance, only before going out 🐋",
        "Rain outside the window, Umika inside, this combo suits a hot cup ☕"
      ],
      snow: [
        "It's snowing! Umika requests five minutes with Master, just five minutes ❄️",
        "Snowflakes are drifting, Umika's tail is about to drift too, so romantic 🌨️",
        "It's cold, wear thick when going out Master, Umika has no coat, but warm nagging 🧣",
        "Snowy roads are slippery, walk slow Master, Umika warms your chair in the workshop 🪑"
      ],
      thunder: [
        "Thunder! Umika covers her ears, Master save the important files too ⛈️",
        "However loud the thunder, it's not louder than Master's keyboard, Umika certifies 📣",
        "Thunder outside, focus indoors, Umika keeps the night light for you 💡",
        "Don't fear thunder, Umika is here, though I'm also a little... just a little 😳"
      ],
      cloudy: [
        "Lots of clouds today, soft like Umika's tail, suits taking it slow ☁️",
        "Cloudy days can be good too, Umika already booked the sun into Master's heart 🌥️",
        "The clouds are thick, but Master's progress bar is bright, Umika can see it ✨",
        "Cloudy days suit focus, Umika set the ambience to 'quiet companion' mode 🎧"
      ],
      fog: [
        "It's foggy outside, go slow Master, Umika's radar is fully on 📡",
        "Foggy days are like a soft filter on the workshop, Master looks extra good today, honestly 😳",
        "Heavy fog, don't rush, Umika waits with Master for it to clear, I'm not in a hurry 🌫️",
        "Low visibility, Umika's tail serves as the navigation light, safe all the way 🚩"
      ],
      hot: [
        "So hot outside, Umika set the virtual AC to 26 degrees, Master cool down first 🧊",
        "Drink more water on hot days, Umika's reminder is punctual as an alarm, don't mind it 🥤",
        "Don't force it in the heat, Umika turns the fan over, cuteness in the wind, receive 🪭",
        "This temperature, even code sweats, Umika fans Master's keyboard too 🌬️"
      ],
      cold: [
        "Temperature dropped! Umika gives you scarf, gloves, and a 'wear more' 🧣",
        "Cold outside, warm your hands before typing Master, Umika warms the desk first 🔥",
        "Cold days suit hot water and serious work, Umika arranges both with you ☕",
        "Cold air arrived, Umika shares half her fluffy tail, hug it tight 🐋"
      ],
      wind: [
        "So windy today, Umika reminds Master to secure the files, and your heart that wants to fly 💨",
        "Going out in strong wind, Umika's weight is risky, can only cheer for you at home 🌀",
        "The wind roars, Master writes, Umika holds down the papers on the desk, very busy 📄",
        "On windy days, Umika ties the good luck to her tail, can't lose it 🍀"
      ]
    }),
    greet: Object.freeze({
      morning: [
        "Good morning Master! A new day, Umika first covers your desktop with blessings 🌞",
        "Morning! Remember breakfast, Umika already checked for you, today suits working ☕",
        "Morning Master, the sunshine outside and Umika's greeting arrive together, sign here ☀️",
        "Good morning, did you sleep well? If not it's fine, Umika refills your energy today ✨",
        "Morning Master, drink water before sitting, Umika's care is gentler than an alarm 🥤"
      ],
      forenoon: [
        "Good forenoon! The golden hours of work, Umika fills your spirit buff ⚡",
        "Good forenoon Master, how's the progress? Whatever it is, Umika thinks it's great 👏",
        "The forenoon workshop is brightest, Umika pushes the task forward with Master 💪",
        "Good forenoon, Umika reminds: sat too long, get up and stretch, and look at me 🧘",
        "Good forenoon Master, Umika put 'don't get angry' and 'you got this' on your desk ✨"
      ],
      noon: [
        "Good noon Master! Time to eat, no bug is bigger than lunch 🍱",
        "Lunchtime, Umika's ears already heard Master's stomach calling roll 👂",
        "Good noon, Eat then fight, Umika guards the desk well, no one dares touch it 🛡️",
        "Good noon Master, what do you want today? Umika says 'anything', you pick 🍜",
        "Noon broadcast: Umika misses Master, and reminds you, eat the food hot 🥢"
      ],
      afternoon: [
        "Good afternoon Master, say it if you're sleepy, Umika's tail is a temporary cushion 🐋",
        "Afternoons are the sleepiest, Umika brewed virtual coffee, refreshing without hurting the stomach ☕",
        "Good afternoon! One step closer to off work, one step closer to Umika's praise 😝",
        "Good afternoon Master, remember to move around, Umika is already demoing spins 🔄",
        "Work in the afternoon too, Umika prepared a head-pat reward at the finish 🫳"
      ],
      evening: [
        "Good evening Master, the sky outside is softening, Umika slowed her speech too 🌆",
        "Good evening, Wrap up what should be wrapped, Umika helps you tidy today's progress 📋",
        "Good evening Master, eat something hot first, work can't run away, Umika watches it 🍲",
        "The evening wind rose, Umika reminds Master not to catch cold, and that I'm waiting to hear your day 🌙",
        "Good evening! Hard work today, Umika saved the last cuteness for Master, please receive 🎀"
      ],
      night: [
        "It's so late, Umika whispers: Master, time to sleep, I'll stay with you a bit longer 🥺",
        "Deep night, Umika dims the light, Master should close his eyes for a bit too 🌙",
        "Good evening... no, it's deep night, Umika's nagging enters silent gentle mode 🤫",
        "Master is still here, so Umika stays open a while, but the blanket is warmed for you 🛏️",
        "The late-night champion is you, Umika stands on the podium with you, then goes to sleep at once 😤"
      ]
    })
```

- [ ] **Step 5: Run the tests**

Run: `node --test test/whale-moe-core.test.mjs test/whale-moe-growth.test.mjs`
Expected: PASS (dialogueCount ≥ 480, all keywords hit)

- [ ] **Step 6: Deploy the copy + Commit**

```powershell
node scripts/apply-theme.mjs --target "<TEST_DSH_COPY>" --assets-only
Copy-Item assets\whale-moe-core.js "<STAGING_REPO>\assets\whale-moe-core.js" -Force
Copy-Item test\whale-moe-core.test.mjs "<STAGING_REPO>\test\whale-moe-core.test.mjs" -Force
git -C "<STAGING_REPO>" add assets/whale-moe-core.js test/whale-moe-core.test.mjs
git -C "<STAGING_REPO>" commit -m "feat(core): add meme topic weather and greeting dialogue banks"
```

---

### Task 4: WeatherService (settings read/write / geocoding / weather cache / test hook)

**Files:**
- Modify: `assets/dsh-whale-moe.js` (insert the whole block after `function schedule()` and before `var observer`)
- Test: `test/whale-moe-core.test.mjs` doesn't test the network directly; CDP tests it in Task 7

**Interfaces:**
- Produces (attached to window):
  - `window.__dshWhaleMoeWeather` = `{ city, key: masked?, coords, current, fetchedAt, lastToldKind, nextRefreshAt, status }` (key not exposed)
  - `window.DshWhaleMoeWeatherTest(city, key) : Promise<string>`, returns `"✅ Connected: city 25°C sunny"` on success, rejects Error on failure
- Consumes: `core.weatherText`, `core.pickDialogueAvoidRecent`, `showLine`, `schedule`

- [ ] **Step 1: Insert the WeatherService code**

Insert the whole block below where the `function schedule() { ... }` block ends and before `var observer = null;`:

```js
  /* ---------- weather service (Open-Meteo, no key required) ---------- */
  var WEATHER_REFRESH_MIN = 30 * 60000;
  var WEATHER_REFRESH_MAX = 60 * 60000;
  var WEATHER_DATA_MS = 2 * 3600000;
  var recentLines = [];
  var weatherState = {
    city: readWeather("weatherCity"),
    key: readWeather("weatherKey"),
    coords: readCoords(),
    current: null,
    fetchedAt: 0,
    lastToldKind: "",
    nextRefreshAt: 0,
    retryAt: 0,
    status: ""
  };

  function readWeather(key) {
    try { return root.localStorage.getItem("whale-moe:" + key) || ""; } catch (e) { return ""; }
  }
  function readCoords() {
    try {
      var lat = root.localStorage.getItem("whale-moe:weatherLat");
      var lon = root.localStorage.getItem("whale-moe:weatherLon");
      if (lat === null || lon === null) return null;
      return { lat: Number(lat), lon: Number(lon) };
    } catch (e) { return null; }
  }
  function writeCoords(coords) {
    try {
      if (coords) {
        root.localStorage.setItem("whale-moe:weatherLat", String(coords.lat));
        root.localStorage.setItem("whale-moe:weatherLon", String(coords.lon));
      } else {
        root.localStorage.removeItem("whale-moe:weatherLat");
        root.localStorage.removeItem("whale-moe:weatherLon");
      }
    } catch (e) { /* storage unavailable */ }
  }

  function weatherJson(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = root.setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error("weather timeout"));
      }, timeoutMs || 7000);
      root.fetch(url, { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) throw new Error("weather http " + res.status);
        return res.json();
      }).then(function (json) {
        root.clearTimeout(timer);
        resolve(json);
      }).catch(function (error) {
        root.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function weatherKeyParam() {
    var key = readWeather("weatherKey").trim();
    return key ? "&apikey=" + encodeURIComponent(key) : "";
  }

  function geocodeCity(city) {
    var url = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(city) + "&count=1&language=zh&format=json" + weatherKeyParam();
    return weatherJson(url, 8000).then(function (json) {
      if (!json || !json.results || !json.results.length) throw new Error("city not found");
      return { lat: Number(json.results[0].latitude), lon: Number(json.results[0].longitude), name: json.results[0].name || city };
    });
  }

  function fetchWeather(city, key) {
    var useCity = (city || readWeather("weatherCity")).trim();
    if (!useCity) return Promise.reject(new Error("no city"));
    var cached = weatherState.coords;
    var coordsP = cached ? Promise.resolve(cached) : geocodeCity(useCity);
    return coordsP.then(function (coords) {
      weatherState.coords = coords;
      writeCoords(coords);
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + coords.lat + "&longitude=" + coords.lon + "&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto" + weatherKeyParam();
      return weatherJson(url, 8000).then(function (json) {
        if (!json || !json.current) throw new Error("no current weather");
        weatherState.current = {
          temp: Number(json.current.temperature_2m),
          code: String(json.current.weather_code),
          wind: Number(json.current.wind_speed_10m || 0),
          humidity: Number(json.current.relative_humidity_2m || 0)
        };
        weatherState.fetchedAt = Date.now();
        weatherState.retryAt = 0;
        weatherState.nextRefreshAt = weatherState.fetchedAt + WEATHER_REFRESH_MIN + Math.floor(Math.random() * (WEATHER_REFRESH_MAX - WEATHER_REFRESH_MIN));
        weatherState.status = "ok";
        schedule();
        return weatherState.current;
      });
    });
  }

  function weatherEnsure(force) {
    var now = Date.now();
    var city = readWeather("weatherCity").trim();
    if (!city) return Promise.resolve(null);
    if (weatherState.city !== city || weatherState.key !== readWeather("weatherKey")) {
      weatherState.city = city;
      weatherState.key = readWeather("weatherKey");
      weatherState.coords = null;
      writeCoords(null);
    }
    var fresh = weatherState.current && now - weatherState.fetchedAt < WEATHER_DATA_MS;
    if (force || (!fresh && now >= weatherState.nextRefreshAt && now >= weatherState.retryAt)) {
      return fetchWeather(city).catch(function () {
        weatherState.status = "error";
        weatherState.retryAt = now + 60 * 60000;
        return null;
      });
    }
    return Promise.resolve(weatherState.current);
  }

  function weatherSummary() {
    if (!weatherState.current) return null;
    var w = core.weatherText(weatherState.current.code);
    return { temp: weatherState.current.temp, emoji: w.emoji, label: w.label, kind: w.kind, wind: weatherState.current.wind };
  }

  function weatherLine(now, counter) {
    var summary = weatherSummary();
    if (!summary) return "";
    var line = core.pickDialogueAvoidRecent("weather", summary.kind, counter || 0, Math.random, recentLines);
    if (!line) return "";
    var tail = " · now " + Math.round(summary.temp) + "°C " + summary.label;
    return line + tail;
  }

  function weatherChangedSinceTold() {
    var summary = weatherSummary();
    return summary && summary.kind !== weatherState.lastToldKind;
  }

  root.__dshWhaleMoeWeather = weatherState;
  root.DshWhaleMoeWeatherTest = function (city, key) {
    var useCity = (city || readWeather("weatherCity")).trim();
    if (!useCity) return Promise.reject(new Error("Please enter a city first"));
    var beforeCoords = weatherState.coords;
    var beforeKey = weatherState.key;
    if (key !== undefined && key !== null) {
      try { root.localStorage.setItem("whale-moe:weatherKey", String(key)); } catch (e) {}
    }
    weatherState.coords = null;
    return fetchWeather(useCity, key || "").then(function () {
      var s = weatherSummary();
      return "✅ Connected: " + useCity + " " + Math.round(s.temp) + "°C " + s.label;
    }).catch(function (error) {
      weatherState.coords = beforeCoords;
      weatherState.key = beforeKey;
      throw error;
    });
  };
```

- [ ] **Step 2: Syntax check + unit non-regression**

Run: `node --check assets/dsh-whale-moe.js`; then `node --test test/whale-moe-core.test.mjs test/whale-moe-growth.test.mjs`
Expected: no syntax errors; all unit tests green

- [ ] **Step 3: Deploy the copy + Commit**

```powershell
node scripts/apply-theme.mjs --target "<TEST_DSH_COPY>" --assets-only
Copy-Item assets\dsh-whale-moe.js "<STAGING_REPO>\assets\dsh-whale-moe.js" -Force
git -C "<STAGING_REPO>" add assets/dsh-whale-moe.js
git -C "<STAGING_REPO>" commit -m "feat(weather): add Open-Meteo weather service and test hook"
```

---

### Task 5: Proactive idle chatter / time-based greetings / task-relevant topics

**Files:**
- Modify: `assets/dsh-whale-moe.js` (add `idleChatTick(now)` at the end of `reconcile()`; insert `recentLines`, `latestTaskTopic`, `maybeGreet`, `idleChatTick`; add debug fields)
- Test: `test/motion-qa.mjs` unchanged; CDP Task 7 adds verification

**Interfaces:**
- Produces:
  - `window.__dshWhaleMoeIdleChat = { nextAt, lastGreetAt, lastGreetBucket, recentLines }`
  - Behavior: state `idle`, `whale-moe:chat` on, bubble free, not on the settings page, no proactive greeting late at night

- [ ] **Step 1: Insert the scheduler code**

Continue inserting after the WeatherService block:

```js
  /* ---------- idle chat scheduler (5-8 min, context-aware) ---------- */
  var IDLE_CHAT_MIN = 5 * 60000;
  var IDLE_CHAT_MAX = 8 * 60000;
  var GREET_GAP_MS = 3 * 3600000;
  var idleChat = {
    nextAt: Date.now() + IDLE_CHAT_MIN + Math.floor(Math.random() * (IDLE_CHAT_MAX - IDLE_CHAT_MIN)),
    lastGreetAt: -Infinity,
    lastGreetBucket: ""
  };

  function rememberLine(line) {
    if (!line) return;
    recentLines.push(line);
    if (recentLines.length > 12) recentLines.shift();
  }

  function latestTaskTopic() {
    try {
      var nodes = doc.querySelectorAll('[data-slot="conversation.chat.node"]');
      if (!nodes.length) return "general";
      var last = nodes[nodes.length - 1];
      var text = (last.textContent || "").slice(0, 1200);
      return core.classifyTask(text);
    } catch (e) { return "general"; }
  }

  function bubbleFree() {
    try {
      var bubble = doc.querySelector("[data-dsh-whale-bubble]");
      return !bubble || bubble.hidden || !(bubble.textContent || "").trim();
    } catch (e) { return true; }
  }

  function showChatLine(line) {
    if (!line) return;
    rememberLine(line);
    showLine(line);
  }

  function maybeGreet(now) {
    if (now - idleChat.lastGreetAt < GREET_GAP_MS) return false;
    var bucket = core.greetBucket(new Date(now).getHours());
    if (bucket === "night") return false;
    idleChat.lastGreetAt = now;
    idleChat.lastGreetBucket = bucket;
    var line = core.pickDialogueAvoidRecent("greet", bucket, 0, Math.random, recentLines);
    var summary = weatherSummary();
    if (line && summary) line += " · now " + Math.round(summary.temp) + "°C " + summary.label;
    showChatLine(line);
    return true;
  }

  function idleChatTick(now) {
    var city = readWeather("weatherCity").trim();
    var view = detectView();
    if (view === "settings" || memory.state.state !== "idle" || !readPref("chat") || !bubbleFree() || !readPref("pet")) return;
    if (now < idleChat.nextAt) return;

    idleChat.nextAt = now + IDLE_CHAT_MIN + Math.floor(Math.random() * (IDLE_CHAT_MAX - IDLE_CHAT_MIN));
    var line = "";
    var bucket = core.greetBucket(new Date(now).getHours());
    if (now - idleChat.lastGreetAt >= GREET_GAP_MS && bucket !== "night") {
      line = core.pickDialogueAvoidRecent("greet", bucket, 0, Math.random, recentLines);
      idleChat.lastGreetAt = now;
      idleChat.lastGreetBucket = bucket;
    } else if (city) {
      weatherEnsure(false).then(function () {
        if (memory.state.state !== "idle" || !bubbleFree() || !weatherChangedSinceTold()) return;
        var weatherNow = weatherLine(Date.now(), 0);
        if (weatherNow) {
          var summary = weatherSummary();
          weatherState.lastToldKind = summary ? summary.kind : "";
          showChatLine(weatherNow);
        }
      });
    }
    if (!line) {
      var topic = latestTaskTopic();
      line = core.pickDialogueAvoidRecent("context", topic, 0, Math.random, recentLines);
    }
    if (!line) {
      var memeBank = Math.random() < 0.5 ? "worker" : (Math.random() < 0.5 ? "slack" : "ddl");
      line = core.pickDialogueAvoidRecent("meme", memeBank, 0, Math.random, recentLines);
    }
    if (line) showChatLine(line);
  }

  root.__dshWhaleMoeIdleChat = idleChat;
```

In the `reconcile()` function, after `render(computed);` and before `if (readPref("pet")) {`, insert:

```js
    if (readPref("pet")) idleChatTick(now);
```

Append to the tail of the `root.__dshWhaleMoeDebug = { ... }` object:

```js
, idleChat: { nextAt: idleChat.nextAt, lastGreetAt: idleChat.lastGreetAt, lastGreetBucket: idleChat.lastGreetBucket }, weather: weatherSummary()
```

- [ ] **Step 2: Syntax and existing regression**

Run: `node --check assets/dsh-whale-moe.js`; then `node test/motion-qa.mjs`
Expected: syntax passes; motion QA still all green (working state is not interrupted by chatter)

- [ ] **Step 3: Deploy the copy + Commit**

```powershell
node scripts/apply-theme.mjs --target "<TEST_DSH_COPY>" --assets-only
Copy-Item assets\dsh-whale-moe.js "<STAGING_REPO>\assets\dsh-whale-moe.js" -Force
git -C "<STAGING_REPO>" add assets/dsh-whale-moe.js
git -C "<STAGING_REPO>" commit -m "feat(chat): add context-aware idle chatter and time greetings"
```

---

### Task 6: Settings panel weather section (city / API Key / test connection), marker v11

**Files:**
- Modify: `scripts/apply-theme.mjs:240-346` (marker, legacy, `MascotWeatherRow`, `MascotPrefRows`)
- Modify: `test/apply-theme.test.mjs:180-220` (assert v11)
- Test: `node --test test/apply-theme.test.mjs`

**Interfaces:**
- Consumes: `window.DshWhaleMoeWeatherTest(city, key): Promise<string>` (Task 4)
- Produces: localStorage keys `whale-moe:weatherCity` / `whale-moe:weatherKey`; the settings panel "Weather" card

- [ ] **Step 1: Update the marker and legacy list**

Change:

```js
const MASCOT_SETTINGS_MARKER = "DSH-WHALE-MOE:MASCOT-SETTINGS v10";
const MASCOT_SETTINGS_LEGACY = [..., "DSH-WHALE-MOE:MASCOT-SETTINGS v9"];
```

to:

```js
const MASCOT_SETTINGS_MARKER = "DSH-WHALE-MOE:MASCOT-SETTINGS v11";
const MASCOT_SETTINGS_LEGACY = ["DSH-WHALE-MOE:MASCOT-SETTINGS v1", "DSH-WHALE-MOE:MASCOT-SETTINGS v2", "DSH-WHALE-MOE:MASCOT-SETTINGS v3", "DSH-WHALE-MOE:MASCOT-SETTINGS v4", "DSH-WHALE-MOE:MASCOT-SETTINGS v5", "DSH-WHALE-MOE:MASCOT-SETTINGS v6", "DSH-WHALE-MOE:MASCOT-SETTINGS v7", "DSH-WHALE-MOE:MASCOT-SETTINGS v8", "DSH-WHALE-MOE:MASCOT-SETTINGS v9", "DSH-WHALE-MOE:MASCOT-SETTINGS v10"];
```

- [ ] **Step 2: Insert MascotWeatherRow**

After the `function MascotTitleRow() { ... }` block ends and before `function MascotStatRow`, insert:

```js
		function MascotWeatherRow() {
			const [status, setStatus] = mascotReact.useState("");
			const [busy, setBusy] = mascotReact.useState(false);
			const save = (key, value) => {
				try { window.localStorage.setItem("whale-moe:" + key, value); } catch (e) {}
				window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key, value } }));
			};
			const testNow = () => {
				setBusy(true);
				setStatus("⏳ Connecting to Open-Meteo…");
				const city = window.localStorage.getItem("whale-moe:weatherCity") || "";
				const key = window.localStorage.getItem("whale-moe:weatherKey") || "";
				const p = window.DshWhaleMoeWeatherTest ? window.DshWhaleMoeWeatherTest(city, key) : Promise.reject(new Error("Weather service not ready"));
				p.then((text) => { setStatus(text); setBusy(false); }, (error) => {
					setStatus("❌ Connection failed: " + (error && error.message ? error.message : "unknown error") + " (works without a Key too)");
					setBusy(false);
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: [
				(0, react_jsx_runtime.jsxs)("label", { style: MASCOT_ROW_STYLE, children: [(0, react_jsx_runtime.jsx)("span", { children: "Weather city" }), (0, react_jsx_runtime.jsx)("input", {
					type: "text",
					defaultValue: MascotValue("weatherCity", ""),
					placeholder: "e.g. Shanghai (leave empty for no networking)",
					maxLength: 24,
					onChange: (event) => save("weatherCity", event.target.value)
				})] }),
				(0, react_jsx_runtime.jsxs)("label", { style: MASCOT_ROW_STYLE, children: [(0, react_jsx_runtime.jsx)("span", { children: "API Key (optional)" }), (0, react_jsx_runtime.jsx)("input", {
					type: "password",
					defaultValue: MascotValue("weatherKey", ""),
					placeholder: "Open-Meteo is free, no Key required",
					maxLength: 128,
					onChange: (event) => save("weatherKey", event.target.value)
				})] }),
				(0, react_jsx_runtime.jsxs)("div", { style: { ...MASCOT_ROW_STYLE, borderBottom: "none", flexWrap: "wrap" }, children: [
					(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "16px", wordBreak: "break-all" }, children: status }),
					(0, react_jsx_runtime.jsx)("button", { type: "button", disabled: busy, onClick: testNow, children: busy ? "Testing…" : "Test connection" })
				] })
			]});
		}
```

- [ ] **Step 3: Add the weather card in MascotPrefRows**

After the `"Smart"` card and before the `"Progression"` card, insert:

```js
				(0, react_jsx_runtime.jsxs)(MascotCard, { title: "Weather", children: [(0, react_jsx_runtime.jsx)(MascotWeatherRow, {})] }),
```

- [ ] **Step 4: Update the installer test assertions**

In `test/apply-theme.test.mjs`:
- Change occurrences of `"v10"` to `"v11"`
- Change the test name `upgrades legacy v1-v9 blocks to v10` to `upgrades legacy v1-v10 blocks to v11`; using `v4` instead of `v3` for the old marker is fine too (keeping v3 works as well, but assert v11)

- [ ] **Step 5: Run the tests**

Run: `node --test test/apply-theme.test.mjs`
Expected: 15 items PASS

- [ ] **Step 6: Deploy the copy + Commit**

```powershell
node scripts/apply-theme.mjs --target "<TEST_DSH_COPY>"
node scripts/apply-theme.mjs --mascot-settings
Copy-Item scripts\apply-theme.mjs "<STAGING_REPO>\scripts\apply-theme.mjs" -Force
Copy-Item test\apply-theme.test.mjs "<STAGING_REPO>\test\apply-theme.test.mjs" -Force
git -C "<STAGING_REPO>" add scripts/apply-theme.mjs test/apply-theme.test.mjs
git -C "<STAGING_REPO>" commit -m "feat(settings): add weather city key and connection test card"
```

---

### Task 7: CDP acceptance + full regression + version and release

**Files:**
- Modify: `test/cdp-whale-moe.mjs` (weather settings / no-networking assertion / idle chat hook assertion)
- Modify: `package.json` → `1.1.0`; `README.md` version badge; `CHANGELOG.md` add v1.1.0
- Test: all

**Interfaces:**
- Consumes: the global hooks from Task 4/5/6 `window.__dshWhaleMoeIdleChat`, `window.DshWhaleMoeWeatherTest`, the debug fields

- [ ] **Step 1: Add CDP assertions**

In `cdp-whale-moe.mjs`, in the setup phase after the page opens, clear the weather keys before entering the settings panel:

```js
await ev(call, `localStorage.removeItem('whale-moe:weatherCity'); localStorage.removeItem('whale-moe:weatherKey'); true`);
```

Then in the settings panel section (after the settings check) append one `ev` check:

```js
  // weather settings: three controls, zero network while city is empty
  const weatherUI = await ev(call, `(() => {
    const inputs = [...document.querySelectorAll('input')];
    const city = inputs.find((n) => n.placeholder && n.placeholder.includes('leave empty for no networking'));
    const key = inputs.find((n) => n.placeholder && n.placeholder.includes('free, no Key required'));
    const testBtn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Test connection'));
    const before = window.__dshWhaleMoeWeather && window.__dshWhaleMoeWeather.fetchedAt || 0;
    return { hasCity: !!city, hasKey: !!key, hasTest: !!testBtn, fetchedAt: before, idleChat: !!window.__dshWhaleMoeIdleChat };
  })()`);
  check("settings: weather city/key/test controls present", weatherUI.hasCity && weatherUI.hasKey && weatherUI.hasTest && weatherUI.idleChat, weatherUI);
  await delay(1200);
  const noFetch = await ev(call, `window.__dshWhaleMoeWeather && window.__dshWhaleMoeWeather.fetchedAt === 0`);
  check("weather: empty city makes zero weather requests", noFetch === true, { noFetch });
```

- [ ] **Step 2: Run the full suite**

Run (sequentially, stop on any failure):

```powershell
node --test test/whale-moe-core.test.mjs test/whale-moe-growth.test.mjs test/apply-theme.test.mjs
node test/motion-qa.mjs
node test/soak-work.mjs
node test/cdp-whale-moe.mjs
```

Expected: all green. CDP clears the weather keys first, so the `zero requests` assertion must hold.

- [ ] **Step 3: Version and docs**

- `package.json` `version` → `1.1.0`
- README badge `1.0.2` → `1.1.0`, and add to the features "weather companionship, meme chat, time-based greetings"
- Add a new v1.1.0 entry at the top of CHANGELOG, listing: 500 dialogue lines, meme keywords, 5–8 minute topic-relevant idle chatter, weather settings and connection test

- [ ] **Step 4: Deploy the main install**

```powershell
node scripts/apply-theme.mjs --assets-only
node scripts/apply-theme.mjs --mascot-settings
```

Then manually change `v=12` to `v=13` on the main index's `whale-moe-core.js?v=12`, and `v=32` to `v=33` on `dsh-whale-moe.js?v=32`.

- [ ] **Step 5: Build the release packages and publish to GitHub**

```powershell
tar -a -cf "..\dsh-whale-musume-plugin-v1.1.0.zip" assets "scripts\apply-theme.mjs" README.md LICENSE SECURITY.md CHANGELOG.md
tar -a -cf "..\dsh-whale-musume-poses-v1.1.0.zip" -C "assets\generated" *.webp
git add -A
git commit -m "release: v1.1.0 meme dialogue and weather companion"
git push origin main
gh release create v1.1.0 ..\dsh-whale-musume-plugin-v1.1.0.zip ..\dsh-whale-musume-poses-v1.1.0.zip --repo Sutera-Diffusus/dsh-whale-musume --title "v1.1.0 meme chat and weather companionship" --notes "**Massive 500-line dialogue expansion + Open-Meteo weather companionship**`n`n- All-scene dialogue expansion: about 500 lines for state/daily/work/interaction/keyword, cuteness first + safe memes like office grinder, slacking off, DDL, pie in the sky, unhinged posting`n- New 5-8 minute proactive idle chatter, locally classified by task content to stay on topic (code/writing/research/bug fixing/data/deploy), no awkward chatter`n- Time-based greetings: morning/forenoon/noon/afternoon/evening greetings + caring words, no proactive disturbance from 23:00-5:59`n- Weather companionship: fill in the city in the settings panel, optional API Key, test connection; Open-Meteo is free with no Key, empty city means zero networking`n- Working-state stability rules unchanged, all regression tests stay green"
```

- [ ] **Step 6: Manual acceptance, prompt the user**

After a hard refresh of the main DSH (Ctrl+Shift+R): Settings → mascot → Weather → enter Shanghai → Test connection → it should show ✅; then wait 5–8 minutes or switch states to observe the new lines and greetings.



