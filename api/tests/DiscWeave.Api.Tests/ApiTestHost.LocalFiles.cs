using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task<DigitalFileSeed> SeedDigitalTrackFileLinkAsync(
        Guid releaseId,
        Guid ownedItemId,
        int releaseTrackPosition,
        string path,
        string format,
        string contentHash,
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        Release release = await context.Releases.SingleAsync(
            candidate => candidate.CollectionId == DefaultCollectionId && candidate.Id == new ReleaseId(releaseId),
            cancellationToken);
        ReleaseTrack releaseTrack = release.Tracklist.Single(track => track.Position.Number == releaseTrackPosition);
        LocalAudioFile file = LocalAudioFile.Create(
                DefaultCollectionId,
                LocalAudioFileId.New(),
                FilePath.FromAbsolutePath(path))
            .WithFormat(ParseAudioFileFormat(format))
            .WithContentHash(contentHash);
        var link = DigitalTrackFileLink.Create(
            DefaultCollectionId,
            DigitalTrackFileLinkId.New(),
            new OwnedItemId(ownedItemId),
            releaseTrack.Id,
            file.Id);

        _ = context.LocalAudioFiles.Add(file);
        _ = context.DigitalTrackFileLinks.Add(link);
        _ = await context.SaveChangesAsync(cancellationToken);

        return new DigitalFileSeed(link.Id.Value, releaseTrack.Id.Value, file.Id.Value);
    }

    public async Task<LocalAudioFileSeed> SeedLocalAudioFileAsync(
        string path,
        string format,
        string contentHash,
        CancellationToken cancellationToken = default)
    {
        return await SeedLocalAudioFileAsync(DefaultCollectionId, path, format, contentHash, cancellationToken);
    }

    public async Task<LocalAudioFileSeed> SeedLocalAudioFileAsync(
        CollectionId collectionId,
        string path,
        string format,
        string contentHash,
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        LocalAudioFile file = LocalAudioFile.Create(
                collectionId,
                LocalAudioFileId.New(),
                FilePath.FromAbsolutePath(path))
            .WithFormat(ParseAudioFileFormat(format))
            .WithContentHash(contentHash);

        _ = context.LocalAudioFiles.Add(file);
        _ = await context.SaveChangesAsync(cancellationToken);

        return new LocalAudioFileSeed(file.Id.Value);
    }

    private static AudioFileFormat ParseAudioFileFormat(string format)
    {
        return format.Trim().ToLowerInvariant() switch
        {
            "flac" => AudioFileFormat.Flac,
            "mp3" => AudioFileFormat.Mp3,
            "ogg" => AudioFileFormat.Ogg,
            "wav" => AudioFileFormat.Wav,
            "aiff" => AudioFileFormat.Aiff,
            "alac" => AudioFileFormat.Alac,
            "m4a" => AudioFileFormat.M4a,
            _ => throw new ArgumentOutOfRangeException(nameof(format), format, "Audio file format is not supported")
        };
    }
}

internal sealed record LocalAudioFileSeed(Guid LocalAudioFileId);

internal sealed record DigitalFileSeed(
    Guid LinkId,
    Guid ReleaseTrackId,
    Guid LocalAudioFileId);
