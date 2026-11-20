import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../worker.js", import.meta.url), "utf8");

test("autonomous GitHub edits use a dedicated review branch", () => {
  assert.match(source, /const agentBranch = `miniai\/agent\//);
  assert.match(source, /refs\/heads\/\$\{agentBranch/);
  assert.match(source, /draft: true/);
  assert.match(source, /The base branch was not changed/);
});

test("repository agent keeps secrets and workflow definitions protected", () => {
  assert.match(source, /function safeRepoPath\(path\)/);
  assert.match(source, /\.github\/workflows\//);
  assert.match(source, /credentials\?/);
  assert.match(source, /\.pem/);
});
