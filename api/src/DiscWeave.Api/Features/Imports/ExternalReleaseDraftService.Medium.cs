using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseDraftService
{
    private static ReleaseImportCollectionItemIntent.NewWanted InferWantedIntent(
        IReadOnlyList<string> formats)
    {
        string? format = formats
            .Select(value => value.Trim())
            .FirstOrDefault(value => value.Length > 0);
        if (format is null)
        {
            return ReleaseImportCollectionItemIntent.NewWanted.WithoutMedium();
        }

        ReleaseImportMediumIntent? medium = format switch
        {
            _ when ContainsAny(format, "digital", "file") =>
                ReleaseImportMediumIntent.Digital.Create(),
            _ when ContainsAny(format, "vinyl", "shellac", "lp", "7\"", "10\"", "12\"", "rpm") =>
                ReleaseImportMediumIntent.Vinyl.Create(format),
            _ when ContainsAny(format, "compact disc", "cd") =>
                ReleaseImportMediumIntent.CompactDisc.Create(1),
            _ when ContainsAny(format, "cassette", "tape") =>
                ReleaseImportMediumIntent.Cassette.Create(format),
            _ => null
        };

        return medium is null
            ? ReleaseImportCollectionItemIntent.NewWanted.WithoutMedium()
            : ReleaseImportCollectionItemIntent.NewWanted.WithMedium(medium);
    }

    private static bool ContainsAny(string value, params string[] markers)
    {
        return markers.Any(marker => value.Contains(marker, StringComparison.OrdinalIgnoreCase));
    }
}
