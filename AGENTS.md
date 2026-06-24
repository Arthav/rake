# Repository Instructions

This project is a small zero-dependency Node CLI.

- Keep runtime dependencies at zero unless a feature is impossible without one.
- Prefer conservative detection over clever inference.
- Do not read large file contents during scans unless a feature explicitly needs it.
- Keep generated Markdown concise enough for coding-agent context windows.
- Run `npm test`, `npm run smoke`, and `npm run brief:check` after CLI behavior changes.
