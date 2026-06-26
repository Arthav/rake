import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { applyRepositoryConfig, compareOutput, installGitHubActionsWorkflow, installRepositoryConfig, parseArgs, renderCompletion, renderConfigExample, renderDoctor, renderGitHubActionsWorkflow, renderMarkdown, renderOutputDiff, renderSummary, renderTargets, runCli, scanRepository } from "../src/index.js";

test("parseArgs handles path and output options", () => {
  const options = parseArgs(["example", "--out", "AGENTS.md", "--max-files=25", "--config", "rake.json", "--ignore", "fixtures", "--ignore=src\\generated\\", "--no-write", "--check"]);

  assert.equal(options.root, "example");
  assert.equal(options.output, "AGENTS.md");
  assert.equal(options.outputWasSet, true);
  assert.equal(options.maxFiles, 25);
  assert.equal(options.maxFilesWasSet, true);
  assert.equal(options.configPath, "rake.json");
  assert.deepEqual(options.customIgnores, ["fixtures", "src/generated"]);
  assert.equal(options.write, false);
  assert.equal(options.check, true);
  assert.equal(parseArgs(["--no-config"]).config, false);
  assert.throws(
    () => parseArgs(["--ignore", " "]),
    /--ignore requires a non-empty path or name/
  );
});

test("parseArgs handles target outputs and rejects ambiguous output modes", () => {
  const copilot = parseArgs(["--target", "copilot"]);
  const cursor = parseArgs(["--target=cursor"]);
  const allTargets = parseArgs(["--target", "all"]);
  const explain = parseArgs(["--why", "--no-write"]);
  const dryRun = parseArgs(["--dry-run"]);
  const summary = parseArgs(["--stats"]);
  const targets = parseArgs(["--list-targets"]);
  const strict = parseArgs(["--fail-on-warnings"]);
  const diff = parseArgs(["--diff"]);
  const doctor = parseArgs(["--health"]);
  const githubActions = parseArgs(["--ci-workflow"]);
  const installGitHubActions = parseArgs(["--install-github-actions", "--force"]);
  const configExample = parseArgs(["--print-config"]);
  const initConfig = parseArgs(["--init-config"]);
  const showConfig = parseArgs(["--effective-config"]);
  const completion = parseArgs(["--completion", "bash"]);
  const completionPowerShell = parseArgs(["--completion", "PowerShell"]);
  const setup = parseArgs(["--setup"]);

  assert.equal(copilot.target, "copilot");
  assert.equal(copilot.output, ".github/copilot-instructions.md");
  assert.equal(cursor.target, "cursor");
  assert.equal(cursor.output, ".cursor/rules/agent-rake.mdc");
  assert.equal(allTargets.target, "all");
  assert.deepEqual(allTargets.output, [
    "AGENTS.md",
    "CLAUDE.md",
    "CODEX.md",
    ".github/copilot-instructions.md",
    ".cursor/rules/agent-rake.mdc"
  ]);
  assert.equal(explain.explain, true);
  assert.equal(explain.write, false);
  assert.equal(dryRun.write, false);
  assert.equal(dryRun.printWasSet, true);
  assert.equal(summary.summary, true);
  assert.equal(summary.write, false);
  assert.equal(targets.targets, true);
  assert.equal(targets.write, false);
  assert.equal(strict.strict, true);
  assert.equal(diff.diff, true);
  assert.equal(diff.check, true);
  assert.equal(diff.write, false);
  assert.equal(doctor.doctor, true);
  assert.equal(doctor.write, false);
  assert.equal(githubActions.githubActions, true);
  assert.equal(githubActions.write, false);
  assert.equal(installGitHubActions.installGitHubActions, true);
  assert.equal(installGitHubActions.force, true);
  assert.equal(installGitHubActions.write, false);
  assert.equal(configExample.configExample, true);
  assert.equal(configExample.write, false);
  assert.equal(initConfig.initConfig, true);
  assert.equal(initConfig.write, false);
  assert.equal(showConfig.showConfig, true);
  assert.equal(showConfig.write, false);
  assert.equal(completion.completion, "bash");
  assert.equal(completion.write, false);
  assert.equal(completionPowerShell.completion, "powershell");
  assert.equal(completionPowerShell.write, false);
  assert.equal(setup.setup, true);
  assert.equal(setup.write, false);
  assert.equal(parseArgs(["--init-config", "--target", "all"]).target, "all");
  assert.equal(parseArgs(["--init-config", "--out", "CONTEXT.md"]).output, "CONTEXT.md");
  assert.equal(parseArgs(["--setup", "--target", "all"]).target, "all");
  assert.equal(parseArgs(["--setup", "--out", "CONTEXT.md"]).output, "CONTEXT.md");
  assert.equal(parseArgs(["--setup", "--max-files", "50"]).maxFiles, 50);
  assert.deepEqual(parseArgs(["--setup", "--ignore", "fixtures"]).customIgnores, ["fixtures"]);
  assert.throws(
    () => parseArgs(["--target", "agents", "--out", "CUSTOM.md"]),
    /--target cannot be used with --out or --output/
  );
  assert.throws(
    () => parseArgs(["--summary", "--out", "SUMMARY.md"]),
    /--summary cannot be used with --out or --output/
  );
  assert.throws(
    () => parseArgs(["--summary", "--target", "agents"]),
    /--summary cannot be used with --target/
  );
  assert.throws(
    () => parseArgs(["--targets", "--out", "AGENTS.md"]),
    /--targets cannot be used with --out or --output/
  );
  assert.throws(
    () => parseArgs(["--targets", "--target", "agents"]),
    /--targets cannot be used with --target/
  );
  assert.throws(
    () => parseArgs(["--github-actions", "--out", ".github/workflows/agent-rake.yml"]),
    /--github-actions cannot be used with --out or --output/
  );
  assert.throws(
    () => parseArgs(["--github-actions", "--target", "agents"]),
    /--github-actions cannot be used with --target/
  );
  assert.throws(
    () => parseArgs(["--install-github-actions", "--out", ".github/workflows/agent-rake.yml"]),
    /--install-github-actions cannot be used with --out or --output/
  );
  assert.throws(
    () => parseArgs(["--install-github-actions", "--target", "agents"]),
    /--install-github-actions cannot be used with --target/
  );
  assert.throws(
    () => parseArgs(["--config-example", "--out", ".agent-rake.json"]),
    /--config-example cannot be used with --out or --output/
  );
  assert.throws(
    () => parseArgs(["--config-example", "--target", "agents"]),
    /--config-example cannot be used with --target/
  );
  assert.throws(
    () => parseArgs(["--setup", "--no-write"]),
    /--setup cannot be used with --no-write, --print, or --dry-run/
  );
  assert.throws(
    () => parseArgs(["--setup", "--no-config"]),
    /--setup cannot be used with --no-config/
  );
  assert.throws(
    () => parseArgs(["--target", "unknown"]),
    /--target must be one of: agents, claude, codex, copilot, cursor, all/
  );
  assert.throws(
    () => parseArgs(["--completion", "nu"]),
    /--completion must be one of: bash, zsh, fish, powershell/
  );
});

test("renderTargets lists known agent instruction outputs", () => {
  const output = renderTargets();

  assert.match(output, /^agent-rake targets/);
  assert.match(output, /Use with: agent-rake --target <name>/);
  assert.match(output, /agents\s+AGENTS\.md/);
  assert.match(output, /claude\s+CLAUDE\.md/);
  assert.match(output, /copilot\s+\.github\/copilot-instructions\.md/);
  assert.match(output, /cursor\s+\.cursor\/rules\/agent-rake\.mdc/);
  assert.match(output, /all\s+all known target outputs/);
});

test("renderCompletion prints shell completion scripts", () => {
  const bash = renderCompletion("bash");
  const zsh = renderCompletion("zsh");
  const fish = renderCompletion("fish");
  const powershell = renderCompletion("powershell");

  assert.match(bash, /complete -F _agent_rake_completion agent-rake/);
  assert.match(bash, /--show-config/);
  assert.match(bash, /agents claude codex copilot cursor all/);
  assert.match(bash, /--root\|--out\|--config\|--ignore/);
  assert.match(zsh, /^#compdef agent-rake/);
  assert.match(zsh, /--completion\[Print shell completion script\]/);
  assert.match(zsh, /--ignore\[Ignore path or segment\]:path:_files/);
  assert.match(fish, /complete -c agent-rake -l completion -r -a 'bash zsh fish powershell'/);
  assert.match(fish, /complete -c agent-rake -l ignore -r -F/);
  assert.match(powershell, /Register-ArgumentCompleter -Native -CommandName agent-rake/);
  assert.match(powershell, /\$shells = @\('bash', 'zsh', 'fish', 'powershell'\)/);
  assert.match(powershell, /"--root", "--out", "--config", "--ignore"/);
});

test("renderGitHubActionsWorkflow prints a ready CI workflow", () => {
  const workflow = renderGitHubActionsWorkflow();

  assert.match(workflow, /^name: agent-rake/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /actions\/checkout@v4/);
  assert.match(workflow, /actions\/setup-node@v4/);
  assert.match(workflow, /node-version: 20/);
  assert.match(workflow, /npx agent-rake --diff --strict/);
});

test("installGitHubActionsWorkflow writes safely and requires force to overwrite", () => {
  const root = makeTempRepo();

  const outputPath = installGitHubActionsWorkflow(root);

  assert.equal(outputPath, path.join(root, ".github", "workflows", "agent-rake.yml"));
  assert.match(fs.readFileSync(outputPath, "utf8"), /npx agent-rake --diff --strict/);
  assert.throws(
    () => installGitHubActionsWorkflow(root),
    /\.github\/workflows\/agent-rake\.yml already exists/
  );

  fs.writeFileSync(outputPath, "stale\n", "utf8");
  installGitHubActionsWorkflow(root, { force: true });

  assert.match(fs.readFileSync(outputPath, "utf8"), /^name: agent-rake/);
});

test("renderConfigExample and installRepositoryConfig provide safe config bootstrap", () => {
  const root = makeTempRepo();
  const example = JSON.parse(renderConfigExample());

  assert.deepEqual(example.ignore, ["fixtures", "src/generated"]);
  assert.equal(example.maxFiles, 3000);
  assert.equal(example.output, "AGENT_BRIEF.md");

  const outputPath = installRepositoryConfig(root);

  assert.equal(outputPath, path.join(root, ".agent-rake.json"));
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, "utf8")), example);
  assert.throws(
    () => installRepositoryConfig(root),
    /\.agent-rake\.json already exists/
  );

  fs.writeFileSync(outputPath, "{\"ignore\":[]}\n", "utf8");
  installRepositoryConfig(root, { force: true });

  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, "utf8")), example);

  const customPath = installRepositoryConfig(root, { configPath: "config/agent-rake.json" });

  assert.equal(customPath, path.join(root, "config", "agent-rake.json"));
  assert.deepEqual(JSON.parse(fs.readFileSync(customPath, "utf8")), example);
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
  writeFile(root, "RELEASE.md", "# Release\n");
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
  assert.ok(scan.docs.includes("RELEASE.md"));
});

test("scanRepository detects Bun and Deno lockfiles", () => {
  const bunRoot = makeTempRepo();
  writeFile(bunRoot, "package.json", JSON.stringify({ scripts: { test: "bun test" } }, null, 2));
  writeFile(bunRoot, "bun.lock", "\n");
  writeFile(bunRoot, "AGENTS.md", "# Agent Instructions\n");
  writeFile(bunRoot, "src/index.ts", "export {};\n");

  const bunScan = scanRepository(bunRoot);

  assert.equal(bunScan.packageManager, "bun");
  assert.ok(bunScan.lockFiles.includes("bun.lock"));
  assert.ok(bunScan.commands.some((command) => command.command === "bun run test"));
  assert.equal(bunScan.warnings.some((warning) => warning.includes("JavaScript lockfile")), false);

  const denoRoot = makeTempRepo();
  writeFile(denoRoot, "deno.json", "{}\n");
  writeFile(denoRoot, "deno.lock", "{}\n");
  writeFile(denoRoot, "AGENTS.md", "# Agent Instructions\n");
  writeFile(denoRoot, "main.ts", "export {};\n");

  const denoScan = scanRepository(denoRoot);

  assert.equal(denoScan.packageManager, "deno");
  assert.ok(denoScan.lockFiles.includes("deno.lock"));
  assert.deepEqual(denoScan.manifests, ["deno.json"]);
});

test("scanRepository infers Python test commands from Django and package manager signals", () => {
  const djangoRoot = makeTempRepo();
  writeFile(djangoRoot, "requirements.txt", "django==5.0.0\n");
  writeFile(djangoRoot, "manage.py", "#!/usr/bin/env python\n");
  writeFile(djangoRoot, "app/settings.py", "SECRET_KEY = 'test'\n");

  const djangoScan = scanRepository(djangoRoot);

  assertFrameworks(djangoScan, ["Django"]);
  assert.ok(djangoScan.commands.some((command) => command.command === "python manage.py test"));
  assert.ok(djangoScan.configFiles.includes("app/settings.py"));

  const uvDjangoRoot = makeTempRepo();
  writeFile(uvDjangoRoot, "requirements.txt", "django==5.0.0\n");
  writeFile(uvDjangoRoot, "uv.lock", "{}\n");
  writeFile(uvDjangoRoot, "manage.py", "#!/usr/bin/env python\n");

  const uvDjangoScan = scanRepository(uvDjangoRoot);

  assert.equal(uvDjangoScan.packageManager, "uv");
  assert.ok(uvDjangoScan.commands.some((command) => command.command === "uv run python manage.py test"));

  const poetryRoot = makeTempRepo();
  writeFile(poetryRoot, "pyproject.toml", "[project]\nname = \"api\"\n");
  writeFile(poetryRoot, "poetry.lock", "# lock\n");

  const poetryScan = scanRepository(poetryRoot);

  assert.equal(poetryScan.packageManager, "poetry");
  assert.ok(poetryScan.commands.some((command) => command.command === "poetry run pytest"));

  const pipenvRoot = makeTempRepo();
  writeFile(pipenvRoot, "Pipfile", "[packages]\npytest = \"*\"\n");
  writeFile(pipenvRoot, "Pipfile.lock", "{}\n");

  const pipenvScan = scanRepository(pipenvRoot);

  assert.equal(pipenvScan.packageManager, "pipenv");
  assert.ok(pipenvScan.manifests.includes("Pipfile"));
  assert.ok(pipenvScan.commands.some((command) => command.command === "pipenv run pytest"));
});

test("scanRepository infers common task runner commands from bounded task files", () => {
  const root = makeTempRepo();
  writeFile(root, "Makefile", [
    "IMAGE := agent-rake",
    ".PHONY: test lint private-task",
    "test lint: ## common checks",
    "\tnode --test",
    "private-task:",
    "\techo skip"
  ].join("\n"));
  writeFile(root, "justfile", [
    "set shell := [\"bash\", \"-cu\"]",
    "build:",
    "  npm run build",
    "_private:",
    "  echo skip"
  ].join("\n"));
  writeFile(root, "Taskfile.yml", [
    "version: '3'",
    "tasks:",
    "  check:",
    "    cmds:",
    "      - npm test",
    "  release:",
    "    cmds:",
    "      - npm pack",
    "vars:",
    "  name: agent-rake"
  ].join("\n"));

  const scan = scanRepository(root);

  assert.ok(scan.commands.some((command) => command.command === "make test"));
  assert.ok(scan.commands.some((command) => command.command === "make lint"));
  assert.ok(scan.commands.some((command) => command.command === "just build"));
  assert.ok(scan.commands.some((command) => command.command === "task check"));
  assert.ok(scan.commands.some((command) => command.command === "task release"));
  assert.equal(scan.commands.some((command) => command.command.includes("private")), false);
  assert.equal(scan.commands.some((command) => command.command.includes("IMAGE")), false);
  assert.ok(scan.configFiles.includes("Makefile"));
  assert.ok(scan.configFiles.includes("justfile"));
  assert.ok(scan.configFiles.includes("Taskfile.yml"));
});

test("scanRepository applies repeatable custom ignores without reading file contents", () => {
  const root = makeTempRepo();

  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(root, "package-lock.json", "{}\n");
  writeFile(root, "AGENTS.md", "# Agent Instructions\n");
  writeFile(root, "src/index.js", "export {};\n");
  writeFile(root, "src/generated/auth-token.ts", "export const token = '';\n");
  writeFile(root, "fixtures/payment/webhook.ts", "export const stripe = '';\n");
  writeFile(root, "nested/fixtures/seed.sql", "select 1;\n");

  const scan = scanRepository(root, { customIgnores: ["fixtures", "src/generated", "src/generated"] });

  assert.deepEqual(scan.customIgnores, ["fixtures", "src/generated"]);
  assert.equal(scan.filesScanned, 4);
  assert.equal(scan.languages[0].language, "JavaScript");
  assert.equal(scan.languages[0].files, 1);
  assert.equal(scan.hotspotFiles.includes("src/generated/auth-token.ts"), false);
  assert.equal(scan.hotspotFiles.includes("fixtures/payment/webhook.ts"), false);
  assert.equal(scan.dataFiles.includes("nested/fixtures/seed.sql"), false);
});

test("scanRepository loads agent-rake config with CLI precedence", () => {
  const root = makeTempRepo();

  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(root, "package-lock.json", "{}\n");
  writeFile(root, "AGENTS.md", "# Agent Instructions\n");
  writeFile(root, "src/index.js", "export {};\n");
  writeFile(root, "fixtures/auth-token.ts", "export const token = '';\n");
  writeFile(root, ".agent-rake.json", JSON.stringify({
    ignore: "fixtures",
    maxFiles: 5,
    output: "CONTEXT.md"
  }, null, 2));

  const scan = scanRepository(root);

  assert.equal(scan.configFile, ".agent-rake.json");
  assert.ok(scan.configFiles.includes(".agent-rake.json"));
  assert.deepEqual(scan.customIgnores, ["fixtures"]);
  assert.equal(scan.hotspotFiles.includes("fixtures/auth-token.ts"), false);

  const merged = applyRepositoryConfig(root, {
    output: "CUSTOM.md",
    outputWasSet: true,
    maxFiles: 25,
    maxFilesWasSet: true,
    customIgnores: ["extra"]
  });

  assert.equal(merged.output, "CUSTOM.md");
  assert.equal(merged.maxFiles, 25);
  assert.deepEqual(merged.customIgnores, ["fixtures", "extra"]);

  const noConfigScan = scanRepository(root, { config: false });

  assert.equal(noConfigScan.configFile, null);
  assert.equal(noConfigScan.hotspotFiles.includes("fixtures/auth-token.ts"), true);
});

test("agent-rake config validates supported keys and target output", async () => {
  const root = makeTempRepo();

  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(root, "package-lock.json", "{}\n");
  writeFile(root, "AGENTS.md", "# Agent Instructions\n");
  writeFile(root, "src/index.js", "export {};\n");
  writeFile(root, "rake.config.json", JSON.stringify({ target: "cursor", ignore: ["fixtures"] }, null, 2));

  const io = makeIo();
  await runCli(["--root", root, "--config", "rake.config.json", "--quiet"], io);

  assert.ok(fs.existsSync(path.join(root, ".cursor", "rules", "agent-rake.mdc")));

  writeFile(root, "bad.config.json", JSON.stringify({ surprise: true }, null, 2));
  assert.throws(
    () => scanRepository(root, { configPath: "bad.config.json" }),
    /bad\.config\.json has unsupported key: surprise/
  );

  writeFile(root, "both.config.json", JSON.stringify({ target: "agents", output: "AGENTS.md" }, null, 2));
  assert.throws(
    () => scanRepository(root, { configPath: "both.config.json" }),
    /both\.config\.json cannot define both target and output/
  );
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
  assert.doesNotMatch(markdown, /Why These Signals/);
});

test("renderSummary produces a compact scan overview", () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({
    dependencies: { express: "4.19.0" },
    scripts: { test: "node --test", build: "node build.js" }
  }, null, 2));
  writeFile(root, "package-lock.json", "{}\n");
  writeFile(root, "AGENTS.md", "# Agent Instructions\n");
  writeFile(root, "server.js", "const express = require('express');\nconst app = express();\napp.get('/health', handler);\n");
  writeFile(root, "test/index.test.js", "test('ok', () => {});\n");

  const summary = renderSummary(scanRepository(root));

  assert.match(summary, /^agent-rake summary for `agent-rake-/);
  assert.match(summary, /Status: no scan warnings/);
  assert.match(summary, /Framework signals: `Express`/);
  assert.match(summary, /Commands: `npm test`, `npm run build`/);
  assert.match(summary, /First-read files: 1 entrypoints, 1 routes\/APIs, 1 tests/);
  assert.match(summary, /Risk hotspots: none detected/);
  assert.doesNotMatch(summary, /# Agent Brief/);
  assert.doesNotMatch(summary, new RegExp(escapeRegExp(root)));

  const ignoredSummary = renderSummary(scanRepository(root, { customIgnores: ["test"] }));
  assert.match(ignoredSummary, /Custom ignores: `test`/);
});

test("renderDoctor gives actionable health checks", () => {
  const warningRoot = makeTempRepo();
  writeFile(warningRoot, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(warningRoot, "Cargo.lock", "# unrelated lockfile\n");
  writeFile(warningRoot, ".env.local", "SECRET=1\n");
  writeFile(warningRoot, "src/index.js", "export {};\n");

  const warningDoctor = renderDoctor(scanRepository(warningRoot));

  assert.match(warningDoctor, /^agent-rake doctor for `agent-rake-/);
  assert.match(warningDoctor, /Status: \d+ warnings need review/);
  assert.match(warningDoctor, /\[warn\] JavaScript lockfile/);
  assert.match(warningDoctor, /Commit the JavaScript lockfile/);
  assert.match(warningDoctor, /\[warn\] Agent instructions/);
  assert.match(warningDoctor, /Create repo instructions with `agent-rake --target agents`/);
  assert.match(warningDoctor, /\[warn\] Environment hygiene/);
  assert.match(warningDoctor, /add a safe `.env\.example`/);

  const cleanRoot = makeTempRepo();
  writeFile(cleanRoot, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(cleanRoot, "package-lock.json", "{}\n");
  writeFile(cleanRoot, "AGENTS.md", "# Agent Instructions\n");
  writeFile(cleanRoot, "src/index.js", "export {};\n");

  const cleanDoctor = renderDoctor(scanRepository(cleanRoot));

  assert.match(cleanDoctor, /Status: no scan warnings/);
  assert.match(cleanDoctor, /\[ok\] Manifest: `package\.json`/);
  assert.match(cleanDoctor, /\[ok\] JavaScript lockfile: `package-lock\.json`/);
  assert.match(cleanDoctor, /Useful next commands:/);

  const noPackageRoot = makeTempRepo();
  writeFile(noPackageRoot, "main.py", "print('ok')\n");
  writeFile(noPackageRoot, "AGENTS.md", "# Agent Instructions\n");

  const noPackageDoctor = renderDoctor(scanRepository(noPackageRoot));

  assert.match(noPackageDoctor, /\[ok\] JavaScript lockfile: no package\.json manifest detected; check skipped/);
});

test("renderMarkdown explains detected commands, signals, and files when requested", () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({
    dependencies: { express: "4.19.0" },
    scripts: { test: "node --test" }
  }, null, 2));
  writeFile(root, "server.js", "const express = require('express');\nconst app = express();\napp.get('/health', handler);\n");
  writeFile(root, "prisma/schema.prisma", "model User { id String @id }\n");

  const scan = scanRepository(root, { explain: true });
  const markdown = renderMarkdown(scan);

  assert.match(markdown, /## Why These Signals/);
  assert.match(markdown, /Command `npm test`: package\.json script: node --test/);
  assert.match(markdown, /Framework signal `Express`: package\.json dependency: express/);
  assert.match(markdown, /Routes and APIs `server\.js`: bounded route declaration found in a likely entrypoint file/);
  assert.match(markdown, /Data and schema file `prisma\/schema\.prisma`: Prisma schema path/);
});

test("runCli prints explanation data in JSON only when requested", async () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));

  const defaultIo = makeIo();
  await runCli(["--root", root, "--json"], defaultIo);
  const defaultJson = JSON.parse(defaultIo.stdout.text);

  const explainIo = makeIo();
  await runCli(["--root", root, "--json", "--explain"], explainIo);
  const explainJson = JSON.parse(explainIo.stdout.text);

  assert.equal(Object.hasOwn(defaultJson, "explanations"), false);
  assert.equal(explainJson.explain, true);
  assert.ok(explainJson.explanations.some((item) => item.category === "Command" && item.item === "npm test"));
});

test("runCli passes custom ignores into JSON and Markdown output", async () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(root, "package-lock.json", "{}\n");
  writeFile(root, "AGENTS.md", "# Agent Instructions\n");
  writeFile(root, "src/index.js", "export {};\n");
  writeFile(root, "fixtures/auth-token.ts", "export const token = '';\n");

  const jsonIo = makeIo();
  await runCli(["--root", root, "--json", "--ignore", "fixtures"], jsonIo);
  const json = JSON.parse(jsonIo.stdout.text);

  assert.deepEqual(json.customIgnores, ["fixtures"]);
  assert.equal(json.hotspotFiles.includes("fixtures/auth-token.ts"), false);

  const markdownIo = makeIo();
  await runCli(["--root", root, "--no-write", "--ignore=fixtures"], markdownIo);

  assert.match(markdownIo.stdout.text, /- Custom ignores: `fixtures`/);
  assert.doesNotMatch(markdownIo.stdout.text, /fixtures\/auth-token\.ts/);
});

test("runCli prints compact summaries and rejects incompatible output modes", async () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));

  const summaryIo = makeIo();
  await runCli(["--root", root, "--summary"], summaryIo);

  assert.match(summaryIo.stdout.text, /agent-rake summary for `agent-rake-/);
  assert.match(summaryIo.stdout.text, /Commands: `npm test`/);
  assert.doesNotMatch(summaryIo.stdout.text, /# Agent Brief/);

  await assert.rejects(
    () => runCli(["--root", root, "--summary", "--json"], makeIo()),
    /--summary cannot be used with --json/
  );
  await assert.rejects(
    () => runCli(["--root", root, "--summary", "--check"], makeIo()),
    /--summary cannot be used with --check/
  );
  await assert.rejects(
    () => runCli(["--root", root, "--summary", "--diff"], makeIo()),
    /--summary cannot be used with --diff/
  );
});

test("runCli lists targets without scanning a repository", async () => {
  const io = makeIo();
  const missingRoot = path.join(os.tmpdir(), `agent-rake-missing-root-${process.pid}-${Date.now()}`);

  await runCli(["--root", missingRoot, "--targets"], io);

  assert.match(io.stdout.text, /agent-rake targets/);
  assert.match(io.stdout.text, /codex\s+CODEX\.md/);
  assert.equal(io.exitCode ?? 0, 0);

  await assert.rejects(
    () => runCli(["--targets", "--summary"], makeIo()),
    /--targets cannot be used with --summary/
  );
  await assert.rejects(
    () => runCli(["--targets", "--diff"], makeIo()),
    /--targets cannot be used with --diff/
  );
  await assert.rejects(
    () => runCli(["--targets", "--strict"], makeIo()),
    /--targets cannot be used with --strict/
  );
});

test("runCli prints completions without scanning a repository", async () => {
  const io = makeIo();
  const missingRoot = path.join(os.tmpdir(), `agent-rake-missing-root-${process.pid}-${Date.now()}`);

  await runCli(["--root", missingRoot, "--completion", "bash"], io);

  assert.match(io.stdout.text, /_agent_rake_completion/);
  assert.match(io.stdout.text, /--target/);
  assert.equal(io.stderr.text, "");
  assert.equal(io.exitCode ?? 0, 0);

  const powershellIo = makeIo();
  await runCli(["--root", missingRoot, "--completion", "powershell"], powershellIo);

  assert.match(powershellIo.stdout.text, /Register-ArgumentCompleter -Native -CommandName agent-rake/);
  assert.match(powershellIo.stdout.text, /--completion/);
  assert.equal(powershellIo.stderr.text, "");
  assert.equal(powershellIo.exitCode ?? 0, 0);

  await assert.rejects(
    () => runCli(["--completion", "bash", "--json"], makeIo()),
    /--completion cannot be used with --json/
  );
  await assert.rejects(
    () => runCli(["--completion", "bash", "--target", "agents"], makeIo()),
    /--completion cannot be used with --target/
  );
});

test("runCli prints GitHub Actions workflow without scanning a repository", async () => {
  const io = makeIo();
  const missingRoot = path.join(os.tmpdir(), `agent-rake-missing-root-${process.pid}-${Date.now()}`);

  await runCli(["--root", missingRoot, "--github-actions"], io);

  assert.match(io.stdout.text, /name: agent-rake/);
  assert.match(io.stdout.text, /npx agent-rake --diff --strict/);
  assert.equal(io.stderr.text, "");
  assert.equal(io.exitCode ?? 0, 0);

  await assert.rejects(
    () => runCli(["--github-actions", "--diff"], makeIo()),
    /--github-actions cannot be used with --check or --diff/
  );
  await assert.rejects(
    () => runCli(["--github-actions", "--json"], makeIo()),
    /--github-actions cannot be used with --json/
  );
});

test("runCli installs GitHub Actions workflow safely", async () => {
  const root = makeTempRepo();
  const outputPath = path.join(root, ".github", "workflows", "agent-rake.yml");

  const installIo = makeIo();
  await runCli(["--root", root, "--install-github-actions"], installIo);

  assert.equal(installIo.exitCode ?? 0, 0);
  assert.match(installIo.stdout.text, /\.github[/\\]workflows[/\\]agent-rake\.yml/);
  assert.match(fs.readFileSync(outputPath, "utf8"), /npx agent-rake --diff --strict/);

  await assert.rejects(
    () => runCli(["--root", root, "--install-github-actions"], makeIo()),
    /already exists\. Re-run with --force/
  );

  fs.writeFileSync(outputPath, "stale\n", "utf8");
  const forceIo = makeIo();
  await runCli(["--root", root, "--install-github-actions", "--force", "--quiet"], forceIo);

  assert.equal(forceIo.stdout.text, "");
  assert.match(fs.readFileSync(outputPath, "utf8"), /^name: agent-rake/);

  await assert.rejects(
    () => runCli(["--install-github-actions", "--json"], makeIo()),
    /--install-github-actions cannot be used with --json/
  );
  await assert.rejects(
    () => runCli(["--install-github-actions", "--diff"], makeIo()),
    /--install-github-actions cannot be used with --check or --diff/
  );
  await assert.rejects(
    () => runCli(["--install-github-actions", "--doctor"], makeIo()),
    /--install-github-actions cannot be used with --doctor/
  );
});

test("runCli prints and installs config safely", async () => {
  const exampleIo = makeIo();
  await runCli(["--config-example"], exampleIo);

  assert.deepEqual(JSON.parse(exampleIo.stdout.text).ignore, ["fixtures", "src/generated"]);
  assert.equal(exampleIo.stderr.text, "");

  const root = makeTempRepo();
  const outputPath = path.join(root, ".agent-rake.json");
  const initIo = makeIo();
  await runCli(["--root", root, "--init-config"], initIo);

  assert.match(initIo.stdout.text, /\.agent-rake\.json/);
  assert.ok(fs.existsSync(outputPath));

  await assert.rejects(
    () => runCli(["--root", root, "--init-config"], makeIo()),
    /\.agent-rake\.json already exists\. Re-run with --force/
  );

  fs.writeFileSync(outputPath, "{\"ignore\":[]}\n", "utf8");
  const forceIo = makeIo();
  await runCli(["--root", root, "--init-config", "--force", "--quiet"], forceIo);

  assert.equal(forceIo.stdout.text, "");
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, "utf8")).ignore, ["fixtures", "src/generated"]);

  const customIo = makeIo();
  await runCli(["--root", root, "--config", "config/agent-rake.json", "--init-config"], customIo);

  assert.match(customIo.stdout.text, /config[/\\]agent-rake\.json/);
  assert.ok(fs.existsSync(path.join(root, "config", "agent-rake.json")));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "config", "agent-rake.json"), "utf8")), {
    ignore: ["fixtures", "src/generated"],
    maxFiles: 3000,
    output: "AGENT_BRIEF.md"
  });

  const customSettingsRoot = makeTempRepo();
  const customSettingsIo = makeIo();
  await runCli([
    "--root",
    customSettingsRoot,
    "--init-config",
    "--ignore",
    "dist",
    "--max-files",
    "42",
    "--target",
    "all"
  ], customSettingsIo);

  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(customSettingsRoot, ".agent-rake.json"), "utf8")), {
    ignore: ["dist"],
    maxFiles: 42,
    target: "all"
  });

  const customOutputRoot = makeTempRepo();
  const customOutputIo = makeIo();
  await runCli(["--root", customOutputRoot, "--init-config", "--out", "CONTEXT.md"], customOutputIo);

  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(customOutputRoot, ".agent-rake.json"), "utf8")), {
    ignore: ["fixtures", "src/generated"],
    maxFiles: 3000,
    output: "CONTEXT.md"
  });

  await assert.rejects(
    () => runCli(["--config-example", "--json"], makeIo()),
    /--config-example cannot be used with --json/
  );
  await assert.rejects(
    () => runCli(["--init-config", "--diff"], makeIo()),
    /--init-config cannot be used with --check or --diff/
  );
});

test("runCli prints effective config without scanning or writing", async () => {
  const root = makeTempRepo();
  writeFile(root, ".agent-rake.json", JSON.stringify({
    ignore: "fixtures",
    maxFiles: 5,
    target: "cursor"
  }, null, 2));

  const io = makeIo();
  await runCli(["--root", root, "--show-config", "--ignore", "src/generated", "--max-files", "25"], io);
  const config = JSON.parse(io.stdout.text);

  assert.equal(config.root, path.resolve(root));
  assert.equal(config.configFile, ".agent-rake.json");
  assert.equal(config.output, ".cursor/rules/agent-rake.mdc");
  assert.equal(config.target, "cursor");
  assert.equal(config.maxFiles, 25);
  assert.deepEqual(config.ignore, ["fixtures", "src/generated"]);
  assert.equal(io.stderr.text, "");
  assert.equal(fs.existsSync(path.join(root, ".cursor", "rules", "agent-rake.mdc")), false);

  const noConfigIo = makeIo();
  await runCli(["--root", root, "--show-config", "--no-config"], noConfigIo);
  const noConfig = JSON.parse(noConfigIo.stdout.text);

  assert.equal(noConfig.configFile, null);
  assert.equal(noConfig.output, "AGENT_BRIEF.md");
  assert.equal(noConfig.target, null);
  assert.deepEqual(noConfig.ignore, []);

  await assert.rejects(
    () => runCli(["--show-config", "--json"], makeIo()),
    /--show-config cannot be used with --json/
  );
  await assert.rejects(
    () => runCli(["--show-config", "--summary"], makeIo()),
    /--show-config cannot be used with --summary/
  );
});

test("runCli sets up config, workflow, and brief safely", async () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(root, "package-lock.json", "{}\n");
  writeFile(root, "AGENTS.md", "# Agent Instructions\n");
  writeFile(root, "src/index.js", "export {};\n");

  const setupIo = makeIo();
  await runCli(["--root", root, "--setup"], setupIo);

  assert.match(setupIo.stdout.text, /agent-rake setup for `agent-rake-/);
  assert.match(setupIo.stdout.text, /config: wrote/);
  assert.match(setupIo.stdout.text, /workflow: wrote/);
  assert.match(setupIo.stdout.text, /brief: wrote/);
  assert.ok(fs.existsSync(path.join(root, ".agent-rake.json")));
  assert.ok(fs.existsSync(path.join(root, ".github", "workflows", "agent-rake.yml")));
  assert.ok(fs.existsSync(path.join(root, "AGENT_BRIEF.md")));
  assert.match(fs.readFileSync(path.join(root, "AGENT_BRIEF.md"), "utf8"), /Config: `.agent-rake\.json`/);

  const secondIo = makeIo();
  await runCli(["--root", root, "--setup"], secondIo);

  assert.match(secondIo.stdout.text, /config: kept/);
  assert.match(secondIo.stdout.text, /workflow: kept/);
  assert.match(secondIo.stdout.text, /brief: current/);

  fs.writeFileSync(path.join(root, ".agent-rake.json"), "{\"ignore\":[]}\n", "utf8");
  fs.writeFileSync(path.join(root, ".github", "workflows", "agent-rake.yml"), "stale\n", "utf8");
  const forceIo = makeIo();
  await runCli(["--root", root, "--setup", "--force", "--quiet"], forceIo);

  assert.equal(forceIo.stdout.text, "");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ".agent-rake.json"), "utf8")).ignore, ["fixtures", "src/generated"]);
  assert.match(fs.readFileSync(path.join(root, ".github", "workflows", "agent-rake.yml"), "utf8"), /^name: agent-rake/);

  await assert.rejects(
    () => runCli(["--setup", "--json"], makeIo()),
    /--setup cannot be used with --json/
  );
  await assert.rejects(
    () => runCli(["--setup", "--summary"], makeIo()),
    /--setup cannot be used with --summary/
  );
  await assert.rejects(
    () => runCli(["--setup", "--init-config"], makeIo()),
    /--setup cannot be used with --init-config/
  );
});

test("runCli setup honors config target all", async () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(root, "package-lock.json", "{}\n");
  writeFile(root, "src/index.js", "export {};\n");
  writeFile(root, ".agent-rake.json", JSON.stringify({ target: "all" }, null, 2));

  const setupIo = makeIo();
  await runCli(["--root", root, "--setup"], setupIo);

  const outputs = [
    "AGENTS.md",
    "CLAUDE.md",
    "CODEX.md",
    ".github/copilot-instructions.md",
    ".cursor/rules/agent-rake.mdc"
  ];

  for (const output of outputs) {
    assert.ok(fs.existsSync(path.join(root, output)), `${output} should be written`);
  }

  assert.match(setupIo.stdout.text, /config: kept/);
  assert.match(setupIo.stdout.text, /brief: wrote `.*AGENTS\.md`/);
  assert.match(setupIo.stdout.text, /brief: wrote `.*CLAUDE\.md`/);
  assert.match(setupIo.stdout.text, /brief: wrote `.*CODEX\.md`/);
  assert.match(setupIo.stdout.text, /brief: wrote `.*\.github[/\\]copilot-instructions\.md`/);
  assert.match(setupIo.stdout.text, /brief: wrote `.*\.cursor[/\\]rules[/\\]agent-rake\.mdc`/);

  const secondIo = makeIo();
  await runCli(["--root", root, "--setup"], secondIo);

  assert.equal((secondIo.stdout.text.match(/brief: current/g) ?? []).length, outputs.length);
});

test("runCli setup persists active output settings", async () => {
  const targetRoot = makeTempRepo();
  writeFile(targetRoot, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(targetRoot, "package-lock.json", "{}\n");
  writeFile(targetRoot, "src/index.js", "export {};\n");
  writeFile(targetRoot, "fixtures/generated.js", "export const ignored = true;\n");

  const targetIo = makeIo();
  await runCli([
    "--root",
    targetRoot,
    "--setup",
    "--target",
    "all",
    "--ignore",
    "fixtures",
    "--max-files",
    "25"
  ], targetIo);

  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(targetRoot, ".agent-rake.json"), "utf8")), {
    ignore: ["fixtures"],
    maxFiles: 25,
    target: "all"
  });
  assert.ok(fs.existsSync(path.join(targetRoot, "AGENTS.md")));
  assert.ok(fs.existsSync(path.join(targetRoot, "CLAUDE.md")));
  assert.ok(fs.existsSync(path.join(targetRoot, "CODEX.md")));
  assert.ok(fs.existsSync(path.join(targetRoot, ".github", "copilot-instructions.md")));
  assert.ok(fs.existsSync(path.join(targetRoot, ".cursor", "rules", "agent-rake.mdc")));
  assert.equal((targetIo.stdout.text.match(/brief: wrote/g) ?? []).length, 5);

  const outputRoot = makeTempRepo();
  writeFile(outputRoot, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(outputRoot, "package-lock.json", "{}\n");
  writeFile(outputRoot, "src/index.js", "export {};\n");

  const outputIo = makeIo();
  await runCli(["--root", outputRoot, "--setup", "--out", "CONTEXT.md"], outputIo);

  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputRoot, ".agent-rake.json"), "utf8")), {
    ignore: ["fixtures", "src/generated"],
    maxFiles: 3000,
    output: "CONTEXT.md"
  });
  assert.ok(fs.existsSync(path.join(outputRoot, "CONTEXT.md")));
  assert.match(outputIo.stdout.text, /brief: wrote `.*CONTEXT\.md`/);
});

test("runCli prints doctor output and supports strict failures", async () => {
  const warningRoot = makeTempRepo();
  writeFile(warningRoot, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(warningRoot, "src/index.js", "export {};\n");

  const warningIo = makeIo();
  await runCli(["--root", warningRoot, "--doctor", "--strict"], warningIo);

  assert.equal(warningIo.exitCode, 1);
  assert.match(warningIo.stdout.text, /agent-rake doctor for `agent-rake-/);
  assert.match(warningIo.stdout.text, /Fix suggestions:/);
  assert.match(warningIo.stderr.text, /agent-rake strict mode found \d+ warnings:/);

  await assert.rejects(
    () => runCli(["--doctor", "--json"], makeIo()),
    /--doctor cannot be used with --json/
  );
  await assert.rejects(
    () => runCli(["--doctor", "--diff"], makeIo()),
    /--doctor cannot be used with --check or --diff/
  );
  await assert.rejects(
    () => runCli(["--summary", "--doctor"], makeIo()),
    /--summary cannot be used with --doctor/
  );
});

test("runCli doctor reports generated output freshness", async () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(root, "package-lock.json", "{}\n");
  writeFile(root, "src/index.js", "export {};\n");

  const missingIo = makeIo();
  await runCli(["--root", root, "--doctor"], missingIo);

  assert.match(missingIo.stdout.text, /\[warn\] Generated output: `AGENT_BRIEF\.md` is missing/);
  assert.match(missingIo.stdout.text, /Run `agent-rake` to refresh `AGENT_BRIEF\.md`/);

  const writeIo = makeIo();
  await runCli(["--root", root, "--quiet"], writeIo);

  const currentIo = makeIo();
  await runCli(["--root", root, "--doctor"], currentIo);

  assert.match(currentIo.stdout.text, /\[ok\] Generated output: `AGENT_BRIEF\.md` is current/);
  assert.doesNotMatch(currentIo.stdout.text, /Run `agent-rake` to refresh `AGENT_BRIEF\.md`/);

  writeFile(root, "AGENT_BRIEF.md", "# stale\n");

  const staleIo = makeIo();
  await runCli(["--root", root, "--doctor"], staleIo);

  assert.match(staleIo.stdout.text, /\[warn\] Generated output: `AGENT_BRIEF\.md` is stale/);
  assert.match(staleIo.stdout.text, /Run `agent-rake` to refresh `AGENT_BRIEF\.md`/);
});

test("runCli doctor checks custom and target outputs", async () => {
  const customRoot = makeTempRepo();
  writeFile(customRoot, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(customRoot, "package-lock.json", "{}\n");
  writeFile(customRoot, "src/index.js", "export {};\n");

  const customIo = makeIo();
  await runCli(["--root", customRoot, "--doctor", "--out", "CUSTOM.md"], customIo);

  assert.match(customIo.stdout.text, /\[warn\] Generated output: `CUSTOM\.md` is missing/);
  assert.match(customIo.stdout.text, /Run `agent-rake --out CUSTOM\.md` to refresh `CUSTOM\.md`/);

  const targetRoot = makeTempRepo();
  writeFile(targetRoot, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(targetRoot, "package-lock.json", "{}\n");
  writeFile(targetRoot, "src/index.js", "export {};\n");

  const targetMissingIo = makeIo();
  await runCli(["--root", targetRoot, "--doctor", "--target", "all"], targetMissingIo);

  assert.match(targetMissingIo.stdout.text, /\[warn\] Generated output: `AGENTS\.md` is missing, `CLAUDE\.md` is missing, `CODEX\.md` is missing/);
  assert.match(targetMissingIo.stdout.text, /Run `agent-rake --target all` to refresh 5 generated outputs/);

  const writeTargetsIo = makeIo();
  await runCli(["--root", targetRoot, "--target", "all", "--quiet"], writeTargetsIo);

  const targetCurrentIo = makeIo();
  await runCli(["--root", targetRoot, "--doctor", "--target", "all"], targetCurrentIo);

  assert.match(targetCurrentIo.stdout.text, /\[ok\] Generated output: 5 generated outputs are current/);
});

test("runCli doctor strict fails on generated output freshness issues", async () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(root, "package-lock.json", "{}\n");
  writeFile(root, "AGENTS.md", "# Agent Instructions\n");
  writeFile(root, "src/index.js", "export {};\n");

  const missingIo = makeIo();
  await runCli(["--root", root, "--doctor", "--strict"], missingIo);

  assert.equal(missingIo.exitCode, 1);
  assert.match(missingIo.stdout.text, /Status: no scan warnings/);
  assert.match(missingIo.stderr.text, /agent-rake strict mode found 1 generated output issue:/);
  assert.match(missingIo.stderr.text, /AGENT_BRIEF\.md is missing/);
  assert.doesNotMatch(missingIo.stderr.text, /strict mode found \d+ warnings/);

  const writeIo = makeIo();
  await runCli(["--root", root, "--quiet"], writeIo);

  const currentIo = makeIo();
  await runCli(["--root", root, "--doctor", "--strict"], currentIo);

  assert.equal(currentIo.exitCode, 0);
  assert.equal(currentIo.stderr.text, "");

  writeFile(root, "AGENT_BRIEF.md", "# stale\n");

  const staleIo = makeIo();
  await runCli(["--root", root, "--doctor", "--strict"], staleIo);

  assert.equal(staleIo.exitCode, 1);
  assert.match(staleIo.stderr.text, /AGENT_BRIEF\.md is stale/);
});

test("runCli strict mode exits nonzero when scan warnings exist", async () => {
  const warningRoot = makeTempRepo();
  writeFile(warningRoot, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(warningRoot, "src/index.js", "export {};\n");

  const warningIo = makeIo();
  await runCli(["--root", warningRoot, "--summary", "--strict"], warningIo);

  assert.equal(warningIo.exitCode, 1);
  assert.match(warningIo.stdout.text, /Status: review warnings/);
  assert.match(warningIo.stderr.text, /agent-rake strict mode found \d+ warnings:/);
  assert.match(warningIo.stderr.text, /package\.json exists without a detected JavaScript lockfile/);

  const cleanRoot = makeTempRepo();
  writeFile(cleanRoot, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(cleanRoot, "package-lock.json", "{}\n");
  writeFile(cleanRoot, "AGENTS.md", "# Agent Instructions\n");
  writeFile(cleanRoot, "src/index.js", "export {};\n");

  const cleanIo = makeIo();
  await runCli(["--root", cleanRoot, "--summary", "--strict"], cleanIo);

  assert.equal(cleanIo.exitCode, 0);
  assert.match(cleanIo.stdout.text, /Status: no scan warnings/);
  assert.equal(cleanIo.stderr.text, "");
});

test("scanRepository detects non-JavaScript framework and workspace signals from manifests", () => {
  const root = makeTempRepo();

  writeFile(root, "requirements.txt", "fastapi==0.115.0\n");
  writeFile(root, "go.mod", "module example.com/app\n\nrequire github.com/gin-gonic/gin v1.10.0\n");
  writeFile(root, "Cargo.toml", "[workspace]\nmembers = [\"crates/api\"]\n\n[dependencies]\naxum = \"0.7\"\n");
  writeFile(root, "Gemfile", "source 'https://rubygems.org'\ngem 'rails'\n");
  writeFile(root, "mix.exs", "defmodule App.MixProject do\n  use Mix.Project\n  defp deps, do: [{:phoenix, \"~> 1.7\"}]\nend\n");
  writeFile(root, "mix.lock", "%{}\n");
  writeFile(root, "pubspec.yaml", "name: app\nworkspace:\n  - packages/core\nflutter:\n  uses-material-design: true\n");
  writeFile(root, "config/routes.rb", "Rails.application.routes.draw do\nend\n");
  writeFile(root, "config/runtime.exs", "import Config\n");
  writeFile(root, "lib/app_web/router.ex", "defmodule AppWeb.Router do\n  use AppWeb, :router\nend\n");
  writeFile(root, "db/migrate/20260101010101_create_users.rb", "class CreateUsers < ActiveRecord::Migration[7.0]\nend\n");
  writeFile(root, "database/migrations/2026_01_01_000000_create_users.php", "<?php\n");
  writeFile(root, "alembic/versions/001_create_users.py", "revision = '001'\n");
  writeFile(root, "priv/repo/migrations/20260101010101_create_users.exs", "defmodule App.Repo.Migrations.CreateUsers do\nend\n");
  writeFile(root, "go.work", "go 1.22\n");

  const scan = scanRepository(root);

  assertFrameworks(scan, ["FastAPI", "Gin", "Axum", "Rails", "Phoenix", "Flutter"]);
  assertWorkspaces(scan, ["Cargo workspace", "Go workspace", "Dart pub workspace"]);
  assert.ok(scan.routeFiles.includes("config/routes.rb"));
  assert.ok(scan.routeFiles.includes("lib/app_web/router.ex"));
  assert.ok(scan.dataFiles.includes("db/migrate/20260101010101_create_users.rb"));
  assert.ok(scan.dataFiles.includes("database/migrations/2026_01_01_000000_create_users.php"));
  assert.ok(scan.dataFiles.includes("alembic/versions/001_create_users.py"));
  assert.ok(scan.dataFiles.includes("priv/repo/migrations/20260101010101_create_users.exs"));
  assert.ok(scan.lockFiles.includes("mix.lock"));
  assert.ok(scan.configFiles.includes("go.work"));
  assert.ok(scan.configFiles.includes("config/runtime.exs"));
  assert.ok(scan.commands.some((command) => command.command === "mix test"));
});

test("scanRepository detects Ruby and PHP framework commands and config", () => {
  const railsRoot = makeTempRepo();
  writeFile(railsRoot, "Gemfile", "source 'https://rubygems.org'\ngem 'rails'\n");
  writeFile(railsRoot, "Gemfile.lock", "GEM\n");
  writeFile(railsRoot, "config/routes.rb", "Rails.application.routes.draw do\nend\n");

  const railsScan = scanRepository(railsRoot);

  assert.equal(railsScan.packageManager, "bundler");
  assertFrameworks(railsScan, ["Rails"]);
  assert.ok(railsScan.commands.some((command) => command.command === "bundle exec rails test"));

  const laravelRoot = makeTempRepo();
  writeFile(laravelRoot, "composer.json", JSON.stringify({
    require: {
      "laravel/framework": "^11.0"
    }
  }, null, 2));
  writeFile(laravelRoot, "artisan", "#!/usr/bin/env php\n");
  writeFile(laravelRoot, "routes/api.php", "<?php\n");
  writeFile(laravelRoot, "config/app.php", "<?php\n");
  writeFile(laravelRoot, "phpunit.xml", "<phpunit />\n");
  writeFile(laravelRoot, "pint.json", "{}\n");

  const laravelScan = scanRepository(laravelRoot);

  assert.equal(laravelScan.packageManager, "composer");
  assertFrameworks(laravelScan, ["Laravel"]);
  assert.ok(laravelScan.commands.some((command) => command.command === "php artisan test"));
  assert.ok(laravelScan.routeFiles.includes("routes/api.php"));
  assert.ok(laravelScan.configFiles.includes("config/app.php"));
  assert.ok(laravelScan.configFiles.includes("phpunit.xml"));
  assert.ok(laravelScan.configFiles.includes("pint.json"));

  const symfonyRoot = makeTempRepo();
  writeFile(symfonyRoot, "composer.json", JSON.stringify({
    require: {
      "symfony/framework-bundle": "^7.0"
    }
  }, null, 2));
  writeFile(symfonyRoot, "symfony.lock", "{}\n");
  writeFile(symfonyRoot, "bin/phpunit", "#!/usr/bin/env php\n");
  writeFile(symfonyRoot, "config/bundles.php", "<?php\n");
  writeFile(symfonyRoot, "config/routes.yaml", "controllers:\n  resource: ../src/Controller/\n");
  writeFile(symfonyRoot, "config/packages/security.yaml", "security: {}\n");
  writeFile(symfonyRoot, "phpstan.neon", "parameters:\n");
  writeFile(symfonyRoot, "rector.php", "<?php\n");

  const symfonyScan = scanRepository(symfonyRoot);

  assert.equal(symfonyScan.packageManager, "composer");
  assertFrameworks(symfonyScan, ["Symfony"]);
  assert.ok(symfonyScan.lockFiles.includes("symfony.lock"));
  assert.ok(symfonyScan.commands.some((command) => command.command === "php bin/phpunit"));
  assert.ok(symfonyScan.configFiles.includes("config/bundles.php"));
  assert.ok(symfonyScan.configFiles.includes("config/routes.yaml"));
  assert.ok(symfonyScan.configFiles.includes("config/packages/security.yaml"));
  assert.ok(symfonyScan.configFiles.includes("phpstan.neon"));
  assert.ok(symfonyScan.configFiles.includes("rector.php"));
});

test("scanRepository detects Java Maven and Gradle project signals", () => {
  const mavenRoot = makeTempRepo();
  writeFile(mavenRoot, "pom.xml", "<project><dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>\n");
  writeFile(mavenRoot, "src/main/java/com/example/DemoApplication.java", "package com.example;\nclass DemoApplication {}\n");
  writeFile(mavenRoot, "src/main/java/com/example/controller/UserController.java", "package com.example.controller;\nclass UserController {}\n");
  writeFile(mavenRoot, "src/main/resources/application.yml", "spring:\n  application:\n    name: demo\n");
  writeFile(mavenRoot, "src/main/resources/db/migration/V1__create_users.sql", "create table users (id bigint);\n");

  const mavenScan = scanRepository(mavenRoot);

  assert.equal(mavenScan.packageManager, "maven");
  assertFrameworks(mavenScan, ["Spring"]);
  assert.ok(mavenScan.commands.some((command) => command.command === "mvn test"));
  assert.ok(mavenScan.routeFiles.includes("src/main/java/com/example/controller/UserController.java"));
  assert.ok(mavenScan.configFiles.includes("src/main/resources/application.yml"));
  assert.ok(mavenScan.dataFiles.includes("src/main/resources/db/migration/V1__create_users.sql"));

  const gradleRoot = makeTempRepo();
  writeFile(gradleRoot, "build.gradle.kts", "plugins { id(\"org.springframework.boot\") version \"3.3.0\" }\n");
  writeFile(gradleRoot, "gradlew", "#!/bin/sh\n");
  writeFile(gradleRoot, "settings.gradle.kts", "rootProject.name = \"demo\"\n");
  writeFile(gradleRoot, "gradle.properties", "org.gradle.caching=true\n");
  writeFile(gradleRoot, "src/main/kotlin/com/example/controller/OrderController.kt", "package com.example.controller\nclass OrderController\n");

  const gradleScan = scanRepository(gradleRoot);

  assert.equal(gradleScan.packageManager, "gradle");
  assertFrameworks(gradleScan, ["Spring"]);
  assert.ok(gradleScan.commands.some((command) => command.command === "./gradlew test"));
  assert.ok(gradleScan.routeFiles.includes("src/main/kotlin/com/example/controller/OrderController.kt"));
  assert.ok(gradleScan.configFiles.includes("settings.gradle.kts"));
  assert.ok(gradleScan.configFiles.includes("gradle.properties"));
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
  writeFile(root, "main.go", "package main\nimport \"net/http\"\nfunc main() { http.HandleFunc(`/health`, health) }\n");
  writeFile(root, "cmd/api/main.go", "package main\nfunc main() { app.GET(\"/v1/users\", users) }\n");
  writeFile(root, "src/router.go", "package app\nfunc routes(r Router) { r.Get(\"/orders\", handler) }\n");
  writeFile(root, "src/random.ts", "const value = get('/not-a-route');\n");
  writeFile(root, "src/random.go", "package app\nconst value = \"/not-a-route\"\n");
  writeFile(root, "test/server.test.js", "app.get('/test-only', handler);\n");
  writeFile(root, "test/router_test.go", "package app\nfunc TestRoutes(t *testing.T) { r.Get(\"/test-only\", handler) }\n");

  const scan = scanRepository(root);

  assert.ok(scan.routeFiles.includes("server.js"));
  assert.ok(scan.routeFiles.includes("src/index.ts"));
  assert.ok(scan.routeFiles.includes("main.py"));
  assert.ok(scan.routeFiles.includes("app.py"));
  assert.ok(scan.routeFiles.includes("main.go"));
  assert.ok(scan.routeFiles.includes("cmd/api/main.go"));
  assert.ok(scan.routeFiles.includes("src/router.go"));
  assert.equal(scan.routeFiles.includes("src/random.ts"), false);
  assert.equal(scan.routeFiles.includes("src/random.go"), false);
  assert.equal(scan.routeFiles.includes("test/server.test.js"), false);
  assert.equal(scan.routeFiles.includes("test/router_test.go"), false);
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
  const stale = compareOutput(markdown, outputPath);
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "stale");
  assert.equal(stale.existing, "stale\n");
  assert.equal(stale.expected, markdown);
});

test("renderOutputDiff shows a concise changed chunk", () => {
  const diff = renderOutputDiff("one\ntwo\nthree\n", "one\nTWO\nthree\n", {
    fromLabel: "current",
    toLabel: "generated"
  });

  assert.match(diff, /--- current/);
  assert.match(diff, /\+\+\+ generated/);
  assert.match(diff, /@@ line 1 @@/);
  assert.match(diff, /  one/);
  assert.match(diff, /- two/);
  assert.match(diff, /\+ TWO/);
  assert.match(diff, /  three/);
});

test("runCli prints stale output diffs on request", async () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(root, "package-lock.json", "{}\n");
  writeFile(root, "AGENTS.md", "# Agent Instructions\n");
  writeFile(root, "src/index.js", "export {};\n");
  writeFile(root, "AGENT_BRIEF.md", "# stale\n");

  const staleIo = makeIo();
  await runCli(["--root", root, "--diff"], staleIo);

  assert.equal(staleIo.exitCode, 1);
  assert.equal(staleIo.stdout.text, "");
  assert.match(staleIo.stderr.text, /AGENT_BRIEF\.md is stale/);
  assert.match(staleIo.stderr.text, /Run `agent-rake` to update it\./);
  assert.doesNotMatch(staleIo.stderr.text, /--out AGENT_BRIEF\.md/);
  assert.match(staleIo.stderr.text, /--- .*AGENT_BRIEF\.md/);
  assert.match(staleIo.stderr.text, /\+\+\+ generated/);
  assert.match(staleIo.stderr.text, /- # stale/);
  assert.match(staleIo.stderr.text, /\+ # Agent Brief/);

  const missingRoot = makeTempRepo();
  writeFile(missingRoot, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
  writeFile(missingRoot, "package-lock.json", "{}\n");
  writeFile(missingRoot, "AGENTS.md", "# Agent Instructions\n");
  writeFile(missingRoot, "src/index.js", "export {};\n");

  const missingIo = makeIo();
  await runCli(["--root", missingRoot, "--diff"], missingIo);

  assert.equal(missingIo.exitCode, 1);
  assert.match(missingIo.stderr.text, /AGENT_BRIEF\.md is missing/);
  assert.match(missingIo.stderr.text, /No diff is available because .*AGENT_BRIEF\.md does not exist yet/);
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

test("runCli writes and checks all known target outputs", async () => {
  const root = makeTempRepo();
  writeFile(root, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));

  const writeIo = makeIo();
  await runCli(["--root", root, "--target", "all"], writeIo);

  const outputs = [
    "AGENTS.md",
    "CLAUDE.md",
    "CODEX.md",
    ".github/copilot-instructions.md",
    ".cursor/rules/agent-rake.mdc"
  ];

  for (const output of outputs) {
    assert.ok(fs.existsSync(path.join(root, output)), `${output} should be written`);
  }

  assert.match(writeIo.stdout.text, /Wrote .*AGENTS\.md/);
  assert.match(writeIo.stdout.text, /Wrote .*CLAUDE\.md/);
  assert.match(writeIo.stdout.text, /Wrote .*CODEX\.md/);
  assert.match(writeIo.stdout.text, /Wrote .*\.github[/\\]copilot-instructions\.md/);
  assert.match(writeIo.stdout.text, /Wrote .*\.cursor[/\\]rules[/\\]agent-rake\.mdc/);

  const checkIo = makeIo();
  await runCli(["--root", root, "--target", "all", "--check"], checkIo);

  assert.equal(checkIo.exitCode ?? 0, 0);
  assert.match(checkIo.stdout.text, /AGENTS\.md is current\./);
  assert.match(checkIo.stdout.text, /CLAUDE\.md is current\./);
  assert.match(checkIo.stdout.text, /CODEX\.md is current\./);
  assert.match(checkIo.stdout.text, /\.github[/\\]copilot-instructions\.md is current\./);
  assert.match(checkIo.stdout.text, /\.cursor[/\\]rules[/\\]agent-rake\.mdc is current\./);
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
