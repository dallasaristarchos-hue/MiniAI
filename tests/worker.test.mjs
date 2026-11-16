import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";

globalThis.crypto ??= webcrypto;
const source = await readFile(new URL("../worker.js", import.meta.url), "utf8");
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const origin = "https://miniai-ai.pages.dev";
const token = "A".repeat(43);

function mockEnv() {
  const batches = [];
  const account = { id: "test-account", username: "tester", display_name: "Test User" };
  const DB = {
    prepare(sql) {
      return {
        sql,
        bind() {
          return {
            sql,
            first: async () => account,
            run: async () => ({ success: true })
          };
        }
      };
    },
    async batch(statements) { batches.push(statements); return []; }
  };
  return { env: { DB, AI: { run: async () => ({ response: "ok" }) } }, batches };
}

function makeRequest(path, method = "GET", headers = {}) {
  return new Request(`https://miniai-api.dallasaristarchos.workers.dev${path}`, {
    method,
    headers: { Origin: origin, ...headers }
  });
}

test("account profile GET remains available", async () => {
  const { env } = mockEnv();
  const response = await worker.fetch(makeRequest("/api/auth/me", "GET", { Authorization: `Bearer ${token}` }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).account.username, "tester");
});

test("account DELETE reaches the deletion handler and removes related rows", async () => {
  const { env, batches } = mockEnv();
  const response = await worker.fetch(makeRequest("/api/auth/me", "DELETE", { Authorization: `Bearer ${token}` }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).deleted, true);
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0].map(statement => statement.sql), [
    "DELETE FROM ratings WHERE account_id = ?",
    "DELETE FROM sessions WHERE account_id = ?",
    "DELETE FROM accounts WHERE id = ?"
  ]);
});

test("unsupported account profile methods return 405", async () => {
  const { env } = mockEnv();
  const response = await worker.fetch(makeRequest("/api/auth/me", "PATCH", { Authorization: `Bearer ${token}` }), env);
  assert.equal(response.status, 405);
});

test("allowed website origin can complete CORS preflight", async () => {
  const { env } = mockEnv();
  const response = await worker.fetch(makeRequest("/api/auth/me", "OPTIONS"), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
});

test("unapproved origins cannot access account routes", async () => {
  const { env } = mockEnv();
  const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/auth/me", {
    method: "GET", headers: { Origin: "https://not-miniai.example", Authorization: `Bearer ${token}` }
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 403);
});


test("chat stream keeps CORS and browser security headers", async () => {
  const { env } = mockEnv();
  env.AI.run = async () => new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"response":"Hello from MiniAI"}\\n\\n'));
      controller.close();
    }
  });
  const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/chat", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }], plugins: { calculator: false, weather: false, currency: false, wikipedia: false, webSearch: false, dictionary: false, books: false, units: false } })
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(await response.text(), /Hello from MiniAI/);
});

test("FLUX image generation sends only supported model inputs", async () => {
  const { env } = mockEnv();
  const calls = [];
  env.AI.run = async (model, input) => {
    calls.push({ model, input });
    if (calls.length === 1) return { response: "polished purple sunset prompt" };
    return new Uint8Array([255, 216, 255, 217]);
  };
  const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/image", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "generate", prompt: "A purple sunset over the sea" })
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.image.startsWith("data:image/jpeg;base64,"));
  const fluxCall = calls.find(call => call.model === "@cf/black-forest-labs/flux-1-schnell");
  assert.ok(fluxCall);
  assert.deepEqual(Object.keys(fluxCall.input).sort(), ["prompt", "steps"]);
  assert.equal(fluxCall.input.steps, 8);
});
