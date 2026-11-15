# MiniAI ✦

A polished, mobile-first AI chat space with a pink-violet visual identity, persistent conversations, and a server-side AI connection.

## Live site

https://dallasaristarchos-hue.github.io/MiniAI/

## Features

- Responsive desktop and mobile interface with a custom animated violet-pink orb
- Persistent conversation history saved locally in the browser
- Search, switch, and delete conversations
- Copy messages and code blocks; export conversations as text
- Markdown-style answers with safe external links and code blocks
- Retry failed responses and check API connection status
- Enter to send, Shift + Enter for a new line, and Ctrl/Cmd + K for a new chat
- Server-side AI requests through a Cloudflare Worker; API keys never enter browser code

## Architecture

- `index.html` — application structure
- `style.css` — responsive visual system and animations
- `script.js` — chat interface, local conversation storage, and API requests
- `worker.js` — Cloudflare Worker backend

The browser calls `https://miniai-api.dallasaristarchos.workers.dev/api/chat`. The Worker calls the OpenAI Responses API and can use web search. The private API key belongs in a Cloudflare Worker secret named `OPENAI_API_KEY`; never add it to this repository or browser JavaScript.

## Configure the API secret

In Cloudflare, open Workers & Pages → `miniai-api` → Settings → Variables and Secrets → Add → Secret. Set the name to `OPENAI_API_KEY` and enter the key in the Cloudflare secret field. Do not commit the key to GitHub.

OpenAI API usage may incur charges. Set a low usage budget and usage limits before enabling the secret.

## Deploying the frontend

GitHub Pages publishes the root of the `main` branch: https://dallasaristarchos-hue.github.io/MiniAI/
