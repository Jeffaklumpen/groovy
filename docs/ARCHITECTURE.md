# GroovyShelves architecture

This document describes the intended ownership boundaries after the September 2026 foundation cleanup.

## Frontend

GroovyShelves remains a vanilla JavaScript application. The cleanup is intentionally incremental; there is no framework rewrite.

### Current modules

- `js/route-state.js` — pure URL/state helpers only. It must not fetch data, patch browser APIs or inject assets.
- `js/app.js` — legacy application core. It still owns most library, auth, search, shelves, marketplace and album-detail behavior and is the main target for gradual extraction.
- `js/streaming-links.js` — pure Spotify and Apple Music URL construction shared by feature code.
- `js/pressing-core.js` — pure Discogs pressing normalization, matching, matrix/runout and vinyl-format helpers.
- `js/rating-core.js` — pure 0–5 rating normalization and display formatting helpers.
- `js/marketplace-core.js` — pure external-listing URL validation and buy-now candidate normalization.
- `js/shelf-core.js` — pure shelf color formatting, shelf lookup and record-count helpers.
- `js/notification-core.js` — pure notification escaping, relative-time formatting and notification message copy.
- `js/detail-enhancements-v2.js` — active album-detail compatibility/enhancement layer. This should shrink as its behavior is moved into the actual detail implementation.
- `js/album-rating-layout-v4.js` — active rating presentation layer. Older rating layout generations have been removed.
- `js/profile.js` — profile/settings/public-profile UI. Routing behavior in this module is being consolidated with the application router.
- `js/statistics-core.js` — pure statistics calculations. This is the preferred pattern for new testable logic.
- `js/statistics.js` — statistics UI/data loading.
- `js/pwa.js` — PWA installation and service-worker registration only.

Application scripts and styles are loaded explicitly from `index.html`; feature modules should not be hidden behind unrelated runtime script injection.

## Routing

Canonical shelf URLs use `/shelf/:username`. `/user/:username` remains accepted only as a legacy route while routing cleanup is in progress. Public profile pages use `/profile/:username`.

Routing should have one owner. Modules should not monkey-patch `history.pushState`, `history.replaceState` or application data loaders.

## Data model

Supabase is the backend. Shared album rows are identified by `albums.discogs_master_id` for Discogs-backed albums, and the live database prevents duplicate non-empty Discogs master IDs.

The frontend still uses a legacy positional `records` array. Do not add new positional fields unless unavoidable. New/refactored code should move toward named record objects or an adapter so callers do not depend on indexes such as `record[10]`.

## Supabase

See `supabase/README.md` for migration, Edge Function and security conventions.

Database changes must be represented by migrations in GitHub. Edge Function changes must be committed in `supabase/functions/` before or together with deployment.

## Testing

`.github/workflows/test.yml` runs the Node regression suite. Add a regression test whenever a cleanup removes a compatibility workaround or fixes a previously observed bug.

The goal of refactoring is behavior preservation first: keep the current design and product behavior while reducing duplicate loaders, hidden runtime patches and tightly coupled modules.
