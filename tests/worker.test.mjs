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

test("FLUX.2 Klein image generation sends supported multipart inputs", async () => {
  const { env } = mockEnv();
  const calls = [];
  env.AI.run = async (model, input) => {
    calls.push({ model, input });
    if (calls.length === 1) return { response: "polished purple sunset prompt" };
    assert.equal(model, "@cf/black-forest-labs/flux-2-klein-4b");
    assert.ok(input.multipart?.body);
    assert.match(input.multipart.contentType, /^multipart\/form-data; boundary=/);
    const multipartResponse = new Response(input.multipart.body, { headers: { "content-type": input.multipart.contentType } });
    const form = await multipartResponse.formData();
    assert.equal(form.get("prompt"), "polished purple sunset prompt");
    assert.equal(form.get("width"), "1280");
    assert.equal(form.get("height"), "720");
    return { image: "/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==" };
  };
  const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/image", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "generate", prompt: "A purple sunset over the sea", width: 1280, height: 720 })
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.image.startsWith("data:image/jpeg;base64,"));
  assert.equal(calls.length, 2);
});

 test("misspelled names are corrected before web search", async () => {
  const { env } = mockEnv();
  const originalFetch = globalThis.fetch;
  let searchedUrl = "";
  const calls = [];
  globalThis.fetch = async (input) => {
    searchedUrl = String(input);
    return new Response('<li class="b_algo"><h2><a href="https://example.com/epstein">Jeffrey Epstein</a></h2><div class="b_caption"><p>Biography and background.</p></div></li>', { status: 200, headers: { "content-type": "text/html" } });
  };
  env.AI.run = async (model, input) => {
    calls.push(input);
    if (calls.length === 1) return { response: "Who is Jeffrey Epstein?" };
    return new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"response":"Jeffrey Epstein is the intended name."}\\n\\ndata: [DONE]\\n\\n')); controller.close(); } });
  };
  try {
    const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/chat", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Who is Epstin?" }], plugins: { calculator: false, weather: false, currency: false, wikipedia: false, webSearch: true, dictionary: false, books: false, units: false } })
    });
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 200);
    assert.match(searchedUrl, /q=Epstein/i);
    assert.doesNotMatch(searchedUrl, /Epstin/i);
    assert.equal(calls.length, 1);
    assert.match(calls[0].messages[0].content, /Epstin/);
    assert.match(await response.text(), /Who is Jeffrey Epstein/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("GitHub connection rejects an invalid token without contacting GitHub", async () => {
  const { env } = mockEnv();
  const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/github", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ token: "not-a-github-token", owner: "octocat", repo: "hello-world", branch: "main" })
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /fine-grained personal access token/i);
});

test("GitHub connection rejects unapproved origins", async () => {
  const { env } = mockEnv();
  const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/github", {
    method: "POST", headers: { Origin: "https://not-miniai.example", "Content-Type": "application/json" },
    body: JSON.stringify({ token: "github_pat_" + "A".repeat(40), owner: "octocat", repo: "hello-world", branch: "main" })
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 403);
});


test("GitHub connection supports public repositories in read-only mode without a token", async () => {
  const { env } = mockEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith("/repos/octocat/demo")) return Response.json({ full_name: "octocat/demo", private: false, default_branch: "main" });
    if (url.endsWith("/git/ref/heads/main")) return Response.json({ object: { sha: "a".repeat(40) } });
    if (url.endsWith(`/git/commits/${"a".repeat(40)}`)) return Response.json({ tree: { sha: "b".repeat(40) } });
    if (url.endsWith(`/git/trees/${"b".repeat(40)}?recursive=1`)) return Response.json({ tree: [{ path: "README.md", type: "blob" }] });
    return Response.json({ message: "unexpected request" }, { status: 500 });
  };
  try {
    const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/github", {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ token: "", owner: "octocat", repo: "demo", branch: "main" })
    });
    const response = await worker.fetch(request, env);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.connected, true);
    assert.equal(data.writePermission, "read-only");
    assert.equal(data.fileCount, 1);
  } finally { globalThis.fetch = originalFetch; }
});


test("GitHub file browser lists folders and files through the protected API", async () => {
  const { env } = mockEnv(); const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith("/repos/octocat/demo")) return Response.json({ full_name: "octocat/demo", private: false });
    if (url.endsWith("/contents?ref=main")) return Response.json([
      { name: "src", path: "src", type: "dir", sha: "folder" },
      { name: "README.md", path: "README.md", type: "file", sha: "readme", size: 12 },
      { name: ".env", path: ".env", type: "file", sha: "secret", size: 5 }
    ]);
    return Response.json({ message: "unexpected request" }, { status: 500 });
  };
  try {
    const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/github/files", {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tree", token: "", owner: "octocat", repo: "demo", branch: "main", path: "" })
    });
    const response = await worker.fetch(request, env); const data = await response.json();
    assert.equal(response.status, 200); assert.equal(data.entries.length, 2);
    assert.deepEqual(data.entries.map(item => item.name), ["src", "README.md"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub file browser decodes a selected text file", async () => {
  const { env } = mockEnv(); const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith("/repos/octocat/demo")) return Response.json({ full_name: "octocat/demo", private: false });
    if (url.includes("/contents/src/app.js?ref=main")) return Response.json({ type: "file", name: "app.js", path: "src/app.js", sha: "sha-one", size: 13, html_url: "https://github.com/octocat/demo/blob/main/src/app.js", content: Buffer.from("console.log(1)").toString("base64") });
    return Response.json({ message: "unexpected request" }, { status: 500 });
  };
  try {
    const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/github/files", {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", token: "", owner: "octocat", repo: "demo", branch: "main", path: "src/app.js" })
    });
    const response = await worker.fetch(request, env); const data = await response.json();
    assert.equal(response.status, 200); assert.equal(data.content, "console.log(1)"); assert.equal(data.sha, "sha-one");
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub file editor commits an update using the file SHA", async () => {
  const { env } = mockEnv(); const originalFetch = globalThis.fetch; let putBody = null;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/repos/octocat/demo")) return Response.json({ full_name: "octocat/demo", private: false });
    if (url.includes("/contents/src/app.js?ref=main")) return Response.json({ type: "file", sha: "sha-one" });
    if (url.includes("/contents/src/app.js") && init.method === "PUT") { putBody = JSON.parse(init.body); return Response.json({ content: { sha: "sha-two", html_url: "https://github.com/octocat/demo/blob/main/src/app.js" }, commit: { sha: "commit-two", html_url: "https://github.com/octocat/demo/commit/commit-two" } }); }
    return Response.json({ message: "unexpected request" }, { status: 500 });
  };
  try {
    const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/github/files", {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "write", token: "github_pat_" + "A".repeat(40), owner: "octocat", repo: "demo", branch: "main", path: "src/app.js", sha: "sha-one", content: "console.log(2)", message: "Update app" })
    });
    const response = await worker.fetch(request, env); const data = await response.json();
    assert.equal(response.status, 200); assert.equal(data.sha, "sha-two"); assert.equal(data.commit, "commit-two");
    assert.equal(putBody.sha, "sha-one"); assert.equal(Buffer.from(putBody.content, "base64").toString(), "console.log(2)");
  } finally { globalThis.fetch = originalFetch; }
});

test("GitHub file editor rejects stale SHA versions instead of overwriting remote edits", async () => {
  const { env } = mockEnv(); const originalFetch = globalThis.fetch; let writes = 0;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith("/repos/octocat/demo")) return Response.json({ full_name: "octocat/demo", private: false });
    if (url.includes("/contents/src/app.js?ref=main")) return Response.json({ type: "file", sha: "newer-sha" });
    writes++; return Response.json({ message: "unexpected write" }, { status: 500 });
  };
  try {
    const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/github/files", {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "write", token: "github_pat_" + "A".repeat(40), owner: "octocat", repo: "demo", branch: "main", path: "src/app.js", sha: "old-sha", content: "new source", message: "Update app" })
    });
    const response = await worker.fetch(request, env); const data = await response.json();
    assert.equal(response.status, 409); assert.match(data.error, /changed on GitHub/i); assert.equal(writes, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("Cloudflare Worker editor reads source and deploys with a content-only multipart update", async () => {
  const { env } = mockEnv(); const originalFetch = globalThis.fetch; let uploaded = null;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/workers/scripts/example-worker/content/v2")) return new Response("export default { fetch(){ return new Response('old'); } }", { status: 200 });
    if (url.endsWith("/workers/scripts/example-worker/content") && init.method === "PUT") {
      const multipartRequest = new Request("https://cloudflare.test/upload", { method: "POST", body: init.body });
      const form = await multipartRequest.formData();
      uploaded = { metadata: JSON.parse(await form.get("metadata").text()), source: await form.get("worker.js").text(), type: form.get("worker.js").type };
      return Response.json({ success: true, result: { id: "example-worker" } });
    }
    return Response.json({ success: false, errors: [{ message: "unexpected request" }] }, { status: 500 });
  };
  try {
    const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/cloudflare", {
      method: "POST", headers: { Origin: origin, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "worker_write", token: "cfat_" + "A".repeat(40), accountId: "a".repeat(32), scriptName: "example-worker", expectedContent: "export default { fetch(){ return new Response('old'); } }", content: "export default { fetch(){ return new Response('new'); } }" })
    });
    const response = await worker.fetch(request, env); const data = await response.json();
    assert.equal(response.status, 200); assert.equal(data.ok, true); assert.equal(uploaded.metadata.main_module, "worker.js");
    assert.match(uploaded.source, /Response\('new'\)/); assert.equal(uploaded.type, "application/javascript+module");
  } finally { globalThis.fetch = originalFetch; }
});


test("GitHub file editor blocks secrets and workflow paths", async () => {
  const { env } = mockEnv(); const originalFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  try {
    for (const path of [".env", "secrets.json", ".github/workflows/deploy.yml"]) {
      const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/github/files", {
        method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", token: "", owner: "octocat", repo: "demo", branch: "main", path })
      });
      const response = await worker.fetch(request, env); assert.equal(response.status, 400);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("Cloudflare Worker editor refuses to replace multi-module Workers", async () => {
  const { env } = mockEnv(); const originalFetch = globalThis.fetch; let writes = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/workers/scripts/multi-worker/content/v2")) return new Response('import { helper } from "./helper.js"; export default { fetch(){ return helper(); } };', { status: 200 });
    if (init.method === "PUT") writes++;
    return Response.json({ success: true, result: {} });
  };
  try {
    const request = new Request("https://miniai-api.dallasaristarchos.workers.dev/api/cloudflare", {
      method: "POST", headers: { Origin: origin, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "worker_write", token: "cfat_" + "A".repeat(40), accountId: "a".repeat(32), scriptName: "multi-worker", expectedContent: 'import { helper } from "./helper.js"; export default { fetch(){ return helper(); } };', content: 'import { helper } from "./helper.js"; export default { fetch(){ return helper(); } };' })
    });
    const response = await worker.fetch(request, env); const data = await response.json();
    assert.equal(response.status, 409); assert.match(data.error, /additional local modules/i); assert.equal(writes, 0);
  } finally { globalThis.fetch = originalFetch; }
});


test("FLUX.2 Klein image editing uses the supplied photo and preserves its MIME type", async () => {
  const { env } = mockEnv();
  const calls = [];
  env.AI.run = async (model, input) => {
    calls.push({ model, input });
    if (calls.length === 1) return { response: "Change only the requested background detail." };
    assert.equal(model, "@cf/black-forest-labs/flux-2-klein-4b");
    const form = await new Response(input.multipart.body, { headers: { "content-type": input.multipart.contentType } }).formData();
    assert.equal(form.get("prompt"), "Change only the requested background detail.");
    assert.equal(form.get("width"), "448");
    assert.equal(form.get("height"), "336");
    assert.equal(form.get("input_image_0").type, "image/png");
    assert.equal(form.get("input_image_0").name, "reference-image");
    return { image: "LzlqLzRBQVFTa1pK" };
  };
  const response = await worker.fetch(new Request("https://miniai-api.dallasaristarchos.workers.dev/api/image", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "edit", prompt: "Change only the background detail", image: "data:image/png;base64,iVBORw0KGgo=", width: 448, height: 336 })
  }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).mode, "edit");
  assert.equal(calls.length, 2);
});
