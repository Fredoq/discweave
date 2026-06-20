namespace DiscWeave.Api.Features.Exports;

public static partial class ExportsEndpointRouteBuilderExtensions
{
    private static IEnumerable<string[]> LocalAudioFileRows(ExportSnapshotResponse snapshot)
    {
        return snapshot.LocalAudioFiles.Select(file => new[]
        {
            file.Id.ToString(),
            file.Path,
            file.Format ?? string.Empty,
            file.Codec ?? string.Empty,
            file.Quality ?? string.Empty,
            Invariant(file.SizeBytes),
            Invariant(file.ModifiedAt),
            file.ContentHash ?? string.Empty,
            Invariant(file.DurationSeconds),
            Invariant(file.BitrateKbps),
            Invariant(file.SampleRateHz),
            Invariant(file.Channels)
        });
    }

    private static IEnumerable<string[]> DigitalTrackFileLinkRows(ExportSnapshotResponse snapshot)
    {
        return snapshot.DigitalTrackFileLinks.Select(link => new[]
        {
            link.Id.ToString(),
            link.DigitalOwnedItemId.ToString(),
            link.ReleaseTrackId.ToString(),
            link.LocalAudioFileId.ToString()
        });
    }

    private static IEnumerable<string[]> ReviewReportRows(ExportSnapshotResponse snapshot)
    {
        return snapshot.ReviewReportItems.Select(item => new[]
        {
            item.Category,
            item.Subtype,
            item.Title,
            item.SourceDetector,
            item.TargetKind,
            item.TargetId.ToString(),
            item.TargetTitle,
            item.TargetSubtitle ?? string.Empty
        });
    }
}
