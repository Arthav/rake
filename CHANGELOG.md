# Changelog

## Unreleased

- Add known agent output targets with `--target` and `--targets`.
- Add `--target all` to write or check every known agent output target in one
  command.
- Add stale generated-brief diffs with `--diff`.
- Add actionable scan health checks and generated-output freshness with
  `--doctor` / `--health`.
- Allow `--doctor` with `--out` and `--target` so custom and agent-target
  outputs can be diagnosed directly.
- Make `--doctor --strict` fail on missing or stale generated output.
- Add generated-output fix suggestions to doctor output and use the simpler
  `agent-rake` update hint for the default brief.
- Add GitHub Actions workflow output with `--github-actions` / `--ci-workflow`.
- Add safe GitHub Actions workflow installation with `--install-github-actions`
  / `--init-github-actions`.
- Add one-command repository bootstrap with `--setup` / `--bootstrap`.
- Allow `--setup` to accept `--target`, `--out`, `--ignore`, and `--max-files`
  so one command can install config, CI, and the intended generated output.
- Make `--setup` honor config-driven `target: "all"` and write every known
  agent output target.
- Add `--dry-run` as a clearer alias for `--no-write`.
- Add shell completion script output with
  `--completion bash|zsh|fish|powershell`, including path completion for
  path-like flags such as `--ignore`.
- Add compact terminal preflight output with `--summary` / `--stats`.
- Add repeatable custom scan ignores with `--ignore <path>`.
- Add `.agent-rake.json` config support with `--config` and `--no-config`.
- Add config bootstrap commands with `--config-example` and `--init-config`.
- Make `--init-config` persist active `--ignore`, `--max-files`, `--out`, and
  `--target` settings instead of always writing the static example.
- Add `--show-config` / `--effective-config` to inspect resolved config and
  CLI overrides.
- Add explainable output with `--explain` / `--why`.
- Add strict warning failures with `--strict` / `--fail-on-warnings`.
- Add structured GitHub issue forms for bug reports and feature requests.
- Add bounded Go route declaration detection for common `net/http`, Gin, Chi,
  Echo, and Fiber-style routers.
- Add Mix, Phoenix router, Elixir config, and Ecto migration detection.
- Add Maven, Gradle, Spring, Spring controller/config, and Flyway migration
  detection.
- Add Bundler, Rails command, Laravel artisan test, Symfony lock/config, and
  PHPUnit/PHP quality-tool config detection.
- Add Django-aware Python test command inference and package-manager-specific
  `uv`, Poetry, and Pipenv test command hints.
- Add bounded root task-runner command hints for common `Makefile`, `justfile`,
  and `Taskfile.yml` targets.
- Detect `.agent-rake.json` as a config file in generated briefs.
- Start the internal module split by moving shared constants, output renderers,
  and scanner core logic into `src/constants.js`, `src/renderers.js`, and
  `src/scanner.js`.
- Improve framework, workspace, route, data/schema, and lockfile detection.
- Add release-check packaging verification, CLI mode smoke checks, and publish
  checklist docs.
- Run the full release check in GitHub Actions.
- Refresh the README terminal demo around setup, doctor, and compact summary
  workflows.

## 0.1.0

- Initial CLI release.
- Generates Markdown repo briefs.
- Supports JSON output.
- Supports stale brief checks with `--check`.
- Detects manifests, lockfiles, package scripts, entrypoints, routes, tests, env examples, CI, config, and risk hotspots.
