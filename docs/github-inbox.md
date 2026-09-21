# GitHub Inbox · Weekly Triage and Action List

- **Repository**: [Sutera-Diffusus/dsh-whale-musume](https://github.com/Sutera-Diffusus/dsh-whale-musume)
- **Maintainer account**: `Sutera-Diffusus` · **Triage date**: 2026-09-05
- **Execution channel**: `gh` CLI (OAuth token, scopes: gist / read:org / repo / workflow) ✅ read/write working

## 1. Repository inbox (incoming PRs / issues)

| Type | # | Title | Author | Status | Action |
|------|---|------|------|------|------|
| Issue | 9 | feat: optional MiMo TTS integration, PCM streaming dialogue playback | ppy-web | OPEN | ✅ Replied to confirm scope and invited a PR + applied the `enhancement` label |
| PR | 7 | fix: after an error Whale-chan stays stuck on the "crash" pose art forever | wrzrmzx | Merged | ✅ Nothing left over |
| PR | 2 | fix: right-click settings + bundle settings panel v1.4.2 | haitang1 | Merged | ✅ Nothing left over |
| Issue | 6 | settings panel missing in bundle mode | ppy-web | Closed | ✅ Fixed by PR #2 |
| Issue | 5 | suggestion for a way to bring the mascot back after dismissing it | VectorAC | Closed | ✅ Landed in v1.5.0 |
| Issue | 4 | custom self-designation for the mascot | Vulpexl | Closed | ✅ Landed in v1.5.0 |
| Issue | 3 | right-click settings unresponsive + panel missing | haitang1 | Closed | ✅ Fixed by PR #2 |

## 2. Notification inbox (item-by-item triage)

| Thread | Status | Action |
|------|------|------|
| **AI-Scarlett/DSH-Store #393 author fix request** | open | ✅ **Fixed and replied**: ① v2.0.0 → v2.0.1; ② added `dsh.compatibility.dshReleases` (0.1.2-rc.1 / 0.1.1-rc.2 compatible, both alpha versions unknown); ③ lineage repair (graft merge restored the direct ancestor `a61b09d`; compare is now `ahead / 14 ≤ 200`); ④ replied requesting a re-check ([comment](https://github.com/AI-Scarlett/DSH-Store/issues/393#issuecomment-5548554320)) |
| deepseek-ai #215 plugin featured list | In discussion | ✅ Read: the new comment is someone else asking to be listed, unrelated to us |
| hashgraph #175 awesome-ai-plugins | Merged | ✅ Read: the user has claimed the HOL Registry and it took effect — `ownerVerified=true` (2026-09-05T02:01Z); the listing page carries the Owner-verified badge |
| deepseek-ai #688 DSH featured-plugin aggregator repo | Included | ✅ Read: like-study1 has included us and periodically auto-syncs the topic; no action needed |
| deepseek-ai #999 environment isolation Ideas | In discussion | ✅ Read: weijiafu14 added a profile approach (mentions us but raises no directed question); no reply needed |
| fendouai #47 | Merged directly into main | ✅ Read: content already merged directly (1f27770) |
| deepseek-ai #2779 third-party models burning tokens | In discussion | ✅ Read: I have already answered this; the new comments contain nothing directed at us |
| **Axorax #278 Add: Weiyu** | open (changes requested in review) | ✅ **Changed and pushed**: removed the leading "A" from the description and linked the green badge to the repository (commit 6af4e58); replied to the reviewer ([comment](https://github.com/Axorax/awesome-free-apps/pull/278#issuecomment-5548558232)); waiting for the maintainer to re-review and merge |
| awesome-dsh-plugin #3618 | Closed | ✅ Read |
| bruc3van #113 | Merged | ✅ Read |
| dsh-tauri #205 | Moved to the proper tracker | ✅ Read: moved to dsh-tauri-plugins **#18** per the maintainer's guidance (open, waiting on the maintainer) |

## 3. Outstanding to-dos (user side)

1. **Waiting on**: dsh-tauri-plugins #18, Axorax #278 (changes submitted, awaiting re-review).
2. **DSH STORE re-check**: waiting for the store's 8-hour automation to run over the #393 fixes (pushed 2026-09-05, commit `ad9f110`); if the re-check still reports blockers, keep following up.

## 4. Key fix log (DSH STORE)

- **Lineage repair**: the remote main had once been rebased wholesale, so the store's pinned commit `a61b09d` was no longer a candidate ancestor → updates were suspended indefinitely. A graft merge (not a force-push; zero history destruction) reattached the original lineage to main, and the new HEAD `ad9f110` satisfies the "bounded direct successor" requirement (ahead, 14 commits ≤ 200).
- **Compatibility declaration**: in the per-version `dsh.compatibility.dshReleases` matrix, `0.1.2-rc.1: compatible` is an **author-level source declaration** (core state machine is DOM-free + signal-detection resilience analysis), not runtime acceptance for 0.1.2-rc.1; after upgrading DSH we recommend also running `npm test` + `npm run qa` (already written into the CHANGELOG v2.0.1 notes).

## 5. Channel notes

- The local `gh` CLI reads and writes normally on every operation, so all triage actions go through `gh`; the DSH built-in MCP and the fine-grained PAT in `.credentials.yaml` are restricted (403) for writing Issues and reading Notifications, which does not affect execution through `gh`.
