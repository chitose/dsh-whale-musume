/**
 * dsh-whale-musume client plugin: injects the Whale-chan desktop mascot into the DSH Web UI (pure DOM injection).
 *
 * Zero footprint: no built-in package files are modified, no product DOM is read, no external requests.
 * Assets load through the host route /api/dsh-whale-musume/assets?f=<path>.
 * Injection order: styles → state machine (whale-moe-core) → presenter (dsh-whale-moe);
 * the presenter's asset root and calibration path are rewritten to the host route.
 *
 * Since v1.4.2 the "Mascot" settings section is also registered into the DSH settings panel
 * (settings.section, id=mascot) — same source as the panel injected by
 * scripts/apply-theme.mjs --mascot-settings v27 (reads whale-moe:* localStorage and
 * listens for whale-moe-prefs-change), so bundle installs ship the settings panel too.
 */
window.__ModuleLoader__.load({
  id: "dsh-whale-musume",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require("react");
    var jsxRuntime = require("react/jsx-runtime");
    var jsx = jsxRuntime.jsx;
    var jsxs = jsxRuntime.jsxs;

    const BASE = "/api/dsh-whale-musume/assets?f=";
    const BOOT_FLAG = "__dshWhaleMusumeBooted";
    const MIMO_TTS_EVENT = "dsh-whale-musume:interaction-line";

    function injectStyle(text) {
      const el = document.createElement("style");
      el.setAttribute("data-dsh-whale-musume", "css");
      el.textContent = text;
      document.head.appendChild(el);
    }

    function injectScript(text) {
      const el = document.createElement("script");
      el.setAttribute("data-dsh-whale-musume", "js");
      el.textContent = text;
      document.body.appendChild(el);
    }

    async function boot() {
      if (window[BOOT_FLAG]) return;
      window[BOOT_FLAG] = true;
      try {
        const css = await (await fetch(BASE + "dsh-whale-moe.css")).text();
        injectStyle(css);
        const core = await (await fetch(BASE + "whale-moe-core.js")).text();
        injectScript(core);
        const raw = await (await fetch(BASE + "dsh-whale-moe.js")).text();
        const presenter = raw
          .replace('var ASSET_ROOT = "/assets/generated/";', 'var ASSET_ROOT = "' + BASE + 'generated/";')
          .replace('var ANIM_ROOT = "/assets/anim/";', 'var ANIM_ROOT = "' + BASE + 'anim/";')
          .replace('var VOICE_ROOT = "/assets/voice/ja/";', 'var VOICE_ROOT = "' + BASE + 'voice/ja/";')
          .replace('fetch("/assets/peek-calibration.json")', 'fetch("' + BASE + 'peek-calibration.json")');
        injectScript(presenter);
      } catch (error) {
        console.warn("[dsh-whale-musume] asset load failed:", error);
      }
    }

    /* ---- settings panel "Mascot" section (same source as apply-theme.mjs --mascot-settings v27) ---- */

    const MASCOT_NS = "settings.mascot";
    const MASCOT_ROW_STYLE = { alignItems: "center", borderBottom: "1px solid var(--dsw-alias-border-l2)", display: "flex", gap: "12px", justifyContent: "space-between", padding: "10px 0" };
    const MASCOT_CARD_STYLE = { background: "var(--dsw-alias-bg-module-platform, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "2px", marginTop: "10px", padding: "6px 14px", width: "100%" };
    function MascotCard({ title, children }) {
      return jsxs("div", { style: MASCOT_CARD_STYLE, children: [jsx("div", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", fontWeight: "600", padding: "6px 0 2px" }, children: title }), children] });
    }
    function MascotValue(key, fallback) {
      try { const v = window.localStorage.getItem("whale-moe:" + key); return v === null ? fallback : v; } catch (e) { return fallback; }
    }
    function MascotPrefRow({ label, prefKey, compact }) {
      /* Features that read extra data or use external capabilities are off by default. */
      const defaultOff = prefKey === "mimoTts" || prefKey === "keywords" || prefKey === "balance" ||
        prefKey === "balanceDetail" || prefKey === "a11y";
      const [isOn, setIsOn] = React.useState(MascotValue(prefKey, defaultOff ? "0" : "1") !== "0");
      return jsxs("div", { style: compact ? { alignItems: "center", display: "flex", gap: "8px", justifyContent: "space-between", minWidth: 0, padding: "6px 0" } : MASCOT_ROW_STYLE, children: [jsx("span", { style: compact ? { fontSize: "12px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined, children: label }), jsx("button", {
        type: "button", role: "switch",
        "aria-checked": isOn,
        style: { alignItems: "center", background: isOn ? "var(--dsw-static-accent, #4da3ff)" : "var(--dsw-alias-border-l3, #c9cdd6)", border: "none", borderRadius: "999px", cursor: "pointer", display: "flex", height: "24px", justifyContent: isOn ? "flex-end" : "flex-start", padding: "3px", transition: "background 160ms ease", width: "44px" },
        onClick: (event) => {
          event.stopPropagation();
          event.preventDefault();
          const next = !isOn;
          try { window.localStorage.setItem("whale-moe:" + prefKey, next ? "1" : "0"); } catch (e) {}
          setIsOn(next);
          window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: prefKey, value: next ? "1" : "0" } }));
        },
        children: jsx("span", { style: { background: "#fff", borderRadius: "50%", boxShadow: "0 1px 3px rgb(0 0 0 / 25%)", height: "18px", width: "18px" } })
      }) ] });
    }
    function MascotTitleRow({ compact }) {
      return jsxs("label", { style: compact ? { alignItems: "center", display: "flex", gap: "12px", justifyContent: "space-between", padding: "2px 0" } : MASCOT_ROW_STYLE, children: [jsx("span", { children: "What should I call you" }), jsx("input", {
        type: "text",
        defaultValue: MascotValue("title", "Master"),
        maxLength: 8,
        placeholder: "Master",
        style: { flex: 1, maxWidth: "150px", minWidth: 0 },
        onChange: (event) => {
          try { window.localStorage.setItem("whale-moe:title", event.target.value); } catch (e) {}
          window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "title", value: event.target.value } }));
        }
      }) ] });
    }
    /* Custom self-name: pairs with "What should I call you"; empty falls back to the default "Whale-chan". */
    function MascotSelfNameRow({ compact }) {
      return jsxs("label", { style: compact ? { alignItems: "center", display: "flex", gap: "12px", justifyContent: "space-between", padding: "2px 0" } : MASCOT_ROW_STYLE, children: [jsx("span", { children: "Her name for herself" }), jsx("input", {
        type: "text",
        defaultValue: MascotValue("selfName", "Whale-chan"),
        maxLength: 12,
        placeholder: "Whale-chan",
        style: { flex: 1, maxWidth: "150px", minWidth: 0 },
        onChange: (event) => {
          try { window.localStorage.setItem("whale-moe:selfName", event.target.value); } catch (e) {}
          window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "selfName", value: event.target.value } }));
        }
      }) ] });
    }
    function MascotWeatherRow() {
      const [status, setStatus] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const save = (key, value) => {
        try { window.localStorage.setItem("whale-moe:" + key, value); } catch (e) {}
        window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key, value } }));
      };
      const testNow = () => {
        setBusy(true);
        setStatus("⏳ Connecting to Open-Meteo...");
        const city = window.localStorage.getItem("whale-moe:weatherCity") || "";
        const key = window.localStorage.getItem("whale-moe:weatherKey") || "";
        const p = window.DshWhaleMoeWeatherTest ? window.DshWhaleMoeWeatherTest(city, key) : Promise.reject(new Error("Weather service not ready"));
        p.then((text) => { setStatus(text); setBusy(false); }, (error) => {
          setStatus("❌ Connection failed:" + (error && error.message ? error.message : "Unknown error") + "(works without a key too)");
          setBusy(false);
        });
      };
      return jsxs("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: [
        jsxs("label", { style: MASCOT_ROW_STYLE, children: [jsx("span", { children: "Weather city" }), jsx("input", {
          type: "text",
          defaultValue: MascotValue("weatherCity", ""),
          placeholder: "e.g. Shanghai (leave empty to stay offline)",
          maxLength: 24,
          onChange: (event) => save("weatherCity", event.target.value)
        })] }),
        jsxs("label", { style: MASCOT_ROW_STYLE, children: [jsx("span", { children: "API Key (optional)" }), jsx("input", {
          type: "password",
          defaultValue: MascotValue("weatherKey", ""),
          placeholder: "Open-Meteo is free, no key needed",
          maxLength: 128,
          onChange: (event) => save("weatherKey", event.target.value)
        })] }),
        jsxs("div", { style: { ...MASCOT_ROW_STYLE, borderBottom: "none", flexWrap: "wrap" }, children: [
          jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "16px", wordBreak: "break-all" }, children: status }),
          jsx("button", { type: "button", disabled: busy, onClick: testNow, children: busy ? "Testing..." : "Test connection" })
        ] })
      ]});
    }
    function MascotStatRow({ label, value, suffix }) {
      return jsxs("label", { style: MASCOT_ROW_STYLE, children: [jsx("span", { children: label }), jsx("span", { children: String(value) + (suffix || "") })] });
    }
    const MASCOT_ACHIEVEMENTS = [
      ["first-pat", "🫳", "First Headpat", "Pat Whale-chan's head for the first time"], ["ten-pats", "🖐️", "Ten Pats", "Reach 10 headpats in total"], ["hundred-pats", "💯", "Hundred Pats", "Reach 100 headpats in total"],
      ["first-feed", "🍰", "First Snack", "Feed her a snack for the first time"], ["first-triple", "🎉", "Triple Tap", "Trigger the heart-hands easter egg"], ["thanks", "💬", "Sweet Talker", "Say thank you to Whale-chan"],
      ["lv5", "⭐", "Level Five", "Reach bond level 5"], ["lv10", "👑", "Level Ten", "Reach bond level 10"], ["signin3", "📅", "Regular", "Check in 3 days in a row"],
      ["signin7", "🗓️", "Week Promise", "Check in 7 days in a row"], ["night-owl", "🌙", "Late-night Company", "Interact once between 22:00 and 6:00"], ["comeback", "👋", "Welcome Back", "Come back after being away 2+ hours"],
      ["day1", "💞", "One Day Bond", "Whale-chan has kept you company for 1 day"], ["day7", "💎", "One Week Together", "Whale-chan has kept you company for 7 days"], ["day30", "🏛️", "Thirty-day Pact", "Whale-chan has kept you company for 30 days"],
      ["first-tool", "🛠️", "Clock In", "See a tool run for the first time"], ["tools-10", "🔧", "Ten Tools", "See tools run 10 times"], ["tools-50", "🏭", "Fifty Tools", "See tools run 50 times"], ["tools-100", "🛰️", "Hundred Tools", "See tools run 100 times"],
      ["first-code", "💻", "First Code", "See a code block/terminal for the first time"], ["code-20", "📟", "Code Maniac", "See 20 code blocks/terminals in total"], ["first-success", "✅", "Off to a Flyer", "Complete a task for the first time"],
      ["success-10", "🏆", "Ten Wins", "Complete 10 tasks in total"], ["first-failure", "🩹", "First Crash", "Hit a task error for the first time"], ["fail-10", "🚑", "Ten Crashes", "Hit 10 task errors in total"],
      ["messages-100", "💌", "Hundred Messages", "See 100 conversation messages"], ["messages-500", "📚", "Five Hundred Messages", "See 500 conversation messages"], ["keyword-master", "🔍", "Keyword Master", "Trigger 10 keyword interactions"],
      ["night-work", "🦉", "Late Shift", "Tools still running between 22:00 and 6:00"], ["balance-low", "🪙", "Low Balance", "Trigger a low-balance reminder once"],
      ["game-first", "🫧", "First Game", "Finish one round of the mini game for the first time"], ["game-win", "👑", "Bubble King", "Score 300 in a single bubble-pop round"], ["game-combo10", "🔥", "Combo Master", "Reach a 10-hit combo in one round"], ["game-highscore", "🏆", "New Record", "Break your personal high score once"],
      ["quest-first", "🎯", "First Quest", "Complete your first daily quest"], ["quest-all", "🎟️", "Perfect Day", "Claim all 3 daily quests in one day"], ["week-signin7", "🏆", "Weekly Perfection", "Fill all 7 slots on this week's check-in board"],
      ["bond-action", "🌟", "New Move Unlocked", "Reach bond level 3"], ["bond-badge", "🎖️", "First Title", "Reach bond level 5"]
    ];
    function MascotAchievementWall({ ids }) {
      const unlocked = ids.length;
      return jsxs("div", { style: { alignItems: "flex-start", display: "flex", flexDirection: "column", gap: "8px", padding: "4px 0 10px", width: "100%" }, children: [
        jsxs("div", { style: { display: "flex", justifyContent: "space-between", width: "100%" }, children: [jsx("span", { children: "Achievement wall" }), jsx("span", { children: unlocked + " / " + MASCOT_ACHIEVEMENTS.length })] }),
        jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: "6px", width: "100%" }, children: MASCOT_ACHIEVEMENTS.map(([id, icon, name]) => {
          const on = ids.indexOf(id) !== -1;
          return jsxs("div", { title: name, style: { alignItems: "center", background: on ? "var(--dsw-alias-interactive-bg-hover)" : "transparent", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "2px", opacity: on ? 1 : 0.38, padding: "6px 4px", textAlign: "center" }, children: [jsx("span", { style: { fontSize: "16px" }, children: icon }), jsx("span", { style: { fontSize: "11px", lineHeight: "14px" }, children: name })] });
        }) })
      ]});
    }
    function MascotBar({ label, value, text, max }) {
      const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) / (Number(max) || 100) * 100)));
      return jsxs("div", { style: { alignItems: "center", display: "flex", gap: "10px", padding: "2px 0" }, children: [
        jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", minWidth: "58px" }, children: label }),
        jsx("div", { style: { background: "var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "4px", flex: 1, height: "6px", overflow: "hidden" }, children: jsx("div", { style: { background: "var(--dsw-static-accent, #4da3ff)", borderRadius: "4px", height: "100%", transition: "width 160ms ease", width: pct + "%" } }) }),
        jsx("span", { style: { fontSize: "12px", fontWeight: "600", minWidth: "44px", textAlign: "right" }, children: text })
      ] });
    }
    function MascotOverviewCard() {
      const [tick, setTick] = React.useState(0);
      React.useEffect(() => {
        const refresh = () => setTick((v) => v + 1);
        window.addEventListener("whale-moe-prefs-change", refresh);
        window.addEventListener("storage", refresh);
        return () => { window.removeEventListener("whale-moe-prefs-change", refresh); window.removeEventListener("storage", refresh); };
      }, []);
      const mood = MascotValue("mood", "70");
      const affinity = MascotValue("affinity", "0");
      const level = MascotValue("level", "1");
      const streak = MascotValue("signinStreak", "0");
      const since = Number(MascotValue("companionSince", ""));
      const days = since > 0 ? Math.max(0, Math.floor((Date.now() - since) / 86400000)) : 0;
      const chips = [["😊", String(mood), "Mood"], ["💗", String(affinity), "Affection"], ["⭐", "Lv." + level, "Level"], ["📅", streak + " days", "Check-in"], ["⏳", days + " days", "Company"]];
      return jsxs("div", { style: { background: "var(--dsw-alias-bg-module-platform, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "12px", margin: "10px auto 0", padding: "8px 14px", width: "95%" }, children: [
        jsx("div", { style: { display: "flex", gap: "6px", width: "100%" }, children: chips.map(([icon, value, label]) => jsxs("div", { style: { alignItems: "center", background: "var(--dsw-alias-interactive-bg-hover, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "8px", display: "flex", flex: 1, flexDirection: "column", gap: "1px", minWidth: 0, overflow: "hidden", padding: "4px 2px" }, children: [
          jsxs("span", { style: { fontSize: "11px", fontWeight: "600", lineHeight: "15px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [icon, " ", value] }),
          jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "10px", lineHeight: "13px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: label })
        ] })) }),
        jsx("div", { style: { background: "var(--dsw-alias-border-l2)", height: "1px", margin: "8px 0 2px" } }),
        jsx(MascotTitleRow, { compact: true }),
        jsx(MascotSelfNameRow, { compact: true })
      ] });
    }
    function hasMimoTts(ctx) {
      return typeof ctx?.get?.("xiaomiMimoTts")?.play === "function";
    }
    function MascotSwitchGrid({ ctx }) {
      /* The two client bundles do not have a fixed start order. Retry briefly only while the settings panel mounts:
         plugin installation itself requires a Web restart, so there is no point continuously probing for an uninstalled plugin. */
      const [mimoTtsAvailable, setMimoTtsAvailable] = React.useState(() => hasMimoTts(ctx));
      React.useEffect(() => {
        if (hasMimoTts(ctx)) {
          setMimoTtsAvailable(true);
          return undefined;
        }
        let attempts = 0;
        const timer = window.setInterval(() => {
          const available = hasMimoTts(ctx);
          attempts += 1;
          if (available || attempts >= 10) {
            setMimoTtsAvailable(available);
            window.clearInterval(timer);
          }
        }, 250);
        return () => window.clearInterval(timer);
      }, [ctx]);
      const rows = [
        { label: "Whale-chan", prefKey: "pet" },
        { label: "Dialogue bubbles", prefKey: "chat" },
        { label: "Japanese voice", prefKey: "voiceJa" },
        { label: "Particles", prefKey: "particles" },
        ...(mimoTtsAvailable ? [{ label: "Dialogue playback (MiMoTTs)", prefKey: "mimoTts" }] : []),
        { label: "Mini games", prefKey: "game" },
        { label: "Keyword awareness", prefKey: "keywords" },
        { label: "Slack-off reminder", prefKey: "idle-nudge" },
        { label: "Late-night mode", prefKey: "night" },
        { label: "Weather effects", prefKey: "weatherFx" },
        { label: "Tool poses", prefKey: "toolPose" },
        { label: "Drag inertia", prefKey: "dragPhysics" },
        { label: "Proactive care", prefKey: "proactive" },
        { label: "Accessibility", prefKey: "a11y" },
        { label: "Balance alerts", prefKey: "balance" },
        { label: "Show balance digits", prefKey: "balanceDetail" }
      ];
      return jsx("div", { style: { display: "grid", gap: "2px 14px", gridTemplateColumns: "1fr 1fr", padding: "2px 0 8px", width: "100%" }, children: rows.map((r) => jsx(MascotPrefRow, { key: r.prefKey, label: r.label, prefKey: r.prefKey, compact: true })) });
    }
    /* Balance display: the mascot side polls the local proxy and writes window.__dshWhaleMoeBalance.
       When "Balance alerts" is off or the proxy is unavailable, show an explanation instead of erroring. */
    function MascotBalanceRow() {
      const [text, setText] = React.useState("—");
      const [tier, setTier] = React.useState("");
      React.useEffect(() => {
        let timer = 0;
        const read = () => {
          const on = MascotValue("balance", "0") !== "0";
          const detailed = MascotValue("balanceDetail", "0") !== "0";
          if (!on) { setText("Disabled"); setTier(""); return; }
          const b = window.__dshWhaleMoeBalance;
          if (!b || b.ok !== true) { setText("Not available yet"); setTier("Balance proxy may not be running"); return; }
          const fmt = window.DshWhaleMoeCore && window.DshWhaleMoeCore.formatBalance;
          setText(fmt ? fmt(b.amount, b.currency, detailed) : String(b.amount));
          const labels = { empty: "Empty", critical: "Critical", low: "Low", ok: "Normal", good: "Comfortable", rich: "Very comfortable" };
          setTier(detailed ? (labels[b.tier] || "") : "");
        };
        read();
        timer = window.setInterval(read, 5000);
        const onChange = () => read();
        window.addEventListener("whale-moe-prefs-change", onChange);
        return () => {
          window.clearInterval(timer);
          window.removeEventListener("whale-moe-prefs-change", onChange);
        };
      }, []);
      return jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "2px", padding: "4px 0 6px", width: "100%" }, children: [
        jsxs("label", { style: MASCOT_ROW_STYLE, children: [
          jsx("span", { children: "Account balance" }),
          jsxs("span", { style: { display: "flex", alignItems: "baseline", gap: "6px", justifyContent: "flex-end" }, children: [
            jsx("span", { style: { fontSize: "14px", fontWeight: "600" }, children: text }),
            tier ? jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px" }, children: tier }) : null
          ] })
        ] }),
        jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", lineHeight: "15px", padding: "0 0 4px" }, children: "Data comes from the local balance proxy (127.0.0.1:3020), read locally only and never reported. Turn off 'Show balance digits' to show only the tier." })
      ] });
    }
    function formatWhen(at) {
      const then = Number(at);
      if (!isFinite(then) || then <= 0) return "";
      const diff = Date.now() - then;
      const day = 86400000;
      if (diff < 60000) return "just now";
      if (diff < 3600000) return Math.floor(diff / 60000) + " min ago";
      if (diff < day) return Math.floor(diff / 3600000) + " h ago";
      if (diff < day * 30) return Math.floor(diff / day) + " days ago";
      const d = new Date(then);
      return (d.getMonth() + 1) + "/" + d.getDate();
    }
    /* Growth journal: reads whale-moe:journal and renders recent entries in reverse order. */
    function MascotJournalRow() {
      const [entries, setEntries] = React.useState([]);
      React.useEffect(() => {
        const read = () => {
          try {
            const raw = window.localStorage.getItem("whale-moe:journal");
            const list = raw ? JSON.parse(raw) : [];
            setEntries(Array.isArray(list) ? list.slice().reverse() : []);
          } catch (e) { setEntries([]); }
        };
        read();
        const onChange = () => read();
        window.addEventListener("whale-moe-prefs-change", onChange);
        window.addEventListener("storage", onChange);
        return () => {
          window.removeEventListener("whale-moe-prefs-change", onChange);
          window.removeEventListener("storage", onChange);
        };
      }, []);
      if (!entries.length) {
        return jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "16px", padding: "4px 0" }, children: "No entries yet. Stay with her a while and memories will grow here." });
      }
      const icons = { bond: "💞", achievement: "🏅", first: "🎉" };
      return jsx("div", { style: { display: "flex", flexDirection: "column", gap: "7px", padding: "4px 0 6px", width: "100%" }, children: entries.slice(0, 12).map((e, i) => jsxs("div", { key: i, style: { display: "flex", gap: "8px", alignItems: "flex-start" }, children: [
        jsx("span", { style: { fontSize: "12px", lineHeight: "18px", flex: "none" }, children: icons[e.kind] || "•" }),
        jsxs("div", { style: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }, children: [
          jsx("span", { style: { fontSize: "12px", lineHeight: "16px" }, children: String(e.text || "") }),
          jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "10px", lineHeight: "14px" }, children: formatWhen(e.at) })
        ] })
      ] })) });
    }
    function MascotDailyQuests() {
      const [tick, setTick] = React.useState(0);
      React.useEffect(() => {
        const refresh = () => setTick((v) => v + 1);
        window.addEventListener("whale-moe-prefs-change", refresh);
        window.addEventListener("storage", refresh);
        return () => { window.removeEventListener("whale-moe-prefs-change", refresh); window.removeEventListener("storage", refresh); };
      }, []);
      const pool = (window.DshWhaleMoeCore && window.DshWhaleMoeCore.QUEST_POOL) || [];
      const defOf = (id) => pool.find((q) => q.id === id) || { id, desc: id, target: 1, reward: { affinity: 0, mood: 0 } };
      let quests = null;
      try { const raw = window.localStorage.getItem("whale-moe:quests"); quests = raw ? JSON.parse(raw) : null; } catch (e) { quests = null; }
      const today = (() => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); })();
      const slots = quests && quests.date === today && Array.isArray(quests.slots) ? quests.slots : [];
      const claim = (id) => {
        try { if (window.__dshWhaleMoeClaimQuest) window.__dshWhaleMoeClaimQuest(id); } catch (e) {}
        setTick((v) => v + 1);
      };
      if (!slots.length) return jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", padding: "4px 0" }, children: "Loading today's quests, refreshing shortly" });
      return jsx("div", { style: { display: "flex", flexDirection: "column", padding: "2px 0 4px", width: "100%" }, children: slots.map((slot, index) => {
        const def = defOf(slot.id);
        const done = slot.progress >= def.target;
        const last = index === slots.length - 1;
        return jsxs("div", { style: { alignItems: "center", borderBottom: last ? "none" : "1px solid var(--dsw-alias-border-l2)", display: "flex", gap: "10px", minHeight: "44px" }, children: [
          jsx("span", { style: { flex: 1, fontSize: "13px", lineHeight: "18px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: def.desc }),
          jsxs("div", { style: { alignItems: "center", display: "flex", gap: "6px", width: "104px" }, children: [
            jsx("div", { style: { background: "var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "4px", flex: 1, height: "7px", overflow: "hidden" }, children: jsx("div", { style: { background: done ? "var(--dsw-static-accent, #4da3ff)" : "var(--dsw-alias-label-secondary, #888)", borderRadius: "4px", height: "100%", transition: "width 160ms ease", width: Math.min(100, Math.round(slot.progress / def.target * 100)) + "%" } }) }),
            jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", lineHeight: "14px", whiteSpace: "nowrap" }, children: String(Math.min(slot.progress, def.target)) + "/" + String(def.target) })
          ] }),
          slot.claimed
            ? jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", textAlign: "right", width: "58px" }, children: "✅ Claimed" })
            : jsx("button", { type: "button", disabled: !done, onClick: () => claim(slot.id), style: { background: done ? "var(--dsw-static-accent, #4da3ff)" : "transparent", border: "1px solid var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "8px", color: done ? "#fff" : "var(--dsw-alias-label-secondary)", cursor: done ? "pointer" : "default", fontSize: "12px", height: "26px", padding: "0 10px", width: "58px" }, children: "Claim" })
        ] });
      }) });
    }
    function MascotWeekSignin() {
      const [tick, setTick] = React.useState(0);
      React.useEffect(() => {
        const refresh = () => setTick((v) => v + 1);
        window.addEventListener("whale-moe-prefs-change", refresh);
        return () => window.removeEventListener("whale-moe-prefs-change", refresh);
      }, []);
      let week = null;
      try { const raw = window.localStorage.getItem("whale-moe:weekSignin"); week = raw ? JSON.parse(raw) : null; } catch (e) { week = null; }
      const days = week && Array.isArray(week.days) ? week.days.length : 0;
      const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "10px", padding: "4px 0 10px", width: "100%" }, children: [
        jsx("div", { style: { display: "flex", gap: "4px" }, children: Array.from({ length: 7 }, (_, i) => jsxs("div", { style: { alignItems: "center", display: "flex", flex: 1, flexDirection: "column", gap: "4px" }, children: [
          jsx("span", { style: { alignItems: "center", background: i < days ? "var(--dsw-static-accent, #4da3ff)" : "var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "50%", color: i < days ? "#fff" : "transparent", display: "flex", fontSize: "12px", height: "26px", justifyContent: "center", width: "26px" }, children: "✓" }),
          jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", lineHeight: "14px" }, children: labels[i] })
        ] })) }),
        jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "16px" }, children: "Checked in this week: " + days + " / 7 days · milestones at 1/3/7 days" })
      ] });
    }
    function MascotBadgeRow() {
      const [tick, setTick] = React.useState(0);
      React.useEffect(() => {
        const refresh = () => setTick((v) => v + 1);
        window.addEventListener("whale-moe-prefs-change", refresh);
        return () => window.removeEventListener("whale-moe-prefs-change", refresh);
      }, []);
      const level = Number(MascotValue("level", "1")) || 1;
      const badges = (window.DshWhaleMoeCore && window.DshWhaleMoeCore.BOND && window.DshWhaleMoeCore.BOND.badges) || [];
      const unlocked = badges.filter((b) => level >= b.minLevel);
      const current = MascotValue("badge", "");
      if (!unlocked.length) return jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", padding: "4px 0" }, children: "Locked (reach affection Lv5 to unlock the first title)" });
      return jsxs("label", { style: { ...MASCOT_ROW_STYLE, borderBottom: "none" }, children: [jsx("span", { children: "Title" }), jsx("select", {
        value: current,
        onChange: (event) => { const value = event.target.value; try { if (window.__dshWhaleMoeApplyBadge) window.__dshWhaleMoeApplyBadge(value); else window.localStorage.setItem("whale-moe:badge", value); } catch (e) {} setTick((v) => v + 1); },
        children: [jsx("option", { value: "", children: "(no title)" })].concat(unlocked.map((b) => jsx("option", { value: b.id, children: b.name })))
      }) ] });
    }
    function MascotAccordion({ title, icon, summary, defaultOpen, children }) {
      const [open, setOpen] = React.useState(!!defaultOpen);
      const left = jsxs("span", { style: { alignItems: "center", display: "flex", gap: "8px", minWidth: 0 }, children: [
        jsx("span", { style: { fontSize: "14px" }, children: icon || "" }),
        jsxs("span", { style: { alignItems: "flex-start", display: "flex", flexDirection: "column", minWidth: 0 }, children: [
          jsx("span", { style: { fontSize: "13px", fontWeight: "600" }, children: title }),
          summary ? jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", fontWeight: "400" }, children: summary }) : null
        ] })
      ] });
      const right = jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px" }, children: open ? "▾" : "▸" });
      return jsxs("div", { style: { background: "var(--dsw-alias-bg-module-platform, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "12px", marginTop: "10px", overflow: "hidden", width: "100%" }, children: [
        jsxs("button", { type: "button", onClick: () => setOpen(!open), style: { alignItems: "center", background: "transparent", border: "none", color: "inherit", cursor: "pointer", display: "flex", justifyContent: "space-between", padding: "10px 14px", width: "100%" }, children: [left, right] }),
        open ? jsx("div", { style: { padding: "0 14px 8px" }, children }) : null
      ] });
    }
    function MascotTabs({ active, onChange, tabs }) {
      const list = tabs || [{ id: "quests", label: "Today's quests" }, { id: "week", label: "This week's check-ins" }];
      return jsx("div", { style: { background: "var(--dsw-alias-interactive-bg-hover, transparent)", borderRadius: "10px", display: "flex", gap: "4px", marginBottom: "8px", padding: "3px" }, children: list.map((t) => jsx("button", { key: t.id, type: "button", onClick: () => onChange(t.id), style: { background: active === t.id ? "var(--dsw-static-accent, #4da3ff)" : "transparent", border: "none", borderRadius: "8px", color: active === t.id ? "#fff" : "inherit", cursor: "pointer", flex: 1, fontSize: "13px", padding: "6px 0" }, children: t.label })) });
    }
    function MascotDailyCard() {
      const [tab, setTab] = React.useState("quests");
      return jsxs(MascotAccordion, { title: "Daily and progression", icon: "🎯", summary: "Quests, check-ins and titles", defaultOpen: false, children: [
        jsx(MascotTabs, { active: tab, onChange: setTab, tabs: [{ id: "quests", label: "Today's quests" }, { id: "week", label: "This week's check-ins" }, { id: "badge", label: "Title" }] }),
        tab === "quests" ? jsx(MascotDailyQuests, {}) : (tab === "week" ? jsx(MascotWeekSignin, {}) : jsx(MascotBadgeRow, {}))
      ] });
    }
    function MascotAchievementRow() {
      const ids = MascotValue("achievements", "").split(",").filter(Boolean);
      return jsx(MascotAchievementWall, { ids });
    }
    function MascotResetRow() {
      return jsxs("label", { style: MASCOT_ROW_STYLE, children: [jsx("span", { children: "Floating position" }), jsx("button", { type: "button", onClick: () => { try { window.localStorage.removeItem("whale-moe:floatX"); window.localStorage.removeItem("whale-moe:floatY"); } catch (e) {} window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "float-reset", value: true } })); }, children: "Reset to default position" })] });
    }
    function MascotGrowthResetRow() {
      return jsxs("label", { style: MASCOT_ROW_STYLE, children: [jsx("span", { children: "Progression data" }), jsx("button", { type: "button", onClick: () => { ["mood", "affinity", "satiety", "lastSignin", "signinStreak", "achievements", "companionSince", "level", "quests", "weekSignin", "badge", "gameStats"].forEach((k) => { try { window.localStorage.removeItem("whale-moe:" + k); } catch (e) {} }); window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "growth-reset", value: true } })); }, children: "Reset progression" })] });
    }
    function MascotPrefRows({ ctx }) {
      return jsxs("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: [
        jsx(MascotOverviewCard, {}),
        jsxs(MascotAccordion, { title: "Companion behaviour", icon: "🎛️", summary: "How Whale-chan appears and talks", defaultOpen: true, children: [jsx(MascotSwitchGrid, { ctx })] }),
        jsx(MascotAccordion, { title: "Weather", icon: "⛅", summary: "City and weather effects", defaultOpen: false, children: [jsx(MascotWeatherRow, {}), jsx("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", lineHeight: "15px", padding: "0 0 6px" }, children: "Effects only show once a city is set and the weather data is fresh; they ease off while you are working and thunder flashes stop." })] }),
        jsx(MascotAccordion, { title: "Balance", icon: "🪙", summary: "Account balance and playback", defaultOpen: false, children: [jsx(MascotBalanceRow, {})] }),
        jsx(MascotDailyCard, {}),
        jsx(MascotAccordion, { title: "Achievement wall", icon: "🏅", summary: "Unlocked " + MascotValue("achievements", "").split(",").filter(Boolean).length + " / " + MASCOT_ACHIEVEMENTS.length, defaultOpen: false, children: [jsx(MascotAchievementRow, {})] }),
        jsx(MascotAccordion, { title: "Growth journal", icon: "📖", summary: "Memories with " + MascotValue("selfName", "Whale-chan"), defaultOpen: false, children: [jsx(MascotJournalRow, {})] }),
        jsx(MascotAccordion, { title: "Data and reset", icon: "🗂️", summary: "Position and progression data", defaultOpen: false, children: [jsx(MascotResetRow, {}), jsx(MascotGrowthResetRow, {})] })
      ]});
    }
    /* Settings panel content prefers the child slot render (settings.mascot.item, extensible by other plugins);
       when renderSlot is missing or throws, fall back to MascotPrefRows so the panel is never blank on any host version. */
    function MascotSection(props) {
      const ctx = props && props.ctx;
      const renderSlot = props && typeof props.renderSlot === "function" ? props.renderSlot : null;
      if (renderSlot !== null) {
        try {
          const rendered = renderSlot("settings.mascot.item", {});
          if (rendered !== null && rendered !== undefined) {
            return jsx("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: rendered });
          }
        } catch (e) {
          console.warn("[dsh-whale-musume] settings.mascot.item render failed, falling back to the built-in panel", e);
        }
      }
      return jsx(MascotPrefRows, { ctx });
    }

    function registerMimoTtsBridge(ctx) {
      ctx.effect(() => {
        const playInteractionLine = (event) => {
          const enabled = MascotValue("mimoTts", "0") !== "0";
          const text = event && event.detail && typeof event.detail.text === "string" ? event.detail.text.trim() : "";
          if (!enabled || text.length === 0) return;
          const tts = ctx.get("xiaomiMimoTts");
          if (tts === undefined || typeof tts.play !== "function") return;
          try {
            const playback = tts.play(text);
            if (playback && typeof playback.catch === "function") playback.catch(() => {});
          } catch {
            /* Optional playback failure does not affect mascot interaction. */
          }
        };
        window.addEventListener(MIMO_TTS_EVENT, playInteractionLine);
        return () => window.removeEventListener(MIMO_TTS_EVENT, playInteractionLine);
      }, "dsh-whale-musume: optional MiMo TTS bridge");
    }

    function registerSettings(ctx) {
      const slots = ctx.get("slots");
      if (slots === undefined) {
        console.warn("[dsh-whale-musume] slots service unavailable, skipping settings panel registration (the mascot itself is unaffected)");
        return;
      }
      slots.inject("settings.section", () => slots.register(
        { name: "settings.section", id: "mascot", order: 6, label: "Mascot", children: { "settings.mascot.item": { kind: "list", scope: "root" } } },
        (props) => jsx(MascotSection, { ...props, ctx })
      ));
      slots.inject("settings.mascot.item", () => slots.register(
        { name: "settings.mascot.item", id: "mascot-prefs", order: 0 },
        () => jsx(MascotPrefRows, { ctx })
      ));
    }

    function apply(ctx) {
      boot();
      /* This bridge is entirely optional: it neither injects nor hard-depends on MiMo TTS. */
      try {
        registerMimoTtsBridge(ctx);
      } catch (e) {
        console.warn("[dsh-whale-musume] MiMo TTS bridge registration failed; the mascot itself is unaffected", e);
      }
      /* The settings panel is an enhancement: even if registration fails, the mascot itself must still appear. */
      try {
        registerSettings(ctx);
      } catch (e) {
        console.warn("[dsh-whale-musume] settings panel registration failed; the mascot itself is unaffected", e);
      }
    }

    exports.apply = apply;
    exports.inject = ["slots"];
    return module.exports;
  },
});
