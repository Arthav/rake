# agent-rake Examples

These examples show what `agent-rake` is designed to surface. They are written
as compact repo sketches so you can compare your generated brief against common
project shapes without cloning large fixtures.

## Next.js App

Expected source signals:

- `package.json` with `next` and `react`
- `app/api/health/route.ts`
- `app/dashboard/page.tsx`
- `prisma/schema.prisma`
- `.env.example`
- `.github/workflows/ci.yml`

Useful command:

```bash
agent-rake --root ./my-next-app --target agents
```

Expected brief highlights:

```markdown
- Package manager: pnpm
- Framework signals: `Next.js` (package.json dependency: next), `React` (package.json dependency: react)
- Routes and APIs: `app/api/health/route.ts`, `app/dashboard/page.tsx`
- Data and schema files: `prisma/schema.prisma`
```

## Python API

Expected source signals:

- `requirements.txt` or `pyproject.toml` with `fastapi` or `flask`
- `main.py` or `app.py` with `@app.get("/...")` or `@app.route("/...")`
- `alembic/versions/*.py`
- `.env.example`

Useful command:

```bash
agent-rake --root ./python-api --no-write
```

Expected brief highlights:

```markdown
- Framework signals: `FastAPI` (requirements.txt signal)
- Commands Agents Should Prefer: `python -m pytest`
- Routes and APIs: `main.py`
- Data and schema files: `alembic/versions/001_create_users.py`
```

## Go Service

Expected source signals:

- `go.mod`
- `go.sum`
- `main.go`
- `go.work` for workspaces
- route framework dependency such as `github.com/gin-gonic/gin`

Useful command:

```bash
agent-rake --root ./go-service --json
```

Expected JSON highlights:

```json
{
  "packageManager": "go",
  "frameworks": [{ "name": "Gin", "evidence": "go.mod signal" }],
  "commands": [{ "command": "go test ./...", "reason": "Go module" }]
}
```

## JavaScript Monorepo

Expected source signals:

- root `package.json` with `workspaces`
- `pnpm-workspace.yaml`, `turbo.json`, or `nx.json`
- package-level manifests under `apps/*` or `packages/*`
- shared agent instructions at the root

Useful command:

```bash
agent-rake --root ./platform --target cursor
```

Expected brief highlights:

```markdown
- Workspace signals: `JavaScript workspace` (package.json workspaces: apps/*, packages/*), `pnpm workspace` (pnpm-workspace.yaml), `Turborepo` (turbo.json)
- Existing agent instructions: `AGENTS.md`
- Config: `pnpm-workspace.yaml`, `turbo.json`
```

