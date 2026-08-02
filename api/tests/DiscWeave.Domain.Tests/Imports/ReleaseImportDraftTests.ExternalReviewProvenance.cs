using System.Reflection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Imports;

public sealed partial class ReleaseImportDraftTests
{
    [Fact(DisplayName = "External request fingerprints use the pinned MusicBrainz-only vector")]
    public void External_request_fingerprints_use_the_pinned_musicbrainz_only_vector()
    {
        string actual = ExternalReleaseImportRequestFingerprint.Create(
            new TrackId(Guid.Parse("11111111-1111-1111-1111-111111111111")),
            ReleaseImportProviderReference.Create(
                "musicbrainz",
                "recording",
                "22222222-2222-2222-2222-222222222222",
                "https://musicbrainz.org/recording/22222222-2222-2222-2222-222222222222"),
            MusicBrainzReleaseRowLocator.Create(
                "{33333333-3333-3333-3333-333333333333}".ToUpperInvariant(),
                "01",
                "44444444-4444-4444-4444-444444444444"),
            Optional.Missing<DiscogsReleaseRowLocator>(),
            " remixOf ");

        Assert.Equal("b9fff41be028e85631523efafe9cd40eb72f888173c13aec6853d821b57be4de", actual);
    }

    [Fact(DisplayName = "External request fingerprints use the pinned Discogs-backed vector")]
    public void External_request_fingerprints_use_the_pinned_discogs_backed_vector()
    {
        string actual = ExternalReleaseImportRequestFingerprint.Create(
            new TrackId(Guid.Parse("11111111-1111-1111-1111-111111111111")),
            ReleaseImportProviderReference.Create(
                "musicbrainz",
                "recording",
                "22222222-2222-2222-2222-222222222222",
                "https://musicbrainz.org/recording/22222222-2222-2222-2222-222222222222"),
            MusicBrainzReleaseRowLocator.Create(
                "33333333-3333-3333-3333-333333333333",
                "1",
                "44444444-4444-4444-4444-444444444444"),
            Optional.From(DiscogsReleaseRowLocator.Create(
                "0012345",
                7,
                " A   1 ",
                new string('A', 64))),
            "versionOf");

        Assert.Equal("aa04fe1f80517ee17fe93afcc225343e272ee22deb7704cd293910e446828c66", actual);
    }

    [Fact(DisplayName = "Length framing distinguishes ambiguous field boundaries")]
    public void Length_framing_distinguishes_ambiguous_field_boundaries()
    {
        string left = LengthFramedSha256.Hash(["ab", "c"]);
        string right = LengthFramedSha256.Hash(["a", "bc"]);

        Assert.Equal("f2939f903016e5bb29b1e4a61cdbd376220ca03a24180b39995f2d50f2e0a647", left);
        Assert.Equal("b534ce16ac9c8b36823f39a395ce8e0e3c7ad9605b82b5444f18cadacd217a5d", right);
        Assert.NotEqual(left, right);
    }

    [Fact(DisplayName = "External sessions retain normalized idempotency values")]
    public void External_sessions_retain_normalized_idempotency_values()
    {
        var session = ReleaseImportSession.CreateExternalMetadata(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            " request-key ",
            new string('a', 64),
            DateTimeOffset.UtcNow);

        Assert.Equal("request-key", Assert.IsType<PresentOptionalValue<string>>(session.IdempotencyKey).Value);
        Assert.Equal(new string('a', 64), Assert.IsType<PresentOptionalValue<string>>(session.IdempotencyRequestFingerprint).Value);
    }

    [Fact(DisplayName = "Authoritative draft provenance unions providers without catalog timestamps")]
    public void Authoritative_draft_provenance_unions_providers_without_catalog_timestamps()
    {
        var draft = ReleaseImportDraft.CreateExternalMetadata(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New());
        var musicBrainz = ReleaseImportProviderReference.Create(
            "musicbrainz",
            "release",
            "33333333-3333-3333-3333-333333333333",
            "https://musicbrainz.org/release/33333333-3333-3333-3333-333333333333");
        var discogs = ReleaseImportProviderReference.Create(
            "discogs",
            "release",
            "12345",
            "https://www.discogs.com/release/12345");

        draft.UnionAuthoritativeExternalSources([musicBrainz]);
        draft.UnionAuthoritativeExternalSources([discogs]);

        Assert.Equal(["discogs", "musicbrainz"], draft.ExternalSources.Select(source => source.ProviderCode));
        string json = Assert.IsType<string>(typeof(ReleaseImportDraft)
            .GetField("_externalSourcesJson", BindingFlags.Instance | BindingFlags.NonPublic)!
            .GetValue(draft));
        Assert.DoesNotContain("AppliedAt", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact(DisplayName = "Authoritative row provenance preserves Recording and Track identities")]
    public void Authoritative_row_provenance_preserves_recording_and_track_identities()
    {
        var row = ReleaseImportDraftTrack.CreateExternalMetadata(
            CollectionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportDraftTrackId.New());
        var recording = ReleaseImportProviderReference.Create(
            "musicbrainz",
            "recording",
            "22222222-2222-2222-2222-222222222222",
            "https://musicbrainz.org/recording/22222222-2222-2222-2222-222222222222");
        var track = ReleaseImportProviderReference.Create(
            "musicbrainz",
            "track",
            "44444444-4444-4444-4444-444444444444",
            "https://musicbrainz.org/track/44444444-4444-4444-4444-444444444444");

        row.UnionAuthoritativeExternalSources([recording, track]);

        Assert.Equal(["recording", "track"], row.ExternalSources.Select(source => source.ResourceType));
    }
}
