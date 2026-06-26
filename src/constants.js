export const DEFAULT_OUTPUT = "AGENT_BRIEF.md";

export const DEFAULT_CONFIG = ".agent-rake.json";
export const DEFAULT_MAX_FILES = 3000;
export const MAX_TEXT_BYTES = 1024 * 1024;
export const MAX_ROUTE_HINT_BYTES = 128 * 1024;
export const GITHUB_ACTIONS_WORKFLOW = ".github/workflows/agent-rake.yml";

export const COMPLETION_SHELLS = new Set(["bash", "zsh", "fish", "powershell"]);

export const ALL_TARGETS = "all";

export const TARGET_OUTPUTS = new Map([
  ["agents", "AGENTS.md"],
  ["claude", "CLAUDE.md"],
  ["codex", "CODEX.md"],
  ["copilot", ".github/copilot-instructions.md"],
  ["cursor", ".cursor/rules/agent-rake.mdc"]
]);

export const IGNORED_DIRS = new Set([
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

export const GENERATED_FILE_NAMES = new Set([DEFAULT_OUTPUT.toLowerCase()]);

export const MANIFEST_FILES = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Pipfile",
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

export const LOCK_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "deno.lock",
  "uv.lock",
  "poetry.lock",
  "Pipfile.lock",
  "go.sum",
  "Cargo.lock",
  "composer.lock",
  "symfony.lock",
  "pubspec.lock",
  "Gemfile.lock",
  "mix.lock",
  "gradle.lockfile"
]);

export const JAVASCRIPT_LOCK_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb"
]);

export const AGENT_INSTRUCTION_FILES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "CODEX.md",
  ".cursorrules",
  ".cursor/rules",
  ".github/copilot-instructions.md"
]);

export const DOC_FILES = new Set([
  "README.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "RELEASE.md",
  "SECURITY.md",
  "LICENSE"
]);

export const EXTENSION_LANGUAGES = new Map([
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

export const HIDDEN_PACKAGE_SCRIPTS = new Set([
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
