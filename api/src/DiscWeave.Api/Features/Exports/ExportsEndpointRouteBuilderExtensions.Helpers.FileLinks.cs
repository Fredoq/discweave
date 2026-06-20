using DiscWeave.Api.Features.LocalFiles;
using DiscWeave.Api.Features.ReviewWorkbench;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Exports;

public static partial class ExportsEndpointRouteBuilderExtensions
{
    private static async Task<IReadOnlyList<LocalAudioFileExportResponse>> LoadLocalAudioFilesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.LocalAudioFiles.AsNoTracking()
                .Where(file => file.CollectionId == collectionId)
                .OrderBy(file => file.Path)
                .ToArrayAsync(cancellationToken))
                .Select(ToLocalAudioFileExportResponse)
        ];
    }

    private static async Task<IReadOnlyList<DigitalTrackFileLinkExportResponse>> LoadDigitalTrackFileLinksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.DigitalTrackFileLinks.AsNoTracking()
                .Where(link => link.CollectionId == collectionId)
                .OrderBy(link => link.Id)
                .ToArrayAsync(cancellationToken))
                .Select(link => new DigitalTrackFileLinkExportResponse(
                    link.Id.Value,
                    link.DigitalOwnedItemId.Value,
                    link.ReleaseTrackId.Value,
                    link.LocalAudioFileId.Value))
        ];
    }

    private static async Task<IReadOnlyList<ReviewReportItemResponse>> LoadReviewReportItemsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<ReviewWorkbenchSignal> signals = await ReviewWorkbenchSignalBuilder.BuildAsync(
            context,
            collectionId,
            cancellationToken);

        return
        [
            .. signals.SelectMany(signal => signal.Targets.Select(target => new ReviewReportItemResponse(
                signal.Category,
                signal.Subtype,
                signal.Title,
                signal.SourceDetector,
                target.Kind,
                target.Id,
                target.Title,
                target.Subtitle)))
        ];
    }

    private static LocalAudioFileExportResponse ToLocalAudioFileExportResponse(LocalAudioFile file)
    {
        LocalAudioFileFields fields = LocalAudioFileContractMapper.ToFields(file);

        return new LocalAudioFileExportResponse(
            fields.Id,
            fields.Path,
            fields.Format,
            fields.Codec,
            fields.Quality,
            fields.SizeBytes,
            fields.ModifiedAt,
            fields.ContentHash,
            fields.DurationSeconds,
            fields.BitrateKbps,
            fields.SampleRateHz,
            fields.Channels);
    }
}
