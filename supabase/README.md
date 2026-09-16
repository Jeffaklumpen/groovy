# Supabase in GroovyShelves

This directory is the repository-side source of truth for Supabase changes used by GroovyShelves.

## Migrations

New database changes must be made as migrations in `supabase/migrations/` and applied to the live project. The live managed migration sequence currently starts with the foundation migrations from `20260916205018` onward.

Older SQL files in this directory predate the current managed migration history. They are retained because they document how existing features were introduced, but they should not be treated as a complete rebuild history for the live project.

Do not edit an already-applied migration to change production behavior. Add a new migration instead.

## Edge Functions

The source for every live Edge Function belongs in `supabase/functions/<function-name>/` before deployment. Avoid editing production functions only in the Supabase dashboard, because that creates drift between GitHub and the live project.

Current functions:

- `discogs-search`
- `tradera-search`
- `ebay-search`
- `delete-account`

All four were synchronized from this repository during the September 2026 foundation cleanup.

## Security model

Row Level Security is enabled on user-facing tables. Ownership policies use `(select auth.uid())` so PostgreSQL can evaluate the authenticated user once per statement instead of once per row.

Client RPCs are restricted to authenticated users. Functions that do not need elevated privileges run as `SECURITY INVOKER`. `upsert_apple_artwork_cache` intentionally remains `SECURITY DEFINER` because authenticated clients may populate the shared artwork cache while direct table writes remain restricted.

## Album identity

`public.albums.discogs_master_id` is the canonical external identity for Discogs-backed albums. Duplicate master IDs were merged during the foundation cleanup and the database now prevents another non-empty Discogs master ID from being stored twice.

## Generated schema types

When TypeScript is introduced into more of the frontend, regenerate Supabase database types from the live project and commit the generated file instead of hand-writing table shapes. Until then, migrations plus the live project remain authoritative for schema changes.
