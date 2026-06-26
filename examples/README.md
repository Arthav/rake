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
agent-rake --root ./my-next-app --setup
agent-rake --root ./my-next-app --summary
agent-rake --root ./my-next-app --doctor
agent-rake --root ./my-next-app --ignore fixtures --ignore src/generated
agent-rake --github-actions
agent-rake --install-github-actions
agent-rake --root ./my-next-app --target agents
agent-rake --root ./my-next-app --target all
agent-rake --root ./my-next-app --target agents --diff
```

For repeatable settings, copy [agent-rake.config.json](./agent-rake.config.json)
to `.agent-rake.json` in your repo and adjust the ignored paths.

Or let the CLI create the starter file safely:

```bash
agent-rake --root ./my-next-app --init-config
agent-rake --root ./my-next-app --show-config
agent-rake --config-example
```

Explain the classifications:

```bash
agent-rake --root ./my-next-app --explain --no-write
```

Expected brief highlights:

```markdown
- Package manager: pnpm
- Framework signals: `Next.js` (package.json dependency: next), `React` (package.json dependency: react)
- Routes and APIs: `app/api/health/route.ts`, `app/dashboard/page.tsx`
- Data and schema files: `prisma/schema.prisma`
```

Expected explanation highlights:

```markdown
- Framework signal `Next.js`: package.json dependency: next
- Routes and APIs `app/api/health/route.ts`: route/API path convention
- Data and schema file `prisma/schema.prisma`: Prisma schema path
```

## Python API

Expected source signals:

- `requirements.txt` or `pyproject.toml` with `fastapi` or `flask`
- `main.py` or `app.py` with `@app.get("/...")` or `@app.route("/...")`
- `manage.py` for Django projects
- `uv.lock`, `poetry.lock`, or `Pipfile.lock` when that runner owns the env
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

For Django, `agent-rake` prefers `python manage.py test`. With known Python
runners it emits the matching wrapper command, such as `uv run python manage.py
test`, `poetry run pytest`, or `pipenv run pytest`.

## Go Service

Expected source signals:

- `go.mod`
- `go.sum`
- `main.go`
- bounded route declarations in `main.go`, `cmd/*/main.go`, `server.go`, or
  `router.go`
- `go.work` for workspaces
- route framework dependency such as `github.com/gin-gonic/gin`

Useful command:

```bash
agent-rake --root ./go-service --json
```

Explain JSON classifications:

```bash
agent-rake --root ./go-service --json --explain
```

Expected JSON highlights:

```json
{
  "packageManager": "go",
  "frameworks": [{ "name": "Gin", "evidence": "go.mod signal" }],
  "commands": [{ "command": "go test ./...", "reason": "Go module" }],
  "routeFiles": ["main.go"]
}
```

## Phoenix App

Expected source signals:

- `mix.exs` with a Phoenix dependency
- `mix.lock`
- `lib/*_web/router.ex`
- `priv/repo/migrations/*.exs`
- `config/runtime.exs` or another conventional Elixir config file

Useful command:

```bash
agent-rake --root ./phoenix-app --summary
```

Expected brief highlights:

```markdown
- Package manager: mix
- Framework signals: `Phoenix` (mix.exs signal)
- Commands Agents Should Prefer: `mix test`
- Routes and APIs: `lib/app_web/router.ex`
- Data and schema files: `priv/repo/migrations/20260101010101_create_users.exs`
- Config: `config/runtime.exs`
```

## Rails App

Expected source signals:

- `Gemfile` with `rails`
- `Gemfile.lock`
- `config/routes.rb`
- `db/migrate/*.rb`

Useful command:

```bash
agent-rake --root ./rails-app --summary
```

Expected brief highlights:

```markdown
- Package manager: bundler
- Framework signals: `Rails` (Gemfile signal)
- Commands Agents Should Prefer: `bundle exec rails test`
- Routes and APIs: `config/routes.rb`
- Data and schema files: `db/migrate/20260101010101_create_users.rb`
```

## PHP Framework App

Expected source signals:

- `composer.json`
- Laravel: `artisan`, `routes/api.php`, `config/app.php`
- Symfony: `symfony.lock`, `config/bundles.php`, `config/routes.yaml`
- `phpunit.xml`, `phpstan.neon`, `pint.json`, or `rector.php`
- `database/migrations/*.php`

Useful command:

```bash
agent-rake --root ./php-app --doctor
```

Expected brief highlights:

```markdown
- Package manager: composer
- Framework signals: `Laravel` (composer.json requirement) or `Symfony` (composer.json requirement)
- Commands Agents Should Prefer: `php artisan test` or `php bin/phpunit`
- Routes and APIs: `routes/api.php`
- Data and schema files: `database/migrations/2026_01_01_000000_create_users.php`
- Config: `config/app.php`, `phpunit.xml`
```

## Spring App

Expected source signals:

- `pom.xml` or `build.gradle(.kts)`
- Spring dependency text such as `spring-boot-starter-web` or
  `org.springframework.boot`
- `src/main/java/**/controller/*Controller.java` or Kotlin controller paths
- `src/main/resources/application.yml`
- Flyway migrations under `src/main/resources/db/migration/`

Useful command:

```bash
agent-rake --root ./spring-app --summary
```

Expected brief highlights:

```markdown
- Package manager: maven
- Framework signals: `Spring` (pom.xml signal)
- Commands Agents Should Prefer: `mvn test`
- Routes and APIs: `src/main/java/com/example/controller/UserController.java`
- Data and schema files: `src/main/resources/db/migration/V1__create_users.sql`
- Config: `src/main/resources/application.yml`
```

For Gradle projects, `agent-rake` prefers `./gradlew test` when a root wrapper
script exists, otherwise `gradle test`.

## JavaScript Monorepo

Expected source signals:

- root `package.json` with `workspaces`
- `pnpm-workspace.yaml`, `turbo.json`, or `nx.json`
- package-level manifests under `apps/*` or `packages/*`
- shared agent instructions at the root

Useful command:

```bash
agent-rake --root ./platform --target cursor
agent-rake --root ./platform --target all
```

Expected brief highlights:

```markdown
- Workspace signals: `JavaScript workspace` (package.json workspaces: apps/*, packages/*), `pnpm workspace` (pnpm-workspace.yaml), `Turborepo` (turbo.json)
- Existing agent instructions: `AGENTS.md`
- Config: `pnpm-workspace.yaml`, `turbo.json`
```

## Task Runner Repo

Expected source signals:

- root `Makefile`, `justfile`, or `Taskfile.yml`
- conventional targets such as `test`, `lint`, `check`, `build`, `format`, or
  `release`
- optional project manifests for language-specific command hints

Useful command:

```bash
agent-rake --root ./task-runner-repo --summary
```

Expected brief highlights:

```markdown
- Commands Agents Should Prefer: `make test`, `just build`, `task check`
- Config: `Makefile`, `justfile`, `Taskfile.yml`
```

Task files are read only from the repository root and only under the bounded
manifest-size cap. `agent-rake` ignores private or unusual target names instead
of guessing what they mean.
