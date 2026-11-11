---
type: Domain Entity
title: Artist
description: A person, group, project, alias, or credited entity connected to releases, tracks, labels, and roles.
tags: [domain, entity, artist]
timestamp: 2026-06-27T00:00:00Z
---

# Artist

An Artist represents a music-related person, group, project, alias, or credited
entity.

Artists can be connected through aliases, memberships, collaborations, credits,
roles, and releases. These relationships are central to DiscWeave's value as a
music archive.

## Modeling Notes

- Preserve artist relationships even when metadata is incomplete.
- Do not collapse aliases into a single name unless the model explicitly records
  the alias relationship.
- Support credits on both releases and tracks when product scenarios require it.

## Related Knowledge

- [Credit](credit.md)
- [Release](release.md)
- [Track](track.md)

## Artist Stacks

The Artists list groups explicitly linked alias identities into expandable
stacks. Memberships remain connections, never identity merges. The master list
expands one level of related records. The inspector separates identities and
aliases, groups and projects, members, and other connections in Relationships;
Collection contains credit appearances and ratings. Record actions remain in
the compact header.

Connections navigate to another record rather than recursively repeating a
tree. Only collection-local artist IDs from persisted relations establish
connections. Matching names alone never create an identity or membership link.
Name-only notes attach to a verified connection only when the target name is
unambiguous and the relation type and direction agree. Other references remain
plain text with an unlinked or ambiguous status. Every distinct relationship
detail stays available beside its connection or reference, including details
with the same name and role. Indirect alias-family entries are identified as
indirect, not presented as direct alias relationships.

Searching an alias can find its family stack. Each selectable name retains its
own detail view, credits and collection activity; browsing a related name does
not combine discographies or modify collection records.

Closed master-list stacks do not mount their connection branches. Relationship
navigation records the source of the clicked connection; ordinary row selection
and add/edit selection clear that context. History and external navigation do
not retain an earlier relationship breadcrumb.

## Contextual Relationship Editing

Relationship edits target explicit persisted relation IDs and verified local
endpoints. Aggregated, inferred, and name-only relationship rows are navigation
or evidence, not interchangeable mutation targets. Artist relation periods must
survive unrelated edits. Editors offer only endpoint types and fields supported
by the persistence contract; derived labels are not presented as editable data.
