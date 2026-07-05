# Stash

Anonymous infinite canvas for collecting items — persisted locally in your browser.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm test              # unit + component (Vitest)
npm run test:e2e      # full E2E suite (Chromium)
npm run test:smoke    # smoke tests (Chromium + Firefox)
npm run test:all      # everything
```

Smoke-test a deployed build:

```bash
PLAYWRIGHT_BASE_URL=https://your-app.vercel.app npm run test:smoke:prod
```

## Deploy to Vercel

### Option A — Git integration (recommended)

1. Push this repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Framework preset: **Next.js** (auto-detected).
4. Production branch: `main`.
5. Enable **Wait for GitHub Actions checks** so the [Production check](.github/workflows/ci.yml) workflow must pass before deploy.

No environment variables are required for the anonymous MVP.

### Option B — Vercel CLI

```bash
npx vercel login
npx vercel link
npx vercel --prod
```

After deploy, run browser smoke tests against the live URL:

```bash
PLAYWRIGHT_BASE_URL=https://your-app.vercel.app npm run test:smoke:prod
```

## Project spec

See [SPEC.md](./SPEC.md) for milestones, data model, and future phases.
