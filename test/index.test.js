import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { compareOutput, parseArgs, renderMarkdown, runCli, scanRepository } from "../src/index.js";

test("parseArgs handles path and output options", () => {
  const options = parseArgs(["example", "--out", "AGENTS.md", "--max-files=25", "--no-write", "--check"]);

  assert.equal(options.root, "example");
  assert.equal(options.output, "AGENTS.md");
  assert.equal(options.maxFiles, 25);
  assert.equal(options.write, false);
  assert.equal(options.check, true);
});

test("parseArgs handles target outputs and rejects ambiguous output modes", () => {
  const copilot = parseArgs(["--target", "copilot"]);
  const cursor = parseArgs(["--target=cursor"]);

  assert.equal(copilot.target, "copilot");
  assert.equal(copilot.output, ".github/copilot-instructions.md");
  assert.equal(cursor.target, "cursor");
  assert.equal(cursor.output, ".cursor/rules/agent-rake.mdc");
  assert.throws(
    () => parseArgs(["--target", "agents", "--out", "CUSTOM.md"]),
    /--target cannot be used with --out or --output/
  );
  assert.throws(
    () => parseArgs(["--target", "unknown"]),
    /--target must be one of: agents, claude, codex, copilot, cursor/
  );
});

test("scanRepository detects package scripts, routes, tests, and hotspots", () => {
  const root = makeTempRepo();

  writeFile(root, "package.json", JSON.stringify({
    packageManager: "pnpm@9.0.0",
    workspaces: ["apps/*", "packages/*"],
    dependencies: {
      next: "15.0.0",
      react: "19.0.0",
      hono: "4.0.0"
    },
    devDependencies: {
      vite: "6.0.0"
    },
    scripts: {
      dev: "next dev",
      test: "vitest",
      build: "next build",
      prepublishOnly: "npm test"
    }
  }, null, 2));
  writeFile(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  writeFile(root, "pnpm-workspace.yaml", "packages:\n  - apps/*\n  - packages/*\n");
  writeFile(root, "turbo.json", "{}\n");
  writeFile(root, "src/index.ts", "export const ok = true;\n");
  writeFile(root, "app/dashboard/page.tsx", "export default function Page() { return null; }\n");
  writeFile(root, "app/api/health/route.ts", "export function GET() {}\n");
  writeFile(root, "test/index.test.ts", "test('ok', () => {});\n");
  writeFile(root, "src/auth/token.ts", "export const token = '';\n");
  writeFile(root, "prisma/schema.prisma", "model User { id String @id }\n");
  writeFile(root, "drizzle/0001_initial.sql", "create table users (id text primary key);\n");
  writeFile(root, ".env.example", "API_URL=\n");
  writeFile(root, ".env.local", "SECRET=1\n");
  writeFile(root, ".github/workflows/ci.yml", "name: ci\n");
  writeFile(root, ".npm-cache/cache.js", "const ignored = true;\n");
  writeFile(root, "SECURITY.md", "# Security\n");

  const scan = scanRepository(root);

  assert.equal(scan.packageManager, "pnpm");
  assert.equal(scan.languages.some((item) => item.language === "JavaScript"), false);
  assert.deepEqual(scan.manifests, ["package.json"]);
  assertFrameworks(scan, ["Next.js", "React", "Hono", "Vite"]);
  assertWorkspaces(scan, ["JavaScript workspace", "pnpm workspace", "Turborepo"]);
  assert.ok(scan.commands.some((command) => command.command === "pnpm dev"));
  assert.equal(scan.commands.some((command) => command.command.includes("prepublishOnly")), false);
  assert.ok(scan.routeFiles.includes("app/dashboard/page.tsx"));
  assert.ok(scan.routeFiles.includes("app/api/health/route.ts"));
  assert.ok(scan.testFiles.includes("test/index.test.ts"));
  assert.ok(scan.dataFiles.includes("prisma/schema.prisma"));
  assert.ok(scan.dataFiles.includes("drizzle/0001_initial.sql"));
  assert.ok(scan.hotspotFiles.includes("src/auth/token.ts"));
  assert.equal(scan.hotspotFiles.includes("SECURITY.md"), false);
  assert.ok(scan.envFiles.includes(".env.example"));
  assert.equal(scan.envFiles.includes(".env.local"), false);
  assert.ok(scan.warnings.some((warning) => warning.includes("Secret-looking `.env` files")));
  assert.ok(scan.ciFiles.includes(".github/workflows/ci.yml"));
});

test("renderMarkdown produces a concise brief", () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(root, "src/index.js", "export {};\n");

  const markdown = renderMarkdown(scanRepository(root));

  assert.match(markdown, /# Agent Brief/);
  assert.match(markdown, /Framework signals/);
  assert.match(markdown, /Workspace signals/);
  assert.match(markdown, /Data and schema files/);
  assert.match(markdown, /Commands Agents Should Prefer/);
  assert.match(markdown, /npm test/);
  assert.match(markdown, /src\/index\.js/);
});

test("scanRepository detects non-JavaScript framework and workspace signals from manifests", () => {
  const root = makeTempRepo();

  writeFile(root, "requirements.txt", "fastapi==0.115.0\n");
  writeFile(root, "go.mod", "module example.com/app\n\nrequire github.com/gin-gonic/gin v1.10.0\n");
  writeFile(root, "Cargo.toml", "[workspace]\nmembers = [\"crates/api\"]\n\n[dependencies]\naxum = \"0.7\"\n");
  writeFile(root, "Gemfile", "source 'https://rubygems.org'\ngem 'rails'\n");
  writeFile(root, "pubspec.yaml", "name: app\nworkspace:\n  - packages/core\nflutter:\n  uses-material-design: true\n");
  writeFile(root, "config/routes.rb", "Rails.application.routes.draw do\nend\n");
  writeFile(root, "db/migrate/20260101010101_create_users.rb", "class CreateUsers < ActiveRecord::Migration[7.0]\nend\n");
  writeFile(root, "database/migrations/2026_01_01_000000_create_users.php", "<?php\n");
  writeFile(root, "alembic/versions/001_create_users.py", "revision = '001'\n");
  writeFile(root, "go.work", "go 1.22\n");

  const scan = scanRepository(root);

  assertFrameworks(scan, ["FastAPI", "Gin", "Axum", "Rails", "Flutter"]);
  assertWorkspaces(scan, ["Cargo workspace", "Go workspace", "Dart pub workspace"]);
  assert.ok(scan.routeFiles.includes("config/routes.rb"));
  assert.ok(scan.dataFiles.includes("db/migrate/20260101010101_create_users.rb"));
  assert.ok(scan.dataFiles.includes("database/migrations/2026_01_01_000000_create_users.php"));
  assert.ok(scan.dataFiles.includes("alembic/versions/001_create_users.py"));
  assert.ok(scan.configFiles.includes("go.work"));
});

test("scanRepository detects bounded backend route declarations in likely entrypoints", () => {
  const root = makeTempRepo();

  writeFile(root, "package.json", JSON.stringify({
    dependencies: {
      express: "4.19.0",
      hono: "4.0.0"
    }
  }, null, 2));
  writeFile(root, "requirements.txt", "fastapi==0.115.0\nflask==3.0.0\n");
  writeFile(root, "server.js", "const express = require('express');\nconst app = express();\napp.get('/health', handler);\n");
  writeFile(root, "src/index.ts", "import { Hono } from 'hono';\nconst app = new Hono();\napp.post('/orders', handler);\n");
  writeFile(root, "main.py", "from fastapi import FastAPI\napp = FastAPI()\n@app.get('/health')\ndef health(): pass\n");
  writeFile(root, "app.py", "from flask import Flask\napp = Flask(__name__)\n@app.route('/status')\ndef status(): pass\n");
  writeFile(root, "src/random.ts", "const value = get('/not-a-route');\n");
  writeFile(root, "test/server.test.js", "app.get('/test-only', handler);\n");

  const scan = scanRepository(root);

  assert.ok(scan.routeFiles.includes("server.js"));
  assert.ok(scan.routeFiles.includes("src/index.ts"));
  assert.ok(scan.routeFiles.includes("main.py"));
  assert.ok(scan.routeFiles.includes("app.py"));
  assert.equal(scan.routeFiles.includes("src/random.ts"), false);
  assert.equal(scan.routeFiles.includes("test/server.test.js"), false);
});

test("renderMarkdown is deterministic for stale brief checks", () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));

  const first = renderMarkdown(scanRepository(root));
  const second = renderMarkdown(scanRepository(root));

  assert.equal(first, second);
  assert.doesNotMatch(first, /Generated by agent-rake .* on /);
  assert.doesNotMatch(first, new RegExp(escapeRegExp(root)));
});

test("renderMarkdown does not include machine-specific absolute roots", () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));

  const markdown = renderMarkdown(scanRepository(root));

  assert.match(markdown, /- Root: `agent-rake-[^`]+`/);
  assert.doesNotMatch(markdown, /D:\\|\/home\/runner|\//);
});

test("compareOutput detects missing, current, and stale briefs", () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));

  const outputPath = path.join(root, "AGENT_BRIEF.md");
  const markdown = renderMarkdown(scanRepository(root));

  assert.deepEqual(compareOutput(markdown, outputPath), { ok: false, reason: "missing" });

  fs.writeFileSync(outputPath, markdown.replace(/\n/g, "\r\n"), "utf8");
  assert.deepEqual(compareOutput(markdown, outputPath), { ok: true, reason: "current" });

  fs.writeFileSync(outputPath, "stale\n", "utf8");
  assert.deepEqual(compareOutput(markdown, outputPath), { ok: false, reason: "stale" });
});

test("runCli writes nested target outputs and checks them without self-reference drift", async () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));

  const writeIo = makeIo();
  await runCli(["--root", root, "--target", "copilot", "--quiet"], writeIo);

  const outputPath = path.join(root, ".github", "copilot-instructions.md");
  assert.ok(fs.existsSync(outputPath));
  assert.match(fs.readFileSync(outputPath, "utf8"), /# Agent Brief/);

  const checkIo = makeIo();
  await runCli(["--root", root, "--target", "copilot", "--check"], checkIo);

  assert.equal(checkIo.exitCode ?? 0, 0);
  assert.match(checkIo.stdout.text, /\.github[/\\]copilot-instructions\.md is current\./);
});

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-rake-"));
}

function writeFile(root, relative, content) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeIo() {
  return {
    stdout: makeWritableBuffer(),
    stderr: makeWritableBuffer(),
    exitCode: 0
  };
}

function makeWritableBuffer() {
  return {
    text: "",
    write(value) {
      this.text += value;
    }
  };
}

function assertFrameworks(scan, expectedNames) {
  const names = scan.frameworks.map((item) => item.name);

  for (const expected of expectedNames) {
    assert.ok(names.includes(expected), `expected framework signal ${expected}`);
  }
}

function assertWorkspaces(scan, expectedNames) {
  const names = scan.workspaces.map((item) => item.name);

  for (const expected of expectedNames) {
    assert.ok(names.includes(expected), `expected workspace signal ${expected}`);
  }
}
