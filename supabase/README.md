# Supabase in GroovyShelves

This directory is the repository-side source of truth for Supabase schema changes and Edge Functions used by GroovyShelves.

## Migrations

Every live schema or permission change must have a matching file in `supabase/migrations/`.

The managed live migration history starts with the September 2026 foundation migrations. Do not edit an already-applied migration to change production behavior; add a new migration instead.

Legacy pre-foundation SQL files were removed because they were incomplete and were never a reliable rebuild history.

## Rebuild baseline

`supabase/baseline/20260918_live_schema.sql` is a snapshot of the live database structure after the foundation cleanup.

It includes:

- public tables, constraints and indexes
- functions/RPCs and triggers
- RLS and policies
- explicit Data API grants
- the profile-images Storage bucket and Storage policies

It does **not** contain application/user data or the MusicBrainz catalog contents.

The baseline is for rebuilding a fresh Supabase project. It is not a migration and must not be applied to the existing live project.

## Shared catalog writes

`artists`, `albums` and `tracks` are shared catalog data.

Authenticated browser clients have SELECT access only. On `notes`, new album persistence goes through the JWT-protected `discogs-search` Edge Function first. The function reloads canonical Discogs metadata, verifies an optional Apple album identity and then invokes:

- `public.save_album_to_library_verified(...)`

That RPC is executable by `service_role` only. It serializes concurrent catalog/library ordering work with transaction-scoped advisory locks, creates or reuses shared catalog rows, completes missing tracks and inserts the user's collection/wishlist row inside one PostgreSQL transaction.

The older `public.save_album_to_library(...)` remains executable by `authenticated` temporarily so the stable `main` client keeps working against the shared production project. Once `main` is upgraded to the verified Edge Function path, remove authenticated EXECUTE from the legacy function in a follow-up migration.

Wishlist-to-collection transitions use `public.move_wishlist_to_collection(text)`, keeping collection insert, wishlist delete and wishlist order compaction in one authenticated transaction.

## Explicit Data API grants

Groovy opts into explicit grants instead of relying on Supabase's historical automatic exposure of new `public` tables.

Future migrations that create a client-facing table must include both:

1. the required `GRANT` statements for `anon` / `authenticated`
2. RLS plus policies matching the actual access model

Do not assume a new public table is automatically reachable through `supabase-js`.

## Community page

The authenticated `/community` page reads `public.get_community_overview(...)`, which returns totals, taste matches, rankings and recent activity as one read model. Cross-user aggregation stays in PostgreSQL instead of downloading full tables to the browser.

`public.community_activity` is the global activity-feed source. It is populated by database triggers for collection adds, wishlist adds and album rating changes. Authenticated clients have SELECT only; browser code must not insert or update feed events directly. This is intentionally separate from recipient-specific `notifications`.

Artist profiles use `/artist/:discogs-artist-id-:slug`. The browser renders Groovy statistics and the base discography first from `public.get_artist_overview(...)`; Discogs profile data and Wikipedia enrich the already-visible page asynchronously. Discogs profile metadata is cached in `public.artist_profile_cache` for fast repeat visits.

The base discography starts from the local MusicBrainz release-group catalog. Because that compact import intentionally omitted MusicBrainz primary type, Groovy now verifies studio discographies asynchronously against Wikidata's structured studio-album data. Verification matches stable MusicBrainz release-group IDs or Discogs master IDs first, rejects sparse/incomplete verification, and persists accepted results in `artist_discography_cache`. Until verification exists, the fallback only accepts direct MusicBrainz→Discogs matches rather than fuzzy artist/title matches. `get_artist_overview(...)` joins `apple_artwork_cache` directly, so artist pages and album search use persisted Apple artwork instead of calling Apple while rendering. Missing artist-discography artwork is warmed once in the background by the JWT-protected `discogs-search` Edge Function: it resolves the Apple artist once, loads the artist album catalog once, matches the whole main discography and persists the matching Apple album/artwork URLs. Recent incomplete warm attempts are also remembered to avoid repeatedly hitting Apple for albums that have no match. Apple artwork cache writes are normalized to 1200×1200 at the database boundary, so legacy low-resolution Apple URLs cannot make artist cards blurry. Artist photos are not sourced from Discogs; the client only displays a Wikimedia Commons image when its metadata reports a free license, otherwise it uses the Groovy placeholder.

Community album previews reuse the same detail preview and Add Record / Wishlist flow as album search. Discogs-backed albums still save through the verified `discogs-search` Edge Function. For an already-existing catalog album without a Discogs master ID, `public.add_existing_album_to_library(...)` may add only that existing album ID to the authenticated user's collection or wishlist; it cannot create or modify shared catalog rows.

## Edge Functions

The source for every live Edge Function belongs in `supabase/functions/<function-name>/` before or together with deployment.

Current functions:

- `discogs-search`
- `tradera-search`
- `ebay-search`
- `delete-account`

The repository copies were verified against the deployed functions during the September 2026 foundation cleanup.

## Security model

RLS is enabled on all user-facing/public-schema tables.

Ownership policies use `(select auth.uid())` so PostgreSQL can evaluate the authenticated user once per statement.

Most client RPCs run as `SECURITY INVOKER`. The legacy `upsert_apple_artwork_cache(jsonb)` and `save_album_to_library(...)` functions remain authenticated `SECURITY DEFINER` compatibility surfaces for the stable client. The `notes` client no longer calls either one for new album persistence; verified saves use `save_album_to_library_verified(...)`, whose EXECUTE permission is restricted to `service_role`.

Supabase Security Advisor will continue to report the two legacy authenticated SECURITY DEFINER functions until `main` is upgraded and their authenticated EXECUTE permission can be removed. Any new SECURITY DEFINER function requires explicit review.

## Album identity

`public.albums.discogs_master_id` is the canonical external identity for Discogs-backed albums.

The database prevents duplicate non-empty Discogs master IDs. Artist names also have a normalized unique index to prevent duplicate shared artist rows from concurrent catalog saves.

## Auth hardening

Leaked-password protection is an account/project setting rather than repository SQL. It should be enabled in Supabase Auth settings when available for the project.

## Generated schema types

If TypeScript is introduced into more of the frontend, regenerate Supabase database types from the live project and commit the generated file instead of hand-writing table shapes.
