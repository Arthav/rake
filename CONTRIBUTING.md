# Contributing

Thanks for improving `agent-rake`.

## Local setup

```bash
npm test
npm run smoke
npm run release:check
```

No install step is required because the project has no dependencies.

## Reports and requests

Use the GitHub issue forms when possible. Good bug reports include:

- `agent-rake --version`
- the exact command that failed or produced surprising output
- a small repo tree or relevant manifest snippets
- the actual brief section or JSON field
- the expected output

Remove secrets, tokens, private URLs, and sensitive `.env` values before posting.

## Pull request rules

- Keep the CLI dependency-free.
- Add tests for new detectors or output behavior.
- Prefer adding a small detector over broad content parsing.
- Avoid sending repository data to external services.

## Good first issues

- Add better manifest detection for another ecosystem.
- Improve route detection for a framework.
- Add another conservative agent output target.
- Add a focused example for another common repo shape.
