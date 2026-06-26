# Roadmap

`agent-rake` should stay small, local, and boring. The goal is not to become another coding agent. The goal is to make every coding agent start with better repository context.

## Product Thesis

AI coding tools already read code, but they waste time rediscovering the same operational facts: where the app starts, what command is safe, which files are risky, and what project instructions already exist. A source-derived brief is a useful layer because it is cheap, auditable, and independent of any model vendor.

The project should win by being:

- Fast enough to run before every agent session.
- Deterministic enough to commit and check in CI.
- Conservative enough that maintainers trust it.
- Simple enough that developers understand the output immediately.

## v0.2 - Trust And CI

Status: complete

- Add deterministic Markdown output.
- Add `--check` to fail when the committed brief is missing or stale.
- Dogfood `AGENT_BRIEF.md` in this repository.
- Run the full release check in CI.
- Keep package contents small and predictable.

## v0.3 - Better Framework Signals

Status: in progress

- Add first-pass framework/runtime signals from `package.json`, `composer.json`,
  bounded manifest peeks, and conservative route conventions.
- Detect monorepo/workspace signals for JavaScript workspaces, pnpm, Turborepo,
  Nx, Lerna, Cargo, Go, Melos, and Dart pub workspaces.
- Recognize modern JavaScript/runtime lockfiles including `bun.lock`,
  `bun.lockb`, and `deno.lock`.
- Improve route detection for Next.js, Remix, SvelteKit, Django, Rails, Laravel,
  Symfony, Phoenix, and Spring, including conventional Phoenix router and Spring
  controller paths.
- Add first-class data/schema/migration file detection for Prisma, Drizzle,
  Django-style migrations, Rails migrations, Alembic, Laravel migrations, Ecto
  migrations, Flyway migrations, and common SQL schema files.
- Add conservative framework command hints for Django, Rails, Laravel,
  Symfony/PHPUnit, Mix, Maven, and Gradle without inventing missing test
  commands.
- Add bounded command hints for common root task-runner files: `Makefile`,
  `justfile`, and `Taskfile.yml`.
- Add bounded backend route declaration peeks for likely Express, FastAPI, Hono,
  Flask, and Go router entrypoint files.
- Keep source peeks bounded, conservative, and limited to route-declaration
  candidates; keep normal source scanning metadata-only.
- Add repeatable `--ignore <path>` for repo-specific generated, fixture, or
  vendored paths that are not covered by the built-in ignore list.
- Add `.agent-rake.json` config support so teams can commit repeatable ignore,
  max-file, output, or target settings while keeping CLI flags authoritative.
- Add `--config-example` and `--init-config` so users can bootstrap repeatable
  settings from either examples or active CLI flags without copying JSON by hand.

## v0.4 - Agent Targets

Status: complete

- Add `--target agents` for `AGENTS.md`.
- Add `--target claude` for `CLAUDE.md`.
- Add `--target codex` for `CODEX.md`.
- Add `--target copilot` for `.github/copilot-instructions.md`.
- Add `--target cursor` for `.cursor/rules/agent-rake.mdc`.
- Add `--targets` / `--list-targets` so users can discover target names from
  the CLI.
- Add `--target all` so multi-agent repos can write or check every known target
  output in one command.

## v0.5 - Launch Quality

Status: in progress

- Add a lightweight terminal demo artifact for the README.
- Add examples for a Next.js app, Python API, Go service, and monorepo.
- Maintain issue templates for bug reports and feature requests.
- Add a release-check script that runs tests, default and mode-specific smoke
  output, stale-brief verification, and package dry-run before publishing.
- Add `--summary` / `--stats` for a fast terminal preflight before writing or
  committing a full brief.
- Add `--diff` so stale generated briefs show a concise current-vs-generated
  diff instead of only reporting `stale`.
- Add `--doctor` / `--health` for actionable scan health checks, output
  freshness for default, custom, and target outputs, and fix suggestions.
- Add `--github-actions` / `--ci-workflow` so users can print a ready CI
  workflow without mutating their repo.
- Add `--install-github-actions` / `--init-github-actions` to safely write the
  workflow when users want setup, not just a snippet.
- Add `--config-example` / `--print-config` and `--init-config` /
  `--install-config` to make repo setup discoverable from the CLI.
- Add `--show-config` / `--effective-config` so users can inspect the resolved
  config without scanning or writing files.
- Add `--completion bash|zsh|fish|powershell` so users can install shell
  completions without extra packages.
- Add `--setup` / `--bootstrap` to install starter config, CI workflow, and
  configured generated output targets in one safe command, including direct
  setup flags for target, output, ignore, and scan size.
- Add `--strict` / `--fail-on-warnings` so CI can fail on scan warnings and
  doctor output freshness issues, not just stale generated output.
- Add explainable output for users who want to inspect why commands, signals,
  and files were classified.
- Add a release checklist with verified repository metadata and npm name status.
- Continue splitting the large implementation file into focused internal modules
  after the constants, renderer, and scanner-core split, while preserving
  `src/index.js` as the public API.
- Publish to npm after the package name is confirmed available.

## Explicit Non-Goals

- No model calls.
- No telemetry.
- No hidden network requests.
- No broad source-content ingestion by default.
- No dependency tree unless there is a hard reason.

## Current Sharp Edges

- npm package-name availability must be re-checked immediately before publish.
- Backend route detection now covers common entrypoint declarations, but it still
  intentionally skips arbitrary large files and unusual route builder patterns.
- The package has not been published to npm yet.
