-- One-time baseline upgrade of an existing DiscWeave SQLite archive to five-point ratings.
-- Apply once, with DiscWeave closed, after copying the data directory:
--   sqlite3 -bail discweave.sqlite < upgrade-ratings-to-five-point.sql
-- A second run stops at the first ALTER TABLE and changes nothing.
BEGIN;

ALTER TABLE rating_criteria ADD COLUMN artist_average_roles TEXT NOT NULL DEFAULT '';

-- Role codes are newline-separated; main artist and remixer count by default.
UPDATE rating_criteria
SET artist_average_roles = 'mainArtist' || char(10) || 'remixer'
WHERE artist_average_roles = '';

ALTER TABLE rating_values ADD COLUMN is_standout INTEGER NOT NULL DEFAULT 0;

-- 1-5 become 1, 6-9 become 2-5, and 10 becomes a standout 5.
UPDATE rating_values
SET is_standout = CASE WHEN rating >= 10 THEN 1 ELSE 0 END,
    rating = CASE
        WHEN rating >= 10 THEN 5
        WHEN rating <= 5 THEN 1
        ELSE rating - 4
    END
WHERE rating BETWEEN 1 AND 10;

COMMIT;
