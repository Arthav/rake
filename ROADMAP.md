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

Status: in progress

- Add deterministic Markdown output.
- Add `--check` to fail when the committed brief is missing or stale.
- Dogfood `AGENT_BRIEF.md` in this repository.
- Run the stale-brief check in CI.
- Keep package contents small and predictable.

## v0.3 - Better Framework Signals

Status: planned

- Detect monorepo workspaces for npm, pnpm, yarn, Cargo, Go, and Dart.
- Improve route detection for Next.js, Remix, Express, FastAPI, Django, Rails, Laravel, Phoenix, and Hono.
- Detect database/schema tools more accurately: Prisma, Drizzle, Django migrations, Rails migrations, Alembic, Laravel migrations.
- Add bounded content peeks for manifest files only, keeping normal source scanning metadata-only.

## v0.4 - Agent Targets

Status: planned

- Add `--target agents` for `AGENTS.md`.
- Add `--target claude` for `CLAUDE.md`.
- Add `--target codex` for `CODEX.md`.
- Add `--target copilot` for `.github/copilot-instructions.md`.
- Add `--target cursor` for `.cursor/rules/agent-rake.mdc`.

## v0.5 - Launch Quality

Status: planned

- Record terminal demo GIF.
- Add examples for a Next.js app, Python API, Go service, and monorepo.
- Add issue templates.
- Replace placeholder GitHub URLs after the repository is published.
- Publish to npm after the package name is confirmed available.

## Explicit Non-Goals

- No model calls.
- No telemetry.
- No hidden network requests.
- No broad source-content ingestion by default.
- No dependency tree unless there is a hard reason.

## Current Sharp Edges

- The package metadata still uses placeholder GitHub URLs.
- There is no real Git remote in this workspace.
- Framework detection is useful but still shallow.
- The project needs a demo artifact before public launch.
