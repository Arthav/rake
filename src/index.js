import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_OUTPUT = "AGENT_BRIEF.md";

const DEFAULT_MAX_FILES = 3000;
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_ROUTE_HINT_BYTES = 128 * 1024;
const TARGET_OUTPUTS = new Map([
  ["agents", "AGENTS.md"],
  ["claude", "CLAUDE.md"],
  ["codex", "CODEX.md"],
  ["copilot", ".github/copilot-instructions.md"],
  ["cursor", ".cursor/rules/agent-rake.mdc"]
]);

const IGNORED_DIRS = new Set([
  ".cache",
  ".expo",
  ".git",
  ".hg",
  ".idea",
  ".next",
  ".nuxt",
  ".npm-cache",
  ".parcel-cache",
  ".pnpm-store",
  ".svelte-kit",
  ".turbo",
  ".vercel",
  ".vscode",
  ".yarn",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "Pods",
  "target",
  "vendor",
  "venv",
  ".venv"
]);

const GENERATED_FILE_NAMES = new Set([DEFAULT_OUTPUT.toLowerCase()]);

const MANIFEST_FILES = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
  "composer.json",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "pubspec.yaml",
  "Gemfile",
  "mix.exs",
  "deno.json",
  "deno.jsonc"
]);

const LOCK_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "uv.lock",
  "poetry.lock",
  "Pipfile.lock",
  "go.sum",
  "Cargo.lock",
  "composer.lock",
  "pubspec.lock",
  "Gemfile.lock"
]);

const AGENT_INSTRUCTION_FILES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "CODEX.md",
  ".cursorrules",
  ".cursor/rules",
  ".github/copilot-instructions.md"
]);

const DOC_FILES = new Set([
  "README.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "SECURITY.md",
  "LICENSE"
]);

const EXTENSION_LANGUAGES = new Map([
  [".js", "JavaScript"],
  [".jsx", "JavaScript"],
  [".mjs", "JavaScript"],
  [".cjs", "JavaScript"],
  [".ts", "TypeScript"],
  [".tsx", "TypeScript"],
  [".mts", "TypeScript"],
  [".cts", "TypeScript"],
  [".py", "Python"],
  [".go", "Go"],
  [".rs", "Rust"],
  [".php", "PHP"],
  [".rb", "Ruby"],
  [".java", "Java"],
  [".kt", "Kotlin"],
  [".kts", "Kotlin"],
  [".cs", "C#"],
  [".swift", "Swift"],
  [".dart", "Dart"],
  [".ex", "Elixir"],
  [".exs", "Elixir"],
  [".vue", "Vue"],
  [".svelte", "Svelte"],
  [".css", "CSS"],
  [".scss", "CSS"],
  [".html", "HTML"],
  [".sql", "SQL"],
  [".sh", "Shell"],
  [".ps1", "PowerShell"]
]);

const HIDDEN_PACKAGE_SCRIPTS = new Set([
  "install",
  "postinstall",
  "postpack",
  "postpublish",
  "preinstall",
  "prepack",
  "prepare",
  "prepublish",
  "prepublishOnly"
]);

export function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    output: DEFAULT_OUTPUT,
    write: true,
    json: false,
    check: false,
    maxFiles: DEFAULT_MAX_FILES,
    quiet: false
  };

  const positionals = [];
  let outputWasSet = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      options.version = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      options.write = false;
      continue;
    }

    if (arg === "--check") {
      options.check = true;
      options.write = false;
      continue;
    }

    if (arg === "--no-write" || arg === "--print") {
      options.write = false;
      continue;
    }

    if (arg === "--quiet") {
      options.quiet = true;
      continue;
    }

    if (arg === "--out" || arg === "--output") {
      options.output = requireValue(argv, index, arg);
      outputWasSet = true;
      index += 1;
      continue;
    }

    if (arg.startsWith("--out=")) {
      options.output = arg.slice("--out=".length);
      outputWasSet = true;
      continue;
    }

    if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
      outputWasSet = true;
      continue;
    }

    if (arg === "--target") {
      options.target = parseTarget(requireValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--target=")) {
      options.target = parseTarget(arg.slice("--target=".length), "--target");
      continue;
    }

    if (arg === "--root") {
      options.root = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--root=")) {
      options.root = arg.slice("--root=".length);
      continue;
    }

    if (arg === "--max-files") {
      options.maxFiles = parsePositiveInt(requireValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--max-files=")) {
      options.maxFiles = parsePositiveInt(arg.slice("--max-files=".length), "--max-files");
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    }

    positionals.push(arg);
  }

  if (positionals.length > 1) {
    throw new Error(`expected at most one path, received ${positionals.length}`);
  }

  if (positionals[0]) {
    options.root = positionals[0];
  }

  if (options.target && outputWasSet) {
    throw new Error("--target cannot be used with --out or --output");
  }

  if (options.target) {
    options.output = TARGET_OUTPUTS.get(options.target);
  }

  return options;
}

export async function runCli(argv = process.argv.slice(2), io = process) {
  const options = parseArgs(argv);

  if (options.help) {
    io.stdout.write(helpText());
    return;
  }

  if (options.version) {
    io.stdout.write(`${readPackageVersion()}\n`);
    return;
  }

  if (options.check && options.json) {
    throw new Error("--check cannot be used with --json");
  }

  if (options.target && options.json) {
    throw new Error("--target cannot be used with --json");
  }

  const scan = scanRepository(options.root, options);

  if (options.json) {
    io.stdout.write(`${JSON.stringify(scan, null, 2)}\n`);
    return;
  }

  const markdown = renderMarkdown(scan);
  const outputPath = path.resolve(scan.absoluteRoot, options.output);

  if (options.check) {
    const result = compareOutput(markdown, outputPath);

    if (!result.ok) {
      io.stderr.write(`${formatDisplayPath(outputPath)} is ${result.reason}. Run \`${formatUpdateCommand(options)}\` to update it.\n`);
      io.exitCode = 1;
      return;
    }

    if (!options.quiet) {
      io.stdout.write(`${formatDisplayPath(outputPath)} is current.\n`);
    }

    return;
  }

  if (options.write) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdown, "utf8");

    if (!options.quiet) {
      io.stdout.write(`Wrote ${path.relative(process.cwd(), outputPath) || outputPath}\n`);
    }

    return;
  }

  io.stdout.write(markdown);
}

export function scanRepository(root = process.cwd(), options = {}) {
  const absoluteRoot = path.resolve(root);
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

  if (!fs.existsSync(absoluteRoot)) {
    throw new Error(`root does not exist: ${absoluteRoot}`);
  }

  const stat = fs.statSync(absoluteRoot);
  if (!stat.isDirectory()) {
    throw new Error(`root is not a directory: ${absoluteRoot}`);
  }

  const generatedFiles = collectGeneratedOutputFiles(absoluteRoot, options.output);
  const walkResult = walkFiles(absoluteRoot, { maxFiles, generatedFiles });
  const files = walkResult.files;
  const byPath = new Map(files.map((file) => [file.relative, file]));

  const manifests = collectKnown(files, MANIFEST_FILES);
  const lockFiles = collectKnown(files, LOCK_FILES);
  const docs = collectKnown(files, DOC_FILES);
  const instructionFiles = collectAgentInstructions(files);
  const packageJson = readJsonIfPresent(byPath.get("package.json")?.absolute);
  const composerJson = readJsonIfPresent(byPath.get("composer.json")?.absolute);
  const manifestTexts = readManifestTexts(byPath);

  const languageSummary = summarizeLanguages(files);
  const packageManager = detectPackageManager(packageJson, lockFiles);

  return {
    tool: "agent-rake",
    generatedAt: new Date().toISOString(),
    root: path.basename(absoluteRoot),
    absoluteRoot,
    displayRoot: path.basename(absoluteRoot),
    filesScanned: files.length,
    truncated: walkResult.truncated,
    ignoredDirectories: Array.from(IGNORED_DIRS).sort(),
    languages: languageSummary,
    packageManager,
    frameworks: detectFrameworks({ files, packageJson, composerJson, manifestTexts }),
    workspaces: detectWorkspaces({ files, packageJson, manifestTexts }),
    manifests,
    lockFiles,
    docs,
    instructionFiles,
    commands: inferCommands({ packageJson, composerJson, manifests, lockFiles, packageManager }),
    entrypoints: collectEntrypoints(files),
    routeFiles: collectRoutes(files),
    testFiles: collectTests(files),
    envFiles: collectEnvFiles(files),
    dataFiles: collectDataFiles(files),
    ciFiles: collectCiFiles(files),
    configFiles: collectConfigFiles(files),
    hotspotFiles: collectHotspots(files),
    warnings: collectWarnings({ files, manifests, lockFiles, instructionFiles, walkResult })
  };
}

export function renderMarkdown(scan) {
  const lines = [];

  lines.push("# Agent Brief");
  lines.push("");
  lines.push(`Generated by agent-rake for \`${scan.root}\`.`);
  lines.push("");
  lines.push("## Repo Snapshot");
  lines.push("");
  lines.push(`- Root: \`${scan.displayRoot ?? scan.root}\``);
  lines.push(`- Files scanned: ${scan.filesScanned}${scan.truncated ? " (truncated by --max-files)" : ""}`);
  lines.push(`- Primary languages: ${formatLanguageSummary(scan.languages)}`);
  lines.push(`- Package manager: ${scan.packageManager || "not detected"}`);
  lines.push("");

  lines.push("## Stack Signals");
  lines.push("");
  appendList(lines, "Manifests", scan.manifests);
  appendList(lines, "Lockfiles", scan.lockFiles);
  appendSignals(lines, "Framework signals", scan.frameworks);
  appendSignals(lines, "Workspace signals", scan.workspaces);
  appendList(lines, "Docs", scan.docs);
  appendList(lines, "Existing agent instructions", scan.instructionFiles);
  lines.push("");

  lines.push("## Commands Agents Should Prefer");
  lines.push("");
  if (scan.commands.length === 0) {
    lines.push("- No runnable command was confidently inferred. Read the manifest files before inventing one.");
  } else {
    for (const command of scan.commands) {
      lines.push(`- \`${command.command}\` - ${command.reason}`);
    }
  }
  lines.push("");

  lines.push("## Files To Read First");
  lines.push("");
  appendList(lines, "Entrypoints", scan.entrypoints);
  appendList(lines, "Routes and APIs", scan.routeFiles);
  appendList(lines, "Tests", scan.testFiles);
  appendList(lines, "Environment files", scan.envFiles);
  appendList(lines, "Data and schema files", scan.dataFiles);
  appendList(lines, "CI", scan.ciFiles);
  appendList(lines, "Config", scan.configFiles);
  lines.push("");

  lines.push("## Risk Hotspots");
  lines.push("");
  if (scan.hotspotFiles.length === 0) {
    lines.push("- No obvious auth, payment, migration, webhook, database, queue, or security hotspot files were detected.");
  } else {
    for (const file of scan.hotspotFiles) {
      lines.push(`- \`${file}\``);
    }
  }
  lines.push("");

  lines.push("## Agent Rules For This Repo");
  lines.push("");
  lines.push("- Start with the files listed above before making broad edits.");
  lines.push("- Preserve generated, dependency, cache, build, and vendor directories.");
  lines.push("- Treat `.env` and secret-bearing files as sensitive; prefer examples and docs.");
  lines.push("- Prefer the detected package manager and commands over global fallbacks.");
  lines.push("- Run the smallest relevant test command before claiming a code change is done.");
  lines.push("");

  if (scan.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const warning of scan.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function compareOutput(markdown, outputPath) {
  if (!fs.existsSync(outputPath)) {
    return { ok: false, reason: "missing" };
  }

  const existing = normalizeLineEndings(fs.readFileSync(outputPath, "utf8"));
  const expected = normalizeLineEndings(markdown);

  if (existing !== expected) {
    return { ok: false, reason: "stale" };
  }

  return { ok: true, reason: "current" };
}

function walkFiles(root, options) {
  const files = [];
  let truncated = false;

  function visit(directory) {
    if (files.length >= options.maxFiles) {
      truncated = true;
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (files.length >= options.maxFiles) {
        truncated = true;
        return;
      }

      const absolute = path.join(directory, entry.name);
      const relative = toPosix(path.relative(root, absolute));

      if (entry.isDirectory()) {
        if (shouldIgnoreDirectory(entry.name)) {
          continue;
        }

        visit(absolute);
        continue;
      }

      if (!entry.isFile()
        || GENERATED_FILE_NAMES.has(entry.name.toLowerCase())
        || options.generatedFiles?.has(relative.toLowerCase())) {
        continue;
      }

      let stat;
      try {
        stat = fs.statSync(absolute);
      } catch {
        continue;
      }

      files.push({
        absolute,
        relative,
        name: entry.name,
        ext: path.extname(entry.name),
        size: stat.size
      });
    }
  }

  visit(root);

  return { files, truncated };
}

function shouldIgnoreDirectory(name) {
  return IGNORED_DIRS.has(name);
}

function collectKnown(files, knownNames) {
  return files
    .filter((file) => knownNames.has(file.name) || knownNames.has(file.relative))
    .map((file) => file.relative)
    .sort();
}

function collectAgentInstructions(files) {
  return files
    .filter((file) => {
      if (AGENT_INSTRUCTION_FILES.has(file.name) || AGENT_INSTRUCTION_FILES.has(file.relative)) {
        return true;
      }

      return file.relative.startsWith(".cursor/rules/");
    })
    .map((file) => file.relative)
    .sort();
}

function summarizeLanguages(files) {
  const counts = new Map();

  for (const file of files) {
    const language = EXTENSION_LANGUAGES.get(file.ext.toLowerCase());
    if (!language) {
      continue;
    }

    const current = counts.get(language) ?? { language, files: 0, bytes: 0 };
    current.files += 1;
    current.bytes += file.size;
    counts.set(language, current);
  }

  return Array.from(counts.values()).sort((left, right) => {
    if (right.files !== left.files) {
      return right.files - left.files;
    }

    return right.bytes - left.bytes;
  });
}

function detectPackageManager(packageJson, lockFiles) {
  if (packageJson?.packageManager) {
    return packageJson.packageManager.split("@")[0];
  }

  const lockSet = new Set(lockFiles);
  if (lockSet.has("pnpm-lock.yaml")) return "pnpm";
  if (lockSet.has("yarn.lock")) return "yarn";
  if (lockSet.has("bun.lockb")) return "bun";
  if (lockSet.has("package-lock.json")) return "npm";
  if (lockSet.has("uv.lock")) return "uv";
  if (lockSet.has("poetry.lock")) return "poetry";
  if (lockSet.has("Cargo.lock")) return "cargo";
  if (lockSet.has("go.sum")) return "go";
  if (lockSet.has("composer.lock")) return "composer";
  if (lockSet.has("pubspec.lock")) return "dart/flutter";
  if (packageJson) return "npm";

  return null;
}

function detectFrameworks({ files, packageJson, composerJson, manifestTexts }) {
  const signals = [];
  const dependencyNames = collectDependencyNames(packageJson, [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
  ]);
  const composerNames = collectDependencyNames(composerJson, ["require", "require-dev"]);

  addDependencySignal(signals, dependencyNames, "next", "Next.js");
  addDependencySignal(signals, dependencyNames, "@remix-run/node", "Remix");
  addDependencySignal(signals, dependencyNames, "@remix-run/react", "Remix");
  addDependencySignal(signals, dependencyNames, "@sveltejs/kit", "SvelteKit");
  addDependencySignal(signals, dependencyNames, "nuxt", "Nuxt");
  addDependencySignal(signals, dependencyNames, "astro", "Astro");
  addDependencySignal(signals, dependencyNames, "vite", "Vite");
  addDependencySignal(signals, dependencyNames, "react", "React");
  addDependencySignal(signals, dependencyNames, "vue", "Vue");
  addDependencySignal(signals, dependencyNames, "svelte", "Svelte");
  addDependencySignal(signals, dependencyNames, "express", "Express");
  addDependencySignal(signals, dependencyNames, "fastify", "Fastify");
  addDependencySignal(signals, dependencyNames, "hono", "Hono");
  addDependencySignal(signals, dependencyNames, "@nestjs/core", "NestJS");

  addDependencySignal(signals, composerNames, "laravel/framework", "Laravel", "composer.json requirement");
  addDependencySignal(signals, composerNames, "symfony/framework-bundle", "Symfony", "composer.json requirement");

  addManifestTextSignal(signals, manifestTexts, ["requirements.txt", "pyproject.toml"], /\bfastapi\b/i, "FastAPI");
  addManifestTextSignal(signals, manifestTexts, ["requirements.txt", "pyproject.toml"], /\bdjango\b/i, "Django");
  addManifestTextSignal(signals, manifestTexts, ["requirements.txt", "pyproject.toml"], /\bflask\b/i, "Flask");
  addManifestTextSignal(signals, manifestTexts, ["Gemfile"], /gem\s+["']rails["']/i, "Rails");
  addManifestTextSignal(signals, manifestTexts, ["go.mod"], /github\.com\/gin-gonic\/gin\b/i, "Gin");
  addManifestTextSignal(signals, manifestTexts, ["go.mod"], /github\.com\/go-chi\/chi\b/i, "Chi");
  addManifestTextSignal(signals, manifestTexts, ["go.mod"], /github\.com\/labstack\/echo\b/i, "Echo");
  addManifestTextSignal(signals, manifestTexts, ["Cargo.toml"], /^\s*axum\s*=/im, "Axum");
  addManifestTextSignal(signals, manifestTexts, ["Cargo.toml"], /^\s*actix-web\s*=/im, "Actix Web");
  addManifestTextSignal(signals, manifestTexts, ["mix.exs"], /{:phoenix,/i, "Phoenix");
  addManifestTextSignal(signals, manifestTexts, ["pubspec.yaml"], /^\s*flutter\s*:/im, "Flutter");

  addPathSignal(signals, files, "Next.js", (file) => /^app\/(?:.*\/)?(page|layout|route)\.[cm]?[jt]sx?$/i.test(file.relative)
    || /^pages\/.*\.[cm]?[jt]sx?$/i.test(file.relative));
  addPathSignal(signals, files, "Remix", (file) => /^app\/routes\/.+\.[cm]?[jt]sx?$/i.test(file.relative));
  addPathSignal(signals, files, "SvelteKit", (file) => /^src\/routes\/(?:.*\/)?(\+page|\+layout|\+server)\.(svelte|[jt]s)$/i.test(file.relative));
  addPathSignal(signals, files, "Django", (file) => file.relative === "manage.py" || /(^|\/)(settings|urls)\.py$/i.test(file.relative));
  addPathSignal(signals, files, "Rails", (file) => file.relative === "config/routes.rb");
  addPathSignal(signals, files, "Laravel", (file) => file.relative === "artisan" || /^routes\/(api|web|console|channels)\.php$/i.test(file.relative));
  addPathSignal(signals, files, "Phoenix", (file) => /(^|\/)router\.ex$/i.test(file.relative));

  return uniqueSignals(signals).slice(0, 16);
}

function detectWorkspaces({ files, packageJson, manifestTexts }) {
  const signals = [];
  const fileSet = new Set(files.map((file) => file.relative));

  if (packageJson?.workspaces) {
    const workspaceText = formatWorkspaceGlobs(packageJson.workspaces);
    const evidence = workspaceText
      ? `package.json workspaces: ${workspaceText}`
      : "package.json workspaces";

    signals.push({ name: "JavaScript workspace", evidence });
  }

  if (fileSet.has("pnpm-workspace.yaml")) {
    signals.push({ name: "pnpm workspace", evidence: "pnpm-workspace.yaml" });
  }

  if (fileSet.has("turbo.json")) {
    signals.push({ name: "Turborepo", evidence: "turbo.json" });
  }

  if (fileSet.has("nx.json")) {
    signals.push({ name: "Nx workspace", evidence: "nx.json" });
  }

  if (fileSet.has("lerna.json")) {
    signals.push({ name: "Lerna workspace", evidence: "lerna.json" });
  }

  if (fileSet.has("go.work")) {
    signals.push({ name: "Go workspace", evidence: "go.work" });
  }

  if (/\[workspace\]/i.test(manifestTexts.get("Cargo.toml") ?? "")) {
    signals.push({ name: "Cargo workspace", evidence: "Cargo.toml [workspace]" });
  }

  if (fileSet.has("melos.yaml")) {
    signals.push({ name: "Melos workspace", evidence: "melos.yaml" });
  }

  if (/^workspace\s*:/im.test(manifestTexts.get("pubspec.yaml") ?? "")) {
    signals.push({ name: "Dart pub workspace", evidence: "pubspec.yaml workspace" });
  }

  return uniqueSignals(signals).slice(0, 12);
}

function inferCommands({ packageJson, composerJson, manifests, lockFiles, packageManager }) {
  const commands = [];
  const manifestSet = new Set(manifests);
  const lockSet = new Set(lockFiles);

  if (packageJson?.scripts && typeof packageJson.scripts === "object") {
    const runner = packageManager && ["npm", "pnpm", "yarn", "bun"].includes(packageManager)
      ? packageManager
      : "npm";

    for (const scriptName of preferredScriptOrder(Object.keys(packageJson.scripts))) {
      commands.push({
        command: formatPackageScript(runner, scriptName),
        reason: `package.json script: ${packageJson.scripts[scriptName]}`
      });
    }
  }

  if (manifestSet.has("pyproject.toml") || manifestSet.has("requirements.txt")) {
    commands.push({
      command: lockSet.has("uv.lock") ? "uv run pytest" : "python -m pytest",
      reason: "Python project signal"
    });
  }

  if (manifestSet.has("go.mod")) {
    commands.push({ command: "go test ./...", reason: "Go module" });
  }

  if (manifestSet.has("Cargo.toml")) {
    commands.push({ command: "cargo test", reason: "Rust manifest" });
  }

  if (manifestSet.has("pubspec.yaml")) {
    commands.push({ command: "dart test", reason: "Dart/Flutter manifest" });
  }

  if (composerJson?.scripts && typeof composerJson.scripts === "object") {
    for (const scriptName of preferredScriptOrder(Object.keys(composerJson.scripts))) {
      commands.push({ command: `composer ${scriptName}`, reason: "composer.json script" });
    }
  }

  return uniqueBy(commands, (command) => command.command).slice(0, 12);
}

function preferredScriptOrder(scriptNames) {
  const priority = ["dev", "start", "test", "lint", "typecheck", "check", "build", "format"];
  const visibleScripts = scriptNames.filter((scriptName) => !HIDDEN_PACKAGE_SCRIPTS.has(scriptName));
  const known = priority.filter((scriptName) => visibleScripts.includes(scriptName));
  const rest = visibleScripts.filter((scriptName) => !priority.includes(scriptName)).sort();
  return [...known, ...rest].slice(0, 10);
}

function formatPackageScript(runner, scriptName) {
  if (runner === "yarn") {
    return `yarn ${scriptName}`;
  }

  if (runner === "pnpm") {
    return `pnpm ${scriptName}`;
  }

  if (runner === "bun") {
    return `bun run ${scriptName}`;
  }

  if (scriptName === "test") {
    return "npm test";
  }

  if (scriptName === "start") {
    return "npm start";
  }

  return `npm run ${scriptName}`;
}

function collectEntrypoints(files) {
  const entrypointNames = new Set([
    "index.js",
    "index.ts",
    "main.js",
    "main.ts",
    "server.js",
    "server.ts",
    "app.js",
    "app.ts",
    "main.py",
    "manage.py",
    "main.go",
    "main.rs",
    "lib.rs"
  ]);

  return files
    .filter((file) => {
      if (entrypointNames.has(file.name)) {
        return true;
      }

      return /^(src|app|pages)\/(index|main|server|page|layout|route)\.[cm]?[jt]sx?$/.test(file.relative);
    })
    .map((file) => file.relative)
    .sort()
    .slice(0, 40);
}

function collectRoutes(files) {
  const pathMatches = files
    .filter(isRoutePathFile)
    .map((file) => file.relative);
  const declarationMatches = files
    .filter(isRouteDeclarationCandidate)
    .filter((file) => hasRouteDeclaration(file))
    .map((file) => file.relative);

  return Array.from(new Set([...pathMatches, ...declarationMatches]))
    .sort()
    .slice(0, 80);
}

function isRoutePathFile(file) {
  const lower = file.relative.toLowerCase();
  return lower.includes("/routes/")
    || lower.includes("/controllers/")
    || lower.includes("/api/")
    || /^app\/(?:.*\/)?(page|route)\.[cm]?[jt]sx?$/.test(lower)
    || /^pages\/.+\.[cm]?[jt]sx?$/.test(lower)
    || /^src\/routes\/(?:.*\/)?(\+page|\+server)\.(svelte|[jt]s)$/.test(lower)
    || /^routes\/(api|web|console|channels)\.php$/.test(lower)
    || /^config\/routes\.rb$/.test(lower)
    || /(^|\/)route\.[cm]?[jt]s$/.test(lower)
    || /(^|\/)router\.ex$/.test(lower)
    || /(^|\/)urls\.py$/.test(lower)
    || /(^|\/)views\.py$/.test(lower);
}

function isRouteDeclarationCandidate(file) {
  if (file.size > MAX_ROUTE_HINT_BYTES) {
    return false;
  }

  const lower = file.relative.toLowerCase();

  if (lower.includes("/test/")
    || lower.includes("/tests/")
    || lower.includes("/__tests__/")
    || lower.includes(".test.")
    || lower.includes(".spec.")) {
    return false;
  }

  return /^((src|server|app|api|routes|controllers)\/)?(index|main|server|app|api|router|routes)\.[cm]?[jt]sx?$/.test(lower)
    || /^((src|server|app|api|routes|controllers)\/)?(main|app|api|server|routes|views)\.py$/.test(lower);
}

function hasRouteDeclaration(file) {
  let text;

  try {
    text = fs.readFileSync(file.absolute, "utf8");
  } catch {
    return false;
  }

  if (/\b(app|router|server)\s*\.\s*(get|post|put|patch|delete|all|use)\s*\(\s*["'`]\//i.test(text)) {
    return true;
  }

  if (/\b(app|router)\s*\.\s*route\s*\(\s*["'`]\//i.test(text)) {
    return true;
  }

  if (/@(?:app|router|api)\.(get|post|put|patch|delete|api_route|route)\s*\(\s*["']\//i.test(text)) {
    return true;
  }

  return /\bapp\.add_api_route\s*\(\s*["']\//i.test(text);
}

function collectTests(files) {
  return files
    .filter((file) => {
      const lower = file.relative.toLowerCase();
      return lower.includes("/test/")
        || lower.includes("/tests/")
        || lower.includes("/__tests__/")
        || lower.includes(".test.")
        || lower.includes(".spec.");
    })
    .map((file) => file.relative)
    .sort()
    .slice(0, 80);
}

function collectEnvFiles(files) {
  return files
    .filter((file) => isSafeEnvTemplate(file.name))
    .map((file) => file.relative)
    .sort()
    .slice(0, 40);
}

function collectDataFiles(files) {
  return files
    .filter((file) => {
      const lower = file.relative.toLowerCase();

      return lower === "alembic.ini"
        || lower === "db/schema.rb"
        || lower === "db/structure.sql"
        || lower === "prisma/schema.prisma"
        || lower === "schema.sql"
        || lower.endsWith("/schema.sql")
        || lower.startsWith("alembic/versions/")
        || lower.startsWith("database/factories/")
        || lower.startsWith("database/migrations/")
        || lower.startsWith("database/seeders/")
        || lower.startsWith("db/migrate/")
        || lower.startsWith("drizzle/")
        || lower.startsWith("migrations/")
        || /(^|\/)drizzle\.config\.[cm]?[jt]s$/.test(lower)
        || /(^|\/)migrations\/[^/]+\.py$/.test(lower)
        || /(^|\/)migrations\/[^/]+\.sql$/.test(lower)
        || /(^|\/)migrations\/versions\/[^/]+\.py$/.test(lower)
        || /(^|\/)models\/.*\.(py|rb|php|js|ts)$/.test(lower);
    })
    .map((file) => file.relative)
    .sort()
    .slice(0, 80);
}

function collectCiFiles(files) {
  return files
    .filter((file) => file.relative.startsWith(".github/workflows/") || file.name === "Dockerfile" || file.name === "docker-compose.yml" || file.name === "compose.yml")
    .map((file) => file.relative)
    .sort()
    .slice(0, 60);
}

function collectConfigFiles(files) {
  const configPattern = /(^|\/)(angular\.json|astro\.config|biome\.json|cypress\.config|drizzle\.config|eslint\.config|go\.work|jest\.config|jsconfig|melos\.yaml|mypy\.ini|next\.config|nuxt\.config|nx\.json|playwright\.config|pnpm-workspace\.yaml|prettier\.config|prisma\/schema|pytest\.ini|remix\.config|ruff\.toml|svelte\.config|tailwind\.config|tsconfig|turbo\.json|vite\.config)/i;

  return files
    .filter((file) => configPattern.test(file.relative))
    .map((file) => file.relative)
    .sort()
    .slice(0, 80);
}

function collectHotspots(files) {
  const hotspotPattern = /(auth|permission|security|policy|billing|payment|stripe|webhook|migration|schema|database|db|prisma|drizzle|queue|worker|cron|seed|secret|token)/i;

  return files
    .filter((file) => !DOC_FILES.has(file.name) && hotspotPattern.test(file.relative))
    .map((file) => file.relative)
    .sort()
    .slice(0, 80);
}

function collectWarnings({ files, manifests, lockFiles, instructionFiles, walkResult }) {
  const warnings = [];

  if (walkResult.truncated) {
    warnings.push("File scan was truncated. Increase `--max-files` for a fuller map.");
  }

  if (files.length === 0) {
    warnings.push("No source files were found.");
  }

  if (manifests.length === 0) {
    warnings.push("No standard project manifest was detected.");
  }

  if (lockFiles.length === 0 && manifests.includes("package.json")) {
    warnings.push("package.json exists without a detected JavaScript lockfile.");
  }

  if (instructionFiles.length === 0) {
    warnings.push("No existing AGENTS.md, CLAUDE.md, CODEX.md, Cursor rules, or Copilot instruction file was detected.");
  }

  if (files.some((file) => isSecretEnvFile(file.name))) {
    warnings.push("Secret-looking `.env` files were detected and intentionally not listed. Prefer env examples for agent context.");
  }

  return warnings;
}

function isSafeEnvTemplate(fileName) {
  const lower = fileName.toLowerCase();
  return lower === ".env.example"
    || lower === ".env.sample"
    || lower === ".env.template"
    || lower === ".env.defaults"
    || (lower.startsWith(".env.") && /(\.example|\.sample|\.template|\.defaults)$/.test(lower));
}

function isSecretEnvFile(fileName) {
  const lower = fileName.toLowerCase();
  return (lower === ".env" || lower.startsWith(".env.")) && !isSafeEnvTemplate(lower);
}

function appendList(lines, label, items) {
  if (!items || items.length === 0) {
    lines.push(`- ${label}: none detected`);
    return;
  }

  lines.push(`- ${label}: ${items.map((item) => `\`${item}\``).join(", ")}`);
}

function appendSignals(lines, label, items) {
  if (!items || items.length === 0) {
    lines.push(`- ${label}: none detected`);
    return;
  }

  const formatted = items.map((item) => `\`${item.name}\` (${item.evidence})`);
  lines.push(`- ${label}: ${formatted.join(", ")}`);
}

function formatLanguageSummary(languages) {
  if (!languages || languages.length === 0) {
    return "not detected";
  }

  return languages
    .slice(0, 5)
    .map((item) => `${item.language} (${item.files})`)
    .join(", ");
}

function readJsonIfPresent(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const stat = fs.statSync(filePath);
  if (stat.size > MAX_TEXT_BYTES) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readManifestTexts(byPath) {
  const manifestNames = [
    "requirements.txt",
    "pyproject.toml",
    "Gemfile",
    "go.mod",
    "Cargo.toml",
    "mix.exs",
    "pubspec.yaml"
  ];
  const texts = new Map();

  for (const name of manifestNames) {
    const filePath = byPath.get(name)?.absolute;

    if (!filePath || !fs.existsSync(filePath)) {
      continue;
    }

    const stat = fs.statSync(filePath);
    if (stat.size > MAX_TEXT_BYTES) {
      continue;
    }

    try {
      texts.set(name, fs.readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }
  }

  return texts;
}

function collectDependencyNames(manifest, fields) {
  const names = new Set();

  for (const field of fields) {
    const dependencies = manifest?.[field];

    if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) {
      continue;
    }

    for (const name of Object.keys(dependencies)) {
      names.add(name);
    }
  }

  return names;
}

function addDependencySignal(signals, names, dependency, framework, evidencePrefix = "package.json dependency") {
  if (!names.has(dependency)) {
    return;
  }

  signals.push({ name: framework, evidence: `${evidencePrefix}: ${dependency}` });
}

function addManifestTextSignal(signals, manifestTexts, manifestNames, pattern, framework) {
  for (const manifestName of manifestNames) {
    const text = manifestTexts.get(manifestName);

    if (text && pattern.test(text)) {
      signals.push({ name: framework, evidence: `${manifestName} signal` });
      return;
    }
  }
}

function addPathSignal(signals, files, framework, predicate) {
  const match = files.find(predicate);

  if (match) {
    signals.push({ name: framework, evidence: `path: ${match.relative}` });
  }
}

function uniqueSignals(signals) {
  return uniqueBy(signals, (signal) => signal.name);
}

function formatWorkspaceGlobs(workspaces) {
  const globs = Array.isArray(workspaces) ? workspaces : workspaces?.packages;

  if (!Array.isArray(globs)) {
    return "";
  }

  return globs
    .filter((item) => typeof item === "string")
    .slice(0, 4)
    .join(", ");
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

function parsePositiveInt(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer`);
  }

  return parsed;
}

function parseTarget(value, flag) {
  const target = value.toLowerCase();

  if (!TARGET_OUTPUTS.has(target)) {
    throw new Error(`${flag} must be one of: ${Array.from(TARGET_OUTPUTS.keys()).join(", ")}`);
  }

  return target;
}

function collectGeneratedOutputFiles(root, output) {
  const generatedFiles = new Set([DEFAULT_OUTPUT.toLowerCase()]);

  if (!output) {
    return generatedFiles;
  }

  const outputPath = path.resolve(root, output);
  const relative = path.relative(root, outputPath);

  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    generatedFiles.add(toPosix(relative).toLowerCase());
  }

  return generatedFiles;
}

function formatUpdateCommand(options) {
  if (options.target) {
    return `agent-rake --target ${options.target}`;
  }

  return `agent-rake --out ${options.output}`;
}

function readPackageVersion() {
  const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const packageJson = readJsonIfPresent(packagePath);
  return packageJson?.version ?? "0.0.0";
}

function helpText() {
  return `agent-rake

Rake a repository into an agent-ready brief.

Usage:
  agent-rake [path] [options]

Options:
  --root <path>       Repository root. Defaults to the current directory.
  --out <file>        Output file. Defaults to AGENT_BRIEF.md.
  --target <name>     Output to a known agent file: agents, claude, codex, copilot, cursor.
  --no-write          Print Markdown to stdout instead of writing a file.
  --print             Alias for --no-write.
  --json              Print the scan result as JSON.
  --check             Fail if the output file is missing or stale.
  --max-files <n>     Maximum files to scan. Defaults to ${DEFAULT_MAX_FILES}.
  --quiet             Suppress success output when writing.
  --version, -v       Print version.
  --help, -h          Print help.
`;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, "\n");
}

function formatDisplayPath(filePath) {
  return path.relative(process.cwd(), filePath) || filePath;
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}
