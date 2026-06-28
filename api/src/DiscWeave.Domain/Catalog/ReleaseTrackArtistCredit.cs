using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Catalog;

public sealed record ReleaseTrackArtistCredit
{
    private ReleaseTrackArtistCredit(ArtistId artistId, IReadOnlyList<string> roles)
    {
        ArtistId = artistId;
        Roles = roles;
    }

    public ArtistId ArtistId { get; }

    public IReadOnlyList<string> Roles { get; }

    public static ReleaseTrackArtistCredit Create(ArtistId artistId, IReadOnlyList<string> roles)
    {
        string[] normalizedRoles =
        [
            .. roles
                .Select(role => role.Trim())
                .Where(role => role.Length > 0)
                .Distinct(StringComparer.Ordinal)
        ];

        return new ReleaseTrackArtistCredit(artistId, normalizedRoles);
    }
}
