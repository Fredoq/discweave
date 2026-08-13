using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Catalog;

public sealed partial class ExternalSourceReferenceTests
{
    [Fact(DisplayName = "External source union preserves unrelated identities and refreshes authoritative metadata")]
    public void External_source_union_preserves_unrelated_identities_and_refreshes_authoritative_metadata()
    {
        var release = Release.Create(CollectionId.New(), ReleaseId.New(), "Blue Monday");
        DateTimeOffset older = AppliedAt.AddDays(-1);
        DateTimeOffset newer = AppliedAt.AddDays(1);
        release.ReplaceExternalSources(
        [
            ExternalSourceReference.Create(
                "discogs",
                "release",
                "249504",
                "https://www.discogs.com/release/old",
                AppliedAt),
            ExternalSourceReference.Create(
                "musicbrainz",
                "release",
                "11111111-1111-1111-1111-111111111111",
                "https://musicbrainz.org/release/11111111-1111-1111-1111-111111111111",
                AppliedAt)
        ]);

        release.UnionExternalSources(
        [
            ExternalSourceReference.Create(
                "DISCOGS",
                "RELEASE",
                "249504",
                "https://www.discogs.com/release/new",
                newer),
            ExternalSourceReference.Create(
                "musicbrainz",
                "release",
                "22222222-2222-2222-2222-222222222222",
                "https://musicbrainz.org/release/22222222-2222-2222-2222-222222222222",
                older)
        ]);

        Assert.Equal(3, release.ExternalSources.Count);
        ExternalSourceReference refreshed = Assert.Single(
            release.ExternalSources,
            source => source.ProviderName == "discogs" && source.ExternalId == "249504");
        Assert.Equal("https://www.discogs.com/release/new", refreshed.SourceUrl);
        Assert.Equal(newer, refreshed.AppliedAt);

        release.UnionExternalSources(
        [
            ExternalSourceReference.Create(
                "discogs",
                "release",
                "249504",
                "https://www.discogs.com/release/stale",
                older)
        ]);

        Assert.Equal("https://www.discogs.com/release/new", refreshed.SourceUrl);
        Assert.Equal(newer, refreshed.AppliedAt);
    }

    [Fact(DisplayName = "External source union rejects duplicate authoritative identities atomically")]
    public void External_source_union_rejects_duplicate_authoritative_identities_atomically()
    {
        var release = Release.Create(CollectionId.New(), ReleaseId.New(), "Blue Monday");
        ExternalSourceReference existing = Source("release", "249504");
        release.ReplaceExternalSources([existing]);

        DomainException exception = Assert.Throws<DomainException>(() => release.UnionExternalSources(
        [
            Source("release", "12345"),
            Source("release", "12345")
        ]));

        Assert.Equal("external_source.duplicate", exception.Code);
        Assert.Same(existing, Assert.Single(release.ExternalSources));
    }

    [Fact(DisplayName = "External source references canonicalize provider and resource codes")]
    public void External_source_references_canonicalize_provider_and_resource_codes()
    {
        var source = ExternalSourceReference.Create(
            " DISCOGS ",
            " RELEASE ",
            " 249504 ",
            "https://www.discogs.com/release/249504",
            AppliedAt);

        Assert.Equal("discogs", source.ProviderName);
        Assert.Equal("release", source.ResourceType);
        Assert.Equal("249504", source.ExternalId);
    }
}
