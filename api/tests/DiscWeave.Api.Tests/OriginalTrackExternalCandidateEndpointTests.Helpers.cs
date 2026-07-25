using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.ExternalMetadata;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
    : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public OriginalTrackExternalCandidateEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    private async Task<ApiTestHost> CreateHostWithResultAsync(
        LocalOriginalCandidateResult result,
        FakeRecordingLineageProvider provider)
    {
        return await ApiTestHost.CreateAsync(
            _sqlite,
            services =>
            {
                _ = services.RemoveAll<ILocalOriginalCandidateService>();
                _ = services.AddSingleton<ILocalOriginalCandidateService>(
                    new StubLocalOriginalCandidateService(result));
                _ = services.RemoveAll<IExternalMetadataProvider>();
                _ = services.AddSingleton<IExternalMetadataProvider>(provider);
            });
    }

    private static LocalOriginalSourceFacts SourceFacts(Guid sourceTrackId)
    {
        return new LocalOriginalSourceFacts
        {
            TrackId = new TrackId(sourceTrackId),
            Title = "Blue Monday (Remix)",
            BaseTitle = "Blue Monday",
            Artists = ["New Order"],
            Duration = TimeSpan.FromSeconds(420),
            ApproximateYear = 1988
        };
    }

    private static LocalOriginalCandidateResult EmptyLocalResult()
    {
        var sourceTrackId =
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        return new LocalOriginalCandidateResult
        {
            Status = LocalOriginalCandidateStatus.Success,
            SourceTrackId = new TrackId(sourceTrackId),
            Source = SourceFacts(sourceTrackId),
            Candidates = []
        };
    }

    private static ExternalOriginalCandidateService CreateService(
        LocalOriginalCandidateResult local,
        params IExternalMetadataProvider[] providers)
    {
        return new ExternalOriginalCandidateService(
            new StubLocalOriginalCandidateService(local),
            new ExternalMetadataProviderResolver(providers));
    }

    private static LocalOriginalCandidate Candidate(
        Guid trackId,
        OriginalCandidateConfidence confidence)
    {
        string candidateKey =
            trackId.ToString("D").ToLowerInvariant();
        return new LocalOriginalCandidate
        {
            CandidateKey = candidateKey,
            LocalTrackId = new TrackId(trackId),
            Title = "Blue Monday",
            ArtistDisplay = "New Order",
            Duration = TimeSpan.FromSeconds(418),
            VersionYear = 1983,
            IsExistingRoot = confidence == OriginalCandidateConfidence.High,
            MemberCount =
                confidence == OriginalCandidateConfidence.High ? 1 : 0,
            RequiresPromotion =
                confidence != OriginalCandidateConfidence.High,
            SuggestedRelationTypeCode = "remixOf",
            Ranked = new RankedOriginalCandidate
            {
                CandidateKey = candidateKey,
                Confidence = confidence,
                Selectable = confidence != OriginalCandidateConfidence.Low,
                CandidateChronology =
                    OriginalCandidateChronology.FromYear(1983, complete: true),
                SupportingEvidence = [],
                Contradictions = [],
                MissingEvidence = []
            }
        };
    }

    private sealed class StubLocalOriginalCandidateService
        : ILocalOriginalCandidateService
    {
        private readonly LocalOriginalCandidateResult _result;

        public StubLocalOriginalCandidateService(
            LocalOriginalCandidateResult result)
        {
            _result = result;
        }

        public Task<LocalOriginalCandidateResult> FindAsync(
            CollectionId collectionId,
            TrackId sourceTrackId,
            CancellationToken cancellationToken)
        {
            _ = collectionId;
            _ = sourceTrackId;
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(_result);
        }
    }

    private sealed class FakeRecordingLineageProvider
        : IExternalMetadataProvider, IRecordingLineageProvider
    {
        public FakeRecordingLineageProvider(
            string providerCode = "musicbrainz")
        {
            ProviderCode = providerCode;
        }

        public string ProviderCode { get; }

        public int CallCount { get; private set; }

        public RecordingLineageQuery? LastQuery { get; private set; }

        public bool CancelOnCall { get; set; }

        public ExternalMetadataResult<RecordingLineageResult> Result { get; set; } =
            new(new RecordingLineageResult
            {
                Candidates = [],
                ChronologyComplete = true,
                Warnings = []
            });

        public Task<ExternalMetadataResult<RecordingLineageResult>> FindOriginalsAsync(
            RecordingLineageQuery query,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            CallCount++;
            LastQuery = query;
            return CancelOnCall
                ? throw new OperationCanceledException(cancellationToken)
                : Task.FromResult(Result);
        }

        public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>> SearchReleasesAsync(
            ExternalMetadataReleaseSearchQuery query,
            CancellationToken cancellationToken)
        {
            _ = query;
            _ = cancellationToken;
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetReleaseAsync(
            ExternalMetadataLookupQuery query,
            CancellationToken cancellationToken)
        {
            _ = query;
            _ = cancellationToken;
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataArtistCandidate>>> SearchArtistsAsync(
            ExternalMetadataArtistSearchQuery query,
            CancellationToken cancellationToken)
        {
            _ = query;
            _ = cancellationToken;
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataArtistDetail>> GetArtistAsync(
            ExternalMetadataLookupQuery query,
            CancellationToken cancellationToken)
        {
            _ = query;
            _ = cancellationToken;
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>>> SearchTracksAsync(
            ExternalMetadataTrackSearchQuery query,
            CancellationToken cancellationToken)
        {
            _ = query;
            _ = cancellationToken;
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataTrackDetail>> GetTrackAsync(
            ExternalMetadataLookupQuery query,
            CancellationToken cancellationToken)
        {
            _ = query;
            _ = cancellationToken;
            throw new NotSupportedException();
        }
    }
}
