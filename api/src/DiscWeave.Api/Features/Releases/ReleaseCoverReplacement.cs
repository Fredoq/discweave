using DiscWeave.Application.Catalog.CoverArtwork;

namespace DiscWeave.Api.Features.Releases;

internal sealed record ReleaseCoverReplacement
{
    public required Stream Content { get; init; }
    public required string Extension { get; init; }
    public required string ContentType { get; init; }
    public required string FileName { get; init; }
    public CoverArtworkProvenance? Provenance { get; init; }
}
