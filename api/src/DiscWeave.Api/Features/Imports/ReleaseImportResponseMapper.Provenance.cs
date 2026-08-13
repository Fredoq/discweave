using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Imports;

internal static partial class ReleaseImportResponseMapper
{
    private static IReadOnlyList<ReleaseImportArtistCredit> EffectiveArtistCredits(ReleaseImportDraft draft)
    {
        return draft.ArtistCredits.Count > 0
            ? draft.ArtistCredits
            : [.. draft.ArtistNames.Select((name, index) => new ReleaseImportArtistCredit(
                index < draft.SelectedArtistIds.Count ? draft.SelectedArtistIds[index] : null,
                name,
                "mainArtist"))];
    }

    private static IReadOnlyList<ReleaseImportLabel> EffectiveLabels(ReleaseImportDraft draft)
    {
        if (draft.Labels.Count > 0)
        {
            return draft.Labels;
        }

        IReadOnlyList<ReleaseImportLabel> labels = [];
        if (!string.IsNullOrWhiteSpace(draft.LabelName))
        {
            labels =
            [
                new ReleaseImportLabel(
                    null,
                    draft.LabelName,
                    draft.CatalogNumber,
                    string.IsNullOrWhiteSpace(draft.CatalogNumber))
            ];
        }

        return labels;
    }

    private static ReleaseImportArtistCreditResponse ToArtistCreditResponse(ReleaseImportArtistCredit credit)
    {
        return new ReleaseImportArtistCreditResponse(
            credit.ArtistId,
            credit.Name,
            credit.Role,
            ToArtistCreditExternalSourceResponse(credit.ExternalSource));
    }

    private static ReleaseImportArtistCreditExternalSourceResponse? ToArtistCreditExternalSourceResponse(
        ReleaseImportArtistCreditExternalSource? source)
    {
        return source is null
            ? null
            : new ReleaseImportArtistCreditExternalSourceResponse(
                source.ProviderName,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl);
    }

    private static ReleaseImportLabelResponse ToLabelResponse(ReleaseImportLabel label)
    {
        return new ReleaseImportLabelResponse(label.LabelId, label.Name, label.CatalogNumber, label.HasNoCatalogNumber);
    }

    private static string SourceKindCode(ReleaseImportSourceKind sourceKind)
    {
        return sourceKind switch
        {
            ReleaseImportSourceKind.LocalFiles => "localFiles",
            ReleaseImportSourceKind.ExternalMetadata => "externalMetadata",
            _ => throw new InvalidOperationException("Release import source kind is not supported")
        };
    }

    private static void EnsureSourceKindsAgree(
        ReleaseImportSourceKind parentSourceKind,
        ReleaseImportSourceKind childSourceKind,
        string relationship)
    {
        if (parentSourceKind != childSourceKind)
        {
            throw new InvalidOperationException($"Source kind mismatch between {relationship}");
        }
    }

    private static T? OptionalReference<T>(IOptionalValue<T> optionalValue)
        where T : class
    {
        return optionalValue is PresentOptionalValue<T> present ? present.Value : null;
    }

    private static T? OptionalStruct<T>(IOptionalValue<T> optionalValue)
        where T : struct
    {
        return optionalValue is PresentOptionalValue<T> present ? present.Value : null;
    }

    private static IReadOnlyList<ReleaseImportArtistCredit> EffectiveTrackArtistCredits(ReleaseImportDraftTrack track)
    {
        return track.ArtistCredits.Count > 0
            ? track.ArtistCredits
            : [.. track.ArtistNames.Select((name, index) => new ReleaseImportArtistCredit(
                index < track.SelectedArtistIds.Count ? track.SelectedArtistIds[index] : null,
                name,
                "mainArtist"))];
    }

    private static ImportIssueResponse ToIssueResponse(ImportReviewIssue issue)
    {
        return new ImportIssueResponse(issue.Code, issue.Message, IssueSeverityCode(issue.Severity));
    }
}
