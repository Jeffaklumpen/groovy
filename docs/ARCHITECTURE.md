# GroovyShelves architecture

This document describes the intended ownership boundaries after the September 2026 foundation cleanup.

## Frontend

GroovyShelves remains a vanilla JavaScript application. There is deliberately no framework rewrite or bundler requirement.

### Current ownership

- `js/route-state.js` — pure URL/state helpers only.
- `js/record-model.js` — adapter around the legacy positional record tuple plus collection/wishlist record construction.
- `js/app.js` — application composition/integration root. It still owns auth and some route/library glue, but feature logic should continue moving into dedicated modules only when there is a real ownership boundary.
- `js/album-search.js` — search-result orchestration, Discogs/Apple/CAA enrichment and handoff to the atomic database RPC. It must not directly create shared artist/album/track rows.
- `js/library-data.js` — collection/wishlist reads and mapping.
- `js/library-render-controller.js` — library card/pagination rendering.
- `js/library-actions-controller.js` — user-library mutations.
- `js/grid-sort-controller.js` — drag/reorder state and batched order RPCs.
- `js/pressing-core.js`, `js/marketplace-core.js`, `js/rating-core.js`, `js/shelf-core.js`, `js/library-core.js`, `js/notification-core.js`, `js/statistics-core.js`, `js/apple-search-core.js` — pure/testable domain helpers.
- feature controllers/views own their respective DOM/data behavior.
- `js/pwa.js` — PWA installation and service-worker registration only.

Application scripts and styles are still loaded explicitly from `index.html`. Do not hide dependencies behind unrelated runtime script injection.

## Routing

Canonical shelf URLs use `/shelf/:username`. `/user/:username` remains accepted only as a legacy route. Public profile pages use `/profile/:username`.

Routing is not yet fully centralized: `app.js`, profile and statistics code still perform some history navigation. The long-term rule is one routing owner. New modules should not monkey-patch `history.pushState`, `history.replaceState` or application loaders.

## Data model

Supabase is the backend.

Shared Discogs-backed albums are identified by `albums.discogs_master_id`; the database enforces uniqueness for non-empty master IDs.

The frontend still uses a legacy positional `records` array internally. `GroovyRecord` is the compatibility boundary.

Rules for new code:

- do not add new positional indexes unless unavoidable
- do not read fields through literals such as `record[10]`
- use named `GroovyRecord` getters/setters
- migrate old direct indexes opportunistically when touching that code

This allows the internal representation to move to named objects later without another large rewrite.

## Album persistence boundary

Adding an album is a database transaction through `save_album_to_library`.

The browser is responsible for gathering/normalizing external metadata. PostgreSQL owns the consistency-sensitive part:

1. authenticate and validate input
2. reuse/create the shared artist
3. reuse/create/update the Discogs master album
4. add missing track rows
5. serialize the user's destination ordering
6. insert/reuse the collection or wishlist row

Authenticated clients cannot directly INSERT/UPDATE shared `artists`, `albums` or `tracks` rows.

## Supabase

See `supabase/README.md`.

Database changes must be represented by migrations in GitHub. The rebuild baseline is stored separately under `supabase/baseline/` and must never be applied to the existing production project.

Edge Function changes must be committed in `supabase/functions/` before or together with deployment.

## CSS

The stylesheet split is considered complete enough for feature development.

Some later compatibility/design layers still contain many `!important` overrides, especially album-detail/rating styles. Do not start a wholesale CSS rewrite. When a larger area is changed, consolidate the underlying rules instead of adding another V13/V14-style override layer.

## Testing

`.github/workflows/test.yml` runs the Node regression suite and `.github/workflows/e2e.yml` runs Playwright smoke tests.

Add a regression test when a cleanup:

- moves an ownership boundary
- removes a compatibility workaround
- fixes a previously observed bug
- changes a security/data-persistence boundary

Behavior preservation remains the first priority during refactoring.
