# Release Checklist

Use this checklist before publishing `agent-rake`.

## Current Metadata

Last checked: 2026-06-26.

- GitHub repository: `https://github.com/Arthav/rake`
- npm package name: `agent-rake` was not published when checked.
- Runtime dependencies: none.
- Required Node version: `>=18`.

Re-check npm name availability before publishing:

```bash
npm view agent-rake version
```

If that command returns a version, the name is taken. If it returns a 404, the
name is still available.

## Preflight

Run the full release gate:

```bash
npm run release:check
```

That command runs:

- `npm test`
- `npm run smoke`
- `npm run smoke:modes`
- `npm run brief:check`
- `npm run pack:check`

## Package Contents

Check the tarball preview from `npm run pack:check`. The package should include:

- `assets/demo.svg`
- `bin/agent-rake.js`
- `examples/agent-rake.config.json`
- `examples/README.md`
- `src/constants.js`
- `src/index.js`
- `src/renderers.js`
- `src/scanner.js`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `SECURITY.md`
- `RELEASE.md`

It should not include local caches, `.github` issue templates, generated tarballs,
or test fixtures.

## Publish

Publish only after the name, repository, and package contents still look correct:

```bash
npm publish
```
