using System.Globalization;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class DiscogsExternalMetadataProvider
{
    private static ExternalMetadataResult<ExternalMetadataReleaseDetail>
        ToReleaseDetailResult(
            ExternalMetadataResult<DiscogsReleaseDetailResponse> response,
            string requestedId)
    {
        return !response.IsSuccess
            ? new ExternalMetadataResult<ExternalMetadataReleaseDetail>(response.Error)
            : HasExpectedReleaseId(response.Value.Id, requestedId) && // NOSONAR: nested result mapping keeps the provider error path explicit.
            HasValidReleaseStructure(response.Value)
            ? new ExternalMetadataResult<ExternalMetadataReleaseDetail>(MapReleaseDetail(response.Value))
            : new ExternalMetadataResult<ExternalMetadataReleaseDetail>(InvalidResponse());
    }

    private static bool HasExpectedReleaseId(
        long responseId,
        string requestedId)
    {
        return responseId > 0 &&
            string.Equals(
                responseId.ToString(CultureInfo.InvariantCulture),
                requestedId,
                StringComparison.Ordinal);
    }

    private static bool HasValidSearchStructure(
        DiscogsSearchResponse response)
    {
        return response.Results is not null &&
            response.Results.All(result => result is not null);
    }

    private static bool HasValidReleaseStructure(
        DiscogsReleaseDetailResponse response)
    {
        return HasNoNullEntries(response.Artists) &&
            HasNoNullEntries(response.Genres) &&
            HasNoNullEntries(response.Styles) &&
            HasNoNullEntries(response.Labels) &&
            HasValidFormats(response.Formats) &&
            HasNoNullEntries(response.Identifiers) &&
            HasNoNullEntries(response.ExtraArtists) &&
            response.Tracklist is not null &&
            response.Tracklist.All(row =>
                row is not null && HasValidTrack(row));
    }

    private static bool HasValidFormats(
        IReadOnlyList<DiscogsFormatResource>? formats)
    {
        return HasNoNullEntries(formats) &&
            (formats?.All(format =>
                HasNoNullEntries(format.Descriptions)) ?? true);
    }

    private static bool HasValidTrack(DiscogsTrackResponse row)
    {
        return HasNoNullEntries(row.Artists) &&
            HasNoNullEntries(row.ExtraArtists) &&
            (row.SubTracks?.All(subTrack =>
                subTrack is not null && HasValidTrack(subTrack)) ?? true);
    }

    private static bool HasNoNullEntries<T>(
        IReadOnlyList<T>? values)
        where T : class
    {
        return values?.All(value => value is not null) ?? true;
    }
}
