# Security

`agent-rake` is local-only and does not send repository data to any service.

## Reporting a vulnerability

Open a private security advisory on GitHub when the repository is public.

## Secret handling

- The scanner lists env template files such as `.env.example`.
- It intentionally avoids listing secret-looking files such as `.env` and `.env.local`.
- It does not read source contents for normal detection.
