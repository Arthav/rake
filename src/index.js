import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALL_TARGETS,
  COMPLETION_SHELLS,
  DEFAULT_CONFIG,
  DEFAULT_MAX_FILES,
  DEFAULT_OUTPUT,
  GITHUB_ACTIONS_WORKFLOW,
  TARGET_OUTPUTS
} from "./constants.js";
import {
  renderCompletion,
  renderConfigExample,
  renderDoctor,
  renderEffectiveConfig,
  renderGitHubActionsWorkflow,
  renderMarkdown,
  renderOutputDiff,
  renderRepositoryConfig,
  renderSummary,
  renderTargets
} from "./renderers.js";
import {
  normalizeIgnorePattern,
  normalizeIgnorePatterns,
  readJsonIfPresent,
  scanRepositoryCore,
  toPosix
} from "./scanner.js";

export { DEFAULT_OUTPUT } from "./constants.js";
export {
  renderCompletion,
  renderConfigExample,
  renderDoctor,
  renderEffectiveConfig,
  renderGitHubActionsWorkflow,
  renderMarkdown,
  renderOutputDiff,
  renderRepositoryConfig,
  renderSummary,
  renderTargets
} from "./renderers.js";

export function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    output: DEFAULT_OUTPUT,
    write: true,
    json: false,
    check: false,
    diff: false,
    doctor: false,
    githubActions: false,
    installGitHubActions: false,
    setup: false,
    summary: false,
    targets: false,
    explain: false,
    strict: false,
    force: false,
    configExample: false,
    initConfig: false,
    showConfig: false,
    completion: null,
    config: true,
    configPath: DEFAULT_CONFIG,
    customIgnores: [],
    maxFiles: DEFAULT_MAX_FILES,
    quiet: false,
    printWasSet: false,
    outputWasSet: false,
    maxFilesWasSet: false
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

    if (arg === "--diff") {
      options.diff = true;
      options.check = true;
      options.write = false;
      continue;
    }

    if (arg === "--github-actions" || arg === "--ci-workflow") {
      options.githubActions = true;
      options.write = false;
      continue;
    }

    if (arg === "--install-github-actions" || arg === "--init-github-actions") {
      options.installGitHubActions = true;
      options.write = false;
      continue;
    }

    if (arg === "--setup" || arg === "--bootstrap") {
      options.setup = true;
      options.write = false;
      continue;
    }

    if (arg === "--config-example" || arg === "--print-config") {
      options.configExample = true;
      options.write = false;
      continue;
    }

    if (arg === "--init-config" || arg === "--install-config") {
      options.initConfig = true;
      options.write = false;
      continue;
    }

    if (arg === "--show-config" || arg === "--effective-config") {
      options.showConfig = true;
      options.write = false;
      continue;
    }

    if (arg === "--completion") {
      options.completion = parseCompletionShell(requireValue(argv, index, arg), arg);
      options.write = false;
      index += 1;
      continue;
    }

    if (arg.startsWith("--completion=")) {
      options.completion = parseCompletionShell(arg.slice("--completion=".length), "--completion");
      options.write = false;
      continue;
    }

    if (arg === "--doctor" || arg === "--health") {
      options.doctor = true;
      options.write = false;
      continue;
    }

    if (arg === "--targets" || arg === "--list-targets") {
      options.targets = true;
      options.write = false;
      continue;
    }

    if (arg === "--summary" || arg === "--stats") {
      options.summary = true;
      options.write = false;
      continue;
    }

    if (arg === "--no-write" || arg === "--print" || arg === "--dry-run") {
      options.write = false;
      options.printWasSet = true;
      continue;
    }

    if (arg === "--quiet") {
      options.quiet = true;
      continue;
    }

    if (arg === "--strict" || arg === "--fail-on-warnings") {
      options.strict = true;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--config") {
      options.config = true;
      options.configPath = requireValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--config=")) {
      options.config = true;
      options.configPath = arg.slice("--config=".length);
      continue;
    }

    if (arg === "--no-config") {
      options.config = false;
      continue;
    }

    if (arg === "--ignore") {
      options.customIgnores.push(normalizeIgnorePattern(requireValue(argv, index, arg), arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--ignore=")) {
      options.customIgnores.push(normalizeIgnorePattern(arg.slice("--ignore=".length), "--ignore"));
      continue;
    }

    if (arg === "--explain" || arg === "--why") {
      options.explain = true;
      continue;
    }

    if (arg === "--out" || arg === "--output") {
      options.output = requireValue(argv, index, arg);
      options.outputWasSet = true;
      outputWasSet = true;
      index += 1;
      continue;
    }

    if (arg.startsWith("--out=")) {
      options.output = arg.slice("--out=".length);
      options.outputWasSet = true;
      outputWasSet = true;
      continue;
    }

    if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
      options.outputWasSet = true;
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
      options.maxFilesWasSet = true;
      index += 1;
      continue;
    }

    if (arg.startsWith("--max-files=")) {
      options.maxFiles = parsePositiveInt(arg.slice("--max-files=".length), "--max-files");
      options.maxFilesWasSet = true;
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

  if (options.setup && options.printWasSet) {
    throw new Error("--setup cannot be used with --no-write, --print, or --dry-run");
  }

  if (options.setup && options.config === false) {
    throw new Error("--setup cannot be used with --no-config");
  }

  if (options.targets && outputWasSet) {
    throw new Error("--targets cannot be used with --out or --output");
  }

  if (options.targets && options.target) {
    throw new Error("--targets cannot be used with --target");
  }

  if (options.githubActions && options.target) {
    throw new Error("--github-actions cannot be used with --target");
  }

  if (options.githubActions && outputWasSet) {
    throw new Error("--github-actions cannot be used with --out or --output");
  }

  if (options.installGitHubActions && options.target) {
    throw new Error("--install-github-actions cannot be used with --target");
  }

  if (options.installGitHubActions && outputWasSet) {
    throw new Error("--install-github-actions cannot be used with --out or --output");
  }

  if (options.configExample && options.target) {
    throw new Error("--config-example cannot be used with --target");
  }

  if (options.configExample && outputWasSet) {
    throw new Error("--config-example cannot be used with --out or --output");
  }

  if (options.showConfig && options.setup) {
    throw new Error("--show-config cannot be used with --setup");
  }

  if (options.showConfig && options.configExample) {
    throw new Error("--show-config cannot be used with --config-example");
  }

  if (options.showConfig && options.initConfig) {
    throw new Error("--show-config cannot be used with --init-config");
  }

  if (options.summary && outputWasSet) {
    throw new Error("--summary cannot be used with --out or --output");
  }

  if (options.summary && options.target) {
    throw new Error("--summary cannot be used with --target");
  }

  if (options.target) {
    options.output = resolveTargetOutputs(options.target);
  }

  return options;
}

export async function runCli(argv = process.argv.slice(2), io = process) {
  let options = parseArgs(argv);

  if (options.help) {
    io.stdout.write(helpText());
    return;
  }

  if (options.version) {
    io.stdout.write(`${readPackageVersion()}\n`);
    return;
  }

  if (options.completion) {
    if (options.check || options.diff) {
      throw new Error("--completion cannot be used with --check or --diff");
    }

    if (options.json) {
      throw new Error("--completion cannot be used with --json");
    }

    if (options.setup) {
      throw new Error("--completion cannot be used with --setup");
    }

    if (options.summary) {
      throw new Error("--completion cannot be used with --summary");
    }

    if (options.doctor) {
      throw new Error("--completion cannot be used with --doctor");
    }

    if (options.targets) {
      throw new Error("--completion cannot be used with --targets");
    }

    if (options.githubActions) {
      throw new Error("--completion cannot be used with --github-actions");
    }

    if (options.installGitHubActions) {
      throw new Error("--completion cannot be used with --install-github-actions");
    }

    if (options.configExample) {
      throw new Error("--completion cannot be used with --config-example");
    }

    if (options.initConfig) {
      throw new Error("--completion cannot be used with --init-config");
    }

    if (options.showConfig) {
      throw new Error("--completion cannot be used with --show-config");
    }

    if (options.target) {
      throw new Error("--completion cannot be used with --target");
    }

    if (options.outputWasSet) {
      throw new Error("--completion cannot be used with --out or --output");
    }

    if (options.strict) {
      throw new Error("--completion cannot be used with --strict");
    }

    io.stdout.write(renderCompletion(options.completion));
    return;
  }

  if (options.setup) {
    if (options.check || options.diff) {
      throw new Error("--setup cannot be used with --check or --diff");
    }

    if (options.json) {
      throw new Error("--setup cannot be used with --json");
    }

    if (options.summary) {
      throw new Error("--setup cannot be used with --summary");
    }

    if (options.doctor) {
      throw new Error("--setup cannot be used with --doctor");
    }

    if (options.targets) {
      throw new Error("--setup cannot be used with --targets");
    }

    if (options.githubActions) {
      throw new Error("--setup cannot be used with --github-actions");
    }

    if (options.installGitHubActions) {
      throw new Error("--setup cannot be used with --install-github-actions");
    }

    if (options.configExample) {
      throw new Error("--setup cannot be used with --config-example");
    }

    if (options.initConfig) {
      throw new Error("--setup cannot be used with --init-config");
    }

    if (options.strict) {
      throw new Error("--setup cannot be used with --strict");
    }

    const result = setupRepository(options);
    if (!options.quiet) {
      io.stdout.write(renderSetupResult(result));
    }
    return;
  }

  if (options.configExample) {
    if (options.check || options.diff) {
      throw new Error("--config-example cannot be used with --check or --diff");
    }

    if (options.json) {
      throw new Error("--config-example cannot be used with --json");
    }

    if (options.summary) {
      throw new Error("--config-example cannot be used with --summary");
    }

    if (options.doctor) {
      throw new Error("--config-example cannot be used with --doctor");
    }

    if (options.targets) {
      throw new Error("--config-example cannot be used with --targets");
    }

    if (options.githubActions) {
      throw new Error("--config-example cannot be used with --github-actions");
    }

    if (options.installGitHubActions) {
      throw new Error("--config-example cannot be used with --install-github-actions");
    }

    if (options.initConfig) {
      throw new Error("--config-example cannot be used with --init-config");
    }

    if (options.strict) {
      throw new Error("--config-example cannot be used with --strict");
    }

    io.stdout.write(renderConfigExample());
    return;
  }

  if (options.initConfig) {
    if (options.check || options.diff) {
      throw new Error("--init-config cannot be used with --check or --diff");
    }

    if (options.json) {
      throw new Error("--init-config cannot be used with --json");
    }

    if (options.summary) {
      throw new Error("--init-config cannot be used with --summary");
    }

    if (options.doctor) {
      throw new Error("--init-config cannot be used with --doctor");
    }

    if (options.targets) {
      throw new Error("--init-config cannot be used with --targets");
    }

    if (options.githubActions) {
      throw new Error("--init-config cannot be used with --github-actions");
    }

    if (options.installGitHubActions) {
      throw new Error("--init-config cannot be used with --install-github-actions");
    }

    if (options.strict) {
      throw new Error("--init-config cannot be used with --strict");
    }

    const outputPath = installRepositoryConfig(options.root, options);
    if (!options.quiet) {
      io.stdout.write(`Wrote ${formatDisplayPath(outputPath)}\n`);
    }
    return;
  }

  if (options.showConfig) {
    if (options.check || options.diff) {
      throw new Error("--show-config cannot be used with --check or --diff");
    }

    if (options.json) {
      throw new Error("--show-config cannot be used with --json");
    }

    if (options.summary) {
      throw new Error("--show-config cannot be used with --summary");
    }

    if (options.doctor) {
      throw new Error("--show-config cannot be used with --doctor");
    }

    if (options.targets) {
      throw new Error("--show-config cannot be used with --targets");
    }

    if (options.githubActions) {
      throw new Error("--show-config cannot be used with --github-actions");
    }

    if (options.installGitHubActions) {
      throw new Error("--show-config cannot be used with --install-github-actions");
    }

    if (options.strict) {
      throw new Error("--show-config cannot be used with --strict");
    }

    const mergedOptions = applyRepositoryConfig(options.root, options);
    io.stdout.write(renderEffectiveConfig(toEffectiveConfigJson(options.root, mergedOptions)));
    return;
  }

  if (options.targets) {
    if (options.diff) {
      throw new Error("--targets cannot be used with --diff");
    }

    if (options.check) {
      throw new Error("--targets cannot be used with --check");
    }

    if (options.json) {
      throw new Error("--targets cannot be used with --json");
    }

    if (options.summary) {
      throw new Error("--targets cannot be used with --summary");
    }

    if (options.doctor) {
      throw new Error("--targets cannot be used with --doctor");
    }

    if (options.installGitHubActions) {
      throw new Error("--targets cannot be used with --install-github-actions");
    }

    if (options.strict) {
      throw new Error("--targets cannot be used with --strict");
    }

    io.stdout.write(renderTargets());
    return;
  }

  if (options.githubActions) {
    if (options.check) {
      throw new Error("--github-actions cannot be used with --check or --diff");
    }

    if (options.json) {
      throw new Error("--github-actions cannot be used with --json");
    }

    if (options.summary) {
      throw new Error("--github-actions cannot be used with --summary");
    }

    if (options.doctor) {
      throw new Error("--github-actions cannot be used with --doctor");
    }

    if (options.installGitHubActions) {
      throw new Error("--github-actions cannot be used with --install-github-actions");
    }

    if (options.strict) {
      throw new Error("--github-actions cannot be used with --strict");
    }

    io.stdout.write(renderGitHubActionsWorkflow());
    return;
  }

  if (options.installGitHubActions) {
    if (options.check || options.diff) {
      throw new Error("--install-github-actions cannot be used with --check or --diff");
    }

    if (options.json) {
      throw new Error("--install-github-actions cannot be used with --json");
    }

    if (options.summary) {
      throw new Error("--install-github-actions cannot be used with --summary");
    }

    if (options.doctor) {
      throw new Error("--install-github-actions cannot be used with --doctor");
    }

    if (options.strict) {
      throw new Error("--install-github-actions cannot be used with --strict");
    }

    const outputPath = installGitHubActionsWorkflow(options.root, { force: options.force });
    if (!options.quiet) {
      io.stdout.write(`Wrote ${formatDisplayPath(outputPath)}\n`);
    }
    return;
  }

  options = applyRepositoryConfig(options.root, options);

  if (options.diff && options.json) {
    throw new Error("--diff cannot be used with --json");
  }

  if (options.doctor && options.json) {
    throw new Error("--doctor cannot be used with --json");
  }

  if (options.doctor && options.check) {
    throw new Error("--doctor cannot be used with --check or --diff");
  }

  if (options.check && options.json) {
    throw new Error("--check cannot be used with --json");
  }

  if (options.target && options.json) {
    throw new Error("--target cannot be used with --json");
  }

  if (options.summary && options.json) {
    throw new Error("--summary cannot be used with --json");
  }

  if (options.summary && options.doctor) {
    throw new Error("--summary cannot be used with --doctor");
  }

  if (options.summary && options.diff) {
    throw new Error("--summary cannot be used with --diff");
  }

  if (options.summary && options.check) {
    throw new Error("--summary cannot be used with --check");
  }

  const scan = scanRepository(options.root, options);

  if (options.doctor) {
    const markdown = renderMarkdown(scan);
    const generatedOutput = {
      updateCommand: formatUpdateCommand(options),
      outputs: resolveOutputPaths(scan.absoluteRoot, options).map((outputPath) => {
        const result = compareOutput(markdown, outputPath);
        return {
          path: formatOutputPathFromRoot(scan.absoluteRoot, outputPath),
          ok: result.ok,
          reason: result.reason
        };
      })
    };

    io.stdout.write(renderDoctor(scan, generatedOutput));
    const hasStrictWarnings = applyStrictWarnings(options, scan, io);
    const hasStrictOutputFailures = applyStrictGeneratedOutput(options, generatedOutput, io);
    if (hasStrictWarnings || hasStrictOutputFailures) {
      return;
    }
    return;
  }

  if (options.summary) {
    io.stdout.write(renderSummary(scan));
    applyStrictWarnings(options, scan, io);
    return;
  }

  if (options.json) {
    io.stdout.write(`${JSON.stringify(scan, null, 2)}\n`);
    applyStrictWarnings(options, scan, io);
    return;
  }

  const markdown = renderMarkdown(scan);
  const outputPaths = resolveOutputPaths(scan.absoluteRoot, options);

  if (options.check) {
    const results = outputPaths.map((outputPath) => ({
      outputPath,
      result: compareOutput(markdown, outputPath)
    }));
    const failures = results.filter((item) => !item.result.ok);

    if (failures.length > 0) {
      for (const { outputPath, result } of failures) {
        io.stderr.write(`${formatDisplayPath(outputPath)} is ${result.reason}. Run \`${formatUpdateCommand(options)}\` to update it.\n`);
        if (options.diff) {
          io.stderr.write(renderCheckDiff(result, markdown, outputPath));
        }
      }
      io.exitCode = 1;
      return;
    }

    if (applyStrictWarnings(options, scan, io)) {
      return;
    }

    if (!options.quiet) {
      for (const { outputPath } of results) {
        io.stdout.write(`${formatDisplayPath(outputPath)} is current.\n`);
      }
    }

    return;
  }

  if (options.write) {
    for (const outputPath of outputPaths) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, markdown, "utf8");

      if (!options.quiet) {
        io.stdout.write(`Wrote ${path.relative(process.cwd(), outputPath) || outputPath}\n`);
      }
    }

    applyStrictWarnings(options, scan, io);
    return;
  }

  io.stdout.write(markdown);
  applyStrictWarnings(options, scan, io);
}

export function scanRepository(root = process.cwd(), options = {}) {
  const absoluteRoot = path.resolve(root);
  const mergedOptions = applyRepositoryConfig(absoluteRoot, options);
  return scanRepositoryCore(absoluteRoot, mergedOptions);
}

export function installGitHubActionsWorkflow(root = process.cwd(), options = {}) {
  const absoluteRoot = path.resolve(root);

  if (!fs.existsSync(absoluteRoot)) {
    throw new Error(`root does not exist: ${absoluteRoot}`);
  }

  const stat = fs.statSync(absoluteRoot);
  if (!stat.isDirectory()) {
    throw new Error(`root is not a directory: ${absoluteRoot}`);
  }

  const outputPath = path.join(absoluteRoot, GITHUB_ACTIONS_WORKFLOW);

  if (fs.existsSync(outputPath) && !options.force) {
    throw new Error(`${GITHUB_ACTIONS_WORKFLOW} already exists. Re-run with --force to overwrite it.`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderGitHubActionsWorkflow(), "utf8");
  return outputPath;
}

export function installRepositoryConfig(root = process.cwd(), options = {}) {
  const absoluteRoot = path.resolve(root);

  if (!fs.existsSync(absoluteRoot)) {
    throw new Error(`root does not exist: ${absoluteRoot}`);
  }

  const stat = fs.statSync(absoluteRoot);
  if (!stat.isDirectory()) {
    throw new Error(`root is not a directory: ${absoluteRoot}`);
  }

  const outputPath = resolveConfigOutputPath(absoluteRoot, options.configPath);
  const displayPath = toPosix(path.relative(absoluteRoot, outputPath)) || path.basename(outputPath);

  if (fs.existsSync(outputPath) && !options.force) {
    throw new Error(`${displayPath} already exists. Re-run with --force to overwrite it.`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderRepositoryConfig(toRepositoryConfig(options)), "utf8");
  return outputPath;
}

function setupRepository(options) {
  const absoluteRoot = path.resolve(options.root);

  if (!fs.existsSync(absoluteRoot)) {
    throw new Error(`root does not exist: ${absoluteRoot}`);
  }

  const stat = fs.statSync(absoluteRoot);
  if (!stat.isDirectory()) {
    throw new Error(`root is not a directory: ${absoluteRoot}`);
  }

  const configPath = resolveConfigOutputPath(absoluteRoot, options.configPath);
  const workflowPath = path.join(absoluteRoot, GITHUB_ACTIONS_WORKFLOW);
  const configExisted = fs.existsSync(configPath);
  const workflowExisted = fs.existsSync(workflowPath);
  const steps = [];

  if (!configExisted || options.force) {
    installRepositoryConfig(absoluteRoot, options);
    steps.push({
      label: "config",
      path: configPath,
      status: configExisted ? "overwrote" : "wrote"
    });
  } else {
    steps.push({ label: "config", path: configPath, status: "kept" });
  }

  if (!workflowExisted || options.force) {
    installGitHubActionsWorkflow(absoluteRoot, { force: options.force });
    steps.push({
      label: "workflow",
      path: workflowPath,
      status: workflowExisted ? "overwrote" : "wrote"
    });
  } else {
    steps.push({ label: "workflow", path: workflowPath, status: "kept" });
  }

  const mergedOptions = applyRepositoryConfig(absoluteRoot, {
    ...options,
    setup: false,
    write: true
  });
  const scan = scanRepository(absoluteRoot, mergedOptions);
  const markdown = renderMarkdown(scan);
  const outputPaths = resolveOutputPaths(scan.absoluteRoot, mergedOptions);

  for (const outputPath of outputPaths) {
    const comparison = compareOutput(markdown, outputPath);

    if (!comparison.ok) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, markdown, "utf8");
    }

    steps.push({
      label: "brief",
      path: outputPath,
      status: comparison.ok ? "current" : comparison.reason === "missing" ? "wrote" : "updated"
    });
  }

  return { root: scan.displayRoot, steps };
}

function renderSetupResult(result) {
  const lines = [
    `agent-rake setup for \`${result.root}\``,
    ""
  ];

  for (const step of result.steps) {
    lines.push(`- ${step.label}: ${step.status} \`${formatDisplayPath(step.path)}\``);
  }

  lines.push("", "Next: commit the generated files and run `agent-rake --diff` before future changes.");
  return `${lines.join("\n")}\n`;
}

function resolveConfigOutputPath(root, configPath = DEFAULT_CONFIG) {
  return path.isAbsolute(configPath)
    ? configPath
    : path.resolve(root, configPath);
}

function toEffectiveConfigJson(root, options) {
  return {
    root: path.resolve(root),
    configFile: options.configFile ?? null,
    output: options.output,
    target: options.target ?? null,
    maxFiles: options.maxFiles,
    ignore: options.customIgnores ?? []
  };
}

function toRepositoryConfig(options = {}) {
  const ignores = options.customIgnores?.length > 0 || options.ignore?.length > 0
    ? normalizeIgnorePatterns(options.customIgnores ?? options.ignore)
    : ["fixtures", "src/generated"];
  const config = {
    ignore: ignores,
    maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES
  };

  if (options.target) {
    config.target = options.target;
  } else {
    config.output = options.output ?? DEFAULT_OUTPUT;
  }

  return config;
}

export function applyRepositoryConfig(root = process.cwd(), options = {}) {
  const absoluteRoot = path.resolve(root);
  const merged = { ...options };
  const configResult = readRepositoryConfig(absoluteRoot, merged);

  if (!configResult) {
    merged.customIgnores = normalizeIgnorePatterns(merged.customIgnores ?? merged.ignore ?? []);
    return merged;
  }

  const config = configResult.config;
  merged.configFile = toPosix(path.relative(absoluteRoot, configResult.path));

  if (Object.hasOwn(config, "target") && Object.hasOwn(config, "output")) {
    throw new Error(`${merged.configFile} cannot define both target and output`);
  }

  if (Object.hasOwn(config, "target") && !merged.target && !merged.outputWasSet) {
    merged.target = parseTarget(String(config.target), `${merged.configFile} target`);
    merged.output = resolveTargetOutputs(merged.target);
  }

  if (Object.hasOwn(config, "output") && !merged.target && !merged.outputWasSet) {
    merged.output = parseConfigString(config.output, `${merged.configFile} output`);
  }

  if (Object.hasOwn(config, "maxFiles") && !merged.maxFilesWasSet) {
    merged.maxFiles = parsePositiveInt(config.maxFiles, `${merged.configFile} maxFiles`);
  }

  const configIgnores = Object.hasOwn(config, "ignore")
    ? normalizeIgnorePatterns(parseConfigIgnore(config.ignore, `${merged.configFile} ignore`))
    : [];
  merged.customIgnores = normalizeIgnorePatterns([
    ...configIgnores,
    ...(merged.customIgnores ?? merged.ignore ?? [])
  ]);
  merged.config = false;
  return merged;
}

function readRepositoryConfig(root, options) {
  if (options.config === false) {
    return null;
  }

  const configPath = options.configPath ?? DEFAULT_CONFIG;
  const absolutePath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(root, configPath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const config = readJsonIfPresent(absolutePath);
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`${toPosix(path.relative(root, absolutePath))} must be a JSON object`);
  }

  validateRepositoryConfig(config, toPosix(path.relative(root, absolutePath)));
  return { path: absolutePath, config };
}

function validateRepositoryConfig(config, displayPath) {
  const allowed = new Set(["ignore", "maxFiles", "output", "target"]);

  for (const key of Object.keys(config)) {
    if (!allowed.has(key)) {
      throw new Error(`${displayPath} has unsupported key: ${key}`);
    }
  }
}

function parseConfigIgnore(value, label) {
  if (typeof value === "string") {
    return [value];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a string or array of strings`);
  }

  return value.map((item) => parseConfigString(item, label));
}

function parseConfigString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function applyStrictWarnings(options, scan, io) {
  const warnings = scan.warnings ?? [];

  if (!options.strict || warnings.length === 0) {
    return false;
  }

  io.stderr.write(`agent-rake strict mode found ${warnings.length} warning${warnings.length === 1 ? "" : "s"}:\n`);
  for (const warning of warnings) {
    io.stderr.write(`- ${warning}\n`);
  }
  io.exitCode = 1;
  return true;
}

function applyStrictGeneratedOutput(options, generatedOutput, io) {
  const outputFailures = generatedOutput.outputs.filter((output) => !output.ok);

  if (!options.strict || outputFailures.length === 0) {
    return false;
  }

  io.stderr.write(`agent-rake strict mode found ${outputFailures.length} generated output issue${outputFailures.length === 1 ? "" : "s"}:\n`);
  for (const output of outputFailures) {
    io.stderr.write(`- ${output.path} is ${output.reason}\n`);
  }
  io.exitCode = 1;
  return true;
}

export function compareOutput(markdown, outputPath) {
  if (!fs.existsSync(outputPath)) {
    return { ok: false, reason: "missing" };
  }

  const existing = normalizeLineEndings(fs.readFileSync(outputPath, "utf8"));
  const expected = normalizeLineEndings(markdown);

  if (existing !== expected) {
    return { ok: false, reason: "stale", existing, expected };
  }

  return { ok: true, reason: "current" };
}

function renderCheckDiff(result, markdown, outputPath) {
  if (result.reason === "missing") {
    return `No diff is available because ${formatDisplayPath(outputPath)} does not exist yet.\n`;
  }

  return renderOutputDiff(result.existing, result.expected ?? normalizeLineEndings(markdown), {
    fromLabel: formatDisplayPath(outputPath),
    toLabel: "generated"
  });
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

  if (target !== ALL_TARGETS && !TARGET_OUTPUTS.has(target)) {
    throw new Error(`${flag} must be one of: ${formatTargetNames()}`);
  }

  return target;
}

function formatTargetNames() {
  return [...TARGET_OUTPUTS.keys(), ALL_TARGETS].join(", ");
}

function resolveTargetOutputs(target) {
  if (target === ALL_TARGETS) {
    return Array.from(TARGET_OUTPUTS.values());
  }

  return TARGET_OUTPUTS.get(target);
}

function resolveOutputPaths(root, options) {
  const outputs = Array.isArray(options.output) ? options.output : [options.output];
  return outputs.map((output) => path.resolve(root, output));
}

function parseCompletionShell(value, flag) {
  const shell = value.toLowerCase();

  if (!COMPLETION_SHELLS.has(shell)) {
    throw new Error(`${flag} must be one of: ${Array.from(COMPLETION_SHELLS).join(", ")}`);
  }

  return shell;
}

function formatUpdateCommand(options) {
  if (options.target) {
    return `agent-rake --target ${options.target}`;
  }

  if (!options.outputWasSet && options.output === DEFAULT_OUTPUT) {
    return "agent-rake";
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
  --target <name>     Output to a known agent file: agents, claude, codex, copilot, cursor, all.
  --no-write          Print Markdown to stdout instead of writing a file.
  --print, --dry-run  Aliases for --no-write.
  --json              Print the scan result as JSON.
  --check             Fail if the output file is missing or stale.
  --diff              Show a concise diff when the output file is stale.
  --doctor, --health  Print actionable scan health checks, fix suggestions, and output freshness.
  --github-actions    Print a GitHub Actions workflow for agent-rake checks.
  --install-github-actions
                      Write .github/workflows/agent-rake.yml if it does not exist.
  --setup             Write starter config, CI workflow, and AGENT_BRIEF.md safely.
  --summary, --stats  Print a compact scan summary without writing a file.
  --targets           List known agent output targets.
  --completion <sh>   Print shell completion: bash, zsh, fish, or powershell.
  --explain, --why    Include reasons for detected commands, signals, and files.
  --strict            Exit nonzero on scan warnings, and on doctor output freshness issues.
  --force             Allow installer commands to overwrite their target file.
  --config <file>     Read agent-rake config from a JSON file. Defaults to ${DEFAULT_CONFIG}.
  --no-config         Disable agent-rake config discovery.
  --config-example    Print an example ${DEFAULT_CONFIG} file.
  --init-config       Write the active config file if it does not exist.
  --show-config       Print resolved config after file and CLI overrides.
  --ignore <path>     Ignore a file, directory, path prefix, or path segment. Repeatable.
  --max-files <n>     Maximum files to scan. Defaults to ${DEFAULT_MAX_FILES}.
  --quiet             Suppress success output when writing.
  --version, -v       Print version.
  --help, -h          Print help.
`;
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, "\n");
}

function splitDiffLines(value) {
  const normalized = normalizeLineEndings(value);
  if (normalized.endsWith("\n")) {
    return normalized.slice(0, -1).split("\n");
  }

  return normalized.split("\n");
}

function formatDisplayPath(filePath) {
  return path.relative(process.cwd(), filePath) || filePath;
}

function formatOutputPathFromRoot(root, outputPath) {
  const relative = path.relative(root, outputPath);

  if (relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    return relative;
  }

  return formatDisplayPath(outputPath);
}
