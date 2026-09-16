-- Individual track ratings are no longer part of Groovy.
-- Album ratings remain in public.album_ratings.
-- Track durations are fetched from Discogs only when the album detail view is opened.

drop table if exists public.track_ratings;
