# Umika Meme Chat + Cute Dialogue + Weather Companionship Design

Date: 2026-08-15
Status: Approved by the user; implementation plan pending

## 1. Goals

Without breaking the existing state machine or work-state stability (v1.0.2), expand Umika's dialogue lines from about 190 to about 500, and give her:

1. A large set of safe memes plus cute-style dialogue (keeping the energetic childhood-friend persona: she can act clingy, can snark, and never offends)
2. Low-frequency proactive small talk (once every 5-8 minutes) that stays as close as possible to the current task stage/content and never feels awkward
3. Time-of-day greetings (good morning / late morning / noon / good afternoon / good evening / good night), each with a word of care
4. Open-Meteo weather integration, with a city field and an optional API Key in the settings panel, plus a "Test connection" button

## 2. Decisions Already Confirmed by the User

- Option A: expand the `whale-moe-core.js` line bank in place plus new presenter components; no new script files
- Total dialogue is about 500 lines; mostly cute plus safe memes (no politics, discrimination, or controversial memes)
- Weather location: city typed manually in settings; empty by default = no network access at all
- Weather presentation: polled once every 30-60 minutes, woven naturally into idle small talk plus occasional bubbles; no interruptions while working
- Proactive small talk: once every 5-8 minutes; task text is read locally for topic classification (keyword matching only, never uploaded)
- Greetings: once every >3 hours; with weather variants; no proactive interruptions between 23:00 and 05:00
- The settings panel must have: a city input, an API Key input (optional), and a test connection button

## 3. Weather API

Primary choice: Open-Meteo (free, no key required, CORS available):

- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=zh&format=json`
- Weather: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
- With an API Key set: append `&apikey={key}` to the requests above; without a key, use the free tier normally
- The free non-commercial quota is more than enough for polling once every 30-60 minutes

Privacy: only the city name/latitude-longitude are sent to Open-Meteo; task text and chat history are never shared externally.
Task topic classification matches keywords only in local browser memory and is discarded immediately after use.

## 4. Architecture and Module Boundaries

### 4.1 whale-moe-core.js (pure logic, no DOM/network)

- Expand the line bank to about 500 lines:
  - `LINES`: state dialogue lines, 4-6 per state (about 70)
  - `DIALOGUE.daily` (about 110), `work` (about 90), `interact` (about 80)
  - `DIALOGUE.keyword` (about 60, including new meme keyword groups)
  - `DIALOGUE.meme` (about 70, 12 groups: office worker / slacking off / deadlines / empty promises / letting it rot / madness literature / flag setting / bug mysticism, etc.)
  - `DIALOGUE.context` (about 30: code/write/research/bug/data/deploy/general)
  - `DIALOGUE.weather` (about 30: sunny/rain/snow/thunder/strong wind/cooling/warming/high heat/overcast/fog)
  - `DIALOGUE.greet` (about 30: 6 time buckets x 5+, each with a word of care)
- New exports:
  - `pickDialogueAvoidRecent(bank, event, counter, rng, recent)`: an anti-repetition picker that prefers to avoid the most recent N entries in `recent`; does not break the existing `pickDialogue`
  - `greetBucket(hour)`: 6 time buckets = early morning 6:00-8:59 / morning 9:00-11:59 / noon 12:00-13:59 / afternoon 14:00-17:59 / evening 18:00-22:59 / late night 23:00-5:59 (no proactive greeting late at night, only passive responses)
  - `weatherText(code)`: Open-Meteo WMO weather_code -> `{ emoji, label, kind }` mapping (kind: sunny/rain/snow/thunder/wind/hot/cold/cloudy/fog)
  - `classifyTask(text)`: local keyword classification -> `code/write/research/bug/data/deploy/general`
  - Keep the `TEASE_CHANCE` export as a compatibility placeholder, but the state machine no longer teases randomly

### 4.2 dsh-whale-moe.js (presenter: DOM/network/scheduling)

- `WeatherService`:
  - `city` / `apiKey` stored in `whale-moe:weatherCity` / `whale-moe:weatherKey`
  - Caches city coordinates and weather; weather data expires after 2 hours
  - Refreshes once every 30-60 minutes; on failure backs off for 60 minutes; the test button issues its own live request
  - Never opens any window proactively; presents only in the settings panel and in bubbles
- `IdleChatScheduler`:
  - Evaluates once every 5-8 minutes (randomized), and speaks only when `state === idle`, the bubble is free, the pet is enabled, and the settings page is not open
  - Line selection priority: greetings/weather changes > on-topic task stage and content > generic cute/meme lines
  - No interrupting in the work state; missed slots are deferred
- `TaskTopicProbe`:
  - Reuses the timing of the existing keyword scan (locally, when chat text changes)
  - Matches only the classification word list, produces a `context` category; stores no text
- Greetings:
  - When the app opens / after check-in, if more than 3 hours have passed since the last greeting and the time is outside the 23:00-05:00 proactive window, greet once
  - Between 23:00 and 05:00, only reply with a "get some sleep early"-style word of care after the user interacts/speaks
- Settings panel (the React part injected by `apply-theme.mjs`):
  - A "Weather" section: city text field, API Key password field, test connection button
  - The test result status (✅/❌ + message) stays permanently visible and does not auto-dismiss
  - No city = no weather API requests at all

## 5. Data Flow

1. User sets a city -> `WeatherService.save()` -> geocoding -> cache coordinates
2. Timer/greeting trigger -> `WeatherService.getWeather()` -> core's `weatherText(code)` selects a template
3. `IdleChatScheduler` combines priority: greetings > weather changes > task classification/stage > generic
4. `showLine()` reuses the existing bubble presentation; when the bubble is occupied the line is dropped or deferred, without interrupting existing animations

## 6. Failures and Degradation

- Network failure: one silent retry -> back off for 60 minutes
- Invalid city/no results: the panel shows "City not found" and does not retry repeatedly
- Invalid API Key: automatically falls back to a keyless request; if that also fails, stay silent
- Stale weather: do not force weather talk; fall back to generic lines
- No weather-feature failure may affect the mascot itself or the work state

## 7. Testing and Acceptance

1. Unit tests:
   - The anti-repetition picker does not repeat consecutively
   - `greetBucket` at every boundary (5:59/6:00/8:59/9:00/11:59/12:00/13:59/14:00/17:59/18:00/22:59/23:00)
   - The WMO weather_code mapping covers common codes (0,1,2,3,45,48,51,61,63,65,71,73,75,80,81,82,95,96,99)
   - `classifyTask` for code/write/research/bug/data/deploy/general samples
   - Total line bank >= 480, with no group below its design minimum
2. CDP:
   - The settings panel shows the city/API Key/test button
   - With weather off, the `fetch` count is 0
   - Test button: makes a real Open-Meteo request and shows success or an explicit failure; test hooks can inject a mock
   - The proactive small-talk timer exists and its interval falls in the 5-8 minute range; test hooks can fast-forward
   - No proactive speech during the do-not-disturb greeting window (23:00-05:00)
3. Regression:
   - All existing 58 CDP checks, motion QA, soak-work, and 37 unit tests stay green
   - Work-state stability rules unchanged: no small talk while busy, no pose switching, and the signal-hold logic is not modified
4. Manual acceptance:
   - On a real machine, enter "Shanghai" and the test connection shows ✅; greetings/small talk include weather-aware words of care

## 8. Explicitly Out of Scope

- No theme skins or wardrobe
- No multi-city/weather-card standalone UI
- No new script files and no npm dependencies
- Weather/small talk must not grab the conversation or switch poses during the work state
- No politics, discrimination, or controversial memes
