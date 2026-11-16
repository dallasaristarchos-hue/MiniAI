# MiniAI ✦

MiniAI is a mobile-first AI chat website with a dark interface, violet-pink accents, persistent local conversations, and a Cloudflare-hosted AI backend.

## Live website

https://miniai-ai.pages.dev

## Features

- Streaming AI chat with conversation history stored in the browser
- Dedicated coding mode and general programming help
- Greek-school-aware tutoring and step-by-step explanations
- Optional live web lookup and lightweight calculator, weather, currency, dictionary, books, and reference tools
- Higher-detail image generation with FLUX.2 Klein 4B and AI photo editing
- Typo-tolerant question understanding and spelling-corrected web searches
- Voice dictation and browser text-to-speech where supported
- Accounts, one-time ratings, response reporting, and account deletion
- Privacy and account-deletion information at `/privacy.html` and `/delete-account.html`
- Installable PWA with an offline app shell

Some browser features depend on the device and browser. Live lookup and AI features depend on upstream services and their current availability and usage limits.

## Architecture

- `index.html` — application structure and entry point
- `style.css` — responsive visual system and animations
- `script.js` — chat UI, local history, settings, voice, and image tools
- `sw.js` — PWA caching and offline fallback
- `worker.js` — Cloudflare Worker API, AI calls, validation, authentication, ratings, and reports
- `migrations/` — D1 database schema migrations
- `tests/worker.test.mjs` — dependency-free Worker route regression tests

The production frontend is served by Cloudflare Pages (`miniai-ai.pages.dev`). It calls the `miniai-api` Worker at:

`https://miniai-api.dallasaristarchos.workers.dev`

The Worker uses the Cloudflare Workers AI binding named `AI` and the D1 binding named `DB`. The browser does not contain provider API keys. Keep both bindings when changing Worker settings or deploying a new script. The current database schema is managed by the SQL files in `migrations/`; do not reset or recreate the production database to deploy ordinary code changes.

## Development checks

Run the route regression tests with Node.js 20 or newer:

```bash
node --test tests/worker.test.mjs
```

Check JavaScript syntax before committing:

```bash
node --check worker.js
node --check script.js
node --check sw.js
```

The regression tests use a mocked D1 database and do not modify production accounts or data.

## Deployment notes

- Cloudflare Pages deploys the `main` branch from GitHub.
- The backend is the separate `miniai-api` Worker.
- Preserve the existing `AI` and `DB` bindings and the production D1 database ID.
- Do not add API credentials, session tokens, or other secrets to GitHub or browser-side files.
- Check the Pages build/deployment status and Worker health endpoint after publishing.
- Cloudflare and model usage are subject to the limits of the account's current plan; do not promise unlimited use.
