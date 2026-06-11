# SQLite Search Baseline

Local desktop search must not depend on PostgreSQL-only `tsvector`, `pg_trgm`, advisory locks, or bulk `COPY` flows.

The v2 local-first baseline keeps the existing `search_documents` projection and evaluates query, saved-view, role, media, status, tag, label, and collector-signal filters with provider-neutral logic. This preserves the app contract while the SQLite FTS5 virtual table migration is introduced.

## FTS5 migration target

The SQLite schema should add an FTS5 table that mirrors `search_documents.search_text` and uses triggers or application rebuilds to stay aligned with the projection. Ranking can then replace the neutral baseline without changing the API response contract.
