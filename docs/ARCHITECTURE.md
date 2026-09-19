# GroovyShelves architecture

This document describes the intended ownership boundaries after the September 2026 foundation cleanup.

## Frontend

GroovyShelves remains a vanilla JavaScript application. There is deliberately no framework rewrite or bundler requirement.

### Current ownership

- `js/route-state.js` — pure URL/state parsing helpers only.
- `js/router.js` — the single owner of browser history mutation and `popstate`; it delegates route rendering back to `app.js`.
- `js/record-model.js` — adapter around the legacy positional record tuple plus collection/wishlist record construction.
- `js/app.js` — application composition/integration root. It still owns auth and some route/library glue, but feature logic should continue moving into dedicated modules only when there is a real ownership boundary.
- `js/album-search.js` — search-result orchestration, Discogs/Apple/CAA enrichment and handoff to the atomic database RPC. It must not directly create shared artist/album/track rows.
- `js/library-data.js` — collection/wishlist reads and mapping.
- `js/library-render-controller.js` — library card/pagination rendering.
- `js/library-actions-controller.js` — user-library mutations.
- `js/grid-sort-controller.js` — drag/reorder state and batched order RPCs.
- `js/pressing-core.js`, `js/marketplace-core.js`, `js/rating-core.js`, `js/shelf-core.js`, `js/library-core.js`, `js/notification-core.js`, `js/statistics-core.js`, `js/apple-search-core.js`, `js/community-core.js` — pure/testable domain helpers.
- `js/community-controller.js` / `js/community-view.js` — own the `/community` overview, its Supabase read model, rendering and follow/profile interactions. `app.js` only wires the feature into routing.
- feature controllers/views own their respective DOM/data behavior.
- `js/pwa.js` — PWA installation and service-worker registration only.

Application scripts and styles are still loaded explicitly from `index.html`. Do not hide dependencies behind unrelated runtime script injection.

## Routing

Canonical shelf URLs use `/shelf/:username`. `/user/:username` remains accepted only as a legacy route. Public profile pages use `/profile/:username`. The authenticated community overview uses `/community`.

Browser navigation is centralized in `js/router.js`. It is the only application module allowed to call `history.pushState`, `history.replaceState`, `history.back` or listen for `popstate`.

`app.js` registers `renderCurrentRoute` as the router's route handler. Feature modules such as profile and statistics react to the normal `groovy-route-change` event instead of simulating or owning browser navigation.

New modules must use `GroovyRouter.navigate`, `GroovyRouter.replace` or `GroovyRouter.back`.

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

On `notes`, adding an album crosses a server-verification boundary before the database transaction. The browser sends only the Discogs master identity, destination and optional Apple album link to the JWT-protected `discogs-search` Edge Function. The function reloads canonical metadata from Discogs, verifies the Apple album identity when present, resolves a vinyl tracklist and calls `save_album_to_library_verified` using the service role.

PostgreSQL then owns the consistency-sensitive part:

1. accept only a server-verified user id and normalized metadata
2. reuse/create the shared artist
3. reuse/create/update the Discogs master album
4. add missing track rows
5. serialize the user's destination ordering
6. insert/reuse the collection or wishlist row

Authenticated clients cannot directly INSERT/UPDATE shared `artists`, `albums` or `tracks` rows. The older authenticated `save_album_to_library` RPC remains temporarily for compatibility with the stable `main` client and should have authenticated EXECUTE removed when that client is upgraded.

Wishlist-to-collection moves are separately atomic through `move_wishlist_to_collection`; UI surfaces must delegate that mutation to `library-actions-controller.js` rather than reimplementing table writes.

## Community read model

The Community page reads one aggregated payload from `get_community_overview(...)`. Cross-user totals, taste matches and rankings belong in that database read model instead of being rebuilt from full browser table scans.

Global feed events are persisted in `community_activity` by database triggers on collection adds, wishlist adds and album rating changes. Browser clients can read this feed but cannot write it directly. Personal `notifications` remain a separate recipient-specific feature and must not be reused as a global feed.

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
