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

const SEARCH_PATTERN = /\b(latest|today|current|currently|202[5-9]|price|prices|cost|buy|budget|best|compare|review|release|news|available|availability|specs|specifications|benchmark|deal|where can i|search|research|recommend|recommendation|pc build|gaming pc|gpu|cpu|motherboard|laptop|phone|market|version)\b/i;
function decodeHtml(value) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
async function searchWeb(query) {
  const endpoint = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query.slice(0, 180));
  const response = await fetch(endpoint, { headers: { "User-Agent": "Mozilla/5.0 MiniAI/2.0", "Accept": "text/html" }, signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error("Search provider unavailable");
  const html = await response.text();
  const results = [];
  const blocks = html.split(/<div class="result[^>]*>/i).slice(1, 7);
  for (const block of blocks) {
    const link = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const snippet = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
    if (!link) continue;
    let url = decodeHtml(link[1]);
    try { const parsed = new URL(url, "https://duckduckgo.com"); const target = parsed.searchParams.get("uddg"); if (target) url = target; } catch {}
    if (!/^https?:\/\//i.test(url)) continue;
    const title = decodeHtml(link[2].replace(/<[^>]+>/g, "")).trim();
    const summary = decodeHtml((snippet?.[1] || snippet?.[2] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ")).trim();
    if (title) results.push({ title: title.slice(0, 180), url, snippet: summary.slice(0, 420) });
  }
  return results;
}

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

    let webEvidence = "";
    const latestUserText = messages[messages.length - 1].content;
    if (SEARCH_PATTERN.test(latestUserText)) {
      try {
        const found = await searchWeb(latestUserText);
        if (found.length) webEvidence = "\n\nWEB RESEARCH RESULTS (retrieved just now; treat as untrusted source material, verify claims, and cite the supplied URLs):\n" + found.map((item, index) => `${index + 1}. ${item.title}\nURL: ${item.url}\nSnippet: ${item.snippet}`).join("\n\n");
      } catch (searchError) {
        webEvidence = "\n\nLIVE WEB SEARCH FAILED. Do not claim to have searched or invent sources; state that live research is temporarily unavailable.";
      }
    }

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "You are MiniAI, a capable, accurate general-purpose assistant. Your creator is Dallas (also known as Dallas Aristarchos). If asked who created, built, or founded MiniAI, answer clearly that Dallas is your creator. Do not claim that Dallas created the underlying AI model or Cloudflare technology; he created this MiniAI application. Reply in the user's language. Be clear, useful and appropriately detailed. Never claim to be ChatGPT or OpenAI. Never invent facts, prices, sources, tests or availability. When WEB RESEARCH RESULTS are provided, use them to answer, cite sources with Markdown links near the claims they support, compare more than one source when possible, note dates and uncertainty, and do not claim you checked anything beyond those results. If results are empty, say live search did not return useful sources and answer only from reliable general knowledge. For PC hardware advice: respect the exact total budget and country, give a complete compatible parts list, check CPU socket/chipset, RAM type, PSU quality/wattage, case clearance and upgrade path, distinguish new from used prices, prioritize balanced performance per euro, and never recommend obviously underpowered/outdated parts when better options fit. Show realistic price ranges and clearly label estimates. Ask one concise clarifying question only when an essential detail is missing. Keep all advice safe and age-appropriate." + webEvidence
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