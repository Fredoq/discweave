using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Fact(DisplayName = "Known Recording query identity is validated and canonicalized")]
    public async Task Known_Recording_query_identity_is_validated_and_canonicalized()
    {
        var recordingId = Guid.Parse(
            "11111111-aaaa-bbbb-cccc-222222222222");
        LocalOriginalCandidateResult local = EmptyLocalResult();
        local = local with
        {
            Source = local.Source! with
            {
                RecordingSource = new ExternalMetadataSource(
                    "MUSICBRAINZ",
                    "RECORDING",
                    recordingId.ToString("D").ToUpperInvariant(),
                    "https://musicbrainz.org/recording/public",
                    "MusicBrainz")
            }
        };
        var provider = new FakeRecordingLineageProvider();

        _ = await CreateService(local, provider).FindAsync(
            CollectionId.New(),
            local.SourceTrackId,
            null,
            CancellationToken.None);

        ExternalMetadataSource known = Assert.IsType<ExternalMetadataSource>(
            provider.LastQuery?.KnownRecording);
        Assert.Equal("musicbrainz", known.ProviderName);
        Assert.Equal("recording", known.ResourceType);
        Assert.Equal(
            recordingId.ToString("D").ToLowerInvariant(),
            known.ExternalId);
    }

    [Theory(DisplayName = "Invalid local external references are omitted from the lineage query")]
    [InlineData("musicbrainz", "release", "11111111-aaaa-bbbb-cccc-222222222222")]
    [InlineData("musicbrainz", "recording", "not-a-uuid")]
    [InlineData("discogs", "recording", "11111111-aaaa-bbbb-cccc-222222222222")]
    public async Task Invalid_local_external_references_are_omitted_from_the_lineage_query(
        string providerCode,
        string resourceType,
        string externalId)
    {
        LocalOriginalCandidateResult local = EmptyLocalResult();
        local = local with
        {
            Source = local.Source! with
            {
                RecordingSource = new ExternalMetadataSource(
                    providerCode,
                    resourceType,
                    externalId,
                    "https://example.invalid/public",
                    "Public provider")
            }
        };
        var provider = new FakeRecordingLineageProvider();

        _ = await CreateService(local, provider).FindAsync(
            CollectionId.New(),
            local.SourceTrackId,
            null,
            CancellationToken.None);

        Assert.Null(provider.LastQuery?.KnownRecording);
    }

    [Fact(DisplayName = "Known providers without lineage capability retain an unsupported status")]
    public async Task Known_providers_without_lineage_capability_retain_an_unsupported_status()
    {
        LocalOriginalCandidateResult local = EmptyLocalResult();
        ExternalOriginalCandidateService service = CreateService(
            local,
            new FakeExternalMetadataProvider("discogs"));

        ExternalOriginalCandidateResult result = await service.FindAsync(
            CollectionId.New(),
            local.SourceTrackId,
            ["discogs"],
            CancellationToken.None);

        ExternalProviderOperationStatus status =
            Assert.Single(result.ProviderStatuses);
        Assert.Equal("discogs", status.ProviderCode);
        Assert.Equal(
            ExternalProviderOperationOutcome.UnsupportedCapability,
            status.Outcome);
        Assert.Equal(
            "external_metadata.unsupported_capability",
            status.ErrorCode);
    }

    [Fact(DisplayName = "Actual route enrichment replaces a prior Discogs capability status")]
    public async Task Actual_route_enrichment_replaces_a_prior_Discogs_capability_status()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var candidateId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        var musicBrainz = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult(
                    [
                        LineageCandidate(
                            candidateId,
                            [Relation(selectedId, candidateId)],
                            [
                                Route(
                                    Guid.Parse(
                                        "22222222-2222-2222-2222-222222222222"),
                                    1983)
                            ])
                    ],
                    RecordingSource(selectedId)))
        };
        LocalOriginalCandidateResult local = EmptyLocalResult();
        ExternalOriginalCandidateService service = CreateService(
            local,
            musicBrainz,
            new FakeExternalMetadataProvider("discogs"));

        ExternalOriginalCandidateResult result = await service.FindAsync(
            CollectionId.New(),
            local.SourceTrackId,
            ["musicbrainz", "discogs"],
            CancellationToken.None);

        ExternalProviderOperationStatus status =
            result.ProviderStatuses.Single(value =>
                value.ProviderCode == "discogs");
        Assert.Equal(
            ExternalProviderOperationOutcome.Succeeded,
            status.Outcome);
        Assert.Null(status.ErrorCode);
    }
}
