# Track Relation Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove ambiguous track version metadata and add reviewable import relation suggestions driven by collection-level parser rules.

**Architecture:** DiscWeave remains relation-first: `Track.title` stores the known title, while semantic variant meaning is stored in `TrackRelation`. Import relation suggestions are saved session artifacts, generated from imported track titles and Discogs metadata, then resolved into real `TrackRelation` rows only at final import confirmation.

**Tech Stack:** ASP.NET Core minimal APIs, EF Core with SQLite, xUnit, React 19, Vite, Vitest, Testing Library.

---

## Scope Check

This plan covers one coherent feature vertical: version-note removal, relation parser settings, saved import suggestions, final relation creation, export/restore, and UI review. These pieces are coupled because the new workflow replaces the old `versionNote` product concept. Do not split these into unrelated PRs unless a task uncovers a build-blocking issue.

## File Structure

### Backend Domain

- Modify `api/src/DiscWeave.Domain/Catalog/ReleaseTrack.cs` to remove `VersionNote`.
- Create `api/src/DiscWeave.Domain/Settings/TrackRelationParserRule.cs` for collection-level parser rules.
- Create `api/src/DiscWeave.Domain/Settings/TrackRelationParserRuleDirection.cs`.
- Create `api/src/DiscWeave.Domain/Settings/TrackRelationParserRuleMatchMode.cs`.
- Create `api/src/DiscWeave.Domain/Imports/ReleaseImportRelationSuggestion.cs`.
- Create `api/src/DiscWeave.Domain/Imports/ReleaseImportRelationSuggestionDecision.cs`.
- Create `api/src/DiscWeave.Domain/Imports/ReleaseImportRelationSuggestionEndpoint.cs`.
- Create `api/src/DiscWeave.Domain/Imports/ReleaseImportRelationSuggestionEndpointKind.cs`.
- Create `api/src/DiscWeave.Domain/Imports/ReleaseImportRelationSuggestionPayload.cs`.
- Create `api/src/DiscWeave.Domain/SharedKernel/Ids/TrackRelationParserRuleId.cs`.
- Create `api/src/DiscWeave.Domain/SharedKernel/Ids/ReleaseImportRelationSuggestionId.cs`.

### Backend Persistence

- Modify `api/src/DiscWeave.Infrastructure/Persistence/DiscWeaveDbContext.cs` to add DbSets and query filters.
- Modify `api/src/DiscWeave.Infrastructure/Persistence/Configurations/PersistenceValueConverters.cs` for new typed IDs.
- Modify `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseConfiguration.cs` to drop `version_note` mapping.
- Create `api/src/DiscWeave.Infrastructure/Persistence/Configurations/TrackRelationParserRuleConfiguration.cs`.
- Create `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseImportRelationSuggestionConfiguration.cs`.

### Backend API

- Modify `api/src/DiscWeave.Api/Features/Releases/ReleaseTrackRequest.cs`.
- Modify `api/src/DiscWeave.Api/Features/Releases/ReleaseResponse.cs`.
- Modify `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Entry.cs`.
- Modify `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Response.cs`.
- Modify `api/src/DiscWeave.Api/Features/Tracks/TrackRequest.cs`.
- Modify `api/src/DiscWeave.Api/Features/Tracks/TrackResponse.cs`.
- Modify `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.Entry.cs`.
- Modify `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.Response.cs`.
- Create `api/src/DiscWeave.Api/Features/Settings/TrackRelationParserRuleContracts.cs`.
- Create `api/src/DiscWeave.Api/Features/Settings/SettingsTrackRelationParserRulesEndpointRouteBuilderExtensions.cs`.
- Modify `api/src/DiscWeave.Api/Features/DiscWeaveEndpointRouteBuilderExtensions.cs` to map parser-rule endpoints.
- Create `api/src/DiscWeave.Api/Features/Imports/RelationSuggestionAnalyzer.cs`.
- Create `api/src/DiscWeave.Api/Features/Imports/RelationSuggestionContracts.cs`.
- Create `api/src/DiscWeave.Api/Features/Imports/ReleaseImportRelationSuggestionService.cs`.
- Modify `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Persistence.cs` to generate saved suggestions after draft tracks are saved.
- Modify `api/src/DiscWeave.Api/Features/Imports/ReleaseImportsEndpointRouteBuilderExtensions.cs` to list and update suggestions.
- Modify `api/src/DiscWeave.Api/Features/Imports/ReleaseImportResponseMapper.cs` to include suggestion summary counts.
- Modify `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.cs` to create accepted relations.

### Export and Restore

- Modify `api/src/DiscWeave.Api/Features/Exports/ExportSnapshotResponse.cs`.
- Modify `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.cs`.
- Modify `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.Csv.cs`.
- Modify `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.Csv.Headers.cs`.
- Modify `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.Restore.cs`.
- Modify `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.RestoreMapping.cs`.
- Modify `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.RestoreSettings.cs`.
- Modify `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.SettingsResponses.cs`.

### Frontend

- Modify `app/src/features/catalog/api/catalogTypes.ts`.
- Modify `app/src/features/catalog/api/catalogEntityMappers.ts`.
- Modify `app/src/features/catalog/api/catalogRequestMappers.ts`.
- Modify `app/src/features/catalog/api/releaseTrackState.ts`.
- Modify `app/src/features/catalog/api/catalogDefaults.ts`.
- Modify `app/src/features/catalog/api/settingsClient.ts`.
- Modify `app/src/features/catalog/api/importsExportsClient.ts`.
- Modify `app/src/features/tracks/trackDisplayHelpers.ts`.
- Modify `app/src/features/tracks/TracksWorkspace.tsx`.
- Modify `app/src/features/tracks/TrackDetail.tsx`.
- Modify `app/src/features/tracks/TrackEntryForm.tsx`.
- Modify `app/src/features/tracks/TrackReleaseAppearancesSection.tsx`.
- Modify `app/src/features/releases/ReleaseEntryFormTypes.ts`.
- Modify `app/src/features/releases/releaseFormHelpers.ts`.
- Modify `app/src/features/releases/releaseSubmit.ts`.
- Modify `app/src/features/releases/useReleaseTrackDrafts.ts`.
- Modify `app/src/features/releases/ReleaseTrackDetail.tsx`.
- Modify `app/src/features/releases/ReleaseTracklistSection.tsx`.
- Create `app/src/features/imports/ImportRelationSuggestionsPanel.tsx`.
- Modify `app/src/features/imports/ImportsWorkspace.tsx`.
- Modify `app/src/features/imports/importHelpers.ts`.
- Modify `app/src/features/settings/settingsModel.ts`.
- Modify `app/src/features/settings/settingsData.ts`.
- Create `app/src/features/settings/TrackRelationParserRulesSettings.tsx`.
- Modify `app/src/features/settings/SettingsWorkspace.tsx`.

### Tests

- Modify existing tests that assert `versionNote`.
- Create `api/tests/DiscWeave.Domain.Tests/Settings/TrackRelationParserRuleTests.cs`.
- Create `api/tests/DiscWeave.Domain.Tests/Imports/ReleaseImportRelationSuggestionTests.cs`.
- Create `api/tests/DiscWeave.Api.Tests/TrackRelationParserRuleEndpointTests.cs`.
- Create `api/tests/DiscWeave.Api.Tests/DesktopImportRelationSuggestionTests.cs`.
- Modify `api/tests/DiscWeave.Api.Tests/ExportEndpointTests.PortableV1.cs` or add `ExportEndpointTests.PortableV2.cs`.
- Modify `app/src/App.workspaces-tracks-playlists.test.tsx`.
- Create `app/src/App.imports-relation-suggestions.test.tsx`.
- Create `app/src/features/settings/TrackRelationParserRulesSettings.test.tsx`.

---

## Task 1: Remove Release Track Version Notes From Backend Contracts

**Files:**
- Modify: `api/src/DiscWeave.Domain/Catalog/ReleaseTrack.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseConfiguration.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleaseTrackRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleaseResponse.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Entry.cs`
- Modify: `api/src/DiscWeave.Api/Features/Releases/ReleasesEndpointRouteBuilderExtensions.Response.cs`
- Modify: `api/src/DiscWeave.Api/Features/Tracks/TrackRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/Tracks/TrackResponse.cs`
- Modify: `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.Entry.cs`
- Modify: `api/src/DiscWeave.Api/Features/Tracks/TracksEndpointRouteBuilderExtensions.Response.cs`
- Test: `api/tests/DiscWeave.Domain.Tests/Catalog/ReleaseEntryValueTests.cs`
- Test: `api/tests/DiscWeave.Api.Tests/TrackEndpointContractTests.cs`
- Test: `api/tests/DiscWeave.Api.Tests/ReleaseTracklistLinkingE2ETests.cs`

- [ ] **Step 1: Update the domain test to fail**

Replace the `ReleaseEntryValueTests` version-note assertion with title-override-only coverage:

```csharp
[Fact(DisplayName = "Release track trims title overrides and drops blank overrides")]
public void Release_track_trims_title_overrides_and_drops_blank_overrides()
{
    ReleaseTrack trimmedTrack = ReleaseTrack.Create(
        TrackId.New(),
        TrackPosition.FromNumber(1),
        Optional.From("  Listed title  "),
        Optional.Missing<string>());
    ReleaseTrack blankTrack = ReleaseTrack.Create(
        TrackId.New(),
        TrackPosition.FromNumber(2),
        Optional.From("   "),
        Optional.Missing<string>());

    Assert.Equal("Listed title", Assert.IsType<PresentOptionalValue<string>>(trimmedTrack.TitleOverride).Value);
    Assert.False(blankTrack.TitleOverride.HasValue);
}
```

Run: `cd api && dotnet test DiscWeave.slnx --filter ReleaseEntryValueTests`

Expected: FAIL because `ReleaseTrack.Create` still accepts the old four-argument shape and exposes `VersionNote`.

- [ ] **Step 2: Remove `VersionNote` from `ReleaseTrack`**

Make `ReleaseTrack` contain only `TrackId`, `Position`, and `TitleOverride`:

```csharp
public sealed class ReleaseTrack
{
    private ReleaseTrack()
    {
        Position = TrackPosition.Empty;
        TitleOverride = Optional.Missing<string>();
    }

    private ReleaseTrack(
        TrackId trackId,
        TrackPosition position,
        IOptionalValue<string> titleOverride)
    {
        TrackId = trackId;
        Position = position;
        TitleOverride = titleOverride;
    }

    public TrackId TrackId { get; private set; }

    public TrackPosition Position { get; private set; }

    public IOptionalValue<string> TitleOverride { get; private set; }

    public static ReleaseTrack Create(TrackId trackId, TrackPosition position)
    {
        ArgumentNullException.ThrowIfNull(position);

        return new ReleaseTrack(trackId, position, Optional.Missing<string>());
    }

    public static ReleaseTrack Create(TrackId trackId, TrackPosition position, string titleOverride)
    {
        ArgumentNullException.ThrowIfNull(position);
        ArgumentNullException.ThrowIfNull(titleOverride);

        return Create(
            trackId,
            position,
            string.IsNullOrWhiteSpace(titleOverride)
                ? Optional.Missing<string>()
                : Optional.From(titleOverride.Trim()));
    }

    public static ReleaseTrack Create(
        TrackId trackId,
        TrackPosition position,
        IOptionalValue<string> titleOverride)
    {
        ArgumentNullException.ThrowIfNull(position);
        ArgumentNullException.ThrowIfNull(titleOverride);

        return new ReleaseTrack(trackId, position, NormalizeOptionalText(titleOverride));
    }

    private static IOptionalValue<string> NormalizeOptionalText(IOptionalValue<string> value)
    {
        if (!value.HasValue)
        {
            return Optional.Missing<string>();
        }

        string text = value.Match(static present => present.Trim(), static () => string.Empty);
        return text.Length == 0
            ? Optional.Missing<string>()
            : Optional.From(text);
    }
}
```

- [ ] **Step 3: Remove persistence mapping**

Delete the `versionNoteProperty` block from `ReleaseConfiguration.ConfigureTracklist`. Do not leave a shadow property for `version_note`; fresh SQLite databases should no longer create the column.

Run: `cd api && dotnet test DiscWeave.slnx --filter DiscWeave.Infrastructure.Tests`

Expected: FAIL only where code still references `VersionNote`.

- [ ] **Step 4: Remove API contract fields**

Update records:

```csharp
public sealed class ReleaseTrackRequest
{
    public Guid? TrackId { get; init; }
    public string? Title { get; init; }
    public int Position { get; init; }
    public string? Disc { get; init; }
    public string? Side { get; init; }
    public int? DurationSeconds { get; init; }
    public IReadOnlyList<ReleaseArtistCreditRequest>? ArtistCredits { get; init; }
}
```

```csharp
public sealed record ReleaseTracklistItemResponse(
    Guid TrackId,
    string Title,
    int Position,
    string? Disc,
    string? Side,
    int? DurationSeconds,
    IReadOnlyList<ReleaseArtistCreditResponse> ArtistCredits);
```

```csharp
public sealed record TrackReleaseAppearanceRequest(Guid ReleaseId, int Position, string? Disc, string? Side);
```

```csharp
public sealed record TrackReleaseAppearanceResponse(
    Guid ReleaseId,
    string ReleaseTitle,
    string ReleaseArtist,
    int? Year,
    string? Label,
    int Position,
    string? Disc,
    string? Side,
    int? DurationSeconds);
```

Remove all `VersionNote` reads and constructor arguments from release and track endpoint mappers.

- [ ] **Step 5: Run backend tests and update failing expected JSON**

Run: `cd api && dotnet test DiscWeave.slnx --filter "TrackEndpointContractTests|ReleaseTracklistLinkingE2ETests|ReleaseTracklistInheritanceE2ETests|ReleaseEntryWorkflowE2ETests|ReleaseTypeDictionaryE2ETests|CatalogGraphNavigationEndpointTests"`

Expected: FAIL on tests that send or read `versionNote`.

Update those test payloads by removing `versionNote` properties. Delete tests whose only assertion was version-note behavior. Add the relation replacement coverage in Task 7, where accepted suggestions create `TrackRelation` rows.

- [ ] **Step 6: Verify and commit**

Run: `cd api && dotnet test DiscWeave.slnx --filter "ReleaseEntryValueTests|TrackEndpointContractTests|ReleaseTracklistLinkingE2ETests"`

Expected: PASS.

Commit:

```bash
git add api/src api/tests
git commit -m "Remove release track version notes from API"
```

---

## Task 2: Remove Version Display and Editing From Frontend

**Files:**
- Modify: `app/src/features/catalog/api/catalogTypes.ts`
- Modify: `app/src/features/catalog/api/catalogEntityMappers.ts`
- Modify: `app/src/features/catalog/api/catalogRequestMappers.ts`
- Modify: `app/src/features/catalog/api/releaseTrackState.ts`
- Modify: `app/src/features/tracks/trackDisplayHelpers.ts`
- Modify: `app/src/features/tracks/TracksWorkspace.tsx`
- Modify: `app/src/features/tracks/TrackDetail.tsx`
- Modify: `app/src/features/tracks/TrackEntryForm.tsx`
- Modify: `app/src/features/tracks/TrackReleaseAppearancesSection.tsx`
- Modify: `app/src/features/releases/ReleaseEntryFormTypes.ts`
- Modify: `app/src/features/releases/releaseFormHelpers.ts`
- Modify: `app/src/features/releases/releaseSubmit.ts`
- Modify: `app/src/features/releases/useReleaseTrackDrafts.ts`
- Modify: `app/src/features/releases/ReleaseTrackDetail.tsx`
- Modify: `app/src/features/releases/ReleaseTracklistSection.tsx`
- Test: `app/src/App.workspaces-tracks-playlists.test.tsx`
- Test: `app/src/App.release-entry-basics.test.tsx`
- Test: `app/src/App.release-entry-tracklist.test.tsx`
- Test: `app/src/features/catalog/catalogApi.tracklists.test.ts`

- [ ] **Step 1: Make UI tests expect no Version column**

In `App.workspaces-tracks-playlists.test.tsx`, add an assertion near the Tracks workspace table checks:

```ts
expect(
  h.screen.queryByRole('columnheader', { name: 'Version' }),
).not.toBeInTheDocument()
```

Replace the detail heading assertion from `Versions and relations` to `Relations`.

Run: `cd app && npm test -- App.workspaces-tracks-playlists.test.tsx`

Expected: FAIL because the Version column and old heading still exist.

- [ ] **Step 2: Remove version fields from frontend DTOs**

In `catalogTypes.ts`, remove `versionNote` from `ReleaseTracklistItemDto` and `TrackReleaseAppearanceDto`. Remove `versionNote` from release form track types in `ReleaseEntryFormTypes.ts`.

Remove `TrackRecord.versionHint` from `tracksData.ts` and update all fixtures that still provide it. If a local file UI test used `versionHint` only as required fixture shape, delete that property from the fixture and keep the test assertion unchanged.

- [ ] **Step 3: Remove request mapping**

In `catalogRequestMappers.ts`, stop sending `versionNote`:

```ts
tracklist: release.tracklist.map((track) => ({
  trackId: track.trackId,
  title: track.title,
  position: track.position,
  disc: track.disc,
  side: track.side,
  durationSeconds: track.durationSeconds,
  artistCredits: track.artistCredits,
})),
```

For track release appearances, send `{ releaseId, position, disc, side }`.

- [ ] **Step 4: Remove form controls**

Remove the `Version note` label/input from `TrackEntryForm.tsx`, `TrackReleaseAppearancesSection.tsx`, `ReleaseTrackDetail.tsx`, and `ReleaseTracklistSection.tsx`.

Remove update handlers whose only job was changing `versionNote`.

Use this stable row-edit field union:

```ts
field: 'title' | 'existingTrackQuery' | 'disc' | 'side'
```

- [ ] **Step 5: Remove table display**

In `TracksWorkspace.tsx`, remove the `trackVersionDisplay` import, remove the filter option text `Version or relation type`, remove the `Version` column header, and remove the version `<td>`.

Keep relation filtering by `track.relations[].type` and `track.relationHint`; do not filter by `track.versionHint`.

- [ ] **Step 6: Update detail copy**

In `TrackDetail.tsx`, change the section heading from `Versions and relations` to `Relations`. Add a small summary block under the track title that renders the first relation as:

```tsx
{track.relations.length > 0 ? (
  <p className="detail-summary">
    {track.relations[0].type} -> {track.relations[0].target}
  </p>
) : null}
```

Use the existing relation card list for the full section.

- [ ] **Step 7: Run frontend targeted tests**

Run:

```bash
cd app
npm test -- App.workspaces-tracks-playlists.test.tsx App.release-entry-basics.test.tsx App.release-entry-tracklist.test.tsx catalogApi.tracklists.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/src
git commit -m "Remove track version note UI"
```

---

## Task 3: Add Track Relation Parser Rules

**Files:**
- Create: `api/src/DiscWeave.Domain/SharedKernel/Ids/TrackRelationParserRuleId.cs`
- Create: `api/src/DiscWeave.Domain/Settings/TrackRelationParserRule.cs`
- Create: `api/src/DiscWeave.Domain/Settings/TrackRelationParserRuleDirection.cs`
- Create: `api/src/DiscWeave.Domain/Settings/TrackRelationParserRuleMatchMode.cs`
- Modify: `api/src/DiscWeave.Domain/Settings/CollectionDictionaryDefaults.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/DiscWeaveDbContext.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/PersistenceValueConverters.cs`
- Create: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/TrackRelationParserRuleConfiguration.cs`
- Create: `api/src/DiscWeave.Api/Features/Settings/TrackRelationParserRuleContracts.cs`
- Create: `api/src/DiscWeave.Api/Features/Settings/SettingsTrackRelationParserRulesEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/DiscWeaveEndpointRouteBuilderExtensions.cs`
- Test: `api/tests/DiscWeave.Domain.Tests/Settings/TrackRelationParserRuleTests.cs`
- Test: `api/tests/DiscWeave.Api.Tests/TrackRelationParserRuleEndpointTests.cs`

- [ ] **Step 1: Write domain tests**

Create tests for rule normalization and validation:

```csharp
[Fact(DisplayName = "Track relation parser rule trims alias and validates confidence")]
public void Track_relation_parser_rule_trims_alias_and_validates_confidence()
{
    var rule = TrackRelationParserRule.Create(
        TrackRelationParserRuleId.New(),
        CollectionId.New(),
        "editOf",
        "  Radio Edit  ",
        TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
        95,
        TrackRelationParserRuleDirection.VariantToBase,
        10,
        isBuiltin: false);

    Assert.Equal("Radio Edit", rule.Alias);
    Assert.Equal(95, rule.Confidence);
    Assert.True(rule.IsActive);
    _ = Assert.Throws<DomainException>(() => rule.Update("editOf", "Edit", TrackRelationParserRuleMatchMode.ExactLastParentheticalToken, 101, TrackRelationParserRuleDirection.VariantToBase, 10, true));
}
```

Run: `cd api && dotnet test DiscWeave.slnx --filter TrackRelationParserRuleTests`

Expected: FAIL because the types do not exist.

- [ ] **Step 2: Add typed ID and enums**

Use the existing typed ID pattern:

```csharp
namespace DiscWeave.Domain.SharedKernel.Ids;

public readonly record struct TrackRelationParserRuleId(Guid Value)
{
    public static TrackRelationParserRuleId New()
    {
        return new TrackRelationParserRuleId(Guid.CreateVersion7());
    }
}
```

```csharp
namespace DiscWeave.Domain.Settings;

public enum TrackRelationParserRuleMatchMode
{
    ExactLastParentheticalToken = 1
}
```

```csharp
namespace DiscWeave.Domain.Settings;

public enum TrackRelationParserRuleDirection
{
    VariantToBase = 1,
    BaseToVariant = 2
}
```

- [ ] **Step 3: Add rule aggregate**

Implement `TrackRelationParserRule`:

```csharp
public sealed class TrackRelationParserRule : IEntity<TrackRelationParserRuleId>
{
    private TrackRelationParserRule()
    {
    }

    public TrackRelationParserRuleId Id { get; private set; }
    public CollectionId CollectionId { get; private set; }
    public string RelationTypeCode { get; private set; } = string.Empty;
    public string Alias { get; private set; } = string.Empty;
    public TrackRelationParserRuleMatchMode MatchMode { get; private set; }
    public int Confidence { get; private set; }
    public TrackRelationParserRuleDirection Direction { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }
    public bool IsBuiltin { get; private set; }

    public static TrackRelationParserRule Create(
        TrackRelationParserRuleId id,
        CollectionId collectionId,
        string relationTypeCode,
        string alias,
        TrackRelationParserRuleMatchMode matchMode,
        int confidence,
        TrackRelationParserRuleDirection direction,
        int sortOrder,
        bool isBuiltin)
    {
        var rule = new TrackRelationParserRule
        {
            Id = id,
            CollectionId = collectionId,
            IsBuiltin = isBuiltin
        };
        rule.Update(relationTypeCode, alias, matchMode, confidence, direction, sortOrder, isActive: true);
        return rule;
    }

    public void Update(
        string relationTypeCode,
        string alias,
        TrackRelationParserRuleMatchMode matchMode,
        int confidence,
        TrackRelationParserRuleDirection direction,
        int sortOrder,
        bool isActive)
    {
        RelationTypeCode = Guard.RequiredText(relationTypeCode, nameof(relationTypeCode), "track_relation_parser_rule.relation_type_required");
        Alias = Guard.RequiredText(alias, nameof(alias), "track_relation_parser_rule.alias_required");
        MatchMode = Guard.DefinedEnum(matchMode, nameof(matchMode), "track_relation_parser_rule.match_mode_invalid");
        Direction = Guard.DefinedEnum(direction, nameof(direction), "track_relation_parser_rule.direction_invalid");
        Confidence = confidence is >= 0 and <= 100
            ? confidence
            : throw new DomainException("track_relation_parser_rule.confidence_invalid", "Parser rule confidence must be between 0 and 100");
        SortOrder = sortOrder;
        IsActive = isActive;
    }
}
```

- [ ] **Step 4: Add EF mapping**

Map to `track_relation_parser_rules` with unique `{ collection_id, relation_type_code, alias, match_mode }`.

Also add `DbSet<TrackRelationParserRule> TrackRelationParserRules` and collection query filter in `DiscWeaveDbContext`.

- [ ] **Step 5: Add default rules**

In `CollectionDictionaryDefaults`, add a method:

```csharp
public static IReadOnlyList<TrackRelationParserRule> CreateTrackRelationParserRules(CollectionId collectionId)
{
    return
    [
        Rule(collectionId, "editOf", "Radio Edit", 95, 10),
        Rule(collectionId, "editOf", "Edit", 90, 20),
        Rule(collectionId, "editOf", "Single Edit", 90, 30),
        Rule(collectionId, "remixOf", "Remix", 90, 40),
        Rule(collectionId, "remixOf", "Mix", 75, 50),
        Rule(collectionId, "remixOf", "Club Mix", 85, 60),
        Rule(collectionId, "versionOf", "Instrumental", 80, 70),
        Rule(collectionId, "versionOf", "Extended Mix", 80, 80)
    ];
}
```

Seed these wherever dictionary defaults are currently added for a new collection. Search for `CollectionDictionaryDefaults.CreateEntries` and add `TrackRelationParserRules.AddRange(...)` in the same provisioning path.

- [ ] **Step 6: Add settings endpoints**

Expose:

- `GET /api/settings/track-relation-parser-rules`
- `POST /api/settings/track-relation-parser-rules`
- `PUT /api/settings/track-relation-parser-rules/{ruleId}`
- `DELETE /api/settings/track-relation-parser-rules/{ruleId}`

Validate that `relationTypeCode` references an active `DictionaryKind.TrackRelationType` entry before create/update.

- [ ] **Step 7: Verify and commit**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "TrackRelationParserRuleTests|TrackRelationParserRuleEndpointTests"
```

Expected: PASS.

Commit:

```bash
git add api/src api/tests
git commit -m "Add track relation parser rules"
```

---

## Task 4: Add Relation Suggestion Analyzer

**Files:**
- Create: `api/src/DiscWeave.Api/Features/Imports/RelationSuggestionAnalyzer.cs`
- Test: `api/tests/DiscWeave.Api.Tests/DesktopImportRelationSuggestionTests.cs`

- [ ] **Step 1: Write analyzer tests**

Add tests for last-parenthetical extraction:

```csharp
[Fact(DisplayName = "Relation analyzer uses the last parenthetical block as the variant token")]
public void Relation_analyzer_uses_last_parenthetical_block()
{
    RelationSuggestionTitleParts? parts = RelationSuggestionAnalyzer.TrySplitLastParenthetical(
        "It's Like That (Drop The Break) (Radio Edit)");

    Assert.NotNull(parts);
    Assert.Equal("It's Like That (Drop The Break)", parts.BaseTitle);
    Assert.Equal("Radio Edit", parts.Token);
}
```

Add unknown-token coverage:

```csharp
[Fact(DisplayName = "Relation analyzer returns no title parts without a final parenthetical token")]
public void Relation_analyzer_returns_no_parts_without_final_parenthetical()
{
    Assert.Null(RelationSuggestionAnalyzer.TrySplitLastParenthetical("Plain Track Title"));
}
```

Run: `cd api && dotnet test DiscWeave.slnx --filter Relation_analyzer`

Expected: FAIL because the analyzer does not exist.

- [ ] **Step 2: Implement title splitting**

Implement a small static analyzer:

```csharp
internal static class RelationSuggestionAnalyzer
{
    public static RelationSuggestionTitleParts? TrySplitLastParenthetical(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return null;
        }

        string trimmed = title.Trim();
        if (!trimmed.EndsWith(')'))
        {
            return null;
        }

        int openIndex = trimmed.LastIndexOf(" (", StringComparison.Ordinal);
        if (openIndex < 1 || openIndex >= trimmed.Length - 2)
        {
            return null;
        }

        string token = trimmed[(openIndex + 2)..^1].Trim();
        string baseTitle = trimmed[..openIndex].Trim();
        return token.Length == 0 || baseTitle.Length == 0
            ? null
            : new RelationSuggestionTitleParts(baseTitle, token);
    }

    public static string NormalizeTitle(string title)
    {
        string collapsed = string.Join(' ', title.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return collapsed.ToLowerInvariant();
    }
}

internal sealed record RelationSuggestionTitleParts(string BaseTitle, string Token);
```

- [ ] **Step 3: Add rule matching helper**

Add a method that receives active rules and token:

```csharp
public static TrackRelationParserRule? MatchRule(
    string token,
    IReadOnlyList<TrackRelationParserRule> rules)
{
    string normalizedToken = NormalizeTitle(token);
    return rules
        .Where(rule => rule.IsActive && rule.MatchMode == TrackRelationParserRuleMatchMode.ExactLastParentheticalToken)
        .OrderBy(rule => rule.SortOrder)
        .FirstOrDefault(rule => NormalizeTitle(rule.Alias) == normalizedToken);
}
```

- [ ] **Step 4: Verify and commit**

Run: `cd api && dotnet test DiscWeave.slnx --filter DesktopImportRelationSuggestionTests`

Expected: PASS.

Commit:

```bash
git add api/src api/tests
git commit -m "Add relation suggestion analyzer"
```

---

## Task 5: Persist Import Relation Suggestions

**Files:**
- Create: `api/src/DiscWeave.Domain/SharedKernel/Ids/ReleaseImportRelationSuggestionId.cs`
- Create: `api/src/DiscWeave.Domain/Imports/ReleaseImportRelationSuggestion.cs`
- Create: `api/src/DiscWeave.Domain/Imports/ReleaseImportRelationSuggestionDecision.cs`
- Create: `api/src/DiscWeave.Domain/Imports/ReleaseImportRelationSuggestionEndpoint.cs`
- Create: `api/src/DiscWeave.Domain/Imports/ReleaseImportRelationSuggestionEndpointKind.cs`
- Create: `api/src/DiscWeave.Domain/Imports/ReleaseImportRelationSuggestionPayload.cs`
- Create: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseImportRelationSuggestionConfiguration.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/DiscWeaveDbContext.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/PersistenceValueConverters.cs`
- Test: `api/tests/DiscWeave.Domain.Tests/Imports/ReleaseImportRelationSuggestionTests.cs`

- [ ] **Step 1: Write domain tests**

Create tests:

```csharp
[Fact(DisplayName = "Import relation suggestion stores suggested and reviewed payloads")]
public void Import_relation_suggestion_stores_payloads()
{
    var source = ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(ReleaseImportDraftTrackId.New());
    var target = ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(TrackId.New());
    var payload = new ReleaseImportRelationSuggestionPayload(source, target, "editOf");

    var suggestion = ReleaseImportRelationSuggestion.Create(
        ReleaseImportRelationSuggestionId.New(),
        CollectionId.New(),
        ReleaseImportSessionId.New(),
        ReleaseImportDraftId.New(),
        "Radio Edit",
        95,
        payload);

    suggestion.Accept(payload);

    Assert.Equal(ReleaseImportRelationSuggestionDecision.Accepted, suggestion.Decision);
    Assert.Equal("editOf", suggestion.ReviewedPayload.RelationTypeCode);
}
```

Run: `cd api && dotnet test DiscWeave.slnx --filter ReleaseImportRelationSuggestionTests`

Expected: FAIL because suggestion types do not exist.

- [ ] **Step 2: Add endpoint and payload records**

Use JSON-owned simple records:

```csharp
public sealed record ReleaseImportRelationSuggestionEndpoint(
    ReleaseImportRelationSuggestionEndpointKind Kind,
    Guid Id)
{
    public static ReleaseImportRelationSuggestionEndpoint ForDraftTrack(ReleaseImportDraftTrackId id)
    {
        return new ReleaseImportRelationSuggestionEndpoint(ReleaseImportRelationSuggestionEndpointKind.DraftTrack, id.Value);
    }

    public static ReleaseImportRelationSuggestionEndpoint ForExistingTrack(TrackId id)
    {
        return new ReleaseImportRelationSuggestionEndpoint(ReleaseImportRelationSuggestionEndpointKind.ExistingTrack, id.Value);
    }
}
```

```csharp
public enum ReleaseImportRelationSuggestionEndpointKind
{
    DraftTrack = 1,
    ExistingTrack = 2
}
```

```csharp
public sealed record ReleaseImportRelationSuggestionPayload(
    ReleaseImportRelationSuggestionEndpoint Source,
    ReleaseImportRelationSuggestionEndpoint? Target,
    string? RelationTypeCode);
```

- [ ] **Step 3: Add suggestion aggregate**

Store payloads as JSON strings internally, like import draft tracks do:

```csharp
public sealed class ReleaseImportRelationSuggestion : IEntity<ReleaseImportRelationSuggestionId>
{
    private string _suggestedPayloadJson = "{}";
    private string _reviewedPayloadJson = "{}";

    private ReleaseImportRelationSuggestion()
    {
        Token = string.Empty;
    }

    public ReleaseImportRelationSuggestionId Id { get; private set; }
    public CollectionId CollectionId { get; private set; }
    public ReleaseImportSessionId SessionId { get; private set; }
    public ReleaseImportDraftId DraftId { get; private set; }
    public string Token { get; private set; }
    public int Confidence { get; private set; }
    public ReleaseImportRelationSuggestionDecision Decision { get; private set; }
    public ReleaseImportRelationSuggestionPayload SuggestedPayload => ImportJson.Deserialize<ReleaseImportRelationSuggestionPayload>(_suggestedPayloadJson);
    public ReleaseImportRelationSuggestionPayload ReviewedPayload => ImportJson.Deserialize<ReleaseImportRelationSuggestionPayload>(_reviewedPayloadJson);

    public static ReleaseImportRelationSuggestion Create(
        ReleaseImportRelationSuggestionId id,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId draftId,
        string token,
        int confidence,
        ReleaseImportRelationSuggestionPayload suggestedPayload)
    {
        var suggestion = new ReleaseImportRelationSuggestion
        {
            Id = id,
            CollectionId = collectionId,
            SessionId = sessionId,
            DraftId = draftId,
            Token = Guard.RequiredText(token, nameof(token), "release_import_relation_suggestion.token_required"),
            Confidence = confidence is >= 0 and <= 100
                ? confidence
                : throw new DomainException("release_import_relation_suggestion.confidence_invalid", "Suggestion confidence must be between 0 and 100"),
            Decision = ReleaseImportRelationSuggestionDecision.Pending
        };
        suggestion.SetSuggestedPayload(suggestedPayload);
        suggestion.SetReviewedPayload(suggestedPayload);
        return suggestion;
    }

    public void Accept(ReleaseImportRelationSuggestionPayload reviewedPayload)
    {
        SetReviewedPayload(reviewedPayload);
        Decision = ReleaseImportRelationSuggestionDecision.Accepted;
    }

    public void Reject()
    {
        Decision = ReleaseImportRelationSuggestionDecision.Rejected;
    }

    public void Reset()
    {
        SetReviewedPayload(SuggestedPayload);
        Decision = ReleaseImportRelationSuggestionDecision.Pending;
    }
}
```

Add private `SetSuggestedPayload` and `SetReviewedPayload` methods that serialize with `ImportJson.Serialize`.

- [ ] **Step 4: Map suggestions**

Map `release_import_relation_suggestions` with:

- `release_import_relation_suggestion_id`
- `collection_id`
- `release_import_session_id`
- `release_import_draft_id`
- `token`
- `confidence`
- `decision`
- `suggested_payload_json`
- `reviewed_payload_json`

Add indexes on `{ collection_id, release_import_session_id }` and `{ collection_id, release_import_draft_id }`. Add a cascade FK to `release_import_drafts` using `{ collection_id, release_import_draft_id }`.

- [ ] **Step 5: Verify and commit**

Run: `cd api && dotnet test DiscWeave.slnx --filter ReleaseImportRelationSuggestionTests`

Expected: PASS.

Commit:

```bash
git add api/src api/tests
git commit -m "Persist import relation suggestions"
```

---

## Task 6: Generate Suggestions During Import Scan

**Files:**
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.Persistence.cs`
- Create: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportRelationSuggestionService.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportResponseMapper.cs`
- Test: `api/tests/DiscWeave.Api.Tests/DesktopImportRelationSuggestionTests.cs`

- [ ] **Step 1: Write scan endpoint test**

Use a desktop scan with two tracks:

```csharp
[Fact(DisplayName = "Desktop import saves relation suggestions from track title suffixes")]
public async Task Desktop_import_saves_relation_suggestions_from_track_title_suffixes()
{
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();

    using JsonDocument document = await PostScanWithTitlesAsync(
        client,
        "It's Like That",
        "It's Like That (Drop The Break)",
        "It's Like That (Drop The Break) (Radio Edit)");

    JsonElement suggestions = document.RootElement.GetProperty("relationSuggestions");
    JsonElement suggestion = Assert.Single(suggestions.EnumerateArray());
    Assert.Equal("Radio Edit", suggestion.GetProperty("token").GetString());
    Assert.Equal("pending", suggestion.GetProperty("decision").GetString());
    Assert.Equal("editOf", suggestion.GetProperty("reviewed").GetProperty("relationTypeCode").GetString());
}
```

Expected: FAIL because response has no `relationSuggestions`.

- [ ] **Step 2: Add service to build suggestions**

`ReleaseImportRelationSuggestionService` should:

1. Load active parser rules whose relation type is an active `TrackRelationType`.
2. Load draft tracks for the session.
3. For each non-skipped draft track, call `RelationSuggestionAnalyzer.TrySplitLastParenthetical`.
4. Match token to a rule.
5. Find targets by base title among draft tracks in the session and existing tracks in the collection.
6. Save a suggestion when at least one exact normalized base-title target exists.
7. Preselect the target when exactly one candidate exists; leave target null and include target options when more than one candidate exists.

Use exact normalized matching in this task. Add conservative close normalized matching in Task 7 before the confirm integration test.

- [ ] **Step 3: Add response contracts**

Create:

```csharp
public sealed record ReleaseImportRelationSuggestionResponse(
    Guid Id,
    Guid DraftId,
    string Token,
    int Confidence,
    string Decision,
    ReleaseImportRelationSuggestionPayloadResponse Suggested,
    ReleaseImportRelationSuggestionPayloadResponse Reviewed,
    IReadOnlyList<ReleaseImportRelationSuggestionEndpointResponse> TargetOptions,
    bool IsModified);
```

Expose a `RelationSuggestions` property on `ReleaseImportSessionResponse`.

- [ ] **Step 4: Include suggestions in session detail response**

In `ReleaseImportResponseMapper.ToDetailResponseAsync`, load suggestions for the session and map them into the session response.

- [ ] **Step 5: Verify and commit**

Run: `cd api && dotnet test DiscWeave.slnx --filter DesktopImportRelationSuggestionTests`

Expected: PASS.

Commit:

```bash
git add api/src api/tests
git commit -m "Generate import relation suggestions"
```

---

## Task 7: Review and Confirm Relation Suggestions

**Files:**
- Modify: `api/src/DiscWeave.Api/Features/Imports/RelationSuggestionContracts.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportsEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportConfirmationService.Helpers.cs`
- Test: `api/tests/DiscWeave.Api.Tests/DesktopImportRelationSuggestionTests.cs`

- [ ] **Step 1: Write review lifecycle API test**

Add a test that updates a suggestion to accepted:

```csharp
using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
    $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
    new
    {
        decision = "accepted",
        reviewed = new
        {
            source = new { kind = "draftTrack", id = sourceDraftTrackId },
            target = new { kind = "draftTrack", id = targetDraftTrackId },
            relationTypeCode = "editOf"
        }
    });

Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
```

Expected: FAIL because endpoint does not exist.

- [ ] **Step 2: Add update endpoint**

Map:

```csharp
group.MapPut("/{sessionId:guid}/relation-suggestions/{suggestionId:guid}", UpdateRelationSuggestionAsync)
```

Validate:

- suggestion belongs to the session and collection;
- `decision` is `pending`, `accepted`, or `rejected`;
- accepted suggestions require a target and relation type;
- relation type is an active `TrackRelationType`;
- draft endpoint IDs belong to the same session.

- [ ] **Step 3: Write confirm integration test**

Confirm the draft after accepting the suggestion. Assert `/api/relations?sourceKind=track` or the existing relation endpoint returns:

```csharp
Assert.Equal("editOf", relation.GetProperty("relationType").GetString());
Assert.Equal("It's Like That (Drop The Break) (Radio Edit)", relation.GetProperty("source").GetString());
Assert.Equal("It's Like That (Drop The Break)", relation.GetProperty("target").GetString());
```

Expected: FAIL because confirm does not create relation rows.

- [ ] **Step 4: Add conservative close matching**

Extend `RelationSuggestionAnalyzer.NormalizeTitle` with punctuation folding:

```csharp
public static string NormalizeTitleConservative(string title)
{
    char[] chars =
    [
        .. title.Trim().ToLowerInvariant()
            .Select(character => char.IsLetterOrDigit(character) ? character : ' ')
    ];

    return string.Join(' ', new string(chars).Split(' ', StringSplitOptions.RemoveEmptyEntries));
}
```

Use exact normalized matches first. If there are no exact matches, use conservative normalized matches. Do not use edit distance or fuzzy matching.

- [ ] **Step 5: Add endpoint resolver**

In confirmation service, after tracks are resolved or created, build a map:

```csharp
Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId
```

Populate it inside `AddTracksAsync` and the partial duplicate paths. Existing selected tracks and newly created tracks must both be recorded.

- [ ] **Step 6: Create accepted relations**

After release/track creation and before `SaveChangesAsync`, load accepted suggestions for the draft. Resolve endpoints:

- existing track -> payload ID as `TrackId`;
- draft track -> `resolvedTrackIdsByDraftTrackId[draftTrackId]`.

Skip and record warning when:

- source equals target;
- same `{ source, target, relationTypeCode }` already exists.

Use `TrackRelation.Create(TrackRelationId.New(), collectionId, sourceTrackId, targetTrackId, relationTypeCode)`.

- [ ] **Step 7: Surface warnings**

Add import warning issues to the confirmed draft response or a `confirmWarnings` array on `ReleaseImportSessionResponse`. Use codes:

- `release_import_relation.self_resolved`
- `release_import_relation.duplicate`

Tests should assert warning code presence.

- [ ] **Step 8: Verify and commit**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter DesktopImportRelationSuggestionTests
```

Expected: PASS.

Commit:

```bash
git add api/src api/tests
git commit -m "Confirm accepted import relation suggestions"
```

---

## Task 8: Export and Restore Parser Rules Without Version Notes

**Files:**
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportSnapshotResponse.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.Csv.Headers.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.Csv.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.Restore.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.RestoreMapping.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.RestoreSettings.cs`
- Modify: `api/src/DiscWeave.Api/Features/Exports/ExportsEndpointRouteBuilderExtensions.SettingsResponses.cs`
- Test: `api/tests/DiscWeave.Api.Tests/ExportEndpointTests.PortableV1.cs`
- Test: `api/tests/DiscWeave.Api.Tests/ExportRestoreEndpointTests.SettingsRoundTrip.cs`

- [ ] **Step 1: Write export tests**

Assert JSON export has `formatVersion` 2, includes `trackRelationParserRules`, and release tracklist items do not contain `versionNote`:

```csharp
Assert.Equal(2, document.RootElement.GetProperty("formatVersion").GetInt32());
Assert.True(document.RootElement.TryGetProperty("trackRelationParserRules", out JsonElement rules));
Assert.False(
    document.RootElement
        .GetProperty("releases")[0]
        .GetProperty("tracklist")[0]
        .TryGetProperty("versionNote", out _));
```

Expected: FAIL until export changes are made.

- [ ] **Step 2: Bump export format**

Change:

```csharp
private const int FormatVersion = 2;
```

Because users do not exist yet, restore does not need to accept format version 1 after this task.

- [ ] **Step 3: Add parser rule export contracts**

Add response:

```csharp
public sealed record TrackRelationParserRuleExportResponse(
    Guid Id,
    string RelationTypeCode,
    string Alias,
    string MatchMode,
    int Confidence,
    string Direction,
    int SortOrder,
    bool IsActive,
    bool IsBuiltin);
```

Add `IReadOnlyList<TrackRelationParserRuleExportResponse> TrackRelationParserRules` to `ExportSnapshotResponse`.

- [ ] **Step 4: Remove CSV `version_note`**

Delete `version_note` from release track CSV headers and rows.

- [ ] **Step 5: Restore parser rules**

In restore settings, insert parser rules after dictionaries so relation type codes can be validated against restored `TrackRelationType` entries.

- [ ] **Step 6: Verify and commit**

Run:

```bash
cd api
dotnet test DiscWeave.slnx --filter "ExportEndpointTests|ExportRestoreEndpointTests"
```

Expected: PASS.

Commit:

```bash
git add api/src api/tests
git commit -m "Export track relation parser rules"
```

---

## Task 9: Add Import Relation Suggestions UI

**Files:**
- Modify: `app/src/features/catalog/api/catalogTypes.ts`
- Modify: `app/src/features/catalog/api/importsExportsClient.ts`
- Create: `app/src/features/imports/ImportRelationSuggestionsPanel.tsx`
- Modify: `app/src/features/imports/ImportsWorkspace.tsx`
- Modify: `app/src/features/imports/importHelpers.ts`
- Modify: `app/src/features/imports/imports.css`
- Test: `app/src/App.imports-relation-suggestions.test.tsx`

- [ ] **Step 1: Add frontend DTO types**

Add:

```ts
export type ImportRelationSuggestionDecision = 'pending' | 'accepted' | 'rejected'

export type ImportRelationSuggestionEndpoint = {
  kind: 'draftTrack' | 'existingTrack'
  id: string
  title?: string | null
}

export type ImportRelationSuggestionPayload = {
  source: ImportRelationSuggestionEndpoint
  target?: ImportRelationSuggestionEndpoint | null
  relationTypeCode?: string | null
}

export type ImportRelationSuggestion = {
  id: string
  draftId: string
  token: string
  confidence: number
  decision: ImportRelationSuggestionDecision
  suggested: ImportRelationSuggestionPayload
  reviewed: ImportRelationSuggestionPayload
  isModified: boolean
}
```

Add `relationSuggestions: ImportRelationSuggestion[]` to `ReleaseImportSession`.

- [ ] **Step 2: Add API client**

In `importsExportsClient.ts`:

```ts
export async function updateImportRelationSuggestion(
  sessionId: string,
  suggestionId: string,
  request: {
    decision: ImportRelationSuggestionDecision
    reviewed: ImportRelationSuggestionPayload
  },
) {
  return sendJson<ReleaseImportSession>(
    `/api/imports/${sessionId}/relation-suggestions/${suggestionId}`,
    'PUT',
    request,
  )
}
```

- [ ] **Step 3: Write UI test**

Create test that renders an import session with a pending relation suggestion and accepts it. Assert the panel shows:

- `Relation suggestions`
- `Radio Edit`
- `Edit of`
- `Accept`
- `Reject`

Run: `cd app && npm test -- App.imports-relation-suggestions.test.tsx`

Expected: FAIL because the panel does not exist.

- [ ] **Step 4: Implement panel**

`ImportRelationSuggestionsPanel` props:

```ts
type ImportRelationSuggestionsPanelProps = {
  suggestions: ImportRelationSuggestion[]
  relationTypeOptions: DictionaryEntry[]
  onUpdate: (
    suggestionId: string,
    decision: ImportRelationSuggestionDecision,
    reviewed: ImportRelationSuggestionPayload,
  ) => Promise<void>
}
```

Render a compact table with columns: candidate, relation type, target, status, actions.

Use a `<select>` for relation type. The backend response must include target options for unresolved suggestions before this UI task starts. Render those options in a target `<select>` and require a target before enabling `Accept`.

- [ ] **Step 5: Wire into Imports workspace**

After draft editor, render:

```tsx
<ImportRelationSuggestionsPanel
  suggestions={selectedSession.relationSuggestions ?? []}
  relationTypeOptions={activeDictionaryOptions(dictionaries, 'trackRelationType')}
  onUpdate={handleUpdateRelationSuggestion}
/>
```

`handleUpdateRelationSuggestion` calls the API, updates `selectedSession`, and preserves `selectedDraftId`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
cd app
npm test -- App.imports-relation-suggestions.test.tsx App.imports-desktop.test.tsx
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add app/src
git commit -m "Add import relation suggestions UI"
```

---

## Task 10: Add Parser Rule Settings UI

**Files:**
- Modify: `app/src/features/catalog/api/catalogTypes.ts`
- Modify: `app/src/features/catalog/api/settingsClient.ts`
- Modify: `app/src/features/settings/settingsModel.ts`
- Modify: `app/src/features/settings/settingsData.ts`
- Create: `app/src/features/settings/TrackRelationParserRulesSettings.tsx`
- Modify: `app/src/features/settings/SettingsWorkspace.tsx`
- Test: `app/src/features/settings/TrackRelationParserRulesSettings.test.tsx`
- Test: `app/src/App.settings-navigation.test.tsx`

- [ ] **Step 1: Add settings client types**

Add `TrackRelationParserRule` and request types matching the backend contracts. Add list/create/update/delete client functions.

- [ ] **Step 2: Write component test**

Test that active track relation parser rules render beside dictionary relation types:

```ts
expect(screen.getByRole('heading', { name: 'Track relation parser rules' })).toBeVisible()
expect(screen.getByDisplayValue('Radio Edit')).toBeVisible()
expect(screen.getByRole('combobox', { name: 'Relation type' })).toHaveValue('editOf')
```

Run: `cd app && npm test -- TrackRelationParserRulesSettings.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement settings component**

Build a quiet settings table with fields:

- alias text input;
- relation type select;
- confidence number input from 0 to 100;
- direction select;
- active checkbox;
- save/delete buttons.

Use existing settings styles and button classes.

- [ ] **Step 4: Wire navigation**

Add settings item with name `Track relation parser rules` and search terms `relation`, `parser`, `version`, `import`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
cd app
npm test -- TrackRelationParserRulesSettings.test.tsx App.settings-navigation.test.tsx
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add app/src
git commit -m "Add parser rule settings UI"
```

---

## Task 11: Full Verification and Cleanup

**Files:**
- Modify any stale tests still referencing `versionNote`.
- Modify any stale frontend fixtures in `app/src/test`.
- Modify generated or seed data only when tests prove it is stale.

- [ ] **Step 1: Search for removed concepts**

Run:

```bash
rg -n "versionNote|VersionNote|Version note|No version relation recorded|trackVersionDisplay|Version or relation type" api app
```

Expected: no results except intentionally retained historical wording in this plan/spec. If results appear in source or tests, remove or rename them.

- [ ] **Step 2: Run backend suite**

Run:

```bash
cd api
dotnet test DiscWeave.slnx
```

Expected: PASS.

- [ ] **Step 3: Run frontend suite**

Run:

```bash
cd app
npm test
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 4: Manual smoke check**

Start API and app:

```bash
cd api
ConnectionStrings__DiscWeave="Data Source=var/discweave.sqlite" dotnet run --project src/DiscWeave.Api
```

In another terminal:

```bash
cd app
npm run dev
```

Open the app and verify:

- Tracks table has no `Version` column.
- Track detail shows relation summary when a track has relations.
- Import session shows relation suggestions.
- Accepting a suggestion and confirming import creates a relation.
- Export JSON uses `formatVersion: 2` and includes parser rules.

- [ ] **Step 5: Final commit**

If cleanup changed files:

```bash
git add api app
git commit -m "Complete track relation suggestion workflow"
```

If there were no cleanup changes, do not create an empty commit.
