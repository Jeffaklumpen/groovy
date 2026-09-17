# Browser smoke tests

Groovy uses Playwright for a small browser-level smoke suite. The goal is to catch failures that Node-only regression tests cannot see, such as broken script bootstrap order, broken routing and fatal browser JavaScript errors.

## Run locally

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

The Playwright config starts a small local static server automatically. It serves the repository root and falls back to `index.html` for extensionless app routes so routing smoke tests can run without changing the production app.

## Current smoke coverage

The suite focuses on high-value browser behavior rather than every possible combination. It covers the logged-out landing and route guards, login/registration UI, Add Record access, album-detail rendering, album-rating UI, track titles and durations, own shelf/wishlist routing, Following, Statistics, profile/Search User controls, notifications, sorting/filtering, deterministic album-search rendering and the New Shelf create/cancel flow.

Discogs search is mocked only where deterministic search-result rendering is being tested. The app UI and browser wiring still run normally. Album-detail coverage uses a deterministic in-browser record so track duration and the absence of individual track-rating controls are always checked.

## Authenticated read-only smoke tests

Authenticated tests use a dedicated test account and read its credentials only from environment variables:

- `GROOVY_E2E_EMAIL`
- `GROOVY_E2E_PASSWORD`

GitHub Actions provides these through repository Secrets. Never commit account credentials to the repository. If the variables are absent, authenticated tests are skipped while logged-out smoke tests still run.

The authenticated suite is intentionally read-only. It signs in with the real Supabase auth flow and verifies navigation and UI behavior without adding, deleting, rating, following, clearing notifications or otherwise changing account data. Its Playwright trace is disabled so login field values are not retained in a trace artifact.

A real collected-record detail check runs when the dedicated account has a record. If the account is empty, that check is skipped; deterministic album-detail coverage still runs in the general smoke suite.

## Intentionally outside the production smoke scope

Persistence-changing flows such as actually adding/removing records, saving ratings, assigning/reordering shelves, changing follows and clearing/marking notifications are not run against the production Supabase data. Add those only with isolated seeded test data or a dedicated test database so browser tests cannot alter real application data.
