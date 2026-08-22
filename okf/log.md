# OKF Maintenance Log

## 2026-08-21

- Accepted the local-file Discogs enrichment workflow: match rows independently
  of source order, preserve local-file identity while applying Discogs
  metadata/order, review ambiguous matches, and block incomplete Tracklist
  mappings without blocking other selected groups; metadata-only drafts retain
  authoritative server-side row binding.

## 2026-08-14

- Documented the free macOS distribution path: final DMGs use a complete ad-hoc
  signature and require a one-time Privacy & Security override, while optional
  Developer ID credentials enable signed and notarized releases.
- Required strict verification of the application inside the final DMG before
  either release mode can be published.

## 2026-06-27

- Created the initial DiscWeave OKF bundle.
- Captured product, domain, architecture, workflow, and roadmap knowledge that
  future agents should inspect before related implementation work.
- Replaced the repo-local DiscWeave OKF skill with the reusable global `$okf`
  skill.
- Captured the accepted Track metadata, relation-derived stack, and release-only
  tracklist row direction in the domain and import workflow pages.

## 2026-06-28

- Clarified that linked release tracklist rows can edit canonical Track
  metadata, while row position, disc, and side remain release metadata.
- Clarified that import confirmation applies reviewed Track metadata to linked
  existing Tracks.
- Captured product-owned Track stack relation semantics: `remixOf` and
  `versionOf` are protected first-class stack relation codes, while edit-like
  variants are modeled as `versionOf`.

## 2026-07-17

- Captured the collection-scoped searchable Track stack assignment workflow,
  including source and destination eligibility, explicit relation meaning, and
  shared validation with drag-and-drop.
- Captured Release-scoped Track quick-open behavior and its boundary between
  trusted operating-system file opening and in-app playback.
- Captured persistent post-edit local file trust, including identity
  verification across desktop restarts and the requirement to rescan files
  changed outside DiscWeave.
- Clarified that full-scan file provenance survives metadata parsing failures
  when the path, size, timestamp, and SHA-256 hash were captured successfully.

## 2026-07-24

- Captured deterministic, explainable, collection-scoped local original-track
  discovery as a read-only workflow.
- Clarified that confirmed original discovery may atomically promote an
  eligible standalone target while creating its directed stack relation, while
  stacks remain relation-derived views.

## 2026-08-02

- Captured the external original-track workflow: MusicBrainz Recording lineage
  and Track MBID survive persisted review, while Discogs release provenance is
  optional enrichment after authoritative route matching.
- Captured collection-scoped zero/one/many provenance resolution, independent
  persisted Release and Track selections, optimistic review revisions, and
  typed provider rebind as the only route/row replacement path.
- Captured metadata-only external confirmation, explicit Wanted medium intent,
  Required relation atomicity, and the rule that external metadata creates no
  local file artifacts or implicit ownership.
- Approved a pre-release baseline exception: while no user-owned archives
  exist, the local development database may receive a one-time reviewed
  baseline upgrade or be reset/recreated from the current EF model without
  adding migrations or a runtime upgrader. This exception expires before the
  first release that must preserve user archives.
- Clarified original-track review UX: low-confidence diagnostics remain
  visibly distinct, but a user may explicitly acknowledge the weak evidence to
  open and confirm a manual review. Partial MusicBrainz results explain their
  incompleteness and are presented as leads rather than confirmation.
- Clarified MusicBrainz search transparency: a zero-result version-title query
  retries with the catalog base title, and the review exposes safe request URLs
  plus mapped response summaries. Search matches without explicit lineage
  remain diagnostics unless the deterministic multi-factor structural rule is
  met.

## 2026-08-08

- Simplified original-track candidate review: selecting a Low-confidence lead
  now opens Review without a second acknowledgement checkbox, while the final
  mutation retains its explicit warning and confirmation. Selected external
  cards show the earliest release route instead of inference and evidence
  diagnostics.
- Replaced the external evidence-inspector step with a compact release picker.
  Discovery diagnostics stay out of the product UI, release provenance and
  positions remain visible, and the import-draft action no longer disappears
  while a release choice is required.
- Added bounded deterministic MusicBrainz original discovery across Recording
  relations, Work performances, source-release siblings, and release-group
  fallback search. Candidate roles, named evidence, request paths, mapped
  counts, and incomplete-lane warnings are preserved through API review.
- Required a concrete release route before Work-performance results can stop
  release-group fallback, and removed external-only routeless Recordings from
  the selectable candidate list while preserving exact local Track matches.
- Documented that complete multi-factor structural evidence may produce a
  reliable inferred historical root, while Shared Work or chronology alone
  remains diagnostic. No LLM, embedding, vector database, or MusicBrainz token
  is required.
