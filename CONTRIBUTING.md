# Contributing

## Development environment

- Node.js 18+
- DeepSeek Harness 0.1.0-rc.x (using a separate copy for verification is recommended, to avoid polluting your main installation)

## Making changes and verifying them

0. To boot a dev DSH instance that loads this plugin straight from your working tree (no packaging/reinstall step), create a `cordis.local.yml` at the repo root pointing at `lib/index.js`:

   ```yaml
   insert:
     - id: my-plugin
       name: 'file:///C:/path/to/dsh-whale-musume/lib/index.js'
   ```

   This file is personal/untracked (gitignored), since the path is machine-specific. Then run `npm run dev` (`dsh web --patch cordis.local.yml`). Asset edits (`assets/*.js`/`.css`) just need a browser hard-refresh (`Ctrl+F5`); changes to `lib/index.js`/`lib/client.js` need `npm run dev` restarted.
1. Edit the files under `assets/` (the state machine lives in `whale-moe-core.js`, the presentation layer in `dsh-whale-moe.js`, and the styles in `dsh-whale-moe.css`).
2. After syncing the assets to the copy, run:

```bash
npm test
# or:
node --test test/whale-moe-core.test.mjs test/whale-moe-growth.test.mjs test/apply-theme.test.mjs test/whale-moe-game.test.mjs test/whale-moe-fx.test.mjs test/whale-moe-quest.test.mjs test/whale-moe-zones.test.mjs
node test/motion-qa.mjs
node test/cdp-whale-moe.mjs
```

3. Merge into the main installation only after everything passes.

## Pose art generation pipeline

- `scripts/gen-assets.py` calls a third-party image API to generate/edit pose art, and reads the key only from the `DSH_JMRAI_API_KEY` environment variable;
- Generated candidate pose art first goes to a review directory for manual confirmation, and only then enters `assets/generated/`;
- `scripts/build-review.py` generates the review page, and `scripts/slice-batch.py` is used for slicing posters.

## Japanese voice pipeline

- **Full manual: [`docs/voice-pipeline.md`](docs/voice-pipeline.md)** — setup, how to change a translation, how to regenerate only the affected clips, and the traps;
- Sources: the English lines in `assets/whale-moe-core.js`, the Japanese in `.voice-preview/ja/part-*.json`, and the presenter's own fixed strings in `EXTRAS` (`scripts/voice-pilot.mjs`);
- Generated: 654 clips in `assets/voice/ja/` (committed, 15.7 MB) plus the cache in `.voice-preview/` (git-ignored);
- Chain: `voice-pilot.mjs --merge` → `--all` → `kokoro-render.py --only-missing` → `voice-pack.py` → `apply-theme.mjs --assets-only`;
- Verify with `npm test`, then `npm run qa:voice` (headless Chrome, real playback) or `npm run qa:voice:watch` (audible);
- The manifest is keyed by the **exact English line**, so editing an English line re-keys its clip and requires the whole chain to be re-run.

## Commit conventions

- One commit per concern, with descriptions that make the `fix:` / `feat:` / `chore:` prefix clear.
- Do not commit browser profiles, backups, logs, or zip installers.

## Style

- Mascot code follows "only touch your own nodes, never modify DSH's business DOM".
- Asset URLs use a version number for cache busting.
