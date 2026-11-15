const ALLOWED_ORIGINS = new Set([
  "https://dallasaristarchos-hue.github.io",
  "https://miniai.dallasaristarchos.workers.dev",
  "https://miniai-cfd.pages.dev",
  "https://miniai-ai.pages.dev"
]);
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const hits = new Map();

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "vary": "Origin"
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!allowedOrigin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": allowedOrigin,
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Content-Type",
          "access-control-max-age": "86400",
          "vary": "Origin"
        }
      });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "MiniAI API",
        configured: Boolean(env.AI && typeof env.AI.run === "function"),
        provider: "Cloudflare Workers AI",
        model: MODEL
      }, 200, allowedOrigin);
    }

    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, allowedOrigin);
    }
    if (!allowedOrigin) return json({ error: "Origin not allowed" }, 403, "");
    if (!env.AI || typeof env.AI.run !== "function") {
      return json({ error: "Cloudflare Workers AI is not connected to this Worker yet." }, 503, allowedOrigin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now();
    const previous = hits.get(ip) || { start: now, count: 0 };
    if (now - previous.start >= WINDOW_MS) {
      previous.start = now;
      previous.count = 0;
    }
    previous.count += 1;
    hits.set(ip, previous);
    if (previous.count > MAX_REQUESTS_PER_WINDOW) {
      return json({ error: "Too many messages. Please wait a minute and try again." }, 429, allowedOrigin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Please send a valid message." }, 400, allowedOrigin);
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: "A message is required." }, 400, allowedOrigin);
    }

    const messages = body.messages.slice(-10).map((item) => ({
      role: item && item.role === "assistant" ? "assistant" : "user",
      content: String(item && item.content || "").slice(0, 3000)
    })).filter((item) => item.content.trim());

    const totalCharacters = messages.reduce((total, item) => total + item.content.length, 0);
    if (totalCharacters > 12000) {
      return json({ error: "That conversation is too long. Please start a new chat or shorten your message." }, 413, allowedOrigin);
    }
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return json({ error: "Please send a user message." }, 400, allowedOrigin);
    }

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "You are MiniAI, a capable, accurate, friendly general-purpose assistant. Reply in the user's language. Answer directly and clearly, usually concisely. Never claim to be ChatGPT or OpenAI. Do not invent facts or pretend to browse the web. If unsure, say so. Keep advice safe and age-appropriate."
          },
          ...messages
        ],
        max_tokens: 700,
        temperature: 0.55
      });

      const answer = typeof result?.response === "string"
        ? result.response
        : typeof result?.choices?.[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : typeof result?.output_text === "string"
            ? result.output_text
            : "";

      if (!answer.trim()) {
        return json({ error: "MiniAI did not receive a usable answer. Please try again." }, 502, allowedOrigin);
      }
      return json({ reply: answer }, 200, allowedOrigin);
    } catch (error) {
      return json({ error: "MiniAI's free AI service is temporarily busy. Please try again shortly." }, 502, allowedOrigin);
    }
  }
};