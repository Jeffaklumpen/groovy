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

Authenticated browser clients have SELECT access only. Album persistence goes through:

- `public.save_album_to_library(...)`

That RPC validates the authenticated user and input, serializes concurrent album/library ordering work with transaction-scoped advisory locks, creates or reuses shared catalog rows, completes missing tracks and inserts the user's collection/wishlist row inside one PostgreSQL transaction.

This prevents partial catalog writes and removes direct shared-catalog write permissions from browser clients.

## Explicit Data API grants

Groovy opts into explicit grants instead of relying on Supabase's historical automatic exposure of new `public` tables.

Future migrations that create a client-facing table must include both:

1. the required `GRANT` statements for `anon` / `authenticated`
2. RLS plus policies matching the actual access model

Do not assume a new public table is automatically reachable through `supabase-js`.

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

Most client RPCs run as `SECURITY INVOKER`. Two RPCs intentionally use `SECURITY DEFINER` because they perform narrowly controlled writes that the client cannot perform directly:

- `upsert_apple_artwork_cache(jsonb)`
- `save_album_to_library(...)`

Both validate authentication and input and have EXECUTE restricted to `authenticated`.

Supabase Security Advisor will therefore continue to report these two SECURITY DEFINER functions as warnings by design. Any new SECURITY DEFINER function requires the same explicit review.

## Album identity

`public.albums.discogs_master_id` is the canonical external identity for Discogs-backed albums.

The database prevents duplicate non-empty Discogs master IDs. Artist names also have a normalized unique index to prevent duplicate shared artist rows from concurrent catalog saves.

## Auth hardening

Leaked-password protection is an account/project setting rather than repository SQL. It should be enabled in Supabase Auth settings when available for the project.

## Generated schema types

If TypeScript is introduced into more of the frontend, regenerate Supabase database types from the live project and commit the generated file instead of hand-writing table shapes.
