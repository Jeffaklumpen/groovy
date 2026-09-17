# Browser smoke tests

Groovy uses Playwright for a small browser-level smoke suite. The goal is to catch failures that Node-only regression tests cannot see, such as broken script bootstrap order or fatal browser JavaScript errors.

## Run locally

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

The Playwright config starts a small local static server automatically. It serves the repository root and falls back to `index.html` for extensionless app routes so routing smoke tests can run without changing the production app.

The smoke suite verifies that Groovy loads its critical shell, core logged-out interactions work, record details can open, and the browser does not emit fatal `pageerror` events. Keep this suite intentionally small and focused on high-value user flows.

## Authenticated read-only smoke test

The authenticated smoke test uses a dedicated test account and reads its credentials only from environment variables:

- `GROOVY_E2E_EMAIL`
- `GROOVY_E2E_PASSWORD`

GitHub Actions provides these through repository Secrets. Never commit account credentials to the repository. If the variables are absent, the authenticated test is skipped while the logged-out smoke tests still run.

The authenticated test is intentionally read-only: it signs in, verifies the user's own shelf, switches to the wishlist, and checks that clicking the Groovy logo returns to the user's shelf. Its Playwright trace is disabled so login field values are not retained in a trace artifact.
