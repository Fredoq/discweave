using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Credits;

public sealed record CreditIdentity(string TargetType, Guid TargetId, Guid ContributorArtistId, IReadOnlyList<string> Roles)
{
    public string Key => string.Join(
        '|',
        TargetType,
        TargetId.ToString("D"),
        ContributorArtistId.ToString("D"),
        string.Join(',', Roles.Select(NormalizeRole).Where(role => role.Length > 0).Order(StringComparer.Ordinal)));

    public static CreditIdentity From(CreditTarget target, ArtistId contributorArtistId, IReadOnlyList<string> roles)
    {
        ArgumentNullException.ThrowIfNull(target);

        (string targetType, Guid targetId) = target switch
        {
            ReleaseCreditTarget releaseTarget => ("release", releaseTarget.ReleaseId.Value),
            TrackCreditTarget trackTarget => ("track", trackTarget.TrackId.Value),
            _ => throw new InvalidOperationException("Credit target type is not supported")
        };

        return new CreditIdentity(targetType, targetId, contributorArtistId.Value, roles);
    }

    private static string NormalizeRole(string role)
    {
        return role.Trim();
    }
}
