using DiscWeave.Api.Features.ExternalSources;

namespace DiscWeave.Api.Features.Releases;

public sealed record ReleaseTrackRequest
{
    public string? TrackMode { get; init; }

    public Guid? TrackId { get; init; }

    public string? Title { get; init; }

    public int Position { get; init; }

    public string? Disc { get; init; }

    public string? Side { get; init; }

    public int? DurationSeconds { get; init; }

    public int? VersionYear { get; init; }

    public IReadOnlyList<ReleaseArtistCreditRequest>? ArtistCredits { get; init; }

    public bool? InheritReleaseArtistCredits { get; init; }

    public IReadOnlyList<ExternalSourceReferenceRequest>? ExternalSources { get; init; }
}
