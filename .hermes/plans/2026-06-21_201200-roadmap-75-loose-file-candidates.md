# Roadmap 75 — Persist loose file candidates in import sessions

## Issue
Issue #56: `[Roadmap 75] Persist loose file candidates in import sessions`

## Goal
Persist import-session scoped loose file candidates for scanned audio files that should not become automatic release drafts. Loose files remain reviewable workflow data and must not create fake releases, fake tracks, owned items, local audio files, or audio-byte storage.

## Scope
- Add domain + EF persistence for release import loose file candidates.
- Add API response fields so import session detail can return loose candidates and list responses can expose candidate counts.
- Capture file metadata, tag hints, reason, decision state, and optional session/draft/track references.
- Classify at least:
  - root-level audio files with unclear release context;
  - folders whose audio files carry mixed album tags.
- Deduplicate candidates within one session by relative path.
- Preserve collection isolation.

## Guardrails
- No audio bytes/content blobs in loose candidate persistence or API responses.
- Do not create catalog releases/tracks/owned items/local files/file links from loose candidates alone.
- Keep Review Workbench and attach/create actions out of scope for later roadmap issues.

## TDD plan
1. Add API tests for root-level loose files: response includes candidates, drafts/tracks remain zero, ignored count does not absorb the files, no catalog/file-link rows are created.
2. Add tests for persistence/reload and duplicate relative path idempotency.
3. Add collection isolation test with two authenticated users.
4. Add mixed album tag classification test.
5. Implement domain entity, IDs/converters/configuration/DbContext/schema upgrader.
6. Extend scan build/session creation and response mapper.
7. Verify targeted tests, full API tests, frontend typecheck/tests if frontend contracts change, build, diff check, commit and close issue.
