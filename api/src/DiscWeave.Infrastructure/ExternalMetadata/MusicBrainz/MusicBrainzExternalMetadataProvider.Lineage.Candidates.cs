using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private static RecordingLineageCandidate MapLineageCandidate(
        LineageTarget target,
        RecordingDetailOutcome detail,
        IReadOnlyList<RecordingWorkEvidence> workEvidence,
        ExternalMetadataResult<ReleaseBrowseOutcome> browse)
    {
        IReadOnlyList<ReleaseRoute> releases = browse.IsSuccess ? browse.Value.Releases : [];
        RecordingReleaseRoute[] routes = MapReleaseRoutes(
            releases,
            detail.Mbid,
            out bool invalidRoute);
        bool chronologyComplete =
            browse.IsSuccess &&
            browse.Value.ChronologyComplete &&
            !invalidRoute;
        var warnings = new List<string>();
        if (browse.IsSuccess)
        {
            warnings.AddRange(browse.Value.Warnings);
        }
        else if (IsOperationExhaustion(browse.Error))
        {
            AddWarning(warnings, OperationBudgetExhaustedCode);
        }

        if (invalidRoute)
        {
            AddWarning(warnings, RouteInvalidWarning);
        }

        if (!chronologyComplete)
        {
            AddWarning(warnings, ChronologyIncompleteWarning);
        }

        return new RecordingLineageCandidate
        {
            RecordingSource = MusicBrainzSource("recording", detail.Mbid),
            Title = detail.Title,
            Artists = detail.Artists,
            Duration = detail.Duration,
            Relations = MapLineageRelations(target),
            WorkEvidence = workEvidence,
            ReleaseRoutes = routes,
            ChronologyComplete = chronologyComplete,
            Warnings = SortedWarnings(warnings),
            DiscoveryContext = new RecordingDiscoveryContext
            {
                Role = OriginalCandidateRole.ImmediateParent,
                Paths = new HashSet<OriginalDiscoveryPath>
                {
                    OriginalDiscoveryPath.DirectedRecordingRelation
                },
                Evidence =
                [
                    new OriginalCandidateEvidence
                    {
                        Code = OriginalCandidateEvidenceCode.DirectedLineage,
                        Kind = OriginalCandidateEvidenceKind.Support,
                        Channel = OriginalCandidateEvidenceChannel.MusicBrainz
                    }
                ],
                StructuralEvidenceComplete = chronologyComplete
            }
        };
    }

    private static ExternalMetadataResult<RecordingLineageResult> SuccessResult(
        ExternalMetadataSource? selectedRecording,
        IReadOnlyList<RecordingLineageCandidate> candidates,
        bool chronologyComplete,
        IReadOnlyList<string> providerWarnings,
        IReadOnlyList<ExternalProviderSearchDiagnostic>? searchDiagnostics = null)
    {
        string[] warnings = SortedWarnings(
            providerWarnings.Concat(candidates.SelectMany(candidate => candidate.Warnings)));
        return new ExternalMetadataResult<RecordingLineageResult>(
            new RecordingLineageResult
            {
                SelectedRecording = selectedRecording,
                Candidates = candidates,
                ChronologyComplete = chronologyComplete,
                Warnings = warnings,
                SearchDiagnostics = searchDiagnostics ?? []
            });
    }

    private static string[] SortedWarnings(IEnumerable<string> warnings)
    {
        return
        [
            .. warnings
                .Distinct(StringComparer.Ordinal)
                .OrderBy(warning => warning, StringComparer.Ordinal)
        ];
    }
}
