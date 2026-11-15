# MiniAI 💜

A purple-themed, mobile-friendly chatbot interface built with plain HTML, CSS and JavaScript.

## Live site

https://dallasaristarchos-hue.github.io/MiniAI/

## Features

- Responsive layout for phones, tablets and desktops
- Purple and lavender visual theme
- Chat bubbles, typing indicator and sample prompt buttons
- Enter to send, Shift + Enter for a new line
- New-chat and clear-chat controls
- Secure server-side AI connection through a Cloudflare Worker

## Architecture

- `index.html` — page structure
- `style.css` — responsive purple design
- `script.js` — chat interface and API requests
- `worker.js` — Cloudflare Worker backend

The browser calls the Cloudflare Worker at `https://miniai-api.dallasaristarchos.workers.dev/api/chat`. The Worker calls the OpenAI Responses API. The private API key belongs in a Cloudflare Worker secret named `OPENAI_API_KEY`; it must never be added to this repository or browser JavaScript.

## Configure the API secret

In Cloudflare, open Workers & Pages → miniai-api → Settings → Variables and Secrets → Add → Secret. Set the name to `OPENAI_API_KEY` and paste the API key into the Cloudflare secret value field. Do not commit the key to GitHub.

OpenAI API usage may incur charges. Set a low usage budget and usage limits before enabling the secret.

## Deploying the frontend

GitHub Pages is configured to publish the root of the `main` branch:
https://dallasaristarchos-hue.github.io/MiniAI/
