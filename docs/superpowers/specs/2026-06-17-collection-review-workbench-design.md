# Collection Review Workbench Design

## Context

Issue #32 defines the next product decision slice after the local desktop
dogfooding pass and the import relation suggestion work. DiscWeave already has
manual entry, imports, relation suggestions, search, owned item inventory
views, export, restore, and a read-only catalog quality baseline.

The next product step is to turn collection problems into a durable collector
workflow:

> What in my collection needs review, what did I already decide, and where do I
> go next?

The Collection Review Workbench is not a recommendation system, player,
marketplace, merge tool, or social feature. It is a local-first archive
maintenance surface for careful collectors.

## Decisions

The Workbench is a collection-scoped review workflow built from generated
signals plus persisted triage state.

`GET /api/catalog-quality` remains the read-only quality report baseline. It
must not be repurposed into the mutable Workbench API. The Workbench may reuse
the same detectors and report sections, but its mutable state belongs in a
separate review workflow model.

The first Workbench slice supports these user actions:

- view review queues;
- filter by category and state;
- navigate to existing catalog, import, detail, and edit surfaces;
- dismiss a review item;
- mark a review item resolved;
- reopen a dismissed or resolved item.

The first slice does not support:

- automatic merge;
- bulk destructive cleanup;
- inline quick fixes;
- automatic relation creation;
- recommendations;
- playback or player-oriented flows;
- sync, SaaS, social, marketplace, or public sharing scope.

The Workbench is guidance for archive cleanup. It must not rewrite catalog data
without a separate future design and explicit user confirmation.

## Review Taxonomy

The MVP taxonomy contains five categories.

`duplicateCandidates` covers likely duplicate records or identities that need
manual comparison. Initial subtypes are duplicate releases, duplicate tracks,
and duplicate digital file identities. Future duplicate artist coverage belongs
in this category.

`missingMetadata` covers incomplete archive fields that reduce search,
inventory, or export usefulness. Initial subtypes come from the current catalog
quality report: releases missing year or date, releases missing label, tracks
missing duration, owned items missing condition, owned items missing storage
location, and digital owned items missing format.

`formatGaps` covers collection inventory gaps. Initial subtypes are physical
without digital, lossy without lossless, wanted not owned, and needs
digitization.

`relationGaps` covers relationship opportunities that should stay reviewable
instead of automatic. Examples include variant-looking track titles without a
track relation, likely aliases without an artist relation, and remix or version
signals without an explicit relation.

`importCleanup` covers unresolved import follow-up after scan or confirmation:
warnings, duplicate outcomes, skipped relation suggestions, and import-created
cleanup needs that still deserve collection-level attention.

Each review item must expose a category, subtype, concise title, severity or
priority signal if available, source detector, affected targets, and navigation
links to existing surfaces. The user should be able to understand why the item
exists without reading implementation details.

## Triage States

The Workbench uses one visible state field and a separate reason field when a
state needs provenance.

`open` means the signal currently needs review.

`dismissed` means the user intentionally hides a still-known signal from active
work. Dismissal is a user decision, not proof that the underlying data changed.

`resolved` means the item is no longer active. Resolution can happen in two
ways:

- `resolvedBySystem`, when a regenerated signal disappears because the catalog
  data changed;
- `resolvedByUser`, when the user decides the issue is handled even if the
  detector might still be able to find related data.

`reopened` means a dismissed or resolved item was explicitly returned to active
review, or a materially changed signal needs attention again. Reopened items
should appear in active queues like open items, while preserving their history.

The UI may group `open` and `reopened` together as active work, but API and
stored state should preserve the distinction.

## Stable Identity

Review item identity must be stable across reloads, relaunches, and ordinary
regeneration of the same signal.

The identity should be derived from:

- collection;
- category;
- subtype;
- detector key;
- target kind;
- normalized target id set or stable external workflow target;
- optional normalized comparison key for duplicate or file-identity groups.

Ordinary reloads must not create new review items.

Minor ordering changes in a duplicate group must not create a new item.

Material target-set changes may create a new review item instead of silently
mutating old history. For example, a duplicate group that grows from two
records to three can be treated as a changed signal that deserves fresh review.

If a target is deleted, the Workbench should not resurrect the deleted target
through stale state. The next regeneration should either resolve the old item
or create a new item only if a valid signal remains.

## Data And API Direction

Issue #33 owns the backend implementation, but #32 fixes the product contract.

The mutable Workbench API should be collection-scoped and separate from
`/api/catalog-quality`. It should support listing review items, filtering by
category and state, updating triage state, and exposing target links for
navigation.

The normal UI and API routes must not expose or accept user-controlled
`collectionId` values. Collection scope follows the existing authenticated
local owner session model.

Persisted review state is user archive workflow data. Future JSON export and
restore should include review state unless issue #38 documents a narrower
implementation constraint. Human-readable review report export remains issue
#38 scope.

## UX Direction

Issue #34 owns the UI implementation. This decision sets the product and
interaction boundaries.

The Workbench should use the existing DiscWeave desktop shell and the current
calm, dense, work-focused visual language. It should feel like a maintenance
desk for a collector's archive, not a dashboard for growth metrics or a
recommendation feed.

The first UI should emphasize:

- summary counts by category and state;
- compact queues;
- clear active versus dismissed/resolved state;
- direct navigation to existing catalog, detail, edit, and import surfaces;
- restrained status styling.

The UI should not use a marketing hero, social copy, playback language,
recommendation framing, gamification, or broad abstract design-system work.

Review items should show enough context to decide the next action, but they
should not try to solve every cleanup case inline. Inline quick fixes and merge
flows require later designs.

## Downstream Issue Boundaries

Issue #33 implements the review issue feed, persisted triage state, and API
state transitions.

Issue #34 implements the Review Workbench overview and queue UI.

Issue #35 adds relation gap and variant-title review signals.

Issue #36 expands duplicate candidate detail context without merge automation.

Issue #37 connects import cleanup warnings to the Workbench.

Issue #38 defines export and documentation behavior for review reports and
persisted review state.

Issue #39 validates the Workbench on realistic local collections and large
seed data.

## Testing Direction

The design task itself has no runtime tests. Downstream implementation should
cover:

- review item list generation;
- triage state transitions;
- collection isolation;
- stable identity across regeneration;
- system-resolved versus user-resolved behavior;
- dismissed and reopened item behavior;
- navigation targets for catalog and import context;
- export and restore behavior for review state;
- large-collection smoke coverage.

## Out Of Scope

This design does not implement API, schema, React, Electron, export, or restore
changes.

This design does not define merge semantics.

This design does not create automatic cleanup actions.

This design does not make Discogs or MusicBrainz identifiers required for core
review signals.

This design does not change the existing import confirmation semantics.
