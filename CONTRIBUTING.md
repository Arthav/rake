# Contributing

Thanks for improving `agent-rake`.

## Local setup

```bash
npm test
npm run smoke
```

No install step is required because the project has no dependencies.

## Pull request rules

- Keep the CLI dependency-free.
- Add tests for new detectors or output behavior.
- Prefer adding a small detector over broad content parsing.
- Avoid sending repository data to external services.

## Good first issues

- Add better manifest detection for another ecosystem.
- Improve route detection for a framework.
- Add a `--format compact` mode.
- Add a `--fail-on-warning` option for CI.
