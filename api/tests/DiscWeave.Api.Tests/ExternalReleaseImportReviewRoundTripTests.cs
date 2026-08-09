using DiscWeave.Api.Features.Imports;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Api.Tests;

public sealed class ExternalReleaseImportReviewRoundTripTests
{
    [Fact(DisplayName = "Import review provider source echo accepts canonical equality")]
    public void Import_review_provider_source_echo_accepts_canonical_equality()
    {
        IReadOnlyList<ReleaseImportProviderReference> persisted =
        [
            ReleaseImportProviderReference.Create(
                "musicbrainz",
                "recording",
                "22222222-2222-2222-2222-222222222222",
                "https://musicbrainz.org/recording/22222222-2222-2222-2222-222222222222")
        ];
        IReadOnlyList<ReleaseImportProviderReferenceRequest> echoed =
        [
            new ReleaseImportProviderReferenceRequest
            {
                ProviderCode = " MusicBrainz ",
                ResourceType = " Recording ",
                ExternalId = "{22222222-2222-2222-2222-222222222222}",
                SourceUrl = "https://musicbrainz.org/recording/22222222-2222-2222-2222-222222222222"
            }
        ];

        ReleaseImportProviderReferenceMapper.EnsureEqualEcho(echoed, persisted);
        _ = Assert.Single(persisted);
    }

    [Fact(DisplayName = "Import review provider source echo rejects a forged URL")]
    public void Import_review_provider_source_echo_rejects_a_forged_url()
    {
        IReadOnlyList<ReleaseImportProviderReference> persisted =
        [
            ReleaseImportProviderReference.Create(
                "musicbrainz",
                "recording",
                "22222222-2222-2222-2222-222222222222",
                "https://musicbrainz.org/recording/22222222-2222-2222-2222-222222222222")
        ];
        IReadOnlyList<ReleaseImportProviderReferenceRequest> echoed =
        [
            new ReleaseImportProviderReferenceRequest
            {
                ProviderCode = "musicbrainz",
                ResourceType = "recording",
                ExternalId = "22222222-2222-2222-2222-222222222222",
                SourceUrl = "https://example.test/forged"
            }
        ];

        DomainException exception = Assert.Throws<DomainException>(() =>
            ReleaseImportProviderReferenceMapper.EnsureEqualEcho(echoed, persisted));

        Assert.Equal("import.external_sources_read_only", exception.Code);
    }
}
