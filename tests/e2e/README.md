# Browser smoke tests

Groovy uses Playwright for a small browser-level smoke suite. The goal is to catch failures that Node-only regression tests cannot see, such as broken script bootstrap order or fatal browser JavaScript errors.

## Run locally

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

The Playwright config starts a small local static server automatically. It serves the repository root and falls back to `index.html` for extensionless app routes so future routing smoke tests can run without changing the production app.

The initial smoke test verifies that Groovy loads its critical shell and does not emit a fatal `pageerror`. Keep this suite intentionally small and focused on high-value user flows.
