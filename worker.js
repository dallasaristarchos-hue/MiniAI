const ALLOWED_ORIGINS = new Set([
  "https://dallasaristarchos-hue.github.io",
  "https://miniai.dallasaristarchos.workers.dev"
]);
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
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
      return json({ ok: true, service: "MiniAI API", configured: Boolean(env.OPENAI_API_KEY) }, 200, allowedOrigin);
    }

    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, allowedOrigin);
    }
    if (!allowedOrigin) return json({ error: "Origin not allowed" }, 403, "");
    if (!env.OPENAI_API_KEY) {
      return json({ error: "MiniAI's AI service is not configured yet. Add the OPENAI_API_KEY secret in Cloudflare." }, 503, allowedOrigin);
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

    const messages = body.messages.slice(-12).map((item) => ({
      role: item && item.role === "assistant" ? "assistant" : "user",
      content: String(item && item.content || "").slice(0, 3000)
    })).filter((item) => item.content.trim());

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return json({ error: "Please send a user message." }, 400, allowedOrigin);
    }

    try {
      const aiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          instructions: "You are MiniAI, a capable, accurate and helpful general-purpose assistant. Answer the user's actual question directly, explain uncertainty instead of guessing, and give enough detail to be useful. Use web search when information may be current, time-sensitive, obscure, or when the user asks you to find or verify something. Prefer reliable sources and distinguish verified facts from estimates. Do not claim to be ChatGPT or OpenAI.",
          tools: [{ type: "web_search" }],
          tool_choice: "auto",
          input: messages,
          max_output_tokens: 900
        })
      });

      const result = await aiResponse.json();
      if (!aiResponse.ok) {
        return json({ error: "The AI service could not complete that request. Check the API account and key configuration." }, 502, allowedOrigin);
      }

      let answer = result.output_text;
      if (!answer && Array.isArray(result.output)) {
        answer = result.output.flatMap((item) => item.content || [])
          .filter((part) => part.type === "output_text")
          .map((part) => part.text)
          .join("\n");
      }
      if (!answer) {
        return json({ error: "MiniAI did not receive a usable answer. Please try again." }, 502, allowedOrigin);
      }
      return json({ reply: answer }, 200, allowedOrigin);
    } catch {
      return json({ error: "MiniAI could not reach the AI service. Please try again." }, 502, allowedOrigin);
    }
  }
};