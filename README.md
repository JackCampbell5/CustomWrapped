# My Wrapped

A local, private, custom year-in-review for your Spotify listening history, built with Vite + React + TypeScript.

> Work in progress. Full setup instructions will be added as the project is built.

## Privacy first

Your listening data and API keys never leave your machine and are never committed:

- Personal data goes in `data/raw/` (gitignored). Generated stats (`src/generated/`, `public/data/`) and the API cache (`data/cache/`) are gitignored too.
- Secrets go in `.env` (gitignored). Only `.env.example` is committed.
- Tests and demos use small synthetic fixtures in `fixtures/`.

## Pre-commit safety hook

A hook in `.githooks/pre-commit` blocks commits that stage personal data, `.env` files, zip archives,
or anything that looks like a Spotify secret or token. Enable it once per clone:

```sh
git config core.hooksPath .githooks
```

On macOS/Linux you may also need `chmod +x .githooks/pre-commit`.
