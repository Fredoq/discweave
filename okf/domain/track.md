---
type: Domain Entity
title: Track
description: A musical work or recording entry as it appears within release media and tracklists.
tags: [domain, entity, track]
timestamp: 2026-07-24T00:00:00Z
---

# Track

A Track represents a concrete track version or recording connected to one or
more media and releases.

DiscWeave should preserve tracklist number, title, duration, artist attribution,
and credits where available.

## Modeling Notes

- Track numbering should support physical and digital media layouts.
- Track-level credits can differ from release-level credits.
- Track data may be incomplete, especially for rare or user-entered material.
- Track year metadata should describe the concrete version or recording, not the
  release year.
- Release editors and import review may update Track title, duration, year, and
  Track credits through a linked release tracklist row when that row points to a
  catalog Track.
- Track stacks are relation-derived views. The original or anchor Track is an
  explicit Track metadata choice, and stack membership is found by traversing
  configured version-like Track relations toward that original.
- `remixOf` and `versionOf` are product-owned protected Track relation type
  codes. The Tracks workspace may use them for first-class stack groups named
  Remixes and Versions.
- Edits, radio edits, and single edits are modeled as `versionOf`; DiscWeave
  does not maintain a separate built-in `editOf` relation type.
- Collection-level stack settings remain the extension point for traversal and
  future custom stack rules. Non-product stack relation types should appear as
  Other relations until custom stack grouping is modeled explicitly.
- Release-only tracklist rows are not Tracks and should not appear in the Tracks
  workspace.

## Stack Assignment

- Assigning a Track to a stack creates a directed relation from the member Track
  to the existing stack root. It does not create a persisted `TrackStack`
  aggregate.
- An assignable source is a standalone Track that is neither a member of another
  stack nor a root with members. An assignment target is an existing original
  Track with at least one transitive stack member. Original discovery is a
  distinct confirmation path that may explicitly promote an eligible
  standalone target while creating the relation.
- Destination discovery is collection-scoped and independent of the Tracks
  workspace's current scroll position, filters, and visible page. A match on a
  stack member identifies its root as the destination.
- The user explicitly chooses one of the enabled stack relation types.
  DiscWeave does not infer relation meaning from Track titles.
- Drag-and-drop remains a direct path when both records are visible. Searchable,
  keyboard-accessible assignment is the scalable path for large collections;
  both paths use the same authoritative validation and relation mutation.

## Original Discovery

- An eligible discovery source is a persisted, non-original standalone Track.
  Discovery is unavailable until both the server catalog and the
  relation-derived stack projection are ready.
- Local discovery is read-only. It ranks collection-scoped candidates from
  deterministic named evidence, contradictions, missing facts, chronology, and
  hard gates. Confidence remains qualitative and explainable rather than an
  opaque numeric or learned score.
- Discovery never preselects a candidate. Weak eligible matches remain visibly
  marked with Low confidence, but selecting one and explicitly continuing to
  Review is sufficient to inspect it; the final Review action retains the
  warning and explicit confirmation before any mutation.
- The candidate list prioritizes identification over internal diagnostics. A
  selected external candidate shows its earliest dated release route, source,
  medium position, and remaining route count. Named evidence, contradictions,
  missing facts, and inference paths remain available to deterministic ranking,
  API diagnostics, and logs but are not rendered in the candidate card.
- Confirmation uses an enabled stack relation type and revalidates current
  source, target, settings, and stack state on the server.
- Confirming an existing original root creates only the directed relation.
  Confirming an eligible standalone candidate atomically marks that target as
  original and creates the relation. Either both changes persist or neither
  does.
- Promotion does not create a persisted stack aggregate. The resulting stack
  remains a view derived from Track metadata and configured Track relations.
- External discovery treats the MusicBrainz Recording as lineage evidence and
  preserves the concrete MusicBrainz Track MBID separately. Both references
  survive draft review and are unioned onto the confirmed catalog Track;
  external identifiers never replace the collection-scoped Track ID.
- A release route belongs only to the candidate Recording referenced by its
  MusicBrainz release-track row. Unrelated sibling tracks from the same Release
  are not candidate routes and must not appear as duplicate release choices.
- MusicBrainz discovery searches the catalog title first. When a versioned
  title returns no recordings, it may retry with the catalog-derived base title
  while preserving both request URLs and mapped response summaries for review.
- Version-marker parsing recognizes configured aliases as whole phrases inside
  the final parenthetical token. Named variants such as `Ferry Corsten Remix`
  therefore match the `Remix` alias; when several aliases match, the most
  specific phrase wins so `Club Mix` and `Extended Mix` are not reduced to
  `Mix`.
- External discovery uses bounded deterministic MusicBrainz lanes: explicit
  Recording relations, Work performances, source-release siblings, and
  release-group fallback search. The provider records the executed paths and
  named evidence for every inferred candidate.
- Work-performance discovery does not suppress release-group fallback until at
  least one candidate has a concrete release route. An external-only Recording
  without an actionable release route is diagnostic data, not a selectable
  candidate; an exact local Track match remains actionable without one.
- A complete inferred historical root may be reliable when Shared Work,
  matching artist, a compatible version role, complete official-release
  context, and either earlier chronology or explicit original/full-length
  labeling agree. Same Work alone and chronology alone remain diagnostic.
- Candidate roles are `historicalRoot`, `immediateParent`, and `diagnostic`.
  Missing or truncated structural context caps inferred confidence at Medium;
  cover performances, Work mismatches, reversed lineage, and incompatible
  version roles remain hard contradictions.
- MusicBrainz partial results preserve completed candidates and expose warning
  codes, request diagnostics, mapped counts, and skipped/truncated lanes. No
  LLM, embedding, or learned score is used, and no public-provider request
  contains collection or local-file data.
- A selected Recording is bound to one reviewed release row. The binding is
  revalidated during preflight and confirmation, and a stale or ambiguous row
  blocks confirmation until the user reviews it again.
- The source title's enabled parser rule supplies the reviewed relation type
  for both local and external candidates. Release-first candidates retain this
  suggestion even when MusicBrainz has no explicit Recording relation.
- External Review prioritizes release selection rather than discovery
  diagnostics. It shows compact release identity, date, medium or track
  position, and provider provenance; the draft action remains visible and is
  enabled after a release route is selected. The resulting draft opens in the
  regular import review workspace.
- An external-original draft opens in a compact user review rather than the
  technical import editor. It shows the bound original Track, concrete Release,
  provider coverage, collection intent, and medium. MBIDs, collection IDs, row
  ordinals, fingerprints, provenance repair, and rebind controls remain in the
  draft and API diagnostics but are not editable in the ordinary flow. Release
  metadata editing is available through explicit progressive disclosure.
- Original-track discovery is read-only until the persisted import review is
  confirmed. The review may create or reuse the Release and Track, initialize a
  Wanted intent, and apply the accepted Required relation atomically.

## Related Knowledge

- [Release](release.md)
- [Medium](medium.md)
- [Credit](credit.md)
- [Collection Isolation](../architecture/collection-isolation.md)
