-- Append-only upgrade for existing archives. Stop DiscWeave and make a verified
-- backup of the complete data directory first. Run with sqlite3 -bail.
-- New databases receive the same table through the EF model.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
CREATE TABLE label_import_session_links (
    collection_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    CONSTRAINT PK_label_import_session_links PRIMARY KEY (collection_id, label_id, session_id),
    CONSTRAINT ck_label_import_local_files CHECK (source_kind = 'LocalFiles'),
    CONSTRAINT FK_label_import_session_links_labels_collection_id_label_id
        FOREIGN KEY (collection_id, label_id)
        REFERENCES labels (collection_id, label_id) ON DELETE CASCADE,
    CONSTRAINT FK_label_import_session_links_release_import_sessions_collection_id_session_id_source_kind
        FOREIGN KEY (collection_id, session_id, source_kind)
        REFERENCES release_import_sessions (collection_id, release_import_session_id, source_kind) ON DELETE CASCADE
);
CREATE INDEX IX_label_import_session_links_collection_id_session_id_source_kind
    ON label_import_session_links (collection_id, session_id, source_kind);
COMMIT;
PRAGMA foreign_key_check;
