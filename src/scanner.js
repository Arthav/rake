import fs from "node:fs";
import path from "node:path";

import {
  AGENT_INSTRUCTION_FILES,
  DEFAULT_MAX_FILES,
  DEFAULT_OUTPUT,
  DOC_FILES,
  EXTENSION_LANGUAGES,
  GENERATED_FILE_NAMES,
  HIDDEN_PACKAGE_SCRIPTS,
  IGNORED_DIRS,
  JAVASCRIPT_LOCK_FILES,
  LOCK_FILES,
  MANIFEST_FILES,
  MAX_ROUTE_HINT_BYTES,
  MAX_TEXT_BYTES
} from "./constants.js";

export function scanRepositoryCore(root = process.cwd(), options = {}) {
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
  const customIgnores = normalizeIgnorePatterns(options.customIgnores ?? options.ignore ?? []);
  const walkResult = walkFiles(absoluteRoot, { maxFiles, generatedFiles, customIgnores });
  const files = walkResult.files;
  const byPath = new Map(files.map((file) => [file.relative, file]));

  const manifests = collectKnown(files, MANIFEST_FILES);
  const lockFiles = collectKnown(files, LOCK_FILES);
  const docs = collectKnown(files, DOC_FILES);
  const instructionFiles = collectAgentInstructions(files);
  const packageJson = readJsonIfPresent(byPath.get("package.json")?.absolute);
  const composerJson = readJsonIfPresent(byPath.get("composer.json")?.absolute);
  const manifestTexts = readManifestTexts(byPath);
  const taskFileTexts = readTaskFileTexts(byPath);

  const languageSummary = summarizeLanguages(files);
  const packageManager = detectPackageManager(packageJson, lockFiles, manifests);

  const scan = {
    tool: "agent-rake",
    generatedAt: new Date().toISOString(),
    root: path.basename(absoluteRoot),
    absoluteRoot,
    displayRoot: path.basename(absoluteRoot),
    filesScanned: files.length,
    truncated: walkResult.truncated,
    ignoredDirectories: Array.from(IGNORED_DIRS).sort(),
    configFile: options.configFile ?? null,
    customIgnores,
    languages: languageSummary,
    packageManager,
    frameworks: detectFrameworks({ files, packageJson, composerJson, manifestTexts }),
    workspaces: detectWorkspaces({ files, packageJson, manifestTexts }),
    manifests,
    lockFiles,
    docs,
    instructionFiles,
    commands: inferCommands({ packageJson, composerJson, manifests, lockFiles, packageManager, files, manifestTexts, taskFileTexts }),
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

  if (options.explain) {
    scan.explain = true;
    scan.explanations = collectExplanations(scan);
  }

  return scan;
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
        if (shouldIgnoreDirectory(entry.name) || shouldIgnoreCustomPath(relative, entry.name, options.customIgnores)) {
          continue;
        }

        visit(absolute);
        continue;
      }

      if (!entry.isFile()
        || GENERATED_FILE_NAMES.has(entry.name.toLowerCase())
        || options.generatedFiles?.has(relative.toLowerCase())
        || shouldIgnoreCustomPath(relative, entry.name, options.customIgnores)) {
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

function shouldIgnoreCustomPath(relative, name, patterns = []) {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  const lowerRelative = relative.toLowerCase();
  const lowerName = name.toLowerCase();
  const segments = lowerRelative.split("/");

  return patterns.some((pattern) => {
    if (pattern.includes("/")) {
      return lowerRelative === pattern || lowerRelative.startsWith(`${pattern}/`);
    }

    return lowerName === pattern || segments.includes(pattern);
  });
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

function detectPackageManager(packageJson, lockFiles, manifests) {
  if (packageJson?.packageManager) {
    return packageJson.packageManager.split("@")[0];
  }

  const lockSet = new Set(lockFiles);
  const manifestSet = new Set(manifests);
  if (lockSet.has("pnpm-lock.yaml")) return "pnpm";
  if (lockSet.has("yarn.lock")) return "yarn";
  if (lockSet.has("bun.lock") || lockSet.has("bun.lockb")) return "bun";
  if (lockSet.has("deno.lock")) return "deno";
  if (lockSet.has("package-lock.json")) return "npm";
  if (lockSet.has("uv.lock")) return "uv";
  if (lockSet.has("poetry.lock")) return "poetry";
  if (lockSet.has("Pipfile.lock")) return "pipenv";
  if (lockSet.has("Cargo.lock")) return "cargo";
  if (lockSet.has("go.sum")) return "go";
  if (lockSet.has("composer.lock") || lockSet.has("symfony.lock")) return "composer";
  if (lockSet.has("Gemfile.lock")) return "bundler";
  if (lockSet.has("pubspec.lock")) return "dart/flutter";
  if (lockSet.has("mix.lock")) return "mix";
  if (lockSet.has("gradle.lockfile")) return "gradle";
  if (packageJson) return "npm";
  if (manifestSet.has("Pipfile")) return "pipenv";
  if (manifestSet.has("composer.json")) return "composer";
  if (manifestSet.has("Gemfile")) return "bundler";
  if (manifestSet.has("pom.xml")) return "maven";
  if (manifestSet.has("build.gradle") || manifestSet.has("build.gradle.kts")) return "gradle";

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
  addManifestTextSignal(signals, manifestTexts, ["pom.xml", "build.gradle", "build.gradle.kts"], /spring-boot|springframework/i, "Spring");
  addManifestTextSignal(signals, manifestTexts, ["pubspec.yaml"], /^\s*flutter\s*:/im, "Flutter");

  addPathSignal(signals, files, "Next.js", (file) => /^app\/(?:.*\/)?(page|layout|route)\.[cm]?[jt]sx?$/i.test(file.relative)
    || /^pages\/.*\.[cm]?[jt]sx?$/i.test(file.relative));
  addPathSignal(signals, files, "Remix", (file) => /^app\/routes\/.+\.[cm]?[jt]sx?$/i.test(file.relative));
  addPathSignal(signals, files, "SvelteKit", (file) => /^src\/routes\/(?:.*\/)?(\+page|\+layout|\+server)\.(svelte|[jt]s)$/i.test(file.relative));
  addPathSignal(signals, files, "Django", (file) => file.relative === "manage.py" || /(^|\/)(settings|urls)\.py$/i.test(file.relative));
  addPathSignal(signals, files, "Rails", (file) => file.relative === "config/routes.rb");
  addPathSignal(signals, files, "Laravel", (file) => file.relative === "artisan" || /^routes\/(api|web|console|channels)\.php$/i.test(file.relative));
  addPathSignal(signals, files, "Symfony", (file) => file.relative === "symfony.lock" || file.relative === "config/bundles.php");
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

function inferCommands({ packageJson, composerJson, manifests, lockFiles, packageManager, files, manifestTexts, taskFileTexts }) {
  const commands = [];
  const manifestSet = new Set(manifests);
  const lockSet = new Set(lockFiles);
  const fileSet = new Set(files.map((file) => file.relative));

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

  if (manifestSet.has("pyproject.toml") || manifestSet.has("requirements.txt") || manifestSet.has("Pipfile")) {
    commands.push(inferPythonTestCommand({ fileSet, lockSet }));
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

  if (manifestSet.has("mix.exs")) {
    commands.push({ command: "mix test", reason: "Elixir Mix project" });
  }

  if (/gem\s+["']rails["']/i.test(manifestTexts.get("Gemfile") ?? "")) {
    commands.push({ command: "bundle exec rails test", reason: "Rails Gemfile" });
  }

  if (fileSet.has("artisan")) {
    commands.push({ command: "php artisan test", reason: "Laravel artisan" });
  }

  if (fileSet.has("bin/phpunit")) {
    commands.push({ command: "php bin/phpunit", reason: "PHPUnit binary" });
  }

  if (manifestSet.has("pom.xml")) {
    commands.push({ command: "mvn test", reason: "Maven project" });
  }

  if (manifestSet.has("build.gradle") || manifestSet.has("build.gradle.kts")) {
    const gradleCommand = fileSet.has("gradlew")
      ? "./gradlew test"
      : fileSet.has("gradlew.bat")
        ? "gradlew.bat test"
      : "gradle test";
    const gradleReason = gradleCommand === "gradle test" ? "Gradle project" : "Gradle wrapper";
    commands.push({ command: gradleCommand, reason: gradleReason });
  }

  if (composerJson?.scripts && typeof composerJson.scripts === "object") {
    for (const scriptName of preferredScriptOrder(Object.keys(composerJson.scripts))) {
      commands.push({ command: `composer ${scriptName}`, reason: "composer.json script" });
    }
  }

  commands.push(...inferTaskFileCommands(taskFileTexts));

  return uniqueBy(commands, (command) => command.command).slice(0, 12);
}

function inferPythonTestCommand({ fileSet, lockSet }) {
  const runner = inferPythonRunner(lockSet);

  if (fileSet.has("manage.py")) {
    return {
      command: runner ? `${runner} python manage.py test` : "python manage.py test",
      reason: "Django manage.py"
    };
  }

  return {
    command: runner ? `${runner} pytest` : "python -m pytest",
    reason: "Python project signal"
  };
}

function inferPythonRunner(lockSet) {
  if (lockSet.has("uv.lock")) return "uv run";
  if (lockSet.has("poetry.lock")) return "poetry run";
  if (lockSet.has("Pipfile.lock")) return "pipenv run";

  return null;
}

function preferredScriptOrder(scriptNames) {
  const priority = ["dev", "start", "test", "lint", "typecheck", "check", "build", "format"];
  const visibleScripts = scriptNames.filter((scriptName) => !HIDDEN_PACKAGE_SCRIPTS.has(scriptName));
  const known = priority.filter((scriptName) => visibleScripts.includes(scriptName));
  const rest = visibleScripts.filter((scriptName) => !priority.includes(scriptName)).sort();
  return [...known, ...rest].slice(0, 10);
}

function inferTaskFileCommands(taskFileTexts) {
  const commands = [];
  const taskSources = [
    {
      names: ["Makefile", "makefile", "GNUmakefile"],
      runner: "make",
      parser: parseMakeTargets
    },
    {
      names: ["justfile", "Justfile"],
      runner: "just",
      parser: parseJustTargets
    },
    {
      names: ["Taskfile.yml", "Taskfile.yaml"],
      runner: "task",
      parser: parseTaskfileTargets
    }
  ];

  for (const source of taskSources) {
    const name = source.names.find((candidate) => taskFileTexts.has(candidate));
    if (!name) {
      continue;
    }

    for (const target of source.parser(taskFileTexts.get(name))) {
      commands.push({
        command: `${source.runner} ${target}`,
        reason: `${name} target`
      });
    }
  }

  return commands;
}

function parseMakeTargets(text) {
  const targets = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line || /^\s/.test(line) || line.trimStart().startsWith("#") || line.includes(":=")) {
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_. -]+)\s*:/);
    if (!match) {
      continue;
    }

    for (const target of match[1].trim().split(/\s+/)) {
      if (isTaskTargetName(target)) {
        targets.push(target);
      }
    }
  }

  return preferredScriptOrder(targets);
}

function parseJustTargets(text) {
  const targets = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line || /^\s/.test(line) || line.trimStart().startsWith("#") || line.trimStart().startsWith("[") || line.includes(":=")) {
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+)(?:\s+[^:=]+)?\s*:/);
    if (match && isTaskTargetName(match[1])) {
      targets.push(match[1]);
    }
  }

  return preferredScriptOrder(targets);
}

function parseTaskfileTargets(text) {
  const targets = [];
  let inTasks = false;

  for (const line of text.split(/\r?\n/)) {
    if (/^tasks:\s*(?:#.*)?$/.test(line)) {
      inTasks = true;
      continue;
    }

    if (!inTasks) {
      continue;
    }

    if (/^\S/.test(line) && !line.startsWith("tasks:")) {
      break;
    }

    const match = line.match(/^ {2}([A-Za-z0-9_-]+)\s*:/);
    if (match && isTaskTargetName(match[1])) {
      targets.push(match[1]);
    }
  }

  return preferredScriptOrder(targets);
}

function isTaskTargetName(target) {
  return /^(dev|start|test|lint|typecheck|check|build|format|smoke|ci|release|clean|install)$/.test(target);
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
    || lower.includes("/controller/")
    || lower.includes("/api/")
    || /^src\/main\/java\/.+controller\/.+controller\.java$/.test(lower)
    || /^src\/main\/kotlin\/.+controller\/.+controller\.kt$/.test(lower)
    || /^src\/main\/java\/.+controller\.java$/.test(lower)
    || /^src\/main\/kotlin\/.+controller\.kt$/.test(lower)
    || /^app\/(?:.*\/)?(page|route)\.[cm]?[jt]sx?$/.test(lower)
    || /^pages\/.+\.[cm]?[jt]sx?$/.test(lower)
    || /^src\/routes\/(?:.*\/)?(\+page|\+server)\.(svelte|[jt]s)$/.test(lower)
    || /^routes\/(api|web|console|channels)\.php$/.test(lower)
    || /^config\/routes\.rb$/.test(lower)
    || /(^|\/)route\.[cm]?[jt]s$/.test(lower)
    || /(^|\/)router\.ex$/.test(lower)
    || /^lib\/[^/]+_web\/router\.ex$/.test(lower)
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
    || /^((src|server|app|api|routes|controllers)\/)?(main|app|api|server|routes|views)\.py$/.test(lower)
    || /^((cmd\/[^/]+|src|server|app|api|routes|controllers)\/)?(main|server|app|api|router|routes)\.go$/.test(lower);
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

  if (/\bapp\.add_api_route\s*\(\s*["']\//i.test(text)) {
    return true;
  }

  if (file.ext.toLowerCase() !== ".go") {
    return false;
  }

  if (/\bhttp\s*\.\s*Handle(?:Func)?\s*\(\s*["'`]\//i.test(text)) {
    return true;
  }

  if (/\b\w+\s*\.\s*(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|Any|All|Get|Post|Put|Patch|Delete|Options|Head|Handle|HandleFunc|Route|Group)\s*\(\s*["'`]\//.test(text)) {
    return true;
  }

  return /\b\w+\s*\.\s*HandleFunc\s*\(\s*["'`]\/[^"'`]*["'`]\s*,/.test(text);
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
        || /^priv\/[^/]*repo\/migrations\/[^/]+\.exs$/.test(lower)
        || /(^|\/)drizzle\.config\.[cm]?[jt]s$/.test(lower)
        || /(^|\/)migrations\/[^/]+\.py$/.test(lower)
        || /(^|\/)migrations\/[^/]+\.sql$/.test(lower)
        || /(^|\/)migrations\/versions\/[^/]+\.py$/.test(lower)
        || /^src\/main\/resources\/db\/migration\/[^/]+\.(sql|java|kt)$/.test(lower)
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
  const configPattern = /(^|\/)(\.agent-rake\.json|angular\.json|astro\.config|biome\.json|config\/(app|bundles|database|routes|services)\.(php|ya?ml)|config\/(config|runtime|dev|test|prod)\.exs|config\/packages\/[^/]+\.(php|ya?ml)|cypress\.config|drizzle\.config|eslint\.config|go\.work|gradle\.properties|jest\.config|jsconfig|justfile|makefile|melos\.yaml|mypy\.ini|next\.config|nuxt\.config|nx\.json|phpstan\.neon|phpunit\.xml|phpunit\.xml\.dist|pint\.json|playwright\.config|pnpm-workspace\.yaml|prettier\.config|prisma\/schema|pytest\.ini|rector\.php|remix\.config|ruff\.toml|settings\.gradle|settings\.gradle\.kts|src\/main\/resources\/application\.(properties|ya?ml)|svelte\.config|tailwind\.config|taskfile\.ya?ml|tsconfig|turbo\.json|vite\.config|(?:settings|asgi|wsgi)\.py)/i;

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

  if (!hasJavaScriptLockFile(lockFiles) && manifests.includes("package.json")) {
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

function hasJavaScriptLockFile(lockFiles) {
  return lockFiles.some((file) => JAVASCRIPT_LOCK_FILES.has(file));
}

export function normalizeIgnorePatterns(patterns = []) {
  return uniqueBy(patterns.map((pattern) => normalizeIgnorePattern(pattern, "--ignore")), (pattern) => pattern);
}

export function normalizeIgnorePattern(value, flag) {
  const pattern = String(value)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/\/+$/, "");

  if (!pattern) {
    throw new Error(`${flag} requires a non-empty path or name`);
  }

  return pattern.toLowerCase();
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

function collectExplanations(scan) {
  const explanations = [];

  for (const command of scan.commands) {
    explanations.push({
      category: "Command",
      item: command.command,
      reason: command.reason
    });
  }

  for (const framework of scan.frameworks) {
    explanations.push({
      category: "Framework signal",
      item: framework.name,
      reason: framework.evidence
    });
  }

  for (const workspace of scan.workspaces) {
    explanations.push({
      category: "Workspace signal",
      item: workspace.name,
      reason: workspace.evidence
    });
  }

  appendFileExplanations(explanations, "Manifest", scan.manifests, () => "standard project manifest filename");
  appendFileExplanations(explanations, "Lockfile", scan.lockFiles, () => "dependency lockfile filename");
  appendFileExplanations(explanations, "Doc", scan.docs, () => "known repository documentation filename");
  appendFileExplanations(explanations, "Agent instructions", scan.instructionFiles, (file) => {
    if (file.startsWith(".cursor/rules/")) {
      return "Cursor rule file path";
    }

    return "known agent instruction filename";
  });
  appendFileExplanations(explanations, "Entrypoint", scan.entrypoints, explainEntrypoint);
  appendFileExplanations(explanations, "Routes and APIs", scan.routeFiles, explainRouteFile);
  appendFileExplanations(explanations, "Test", scan.testFiles, () => "test path or test filename convention");
  appendFileExplanations(explanations, "Environment file", scan.envFiles, () => "safe env template filename");
  appendFileExplanations(explanations, "Data and schema file", scan.dataFiles, explainDataFile);
  appendFileExplanations(explanations, "CI", scan.ciFiles, explainCiFile);
  appendFileExplanations(explanations, "Config", scan.configFiles, () => "known config filename or path convention");
  appendFileExplanations(explanations, "Risk hotspot", scan.hotspotFiles, explainHotspot);

  return uniqueBy(explanations, (item) => `${item.category}:${item.item}`).slice(0, 160);
}

function appendFileExplanations(explanations, category, files = [], reasonFn) {
  for (const file of files) {
    explanations.push({
      category,
      item: file,
      reason: reasonFn(file)
    });
  }
}

function explainEntrypoint(file) {
  if (/^(src|app|pages)\//.test(file)) {
    return "framework or source-root entrypoint convention";
  }

  return "conventional application entrypoint filename";
}

function explainRouteFile(file) {
  if (isRoutePathFile({ relative: file })) {
    return "route/API path convention";
  }

  return "bounded route declaration found in a likely entrypoint file";
}

function explainDataFile(file) {
  const lower = file.toLowerCase();

  if (lower === "prisma/schema.prisma") return "Prisma schema path";
  if (lower.startsWith("drizzle/") || lower.includes("drizzle.config")) return "Drizzle schema or migration path";
  if (lower.startsWith("db/migrate/")) return "Rails migration path";
  if (lower.startsWith("database/migrations/")) return "Laravel migration path";
  if (lower.startsWith("alembic/versions/") || lower === "alembic.ini") return "Alembic migration path";
  if (lower.startsWith("priv/") && lower.includes("/repo/migrations/")) return "Ecto migration path";
  if (lower.startsWith("src/main/resources/db/migration/")) return "Flyway migration path";
  if (lower.includes("/migrations/") || lower.startsWith("migrations/")) return "migration path convention";
  if (lower.endsWith("schema.sql") || lower === "db/schema.rb" || lower === "db/structure.sql") return "database schema filename";

  return "data model, schema, seed, or migration path convention";
}

function explainCiFile(file) {
  if (file.startsWith(".github/workflows/")) {
    return "GitHub Actions workflow path";
  }

  return "container or CI config filename";
}

function explainHotspot(file) {
  const match = file.match(/auth|permission|security|policy|billing|payment|stripe|webhook|migration|schema|database|db|prisma|drizzle|queue|worker|cron|seed|secret|token/i);
  const keyword = match ? match[0].toLowerCase() : "risk";
  return `path contains operational risk keyword: ${keyword}`;
}

export function readJsonIfPresent(filePath) {
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
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
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

function readTaskFileTexts(byPath) {
  const taskFileNames = [
    "Makefile",
    "makefile",
    "GNUmakefile",
    "justfile",
    "Justfile",
    "Taskfile.yml",
    "Taskfile.yaml"
  ];
  const texts = new Map();

  for (const name of taskFileNames) {
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

function collectGeneratedOutputFiles(root, output) {
  const generatedFiles = new Set([DEFAULT_OUTPUT.toLowerCase()]);
  const outputs = Array.isArray(output) ? output : [output];

  for (const item of outputs) {
    if (!item) {
      continue;
    }

    const outputPath = path.resolve(root, item);
    const relative = path.relative(root, outputPath);

    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      generatedFiles.add(toPosix(relative).toLowerCase());
    }
  }

  return generatedFiles;
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

export function toPosix(value) {
  return value.split(path.sep).join("/");
}
