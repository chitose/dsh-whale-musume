# Contributing

## Development environment

- Node.js 18+
- DeepSeek Harness 0.1.0-rc.x (using a separate copy for verification is recommended, to avoid polluting your main installation)

## Making changes and verifying them

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

## Commit conventions

- One commit per concern, with descriptions that make the `fix:` / `feat:` / `chore:` prefix clear.
- Do not commit browser profiles, backups, logs, or zip installers.

## Style

- Mascot code follows "only touch your own nodes, never modify DSH's business DOM".
- Asset URLs use a version number for cache busting.
