# Migration Policy

DiscWeave treats collection data as durable product data. The local desktop baseline currently creates the SQLite schema from the EF Core model. Future schema upgrade work must preserve the ability to upgrade an existing archive without rewriting history.

## Pre-release baseline exception

Before the first release with user-owned archives, the project owner may apply a
one-time baseline upgrade to the local development database (or export/reset
and recreate it) using a reviewed operational script. This exception does not
add EF Core migrations or a runtime schema upgrader to the product. It is valid
only while the product is an internal, disposable pre-release and no user-owned
archive must be preserved.

Once real user archives exist, this exception expires and schema-affecting
changes require an approved backup/export-and-restore procedure or an
append-only upgrade path before release.

## Rules

- Do not reintroduce generated EF Core migrations unless a future task explicitly scopes a durable upgrade path.
- If migrations are reintroduced, keep them append-only, readable, and reviewable.
- Rewrite a baseline schema only with explicit project-owner approval for a deliberate schema reset.
- Back up collection data before applying migrations that affect catalog, ownership, import, search, export, settings, playlists, ratings, or authentication data.
- Back up local desktop databases and collection exports before shipping schema-affecting ownership changes such as adding `OwnedItemDetails.Note` / `owned_items.note`.
- Prefer reversible operational procedures for risky changes: export JSON first, apply migration, verify acceptance checks, then keep the backup until the upgraded archive is confirmed.

## Rollback Expectations

Rollback is an operational decision, not an automatic promise. If a schema upgrade cannot safely roll back automatically, document the recovery path in the same change, usually by restoring from a JSON export or database backup.
