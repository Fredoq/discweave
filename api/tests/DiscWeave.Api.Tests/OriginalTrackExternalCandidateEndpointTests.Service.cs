using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Fact(DisplayName = "Local source errors precede provider resolution")]
    public async Task Local_source_errors_precede_provider_resolution()
    {
        var provider = new FakeRecordingLineageProvider();
        var local = new LocalOriginalCandidateResult
        {
            Status = LocalOriginalCandidateStatus.SourceNotFound,
            SourceTrackId = TrackId.New(),
            Candidates = []
        };
        ExternalOriginalCandidateService service = CreateService(
            local,
            provider);

        ExternalOriginalCandidateResult result = await service.FindAsync(
            CollectionId.New(),
            local.SourceTrackId,
            ["missing-provider"],
            CancellationToken.None);

        Assert.Equal(LocalOriginalCandidateStatus.SourceNotFound, result.Local.Status);
        Assert.Empty(result.ProviderStatuses);
        Assert.Equal(0, provider.CallCount);
    }

    [Fact(DisplayName = "Multiple High local candidates retain ambiguity and invoke the provider")]
    public async Task Multiple_High_local_candidates_retain_ambiguity_and_invoke_the_provider()
    {
        var sourceTrackId =
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var provider = new FakeRecordingLineageProvider();
        var local = new LocalOriginalCandidateResult
        {
            Status = LocalOriginalCandidateStatus.Success,
            SourceTrackId = new TrackId(sourceTrackId),
            Source = SourceFacts(sourceTrackId),
            Candidates =
            [
                Candidate(
                    Guid.Parse("10000000-0000-0000-0000-000000000001"),
                    OriginalCandidateConfidence.High),
                Candidate(
                    Guid.Parse("20000000-0000-0000-0000-000000000002"),
                    OriginalCandidateConfidence.High)
            ]
        };
        ExternalOriginalCandidateService service = CreateService(
            local,
            provider);

        ExternalOriginalCandidateResult result = await service.FindAsync(
            CollectionId.New(),
            local.SourceTrackId,
            null,
            CancellationToken.None);

        Assert.Equal(2, result.Local.Candidates.Count);
        Assert.False(result.Local.HasReliableCandidate);
        Assert.Equal(1, provider.CallCount);
        Assert.Equal(
            ExternalProviderOperationOutcome.Succeeded,
            result.ProviderStatuses.Single(status =>
                status.ProviderCode == "musicbrainz").Outcome);
    }

    [Fact(DisplayName = "Provider codes are normalized deduplicated and sorted independently")]
    public async Task Provider_codes_are_normalized_deduplicated_and_sorted_independently()
    {
        var musicBrainz = new FakeRecordingLineageProvider("musicbrainz");
        var zeta = new FakeRecordingLineageProvider("zeta");
        LocalOriginalCandidateResult local = EmptyLocalResult();
        ExternalOriginalCandidateService service = CreateService(
            local,
            zeta,
            musicBrainz);

        ExternalOriginalCandidateResult result = await service.FindAsync(
            CollectionId.New(),
            local.SourceTrackId,
            [" ZETA ", "MUSICBRAINZ", "musicbrainz", "missing"],
            CancellationToken.None);

        Assert.Equal(
            ["missing", "musicbrainz", "zeta"],
            result.ProviderStatuses.Select(status => status.ProviderCode));
        Assert.Equal(
            [
                ExternalProviderOperationOutcome.UnknownProvider,
                ExternalProviderOperationOutcome.Succeeded,
                ExternalProviderOperationOutcome.Succeeded
            ],
            result.ProviderStatuses.Select(status => status.Outcome));
        Assert.Equal(1, musicBrainz.CallCount);
        Assert.Equal(1, zeta.CallCount);
    }

    [Theory(DisplayName = "Provider failures retain distinct typed statuses")]
    [InlineData(
        ExternalMetadataErrorKind.NotFound,
        ExternalProviderOperationOutcome.NotFound)]
    [InlineData(
        ExternalMetadataErrorKind.Disabled,
        ExternalProviderOperationOutcome.Disabled)]
    [InlineData(
        ExternalMetadataErrorKind.NotConfigured,
        ExternalProviderOperationOutcome.NotConfigured)]
    [InlineData(
        ExternalMetadataErrorKind.Unauthorized,
        ExternalProviderOperationOutcome.Unauthorized)]
    [InlineData(
        ExternalMetadataErrorKind.RateLimited,
        ExternalProviderOperationOutcome.RateLimited)]
    [InlineData(
        ExternalMetadataErrorKind.Timeout,
        ExternalProviderOperationOutcome.Timeout)]
    [InlineData(
        ExternalMetadataErrorKind.Unavailable,
        ExternalProviderOperationOutcome.Unavailable)]
    [InlineData(
        ExternalMetadataErrorKind.InvalidResponse,
        ExternalProviderOperationOutcome.InvalidResponse)]
    public async Task Provider_failures_retain_distinct_typed_statuses(
        ExternalMetadataErrorKind errorKind,
        ExternalProviderOperationOutcome expectedOutcome)
    {
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                new ExternalMetadataError(
                    errorKind,
                    $"musicbrainz.{errorKind.ToString().ToLowerInvariant()}",
                    "Private provider message",
                    TimeSpan.FromSeconds(17)))
        };
        LocalOriginalCandidateResult local = EmptyLocalResult();
        ExternalOriginalCandidateService service = CreateService(
            local,
            provider);

        ExternalOriginalCandidateResult result = await service.FindAsync(
            CollectionId.New(),
            local.SourceTrackId,
            ["musicbrainz"],
            CancellationToken.None);

        ExternalProviderOperationStatus status =
            result.ProviderStatuses.Single(value =>
                value.ProviderCode == "musicbrainz");
        Assert.Equal(expectedOutcome, status.Outcome);
        Assert.Equal(
            $"musicbrainz.{errorKind.ToString().ToLowerInvariant()}",
            status.ErrorCode);
        Assert.Equal(TimeSpan.FromSeconds(17), status.RetryAfter);
        Assert.Empty(result.Candidates);
    }

    [Fact(DisplayName = "Provider cancellation propagates instead of becoming a status")]
    public async Task Provider_cancellation_propagates_instead_of_becoming_a_status()
    {
        using var cancellationSource = new CancellationTokenSource();
        var provider = new FakeRecordingLineageProvider
        {
            CancelOnCall = true,
            CancelSourceOnCall = cancellationSource
        };
        LocalOriginalCandidateResult local = EmptyLocalResult();
        ExternalOriginalCandidateService service = CreateService(
            local,
            provider);

        OperationCanceledException exception =
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.FindAsync(
                CollectionId.New(),
                local.SourceTrackId,
                null,
                cancellationSource.Token));

        Assert.True(cancellationSource.IsCancellationRequested);
        Assert.Equal(
            cancellationSource.Token,
            provider.LastCancellationToken);
        Assert.Equal(
            cancellationSource.Token,
            exception.CancellationToken);
    }

    [Fact(DisplayName = "The provider query contains only current local source facts")]
    public async Task The_provider_query_contains_only_current_local_source_facts()
    {
        var provider = new FakeRecordingLineageProvider();
        LocalOriginalCandidateResult local = EmptyLocalResult();
        ExternalOriginalCandidateService service = CreateService(
            local,
            provider);

        _ = await service.FindAsync(
            CollectionId.New(),
            local.SourceTrackId,
            [],
            CancellationToken.None);

        RecordingLineageQuery query = Assert.IsType<RecordingLineageQuery>(
            provider.LastQuery);
        Assert.Equal("Blue Monday (Remix)", query.Title);
        Assert.Equal(["New Order"], query.Artists);
        Assert.Equal(TimeSpan.FromSeconds(420), query.Duration);
        Assert.Equal(1988, query.ApproximateYear);
        Assert.Null(query.KnownRecording);
    }
}
